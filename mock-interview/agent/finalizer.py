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
        self._transcript_persisted = False
        self._lock = Lock()

    MAX_TRANSCRIPT_TURNS = 500

    def record(self, role: str, text: str, timestamp_sec: float | None = None) -> None:
        speaker = "student" if role in {"student", "user"} else "ai"
        cleaned = text.strip()
        if cleaned and len(self.transcript) < self.MAX_TRANSCRIPT_TURNS:
            ts = timestamp_sec if timestamp_sec is not None else round(time.monotonic() - self._start_time, 1)
            turn_id = len(self.transcript) + 1
            self.transcript.append(
                TranscriptTurn(speaker=speaker, text=cleaned, timestamp_sec=ts, turn_id=turn_id)
            )

    def finish(self) -> InterviewResult:
        with self._lock:
            if self._result is None:
                student_turns = [turn for turn in self.transcript if turn.speaker == "student"]
                if not self.transcript:
                    self.record(
                        "assistant",
                        "The interview ended before any responses were recorded.",
                    )

                if self.result_store is not None and not self._transcript_persisted:
                    if not self.interview_id:
                        raise ValueError("interview ID is required for transcript persistence")
                    self.result_store.save_transcript(self.interview_id, self.transcript)
                    self._transcript_persisted = True

                student_turns_count = len(student_turns)
                elapsed_sec = time.monotonic() - self._start_time

                try:
                    raw_result = self.llm.complete(
                        SCORING_SYSTEM_PROMPT,
                        build_scoring_prompt(self.context, self.transcript),
                    )
                except (RuntimeError, ValueError, TypeError, OSError):
                    raw_result = None

                result = parse_scoring_result(raw_result, self.transcript, self.context)

                # Completion policy: At least 3 candidate answers and min 45 seconds engagement
                if student_turns_count < 3 or elapsed_sec < 45:
                    result.is_provisional = True
                    result.is_abandoned = True
                    result.session_status = "abandoned"
                    if not result.summary.startswith("[ABANDONED"):
                        result.summary = (
                            f"[ABANDONED / EARLY EXIT - {student_turns_count} ANSWERS, {int(elapsed_sec)}s] "
                            f"{result.summary}"
                        )
                else:
                    result.is_abandoned = False
                    result.session_status = "completed"

                self._result = result

            if self.result_store is not None and not self._persisted:
                if not self.interview_id:
                    raise ValueError("interview ID is required for result persistence")
                self.result_store.save(self.interview_id, self._result)
                self._persisted = True

            return self._result
