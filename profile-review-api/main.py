import asyncio
import hmac
import logging
import os
from typing import Annotated

import pymupdf
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, status
from github import GithubException
from pydantic import BaseModel, Field

from ai_reviewer import (
    GithubReview,
    LinkedInReviewResult,
    ReviewResult,
    evaluate_github,
    evaluate_linkedin_text,
    evaluate_text,
    extract_docx_data,
    extract_docx_text,
    get_backend_status,
)
from github_service import fetch_github_data
from leetcode_service import fetch_leetcode_stats

logger = logging.getLogger("profile_review_api")
logging.basicConfig(level=logging.INFO)

MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024

app = FastAPI(
    title="MSOT Profile Review Engine",
    version="1.0.0",
)


class ExtractedPdf(BaseModel):
    text: str
    page_count: int = Field(ge=1)
    is_truncated: bool = False
    layout_geometry: dict[str, object] = Field(default_factory=dict)


class LeetCodeReview(BaseModel):
    username: str
    exists: bool = False
    total_solved: int = 0
    easy_solved: int = 0
    medium_solved: int = 0
    hard_solved: int = 0
    contest_rating: float | None = None
    global_ranking: int | None = None
    score: int = Field(default=0, ge=0, le=100)
    error: str | None = None


class AnalyzeProfileResponse(BaseModel):
    resume_review: ReviewResult
    github_review: GithubReview | None = None
    linkedin_review: LinkedInReviewResult | None = None
    leetcode_review: LeetCodeReview | None = None
    document_review_subtotal: float = Field(ge=0, le=100)
    total_readiness_score: float = Field(ge=0, le=100)
    resume_error: str | None = None
    github_error: str | None = None
    linkedin_error: str | None = None
    leetcode_error: str | None = None


@app.get("/health")
def health() -> dict[str, object]:
    """Liveness probe: verifies process is responsive."""
    return {"status": "ok", "service": "profile-review-api"}


@app.get("/ready")
def ready() -> dict[str, object]:
    """Readiness probe: verifies backend provider configuration."""
    backend_status = get_backend_status()
    is_ready = bool(backend_status.get("configured_provider"))
    return {
        "status": "ok" if is_ready else "degraded",
        "ready": is_ready,
        "llm": backend_status,
    }


def _validate_pdf_headers(file: UploadFile) -> None:
    filename = (file.filename or "").lower()
    is_pdf_type = file.content_type in {"application/pdf", "application/octet-stream"}
    is_docx_type = file.content_type in {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/octet-stream",
        "application/msword",
        "application/zip",
    }
    is_pdf = filename.endswith(".pdf") and is_pdf_type
    is_docx = filename.endswith(".docx") and is_docx_type
    if not (is_pdf or is_docx):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a PDF or DOCX file with a supported content type.",
        )


def is_e2e_mode() -> bool:
    val = os.getenv("E2E_MODE", "").lower().strip()
    return val in {"1", "true", "yes"}


def verify_service_token(authorization: Annotated[str | None, Header()] = None) -> str:
    """Verify service-to-service Bearer authentication. Fails closed when secret is unconfigured."""
    if is_e2e_mode():
        return "authorized"

    service_secret = os.getenv("INTERNAL_SERVICE_SECRET", "").strip()
    service_key = os.getenv("INTERNAL_SERVICE_KEY", "").strip()
    service_token = os.getenv("PROFILE_REVIEW_SERVICE_TOKEN", "").strip()

    valid_keys = [k for k in (service_secret, service_key, service_token) if k]
    if not valid_keys:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Service authentication secret is not configured on the server. Please define INTERNAL_SERVICE_KEY or INTERNAL_SERVICE_SECRET in your server environment variables.",
        )

    if not authorization or not authorization.strip().startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
        )

    token = authorization.strip().split("Bearer ", 1)[1].strip()
    if not token or not any(hmac.compare_digest(token, expected) for expected in valid_keys):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid service token.",
        )

    return token


CHUNK_SIZE_BYTES = 64 * 1024


def _parse_pdf_bytes_sync(
    pdf_bytes: bytes, filename: str = "", filetype: str | None = None
) -> tuple[str, int, bool, dict[str, object]]:
    """CPU-bound PDF or DOCX text extraction run inside a thread pool with layout inspection."""
    is_docx = (
        filetype == "docx"
        or filename.lower().endswith(".docx")
        or (pdf_bytes.startswith(b"PK\x03\x04") and not pdf_bytes.startswith(b"%PDF"))
    )

    if is_docx:
        try:
            extracted_text, layout_geometry = extract_docx_data(pdf_bytes)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="The uploaded file is not a valid DOCX document.") from exc

        page_count = max(1, (len(extracted_text) + 2500) // 2500)
        is_truncated = False
        if len(extracted_text) > 100_000:
            extracted_text = extracted_text[:100_000]
            is_truncated = True

        return extracted_text, page_count, is_truncated, layout_geometry

    try:
        document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except (pymupdf.FileDataError, pymupdf.EmptyFileError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.") from exc

    try:
        if document.needs_pass:
            raise HTTPException(
                status_code=400,
                detail="Password-protected PDFs are not supported.",
            )
        if document.page_count > 15:
            raise HTTPException(
                status_code=400,
                detail=f"The uploaded PDF has {document.page_count} pages; maximum allowed is 15 pages.",
            )

        extracted_text_pages: list[str] = []
        page_geometries: list[dict[str, object]] = []
        has_narrow_margins = False
        is_multi_column = False

        for page in document:
            page_text = page.get_text("text")
            extracted_text_pages.append(page_text)

            rect = page.rect
            blocks = page.get_text("blocks")
            text_blocks = [b for b in blocks if len(b) >= 5 and str(b[4]).strip()]

            if text_blocks:
                min_left = min(b[0] for b in text_blocks)
                min_top = min(b[1] for b in text_blocks)
                min_right = min(rect.width - b[2] for b in text_blocks)
                min_bottom = min(rect.height - b[3] for b in text_blocks)

                if min_left < 18 or min_right < 18:
                    has_narrow_margins = True

                mid_x = rect.width / 2.0
                left_col_blocks = [b for b in text_blocks if b[2] <= mid_x + 20 and len(str(b[4]).strip()) > 10]
                right_col_blocks = [b for b in text_blocks if b[0] >= mid_x - 20 and len(str(b[4]).strip()) > 10]

                col_overlap_count = 0
                for lb in left_col_blocks:
                    for rb in right_col_blocks:
                        if max(lb[1], rb[1]) < min(lb[3], rb[3]):
                            col_overlap_count += 1
                if col_overlap_count >= 2:
                    is_multi_column = True

                page_geometries.append({
                    "width": round(rect.width, 2),
                    "height": round(rect.height, 2),
                    "margin_left": round(min_left, 2),
                    "margin_right": round(min_right, 2),
                    "margin_top": round(min_top, 2),
                    "margin_bottom": round(min_bottom, 2),
                    "block_count": len(text_blocks),
                })
            else:
                page_geometries.append({
                    "width": round(rect.width, 2),
                    "height": round(rect.height, 2),
                    "margin_left": 72.0,
                    "margin_right": 72.0,
                    "margin_top": 72.0,
                    "margin_bottom": 72.0,
                    "block_count": 0,
                })

        extracted_text = "\n".join(extracted_text_pages)
        is_truncated = False
        if len(extracted_text) > 100_000:
            extracted_text = extracted_text[:100_000]
            is_truncated = True

        layout_geometry = {
            "format": "pdf",
            "page_count": document.page_count,
            "has_narrow_margins": has_narrow_margins,
            "is_multi_column": is_multi_column,
            "pages": page_geometries,
        }

        return extracted_text, document.page_count, is_truncated, layout_geometry
    finally:
        document.close()


async def extract_pdf_text(file: UploadFile) -> ExtractedPdf:
    _validate_pdf_headers(file)

    if file.size and file.size > MAX_PDF_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="The uploaded file exceeds the 10 MB limit.")

    chunks: list[bytes] = []
    total_bytes = 0
    while chunk := await file.read(CHUNK_SIZE_BYTES):
        total_bytes += len(chunk)
        if total_bytes > MAX_PDF_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="The uploaded file exceeds the 10 MB limit.")
        chunks.append(chunk)

    if not total_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    file_bytes = b"".join(chunks)
    filename = (file.filename or "").lower()
    filetype = "docx" if filename.endswith(".docx") else "pdf"

    extracted_text, page_count, is_truncated, layout_geometry = await asyncio.to_thread(
        _parse_pdf_bytes_sync, file_bytes, filename, filetype
    )

    return ExtractedPdf(
        text=extracted_text,
        page_count=page_count,
        is_truncated=is_truncated,
        layout_geometry=layout_geometry,
    )


@app.post("/extract-pdf", response_model=ExtractedPdf)
async def extract_pdf(
    file: Annotated[UploadFile, File()],
    _auth: Annotated[str, Depends(verify_service_token)] = "authorized",
) -> ExtractedPdf:
    return await extract_pdf_text(file)


@app.post("/review-resume", response_model=ReviewResult, include_in_schema=False)
@app.post("/review/resume", response_model=ReviewResult)
async def review_resume(
    file: Annotated[UploadFile, File()],
    _auth: Annotated[str, Depends(verify_service_token)] = "authorized",
) -> ReviewResult:
    extracted = await extract_pdf_text(file)
    return evaluate_text(extracted.text, extracted.page_count, layout_geometry=extracted.layout_geometry)


@app.post("/review/linkedin", response_model=LinkedInReviewResult)
async def review_linkedin(
    file: Annotated[UploadFile, File()],
    _auth: Annotated[str, Depends(verify_service_token)] = "authorized",
) -> LinkedInReviewResult:
    extracted = await extract_pdf_text(file)
    return evaluate_linkedin_text(extracted.text)


@app.post("/review/github", response_model=GithubReview)
@app.get("/review/github/{username}", response_model=GithubReview)
def review_github(
    username: str,
    _auth: Annotated[str, Depends(verify_service_token)] = "authorized",
) -> GithubReview:
    try:
        data = fetch_github_data(username)
        if "reason" in data and data.get("score") == 0 and not data.get("repositories"):
            reason_str = str(data.get("reason", "Link invalid or service unreachable"))
            return GithubReview(
                score=0,
                has_pinned_repos=False,
                has_recent_commit_activity=False,
                has_committed_secrets=False,
                has_unit_tests=False,
                has_ci_cd=False,
                has_architecture_diagrams=False,
                code_quality_score=0,
                specific_fixes=[reason_str],
            )
        return evaluate_github(data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except GithubException as exc:
        logger.error("GitHub service exception for user %s: %s", username, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GitHub service error: {exc}",
        ) from exc
    except Exception as exc:
        logger.error("Unexpected GitHub evaluation error for user %s: %s", username, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GitHub evaluation failed: {exc}",
        ) from exc


@app.post("/review/leetcode", response_model=LeetCodeReview)
@app.get("/review/leetcode/{username}", response_model=LeetCodeReview)
def review_leetcode(
    username: str,
    _auth: Annotated[str, Depends(verify_service_token)] = "authorized",
) -> LeetCodeReview:
    """Fetch LeetCode solved counts and contest rating. Defaults to 0 score without throwing 500."""
    try:
        stats = fetch_leetcode_stats(username)
        return LeetCodeReview(**stats)
    except Exception as exc:
        logger.warning("Error in review_leetcode endpoint for '%s': %s", username, exc)
        return LeetCodeReview(username=username, exists=False, score=0, error="Link invalid or service unreachable")


async def _evaluate_resume_pillar(
    resume: UploadFile | None,
) -> tuple[ReviewResult, str | None, str]:
    """Evaluates resume pillar with graceful degradation.
    Returns (ReviewResult, error_message, extracted_text).
    """
    if resume is None or not getattr(resume, "filename", None):
        logger.warning("No resume file supplied or resume path is missing. Returning 0 score for resume pillar.")
        return (
            ReviewResult(
                score=0,
                page_count=0,
                is_one_page=False,
                is_ats_friendly=False,
                uses_action_verbs=False,
                has_spelling_or_grammar_issues=False,
                has_clean_visual_layout=False,
                specific_fixes=["No resume document uploaded. Upload a PDF or DOCX resume to evaluate your resume score."],
            ),
            "No resume document provided.",
            "",
        )

    try:
        extracted = await extract_pdf_text(resume)
        text = extracted.text
        if not text.strip():
            logger.warning("Resume file is empty. Assigning score 0 for resume pillar.")
            return (
                ReviewResult(
                    score=0,
                    page_count=extracted.page_count,
                    is_one_page=extracted.page_count == 1,
                    is_ats_friendly=False,
                    uses_action_verbs=False,
                    has_spelling_or_grammar_issues=False,
                    has_clean_visual_layout=False,
                    specific_fixes=["Resume document is empty or unreadable. Please upload a valid text-based PDF or DOCX."],
                ),
                "Resume document is empty or unreadable.",
                "",
            )

        review = await asyncio.to_thread(
            evaluate_text,
            extracted.text,
            extracted.page_count,
            layout_geometry=extracted.layout_geometry,
        )
        return review, None, extracted.text

    except HTTPException as exc:
        err = str(exc.detail)
        logger.warning("Resume document extraction failed: %s", err)
        return (
            ReviewResult(
                score=0,
                page_count=1,
                is_one_page=True,
                is_ats_friendly=False,
                uses_action_verbs=False,
                has_spelling_or_grammar_issues=False,
                has_clean_visual_layout=False,
                specific_fixes=[f"Resume could not be fully parsed: {err}"],
            ),
            err,
            "",
        )
    except Exception as exc:
        logger.error("Unexpected resume analysis error: %s", exc, exc_info=True)
        err = f"Link invalid or service unreachable: {exc}"
        return (
            ReviewResult(
                score=0,
                page_count=1,
                is_one_page=True,
                is_ats_friendly=False,
                uses_action_verbs=False,
                has_spelling_or_grammar_issues=False,
                has_clean_visual_layout=False,
                specific_fixes=["Link invalid or service unreachable: Resume analysis encountered an issue."],
            ),
            err,
            "",
        )


async def _evaluate_github_pillar(
    github_username: str,
    force_refresh: bool,
) -> tuple[GithubReview | None, str | None]:
    """Evaluates GitHub pillar concurrently with graceful degradation."""
    clean_username = (github_username or "").strip()
    if not clean_username:
        return None, None

    try:
        github_data = await asyncio.to_thread(fetch_github_data, clean_username, force_refresh=force_refresh)
        if "reason" in github_data and github_data.get("score") == 0 and not github_data.get("repositories"):
            reason_msg = str(github_data.get("reason", "Link invalid or service unreachable"))
            return (
                GithubReview(
                    score=0,
                    has_pinned_repos=False,
                    has_recent_commit_activity=False,
                    has_committed_secrets=False,
                    has_unit_tests=False,
                    has_ci_cd=False,
                    has_architecture_diagrams=False,
                    code_quality_score=0,
                    specific_fixes=[reason_msg],
                ),
                reason_msg,
            )
        review = await asyncio.to_thread(evaluate_github, github_data)
        return review, None
    except Exception as exc:
        logger.warning("GitHub evaluation error for user %s: %s", clean_username, exc)
        return (
            GithubReview(
                score=0,
                has_pinned_repos=False,
                has_recent_commit_activity=False,
                has_committed_secrets=False,
                has_unit_tests=False,
                has_ci_cd=False,
                has_architecture_diagrams=False,
                code_quality_score=0,
                specific_fixes=["Link invalid or service unreachable: GitHub profile not found or could not be verified."],
            ),
            "Link invalid or service unreachable",
        )


async def _evaluate_leetcode_pillar(
    leetcode_url: str | None,
) -> tuple[LeetCodeReview | None, str | None]:
    """Evaluates LeetCode pillar concurrently with graceful degradation."""
    clean_url = (leetcode_url or "").strip()
    if not clean_url:
        return None, None

    try:
        stats = await asyncio.to_thread(fetch_leetcode_stats, clean_url)
        review = LeetCodeReview(**stats)
        error = None
        if not stats.get("exists") or stats.get("error"):
            error = stats.get("error") or "Link invalid or service unreachable"
        return review, error
    except Exception as exc:
        logger.warning("LeetCode fetch error for %s: %s", clean_url, exc)
        return (
            LeetCodeReview(
                username=clean_url,
                exists=False,
                score=0,
                error="Link invalid or service unreachable",
            ),
            "Link invalid or service unreachable",
        )


async def _evaluate_linkedin_pillar(
    linkedin_pdf: UploadFile | None,
    resume_context: str = "",
) -> tuple[LinkedInReviewResult | None, str | None]:
    """Evaluates LinkedIn pillar concurrently with graceful degradation."""
    if linkedin_pdf is None or not getattr(linkedin_pdf, "filename", None):
        return None, None

    try:
        extracted = await extract_pdf_text(linkedin_pdf)
        review = await asyncio.to_thread(
            evaluate_linkedin_text,
            extracted.text,
            resume_context=resume_context,
        )
        return review, None
    except HTTPException as exc:
        err = str(exc.detail)
        logger.warning("LinkedIn document analysis failed: %s", err)
        return None, err
    except Exception as exc:
        logger.error("Unexpected LinkedIn analysis error: %s", exc, exc_info=True)
        return None, "Link invalid or service unreachable"


@app.post("/analyze", response_model=AnalyzeProfileResponse, include_in_schema=False)
@app.post("/analyze-profile", response_model=AnalyzeProfileResponse)
async def analyze_profile(
    resume: Annotated[UploadFile | None, File()] = None,
    resume_path: Annotated[str | None, Form()] = None,
    github_username: Annotated[str | None, Form()] = "",
    linkedin_pdf: Annotated[UploadFile | None, File()] = None,
    leetcode_url: Annotated[str | None, Form()] = None,
    force_refresh: Annotated[bool, Form()] = False,
    _auth: Annotated[str, Depends(verify_service_token)] = "authorized",
) -> AnalyzeProfileResponse:
    """Bulletproof combined profile analyzer executing all pillars concurrently."""
    if force_refresh:
        logger.info("Forced profile refresh requested; bypassing all persisted analysis results.")

    try:
        clean_github = (github_username or "").strip()
        clean_leetcode = (leetcode_url or "").strip()

        # If resume is provided, parse text quickly so LinkedIn can use it for cross-check context
        resume_context = ""
        pre_extracted_resume: ExtractedPdf | None = None
        pre_resume_error: str | None = None
        if resume is not None and getattr(resume, "filename", None):
            try:
                pre_extracted_resume = await extract_pdf_text(resume)
                resume_context = pre_extracted_resume.text
            except HTTPException as exc:
                pre_resume_error = str(exc.detail)
            except Exception as exc:
                pre_resume_error = f"Link invalid or service unreachable: {exc}"

        async def _run_resume() -> tuple[ReviewResult, str | None, str]:
            if pre_resume_error is not None:
                return (
                    ReviewResult(
                        score=0,
                        page_count=1,
                        is_one_page=True,
                        is_ats_friendly=False,
                        uses_action_verbs=False,
                        has_spelling_or_grammar_issues=False,
                        has_clean_visual_layout=False,
                        specific_fixes=[f"Resume could not be fully parsed: {pre_resume_error}"],
                    ),
                    pre_resume_error,
                    "",
                )
            if pre_extracted_resume is not None:
                if not pre_extracted_resume.text.strip():
                    return (
                        ReviewResult(
                            score=0,
                            page_count=pre_extracted_resume.page_count,
                            is_one_page=pre_extracted_resume.page_count == 1,
                            is_ats_friendly=False,
                            uses_action_verbs=False,
                            has_spelling_or_grammar_issues=False,
                            has_clean_visual_layout=False,
                            specific_fixes=["Resume document is empty or unreadable. Please upload a valid text-based PDF or DOCX."],
                        ),
                        "Resume document is empty or unreadable.",
                        "",
                    )
                review = await asyncio.to_thread(
                    evaluate_text,
                    pre_extracted_resume.text,
                    pre_extracted_resume.page_count,
                    layout_geometry=pre_extracted_resume.layout_geometry,
                )
                return review, None, pre_extracted_resume.text
            return await _evaluate_resume_pillar(resume)

        # Run independent pillars in parallel
        results = await asyncio.gather(
            _run_resume(),
            _evaluate_github_pillar(clean_github, force_refresh),
            _evaluate_leetcode_pillar(clean_leetcode),
            _evaluate_linkedin_pillar(linkedin_pdf, resume_context=resume_context),
            return_exceptions=True,
        )

        # 1. Unpack Resume
        resume_res = results[0]
        if isinstance(resume_res, Exception):
            logger.error("Resume analysis crashed with exception: %s", resume_res, exc_info=True)
            resume_error = f"Link invalid or service unreachable: {resume_res}"
            resume_review = ReviewResult(
                score=0,
                page_count=1,
                is_one_page=True,
                is_ats_friendly=False,
                uses_action_verbs=False,
                has_spelling_or_grammar_issues=False,
                has_clean_visual_layout=False,
                specific_fixes=[resume_error],
            )
        else:
            resume_review, resume_error, _ = resume_res

        # 2. Unpack GitHub
        github_res = results[1]
        if isinstance(github_res, Exception):
            logger.error("GitHub analysis crashed with exception: %s", github_res, exc_info=True)
            github_error = "Link invalid or service unreachable"
            github_review = GithubReview(
                score=0,
                has_pinned_repos=False,
                has_recent_commit_activity=False,
                has_committed_secrets=False,
                has_unit_tests=False,
                has_ci_cd=False,
                has_architecture_diagrams=False,
                code_quality_score=0,
                specific_fixes=["Link invalid or service unreachable: GitHub profile not found or could not be verified."],
            )
        else:
            github_review, github_error = github_res

        # 3. Unpack LeetCode
        leetcode_res = results[2]
        if isinstance(leetcode_res, Exception):
            logger.error("LeetCode analysis crashed with exception: %s", leetcode_res, exc_info=True)
            leetcode_error = "Link invalid or service unreachable"
            leetcode_review = LeetCodeReview(
                username=clean_leetcode,
                exists=False,
                score=0,
                error="Link invalid or service unreachable",
            )
        else:
            leetcode_review, leetcode_error = leetcode_res

        # 4. Unpack LinkedIn
        linkedin_res = results[3]
        if isinstance(linkedin_res, Exception):
            logger.error("LinkedIn analysis crashed with exception: %s", linkedin_res, exc_info=True)
            linkedin_error = "Link invalid or service unreachable"
            linkedin_review = None
        else:
            linkedin_review, linkedin_error = linkedin_res

        # Subtotal calculation over available document reviews
        scores = [resume_review.score]
        if github_review is not None:
            scores.append(github_review.score)
        if linkedin_review is not None:
            scores.append(linkedin_review.score)
        if leetcode_review is not None:
            scores.append(leetcode_review.score)

        subtotal_score = round(sum(scores) / len(scores), 2) if scores else 0.0

        return AnalyzeProfileResponse(
            resume_review=resume_review,
            github_review=github_review,
            linkedin_review=linkedin_review,
            leetcode_review=leetcode_review,
            document_review_subtotal=subtotal_score,
            total_readiness_score=subtotal_score,
            resume_error=resume_error,
            github_error=github_error,
            linkedin_error=linkedin_error,
            leetcode_error=leetcode_error,
        )

    except Exception as fatal_exc:
        logger.error("Fatal error in analyze_profile: %s", fatal_exc, exc_info=True)
        fallback_resume = ReviewResult(
            score=0,
            page_count=1,
            is_one_page=True,
            is_ats_friendly=False,
            uses_action_verbs=False,
            has_spelling_or_grammar_issues=False,
            has_clean_visual_layout=False,
            specific_fixes=[f"Analysis degraded gracefully: {fatal_exc}"],
        )
        return AnalyzeProfileResponse(
            resume_review=fallback_resume,
            github_review=None,
            linkedin_review=None,
            leetcode_review=None,
            document_review_subtotal=0.0,
            total_readiness_score=0.0,
            resume_error=str(fatal_exc),
            github_error=None,
            linkedin_error=None,
            leetcode_error=None,
        )
