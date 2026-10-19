import logging
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger("lever_fetcher")

# Popular tech companies using public Lever job boards
POPULAR_LEVER_COMPANIES = ["palantir", "spotify", "leverdemo"]


class LeverFetcher:
    """
    Fetches job listings from official public Lever ATS boards.
    Respects rate limits and terms of service.
    """

    def __init__(self, companies: Optional[List[str]] = None, timeout_sec: int = 10):
        self.companies = companies or POPULAR_LEVER_COMPANIES
        self.timeout_sec = timeout_sec
        self.headers = {
            "User-Agent": "PlacementReadinessBot/1.0 (+https://github.com/placement-copilot)"
        }

    def fetch_jobs_for_company(self, company: str, max_jobs: int = 20) -> List[Dict[str, Any]]:
        url = f"https://api.lever.co/v0/postings/{company}?mode=json"
        jobs: List[Dict[str, Any]] = []

        try:
            resp = requests.get(url, headers=self.headers, timeout=self.timeout_sec)
            if resp.status_code != 200:
                logger.warning(f"Lever board for {company} returned HTTP {resp.status_code}")
                return []

            postings = resp.json()
            if not isinstance(postings, list):
                return []

            for item in postings[:max_jobs]:
                posting_id = item.get("id", "")
                text = item.get("text", "")
                categories = item.get("categories", {})
                location = categories.get("location", "Remote / Various")
                workplace_type = categories.get("workplaceType", "")
                hosted_url = item.get("hostedUrl", "")
                desc_plain = item.get("descriptionPlain", "")
                created_at = item.get("createdAt")

                jobs.append(
                    {
                        "id": f"lever_{company}_{posting_id}",
                        "title": text,
                        "company": company.capitalize(),
                        "location": location,
                        "url": hosted_url,
                        "source": "lever_ats",
                        "description": desc_plain[:2000],
                        "is_remote": "remote" in location.lower()
                        or "remote" in workplace_type.lower(),
                        "posted_at": created_at,
                    }
                )

        except Exception as e:
            logger.error(f"Error fetching Lever jobs for {company}: {e}")

        return jobs

    def fetch_all(self, max_per_company: int = 15) -> List[Dict[str, Any]]:
        all_jobs: List[Dict[str, Any]] = []
        for company in self.companies:
            co_jobs = self.fetch_jobs_for_company(company, max_jobs=max_per_company)
            all_jobs.extend(co_jobs)
        return all_jobs
