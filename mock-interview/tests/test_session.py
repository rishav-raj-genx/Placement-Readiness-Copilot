from agent.session import InterviewSession
from scoring.schemas import InterviewContext


class FakeLLM:
    def complete(self, system_prompt, user_prompt):
        assert "Return only valid JSON" in system_prompt
        return {
            "interview_score": 78,
            "summary": "Solid answer with room for more detail.",
            "strengths": ["Clear communication"],
            "improvement_areas": ["Add measurable outcomes"],
            "dimension_scores": {
                "communication": {"score": 80, "feedback": "Clear"},
            },
        }


def test_session_greets_questions_and_scores():
    session = InterviewSession(
        InterviewContext(
            candidate_name="Asha",
            target_role="Backend Engineer",
            projects=["Order API"],
            skills=["Python"],
        ),
        FakeLLM(),
    )

    assert session.greeting().startswith("Hi Asha")
    assert "Backend Engineer" in session.next_question()
    session.accept_answer("I build reliable APIs.")
    result = session.finish()

    assert result.contract_version == "v0"
    assert result.interview_score == 78
    assert result.transcript[-1].text == "I build reliable APIs."


def test_session_rejects_empty_answers():
    session = InterviewSession(InterviewContext(), FakeLLM())
    try:
        session.accept_answer(" ")
    except ValueError as exc:
        assert "empty" in str(exc)
    else:
        raise AssertionError("empty answer was accepted")
