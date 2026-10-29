import logging
import re
import threading
import time
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple

from src import config
from src.db.supabase_client import db_client
from src.job_discovery.boolean_parser import BooleanSearchParser
from src.job_discovery.e2e_fixtures import build_e2e_jobs
from src.job_discovery.greenhouse import GreenhouseFetcher
from src.job_discovery.lever import LeverFetcher
from src.job_discovery.jsearch_client import JSearchClient
from src.job_discovery.rss_fetcher import RSSJobFetcher

logger = logging.getLogger("job_aggregator")

ALLOWED_JOB_SOURCES = frozenset(
    {
        "greenhouse_ats",
        "lever_ats",
        "weworkremotely_rss",
        "jobicy_rss",
        "jsearch_api",
    }
)
FORBIDDEN_JOB_HOSTS = frozenset({"linkedin.com", "www.linkedin.com"})


class JobAggregator:
    """
    Orchestrates fetching from Greenhouse ATS, Lever ATS, and compliant RSS feeds.
    Applies boolean query matching, deduplication, skill-scoring, and reason explanations.
    Uses single-flight coordination, backoff, and stale-while-revalidate to prevent cache stampedes.
    """

    CACHE_TTL_SECONDS: float = 900.0  # 15 minutes bounded cache TTL
    FORCE_REFRESH_COOLDOWN: float = 15.0  # 15s debounce for forced refresh

    def __init__(self):
        self.jsearch = JSearchClient()
        self.greenhouse = GreenhouseFetcher()
        self.lever = LeverFetcher()
        self.rss = RSSJobFetcher()
        self._cached_pool: Optional[List[Dict[str, Any]]] = None
        self._cached_at: Optional[float] = None
        self._last_refresh_attempt: float = 0.0
        self._refresh_lock = threading.Lock()
        self._source_status: Dict[str, str] = {}

    def get_source_freshness(self) -> Dict[str, Any]:
        """Returns metadata regarding cache age and upstream source health."""
        now = time.time()
        age_seconds = (now - self._cached_at) if self._cached_at else None
        return {
            "cached_at": self._cached_at,
            "cache_age_seconds": round(age_seconds, 1) if age_seconds is not None else None,
            "is_stale": age_seconds is None or age_seconds >= self.CACHE_TTL_SECONDS,
            "ttl_seconds": self.CACHE_TTL_SECONDS,
            "source_status": dict(self._source_status),
        }

    def get_raw_pool(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """Gathers and deduplicates jobs from ATS & RSS sources with bounded memory caching.
        Employs single-flight refresh coordination and stale-while-revalidate to eliminate stampedes.
        """
        now = time.time()
        is_fresh = (
            self._cached_pool is not None
            and self._cached_at is not None
            and (now - self._cached_at) < self.CACHE_TTL_SECONDS
        )
        if is_fresh and not force_refresh:
            return self._cached_pool

        # Debounce force-refresh requests to avoid pounding upstream APIs
        if force_refresh and self._cached_pool is not None:
            if (now - self._last_refresh_attempt) < self.FORCE_REFRESH_COOLDOWN:
                logger.info("Forced refresh called within cooldown period; returning cached pool.")
                return self._cached_pool

        # Single-flight lock: if another request is actively refreshing, serve stale cache
        acquired = self._refresh_lock.acquire(blocking=False)
        if not acquired:
            if self._cached_pool is not None:
                logger.info("Upstream refresh already in-flight; returning stale cache (stale-while-revalidate).")
                return self._cached_pool
            # Wait for the first fetch to finish if no cached data exists
            self._refresh_lock.acquire(blocking=True)

        try:
            # Re-check freshness after acquiring lock
            now = time.time()
            if not force_refresh and self._cached_pool is not None and self._cached_at and (now - self._cached_at) < self.CACHE_TTL_SECONDS:
                return self._cached_pool

            self._last_refresh_attempt = now
            raw_pool: List[Dict[str, Any]] = []
            source_status: Dict[str, str] = {"greenhouse": "ok", "lever": "ok", "rss": "ok"}
            if config.AUTOMATION_E2E_MODE:
                raw_pool.extend(build_e2e_jobs())
                source_status = {"e2e_fixtures": "ok"}
            else:
                try:
                    raw_pool.extend(self.greenhouse.fetch_all(max_per_board=10))
                    if self.greenhouse.last_errors:
                        if len(self.greenhouse.last_errors) >= len(self.greenhouse.boards):
                            source_status["greenhouse"] = f"failed: all {len(self.greenhouse.boards)} boards errored"
                        else:
                            source_status["greenhouse"] = f"degraded: {len(self.greenhouse.last_errors)}/{len(self.greenhouse.boards)} boards errored"
                except Exception as e:
                    logger.warning(f"Greenhouse fetch encountered issues: {e}")
                    source_status["greenhouse"] = f"failed: {str(e)}"

                try:
                    raw_pool.extend(self.lever.fetch_all(max_per_company=10))
                    if self.lever.last_errors:
                        if len(self.lever.last_errors) >= len(self.lever.companies):
                            source_status["lever"] = f"failed: all {len(self.lever.companies)} companies errored"
                        else:
                            source_status["lever"] = f"degraded: {len(self.lever.last_errors)}/{len(self.lever.companies)} companies errored"
                except Exception as e:
                    logger.warning(f"Lever fetch encountered issues: {e}")
                    source_status["lever"] = f"failed: {str(e)}"

                try:
                    raw_pool.extend(self.rss.fetch_all(max_per_feed=15))
                except Exception as e:
                    logger.warning(f"RSS fetch encountered issues: {e}")
                    source_status["rss"] = f"failed: {str(e)}"

            # Enforce source policy at the aggregation boundary.
            compliant_pool = [job for job in raw_pool if self._is_permitted_job(job)]
            self._cached_pool = self._deduplicate_jobs(compliant_pool)
            self._cached_at = time.time()
            self._source_status = source_status
            return self._cached_pool
        finally:
            self._refresh_lock.release()

    def discover_jobs(
        self,
        student_skills: List[str],
        target_role: str = "Software Engineer Intern",
        boolean_query: Optional[str] = None,
        locations: Optional[List[str]] = None,
        max_results: int = 25,
        save_to_db: bool = True,
        force_refresh: bool = False,
        student_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Discovers, filters, scores, and ranks jobs for a student profile.

        Supabase-first caching strategy:
          1. If `student_id` is known and `force_refresh` is False, check Supabase
             (or local SQLite) for jobs cached within the last 24 hours.
          2. If a fresh cache exists → return it immediately (no JSearch call = quota saved).
          3. If no cache or force_refresh=True → call JSearch, save results, return them.
        """
        has_provided_skills = bool([s.strip() for s in (student_skills or []) if s and s.strip()])
        effective_skills = [s.strip() for s in (student_skills or []) if s and s.strip()]
        if not effective_skills:
            from src.api.server import get_fallback_skills_for_role
            effective_skills = get_fallback_skills_for_role(target_role)

        effective_locations = locations or ["India", "Bangalore", "Remote"]
        logger.info(
            "Discovering jobs for role='%s', skills=%s, locations=%s, student_id=%s",
            target_role,
            effective_skills[:4],
            effective_locations,
            student_id,
        )

        # ── SUPABASE CACHE CHECK — protect the 200 calls/month JSearch quota ──
        if student_id and save_to_db and not force_refresh and not config.AUTOMATION_E2E_MODE:
            cached = db_client.get_cached_jobs_for_student(
                student_id=student_id,
                max_age_hours=24,
            )
            if cached:
                logger.info(
                    "Serving %d jobs from cache for student '%s' — JSearch NOT called.",
                    len(cached), student_id,
                )
                return cached[:max_results]
            logger.info(
                "Cache MISS for student '%s' — will call JSearch now.", student_id
            )

        # ── PRIMARY PATH: JSearch API ─────────────────────────────────────────
        if self.jsearch.is_configured and not config.AUTOMATION_E2E_MODE:
            raw_jobs = self.jsearch.discover_for_profile(
                target_role=target_role,
                skills=effective_skills,
                locations=effective_locations,
                max_results=max_results,
            )
            matched_jobs = self._score_jsearch_jobs(
                raw_jobs=raw_jobs,
                student_skills=effective_skills,
                target_role=target_role,
            )

        # ── FALLBACK PATH: legacy Greenhouse / Lever / RSS ────────────────────
        else:
            if not boolean_query:
                boolean_query = BooleanSearchParser.build_query_from_profile(
                    skills=effective_skills if has_provided_skills else [],
                    target_role=target_role,
                    locations=effective_locations,
                )
            logger.info(
                "JSearch not configured — falling back to legacy boolean search: %s",
                boolean_query,
            )
            deduped = self.get_raw_pool(force_refresh=force_refresh)
            matched_jobs = self._legacy_boolean_filter(
                pool=deduped,
                boolean_query=boolean_query,
                student_skills=effective_skills,
                target_role=target_role,
                has_provided_skills=has_provided_skills,
            )

        # Sort by relevance score descending and cap results
        matched_jobs.sort(key=lambda x: x["relevance_score"], reverse=True)
        final_jobs = matched_jobs[:max_results]

        # Stamp student_id onto every job record before persisting
        if student_id:
            for job in final_jobs:
                job.setdefault("student_id", student_id)

        # Sync to Supabase (or SQLite fallback) so subsequent calls hit the cache
        if save_to_db and final_jobs:
            db_client.save_discovered_jobs(final_jobs)

        return final_jobs

    def _score_jsearch_jobs(
        self,
        raw_jobs: List[Dict[str, Any]],
        student_skills: List[str],
        target_role: str,
    ) -> List[Dict[str, Any]]:
        """Score and format JSearch API results into our discovered_jobs schema."""
        results = []
        for job in raw_jobs:
            if not self._is_permitted_job(job):
                continue

            searchable_text = (
                f"{job['title']} {job['company']} "
                f"{job.get('location', '')} {job.get('description', '')}"
            )
            matched_skills_found = []
            for skill in student_skills:
                pattern = r"(?:\b|_)" + re.escape(skill.lower()) + r"(?:\b|_)"
                if re.search(pattern, searchable_text.lower()):
                    matched_skills_found.append(skill)

            relevance, match_reason = self._compute_relevance(
                job=job,
                student_skills=student_skills,
                matched_skills=matched_skills_found,
                target_role=target_role,
                matches_boolean=True,
            )

            is_intern = any(
                k in job["title"].lower() or k in job.get("description", "").lower()
                for k in ["intern", "internship", "co-op", "trainee", "graduate"]
            )
            emp_type = job.get("employment_type", "internship" if is_intern else "full_time")

            results.append({
                "id": job["id"],
                "title": job["title"],
                "company": job["company"],
                "location": job.get("location", "Remote"),
                "url": job["url"],
                "source": job["source"],
                "description": job.get("description", "") or match_reason,
                "required_skills": list(job.get("required_skills") or []),
                "matched_skills": matched_skills_found,
                "relevance_score": max(50.0, relevance),
                "match_reason": match_reason or f"Matched via JSearch for '{target_role}'",
                "is_remote": job.get("is_remote", False),
                "job_type": "internship/entry-level" if is_intern else "full_time",
                "employment_type": emp_type,
                "publication_status": "published",
                "is_msot_post": False,
                "posted_at": job.get("posted_at"),
                "boolean_matched": True,
            })
        return results

    def _legacy_boolean_filter(
        self,
        pool: List[Dict[str, Any]],
        boolean_query: str,
        student_skills: List[str],
        target_role: str,
        has_provided_skills: bool,
    ) -> List[Dict[str, Any]]:
        """Legacy filter using Greenhouse/Lever/RSS pool with boolean matching."""
        matched_jobs: List[Dict[str, Any]] = []
        for job in pool:
            searchable_text = (
                f"{job['title']} {job['company']} "
                f"{job.get('location', '')} {job.get('description', '')}"
            )
            try:
                matches_query = BooleanSearchParser.matches(boolean_query, searchable_text)
            except Exception:
                matches_query = False
            if not matches_query:
                continue

            matched_skills_found = []
            for skill in student_skills:
                pattern = r"(?:\b|_)" + re.escape(skill.lower()) + r"(?:\b|_)"
                if re.search(pattern, searchable_text.lower()):
                    matched_skills_found.append(skill)

            relevance, match_reason = self._compute_relevance(
                job=job,
                student_skills=student_skills,
                matched_skills=matched_skills_found,
                target_role=target_role,
                matches_boolean=matches_query,
            )
            is_intern = any(
                k in job["title"].lower() or k in job.get("description", "").lower()
                for k in ["intern", "internship", "co-op", "trainee", "graduate"]
            )
            emp_type = "internship" if is_intern else "full_time"
            matched_jobs.append({
                "id": job["id"],
                "title": job["title"],
                "company": job["company"],
                "location": job.get("location", "Remote"),
                "url": job["url"],
                "source": job["source"],
                "description": job.get("description", "") or match_reason,
                "required_skills": list(job.get("required_skills") or []),
                "matched_skills": matched_skills_found,
                "relevance_score": relevance,
                "match_reason": match_reason,
                "is_remote": job.get("is_remote", False),
                "job_type": "internship/entry-level" if is_intern else "full_time",
                "employment_type": emp_type,
                "publication_status": "published",
                "posted_at": job.get("posted_at"),
                "boolean_matched": matches_query,
            })

        if not matched_jobs and not has_provided_skills:
            for job in pool:
                searchable_text = (
                    f"{job['title']} {job['company']} "
                    f"{job.get('location', '')} {job.get('description', '')}".lower()
                )
                role_words = [w.lower() for w in target_role.split() if len(w) > 2]
                if any(w in searchable_text for w in role_words):
                    relevance, match_reason = self._compute_relevance(
                        job=job,
                        student_skills=student_skills,
                        matched_skills=[],
                        target_role=target_role,
                        matches_boolean=False,
                    )
                    is_intern = any(
                        k in job["title"].lower()
                        for k in ["intern", "internship", "co-op", "trainee"]
                    )
                    matched_jobs.append({
                        "id": job["id"],
                        "title": job["title"],
                        "company": job["company"],
                        "location": job.get("location", "Remote"),
                        "url": job["url"],
                        "source": job["source"],
                        "description": job.get("description", "") or match_reason,
                        "required_skills": list(job.get("required_skills") or []),
                        "matched_skills": [],
                        "relevance_score": max(50, relevance),
                        "match_reason": f"Recommended based on your target role ({target_role}).",
                        "is_remote": job.get("is_remote", False),
                        "job_type": "internship/entry-level" if is_intern else "full_time",
                        "employment_type": "internship" if is_intern else "full_time",
                        "publication_status": "published",
                        "posted_at": job.get("posted_at"),
                        "boolean_matched": True,
                    })
        return matched_jobs

    @staticmethod
    def _is_permitted_job(job: Dict[str, Any]) -> bool:
        source = str(job.get("source", ""))
        if source not in ALLOWED_JOB_SOURCES:
            logger.warning("Rejected job from unapproved source: %s", source or "missing")
            return False

        hostname = (urllib.parse.urlparse(str(job.get("url", ""))).hostname or "").lower()
        if hostname in FORBIDDEN_JOB_HOSTS or hostname.endswith(".linkedin.com"):
            logger.warning("Rejected LinkedIn job URL from source %s", source)
            return False

        return True

    def _deduplicate_jobs(self, jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen_keys = set()
        unique_jobs = []

        for job in jobs:
            # Normalize URL (strip tracking params and trailing slash)
            url_norm = job.get("url", "").split("?")[0].rstrip("/").lower()
            title_norm = re.sub(r"[^a-z0-9]", "", job.get("title", "").lower())
            company_norm = re.sub(r"[^a-z0-9]", "", job.get("company", "").lower())

            combo_key = f"{company_norm}_{title_norm}"
            if url_norm and url_norm in seen_keys:
                continue
            if combo_key in seen_keys:
                continue

            seen_keys.add(url_norm)
            seen_keys.add(combo_key)
            unique_jobs.append(job)

        return unique_jobs

    def _compute_relevance(
        self,
        job: Dict[str, Any],
        student_skills: List[str],
        matched_skills: List[str],
        target_role: str,
        matches_boolean: bool,
    ) -> Tuple[float, str]:
        score = 0.0
        reasons = []

        title_lower = job["title"].lower()
        desc_lower = job.get("description", "").lower()

        # Skill ratio (up to 40 pts)
        if student_skills:
            skill_ratio = len(matched_skills) / max(len(student_skills), 1)
            skill_pts = min(40.0, skill_ratio * 50.0)
            score += skill_pts
            if matched_skills:
                reasons.append(
                    f"Matches {len(matched_skills)} core skill(s): {', '.join(matched_skills[:4])}"
                )

        # Role match in title (up to 30 pts)
        target_terms = [t.lower() for t in target_role.split() if len(t) > 2]
        matched_role_terms = [t for t in target_terms if t in title_lower]
        if matched_role_terms:
            score += 25.0
            reasons.append(f"Job title aligns directly with '{' '.join(matched_role_terms)}'")
        elif any(t in desc_lower for t in target_terms):
            score += 12.0

        # Internship / Student friendly keyword bonus (up to 15 pts)
        student_keywords = [
            "intern",
            "internship",
            "graduate",
            "junior",
            "entry level",
            "university",
            "trainee",
            "fresher",
        ]
        found_student_kw = [k for k in student_keywords if k in title_lower or k in desc_lower]
        if found_student_kw:
            score += 15.0
            reasons.append(f"Student-friendly role ({found_student_kw[0]})")

        # Remote flexibility (up to 10 pts)
        if job.get("is_remote") or "remote" in title_lower:
            score += 10.0
            reasons.append("Remote / flexible work permitted")

        # Boolean match validation (5 pts)
        if matches_boolean:
            score += 5.0

        final_score = round(min(100.0, score), 1)
        reason_text = " | ".join(reasons) if reasons else "General tech relevance"

        return final_score, reason_text
