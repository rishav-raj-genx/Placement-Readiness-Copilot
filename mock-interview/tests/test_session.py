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


def test_problem_2_full_configuration_and_question_bank():
    from scoring.schemas import SessionConfig

    config = SessionConfig(
        target_duration_minutes=20,
        technical_question_count=6,
        project_deep_dive_count=2,
        hr_question_count=2,
        role_category="backend",
    )
    session = InterviewSession(
        InterviewContext(
            candidate_name="Rahul",
            target_role="Senior Backend Engineer",
            projects=["Distributed Ledger", "Auth Gateway"],
            skills=["Python", "PostgreSQL", "Kafka"],
        ),
        FakeLLM(),
        config=config,
    )

    greeting = session.greeting()
    assert "20 minutes" in greeting
    assert session.target_duration_minutes == 20
    assert session.max_duration_minutes == 22

    questions = []
    while session.has_more_questions:
        questions.append(session.next_question())

    # 1 intro + 2 project + 6 technical + 1 behavioral = 10 questions
    assert len(questions) == 10
    assert "Distributed Ledger" in questions[1]
    assert "Auth Gateway" in questions[2]
    assert "Python" in questions[3]  # skill
    # Bank questions cover concurrency, caching, or APIs
    assert any("database" in q.lower() or "cache" in q.lower() or "transaction" in q.lower() for q in questions)


def test_session_lifecycle_states_and_rejections():
    from agent.session import SessionState

    session = InterviewSession(
        InterviewContext(candidate_name="Asha", projects=["Order API"]),
        FakeLLM(),
    )
    assert session.state == SessionState.CREATED


    session.greeting()
    assert session.state == SessionState.IN_PROGRESS

    session.accept_answer("I specialize in Python microservices.")
    session.next_question()
    session.accept_answer("I designed the database replication.")

    result = session.finish()
    assert session.state == SessionState.COMPLETED
    assert result.interview_score == 78

    # Rejects accepting answers after session is completed
    try:
        session.accept_answer("Another answer")
    except ValueError as exc:
        assert "completed" in str(exc)
    else:
        raise AssertionError("accepted answer on completed session")


def test_session_adaptive_follow_up_policy():
    session = InterviewSession(
        InterviewContext(
            target_role="Backend Engineer",
            projects=["Payments Engine"],
            skills=["FastAPI"],
        ),
        FakeLLM(),
    )
    session.greeting()
    # Question 1: Intro
    session.next_question()

    # Case A: Candidate is unsure / passes -> advances without grilling
    session.accept_answer("I don't know much about that.")
    q2 = session.next_question()
    assert "Payments Engine" in q2  # advanced immediately to question 2

    # Case B: Candidate gives very brief answer on project -> nudges for details
    session.accept_answer("I built it.")
    follow_up = session.next_question()
    assert "elaborate" in follow_up.lower()  # nudge generated

    # After follow-up, next turn advances to next primary question regardless
    session.accept_answer("I used FastAPI with PostgreSQL connection pools.")
    q3 = session.next_question()
    assert "trade-off" in q3.lower() or "fastapi" in q3.lower()


def test_transcript_turns_include_timestamps_and_turn_ids():
    session = InterviewSession(
        InterviewContext(candidate_name="Meera"),
        FakeLLM(),
    )
    session.greeting()
    session.next_question()
    session.accept_answer("I worked on high-throughput streaming systems.")

    assert len(session.transcript) == 3
    for idx, turn in enumerate(session.transcript):
        assert turn.turn_id == idx + 1
        assert turn.timestamp_sec is not None
        assert turn.timestamp_sec >= 0

