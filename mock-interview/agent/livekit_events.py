"""Namespaced LiveKit data-channel event serialization."""

from __future__ import annotations

import json
import time

from scoring.schemas import InterviewResult


def greeting_event(
    text: str,
    interview_id: str | None = None,
    target_role: str | None = None,
    company: str | None = None,
    threshold_score: int | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {"message": text}
    if interview_id is not None:
        payload["interviewId"] = interview_id
    if target_role is not None:
        payload["targetRole"] = target_role
    if company is not None:
        payload["company"] = company
    if threshold_score is not None:
        payload["thresholdScore"] = threshold_score
    return {
        "event": "interview:greeting",
        "payload": payload,
    }


def question_event(
    text: str,
    question_index: int,
    total_questions: int = 6,
    category: str = "Technical interview",
    target_competencies: list[str] | None = None,
) -> dict[str, object]:
    return {
        "event": "interview:question",
        "payload": {
            "questionId": f"q_{question_index}",
            "text": text,
            "questionNumber": question_index,
            "totalQuestions": total_questions,
        },
    }


def transcript_event(
    text: str,
    speaker: str,
    is_final: bool = True,
) -> dict[str, object]:
    if speaker not in {"interviewer", "student"}:
        raise ValueError("speaker must be interviewer or student")
    return {
        "event": "interview:transcript",
        "payload": {
            "speaker": speaker,
            "text": text,
            "final": is_final,
            "timestamp": _timestamp(),
        },
    }


def error_event(code: str, message: str, recoverable: bool = True) -> dict[str, object]:
    return {
        "event": "interview:error",
        "payload": {
            "code": code,
            "message": message,
            "recoverable": recoverable,
            "timestamp": _timestamp(),
        },
    }


def results_event(result: InterviewResult) -> dict[str, object]:
    """Map the validated internal result to the frontend result event."""

    return {
        "event": "interview:results",
        "payload": {
            "overallReadinessDelta": 0,
            "finalScore": result.interview_score,
            "summary": result.summary,
            "isFallback": result.is_fallback,
            "evaluationMode": result.evaluation_mode,
            "rubricVersion": result.rubric_version,
            "isProvisional": getattr(result, "is_provisional", False) or result.is_fallback,
            "categoryScores": [
                {
                    "category": category,
                    "score": score.score,
                    "benchmark": 0,
                    "strengths": score.strengths,
                    "critiques": score.improvement_areas,
                    "evidence": getattr(score, "evidence", []),
                }
                for category, score in result.dimensions.items()
            ],
            "suggestedFixes": [
                {
                    "title": area,
                    "location": "mock-interview",
                    "recommendedChange": area,
                }
                for area in result.improvement_areas
            ],
            "timestamp": _timestamp(),
        },
    }


def finish_event() -> dict[str, object]:
    return {
        "event": "interview:finish",
        "payload": {"reason": "student_requested"},
    }


def encode_event(event: dict[str, object]) -> bytes:
    """Encode only structured event data for LiveKit publishData."""

    return json.dumps(event, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def _timestamp() -> int:
    return int(time.time() * 1000)
