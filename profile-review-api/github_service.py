import os
import re
import time
from datetime import datetime, timezone
from typing import Optional

from github import Auth, Github, GithubException, RateLimitExceededException, UnknownObjectException
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
LINTER_CONFIGS = {
    ".eslintrc",
    ".eslintrc.json",
    ".eslintrc.js",
    ".eslintrc.cjs",
    "eslint.config.js",
    "eslint.config.mjs",
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.js",
    "ruff.toml",
    ".ruff.toml",
    ".flake8",
    "setup.cfg",
    "tsconfig.json",
    "biome.json",
}
CI_DIRECTORIES = {".github", ".circleci"}
SENSITIVE_FILES = {
    ".env",
    ".env.local",
    ".env.production",
    ".env.staging",
    "id_rsa",
    "id_ed25519",
    "credentials.json",
}

SECRET_PATTERNS = {
    "AWS Access Key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "GitHub Personal Access Token": re.compile(
        r"\b(ghp_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82})\b"
    ),
    "OpenAI API Key": re.compile(r"\bsk-[a-zA-Z0-9_-]{32,}\b"),
    "Private Key": re.compile(r"-----BEGIN (?:RSA|EC|OPENSSH|DSA|PGP|PRIVATE) KEY-----"),
    "Generic API Secret Assignment": re.compile(
        r"(?i)\b(?:api[_-]?key|secret[_-]?key|auth[_-]?token|client[_-]?secret)\s*[:=]\s*['\"][a-zA-Z0-9_\-\.]{16,}['\"]"
    ),
}

# 15-minute in-memory cache for inspected profiles to conserve rate limits
_PROFILE_CACHE: dict[str, tuple[float, dict[str, object]]] = {}
_CACHE_TTL_SECONDS = 900.0


def _repository_limit() -> int:
    raw_limit = os.getenv("GITHUB_REPO_LIMIT", "6")
    try:
        return min(15, max(1, int(raw_limit)))
    except ValueError:
        return 6


def _scan_text_for_secrets(content: str) -> list[str]:
    detected: list[str] = []
    for secret_type, pattern in SECRET_PATTERNS.items():
        if pattern.search(content):
            detected.append(secret_type)
    return detected


def _inspect_repository(
    repository: Repository, pinned_names: Optional[set[str]] = None
) -> dict[str, object]:
    has_readme = False
    readme_length = 0
    inspection_errors: list[str] = []
    readme_text = ""

    try:
        readme = repository.get_readme()
        has_readme = True
        raw_content = getattr(readme, "decoded_content", b"")
        readme_text = raw_content.decode("utf-8", errors="replace") if isinstance(raw_content, bytes) else str(raw_content)
        readme_length = len(readme_text)
    except UnknownObjectException:
        pass
    except GithubException as exc:
        inspection_errors.append(f"README check failed: {getattr(exc, 'status', 'error')}")
    except Exception:
        pass

    top_level_files: list[str] = []
    top_level_directories: list[str] = []
    try:
        contents = repository.get_contents("")
        content_items = contents if isinstance(contents, list) else [contents]
        for item in content_items:
            item_type = getattr(item, "type", "file")
            item_name = getattr(item, "name", "")
            if item_type == "dir":
                top_level_directories.append(item_name)
            else:
                top_level_files.append(item_name)
    except GithubException as exc:
        inspection_errors.append(f"Structure check failed: {getattr(exc, 'status', 'error')}")
    except Exception:
        pass

    normalized_files = {name.lower() for name in top_level_files}
    normalized_directories = {name.lower() for name in top_level_directories}
    has_tests = bool(normalized_directories & TEST_DIRECTORIES) or any(
        "test" in name.lower() for name in top_level_files
    )

    # 1. Pinned Repository Check
    topics: list[str] = []
    try:
        if hasattr(repository, "get_topics"):
            topics = repository.get_topics() or []
    except Exception:
        pass

    repo_name = getattr(repository, "name", "")
    is_pinned = bool(
        (pinned_names and repo_name in pinned_names)
        or ("pinned" in topics)
        or getattr(repository, "stargazers_count", 0) >= 3
    )

    # 2. Recent Commit Activity Check (last 90 days)
    now_utc = datetime.now(timezone.utc)
    pushed_at = getattr(repository, "pushed_at", None)
    days_since_push: Optional[int] = None
    if pushed_at and isinstance(pushed_at, datetime):
        if pushed_at.tzinfo is None:
            pushed_at = pushed_at.replace(tzinfo=timezone.utc)
        days_since_push = (now_utc - pushed_at).days

    has_recent_activity = bool(days_since_push is not None and days_since_push <= 90)

    # 3. Committed Secrets Scanner
    detected_secrets: list[str] = []
    committed_env_files = [f for f in top_level_files if f.lower() in SENSITIVE_FILES or f.lower().startswith(".env.")]
    if committed_env_files:
        detected_secrets.append(f"Committed sensitive file: {', '.join(committed_env_files)}")

    if readme_text:
        readme_secret_matches = _scan_text_for_secrets(readme_text)
        for s in readme_secret_matches:
            detected_secrets.append(f"Exposed {s} in README")

    has_committed_secrets = len(detected_secrets) > 0

    # Architecture diagram detection in README
    has_architecture_diagram = False
    if readme_text:
        diagram_indicators = [
            r"```mermaid",
            r"\bmermaid\b",
            r"\bplantuml\b",
            r"!\[.*(?:architecture|diagram|workflow|system design|dataflow|topology).*\].*\.(?:png|jpg|jpeg|svg|webp)",
            r"<img\s+[^>]*src=[\"'][^\"']*(?:architecture|diagram|flow|system)[^\"']*[\"']",
            r"\+[-+]+\+",
        ]
        for pattern in diagram_indicators:
            if re.search(pattern, readme_text, re.IGNORECASE):
                has_architecture_diagram = True
                break

    # 4. Source-level Code Quality Assessment
    has_source_dir = bool(normalized_directories & SOURCE_DIRECTORIES)
    has_manifest = bool(normalized_files & DEPENDENCY_MANIFESTS)
    has_linter = bool(normalized_files & LINTER_CONFIGS)
    has_ci = bool(normalized_directories & CI_DIRECTORIES) or any(
        ".github" in d.lower() for d in top_level_directories
    )
    has_license = any("license" in f.lower() for f in top_level_files)

    code_quality_score = 0
    if has_source_dir:
        code_quality_score += 25
    if has_manifest:
        code_quality_score += 20
    if has_tests:
        code_quality_score += 20
    if has_linter:
        code_quality_score += 15
    if has_ci:
        code_quality_score += 10
    if has_license:
        code_quality_score += 10

    return {
        "name": repo_name,
        "description": getattr(repository, "description", None),
        "language": getattr(repository, "language", None),
        "stars": getattr(repository, "stargazers_count", 0),
        "forks": getattr(repository, "forks_count", 0),
        "is_fork": getattr(repository, "fork", False),
        "is_pinned": is_pinned,
        "has_recent_activity": has_recent_activity,
        "days_since_push": days_since_push,
        "has_committed_secrets": has_committed_secrets,
        "detected_secrets": detected_secrets,
        "has_unit_tests": has_tests,
        "has_ci_cd": has_ci,
        "has_architecture_diagram": has_architecture_diagram,
        "code_quality_score": code_quality_score,
        "has_readme": has_readme,
        "readme_length": readme_length,
        "structure": {
            "top_level_files": sorted(top_level_files),
            "top_level_directories": sorted(top_level_directories),
            "has_source_directory": has_source_dir,
            "has_tests": has_tests,
            "has_dependency_manifest": has_manifest,
            "has_linter_or_formatter": has_linter,
            "has_ci_workflow": has_ci,
            "has_license": has_license,
            "has_architecture_diagram": has_architecture_diagram,
        },
        "inspection_errors": inspection_errors,
    }


def fetch_github_data(username: str) -> dict[str, object]:
    normalized_username = username.strip().lower()
    if not normalized_username:
        raise ValueError("GitHub username is required.")

    now = time.time()
    cached = _PROFILE_CACHE.get(normalized_username)
    if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    token = os.getenv("GITHUB_TOKEN", "").strip()
    github = Github(auth=Auth.Token(token)) if token else Github()
    try:
        user = github.get_user(normalized_username)
        repositories: list[dict[str, object]] = []
        rate_limited = False
        repo_limit = _repository_limit()

        # Check GraphQL for pinned items if token is available
        pinned_names: set[str] = set()
        if token:
            try:
                import json
                import urllib.request
                gql_query = {
                    "query": """
                    query($login: String!) {
                      user(login: $login) {
                        pinnedItems(first: 6, types: REPOSITORY) {
                          nodes {
                            ... on Repository {
                              name
                            }
                          }
                        }
                      }
                    }
                    """,
                    "variables": {"login": normalized_username},
                }
                req = urllib.request.Request(
                    "https://api.github.com/graphql",
                    data=json.dumps(gql_query).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {token}",
                        "User-Agent": "MSOT-Placement-Copilot",
                        "Content-Type": "application/json",
                    },
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    resp_json = json.loads(resp.read().decode())
                    nodes = resp_json.get("data", {}).get("user", {}).get("pinnedItems", {}).get("nodes", [])
                    pinned_names = {n["name"] for n in nodes if isinstance(n, dict) and "name" in n}
            except Exception:
                pass

        try:
            for index, repository in enumerate(user.get_repos(sort="updated")):
                if index >= repo_limit:
                    break
                try:
                    repositories.append(_inspect_repository(repository, pinned_names=pinned_names))
                except (RateLimitExceededException, GithubException) as exc:
                    if getattr(exc, "status", None) in (403, 429) or "rate limit" in str(exc).lower():
                        rate_limited = True
                        break
                    raise
        except (RateLimitExceededException, GithubException) as exc:
            if getattr(exc, "status", None) in (403, 429) or "rate limit" in str(exc).lower():
                rate_limited = True
            else:
                raise

        has_pinned = any(bool(r.get("is_pinned")) for r in repositories)
        has_recent = any(bool(r.get("has_recent_activity")) for r in repositories)
        has_secrets = any(bool(r.get("has_committed_secrets")) for r in repositories)
        has_unit_tests = any(bool(r.get("has_unit_tests")) for r in repositories)
        has_ci_cd = any(bool(r.get("has_ci_cd")) for r in repositories)
        has_architecture = any(bool(r.get("has_architecture_diagram")) for r in repositories)
        avg_code_quality = (
            round(sum(int(r.get("code_quality_score", 0)) for r in repositories) / len(repositories))
            if repositories
            else 0
        )

        result: dict[str, object] = {
            "username": user.login,
            "name": user.name,
            "bio": user.bio,
            "public_repos": user.public_repos,
            "followers": user.followers,
            "following": user.following,
            "repositories": repositories,
            "repositories_inspected": len(repositories),
            "rate_limited": rate_limited,
            "has_pinned_repos": has_pinned,
            "has_recent_commit_activity": has_recent,
            "has_committed_secrets": has_secrets,
            "has_unit_tests": has_unit_tests,
            "has_ci_cd": has_ci_cd,
            "has_architecture_diagrams": has_architecture,
            "average_code_quality_score": avg_code_quality,
        }

        _PROFILE_CACHE[normalized_username] = (now, result)
        return result
    finally:
        github.close()
