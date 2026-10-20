"""Provider-independent final scoring for LiveKit and websocket sessions."""

from __future__ import annotations

import time
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
        self._start_time: float = time.monotonic()
        self._result: InterviewResult | None = None
        self._persisted = False
        self._lock = Lock()

    def record(self, role: str, text: str, timestamp_sec: float | None = None) -> None:
        speaker = "student" if role in {"student", "user"} else "ai"
        cleaned = text.strip()
        if cleaned:
            ts = timestamp_sec if timestamp_sec is not None else round(time.monotonic() - self._start_time, 1)
            turn_id = len(self.transcript) + 1
            self.transcript.append(
                TranscriptTurn(speaker=speaker, text=cleaned, timestamp_sec=ts, turn_id=turn_id)
            )


    def finish(self) -> InterviewResult:
        with self._lock:
            if self._result is None:
                if not any(turn.speaker == "student" for turn in self.transcript):
                    raise ValueError("an interview needs at least one candidate answer")
                try:
                    raw_result = self.llm.complete(
                        SCORING_SYSTEM_PROMPT,
                        build_scoring_prompt(self.context, self.transcript),
                    )
                except (RuntimeError, ValueError, TypeError, OSError):
                    raw_result = None
                result = parse_scoring_result(raw_result, self.transcript, self.context)
                student_turns_count = len([t for t in self.transcript if t.speaker == "student"])
                if student_turns_count < 3:
                    result.is_provisional = True
                    if not result.summary.startswith("[PARTIAL"):
                        result.summary = f"[PARTIAL / EARLY TERMINATION - {student_turns_count} ANSWERS] {result.summary}"
                self._result = result

            if self.result_store is not None and not self._persisted:
                if not self.interview_id:
                    raise ValueError("interview ID is required for result persistence")
                self.result_store.save(self.interview_id, self._result)
                self._persisted = True
            return self._result
