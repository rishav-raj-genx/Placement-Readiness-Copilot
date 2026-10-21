from types import SimpleNamespace
from typing import cast

from github.Repository import Repository

from github_service import _inspect_repository


class FakeRepository:
    name = "placement-copilot"
    description = "Placement readiness platform"
    language = "Python"
    stargazers_count = 4
    forks_count = 1
    fork = False

    @staticmethod
    def get_readme() -> SimpleNamespace:
        return SimpleNamespace(decoded_content=b"# Placement Copilot\nDetailed setup and usage.")

    @staticmethod
    def get_contents(path: str) -> list[SimpleNamespace]:
        assert path == ""
        return [
            SimpleNamespace(type="dir", name="src"),
            SimpleNamespace(type="dir", name="tests"),
            SimpleNamespace(type="file", name="pyproject.toml"),
        ]


class MockRepoWithReadabilityAndHistorySecrets:
    name = "fullstack-service"
    description = "Fullstack application with detailed documentation"
    language = "TypeScript"
    stargazers_count = 10
    forks_count = 2
    fork = False

    @staticmethod
    def get_readme() -> SimpleNamespace:
        return SimpleNamespace(
            decoded_content=b"# Fullstack Service\n## Setup and Installation\nRun `pnpm install` then `pnpm dev` to start."
        )

    @staticmethod
    def get_contents(path: str):
        if path == "":
            return [
                SimpleNamespace(type="dir", name="src"),
                SimpleNamespace(type="file", name="package.json"),
                SimpleNamespace(type="file", name="tsconfig.json"),
            ]
        if path == "src":
            return [
                SimpleNamespace(type="file", name="server.ts"),
            ]
        if path == "src/server.ts":
            code = (
                "/**\n * Application server entrypoint.\n */\n"
                "import express from 'express';\n\n"
                "const app = express();\n"
                "// Middleware configuration\n"
                "app.use(express.json());\n\n"
                "export default app;\n"
            )
            return SimpleNamespace(decoded_content=code.encode("utf-8"))
        return []

    @staticmethod
    def get_commits():
        return [
            SimpleNamespace(
                sha="a1b2c3d4e5f6",
                commit=SimpleNamespace(message="fix: remove leaked API key from config"),
                files=[
                    SimpleNamespace(
                        filename="src/config.ts",
                        patch="+ const key = 'sk-abcdef1234567890abcdef123456789012';",
                    )
                ],
            )
        ]


def test_repository_inspection_checks_readme_and_code_structure() -> None:
    review = _inspect_repository(cast(Repository, FakeRepository()))

    assert review["has_readme"] is True
    assert review["readme_length"] > 0
    structure = review["structure"]
    assert isinstance(structure, dict)
    assert structure["has_source_directory"] is True
    assert structure["has_tests"] is True
    assert structure["has_dependency_manifest"] is True

    # Deep inspection: source readability, setup instructions, and commit history secrets
    deep_review = _inspect_repository(cast(Repository, MockRepoWithReadabilityAndHistorySecrets()))
    assert deep_review["has_setup_instructions"] is True
    assert "pnpm install" in " ".join(deep_review["setup_commands_found"])
    assert deep_review["has_committed_secrets"] is True
    assert len(deep_review["history_secrets"]) > 0
    assert any("sk-" in s or "API Key" in s or "previously committed" in s for s in deep_review["history_secrets"])
    assert deep_review["source_files_analyzed"] == 1
    assert deep_review["code_readability_score"] >= 75
    assert len(deep_review["code_readability_comments"]) > 0

