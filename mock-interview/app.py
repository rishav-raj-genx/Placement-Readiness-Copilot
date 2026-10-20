"""FastAPI websocket entry point for text and voice-enabled interviews."""

from __future__ import annotations

import asyncio
import base64
import binascii
import contextlib
import os
from collections.abc import Mapping

from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from agent.auth import AuthenticationError, authenticate_student, parse_bearer_token
from agent.context_adapter import adapt_resume
from agent.providers import (
    DeepgramSTT,
    DeepgramTTS,
    GroqLLM,
    InterviewLLM,
    SpeechToText,
    TextToSpeech,
)
from agent.session import InterviewSession
from scoring.coding_evaluator import (
    CODING_PROBLEM_BANK,
    evaluate_coding_submission,
)
from scoring.result_store import (
    ResultStore,
    SupabaseResultStore,
    has_completed_round1,
    record_round1_completed,
    save_coding_interview_session,
)
from scoring.schemas import SessionConfig


class CodingSubmissionPayload(BaseModel):
    problem_id: str
    language: str = "javascript"
    code: str = Field(..., max_length=20000)
    auth_token: str | None = None
    student_id: str | None = None
    follow_up_answer: str | None = None


def create_app(
    llm: InterviewLLM | None = None,
    stt: SpeechToText | None = None,
    tts: TextToSpeech | None = None,
    result_store: ResultStore | None = None,
    require_auth: bool = True,
    runtime_mode: str = "live",
) -> FastAPI:
    """Create the websocket app with injectable providers for tests."""

    app = FastAPI(title="Mock Interview Voice Service")
    scoring_llm = llm or GroqLLM()
    speech_to_text = stt or DeepgramSTT()
    text_to_speech = tts or DeepgramTTS()
    persistence = result_store or SupabaseResultStore()

    @app.get("/health")
    async def health() -> dict[str, object]:
        return {
            "status": "ok",
            "mode": runtime_mode,
            "transport": "websocket",
            "stt": "disabled" if runtime_mode == "e2e" else "deepgram",
            "tts": "text-only" if runtime_mode == "e2e" else "deepgram",
            "scoring": "deterministic" if runtime_mode == "e2e" else "groq",
            "target_duration_minutes": InterviewSession.TARGET_DURATION_MINUTES,
            "max_duration_minutes": InterviewSession.MAX_DURATION_MINUTES,
            "rounds_supported": ["theoretical_technical", "dsa_webdev_ide"],
        }

    @app.get("/api/interview/coding-problems")
    async def list_coding_problems(
        student_id: str | None = None,
        authorization: str | None = Header(None),
    ) -> dict[str, object]:
        """Return the curated problem bank with public example cases only."""
        resolved_student = student_id
        if not resolved_student and authorization:
            with contextlib.suppress(Exception):
                token = parse_bearer_token(authorization)
                resolved_student = authenticate_student(token)

        # Gate Round 2: Only activated if Round 1 (Technical Viva) was completed
        if resolved_student and resolved_student not in {"service_caller", "e2e_candidate"} and not has_completed_round1(resolved_student):
            return {
                "status": "locked",
                "round1_completed": False,
                "message": "Round 2 (Coding & Problem Solving IDE) is locked until Round 1 (Technical Viva) is completed.",
                "problems": [],
            }

        return {
            "status": "ok",
            "round1_completed": True,
            "problems": [
                {
                    "id": p.id,
                    "title": p.title,
                    "category": p.category,
                    "difficulty": p.difficulty,
                    "description": p.description,
                    "constraints": p.constraints,
                    "starter_code": p.starter_code,
                    "example_cases": p.test_cases[:1],  # Issue 24: Hide private evaluation test cases
                    "optimal_time_complexity": p.optimal_time_complexity,
                    "optimal_space_complexity": p.optimal_space_complexity,
                }
                for p in CODING_PROBLEM_BANK.values()
            ],
        }

    @app.post("/api/interview/coding-evaluate")
    async def evaluate_coding(
        submission: CodingSubmissionPayload,
        authorization: str | None = Header(None),
    ) -> dict[str, object]:
        """Evaluate submitted candidate code via static AST benchmarks with authentication."""
        verified_student_id = submission.student_id
        if require_auth:
            token = submission.auth_token or (parse_bearer_token(authorization) if authorization else None)
            if not token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication token is required for coding evaluation.",
                )
            try:
                verified_student_id = authenticate_student(token, submission.student_id)
            except AuthenticationError as exc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=str(exc),
                ) from exc

        # Gating: Round 2 is only activated after Round 1 (Technical Viva) is completed
        student_for_gating = submission.student_id or (verified_student_id if verified_student_id != "service_caller" else None)
        if require_auth and student_for_gating and not has_completed_round1(student_for_gating):
            return {
                "status": "locked",
                "round1_completed": False,
                "error": "Round 2 (Coding & Problem Solving IDE) is locked. You must complete Round 1 (Technical Viva) first.",
            }

        result = evaluate_coding_submission(
            problem_id=submission.problem_id,
            language=submission.language,
            code=submission.code,
            follow_up_answer=submission.follow_up_answer,
        )

        # Persist completed Round 2 coding practice session to interview_sessions table
        effective_student_id = student_for_gating or verified_student_id
        if effective_student_id and effective_student_id not in {"service_caller", "unknown"}:
            with contextlib.suppress(Exception):
                save_coding_interview_session(effective_student_id, submission.problem_id, result)

        return {
            "status": "ok",
            "round1_completed": True,
            "result": result.model_dump(),
        }

    @app.websocket("/ws/interview")
    async def interview_socket(websocket: WebSocket) -> None:
        await websocket.accept()
        session: InterviewSession | None = None
        student_id: str | None = None
        try:
            while True:
                raw_message = await websocket.receive_json()
                if not isinstance(raw_message, Mapping):
                    raise TypeError("websocket message must be a JSON object")
                message = raw_message
                event = message.get("event")
                if event == "start":
                    if session is not None:
                        raise ValueError("session is already in progress; finish before starting a new one")
                    if require_auth:
                        student_id = authenticate_student(
                            message.get("auth_token"), message.get("student_id")
                        )
                    cfg_raw = message.get("session_config")
                    cfg = SessionConfig.model_validate(cfg_raw) if isinstance(cfg_raw, dict) else None
                    session = InterviewSession(adapt_resume(message.get("resume")), scoring_llm, config=cfg)
                    greeting = session.greeting()
                    await _send_voice_event(websocket, "greeting", greeting, text_to_speech)
                    await _send_next_question(websocket, session, text_to_speech)

                elif event == "answer":
                    if session is None:
                        raise ValueError("send a start event before answering")
                    text = message.get("text")
                    if not isinstance(text, str):
                        raise ValueError("answer.text must be a string")
                    session.accept_answer(text)
                    await _send_next_question(websocket, session, text_to_speech)

                elif event == "audio_answer":
                    if session is None:
                        raise ValueError("send a start event before answering")
                    audio = _decode_audio(message.get("audio_base64"))
                    content_type = message.get("content_type", "audio/webm")
                    if not isinstance(content_type, str):
                        raise TypeError("content_type must be a string")
                    text = await asyncio.to_thread(
                        speech_to_text.transcribe,
                        audio,
                        content_type,
                    )
                    session.accept_answer(text)
                    await websocket.send_json({"event": "transcript", "text": text})
                    await _send_next_question(websocket, session, text_to_speech)
                elif event == "finish":
                    if session is None:
                        raise ValueError("send a start event before finishing")
                    result = await asyncio.to_thread(session.finish)
                    if persistence is not None and student_id is not None:
                        await asyncio.to_thread(persistence.save, student_id, result)
                    if student_id:
                        record_round1_completed(student_id)
                    await websocket.send_json(
                        {"event": "result", "result": result.model_dump(mode="json")}
                    )
                    return
                else:
                    raise ValueError("event must be start, answer, audio_answer, or finish")
        except WebSocketDisconnect:
            return
        except (AuthenticationError, TypeError, ValueError, RuntimeError, OSError) as exc:
            with contextlib.suppress(Exception):
                await websocket.send_json({"event": "error", "message": str(exc)})


    return app


def create_runtime_app() -> FastAPI:
    """Create the live app, or deterministic providers when explicitly requested."""
    if os.getenv("MOCK_INTERVIEW_E2E_MODE", "false").lower() not in {"1", "true", "yes"}:
        return create_app()

    from agent.e2e_providers import DeterministicInterviewLLM, NoopResultStore, TextOnlyTTS

    return create_app(
        llm=DeterministicInterviewLLM(),
        tts=TextOnlyTTS(),
        result_store=NoopResultStore(),
        require_auth=False,
        runtime_mode="e2e",
    )


async def _send_next_question(
    websocket: WebSocket,
    session: InterviewSession,
    tts: TextToSpeech,
) -> None:
    if not session.has_more_questions:
        await websocket.send_json(
            {
                "event": "ready_to_finish",
                "question_count": session.question_number,
            }
        )
        return
    question = session.next_question()
    await _send_voice_event(websocket, "question", question, tts)


async def _send_voice_event(
    websocket: WebSocket,
    event: str,
    text: str,
    tts: TextToSpeech,
) -> None:
    audio = await asyncio.to_thread(tts.synthesize, text)
    await websocket.send_json(
        {
            "event": event,
            "text": text,
            "audio_base64": base64.b64encode(audio).decode("ascii"),
        }
    )


def _decode_audio(value: object) -> bytes:
    if not isinstance(value, str):
        raise TypeError("audio_base64 must be a string")
    try:
        return base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("audio_base64 is invalid") from exc
