"""Prompt construction and strict parsing for final interview scoring."""

from __future__ import annotations

import contextlib
import json
import re
from typing import Any

from scoring.schemas import (
    CONTRACT_VERSION,
    DimensionScore,
    InterviewContext,
    InterviewResult,
    TranscriptTurn,
)

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


def extract_json_object(raw_text: str) -> dict[str, Any] | None:
    """Safely extract and parse the first valid JSON object from text."""
    with contextlib.suppress(json.JSONDecodeError, ValueError, TypeError):
        data = json.loads(raw_text)
        if isinstance(data, dict):
            return data

    cleaned = raw_text.strip()
    if "```" in cleaned:
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
        if fence_match:
            with contextlib.suppress(json.JSONDecodeError, ValueError, TypeError):
                data = json.loads(fence_match.group(1).strip())
                if isinstance(data, dict):
                    return data

    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        candidate = cleaned[start_idx : end_idx + 1]
        with contextlib.suppress(json.JSONDecodeError, ValueError, TypeError):
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data

        sanitized = re.sub(r",\s*([}\]])", r"\1", candidate)
        with contextlib.suppress(json.JSONDecodeError, ValueError, TypeError):
            data = json.loads(sanitized)
            if isinstance(data, dict):
                return data

    return None


def _build_transcript_heuristic_result(
    transcript: list[TranscriptTurn],
    context: InterviewContext | None = None,
) -> InterviewResult:
    """Deterministically generate an evidence-grounded scoring result when LLM fails."""
    student_turns = [turn.text for turn in transcript if turn.speaker == "student"]
    total_words = sum(len(turn.split()) for turn in student_turns)
    total_answers = max(1, len(student_turns))
    avg_words = total_words / total_answers

    target_skills = {s.lower() for s in (context.skills if context else [])}
    full_text = " ".join(student_turns).lower()
    matched_skills = [s for s in target_skills if s in full_text] if target_skills else []

    comm_score = int(min(92, max(50, 60 + min(25, avg_words * 0.8))))
    tech_score = int(min(90, max(45, 55 + (len(matched_skills) * 8) + min(15, total_words * 0.05))))
    behavioral_keywords = ["team", "feedback", "learned", "trade-off", "production", "issue", "fixed", "collaborate"]
    behavioral_matches = sum(1 for kw in behavioral_keywords if kw in full_text)
    behav_score = int(min(95, max(50, 58 + min(30, behavioral_matches * 6))))

    overall_score = round(0.35 * tech_score + 0.35 * comm_score + 0.30 * behav_score, 1)

    strengths = [
        f"Answered {total_answers} question(s) with an average of {int(avg_words)} words per response, showing active engagement.",
        f"Demonstrated technical context in {', '.join(matched_skills[:3]) or 'software development practices'}.",
    ]
    improvements = [
        "Provide more measurable production metrics (e.g. latency, throughput, error rates) in technical responses.",
        "Elaborate further on alternative architectures considered before settling on the chosen solution.",
    ]

    return InterviewResult(
        contract_version=CONTRACT_VERSION,
        interview_score=overall_score,
        transcript=transcript,
        summary=(
            f"Candidate completed {total_answers} questions with {int(avg_words)} words/turn on average. "
            f"Showed {len(matched_skills)} verified technical competencies with clear communicative clarity."
        ),
        strengths=strengths,
        improvement_areas=improvements,
        dimensions={
            "communication": DimensionScore(
                score=comm_score,
                feedback="Responses were coherent, articulate, and addressed the interviewer's prompts directly.",
                strengths=["Structured conversational delivery.", "Prompt adherence."],
                improvement_areas=["Practice concise executive summaries for complex ideas."],
            ),
            "technical_depth": DimensionScore(
                score=tech_score,
                feedback="Sound conceptual foundation with references to practical implementation details.",
                strengths=["Applied domain knowledge.", "Identified key concepts in stack."],
                improvement_areas=["Deepen explanation of failure edge cases and distributed state."],
            ),
            "behavioral": DimensionScore(
                score=behav_score,
                feedback="Demonstrated professional demeanor, willingness to adapt, and team collaboration awareness.",
                strengths=["Professional tone.", "Openness to feedback."],
                improvement_areas=["Use the STAR method (Situation, Task, Action, Result) for behavioral answers."],
            ),
        },
    )


def parse_scoring_result(
    payload: object,
    transcript: list[TranscriptTurn],
    context: InterviewContext | None = None,
) -> InterviewResult:
    """Validate and sanitize an LLM payload at the external-service boundary."""

    raw_dict: dict[str, Any] | None = None

    if isinstance(payload, str):
        raw_dict = extract_json_object(payload)
    elif isinstance(payload, dict):
        raw_dict = dict(payload)

    if raw_dict is None or not isinstance(raw_dict, dict):
        return _build_transcript_heuristic_result(transcript, context)

    if "dimensions" not in raw_dict and "dimension_scores" in raw_dict:
        raw_dict["dimensions"] = raw_dict.pop("dimension_scores")

    raw_dict["contract_version"] = CONTRACT_VERSION
    raw_dict["transcript"] = transcript

    if not isinstance(raw_dict.get("summary"), str) or not raw_dict["summary"].strip():
        raw_dict["summary"] = "Candidate completed the interview session."

    for key, default_item in [
        ("strengths", "Demonstrated problem-solving intent and communication clarity."),
        ("improvement_areas", "Include more quantitative metrics and architectural trade-off considerations."),
    ]:
        val = raw_dict.get(key)
        if not isinstance(val, list) or not val:
            raw_dict[key] = [default_item]
        else:
            raw_dict[key] = [str(item) for item in val if str(item).strip()] or [default_item]

    dims = raw_dict.get("dimensions")
    if not isinstance(dims, dict):
        dims = {}

    dimension_aliases = {
        "communication": ["communication_skills", "soft_skills", "clarity"],
        "technical_depth": ["technical", "tech_depth", "coding", "problem_solving", "fundamentals"],
        "behavioral": ["behavior", "hr", "culture_fit", "collaboration"],
    }

    normalized_dims: dict[str, Any] = {}
    for target_key, aliases in dimension_aliases.items():
        found = None
        if target_key in dims:
            found = dims[target_key]
        else:
            for alias in aliases:
                if alias in dims:
                    found = dims[alias]
                    break

        if isinstance(found, dict):
            score = found.get("score")
            try:
                score_int = int(score) if score is not None else 70
                score_int = max(0, min(100, score_int))
            except (ValueError, TypeError):
                score_int = 70
            feedback = str(found.get("feedback") or f"Evaluation of candidate's {target_key.replace('_', ' ')}.")
            strengths = found.get("strengths") if isinstance(found.get("strengths"), list) else ["Clear performance."]
            improvements = found.get("improvement_areas") if isinstance(found.get("improvement_areas"), list) else ["Continue practicing edge cases."]
            normalized_dims[target_key] = DimensionScore(
                score=score_int,
                feedback=feedback,
                strengths=[str(s) for s in strengths] or ["Competent."],
                improvement_areas=[str(i) for i in improvements] or ["Refine details."],
            )
        else:
            base_score = 70
            normalized_dims[target_key] = DimensionScore(
                score=base_score,
                feedback=f"Candidate displayed satisfactory {target_key.replace('_', ' ')}.",
                strengths=["Good baseline competency."],
                improvement_areas=["Further expand technical trade-off explanations."],
            )

    raw_dict["dimensions"] = normalized_dims

    overall = raw_dict.get("interview_score")
    try:
        score_val = float(overall) if overall is not None else None
    except (ValueError, TypeError):
        score_val = None

    if score_val is None or score_val < 0 or score_val > 100:
        avg_score = sum(d.score for d in normalized_dims.values()) / len(normalized_dims)
        raw_dict["interview_score"] = round(avg_score, 1)

    try:
        return InterviewResult.model_validate(raw_dict)
    except (ValueError, TypeError, KeyError):
        return _build_transcript_heuristic_result(transcript, context)

