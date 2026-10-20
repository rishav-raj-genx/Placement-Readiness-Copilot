import os
import re
from collections.abc import Mapping
from typing import Literal

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
    spelling_grammar_issues: list[str]
    specific_fixes: list[str]


class GithubReview(BaseModel):
    score: int = Field(ge=0, le=100)
    specific_fixes: list[str]


class LinkedInReviewResult(BaseModel):
    score: int = Field(ge=0, le=100)
    has_complete_profile: bool
    skills_relevant: bool
    suggested_rewrites: list[str]


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
    # Redact potential keys, tokens, or auth headers
    sanitized = re.sub(
        r"(?i)(bearer|key|token|auth|password|secret)[\s:=]+['\"]?[a-zA-Z0-9_\-\.]{8,}['\"]?",
        r"\1=[REDACTED]",
        msg,
    )
    # Strip URLs with query parameters
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
        except Exception as exc:  # noqa: BLE001 - provider SDKs expose unrelated exception types
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
    spelling_issues = [
        f"Replace '{misspelling}' with '{correction}'."
        for misspelling, correction in COMMON_MISSPELLINGS.items()
        if misspelling in words
    ]
    has_language_issues = bool(spelling_issues)

    fixes: list[str] = [
        "[Heuristic Check] Rule-based evaluation used. Visual layout, columns, tables, and complex grammar could not be verified."
    ]
    if not is_one_page:
        fixes.append(f"Resume is {page_count} pages instead of 1.")
    if not is_ats_friendly:
        fixes.append(
            "Use standard section headings, selectable text, and a single-column ATS-friendly layout."
        )
    if not uses_action_verbs:
        fixes.append("Start achievement bullets with strong action verbs and quantify outcomes.")
    fixes.extend(spelling_issues)

    passed_benchmarks = sum(
        (is_one_page, is_ats_friendly, uses_action_verbs, not has_language_issues)
    )
    return ReviewResult(
        score=passed_benchmarks * 25,
        page_count=page_count,
        is_one_page=is_one_page,
        is_ats_friendly=is_ats_friendly,
        uses_action_verbs=uses_action_verbs,
        has_spelling_or_grammar_issues=has_language_issues,
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
                """You are an MSOT placement officer. Evaluate exactly these four
resume benchmarks and no substitutes:
1. Exactly one page. Use the supplied page_count; never infer page count from text.
2. ATS-friendly: selectable text, conventional headings, simple structure, and no
   evidence of tables, graphics, headers, footers, or unusual formatting that can
   break applicant-tracking parsers.
3. Achievement bullets use strong action verbs and measurable impact.
4. Spelling and grammar are correct. List each concrete issue and correction.

Set is_one_page to true only when page_count equals 1. If it does not, specific_fixes
must contain: "Resume is <page_count> pages instead of 1." Score all four benchmarks
and return only the ReviewResult schema. Do not add markdown or extra fields.""",
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
                """You are an MSOT placement officer reviewing a GitHub profile.
Use the supplied deterministic repository inspection. Check repository relevance,
README presence and quality, a recognizable source-code directory, dependency
manifests, tests, maintainable top-level structure, consistency, and evidence of
impact. Penalize undocumented or structurally empty repositories. Return only the
GithubReview schema with practical repository-specific fixes.""",
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
                score=0.0,
                specific_fixes=[
                    "[Heuristic Check] No public repositories found. Add publicly visible source code repositories with clear READMEs, tests, and dependency manifests.",
                ],
            )
        # Quality-based fallback scoring on inspected repository attributes
        repo_scores: list[float] = []
        fixes: list[str] = [
            "[Heuristic Check] Static structural assessment used (LLM unavailable). Semantic code quality and commit history could not be verified."
        ]
        has_tests_any = False
        has_manifest_any = False
        has_readme_any = False
        for repo in repositories:
            if not isinstance(repo, dict):
                continue
            r_score = 20.0  # base presence
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
            repo_scores.append(min(100.0, r_score))

        avg_score = round(sum(repo_scores) / len(repo_scores), 1) if repo_scores else 0.0
        if not has_readme_any:
            fixes.append("Add detailed README files (>150 characters) explaining architecture and installation.")
        if not has_manifest_any:
            fixes.append("Include standard dependency manifests (e.g. package.json, requirements.txt, pyproject.toml).")
        if not has_tests_any:
            fixes.append("Add automated unit tests in a dedicated test directory.")
        return GithubReview(
            score=avg_score,
            specific_fixes=fixes,
        )


def evaluate_linkedin_text(text: str) -> LinkedInReviewResult:
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are a tech recruiter evaluating a LinkedIn Save-to-PDF export.
Set has_complete_profile to true only when it contains a meaningful headline and
About section. Set skills_relevant to true only when skills match the apparent
target technical role. Return ready-to-paste rewrites and only the
LinkedInReviewResult schema.""",
            ),
            ("human", "{linkedin_text}"),
        ]
    )
    try:
        return _invoke_structured(prompt, LinkedInReviewResult, {"linkedin_text": text})
    except ReviewBackendError:
        normalized = text.lower()
        if len(normalized.strip()) < 120:
            return LinkedInReviewResult(
                score=0.0,
                has_complete_profile=False,
                skills_relevant=False,
                suggested_rewrites=[
                    "[Heuristic Check] LinkedIn PDF export contains insufficient text content. Ensure you use 'Save to PDF' from a complete profile.",
                ],
            )
        has_about = bool(re.search(r"about\s*[\n\r]+.{20,}", normalized, re.DOTALL))
        has_headline = "headline" in normalized or any(
            term in normalized for term in ("engineer", "developer", "student", "intern", "specialist")
        )
        has_skills = "skills" in normalized and bool(re.search(r"skills\s*[\n\r]+.{15,}", normalized, re.DOTALL))
        has_complete = has_about and has_headline

        score = (40.0 if has_headline else 0.0) + (30.0 if has_about else 0.0) + (30.0 if has_skills else 0.0)
        return LinkedInReviewResult(
            score=round(score, 1),
            has_complete_profile=has_complete,
            skills_relevant=has_skills,
            suggested_rewrites=[
                "[Heuristic Check] Rule-based keyword matching used (LLM provider unavailable). Add a descriptive About section and list at least 5 relevant technical skills.",
            ],
        )
