from datetime import datetime, timezone
from types import SimpleNamespace
from typing import cast
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from github import GithubException
from github.Repository import Repository
from pytest import MonkeyPatch

from ai_reviewer import evaluate_github, evaluate_linkedin_text, evaluate_text
from github_service import _inspect_repository, _scan_text_for_secrets
from main import app

client = TestClient(app)


class MockRepoWithSecrets:
    name = "web-app"
    description = "Next.js project with authentication"
    language = "TypeScript"
    stargazers_count = 5
    forks_count = 0
    fork = False
    pushed_at = datetime.now(timezone.utc)

    @staticmethod
    def get_readme():
        return SimpleNamespace(
            decoded_content=b"# Web App\nOpenAI Key: sk-abcdef1234567890abcdef123456789012\nSetup instructions."
        )

    @staticmethod
    def get_contents(path: str):
        return [
            SimpleNamespace(type="dir", name="src"),
            SimpleNamespace(type="dir", name="tests"),
            SimpleNamespace(type="file", name="package.json"),
            SimpleNamespace(type="file", name=".env"),
            SimpleNamespace(type="file", name="tsconfig.json"),
        ]

    @staticmethod
    def get_topics():
        return ["pinned", "react"]


def test_secrets_scanner_detects_api_keys_and_env_files():
    secrets = _scan_text_for_secrets("AWS key AKIA1234567890ABCDEF in config")
    assert "AWS Access Key" in secrets

    openai_secrets = _scan_text_for_secrets("sk-abcdef1234567890abcdef123456789012")
    assert "OpenAI API Key" in openai_secrets

    repo_data = _inspect_repository(cast(Repository, MockRepoWithSecrets()))
    assert repo_data["has_committed_secrets"] is True
    assert repo_data["is_pinned"] is True
    assert repo_data["has_recent_activity"] is True
    assert repo_data["code_quality_score"] > 60


def test_resume_evaluation_checks_coding_links_and_project_impact():
    resume_text = (
        "ALEX MORGAN\ngithub.com/octocat | leetcode.com/u/octocat\n\n"
        "EXPERIENCE\n"
        "Built and launched a task runner reducing processing latency by 35% across 10,000 users.\n\n"
        "PROJECTS\n"
        "Distributed Web Queue - Built with React, Next.js, TypeScript, and Redis. Scaled throughput to 500 requests/sec.\n\n"
        "EDUCATION\n"
        "BS Computer Science, GPA 3.9.\n\n"
        "SKILLS\n"
        "React, Next.js, Python, PostgreSQL, Docker."
    )
    result = evaluate_text(resume_text, 1)
    assert result.is_one_page is True
    assert result.has_coding_profile_links is True
    assert result.has_project_stack_and_impact is True
    assert result.has_clean_visual_layout is True


def test_linkedin_evaluation_detects_photo_and_outputs_ready_to_paste_rewrites():
    linkedin_text = (
        "Alex Morgan\nPhoto: Professional headshot uploaded\n"
        "Headline: Software Engineer | React, Next.js & TypeScript\n"
        "About: Passionate full-stack developer with 2 years experience building modern web applications.\n"
        "Experience: Frontend Engineer at Acme Corp.\n"
        "Skills: React, Next.js, TypeScript, PostgreSQL, Node.js"
    )
    review = evaluate_linkedin_text(linkedin_text, resume_context="Frontend Engineer React TypeScript")
    assert review.has_photo is True
    assert review.has_complete_profile is True
    assert len(review.suggested_rewrites) >= 2
    # Ensure rewrites are concrete copy-pasteable text, not generic advice
    assert any("Ready-to-Paste" in item for item in review.suggested_rewrites)


def test_github_error_logger_handles_github_exception(monkeypatch: MonkeyPatch):
    monkeypatch.setenv("INTERNAL_SERVICE_KEY", "test-secret-key-1234")

    # Mock fetch_github_data to raise GithubException
    with patch("main.fetch_github_data", side_effect=GithubException(status=500, data={"message": "GitHub API Unavailable"})):
        # 1. Direct endpoint returns 500 without crashing NameError
        res = client.get(
            "/review/github/testuser",
            headers={"Authorization": "Bearer test-secret-key-1234"},
        )
        assert res.status_code == 500
        assert "GitHub service error" in res.json()["detail"]
