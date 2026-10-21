import asyncio
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
    get_backend_status,
)
from github_service import fetch_github_data

MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024

app = FastAPI(
    title="MSOT Profile Review Engine",
    version="1.0.0",
)


class ExtractedPdf(BaseModel):
    text: str
    page_count: int = Field(ge=1)
    is_truncated: bool = False


class AnalyzeProfileResponse(BaseModel):
    resume_review: ReviewResult
    github_review: GithubReview | None = None
    linkedin_review: LinkedInReviewResult | None = None
    document_review_subtotal: float = Field(ge=0, le=100)
    total_readiness_score: float = Field(ge=0, le=100)
    github_error: str | None = None


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
    if not filename.endswith(".pdf") or not is_pdf_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a PDF file with the application/pdf content type.",
        )


def is_e2e_mode() -> bool:
    val = os.getenv("E2E_MODE", "").lower().strip()
    return val in {"1", "true", "yes"}


def verify_service_token(authorization: Annotated[str | None, Header()] = None) -> str:
    """Verify service-to-service Bearer authentication. Fails closed when secret is unconfigured."""
    if is_e2e_mode():
        return "authorized"

    expected_key = os.getenv("PROFILE_REVIEW_SERVICE_TOKEN") or os.getenv("INTERNAL_SERVICE_KEY")
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Service authentication secret is not configured on the server.",
        )

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    if token != expected_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid service token.",
        )
    return token


CHUNK_SIZE_BYTES = 64 * 1024


def _parse_pdf_bytes_sync(pdf_bytes: bytes) -> tuple[str, int, bool]:
    """CPU-bound PDF text extraction run inside a thread pool."""
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
        extracted_text = "\n".join(page.get_text("text") for page in document)
        is_truncated = False
        if len(extracted_text) > 100_000:
            extracted_text = extracted_text[:100_000]
            is_truncated = True

        return extracted_text, document.page_count, is_truncated
    finally:
        document.close()


async def extract_pdf_text(file: UploadFile) -> ExtractedPdf:
    _validate_pdf_headers(file)

    # Ingress check: reject oversize headers before buffering
    if file.size and file.size > MAX_PDF_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="The uploaded PDF exceeds the 10 MB limit.")

    chunks: list[bytes] = []
    total_bytes = 0
    while chunk := await file.read(CHUNK_SIZE_BYTES):
        total_bytes += len(chunk)
        if total_bytes > MAX_PDF_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="The uploaded PDF exceeds the 10 MB limit.")
        chunks.append(chunk)

    if not total_bytes:
        raise HTTPException(status_code=400, detail="The uploaded PDF is empty.")

    pdf_bytes = b"".join(chunks)

    # Run synchronous PyMuPDF parsing in worker thread to prevent event loop blocking
    extracted_text, page_count, is_truncated = await asyncio.to_thread(_parse_pdf_bytes_sync, pdf_bytes)

    return ExtractedPdf(
        text=extracted_text,
        page_count=page_count,
        is_truncated=is_truncated,
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
    return evaluate_text(extracted.text, extracted.page_count)


@app.post("/analyze-profile", response_model=AnalyzeProfileResponse)
async def analyze_profile(
    github_username: Annotated[str, Form()],
    resume: Annotated[UploadFile, File()],
    linkedin_pdf: Annotated[UploadFile | None, File()] = None,
    _auth: Annotated[str, Depends(verify_service_token)] = "authorized",
) -> AnalyzeProfileResponse:
    extracted_resume = await extract_pdf_text(resume)
    resume_review = evaluate_text(extracted_resume.text, extracted_resume.page_count)

    # Independent error isolation: GitHub failure does not abort the entire review
    github_review: GithubReview | None = None
    github_error: str | None = None
    if github_username.strip():
        try:
            github_data = fetch_github_data(github_username)
            github_review = evaluate_github(github_data)
        except ValueError as exc:
            github_error = str(exc)
        except GithubException as exc:
            logger.warning("GitHub profile fetch error for user %s: %s", github_username, exc)
            github_error = "Unable to fetch the GitHub profile."
        except Exception as exc:
            logger.error("Unexpected GitHub evaluation error: %s", exc, exc_info=True)
            github_error = "GitHub analysis temporarily unavailable."

    linkedin_review = None
    if linkedin_pdf is not None:
        extracted_linkedin = await extract_pdf_text(linkedin_pdf)
        linkedin_review = evaluate_linkedin_text(extracted_linkedin.text)

    # Subtotal calculation over available document reviews (does NOT replace composite readiness score)
    scores = [resume_review.score]
    if github_review is not None:
        scores.append(github_review.score)
    if linkedin_review is not None:
        scores.append(linkedin_review.score)

    subtotal_score = round(sum(scores) / len(scores), 2)

    return AnalyzeProfileResponse(
        resume_review=resume_review,
        github_review=github_review,
        linkedin_review=linkedin_review,
        document_review_subtotal=subtotal_score,
        total_readiness_score=subtotal_score,  # Alias for backward compatibility
        github_error=github_error,
    )
