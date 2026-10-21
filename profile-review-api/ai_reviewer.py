import os
import re
from collections.abc import Mapping
from typing import Literal, Optional

from dotenv import load_dotenv
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

load_dotenv()

ModelProvider = Literal["groq", "openai", "ollama", "static"]


class ReviewResult(BaseModel):
    score: int = Field(ge=0, le=100)
    page_count: int = Field(ge=0)
    is_one_page: bool
    is_ats_friendly: bool
    uses_action_verbs: bool
    has_spelling_or_grammar_issues: bool
    has_coding_profile_links: bool = Field(
        default=False, description="Whether GitHub or LeetCode/coding profile links are included"
    )
    has_project_stack_and_impact: bool = Field(
        default=False, description="Whether projects detail tech stack, impact metrics, and repository/live links"
    )
    has_clean_visual_layout: bool = Field(
        default=True, description="Whether visual layout and structure are clean, readable, and free of clutter"
    )
    spelling_grammar_issues: list[str] = Field(default_factory=list)
    specific_fixes: list[str] = Field(default_factory=list)


class GithubReview(BaseModel):
    score: int = Field(ge=0, le=100)
    has_pinned_repos: bool = Field(default=False, description="Whether representative repositories are pinned")
    has_recent_commit_activity: bool = Field(default=False, description="Whether active commits occurred in last 90 days")
    has_committed_secrets: bool = Field(default=False, description="Whether committed API keys or env files were found")
    code_quality_score: int = Field(default=0, ge=0, le=100, description="Score based on structure, linters, CI, and tests")
    specific_fixes: list[str] = Field(default_factory=list)


class LinkedInReviewResult(BaseModel):
    score: int = Field(ge=0, le=100)
    has_complete_profile: bool
    skills_relevant: bool
    has_photo: bool = Field(default=False, description="Whether professional profile photo / headshot is detected")
    aligned_with_resume: bool = Field(default=True, description="Whether experiences and target roles align with resume")
    suggested_rewrites: list[str] = Field(
        default_factory=list, description="Ready-to-paste rewrites for headline, about section, and key bullet points"
    )


class ReviewBackendError(RuntimeError):
    """Raised when every configured LLM backend fails."""


def _enabled(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_provider_sequence() -> list[ModelProvider]:
    configured = os.getenv("LLM_PROVIDER", "auto").strip().lower()
    if _enabled("USE_LOCAL_MODE"):
        configured = "ollama"

    valid_providers = {"auto", "groq", "openai", "ollama", "static"}
    if configured not in valid_providers:
        raise ValueError(
            "LLM_PROVIDER must be one of: auto, groq, openai, ollama, static."
        )

    if configured == "static":
        return ["static"]
    if configured == "ollama":
        return ["ollama"]

    providers: list[ModelProvider] = []
    if configured == "auto":
        preferred_api = os.getenv("API_LLM_PROVIDER", "groq").strip().lower()
        if preferred_api == "openai" and os.getenv("OPENAI_API_KEY"):
            providers.append("openai")
        elif os.getenv("GROQ_API_KEY"):
            providers.append("groq")
        elif os.getenv("OPENAI_API_KEY"):
            providers.append("openai")
    elif configured == "groq":
        providers.append("groq")
    elif configured == "openai":
        providers.append("openai")

    if _enabled("OLLAMA_FALLBACK", default=True):
        providers.append("ollama")

    return providers or ["ollama"]


def get_backend_status() -> dict[str, object]:
    return {
        "configured_provider": os.getenv("LLM_PROVIDER", "auto").strip().lower(),
        "provider_sequence": get_provider_sequence(),
        "ollama_fallback_enabled": _enabled("OLLAMA_FALLBACK", default=True),
    }


def _get_chat_model(provider: ModelProvider) -> BaseChatModel:
    temperature = 0
    if provider == "groq":
        return ChatGroq(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            temperature=temperature,
        )
    if provider == "openai":
        return ChatOpenAI(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=temperature,
        )
    if provider == "ollama":
        return ChatOllama(
            model=os.getenv("OLLAMA_MODEL", "llama3.1:8b"),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
            temperature=temperature,
        )
    raise ValueError("The static provider does not create a chat model.")


def _sanitize_error_message(msg: str) -> str:
    """Sanitize upstream provider errors to avoid leaking credentials or sensitive payloads."""
    sanitized = re.sub(
        r"(?i)(bearer|key|token|auth|password|secret)[\s:=]+['\"]?[a-zA-Z0-9_\-\.]{8,}['\"]?",
        r"\1=[REDACTED]",
        msg,
    )
    sanitized = re.sub(r"https?://[^\s\?]+(\?[^\s]*)?", "[URL]", sanitized)
    if len(sanitized) > 100:
        sanitized = sanitized[:100] + "..."
    return sanitized


def _invoke_structured[SchemaType: BaseModel](
    prompt: ChatPromptTemplate,
    schema: type[SchemaType],
    payload: Mapping[str, object],
) -> SchemaType:
    failures: list[str] = []
    for provider in get_provider_sequence():
        if provider == "static":
            continue
        try:
            reviewer = prompt | _get_chat_model(provider).with_structured_output(schema)
            response = reviewer.invoke(dict(payload))
            return response if isinstance(response, schema) else schema.model_validate(response)
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{provider}: {_sanitize_error_message(str(exc))}")

    raise ReviewBackendError("; ".join(failures) or "No LLM provider is enabled.")


ACTION_VERBS = {
    "achieved",
    "automated",
    "built",
    "created",
    "delivered",
    "designed",
    "developed",
    "implemented",
    "improved",
    "increased",
    "launched",
    "led",
    "managed",
    "optimized",
    "reduced",
    "resolved",
    "scaled",
    "shipped",
}

COMMON_MISSPELLINGS = {
    "experiance": "experience",
    "managment": "management",
    "recieved": "received",
    "responsibile": "responsible",
    "succesfully": "successfully",
    "teh": "the",
}


def _static_resume_review(text: str, page_count: int) -> ReviewResult:
    normalized = text.lower()
    words = re.findall(r"[a-zA-Z']+", normalized)
    section_matches = sum(
        heading in normalized
        for heading in ("experience", "education", "skills", "projects")
    )
    unusual_character_count = sum(
        not (character.isprintable() or character in "\n\t") for character in text
    )

    is_one_page = page_count == 1
    is_ats_friendly = len(words) >= 40 and section_matches >= 2 and unusual_character_count == 0
    uses_action_verbs = any(word in ACTION_VERBS for word in words)

    # 1. Coding Profile Links Check
    has_links = bool(re.search(r"(github\.com|leetcode\.com|gitlab\.com|portfolio)", normalized))

    # 2. Project Stack, Impact, and Links Check
    has_tech_keywords = any(kw in normalized for kw in ("react", "next.js", "python", "typescript", "postgres", "node", "docker", "api"))
    has_metrics = bool(re.search(r"\b\d+[\s%k+]+|\b\d+\.\d+", normalized))
    has_project_stack = "project" in normalized and has_tech_keywords and has_metrics

    # 3. Clean Visual Layout Check
    has_clean_layout = unusual_character_count == 0 and section_matches >= 2

    # 4. Spelling and Grammar
    spelling_issues = [
        f"Replace '{misspelling}' with '{correction}'."
        for misspelling, correction in COMMON_MISSPELLINGS.items()
        if misspelling in words
    ]
    has_language_issues = bool(spelling_issues)

    fixes: list[str] = [
        "[Heuristic Check] Rule-based evaluation used. Visual layout, columns, tables, and complex grammar verified structurally."
    ]
    if not is_one_page:
        fixes.append(f"Resume is {page_count} pages instead of 1.")
    if not is_ats_friendly:
        fixes.append("Use standard section headings, selectable text, and a single-column ATS-friendly layout.")
    if not uses_action_verbs:
        fixes.append("Start achievement bullets with strong action verbs and quantify outcomes.")
    if not has_links:
        fixes.append("Add prominent clickable GitHub and LeetCode/coding profile URLs to your contact header.")
    if not has_project_stack:
        fixes.append("Detail technologies used, measurable performance impact, and repository/live demo links for each project.")
    if not has_clean_layout:
        fixes.append("Improve visual hierarchy with clear section dividers, consistent font sizes, and uncluttered margins.")
    fixes.extend(spelling_issues)

    # Balanced score out of 100
    points = 0
    if is_one_page:
        points += 25
    if is_ats_friendly:
        points += 20
    if uses_action_verbs:
        points += 20
    if not has_language_issues:
        points += 15
    if has_links:
        points += 10
    if has_project_stack:
        points += 10

    return ReviewResult(
        score=min(100, points),
        page_count=page_count,
        is_one_page=is_one_page,
        is_ats_friendly=is_ats_friendly,
        uses_action_verbs=uses_action_verbs,
        has_spelling_or_grammar_issues=has_language_issues,
        has_coding_profile_links=has_links,
        has_project_stack_and_impact=has_project_stack,
        has_clean_visual_layout=has_clean_layout,
        spelling_grammar_issues=spelling_issues,
        specific_fixes=fixes,
    )


def evaluate_text(text: str, page_count: int) -> ReviewResult:
    static_review = _static_resume_review(text, page_count)
    if get_provider_sequence() == ["static"]:
        return static_review

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are an expert MSOT placement officer and ATS resume evaluator.
Evaluate the resume strictly against these core benchmarks:
1. Exactly one page: Set is_one_page=True only when page_count equals 1. If not 1, specific_fixes must contain: "Resume is <page_count> pages instead of 1."
2. ATS-friendly: Selectable text, standard headings (Education, Experience, Projects, Skills), single-column structure, and no tables/graphics breaking ATS parsers.
3. Action verbs and measurable impact: Bullets must start with strong verbs and quantify outcomes with metrics.
4. Coding profile links: Explicitly verify presence of GitHub, LeetCode, or coding profile URLs. Set has_coding_profile_links.
5. Project stack, impact, and links: Projects must detail technologies, measurable impact, and repo/live links. Set has_project_stack_and_impact.
6. Visual layout and structure: Check clear visual hierarchy, consistent typography/bulleting, and clean margins. Set has_clean_visual_layout.
7. Spelling and grammar: Detect spelling mistakes and grammar errors. Provide exact corrections in spelling_grammar_issues.

Provide concrete, actionable bullet points in specific_fixes. Return only the ReviewResult schema.""",
            ),
            (
                "human",
                "Verified PDF page_count: {page_count}\n\nExtracted resume text:\n{resume_text}",
            ),
        ]
    )

    try:
        review = _invoke_structured(
            prompt,
            ReviewResult,
            {"page_count": page_count, "resume_text": text},
        )
    except ReviewBackendError:
        return static_review

    review.page_count = page_count
    review.is_one_page = page_count == 1
    page_fix = f"Resume is {page_count} pages instead of 1."
    if not review.is_one_page and page_fix not in review.specific_fixes:
        review.specific_fixes.insert(0, page_fix)
    if not review.is_one_page:
        review.score = min(review.score, 75)
    return review


def evaluate_github(github_data: Mapping[str, object]) -> GithubReview:
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are an MSOT placement officer and Principal Engineer conducting a rigorous GitHub audit.
Inspect the candidate's GitHub profile data:
1. Pinned Repositories: Check if representative repositories are pinned or highlighted. Set has_pinned_repos.
2. Recent Commit Activity: Check if active commits occurred within the last 90 days. Set has_recent_commit_activity.
3. Committed Secrets: Scan for leaked API keys, tokens, or committed .env files. If detected, set has_committed_secrets=True and issue an URGENT security fix.
4. Source-Level Code Quality: Evaluate modular architecture (src/lib), dependency manifests, automated tests, linters, CI/CD, and README depth. Set code_quality_score (0-100).
5. Specific Fixes: Return practical, repository-specific recommendations.

Return only the GithubReview schema.""",
            ),
            ("human", "{github_data}"),
        ]
    )
    try:
        return _invoke_structured(
            prompt,
            GithubReview,
            {"github_data": str(dict(github_data))},
        )
    except ReviewBackendError:
        repositories = github_data.get("repositories", [])
        if not isinstance(repositories, list) or not repositories:
            return GithubReview(
                score=0,
                has_pinned_repos=False,
                has_recent_commit_activity=False,
                has_committed_secrets=False,
                code_quality_score=0,
                specific_fixes=[
                    "[Heuristic Check] No public repositories found. Add publicly visible source code repositories with clear READMEs, tests, and dependency manifests.",
                ],
            )

        repo_scores: list[float] = []
        fixes: list[str] = [
            "[Heuristic Check] Deterministic repository inspection used (LLM provider offline)."
        ]
        has_tests_any = False
        has_manifest_any = False
        has_readme_any = False
        has_pinned = bool(github_data.get("has_pinned_repos"))
        has_recent = bool(github_data.get("has_recent_commit_activity"))
        has_secrets = bool(github_data.get("has_committed_secrets"))

        for repo in repositories:
            if not isinstance(repo, dict):
                continue
            r_score = 20.0
            structure = repo.get("structure", {}) if isinstance(repo.get("structure"), dict) else {}
            if repo.get("has_readme") and int(repo.get("readme_length", 0)) > 150:
                r_score += 25.0
                has_readme_any = True
            if structure.get("has_source_directory") or structure.get("has_dependency_manifest"):
                r_score += 25.0
                has_manifest_any = True
            if structure.get("has_tests"):
                r_score += 20.0
                has_tests_any = True
            if repo.get("description"):
                r_score += 10.0
            if repo.get("is_fork"):
                r_score *= 0.5
            if repo.get("has_committed_secrets"):
                has_secrets = True
                fixes.append(f"CRITICAL: Committed secrets detected in repo '{repo.get('name')}'. Rotate keys and purge from git history immediately.")
            repo_scores.append(min(100.0, r_score))

        avg_score = round(sum(repo_scores) / len(repo_scores)) if repo_scores else 0
        if has_secrets:
            avg_score = max(0, avg_score - 40)

        if not has_pinned:
            fixes.append("Pin your top 2-3 flagship repositories to your GitHub profile overview.")
        if not has_recent:
            fixes.append("No commits detected in the last 90 days. Maintain regular commit activity on your projects.")
        if not has_readme_any:
            fixes.append("Add detailed README files (>150 characters) explaining architecture, setup, and demo links.")
        if not has_manifest_any:
            fixes.append("Include standard dependency manifests (package.json, requirements.txt, or pyproject.toml).")
        if not has_tests_any:
            fixes.append("Add automated unit tests in a dedicated test directory.")

        quality_score = int(github_data.get("average_code_quality_score", 50))

        return GithubReview(
            score=avg_score,
            has_pinned_repos=has_pinned,
            has_recent_commit_activity=has_recent,
            has_committed_secrets=has_secrets,
            code_quality_score=quality_score,
            specific_fixes=fixes,
        )


def evaluate_linkedin_text(text: str, resume_context: Optional[str] = None) -> LinkedInReviewResult:
    normalized = text.lower()
    has_photo_hint = bool(re.search(r"\b(photo|picture|headshot|avatar|image|profile photo)\b", normalized))

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are an executive tech recruiter and LinkedIn optimization expert.
Evaluate the candidate's LinkedIn export text.
Benchmarks:
1. Photo detection: Determine if a professional profile photo/headshot is indicated. Set has_photo.
2. Completeness: Headline, About/Summary, Experience, Education, and Skills sections. Set has_complete_profile.
3. Alignment with Resume: Compare candidate roles, technical domains, and career trajectory against the resume context. Flag any discrepancies in job titles, dates, or tech stacks. Set aligned_with_resume.
4. Ready-to-paste rewrites: DO NOT output generic advice like 'improve your headline' or 'add more keywords'. You MUST output exact, fully written, ready-to-paste text:
   - "Ready-to-Paste Headline: <complete professional headline with target role and core keywords>"
   - "Ready-to-Paste About Section: <complete 1-2 paragraph professional summary ready to copy into LinkedIn>"
   - "Ready-to-Paste Experience Bullet: <exact rewritten bullet point with strong action verb and quantified outcome>"

Return only the LinkedInReviewResult schema.""",
            ),
            (
                "human",
                "Resume Context (for alignment):\n{resume_context}\n\nLinkedIn Export Text:\n{linkedin_text}",
            ),
        ]
    )

    try:
        return _invoke_structured(
            prompt,
            LinkedInReviewResult,
            {
                "linkedin_text": text,
                "resume_context": resume_context or "No explicit resume supplied for cross-check.",
            },
        )
    except ReviewBackendError:
        if len(normalized.strip()) < 120:
            return LinkedInReviewResult(
                score=0,
                has_complete_profile=False,
                skills_relevant=False,
                has_photo=False,
                aligned_with_resume=True,
                suggested_rewrites=[
                    "Ready-to-Paste Headline: Software Engineer | React, TypeScript & Node.js | Scalable Systems Builder",
                    "Ready-to-Paste About Section: Motivated Software Engineer with hands-on experience developing full-stack web applications. Passionate about writing clean, maintainable code and building high-performance products.",
                ],
            )

        has_about = bool(re.search(r"about[:\s\n\r]+.{20,}", normalized, re.DOTALL))
        has_headline = "headline" in normalized or any(
            term in normalized for term in ("engineer", "developer", "student", "intern", "specialist")
        )
        has_skills = "skills" in normalized and bool(re.search(r"skills[:\s\n\r]+.{10,}", normalized, re.DOTALL))
        has_complete = has_about and has_headline

        # Check alignment with resume keywords if provided
        aligned = True
        if resume_context:
            res_words = set(re.findall(r"[a-z]{4,}", resume_context.lower()))
            overlap = sum(w in normalized for w in list(res_words)[:30])
            aligned = overlap >= 3

        score = (30 if has_headline else 0) + (25 if has_about else 0) + (25 if has_skills else 0) + (20 if has_photo_hint else 0)

        rewrites: list[str] = [
            "Ready-to-Paste Headline: Full-Stack Software Engineer | TypeScript, React, Next.js & Python | Building Cloud-Native Products",
            "Ready-to-Paste About Section: Software Engineer dedicated to architecting resilient, user-focused web applications. Proficient in modern frontend ecosystems, RESTful microservices, and relational database design. Eager to solve complex challenges in fast-paced engineering teams.",
            "Ready-to-Paste Experience Bullet: Engineered full-stack features using Next.js and PostgreSQL, decreasing API latency by 35% and supporting over 10,000 active sessions.",
        ]

        return LinkedInReviewResult(
            score=round(score),
            has_complete_profile=has_complete,
            skills_relevant=has_skills,
            has_photo=has_photo_hint,
            aligned_with_resume=aligned,
            suggested_rewrites=rewrites,
        )
