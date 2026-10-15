"""FastAPI websocket entry point for text and voice-enabled interviews."""

from __future__ import annotations

import base64
import binascii
from typing import Any, Dict, Optional

from agent.auth import AuthenticationError, authenticate_student
from agent.providers import DeepgramSTT, DeepgramTTS, GroqLLM, InterviewLLM, SpeechToText, TextToSpeech
from agent.session import InterviewSession
from agent.context_adapter import adapt_resume
from scoring.result_store import ResultStore, SupabaseResultStore


def create_app(
    llm: Optional[InterviewLLM] = None,
    stt: Optional[SpeechToText] = None,
    tts: Optional[TextToSpeech] = None,
    result_store: Optional[ResultStore] = None,
    require_auth: bool = True,
) -> Any:
    """Create the websocket app with injectable providers for tests."""

    try:
        from fastapi import FastAPI, WebSocket, WebSocketDisconnect
    except ImportError as exc:
        raise RuntimeError("install requirements.txt to run the websocket service") from exc

    app = FastAPI(title="Mock Interview Voice Service")
    scoring_llm = llm or GroqLLM()
    speech_to_text = stt or DeepgramSTT()
    text_to_speech = tts or DeepgramTTS()
    persistence = result_store or SupabaseResultStore()

    @app.get("/health")
    async def health() -> Dict[str, str]:
        return {"status": "ok"}

    @app.websocket("/ws/interview")
    async def interview_socket(websocket: WebSocket) -> None:
        await websocket.accept()
        session: Optional[InterviewSession] = None
        student_id: Optional[str] = None
        try:
            while True:
                message = await websocket.receive_json()
                event = message.get("event")
                if event == "start":
                    if require_auth:
                        student_id = authenticate_student(
                            message.get("auth_token"), message.get("student_id")
                        )
                    session = InterviewSession(adapt_resume(message.get("resume")), scoring_llm)
                    greeting = session.greeting()
                    await _send_voice_event(websocket, "greeting", greeting, text_to_speech)
                    question = session.next_question()
                    await _send_voice_event(websocket, "question", question, text_to_speech)
                elif event == "answer":
                    if session is None:
                        raise ValueError("send a start event before answering")
                    text = message.get("text")
                    if not isinstance(text, str):
                        raise ValueError("answer.text must be a string")
                    session.accept_answer(text)
                    question = session.next_question()
                    await _send_voice_event(websocket, "question", question, text_to_speech)
                elif event == "audio_answer":
                    if session is None:
                        raise ValueError("send a start event before answering")
                    audio = _decode_audio(message.get("audio_base64"))
                    text = speech_to_text.transcribe(audio, message.get("content_type", "audio/webm"))
                    session.accept_answer(text)
                    await websocket.send_json({"event": "transcript", "text": text})
                    question = session.next_question()
                    await _send_voice_event(websocket, "question", question, text_to_speech)
                elif event == "finish":
                    if session is None:
                        raise ValueError("send a start event before finishing")
                    result = session.finish()
                    if persistence is not None and student_id is not None:
                        persistence.save(student_id, result)
                    await websocket.send_json(
                        {"event": "result", "result": result.model_dump(mode="json")}
                    )
                    return
                else:
                    raise ValueError("event must be start, answer, audio_answer, or finish")
        except WebSocketDisconnect:
            return
        except (AuthenticationError, ValueError, RuntimeError) as exc:
            await websocket.send_json({"event": "error", "message": str(exc)})

    return app


async def _send_voice_event(websocket: Any, event: str, text: str, tts: TextToSpeech) -> None:
    audio = tts.synthesize(text)
    await websocket.send_json(
        {
            "event": event,
            "text": text,
            "audio_base64": base64.b64encode(audio).decode("ascii"),
        }
    )


def _decode_audio(value: Any) -> bytes:
    if not isinstance(value, str):
        raise ValueError("audio_base64 must be a string")
    try:
        return base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("audio_base64 is invalid") from exc
