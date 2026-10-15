"""Stateful interview orchestration independent of transport or providers."""

from __future__ import annotations

from typing import List

from agent.providers import InterviewLLM
from scoring.prompt import (
    SCORING_SYSTEM_PROMPT,
    build_scoring_prompt,
    parse_scoring_result,
)
from scoring.schemas import InterviewContext, InterviewResult, TranscriptTurn


class InterviewSession:
    """A bounded interview session with a 30-minute default limit."""

    DEFAULT_DURATION_MINUTES = 30

    def __init__(self, context: InterviewContext, llm: InterviewLLM):
        self.context = context
        self.llm = llm
        self.transcript: List[TranscriptTurn] = []
        self.question_number = 0

    def greeting(self) -> str:
        name = f" {self.context.candidate_name}" if self.context.candidate_name else ""
        text = (
            f"Hi{name}, welcome to your mock interview. "
            "I’ll ask a few questions and follow up on your answers. "
            "Let’s begin."
        )
        self.transcript.append(TranscriptTurn(speaker="ai", text=text))
        return text

    def next_question(self) -> str:
        self.question_number += 1
        if self.question_number == 1:
            focus = self.context.target_role or "the role you are targeting"
            text = f"Could you introduce yourself and explain why you are interested in {focus}?"
        elif self.question_number == 2 and self.context.projects:
            text = f"Please walk me through your project: {self.context.projects[0]}."
        elif self.question_number == 3 and self.context.skills:
            text = f"How have you used {self.context.skills[0]} in a real project?"
        else:
            text = "Tell me about a difficult technical decision you made and its outcome."
        self.transcript.append(TranscriptTurn(speaker="ai", text=text))
        return text

    def accept_answer(self, text: str) -> None:
        cleaned = text.strip()
        if not cleaned:
            raise ValueError("answer text cannot be empty")
        self.transcript.append(TranscriptTurn(speaker="student", text=cleaned))

    def finish(self) -> InterviewResult:
        if not any(turn.speaker == "student" for turn in self.transcript):
            raise ValueError("an interview needs at least one candidate answer")
        raw = self.llm.complete(
            SCORING_SYSTEM_PROMPT, build_scoring_prompt(self.context, self.transcript)
        )
        return parse_scoring_result(raw, self.transcript)
