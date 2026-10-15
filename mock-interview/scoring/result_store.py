"""Validated result persistence boundary."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Protocol
from urllib import request

from scoring.schemas import InterviewResult


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
        url: Optional[str] = None,
        service_key: Optional[str] = None,
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
        duration_minutes: int = 30,
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
        payload: Dict[str, Any] = {
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
            "created_at": datetime.now(timezone.utc).isoformat(),
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


def _dimension_score(dimensions: Dict[str, Any], name: str) -> float:
    dimension = dimensions.get(name)
    return float(dimension.score) if dimension is not None else 0.0


class SupabaseInterviewSessionStore:
    """Update the platform's authoritative interview_sessions.result JSONB."""

    def __init__(
        self,
        url: Optional[str] = None,
        service_key: Optional[str] = None,
    ):
        self.url = (url or os.getenv("SUPABASE_URL", "")).rstrip("/")
        self.service_key = service_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    def save(self, interview_id: str, result: InterviewResult) -> None:
        if not interview_id:
            raise PersistenceError("interview ID is required")
        if not self.url or not self.service_key:
            raise PersistenceError("Supabase persistence is not configured")
        payload = {
            "result": result.model_dump(mode="json"),
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        req = request.Request(
            f"{self.url}/rest/v1/interview_sessions?id=eq.{interview_id}",
            data=json.dumps(payload).encode(),
            headers={
                "apikey": self.service_key,
                "Authorization": f"Bearer {self.service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
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
