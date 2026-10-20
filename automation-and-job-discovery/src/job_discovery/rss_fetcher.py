import hashlib
import logging
import re
from typing import Any, Dict, List, Optional

import feedparser

import requests

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
    Parses syndicated feeds with explicit connect/read timeouts, response size limits, and per-feed status.
    """

    CONNECT_TIMEOUT = 5.0
    READ_TIMEOUT = 10.0
    MAX_FEED_BYTES = 2 * 1024 * 1024  # 2MB response size bound

    def __init__(self, feeds: Optional[List[Dict[str, str]]] = None):
        self.feeds = feeds or STANDARD_RSS_FEEDS
        self.feed_statuses: Dict[str, str] = {}

    def fetch_feed(self, feed_info: Dict[str, str], max_items: int = 25) -> List[Dict[str, Any]]:
        feed_url = feed_info["url"]
        source_name = feed_info.get("source", "rss")
        jobs: List[Dict[str, Any]] = []

        try:
            resp = requests.get(
                feed_url,
                timeout=(self.CONNECT_TIMEOUT, self.READ_TIMEOUT),
                stream=True,
                headers={"User-Agent": "Placement-Readiness-JobDiscovery/1.0 (RSS Syndication Reader)"},
            )
            resp.raise_for_status()

            # Bound response size to avoid memory exhaustion from oversized feeds
            content_chunks = []
            total_bytes = 0
            for chunk in resp.iter_content(chunk_size=65536):
                total_bytes += len(chunk)
                if total_bytes > self.MAX_FEED_BYTES:
                    logger.warning(
                        f"Feed {feed_url} exceeded max size limit ({self.MAX_FEED_BYTES} bytes). Truncating."
                    )
                    break
                content_chunks.append(chunk)

            content = b"".join(content_chunks)
            parsed = feedparser.parse(content)
            self.feed_statuses[source_name] = "ok"

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
            logger.error(f"Error fetching/parsing RSS feed {feed_url}: {e}")
            self.feed_statuses[source_name] = f"error: {str(e)}"

        return jobs

    def fetch_all(self, max_per_feed: int = 20) -> List[Dict[str, Any]]:
        all_jobs: List[Dict[str, Any]] = []
        for feed in self.feeds:
            feed_jobs = self.fetch_feed(feed, max_items=max_per_feed)
            all_jobs.extend(feed_jobs)
        return all_jobs
