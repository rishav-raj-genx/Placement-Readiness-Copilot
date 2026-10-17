"""Prompt construction and strict parsing for final interview scoring."""

from __future__ import annotations

import json

from scoring.schemas import InterviewContext, InterviewResult, TranscriptTurn

SCORING_SYSTEM_PROMPT = """You score a mock job interview.
Return only valid JSON matching this shape:
{
  "interview_score": number 0-100,
  "summary": string,
  "strengths": [string],
  "improvement_areas": [string],
  "dimensions": {
    "communication": {"score": integer 0-100, "feedback": string, "strengths": [string], "improvement_areas": [string]},
    "technical_depth": {"score": integer 0-100, "feedback": string, "strengths": [string], "improvement_areas": [string]},
    "behavioral": {"score": integer 0-100, "feedback": string, "strengths": [string], "improvement_areas": [string]}
  }
}
Both top-level arrays, strengths and improvement_areas, must contain at least
one evidence-based item. Include all three dimensions. Do not invent facts not
present in the resume or transcript."""


def build_scoring_prompt(context: InterviewContext, transcript: list[TranscriptTurn]) -> str:
    """Build a bounded prompt from validated internal models."""

    resume = context.model_dump_json(exclude={"contract_version"})
    turns = json.dumps(
        [turn.model_dump(exclude_none=True) for turn in transcript],
        ensure_ascii=True,
    )
    return (
        f"Resume context:\n{resume}\n\n"
        f"Interview transcript:\n{turns}\n\n"
        "Score the candidate fairly and return JSON only."
    )


def parse_scoring_result(payload: object, transcript: list[TranscriptTurn]) -> InterviewResult:
    """Validate an LLM payload at the external-service boundary."""

    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise ValueError("scoring provider returned non-JSON output") from exc
    if not isinstance(payload, dict):
        raise TypeError("scoring provider returned a JSON object")
    payload = dict(payload)
    if "dimensions" not in payload and "dimension_scores" in payload:
        payload["dimensions"] = payload.pop("dimension_scores")
    payload["transcript"] = transcript
    return InterviewResult.model_validate(payload)
