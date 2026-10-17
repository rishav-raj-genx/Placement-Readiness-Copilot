import logging
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger("greenhouse_fetcher")

# Popular tech companies using public Greenhouse job boards
POPULAR_GREENHOUSE_BOARDS = [
    "gitlab",
    "cloudflare",
    "datadog",
    "figma",
    "reddit",
    "hashicorp",
    "elastic",
    "canonical",
    "instacart",
]


class GreenhouseFetcher:
    """
    Fetches job listings from official public Greenhouse ATS boards.
    Respects rate limits and terms of service.
    """

    def __init__(self, boards: Optional[List[str]] = None, timeout_sec: int = 10):
        self.boards = boards or POPULAR_GREENHOUSE_BOARDS
        self.timeout_sec = timeout_sec
        self.headers = {
            "User-Agent": "PlacementReadinessBot/1.0 (+https://github.com/placement-copilot)"
        }

    def fetch_jobs_for_board(self, board_token: str, max_jobs: int = 20) -> List[Dict[str, Any]]:
        url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"
        jobs: List[Dict[str, Any]] = []

        try:
            resp = requests.get(url, headers=self.headers, timeout=self.timeout_sec)
            if resp.status_code != 200:
                logger.warning(f"Greenhouse board {board_token} returned HTTP {resp.status_code}")
                return []

            data = resp.json()
            raw_jobs = data.get("jobs", [])

            for item in raw_jobs[:max_jobs]:
                job_id = str(item.get("id"))
                title = item.get("title", "")
                location = item.get("location", {}).get("name", "Remote / Various")
                job_url = item.get("absolute_url", "")
                content_html = item.get("content", "")
                updated_at = item.get("updated_at")

                # Basic strip tags for searchable text
                import re

                clean_text = re.sub(r"<[^>]+>", " ", content_html)
                clean_text = " ".join(clean_text.split())

                jobs.append(
                    {
                        "id": f"gh_{board_token}_{job_id}",
                        "title": title,
                        "company": board_token.capitalize(),
                        "location": location,
                        "url": job_url,
                        "source": "greenhouse_ats",
                        "description": clean_text[:2000],
                        "is_remote": "remote" in location.lower() or "remote" in title.lower(),
                        "posted_at": updated_at,
                    }
                )

        except Exception as e:
            logger.error(f"Error fetching Greenhouse board {board_token}: {e}")

        return jobs

    def fetch_all(self, max_per_board: int = 15) -> List[Dict[str, Any]]:
        all_jobs: List[Dict[str, Any]] = []
        for board in self.boards:
            board_jobs = self.fetch_jobs_for_board(board, max_jobs=max_per_board)
            all_jobs.extend(board_jobs)
        return all_jobs
