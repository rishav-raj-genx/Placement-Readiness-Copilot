import fitz
from fastapi import FastAPI, File, HTTPException, UploadFile

from ai_reviewer import ReviewResult, evaluate_text


app = FastAPI()


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
