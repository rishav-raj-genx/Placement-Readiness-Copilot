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
            failures.append(f"{provider}: {exc}")

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

    fixes: list[str] = []
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
        repository_count = len(repositories) if isinstance(repositories, list) else 0
        return GithubReview(
            score=min(100, repository_count * 10),
            specific_fixes=[
                "Add clear READMEs, conventional source directories, dependency manifests, and tests to each featured repository."
            ],
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
        has_complete_profile = "about" in normalized and "headline" in normalized
        has_skills = "skills" in normalized
        return LinkedInReviewResult(
            score=(50 if has_complete_profile else 0) + (50 if has_skills else 0),
            has_complete_profile=has_complete_profile,
            skills_relevant=has_skills,
            suggested_rewrites=[
                "Add a role-specific headline, a concise About section, and skills aligned with your target role."
            ],
        )
