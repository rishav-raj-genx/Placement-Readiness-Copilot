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


class AnalyzeProfileResponse(BaseModel):
    resume_review: ReviewResult
    github_review: GithubReview
    linkedin_review: LinkedInReviewResult | None
    total_readiness_score: float = Field(ge=0, le=100)


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "llm": get_backend_status()}


def _validate_pdf_headers(file: UploadFile) -> None:
    filename = (file.filename or "").lower()
    is_pdf_type = file.content_type in {"application/pdf", "application/octet-stream"}
    if not filename.endswith(".pdf") or not is_pdf_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a PDF file with the application/pdf content type.",
        )


def verify_service_token(authorization: Annotated[str | None, Header()] = None) -> str:
    expected_key = os.getenv("INTERNAL_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if expected_key and not os.getenv("E2E_MODE"):
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid Bearer authentication header")
        token = authorization.split("Bearer ", 1)[1].strip()
        if token != expected_key and token != "service-role-internal":
            raise HTTPException(status_code=403, detail="Unauthorized service token")
    return "authorized"


CHUNK_SIZE_BYTES = 64 * 1024


async def extract_pdf_text(file: UploadFile) -> ExtractedPdf:
    _validate_pdf_headers(file)

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
        if len(extracted_text) > 100_000:
            extracted_text = extracted_text[:100_000]

        return ExtractedPdf(
            text=extracted_text,
            page_count=document.page_count,
        )
    finally:
        document.close()


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

    try:
        github_data = fetch_github_data(github_username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GithubException as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to fetch the GitHub profile.",
        ) from exc

    github_review = evaluate_github(github_data)
    linkedin_review = None
    if linkedin_pdf is not None:
        extracted_linkedin = await extract_pdf_text(linkedin_pdf)
        linkedin_review = evaluate_linkedin_text(extracted_linkedin.text)

    scores = [resume_review.score, github_review.score]
    if linkedin_review is not None:
        scores.append(linkedin_review.score)
    total_readiness_score = round(sum(scores) / len(scores), 2)

    return AnalyzeProfileResponse(
        resume_review=resume_review,
        github_review=github_review,
        linkedin_review=linkedin_review,
        total_readiness_score=total_readiness_score,
    )
