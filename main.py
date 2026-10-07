import fitz
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from github import GithubException
from pydantic import BaseModel, Field

from ai_reviewer import (
    GithubReview,
    LinkedInReviewResult,
    ReviewResult,
    evaluate_github,
    evaluate_linkedin_text,
    evaluate_text,
)
from github_service import fetch_github_data


app = FastAPI()


class AnalyzeProfileResponse(BaseModel):
    resume_review: ReviewResult
    github_review: GithubReview
    linkedin_review: LinkedInReviewResult | None
    total_readiness_score: float = Field(ge=0, le=100)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)) -> dict[str, str]:
    text = await extract_pdf_text(file)
    return {"text": text}


async def extract_pdf_text(file: UploadFile) -> str:
    pdf_bytes = await file.read()
    try:
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
    except fitz.FileDataError as exc:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.") from exc

    try:
        return "".join(page.get_text() for page in document)
    finally:
        document.close()


@app.post("/review-resume", response_model=ReviewResult)
async def review_resume(file: UploadFile = File(...)) -> ReviewResult:
    text = await extract_pdf_text(file)
    return evaluate_text(text)


@app.post("/analyze-profile", response_model=AnalyzeProfileResponse)
async def analyze_profile(
    github_username: str = Form(...),
    resume: UploadFile = File(...),
    linkedin_pdf: UploadFile | None = File(None),
) -> AnalyzeProfileResponse:
    resume_text = await extract_pdf_text(resume)
    resume_review = evaluate_text(resume_text)

    try:
        github_data = fetch_github_data(github_username)
    except GithubException as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to fetch the GitHub profile.",
        ) from exc

    github_review = evaluate_github(github_data)
    linkedin_review = None
    if linkedin_pdf is not None:
        linkedin_text = await extract_pdf_text(linkedin_pdf)
        linkedin_review = evaluate_linkedin_text(linkedin_text)

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
