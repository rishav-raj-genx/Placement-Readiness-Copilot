from agent.session import InterviewSession
from scoring.schemas import InterviewContext


class FakeLLM:
    def complete(self, system_prompt, user_prompt):
        assert "Return only valid JSON" in system_prompt
        assert "Order API" in user_prompt
        return {
            "interview_score": 78,
            "summary": "Solid answer with room for more detail.",
            "strengths": ["Clear communication"],
            "improvement_areas": ["Add measurable outcomes"],
            "dimension_scores": {
                "communication": {"score": 80, "feedback": "Clear"},
                "technical_depth": {"score": 76, "feedback": "Sound fundamentals"},
                "behavioral": {"score": 78, "feedback": "Structured response"},
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
    assert "Order API" in session.next_question()
    result = session.finish()

    assert result.contract_version == "v0"
    assert result.interview_score == 78
    assert result.transcript[-2].text == "I build reliable APIs."
    assert result.transcript[-1].speaker == "ai"


def test_question_plan_has_four_technical_and_two_hr_questions():
    session = InterviewSession(
        InterviewContext(
            target_role="Backend Engineer",
            projects=["Order API - idempotent payment processing"],
            skills=["Python"],
        ),
        FakeLLM(),
    )

    questions = []
    while session.has_more_questions:
        questions.append(session.next_question())

    assert len(questions) == 6
    assert "Order API" in questions[1]
    assert "Order API" in questions[2]
    assert "Python" in questions[3]
    assert "feedback" in questions[5]
    assert session.is_complete is True


def test_session_rejects_empty_answers():
    session = InterviewSession(InterviewContext(), FakeLLM())
    try:
        session.accept_answer(" ")
    except ValueError as exc:
        assert "empty" in str(exc)
    else:
        raise AssertionError("empty answer was accepted")
