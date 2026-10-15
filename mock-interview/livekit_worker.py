"""LiveKit Agents worker for the mock interview voice experience.

Run this file with Python 3.10+ and the LiveKit worker dependencies installed.
Resume context is passed as JSON in the room metadata for this provisional
integration; the adapter remains the only code that understands its shape.
"""

from __future__ import annotations

import json
import logging

from agent.context_adapter import adapt_resume
from scoring.schemas import InterviewContext

from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli, inference

logger = logging.getLogger("mock-interview")
server = AgentServer()


class MockInterviewAgent(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(instructions=instructions)

    async def on_enter(self) -> None:
        self.session.generate_reply(
            instructions=(
                "Greet the candidate, explain that this is a 30-minute mock "
                "interview, and ask the first question."
            )
        )


@server.rtc_session(agent_name="mock-interview")
async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()
    context = adapt_resume(_resume_from_room_metadata(ctx.room.metadata))
    instructions = _interview_instructions(context)
    session = AgentSession(
        stt=inference.STT("deepgram/nova-3", language="en"),
        llm=inference.LLM("groq/llama-3.1-8b-instant"),
        tts=inference.TTS("deepgram/aura-2-thalia-en"),
    )
    await session.start(
        room=ctx.room,
        agent=MockInterviewAgent(instructions),
    )


def _resume_from_room_metadata(metadata: str) -> dict:
    if not metadata:
        return {}
    try:
        value = json.loads(metadata)
    except json.JSONDecodeError:
        logger.warning("Ignoring invalid room metadata; using empty resume context")
        return {}
    return value if isinstance(value, dict) else {}


def _interview_instructions(context: InterviewContext) -> str:
    # The context is already a validated InterviewContext from the adapter.
    return (
        "You are a professional mock interviewer. Ask one question at a time, "
        "listen carefully, and ask concise follow-ups. Keep the interview within "
        "30 minutes maximum. Do not reveal scoring during the interview. "
        f"Candidate context: {context.model_dump_json(exclude_none=True)}\n\n"
        "When the candidate asks to finish, acknowledge the end of the interview "
        "without giving a score in the spoken response."
    )


if __name__ == "__main__":
    cli.run_app(server)
