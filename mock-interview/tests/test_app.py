from app import create_app


class FakeLLM:
    def complete(self, system_prompt, user_prompt):
        return {
            "interview_score": 70,
            "summary": "Complete result.",
            "strengths": ["Clear answer"],
            "improvement_areas": ["Add metrics"],
            "dimensions": {
                "communication": {"score": 75},
                "technical_depth": {"score": 68},
                "behavioral": {"score": 70},
            },
        }


class FakeTTS:
    def synthesize(self, text):
        return b"audio"


def test_app_exposes_health_and_interview_websocket():
    app = create_app(llm=FakeLLM(), tts=FakeTTS())
    paths = {route.path for route in app.routes}

    assert "/health" in paths
    assert "/ws/interview" in paths

    from fastapi.testclient import TestClient

    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["target_duration_minutes"] == 15
    assert data["max_duration_minutes"] == 20
    assert data["supported_duration_minutes"] == [15, 20]
