"""Provider-independent final scoring for LiveKit and websocket sessions."""

from __future__ import annotations

from threading import Lock

from agent.providers import InterviewLLM
from scoring.prompt import SCORING_SYSTEM_PROMPT, build_scoring_prompt, parse_scoring_result
from scoring.result_store import InterviewSessionResultStore
from scoring.schemas import InterviewContext, InterviewResult, TranscriptTurn


class InterviewFinalizer:
    """Collect a transcript and run the secondary scoring call exactly once."""

    def __init__(
        self,
        context: InterviewContext,
        llm: InterviewLLM,
        result_store: InterviewSessionResultStore | None = None,
        interview_id: str | None = None,
    ) -> None:
        self.context = context
        self.llm = llm
        self.result_store = result_store
        self.interview_id = interview_id
        self.transcript: list[TranscriptTurn] = []
        self._result: InterviewResult | None = None
        self._persisted = False
        self._lock = Lock()

    def record(self, role: str, text: str) -> None:
        speaker = "student" if role in {"student", "user"} else "ai"
        cleaned = text.strip()
        if cleaned:
            self.transcript.append(TranscriptTurn(speaker=speaker, text=cleaned))

    def finish(self) -> InterviewResult:
        with self._lock:
            if self._result is None:
                if not any(turn.speaker == "student" for turn in self.transcript):
                    raise ValueError("an interview needs at least one candidate answer")
                raw_result = self.llm.complete(
                    SCORING_SYSTEM_PROMPT,
                    build_scoring_prompt(self.context, self.transcript),
                )
                self._result = parse_scoring_result(raw_result, self.transcript)

            if self.result_store is not None and not self._persisted:
                if not self.interview_id:
                    raise ValueError("interview ID is required for result persistence")
                self.result_store.save(self.interview_id, self._result)
                self._persisted = True
            return self._result
