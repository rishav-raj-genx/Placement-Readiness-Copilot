"""LiveKit Agents worker for the mock interview voice experience.

Run this file with Python 3.10+ and the LiveKit worker dependencies installed.
Resume context is passed as JSON in the room metadata for this provisional
integration; the adapter remains the only code that understands its shape.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from collections.abc import Mapping
from contextlib import suppress

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    ConversationItemAddedEvent,
    JobContext,
    cli,
    inference,
)
from livekit.agents.llm import ChatMessage

from agent.context_adapter import adapt_resume
from agent.finalizer import InterviewFinalizer
from agent.livekit_events import encode_event, results_event
from agent.providers import GroqLLM
from agent.session import build_question_plan
from scoring.result_store import SupabaseInterviewSessionStore
from scoring.schemas import InterviewContext, SessionConfig

logger = logging.getLogger("mock-interview")
server = AgentServer()


class MockInterviewAgent(Agent):
    def __init__(self, instructions: str, target_minutes: int = 15) -> None:
        super().__init__(instructions=instructions)
        self.target_minutes = target_minutes

    async def on_enter(self) -> None:
        self.session.generate_reply(
            instructions=(
                f"Greet the candidate warmly, state that this session is configured for about {self.target_minutes} minutes, "
                "and ask the first introductory question."
            )
        )


@server.rtc_session(agent_name="mock-interview")
async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()
    metadata = _resume_from_room_metadata(ctx.room.metadata)
    context = adapt_resume(metadata)
    interview_id = _interview_id(metadata)

    target_duration = _duration_from_metadata(metadata)
    session_config = SessionConfig(
        target_duration_minutes=target_duration,
        technical_question_count=6,
        project_deep_dive_count=2,
        hr_question_count=1,
        role_category=context.target_role or "backend",
    )
    instructions = _interview_instructions(context, session_config)

    session = AgentSession(
        stt=inference.STT(
            os.getenv("LIVEKIT_STT_MODEL", "deepgram/nova-3"),
            language="en",
        ),
        llm=inference.LLM(os.getenv("LIVEKIT_INTERVIEW_MODEL", "groq/llama-3.1-8b-instant")),
        tts=inference.TTS(os.getenv("LIVEKIT_TTS_MODEL", "deepgram/aura-2-thalia-en")),
    )
    finalizer = InterviewFinalizer(
        context=context,
        llm=GroqLLM(),
        result_store=SupabaseInterviewSessionStore() if interview_id else None,
        interview_id=interview_id,
    )

    @session.on("conversation_item_added")
    def on_conversation_item_added(event: ConversationItemAddedEvent) -> None:
        if not isinstance(event.item, ChatMessage):
            return
        if event.item.role not in {"assistant", "user"}:
            return
        finalizer.record(event.item.role, event.item.text_content)

    async def finalize_interview(*, publish: bool) -> bool:
        try:
            result = await asyncio.to_thread(finalizer.finish)
            if publish:
                await ctx.room.local_participant.publish_data(
                    encode_event(results_event(result)),
                    reliable=True,
                )
            return True
        except (RuntimeError, ValueError) as exc:
            logger.error("Unable to finalize interview: %s", exc)
            return False

    async def finish_and_close() -> None:
        await finalize_interview(publish=True)
        session.shutdown()

    async def enforce_max_duration() -> None:
        max_seconds = session_config.effective_max_minutes * 60
        await asyncio.sleep(max_seconds)
        logger.info("Maximum interview duration reached (%d sec); finalizing the session", max_seconds)
        await finish_and_close()

    duration_task = asyncio.create_task(enforce_max_duration())

    @ctx.room.on("data_received")
    def on_data_received(packet: rtc.DataPacket) -> None:
        if _is_finish_packet(packet.data):
            asyncio.create_task(finish_and_close())

    async def finalize_on_shutdown() -> None:
        if duration_task is not asyncio.current_task():
            duration_task.cancel()
            with suppress(asyncio.CancelledError):
                await duration_task
        await finalize_interview(publish=False)

    ctx.add_shutdown_callback(finalize_on_shutdown)
    await session.start(
        room=ctx.room,
        agent=MockInterviewAgent(instructions, target_minutes=session_config.target_duration_minutes),
    )


def _duration_from_metadata(metadata: Mapping[str, object]) -> int:
    val = metadata.get("durationMinutes") or metadata.get("duration_minutes") or metadata.get("target_duration_minutes")
    if isinstance(val, (int, float)) and 5 <= int(val) <= 60:
        return int(val)
    if isinstance(val, str) and val.isdigit() and 5 <= int(val) <= 60:
        return int(val)
    return 15 if os.getenv("E2E_MODE") else 20


def _resume_from_room_metadata(metadata: str) -> dict[str, object]:
    if not metadata:
        return {}
    try:
        value = json.loads(metadata)
    except json.JSONDecodeError:
        logger.warning("Ignoring invalid room metadata; using empty resume context")
        return {}
    if not isinstance(value, dict):
        return {}
    return {key: item for key, item in value.items() if isinstance(key, str)}


def _interview_id(metadata: Mapping[str, object]) -> str | None:
    value = metadata.get("interviewId") or metadata.get("interview_id")
    return value.strip() if isinstance(value, str) and value.strip() else None


def _is_finish_packet(data: bytes) -> bool:
    try:
        value = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return False
    return isinstance(value, Mapping) and value.get("event") == "interview:finish"


def _interview_instructions(context: InterviewContext, config: SessionConfig) -> str:
    # Grounded in Internshala & PrepLabsAI InterviewMentor standards using canonical plan
    plan = build_question_plan(context, config)
    plan_lines = "\n".join(
        f"{idx + 1}. [{item.category.value.upper()}] {item.text} (Probe goal: {item.probe_goal})"
        for idx, item in enumerate(plan)
    )

    return (
        f"You are an experienced, empathetic, and professional mock interviewer conducting a {config.target_duration_minutes}-minute "
        f"technical and behavioral session for the {context.target_role or config.role_category} position.\n\n"
        "### Canonical Question Plan (Must Follow in Order)\n"
        f"{plan_lines}\n\n"
        "### Interview Conduct Guidelines\n"
        "- Speak with a calm, conversational, professional cadence. Do not sound robotic.\n"
        "- Ask questions one at a time. Never dump multiple questions simultaneously.\n"
        "- Active Listening: Before asking the next primary question, briefly acknowledge a concrete point from the candidate's answer.\n"
        "- Adaptive Follow-up: Ask at most ONE concise follow-up per question if the candidate gives a very brief or incomplete answer. If the candidate passes or says 'I don't know', do not grill them—supportively move to the next question.\n"
        f"- Target {config.target_duration_minutes} minutes and wrap up by {config.effective_max_minutes} minutes.\n"
        "- Never reveal live scores or grading during the conversation.\n"
        f"- Verified Candidate Context: {context.model_dump_json(exclude_none=True)}\n\n"
        "When all questions are answered or when the candidate asks to finish, warmly thank them for their time, acknowledge the conclusion of the session, and explain that detailed diagnostic feedback is ready on their dashboard."
    )




if __name__ == "__main__":
    cli.run_app(server)
