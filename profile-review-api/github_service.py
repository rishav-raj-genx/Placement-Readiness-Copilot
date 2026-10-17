import os

from github import Auth, Github, GithubException, UnknownObjectException
from github.Repository import Repository

SOURCE_DIRECTORIES = {"app", "apps", "backend", "frontend", "lib", "server", "src"}
TEST_DIRECTORIES = {"spec", "specs", "test", "tests", "__tests__"}
DEPENDENCY_MANIFESTS = {
    "cargo.toml",
    "go.mod",
    "package.json",
    "pom.xml",
    "pyproject.toml",
    "requirements.txt",
}


def _repository_limit() -> int:
    raw_limit = os.getenv("GITHUB_REPO_LIMIT", "30")
    try:
        return min(100, max(1, int(raw_limit)))
    except ValueError:
        return 30


def _inspect_repository(repository: Repository) -> dict[str, object]:
    has_readme = False
    readme_length = 0
    inspection_errors: list[str] = []
    try:
        readme = repository.get_readme()
        has_readme = True
        readme_length = len(readme.decoded_content)
    except UnknownObjectException:
        pass
    except GithubException as exc:
        inspection_errors.append(f"README check failed: {exc.status}")

    top_level_files: list[str] = []
    top_level_directories: list[str] = []
    try:
        contents = repository.get_contents("")
        content_items = contents if isinstance(contents, list) else [contents]
        for item in content_items:
            if item.type == "dir":
                top_level_directories.append(item.name)
            else:
                top_level_files.append(item.name)
    except GithubException as exc:
        inspection_errors.append(f"Structure check failed: {exc.status}")

    normalized_files = {name.lower() for name in top_level_files}
    normalized_directories = {name.lower() for name in top_level_directories}
    has_tests = bool(normalized_directories & TEST_DIRECTORIES) or any(
        "test" in name.lower() for name in top_level_files
    )

    return {
        "name": repository.name,
        "description": repository.description,
        "language": repository.language,
        "stars": repository.stargazers_count,
        "forks": repository.forks_count,
        "is_fork": repository.fork,
        "has_readme": has_readme,
        "readme_length": readme_length,
        "structure": {
            "top_level_files": sorted(top_level_files),
            "top_level_directories": sorted(top_level_directories),
            "has_source_directory": bool(normalized_directories & SOURCE_DIRECTORIES),
            "has_tests": has_tests,
            "has_dependency_manifest": bool(normalized_files & DEPENDENCY_MANIFESTS),
        },
        "inspection_errors": inspection_errors,
    }


def fetch_github_data(username: str) -> dict[str, object]:
    normalized_username = username.strip()
    if not normalized_username:
        raise ValueError("GitHub username is required.")

    token = os.getenv("GITHUB_TOKEN", "").strip()
    github = Github(auth=Auth.Token(token)) if token else Github()
    try:
        user = github.get_user(normalized_username)
        repositories: list[dict[str, object]] = []
        for index, repository in enumerate(user.get_repos(sort="updated")):
            if index >= _repository_limit():
                break
            repositories.append(_inspect_repository(repository))

        return {
            "username": user.login,
            "name": user.name,
            "bio": user.bio,
            "public_repos": user.public_repos,
            "followers": user.followers,
            "following": user.following,
            "repositories": repositories,
            "repositories_inspected": len(repositories),
        }
    finally:
        github.close()
