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


def test_repository_inspection_checks_readme_and_code_structure() -> None:
    review = _inspect_repository(cast(Repository, FakeRepository()))

    assert review["has_readme"] is True
    assert review["readme_length"] > 0
    structure = review["structure"]
    assert isinstance(structure, dict)
    assert structure["has_source_directory"] is True
    assert structure["has_tests"] is True
    assert structure["has_dependency_manifest"] is True
