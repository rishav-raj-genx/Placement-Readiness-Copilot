from __future__ import annotations

from scoring.prompt import extract_json_object, parse_scoring_result
from scoring.schemas import InterviewContext, TranscriptTurn


def test_extract_json_object_from_markdown():
    markdown = """Here is the score:
```json
{
  "interview_score": 88,
  "summary": "Solid candidate performance."
}
```
Hope this helps!"""
    data = extract_json_object(markdown)
    assert data is not None
    assert data["interview_score"] == 88


def test_parse_scoring_result_with_markdown_and_aliases():
    payload = """```json
    {
      "interview_score": 82,
      "summary": "Great problem solving.",
      "strengths": ["Fast learner"],
      "improvement_areas": ["Needs more testing focus"],
      "dimension_scores": {
        "clarity": {"score": 85, "feedback": "Clear explanation"},
        "technical": {"score": 80, "feedback": "Good architecture"},
        "behavior": {"score": 82, "feedback": "Collaborative"}
      }
    }
    ```"""
    turns = [
        TranscriptTurn(speaker="ai", text="Hello."),
        TranscriptTurn(speaker="student", text="Hi, I am ready."),
    ]
    result = parse_scoring_result(payload, turns)
    assert result.interview_score == 82
    assert "communication" in result.dimensions
    assert "technical_depth" in result.dimensions
    assert "behavioral" in result.dimensions
    assert result.dimensions["technical_depth"].score == 80


def test_parse_scoring_result_corrupted_payload_fallback():
    corrupted_payload = "Error 500: Server overloaded"
    turns = [
        TranscriptTurn(speaker="ai", text="Could you introduce yourself?"),
        TranscriptTurn(
            speaker="student",
            text="I am a backend developer. I work with Python, FastAPI, and PostgreSQL to design scalable systems.",
        ),
        TranscriptTurn(speaker="ai", text="Tell me about a trade-off you made."),
        TranscriptTurn(
            speaker="student",
            text="I chose PostgreSQL with explicit indexing over MongoDB for transactional consistency and team collaboration.",
        ),
    ]
    context = InterviewContext(skills=["Python", "FastAPI", "PostgreSQL"])
    result = parse_scoring_result(corrupted_payload, turns, context)

    assert result.interview_score > 0
    assert result.contract_version == "v0"
    assert len(result.strengths) >= 1
    assert len(result.improvement_areas) >= 1
    assert result.dimensions["technical_depth"].score >= 50
    assert "PostgreSQL" in result.summary or "PostgreSQL" in result.strengths[1] or result.dimensions["technical_depth"].score > 0


def test_resilient_llm_fallback_on_primary_failure():
    from agent.providers import HTTPProviderError, ResilientLLM

    class FailingLLM:
        def __init__(self):
            self.attempts = 0

        def complete(self, sys: str, user: str) -> object:
            self.attempts += 1
            raise HTTPProviderError("Primary provider rate limited (429)")

    class BackupLLM:
        def __init__(self):
            self.called = False

        def complete(self, sys: str, user: str) -> object:
            self.called = True
            return '{"interview_score": 85}'

    failing = FailingLLM()
    backup = BackupLLM()
    resilient = ResilientLLM(primary=failing, fallback=backup, max_retries=2)

    res = resilient.complete("system", "user")
    assert failing.attempts == 2
    assert backup.called is True
    assert res == '{"interview_score": 85}'

