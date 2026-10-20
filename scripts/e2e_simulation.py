"""Repository-level HTTP/WebSocket simulation across all four services."""

from __future__ import annotations

import asyncio
import json
import os
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import httpx
from websockets.asyncio.client import ClientConnection, connect

ROOT_DIR = Path(__file__).resolve().parents[1]
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:3000")
PROFILE_URL = os.getenv("PROFILE_URL", "http://127.0.0.1:8001")
INTERVIEW_WS_URL = os.getenv("INTERVIEW_WS_URL", "ws://127.0.0.1:8002/ws/interview")
AUTOMATION_URL = os.getenv("AUTOMATION_URL", "http://127.0.0.1:8003")
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "e2e-internal-token")


async def request_json(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    **kwargs: object,
) -> dict[str, Any]:
    headers = dict(kwargs.pop("headers", None) or {})
    if "Authorization" not in headers:
        headers["Authorization"] = f"Bearer {INTERNAL_SERVICE_KEY}"
    response = await client.request(method, url, headers=headers, **kwargs)
    if not response.is_success:
        raise RuntimeError(
            f"API routing error: {method} {url} returned HTTP {response.status_code}: "
            f"{response.text[:500]}"
        )
    payload: object = response.json()
    if not isinstance(payload, dict):
        raise TypeError(f"API contract error: {method} {url} returned a non-object payload")
    return payload


async def receive_event(socket: ClientConnection, expected_event: str) -> dict[str, Any]:
    raw_message = await asyncio.wait_for(socket.recv(), timeout=15)
    if isinstance(raw_message, bytes):
        raw_message = raw_message.decode()
    payload: object = json.loads(raw_message)
    if not isinstance(payload, dict):
        raise TypeError("Interview websocket returned a non-object event")
    if payload.get("event") == "error":
        raise RuntimeError(f"Interview websocket error: {payload.get('message')}")
    if payload.get("event") != expected_event:
        raise RuntimeError(
            f"Interview routing error: expected {expected_event}, got {payload.get('event')}"
        )
    return payload


async def run_interview(resume_text: str, page_count: int) -> tuple[dict[str, Any], list[str]]:
    answers = [
        "I am a backend engineer focused on reliable services and measurable outcomes.",
        "I owned the FastAPI architecture and made database writes idempotent.",
        "I selected PostgreSQL transactions for consistency and measured the trade-offs.",
        "I used typed validation, retries, contract tests, and structured error handling.",
        "I reproduced duplicate writes, added idempotency keys, and load-tested the fix.",
        "I accepted feedback, simplified the API, and documented the final decision.",
    ]
    questions: list[str] = []

    async with connect(INTERVIEW_WS_URL, open_timeout=15, close_timeout=5) as socket:
        await socket.send(
            json.dumps(
                {
                    "event": "start",
                    "resume": {
                        "name": "E2E Candidate",
                        "target_role": "Backend Engineer",
                        "text": resume_text,
                        "page_count": page_count,
                        "skills": ["Python", "FastAPI", "PostgreSQL"],
                        "projects": [
                            "Placement Readiness Copilot - Built a typed FastAPI integration pipeline."
                        ],
                    },
                }
            )
        )
        await receive_event(socket, "greeting")
        first_question = await receive_event(socket, "question")
        questions.append(str(first_question.get("text", "")))

        for index, answer in enumerate(answers):
            await socket.send(json.dumps({"event": "answer", "text": answer}))
            if index < len(answers) - 1:
                question = await receive_event(socket, "question")
                questions.append(str(question.get("text", "")))
            else:
                await receive_event(socket, "ready_to_finish")

        await socket.send(json.dumps({"event": "finish"}))
        result_event = await receive_event(socket, "result")

    result = result_event.get("result")
    if not isinstance(result, dict):
        raise TypeError("Interview result is missing")
    if len(questions) != 6 or not any("Placement Readiness Copilot" in q for q in questions):
        raise RuntimeError("Interview questions were not grounded in the parsed resume")
    return result, questions


async def simulate() -> dict[str, Any]:
    resume_path = ROOT_DIR / "profile-review-api" / "test_resume.pdf"
    if not resume_path.exists():
        raise RuntimeError(f"Dummy resume is missing: {resume_path}")
    resume_bytes = resume_path.read_bytes()

    async with httpx.AsyncClient(timeout=30) as client:
        platform_health = await request_json(client, "GET", f"{FRONTEND_URL}/api/health")
        if platform_health.get("status") != "ok":
            raise RuntimeError(f"Frontend integration health is degraded: {platform_health}")

        upload = {"file": ("dummy-resume.pdf", resume_bytes, "application/pdf")}
        resume_review = await request_json(
            client,
            "POST",
            f"{PROFILE_URL}/review/resume",
            files=upload,
        )
        extracted_resume = await request_json(
            client,
            "POST",
            f"{PROFILE_URL}/extract-pdf",
            files={"file": ("dummy-resume.pdf", resume_bytes, "application/pdf")},
        )
        resume_text = extracted_resume.get("text")
        page_count = extracted_resume.get("page_count")
        if not isinstance(resume_text, str) or not resume_text.strip():
            raise RuntimeError("Profile engine returned no parsed resume text")
        if not isinstance(page_count, int):
            raise TypeError("Profile engine returned an invalid PDF page count")

        interview_result, questions = await run_interview(resume_text, page_count)
        interview_score = interview_result.get("interview_score")
        if not isinstance(interview_score, (int, float)):
            raise TypeError("Interview service returned no numeric score")

        readiness_payload = {
            "student_id": "e2e_candidate",
            "student_name": "E2E Candidate",
            "resume": {
                "score": resume_review.get("score", 0),
                "page_count": resume_review.get("page_count", page_count),
                "has_action_verbs": resume_review.get("uses_action_verbs", False),
                "has_clean_formatting": resume_review.get("is_ats_friendly", False),
            },
            "projects": [
                {
                    "name": "Placement Readiness Copilot",
                    "live_link_score": 90,
                    "code_quality_score": 80,
                    "documentation_score": 70,
                    "is_live": True,
                }
            ],
            "interview_session_result": interview_result,
            "github": {"score": 75},
            "coding_practice": {"score": 85, "problems_solved": 50},
            "linkedin": {"score": 90},
            "co_curricular": {"score": 60},
        }
        readiness = await request_json(
            client,
            "POST",
            f"{AUTOMATION_URL}/api/calculate-readiness",
            json=readiness_payload,
        )
        if readiness.get("is_provisional") is not False:
            raise RuntimeError(f"Readiness calculation is unexpectedly provisional: {readiness}")

        matched_jobs = await request_json(
            client,
            "POST",
            f"{AUTOMATION_URL}/api/discover-jobs",
            json={
                "skills": ["Python", "FastAPI", "PostgreSQL"],
                "target_role": "Software Engineer Intern",
                "max_results": 5,
            },
        )
        jobs = matched_jobs.get("jobs")
        if not isinstance(jobs, list) or len(jobs) != 5:
            raise RuntimeError(f"Expected 5 matched jobs, received: {matched_jobs}")

    return {
        "frontend_integration_health": platform_health,
        "resume_review": resume_review,
        "interview": {
            "question_count": len(questions),
            "project_deep_dive": questions[1],
            "score": interview_score,
            "transcript_turns": len(interview_result.get("transcript", [])),
        },
        "readiness": {
            "score": readiness.get("total_score"),
            "level": readiness.get("readiness_level"),
            "persistence": readiness.get("persistence"),
        },
        "matched_jobs": [
            {
                "title": job.get("title"),
                "company": job.get("company"),
                "source": job.get("source"),
                "relevance_score": job.get("relevance_score"),
            }
            for job in jobs
            if isinstance(job, Mapping)
        ],
    }


def main() -> int:
    try:
        report = asyncio.run(simulate())
    except Exception as exc:  # noqa: BLE001 - final CLI boundary reports every integration failure
        print(json.dumps({"status": "SYSTEM NOT READY", "error": str(exc)}, indent=2))
        return 1

    print(json.dumps(report, indent=2))
    print("SYSTEM READY")
    return 0


if __name__ == "__main__":
    sys.exit(main())
