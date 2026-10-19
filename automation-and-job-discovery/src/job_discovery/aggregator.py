import logging
import re
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple

from src import config
from src.db.supabase_client import db_client
from src.job_discovery.boolean_parser import BooleanSearchParser
from src.job_discovery.e2e_fixtures import build_e2e_jobs
from src.job_discovery.greenhouse import GreenhouseFetcher
from src.job_discovery.lever import LeverFetcher
from src.job_discovery.rss_fetcher import RSSJobFetcher

logger = logging.getLogger("job_aggregator")

ALLOWED_JOB_SOURCES = frozenset(
    {
        "greenhouse_ats",
        "lever_ats",
        "weworkremotely_rss",
        "jobicy_rss",
    }
)
FORBIDDEN_JOB_HOSTS = frozenset({"linkedin.com", "www.linkedin.com"})


class JobAggregator:
    """
    Orchestrates fetching from Greenhouse ATS, Lever ATS, and compliant RSS feeds.
    Applies boolean query matching, deduplication, skill-scoring, and reason explanations.
    """

    def __init__(self):
        self.greenhouse = GreenhouseFetcher()
        self.lever = LeverFetcher()
        self.rss = RSSJobFetcher()
        self._cached_pool: Optional[List[Dict[str, Any]]] = None

    def get_raw_pool(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """Gathers and deduplicates jobs from ATS & RSS sources with memory caching."""
        if self._cached_pool is not None and not force_refresh:
            return self._cached_pool

        raw_pool: List[Dict[str, Any]] = []
        if config.AUTOMATION_E2E_MODE:
            raw_pool.extend(build_e2e_jobs())
        else:
            try:
                raw_pool.extend(self.greenhouse.fetch_all(max_per_board=10))
            except Exception as e:
                logger.warning(f"Greenhouse fetch encountered issues: {e}")

            try:
                raw_pool.extend(self.lever.fetch_all(max_per_company=10))
            except Exception as e:
                logger.warning(f"Lever fetch encountered issues: {e}")

            try:
                raw_pool.extend(self.rss.fetch_all(max_per_feed=15))
            except Exception as e:
                logger.warning(f"RSS fetch encountered issues: {e}")

        # Enforce source policy at the aggregation boundary.
        compliant_pool = [job for job in raw_pool if self._is_permitted_job(job)]
        self._cached_pool = self._deduplicate_jobs(compliant_pool)
        return self._cached_pool

    def discover_jobs(
        self,
        student_skills: List[str],
        target_role: str = "Software Engineer Intern",
        boolean_query: Optional[str] = None,
        locations: Optional[List[str]] = None,
        max_results: int = 25,
        save_to_db: bool = True,
        force_refresh: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Discovers, filters, scores, and ranks jobs for a student profile.
        """
        # If boolean query is not explicitly given, automatically construct one
        if not boolean_query:
            boolean_query = BooleanSearchParser.build_query_from_profile(
                skills=student_skills,
                target_role=target_role,
                locations=locations or ["remote", "bangalore", "india", "worldwide"],
            )

        logger.info(f"Using Boolean Search Query: {boolean_query}")

        # 1. Deduplicated compliant pool
        deduped = self.get_raw_pool(force_refresh=force_refresh)

        # 2. Boolean filter & scoring
        matched_jobs: List[Dict[str, Any]] = []
        clean_skills = [s.strip() for s in student_skills if s.strip()]

        for job in deduped:
            searchable_text = f"{job['title']} {job['company']} {job.get('location', '')} {job.get('description', '')}"

            # Boolean logic match test
            matches_query = BooleanSearchParser.matches(boolean_query, searchable_text)

            # Skill scoring & matched skill extraction
            matched_skills_found = []
            for skill in clean_skills:
                # Word boundary match for skills
                pattern = r"(?:\b|_)" + re.escape(skill.lower()) + r"(?:\b|_)"
                if re.search(pattern, searchable_text.lower()):
                    matched_skills_found.append(skill)

            # Calculate relevance score (0 - 100)
            relevance, match_reason = self._compute_relevance(
                job=job,
                student_skills=clean_skills,
                matched_skills=matched_skills_found,
                target_role=target_role,
                matches_boolean=matches_query,
            )

            # Keep if matches boolean query OR has high skill overlap
            if matches_query or relevance >= 40.0:
                is_intern = any(
                    k in job["title"].lower() or k in job.get("description", "").lower()
                    for k in ["intern", "internship", "co-op", "trainee", "graduate"]
                )
                emp_type = "internship" if is_intern else "full_time"

                job_record = {
                    "id": job["id"],
                    "title": job["title"],
                    "company": job["company"],
                    "location": job.get("location", "Remote"),
                    "url": job["url"],
                    "source": job["source"],
                    "description": job.get("description", "") or match_reason,
                    "required_skills": matched_skills_found or clean_skills,
                    "matched_skills": matched_skills_found,
                    "relevance_score": relevance,
                    "match_reason": match_reason,
                    "is_remote": job.get("is_remote", False),
                    "job_type": "internship/entry-level" if is_intern else "full_time",
                    "employment_type": emp_type,
                    "publication_status": "published",
                    "posted_at": job.get("posted_at"),
                    "boolean_matched": matches_query,
                }
                matched_jobs.append(job_record)

        # Sort by relevance score descending
        matched_jobs.sort(key=lambda x: x["relevance_score"], reverse=True)
        final_jobs = matched_jobs[:max_results]

        # Sync to Supabase
        if save_to_db and final_jobs:
            db_client.save_discovered_jobs(final_jobs)

        return final_jobs

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
