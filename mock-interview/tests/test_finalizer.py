from agent.finalizer import InterviewFinalizer
from scoring.schemas import InterviewContext


class CountingLLM:
    def __init__(self) -> None:
        self.calls = 0

    def complete(self, system_prompt: str, user_prompt: str) -> object:
        self.calls += 1
        return {
            "interview_score": 81,
            "summary": "Complete result.",
            "strengths": ["Clear reasoning"],
            "improvement_areas": ["Add metrics"],
            "dimensions": {
                "communication": {"score": 82},
                "technical_depth": {"score": 81},
                "behavioral": {"score": 80},
            },
        }


class RetryStore:
    def __init__(self) -> None:
        self.calls = 0
        self.transcript_calls = 0

    def save_transcript(self, interview_id, transcript) -> None:
        self.transcript_calls += 1

    def save(self, interview_id, result) -> None:
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("temporary persistence failure")


def test_livekit_finalizer_scores_once_and_keeps_full_transcript() -> None:
    llm = CountingLLM()
    finalizer = InterviewFinalizer(InterviewContext(projects=["Placement Copilot"]), llm)
    finalizer.record("assistant", "Describe your project architecture.")
    finalizer.record("user", "I built a typed FastAPI service.")

    first_result = finalizer.finish()
    second_result = finalizer.finish()

    assert first_result is second_result
    assert llm.calls == 1
    assert [turn.speaker for turn in first_result.transcript] == ["ai", "student"]


def test_persistence_retry_does_not_repeat_scoring_call() -> None:
    llm = CountingLLM()
    store = RetryStore()
    finalizer = InterviewFinalizer(
        InterviewContext(projects=["Placement Copilot"]),
        llm,
        result_store=store,
        interview_id="intv-1",
    )
    finalizer.record("user", "I built a typed FastAPI service.")

    try:
        finalizer.finish()
    except RuntimeError as exc:
        assert "temporary" in str(exc)
    else:
        raise AssertionError("persistence failure was not surfaced")

    result = finalizer.finish()

    assert result.interview_score == 81
    assert llm.calls == 1
    assert store.calls == 2
    assert store.transcript_calls == 1


def test_scorer_failure_still_persists_raw_transcript() -> None:
    class FailingLLM:
        def complete(self, system_prompt: str, user_prompt: str) -> object:
            raise RuntimeError("scorer unavailable")

    class RecordingStore:
        def __init__(self) -> None:
            self.transcript = []
            self.saved_result = None

        def save_transcript(self, interview_id, transcript) -> None:
            self.transcript = list(transcript)

        def save(self, interview_id, result) -> None:
            self.saved_result = result

    store = RecordingStore()
    finalizer = InterviewFinalizer(
        InterviewContext(skills=["Python"]),
        FailingLLM(),
        result_store=store,
        interview_id="intv-fallback",
    )
    finalizer.record("assistant", "Explain your design.")
    finalizer.record("user", "I used queues and retries.")

    result = finalizer.finish()

    assert [turn.text for turn in store.transcript] == [
        "Explain your design.",
        "I used queues and retries.",
    ]
    assert store.saved_result is result
    assert result.is_fallback is True
