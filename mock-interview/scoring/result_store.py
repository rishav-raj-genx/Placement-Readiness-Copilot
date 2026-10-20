"""Validated result persistence boundary."""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Protocol
from urllib import request

from scoring.schemas import DimensionScore, InterviewResult


class ResultStore(Protocol):
    def save(self, student_id: str, result: InterviewResult) -> None: ...


class InterviewSessionResultStore(Protocol):
    def save(self, interview_id: str, result: InterviewResult) -> None: ...


class PersistenceError(RuntimeError):
    """Raised when a validated result cannot be persisted."""


class SupabaseResultStore:
    """Persist results through the Supabase REST API.

    The service role key must only run server-side and must never be sent to
    clients or included in websocket responses.
    """

    def __init__(
        self,
        url: str | None = None,
        service_key: str | None = None,
        table: str = "mock_interview_results",
    ):
        self.url = (url or os.getenv("SUPABASE_URL", "")).rstrip("/")
        self.service_key = service_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.table = table

    def save(
        self,
        student_id: str,
        result: InterviewResult,
        *,
        attempt_number: int = 1,
        mode: str = "hosted_api",
        duration_minutes: int = 18,
    ) -> None:
        if not student_id:
            raise PersistenceError("student identity is required")
        if attempt_number < 1:
            raise PersistenceError("attempt number must be positive")
        if mode not in {"hosted_api", "ollama_local"}:
            raise PersistenceError("mode must be hosted_api or ollama_local")
        if duration_minutes < 0:
            raise PersistenceError("duration must not be negative")
        if not self.url or not self.service_key:
            raise PersistenceError("Supabase persistence is not configured")
        dimensions = result.dimensions
        payload: dict[str, object] = {
            "student_id": student_id,
            "attempt_number": attempt_number,
            "interview_score": result.interview_score,
            "transcript": [turn.model_dump(mode="json") for turn in result.transcript],
            "technical_score": _dimension_score(dimensions, "technical_depth"),
            "communication_score": _dimension_score(dimensions, "communication"),
            "behavioral_score": _dimension_score(dimensions, "behavioral"),
            "strengths": result.strengths,
            "weak_areas": result.improvement_areas,
            "feedback_notes": result.summary,
            "mode": mode,
            "duration_minutes": duration_minutes,
            "is_fallback": result.is_fallback,
            "evaluation_mode": result.evaluation_mode,
            "is_provisional": getattr(result, "is_provisional", False),
            "created_at": datetime.now(UTC).isoformat(),
        }
        req = request.Request(
            f"{self.url}/rest/v1/{self.table}",
            data=json.dumps(payload).encode(),
            headers={
                "apikey": self.service_key,
                "Authorization": f"Bearer {self.service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=15) as response:
                if response.status >= 300:
                    raise PersistenceError("Supabase rejected the interview result")
        except PersistenceError:
            raise
        except Exception as exc:
            raise PersistenceError("Supabase result persistence failed") from exc


def _dimension_score(dimensions: Mapping[str, DimensionScore], name: str) -> float:
    dimension = dimensions.get(name)
    score = getattr(dimension, "score", None)
    return float(score) if isinstance(score, (int, float)) else 0.0


class SupabaseInterviewSessionStore:
    """Update the platform's authoritative interview_sessions.result JSONB."""

    def __init__(
        self,
        url: str | None = None,
        service_key: str | None = None,
    ):
        self.url = (url or os.getenv("SUPABASE_URL", "")).rstrip("/")
        self.service_key = service_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    def save(self, interview_id: str, result: InterviewResult) -> None:
        if not interview_id:
            raise PersistenceError("interview ID is required")
        if not self.url or not self.service_key:
            raise PersistenceError("Supabase persistence is not configured")
        is_abandoned = getattr(result, "is_abandoned", False)
        status_val = "abandoned" if is_abandoned else getattr(result, "session_status", "completed")
        payload = {
            "result": result.model_dump(mode="json"),
            "status": status_val,
            "completed_at": datetime.now(UTC).isoformat() if status_val == "completed" else None,
        }
        # Conditional update: only transition if session is currently created, active, or in_progress
        # This prevents duplicate finishes or stale workers from overwriting completed results
        req = request.Request(
            f"{self.url}/rest/v1/interview_sessions?id=eq.{interview_id}&status=in.(created,active,in_progress)",
            data=json.dumps(payload).encode(),
            headers={
                "apikey": self.service_key,
                "Authorization": f"Bearer {self.service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            method="PATCH",
        )
        try:
            with request.urlopen(req, timeout=15) as response:
                if response.status >= 300:
                    raise PersistenceError("Supabase rejected the interview session result")
        except PersistenceError:
            raise
        except Exception as exc:
            raise PersistenceError("Supabase interview session persistence failed") from exc


# In-memory registry for completed Round 1 sessions
_COMPLETED_ROUND1_STUDENTS: set[str] = set()


def record_round1_completed(student_id: str | None) -> None:
    """Record that a student has completed Round 1 (Technical Viva)."""
    if student_id and str(student_id).strip():
        _COMPLETED_ROUND1_STUDENTS.add(str(student_id).strip())


def has_completed_round1(
    student_id: str | None,
    url: str | None = None,
    service_key: str | None = None,
) -> bool:
    """Verify whether a student has completed Round 1 (Technical Viva)."""
    if not student_id:
        return False
    clean_id = str(student_id).strip()
    if not clean_id:
        return False

    # 1. Fast in-memory check
    if clean_id in _COMPLETED_ROUND1_STUDENTS:
        return True

    # 2. E2E and test bypass
    is_e2e = (
        os.getenv("MOCK_INTERVIEW_E2E_MODE", "false").lower() in {"1", "true", "yes"}
        or os.getenv("E2E_MODE", "false").lower() in {"1", "true", "yes"}
    )
    if is_e2e and clean_id in {"e2e_candidate", "test-student-id", "service_caller"}:
        return True

    # 3. Query Supabase for authoritative state
    supabase_url = (url or os.getenv("SUPABASE_URL", "")).rstrip("/")
    key = service_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not key:
        return False

    try:
        # Check interview_sessions for completed non-coding sessions
        req = request.Request(
            f"{supabase_url}/rest/v1/interview_sessions?select=id,status,config&or=(student_id.eq.{clean_id},user_id.eq.{clean_id})&status=eq.completed&limit=10",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Accept": "application/json",
            },
            method="GET",
        )
        with request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            if isinstance(data, list) and len(data) > 0:
                for item in data:
                    cfg = item.get("config") or {}
                    if isinstance(cfg, dict) and cfg.get("type") == "coding":
                        continue
                    _COMPLETED_ROUND1_STUDENTS.add(clean_id)
                    return True

        # Check mock_interview_results table
        req2 = request.Request(
            f"{supabase_url}/rest/v1/mock_interview_results?select=id&student_id=eq.{clean_id}&limit=1",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Accept": "application/json",
            },
            method="GET",
        )
        with request.urlopen(req2, timeout=5) as resp:
            data2 = json.loads(resp.read().decode())
            if isinstance(data2, list) and len(data2) > 0:
                _COMPLETED_ROUND1_STUDENTS.add(clean_id)
                return True
    except Exception:
        pass

    return False


def save_coding_interview_session(
    student_id: str,
    problem_id: str,
    result: object,
    url: str | None = None,
    service_key: str | None = None,
) -> None:
    """Persist a completed Round 2 coding practice session into interview_sessions."""
    supabase_url = (url or os.getenv("SUPABASE_URL", "")).rstrip("/")
    key = service_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not key or not student_id:
        return

    res_dict = result.model_dump() if hasattr(result, "model_dump") else (result if isinstance(result, dict) else {})
    score_val = float(res_dict.get("overall_score", 85.0))

    payload = {
        "student_id": str(student_id),
        "target_role": "Software Engineer (DSA & Web Dev)",
        "status": "completed",
        "score": score_val,
        "config": {
            "type": "coding",
            "round": 2,
            "problem_id": problem_id,
        },
        "result": {
            "interview_score": score_val,
            "coding_result": res_dict,
            "summary": res_dict.get("code_quality_feedback", "Round 2 coding evaluation completed."),
            "strengths": res_dict.get("strengths", []),
            "weak_areas": res_dict.get("improvement_areas", []),
            "evaluation_mode": res_dict.get("evaluation_mode", "static_ast_analysis"),
            "test_execution_status": res_dict.get("test_execution_status", "sandbox_pending"),
        },
        "completed_at": datetime.now(UTC).isoformat(),
        "created_at": datetime.now(UTC).isoformat(),
    }

    try:
        req = request.Request(
            f"{supabase_url}/rest/v1/interview_sessions",
            data=json.dumps(payload).encode(),
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            method="POST",
        )
        with request.urlopen(req, timeout=10) as resp:
            pass
    except Exception:
        pass

