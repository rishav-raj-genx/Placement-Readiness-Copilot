"""Stateful interview orchestration independent of transport or providers."""

from __future__ import annotations

from agent.providers import InterviewLLM
from scoring.prompt import (
    SCORING_SYSTEM_PROMPT,
    build_scoring_prompt,
    parse_scoring_result,
)
from scoring.schemas import InterviewContext, InterviewResult, TranscriptTurn


class InterviewSession:
    """A bounded, resume-grounded interview targeting an 18-minute session."""

    TARGET_DURATION_MINUTES = 18
    MAX_DURATION_MINUTES = 20
    TOTAL_QUESTIONS = 6

    def __init__(self, context: InterviewContext, llm: InterviewLLM):
        self.context = context
        self.llm = llm
        self.transcript: list[TranscriptTurn] = []
        self.questions = _build_question_plan(context)
        self.question_number = 0

    def greeting(self) -> str:
        name = f" {self.context.candidate_name}" if self.context.candidate_name else ""
        text = (
            f"Hi{name}, welcome to your mock interview. "
            "This interview will take about 18 minutes. I’ll ask four technical "
            "questions and two HR questions, with concise follow-ups where useful. "
            "Let’s begin."
        )
        self.transcript.append(TranscriptTurn(speaker="ai", text=text))
        return text

    def next_question(self) -> str:
        if not self.has_more_questions:
            raise ValueError("all interview questions have been asked; finish the session")
        self.question_number += 1
        text = self.questions[self.question_number - 1]
        self.transcript.append(TranscriptTurn(speaker="ai", text=text))
        return text

    @property
    def has_more_questions(self) -> bool:
        return self.question_number < len(self.questions)

    @property
    def is_complete(self) -> bool:
        return self.question_number == len(self.questions)

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


def _build_question_plan(context: InterviewContext) -> tuple[str, ...]:
    role = _shorten(context.target_role) or "your target role"
    project = _shorten(context.projects[0]) if context.projects else ""
    skill = _shorten(context.skills[0]) if context.skills else ""
    experience = _shorten(context.experience[0]) if context.experience else ""
    resume_detail = _shorten(context.summary)

    project_focus = project or resume_detail or "the strongest project on your resume"
    skill_focus = skill or "the primary technology used in that project"
    experience_focus = experience or project_focus

    return (
        f"Could you introduce yourself and explain why you are interested in {role}?",
        (
            f"Your resume mentions {project_focus}. What problem did it solve, what was "
            "your personal contribution, and how did you design the core architecture?"
        ),
        (
            f"Deep-diving into {project_focus}, describe the hardest technical trade-off "
            "you made, the alternative you rejected, and the measurable outcome."
        ),
        (
            f"Your resume highlights {skill_focus}. Explain one production-level use of it, "
            "including failure handling, testing, and performance considerations."
        ),
        (
            f"Based on {experience_focus}, walk me through a difficult defect or reliability "
            "problem: how did you isolate the cause and verify the fix?"
        ),
        (
            "Tell me about a time you received difficult feedback or disagreed with a teammate. "
            "What action did you take, and what changed afterward?"
        ),
    )


def _shorten(value: str, limit: int = 180) -> str:
    compact = " ".join(value.split()).rstrip(" .,:;")
    return compact if len(compact) <= limit else f"{compact[: limit - 1].rstrip()}…"
