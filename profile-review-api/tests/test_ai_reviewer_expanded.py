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

    # Geometry checks: narrow margins and multi-column flags
    narrow_res = evaluate_text(resume_text, 1, layout_geometry={"has_narrow_margins": True})
    assert narrow_res.has_clean_visual_layout is False
    assert any("margins are too narrow" in fix.lower() for fix in narrow_res.specific_fixes)

    multi_col_res = evaluate_text(resume_text, 1, layout_geometry={"is_multi_column": True})
    assert multi_col_res.is_ats_friendly is False
    assert any("multi-column structure detected" in fix.lower() for fix in multi_col_res.specific_fixes)


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


def test_resume_without_quantifiable_metrics_is_capped_at_60():
    vague_resume = (
        "ALEX MORGAN\ngithub.com/octocat | leetcode.com/u/octocat\n\n"
        "EXPERIENCE\n"
        "Was responsible of the the backend team. Made website faster and improved performance.\n\n"
        "PROJECTS\n"
        "Web App - Built with Python,React and Node. Worked on backend endpoints.\n\n"
        "EDUCATION\n"
        "BS Computer Science.\n\n"
        "SKILLS\n"
        "React, Node.js, Python, PostgreSQL."
    )
    result = evaluate_text(vague_resume, 1)
    assert result.has_quantifiable_metrics is False
    assert result.score <= 60
    assert any("Score Capped at 60/100" in fix for fix in result.specific_fixes)

    # Comprehensive grammar verification
    assert result.has_spelling_or_grammar_issues is True
    issues = " ".join(result.spelling_grammar_issues).lower()
    assert "responsible of" in issues
    assert "repeated word" in issues
    assert "missing space after comma" in issues


def test_github_without_tests_ci_or_diagrams_is_capped_at_50():
    basic_github_data = {
        "username": "basicuser",
        "has_pinned_repos": True,
        "has_recent_commit_activity": True,
        "has_committed_secrets": False,
        "repositories": [
            {
                "name": "basic-crud-app",
                "description": "Simple Todo List app",
                "has_readme": True,
                "readme_length": 300,
                "is_fork": False,
                "structure": {
                    "has_source_directory": True,
                    "has_dependency_manifest": True,
                    "has_tests": False,
                    "has_ci_workflow": False,
                    "has_architecture_diagram": False,
                },
                "has_unit_tests": False,
                "has_ci_cd": False,
                "has_architecture_diagram": False,
            }
        ],
    }
    review = evaluate_github(basic_github_data)
    assert review.has_unit_tests is False
    assert review.has_ci_cd is False
    assert review.has_architecture_diagrams is False
    assert review.score <= 50
    assert any("Score Capped at 50/100" in fix for fix in review.specific_fixes)


def test_linkedin_copy_paste_without_engagement_is_capped_at_70():
    copy_paste_linkedin = (
        "Alex Morgan\n"
        "Photo: Professional headshot uploaded\n"
        "Headline: Software Engineer | React, TypeScript & Node.js\n"
        "About: Software Engineer with experience developing full-stack web applications.\n"
        "Experience: Frontend Engineer at Acme Corp. Built user interfaces with React and TypeScript.\n"
        "Skills: React, TypeScript, Node.js, PostgreSQL\n"
    )
    resume_context = "Alex Morgan Software Engineer React TypeScript Node.js Frontend Engineer Acme Corp"
    review = evaluate_linkedin_text(copy_paste_linkedin, resume_context=resume_context)
    assert review.is_copy_paste_of_resume is True
    assert review.has_engagement_markers is False
    assert review.score <= 70
    assert any("Score Capped at 70/100" in fix for fix in review.specific_fixes)



