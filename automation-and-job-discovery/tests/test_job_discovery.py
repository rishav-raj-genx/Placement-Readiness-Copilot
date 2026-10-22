from unittest.mock import MagicMock, patch

from src import config
from src.job_discovery.aggregator import JobAggregator
from src.job_discovery.greenhouse import GreenhouseFetcher
from src.job_discovery.lever import LeverFetcher


def test_no_linkedin_sources():
    aggregator = JobAggregator()
    # Check that no greenhouse, lever or RSS URLs target linkedin.com
    for board in aggregator.greenhouse.boards:
        assert "linkedin" not in board.lower()
    for company in aggregator.lever.companies:
        assert "linkedin" not in company.lower()
    for feed in aggregator.rss.feeds:
        assert "linkedin.com" not in feed["url"].lower()


@patch("requests.get")
def test_greenhouse_fixture_parsing(mock_get):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "jobs": [
            {
                "id": 999888,
                "title": "Frontend Software Engineer Intern",
                "location": {"name": "Remote"},
                "absolute_url": "https://boards.greenhouse.io/figma/jobs/999888",
                "content": "<p>Requirements: React, TypeScript, Next.js</p>",
                "updated_at": "2026-10-01T00:00:00Z",
            }
        ]
    }
    mock_get.return_value = mock_response

    fetcher = GreenhouseFetcher(boards=["figma"])
    jobs = fetcher.fetch_jobs_for_board("figma")
    assert len(jobs) == 1
    assert jobs[0]["id"] == "gh_figma_999888"
    assert jobs[0]["title"] == "Frontend Software Engineer Intern"
    assert jobs[0]["source"] == "greenhouse_ats"
    assert "React" in jobs[0]["description"]


@patch("requests.get")
def test_lever_fixture_parsing(mock_get):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "id": "lever-1234",
            "text": "Software Engineering Intern",
            "categories": {"location": "Bangalore", "workplaceType": "hybrid"},
            "hostedUrl": "https://jobs.lever.co/postman/lever-1234",
            "descriptionPlain": "Build APIs with Node.js and Python",
            "createdAt": 1791800000000,
        }
    ]
    mock_get.return_value = mock_response

    fetcher = LeverFetcher(companies=["postman"])
    jobs = fetcher.fetch_jobs_for_company("postman")
    assert len(jobs) == 1
    assert jobs[0]["id"] == "lever_postman_lever-1234"
    assert jobs[0]["title"] == "Software Engineering Intern"
    assert jobs[0]["source"] == "lever_ats"


def test_stable_deduplication():
    aggregator = JobAggregator()
    duplicate_jobs = [
        {
            "id": "job_1",
            "title": "React Intern",
            "company": "Acme",
            "url": "https://acme.com/jobs/1?utm_source=rss",
            "source": "rss",
        },
        {
            "id": "job_2",
            "title": "React Intern",
            "company": "Acme",
            "url": "https://acme.com/jobs/1",
            "source": "lever",
        },
        {
            "id": "job_3",
            "title": "Python Intern",
            "company": "Beta",
            "url": "https://beta.com/jobs/2",
            "source": "greenhouse",
        },
    ]
    deduped = aggregator._deduplicate_jobs(duplicate_jobs)
    assert len(deduped) == 2
    assert deduped[0]["id"] == "job_1"
    assert deduped[1]["id"] == "job_3"


def test_aggregator_rejects_unapproved_and_linkedin_jobs(monkeypatch):
    aggregator = JobAggregator()
    permitted_job = {
        "id": "gh_1",
        "title": "React Software Engineer Intern",
        "company": "Example",
        "location": "Remote",
        "url": "https://boards.greenhouse.io/example/jobs/1",
        "source": "greenhouse_ats",
        "description": "React TypeScript internship",
        "is_remote": True,
    }
    linkedin_job = {
        **permitted_job,
        "id": "blocked_linkedin",
        "url": "https://www.linkedin.com/jobs/view/123",
    }
    unknown_source_job = {
        **permitted_job,
        "id": "blocked_unknown",
        "source": "html_scraper",
        "url": "https://example.com/jobs/2",
    }

    monkeypatch.setattr(
        aggregator.greenhouse,
        "fetch_all",
        lambda max_per_board: [permitted_job, linkedin_job, unknown_source_job],
    )
    monkeypatch.setattr(aggregator.lever, "fetch_all", lambda max_per_company: [])
    monkeypatch.setattr(aggregator.rss, "fetch_all", lambda max_per_feed: [])

    jobs = aggregator.discover_jobs(
        student_skills=["React", "TypeScript"],
        save_to_db=False,
    )

    assert [job["id"] for job in jobs] == ["gh_1"]
    assert all("linkedin.com" not in job["url"] for job in jobs)


def test_e2e_mode_returns_five_permitted_matches(monkeypatch):
    monkeypatch.setattr(config, "AUTOMATION_E2E_MODE", True)

    jobs = JobAggregator().discover_jobs(
        student_skills=["Python", "FastAPI", "PostgreSQL"],
        target_role="Software Engineer Intern",
        max_results=5,
        save_to_db=False,
    )

    assert len(jobs) == 5
    assert all(job["source"] in {"greenhouse_ats", "lever_ats", "jobicy_rss"} for job in jobs)


def test_cold_start_fallback_skills_when_skills_empty(monkeypatch):
    from src.api.server import get_fallback_skills_for_role

    sde_skills = get_fallback_skills_for_role("SDE")
    assert "Python" in sde_skills
    assert "React" in sde_skills

    frontend_skills = get_fallback_skills_for_role("Frontend Engineer")
    assert "React" in frontend_skills
    assert "TypeScript" in frontend_skills

    monkeypatch.setattr(config, "AUTOMATION_E2E_MODE", True)
    jobs = JobAggregator().discover_jobs(
        student_skills=[],
        target_role="Full-Stack Software Engineer",
        max_results=5,
        save_to_db=False,
    )
    assert len(jobs) > 0

