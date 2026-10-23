import os
import re
import time
from datetime import datetime, timezone
from typing import Optional

from github import Auth, Github, GithubException, RateLimitExceededException, UnknownObjectException
from github.Repository import Repository

from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

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

    # 3. Committed Secrets & History-Aware Secret Scanner
    detected_secrets: list[str] = []
    committed_env_files = [f for f in top_level_files if f.lower() in SENSITIVE_FILES or f.lower().startswith(".env.")]
    if committed_env_files:
        detected_secrets.append(f"Committed sensitive file: {', '.join(committed_env_files)}")

    if readme_text:
        readme_secret_matches = _scan_text_for_secrets(readme_text)
        for s in readme_secret_matches:
            detected_secrets.append(f"Exposed {s} in README")

    # History-aware secret inspection across recent commits
    history_secrets: list[str] = []
    if hasattr(repository, "get_commits"):
        try:
            commits = repository.get_commits()
            commit_list = []
            for i, c in enumerate(commits):
                if i >= 10:
                    break
                commit_list.append(c)

            for commit in commit_list:
                msg = getattr(getattr(commit, "commit", None), "message", "") or getattr(commit, "message", "")
                sha_short = getattr(commit, "sha", "commit")[:7]
                if re.search(r"(?i)\b(secret|token|api[_-]?key|password|credentials?|\.env)\b", msg):
                    if re.search(r"(?i)\b(revert|remove|fix|leaked|accidental|deleted?|rotate)\b", msg):
                        history_secrets.append(
                            f"Commit '{sha_short}: {msg.strip().splitlines()[0]}' in git history indicates previously committed secrets."
                        )

                files = getattr(commit, "files", None)
                if files:
                    for f in files:
                        fname = getattr(f, "filename", "")
                        fname_lower = fname.lower()
                        if fname_lower in SENSITIVE_FILES or fname_lower.endswith((".env", ".pem", ".key")):
                            history_secrets.append(f"Sensitive file '{fname}' in commit {sha_short} history.")
                        patch = getattr(f, "patch", "")
                        if patch:
                            additions = "\n".join(
                                l for l in patch.splitlines() if l.startswith("+") and not l.startswith("+++")
                            )
                            patch_secrets = _scan_text_for_secrets(additions)
                            for ps in patch_secrets:
                                history_secrets.append(f"Exposed {ps} in commit {sha_short} diff.")
        except (GithubException, AssertionError, AttributeError, Exception):
            pass

    if history_secrets:
        detected_secrets.extend(history_secrets)

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

    # Explicit README Setup & Run Instructions Check
    has_setup_instructions = False
    setup_commands_found: list[str] = []
    if readme_text:
        has_setup_heading = bool(
            re.search(
                r"(?im)^#{1,4}\s*(?:setup|installation|getting\s+started|quick\s*start|how\s+to\s+run|running\s+locally|development|prerequisites)",
                readme_text,
            )
        )
        cmd_matches = re.findall(
            r"(?i)\b(pnpm\s+(?:install|dev|build|start)|npm\s+(?:install|run\s+dev|start)|yarn\s+(?:install|dev)|pip\s+install|uv\s+pip|poetry\s+install|cargo\s+(?:build|run)|go\s+(?:run|build)|docker-compose\s+up|docker\s+compose\s+up|python\s+main\.py)\b",
            readme_text,
        )
        if cmd_matches:
            setup_commands_found = list(dict.fromkeys(cmd_matches))
        has_setup_instructions = has_setup_heading or len(setup_commands_found) > 0

    if has_readme and not has_setup_instructions:
        inspection_errors.append("README lacks explicit setup or installation instructions (e.g., 'pnpm install', 'docker compose up').")

    # 4. Source-level Code Fetching & Readability Assessment
    has_source_dir = bool(normalized_directories & SOURCE_DIRECTORIES)
    has_manifest = bool(normalized_files & DEPENDENCY_MANIFESTS)
    has_linter = bool(normalized_files & LINTER_CONFIGS)
    has_ci = bool(normalized_directories & CI_DIRECTORIES) or any(
        ".github" in d.lower() for d in top_level_directories
    )
    has_license = any("license" in f.lower() for f in top_level_files)

    code_extensions = {".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".c", ".cpp"}
    candidate_paths: list[str] = [
        f for f in top_level_files if any(f.lower().endswith(ext) for ext in code_extensions)
    ]

    if len(candidate_paths) < 3 and (normalized_directories & SOURCE_DIRECTORIES):
        for sdir in sorted(normalized_directories & SOURCE_DIRECTORIES):
            try:
                sub_contents = repository.get_contents(sdir)
                sub_items = sub_contents if isinstance(sub_contents, list) else [sub_contents]
                for sitem in sub_items:
                    sname = getattr(sitem, "name", "")
                    stype = getattr(sitem, "type", "file")
                    if stype == "file" and any(sname.lower().endswith(ext) for ext in code_extensions):
                        candidate_paths.append(f"{sdir}/{sname}")
                    if len(candidate_paths) >= 4:
                        break
            except (GithubException, AssertionError, Exception):
                pass
            if len(candidate_paths) >= 4:
                break

    source_files_analyzed: list[dict[str, object]] = []
    readability_scores: list[float] = []
    code_readability_comments: list[str] = []

    for cpath in candidate_paths[:4]:
        try:
            file_obj = repository.get_contents(cpath)
            if isinstance(file_obj, list):
                continue
            raw_data = getattr(file_obj, "decoded_content", b"")
            file_text = raw_data.decode("utf-8", errors="replace") if isinstance(raw_data, bytes) else str(raw_data)
            if not file_text.strip():
                continue

            lines = file_text.splitlines()
            loc = len(lines)
            if loc == 0:
                continue

            long_lines = sum(1 for l in lines if len(l) > 120)
            comment_lines = sum(
                1 for l in lines if l.strip().startswith(("#", "//", "/*", "*", "'''", '"""'))
            )
            comment_ratio = comment_lines / loc
            long_line_ratio = long_lines / loc

            file_readability = 75.0
            if comment_ratio >= 0.05:
                file_readability += 15.0
            elif comment_ratio < 0.02 and loc > 40:
                file_readability -= 10.0

            if long_line_ratio <= 0.05:
                file_readability += 10.0
            elif long_line_ratio > 0.20:
                file_readability -= 20.0

            if loc > 800:
                file_readability -= 10.0

            file_readability = max(10.0, min(100.0, file_readability))
            readability_scores.append(file_readability)

            source_files_analyzed.append({
                "path": cpath,
                "lines_of_code": loc,
                "comment_ratio": round(comment_ratio, 2),
                "long_lines_count": long_lines,
                "readability_score": round(file_readability),
            })
        except (GithubException, AssertionError, Exception):
            pass

    avg_readability = (
        round(sum(readability_scores) / len(readability_scores))
        if readability_scores
        else (75 if has_source_dir else 45)
    )

    if source_files_analyzed:
        if avg_readability >= 80:
            code_readability_comments.append("Clean source code readability: consistent formatting, descriptive structure, and adequate inline documentation.")
        elif avg_readability >= 60:
            code_readability_comments.append("Moderate code readability: keep line lengths under 120 chars and add function docstrings.")
        else:
            code_readability_comments.append("Low code readability: excessive line lengths and lack of code comments/docstrings.")
    else:
        if has_source_dir:
            code_readability_comments.append("Source directory detected; automated readability score inferred from modular project structure.")
        else:
            code_readability_comments.append("No source directory detected to evaluate code readability.")

    code_quality_score = 0
    if has_source_dir:
        code_quality_score += 20
    if has_manifest:
        code_quality_score += 20
    if has_tests:
        code_quality_score += 20
    if has_linter:
        code_quality_score += 15
    if has_ci:
        code_quality_score += 10
    if has_license:
        code_quality_score += 5
    if avg_readability >= 70:
        code_quality_score += 10
    code_quality_score = min(100, code_quality_score)

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
        "history_secrets": history_secrets,
        "has_unit_tests": has_tests,
        "has_ci_cd": has_ci,
        "has_architecture_diagram": has_architecture_diagram,
        "has_setup_instructions": has_setup_instructions,
        "setup_commands_found": setup_commands_found,
        "code_readability_score": avg_readability,
        "code_readability_comments": code_readability_comments,
        "source_files_analyzed": len(source_files_analyzed),
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
            "has_setup_instructions": has_setup_instructions,
            "code_readability_score": avg_readability,
        },
        "inspection_errors": inspection_errors,
    }


def _base_github_error_profile(username: str, reason: str = "GitHub profile not found or invalid username.") -> dict[str, object]:
    return {
        "username": username,
        "name": None,
        "bio": None,
        "public_repos": 0,
        "followers": 0,
        "following": 0,
        "repositories": [],
        "repositories_inspected": 0,
        "rate_limited": False,
        "has_pinned_repos": False,
        "has_recent_commit_activity": False,
        "has_committed_secrets": False,
        "has_unit_tests": False,
        "has_ci_cd": False,
        "has_architecture_diagrams": False,
        "average_code_quality_score": 0,
        "score": 0,
        "reason": reason,
        "error": reason,
    }


def _is_transient_github_error(exc: BaseException) -> bool:
    if isinstance(exc, UnknownObjectException):
        return False
    if isinstance(exc, GithubException):
        status_code = getattr(exc, "status", None)
        if status_code in (400, 401, 404):
            return False
        if status_code in (500, 502, 503, 504):
            return True
    if isinstance(exc, (ConnectionError, TimeoutError, OSError)):
        return True
    err = str(exc).lower()
    return any(k in err for k in ("timeout", "timed out", "connection reset", "temporary failure"))


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.2, min=0.2, max=1.5),
    retry=retry_if_exception(_is_transient_github_error),
    reraise=True,
)
def _get_user_with_retry(github: Github, username: str):
    return github.get_user(username)


def extract_github_username(url_or_username: str) -> str:
    """Extract clean GitHub username from URL or raw username string."""
    if not url_or_username or not url_or_username.strip():
        return ""
    cleaned = url_or_username.strip()
    cleaned = cleaned.split("?")[0].split("#")[0].rstrip("/")
    match = re.search(r"github\.com/([a-zA-Z0-9_\-]+)", cleaned, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    raw = cleaned.replace("@", "").strip()
    if "/" in raw:
        raw = raw.split("/")[-1].strip()
    if re.match(r"^[a-zA-Z0-9_\-]+$", raw):
        return raw
    return raw


def fetch_github_data(username: str, force_refresh: bool = False) -> dict[str, object]:
    clean_username = extract_github_username(username)
    normalized_username = clean_username.strip().lower()
    if not normalized_username:
        return _base_github_error_profile(username or "unknown", "GitHub profile not found or invalid username.")

    now = time.time()
    cached = _PROFILE_CACHE.get(normalized_username)
    if not force_refresh and cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    token = os.getenv("GITHUB_TOKEN", "").strip()
    github = Github(auth=Auth.Token(token)) if token else Github()
    try:
        try:
            user = _get_user_with_retry(github, normalized_username)
        except UnknownObjectException:
            return _base_github_error_profile(normalized_username, "GitHub profile not found or invalid username.")
        except (RateLimitExceededException, GithubException) as exc:
            status_code = getattr(exc, "status", None)
            if status_code == 404 or "not found" in str(exc).lower():
                return _base_github_error_profile(normalized_username, "GitHub profile not found or invalid username.")
            if cached:
                return cached[1]
            if status_code in (403, 429) or "rate limit" in str(exc).lower():
                return _base_github_error_profile(normalized_username, "GitHub API rate limit exceeded.")
            return _base_github_error_profile(normalized_username, f"Link invalid or service unreachable: {str(exc)}")
        except Exception as exc:
            if cached:
                return cached[1]
            return _base_github_error_profile(normalized_username, f"Link invalid or service unreachable: GitHub connection error: {str(exc)}")

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
                    pass
                except Exception:
                    pass
        except (RateLimitExceededException, GithubException) as exc:
            if getattr(exc, "status", None) in (403, 429) or "rate limit" in str(exc).lower():
                rate_limited = True
            elif getattr(exc, "status", None) == 404:
                return _base_github_error_profile(normalized_username, "GitHub profile not found or invalid username.")
        except Exception:
            pass

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
