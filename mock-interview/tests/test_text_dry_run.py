import json

from fastapi.testclient import TestClient

from app import create_app


class DryRunLLM:
    def complete(self, system_prompt: str, user_prompt: str) -> object:
        assert "Return only valid JSON" in system_prompt
        assert "Placement Copilot" in user_prompt
        assert "Interview transcript" in user_prompt
        return {
            "interview_score": 84,
            "summary": "Strong project ownership and clear technical reasoning.",
            "strengths": [
                "Explained architecture decisions clearly",
                "Connected implementation details to reliability",
            ],
            "improvement_areas": ["Quantify latency and adoption outcomes more precisely"],
            "dimensions": {
                "communication": {
                    "score": 86,
                    "feedback": "Answers were structured and concise.",
                    "strengths": ["Clear structure"],
                    "improvement_areas": ["State metrics earlier"],
                },
                "technical_depth": {
                    "score": 85,
                    "feedback": "Good API and reliability depth.",
                    "strengths": ["Explained idempotency"],
                    "improvement_areas": ["Discuss load-test thresholds"],
                },
                "behavioral": {
                    "score": 80,
                    "feedback": "Demonstrated ownership and reflection.",
                    "strengths": ["Owned trade-offs"],
                    "improvement_areas": ["Clarify stakeholder impact"],
                },
            },
        }


class DryRunTTS:
    def synthesize(self, text: str) -> bytes:
        return f"audio:{text}".encode()


def test_text_only_interview_generates_transcript_and_score() -> None:
    app = create_app(
        llm=DryRunLLM(),
        tts=DryRunTTS(),
        require_auth=False,
    )
    answers = [
        "I am a backend engineer interested in reliable distributed services.",
        "I owned the FastAPI architecture and made writes idempotent.",
        "I chose PostgreSQL transactions over an event log for simpler consistency.",
        "I used Python with typed validation, retries, and contract tests.",
        "I reproduced duplicate writes, added an idempotency key, and load-tested the fix.",
        "I accepted feedback to simplify the API and documented the decision.",
    ]

    with TestClient(app).websocket_connect("/ws/interview") as websocket:
        websocket.send_json(
            {
                "event": "start",
                "resume": {
                    "name": "Asha Rao",
                    "target_role": "Backend Engineer",
                    "text": (
                        "SKILLS\nPython PostgreSQL\n"
                        "PROJECTS\nPlacement Copilot - Built an idempotent FastAPI service."
                    ),
                },
            }
        )
        greeting = websocket.receive_json()
        first_question = websocket.receive_json()
        questions = [first_question["text"]]

        for index, answer in enumerate(answers):
            websocket.send_json({"event": "answer", "text": answer})
            response = websocket.receive_json()
            if index < len(answers) - 1:
                assert response["event"] == "question"
                questions.append(response["text"])
            else:
                assert response == {"event": "ready_to_finish", "question_count": 6}

        websocket.send_json({"event": "finish"})
        result_event = websocket.receive_json()

    assert greeting["event"] == "greeting"
    assert len(questions) == 6
    assert "Placement Copilot" in questions[1]
    assert result_event["event"] == "result"
    result = result_event["result"]
    assert result["interview_score"] == 84
    assert len(result["transcript"]) == 13
    print(
        json.dumps(
            {
                "questions": questions,
                "transcript": result["transcript"],
                "score": result,
            },
            indent=2,
        )
    )
