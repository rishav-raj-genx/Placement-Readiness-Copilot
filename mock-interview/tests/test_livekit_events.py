import json

from agent.livekit_events import (
    encode_event,
    finish_event,
    greeting_event,
    question_event,
    results_event,
    transcript_event,
)
from scoring.schemas import DimensionScore, InterviewResult, TranscriptTurn


def test_events_match_frontend_namespaced_contract():
    greeting = greeting_event("Welcome", interview_id="intv-1")
    question = question_event("Explain leader election.", 1, target_competencies=["Raft"])
    transcript = transcript_event("My answer", "student")
    results = results_event(
        InterviewResult(
            interview_score=88,
            transcript=[TranscriptTurn(speaker="student", text="My answer")],
            summary="Good interview.",
            strengths=["Clear explanation"],
            improvement_areas=["Add metrics"],
            dimensions={
                "communication": DimensionScore(score=90),
                "technical_depth": DimensionScore(score=88),
                "behavioral": DimensionScore(score=84),
            },
        )
    )
    finish = finish_event()

    assert greeting["event"] == "interview:greeting"
    assert greeting["payload"]["message"] == "Welcome"
    assert greeting["payload"]["interviewId"] == "intv-1"
    assert question["event"] == "interview:question"
    assert question["payload"]["text"] == "Explain leader election."
    assert question["payload"]["questionNumber"] == 1
    assert "evaluationCriteria" not in question["payload"]
    assert transcript["event"] == "interview:transcript"
    assert transcript["payload"]["speaker"] == "student"
    assert transcript["payload"]["final"] is True
    assert results["event"] == "interview:results"
    assert results["payload"]["finalScore"] == 88
    assert results["payload"]["transcript"][0]["text"] == "My answer"
    assert finish == {
        "event": "interview:finish",
        "payload": {"reason": "student_requested"},
    }
    assert json.loads(encode_event(question))["event"] == "interview:question"
