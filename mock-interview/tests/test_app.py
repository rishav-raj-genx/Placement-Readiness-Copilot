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
