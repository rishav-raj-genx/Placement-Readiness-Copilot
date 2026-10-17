# MSOT Profile Review Engine

FastAPI service for deterministic PDF extraction and AI-assisted resume,
LinkedIn, and GitHub reviews.

## Setup

```bash
uv sync --dev
uv run uvicorn main:app --reload --port 8000
```

## LLM provider selection

Set `LLM_PROVIDER` to `groq`, `openai`, `ollama`, `auto`, or `static`.
API modes fall back to Ollama by default; disable this only with
`OLLAMA_FALLBACK=false`. Configure local inference with `OLLAMA_MODEL` and
`OLLAMA_BASE_URL`.

## Resume review

```bash
curl -F 'file=@resume.pdf;type=application/pdf' http://127.0.0.1:8000/review/resume
```

The endpoint extracts text with PyMuPDF and returns the verified PDF page count,
ATS compatibility, action-verb usage, spelling/grammar issues, score, and fixes.

## Tests

```bash
uv run pytest -q -s
```
