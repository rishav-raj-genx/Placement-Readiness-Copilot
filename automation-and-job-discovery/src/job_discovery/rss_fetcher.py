import hashlib
import logging
import re
from typing import Any, Dict, List, Optional

import feedparser

logger = logging.getLogger("rss_fetcher")

STANDARD_RSS_FEEDS = [
    {
        "name": "WeWorkRemotely Programming",
        "url": "https://weworkremotely.com/categories/remote-programming-jobs.rss",
        "source": "weworkremotely_rss",
    },
    {
        "name": "WeWorkRemotely Full-Stack",
        "url": "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
        "source": "weworkremotely_rss",
    },
    {
        "name": "Jobicy Global Tech",
        "url": "https://jobicy.com/?feed=job_feed",
        "source": "jobicy_rss",
    },
]


class RSSJobFetcher:
    """
    Compliant job fetcher using official RSS feeds and `feedparser`.
    Parses syndicated feeds without violating any terms of service.
    """

    def __init__(self, feeds: Optional[List[Dict[str, str]]] = None):
        self.feeds = feeds or STANDARD_RSS_FEEDS

    def fetch_feed(self, feed_info: Dict[str, str], max_items: int = 25) -> List[Dict[str, Any]]:
        feed_url = feed_info["url"]
        source_name = feed_info.get("source", "rss")
        jobs: List[Dict[str, Any]] = []

        try:
            parsed = feedparser.parse(feed_url)
            for entry in parsed.entries[:max_items]:
                title = entry.get("title", "")
                link = entry.get("link", "")
                summary = entry.get("summary", "") or entry.get("description", "")
                published = entry.get("published", "")

                # Extract company if available from title (e.g., 'Company: Job Title' or 'Job Title at Company')
                company = "Various"
                if " at " in title:
                    parts = title.split(" at ")
                    title_clean = parts[0].strip()
                    company = parts[1].strip()
                elif ": " in title:
                    parts = title.split(": ")
                    company = parts[0].strip()
                    title_clean = ": ".join(parts[1:]).strip()
                else:
                    title_clean = title

                # Strip HTML from summary
                clean_desc = re.sub(r"<[^>]+>", " ", summary)
                clean_desc = " ".join(clean_desc.split())

                # Generate reproducible unique ID
                unique_hash = hashlib.md5((link or title).encode("utf-8")).hexdigest()[:12]

                jobs.append(
                    {
                        "id": f"rss_{unique_hash}",
                        "title": title_clean,
                        "company": company,
                        "location": "Remote / Worldwide",
                        "url": link,
                        "source": source_name,
                        "description": clean_desc[:2000],
                        "is_remote": True,
                        "posted_at": published,
                    }
                )

        except Exception as e:
            logger.error(f"Error parsing RSS feed {feed_url}: {e}")

        return jobs

    def fetch_all(self, max_per_feed: int = 20) -> List[Dict[str, Any]]:
        all_jobs: List[Dict[str, Any]] = []
        for feed in self.feeds:
            feed_jobs = self.fetch_feed(feed, max_items=max_per_feed)
            all_jobs.extend(feed_jobs)
        return all_jobs
