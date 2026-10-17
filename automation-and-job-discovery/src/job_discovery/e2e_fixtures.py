"""Deterministic permitted-source jobs for repository-level E2E testing."""

from typing import Any


def build_e2e_jobs() -> list[dict[str, Any]]:
    shared = {
        "title": "Software Engineer Intern",
        "location": "Remote / India",
        "description": (
            "Software Engineer Intern working with Python, FastAPI, PostgreSQL, "
            "React, TypeScript, testing, and reliable APIs."
        ),
        "is_remote": True,
        "posted_at": "2026-10-17T00:00:00Z",
    }
    return [
        {
            **shared,
            "id": "e2e_greenhouse_1",
            "company": "Atlas Systems",
            "url": "https://boards.greenhouse.io/atlassystems/jobs/e2e-1",
            "source": "greenhouse_ats",
        },
        {
            **shared,
            "id": "e2e_greenhouse_2",
            "company": "Beacon Labs",
            "url": "https://boards.greenhouse.io/beaconlabs/jobs/e2e-2",
            "source": "greenhouse_ats",
        },
        {
            **shared,
            "id": "e2e_lever_1",
            "company": "Cipher Cloud",
            "url": "https://jobs.lever.co/ciphercloud/e2e-3",
            "source": "lever_ats",
        },
        {
            **shared,
            "id": "e2e_lever_2",
            "company": "Delta Stack",
            "url": "https://jobs.lever.co/deltastack/e2e-4",
            "source": "lever_ats",
        },
        {
            **shared,
            "id": "e2e_rss_1",
            "company": "Evergreen Software",
            "url": "https://jobicy.com/jobs/e2e-5",
            "source": "jobicy_rss",
        },
    ]
