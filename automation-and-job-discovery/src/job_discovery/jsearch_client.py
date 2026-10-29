"""
JSearch API client — replaces the custom Greenhouse/Lever/RSS scrapers.
Uses the JSearch v5 search-v2 endpoint on RapidAPI.
Free tier: 200 requests/month. Each request returns up to 10 jobs.
"""
import hashlib
import logging
import time
from typing import Any, Dict, List, Optional

import requests

from src import config

logger = logging.getLogger("jsearch_client")

JSEARCH_BASE_URL = "https://jsearch.p.rapidapi.com/search-v2"
JSEARCH_HOST = "jsearch.p.rapidapi.com"


class JSearchClient:
    """
    Fetches live job postings from JSearch (RapidAPI).
    Aggregates results across Google Jobs, Indeed, LinkedIn, Glassdoor, and more.
    Falls back gracefully when the API key is not configured.
    """

    REQUEST_TIMEOUT = 15  # seconds

    def __init__(self):
        self.api_key = config.JSEARCH_API_KEY
        self.headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": JSEARCH_HOST,
        }
        self._last_request_time: float = 0.0

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key != "YOUR_RAPIDAPI_KEY_HERE")

    def _throttle(self) -> None:
        """Ensure at least 0.5s between requests to stay within rate limits."""
        elapsed = time.time() - self._last_request_time
        if elapsed < 0.5:
            time.sleep(0.5 - elapsed)

    def search_jobs(
        self,
        query: str,
        num_pages: int = 1,
        date_posted: str = "month",
        employment_types: Optional[str] = None,
        remote_only: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Search for jobs using JSearch API.

        Args:
            query: Free-form search query, e.g. "Frontend Engineer internship in Bangalore"
            num_pages: Number of result pages (each page ~10 jobs). Keep low for free tier.
            date_posted: "all", "today", "3days", "week", "month"
            employment_types: Comma-separated JSearch types e.g. "INTERN,FULLTIME"
            remote_only: If True, only return remote positions

        Returns:
            List of normalized job dicts compatible with the discovered_jobs schema
        """
        if not self.is_configured:
            logger.warning("JSearch API key not configured. Skipping JSearch fetch.")
            return []

        self._throttle()
        params: Dict[str, Any] = {
            "query": query,
            "num_pages": num_pages,
            "date_posted": date_posted,
        }
        if employment_types:
            params["employment_types"] = employment_types
        if remote_only:
            params["work_from_home"] = "true"

        try:
            self._last_request_time = time.time()
            resp = requests.get(
                JSEARCH_BASE_URL,
                headers=self.headers,
                params=params,
                timeout=self.REQUEST_TIMEOUT,
            )

            if resp.status_code == 429:
                logger.warning(
                    "JSearch API rate limit hit (429). Monthly quota may be exhausted."
                )
                return []
            if resp.status_code != 200:
                logger.warning(
                    "JSearch returned HTTP %d for query '%s'", resp.status_code, query
                )
                return []

            data = resp.json()
            if data.get("status") != "OK":
                logger.warning("JSearch response status not OK: %s", data.get("status"))
                return []

            raw_jobs = data.get("data", {}).get("jobs", []) or []
            return [self._normalize_job(job) for job in raw_jobs if job]

        except requests.exceptions.Timeout:
            logger.error("JSearch request timed out for query: '%s'", query)
            return []
        except Exception as exc:
            logger.error("JSearch fetch error for query '%s': %s", query, exc)
            return []

    def discover_for_profile(
        self,
        target_role: str,
        skills: List[str],
        locations: Optional[List[str]] = None,
        max_results: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        High-level method: builds a smart search query from a student profile and
        fetches matching jobs. This is the primary entry point called by the aggregator.

        Automatically detects internship vs full-time from the role string so that
        a Frontend Engineer intern query does NOT return senior backend roles.

        Args:
            target_role: e.g. "Frontend Engineer" or "Python Backend Intern"
            skills: e.g. ["React", "TypeScript", "CSS"]
            locations: e.g. ["India", "Bangalore", "Remote"]
            max_results: cap on results returned

        Returns:
            List of normalized job dicts
        """
        if not self.is_configured:
            return []

        effective_locations = locations or ["India", "Remote"]

        # Infer employment type from the role string
        role_lower = target_role.lower()
        if any(k in role_lower for k in ("intern", "internship", "trainee")):
            emp_types = "INTERN"
        else:
            emp_types = "FULLTIME,CONTRACTOR"

        # Primary query: role + primary location
        primary_location = effective_locations[0] if effective_locations else "India"
        primary_query = f"{target_role} in {primary_location}"
        all_jobs: List[Dict[str, Any]] = self.search_jobs(
            query=primary_query,
            num_pages=1,
            date_posted="month",
            employment_types=emp_types,
        )

        # Secondary query: remote jobs if locations include remote and we need more
        has_remote = any("remote" in loc.lower() for loc in effective_locations)
        if has_remote and len(all_jobs) < max_results:
            remote_jobs = self.search_jobs(
                query=f"{target_role} remote",
                num_pages=1,
                date_posted="month",
                employment_types=emp_types,
                remote_only=True,
            )
            existing_ids = {j["id"] for j in all_jobs}
            for job in remote_jobs:
                if job["id"] not in existing_ids:
                    all_jobs.append(job)
                    existing_ids.add(job["id"])

        return all_jobs[:max_results]

    @staticmethod
    def _normalize_job(raw: Dict[str, Any]) -> Dict[str, Any]:
        """Convert a raw JSearch job object to our internal schema."""
        job_id = raw.get("job_id", "")
        uid = (
            hashlib.md5(job_id.encode("utf-8")).hexdigest()[:16]
            if job_id
            else hashlib.md5(str(raw).encode("utf-8")).hexdigest()[:16]
        )

        title = raw.get("job_title", "") or ""
        company = raw.get("employer_name", "") or "Unknown"
        description = raw.get("job_description", "") or ""
        apply_link = raw.get("job_apply_link", "") or ""

        # Build a clean location string
        city = raw.get("job_city", "") or ""
        state = raw.get("job_state", "") or ""
        country = raw.get("job_country", "") or ""
        location_parts = [p for p in [city, state, country] if p]
        location = ", ".join(location_parts) if location_parts else "Remote / Various"

        is_remote = bool(raw.get("job_is_remote", False))
        if is_remote and "remote" not in location.lower():
            location = "Remote" + (f" ({location})" if location_parts else "")

        # Employment type
        emp_types_raw: list = raw.get("job_employment_types", []) or []
        emp_type = "full_time"
        if emp_types_raw:
            first = (emp_types_raw[0] or "").upper()
            if first == "INTERN":
                emp_type = "internship"
            elif first == "PARTTIME":
                emp_type = "part_time"
            elif first == "CONTRACTOR":
                emp_type = "contract"

        # Extract required skills from job highlights
        required_skills: List[str] = []
        highlights = raw.get("job_highlights", {}) or {}
        qualifications = highlights.get("Qualifications", []) or []
        for qual in qualifications[:5]:
            if qual and len(qual) < 80:
                required_skills.append(qual.strip())

        posted_at = raw.get("job_posted_at_datetime_utc", None)

        return {
            "id": f"jsearch_{uid}",
            "title": title,
            "company": company,
            "location": location,
            "url": apply_link,
            "source": "jsearch_api",
            "description": description[:2000],
            "required_skills": required_skills,
            "is_remote": is_remote,
            "posted_at": posted_at,
            "employment_type": emp_type,
            "job_type": "internship/entry-level" if emp_type == "internship" else "full_time",
            "publication_status": "published",
            "is_msot_post": False,
        }
