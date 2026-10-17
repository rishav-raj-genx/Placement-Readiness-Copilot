from typing import Annotated

import pymupdf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
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


def _validate_pdf_upload(file: UploadFile, pdf_bytes: bytes) -> None:
    filename = (file.filename or "").lower()
    is_pdf_type = file.content_type in {"application/pdf", "application/octet-stream"}
    if not filename.endswith(".pdf") or not is_pdf_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a PDF file with the application/pdf content type.",
        )
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="The uploaded PDF is empty.")
    if len(pdf_bytes) > MAX_PDF_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="The uploaded PDF exceeds the 10 MB limit.")


async def extract_pdf_text(file: UploadFile) -> ExtractedPdf:
    pdf_bytes = await file.read()
    _validate_pdf_upload(file, pdf_bytes)
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
        return ExtractedPdf(
            text="\n".join(page.get_text("text") for page in document),
            page_count=document.page_count,
        )
    finally:
        document.close()


@app.post("/extract-pdf", response_model=ExtractedPdf)
async def extract_pdf(file: Annotated[UploadFile, File()]) -> ExtractedPdf:
    return await extract_pdf_text(file)


@app.post("/review-resume", response_model=ReviewResult, include_in_schema=False)
@app.post("/review/resume", response_model=ReviewResult)
async def review_resume(file: Annotated[UploadFile, File()]) -> ReviewResult:
    extracted = await extract_pdf_text(file)
    return evaluate_text(extracted.text, extracted.page_count)


@app.post("/analyze-profile", response_model=AnalyzeProfileResponse)
async def analyze_profile(
    github_username: Annotated[str, Form()],
    resume: Annotated[UploadFile, File()],
    linkedin_pdf: Annotated[UploadFile | None, File()] = None,
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
