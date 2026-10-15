import json

from scoring.result_store import SupabaseResultStore
from scoring.schemas import DimensionScore, InterviewResult


class FakeResponse:
    status = 201

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_result_store_maps_confirmed_rituraj_columns(monkeypatch):
    captured = {}

    def fake_urlopen(req, timeout):
        captured["payload"] = json.loads(req.data.decode())
        captured["url"] = req.full_url
        return FakeResponse()

    monkeypatch.setattr("scoring.result_store.request.urlopen", fake_urlopen)
    result = InterviewResult(
        interview_score=88,
        summary="Strong interview.",
        strengths=["Clear explanations"],
        improvement_areas=["Quantify impact"],
        dimensions={
            "technical_depth": DimensionScore(score=90),
            "communication": DimensionScore(score=86),
            "behavioral": DimensionScore(score=80),
        },
    )

    SupabaseResultStore(
        url="https://example.supabase.co",
        service_key="server-only",
    ).save("student-1", result, attempt_number=2, duration_minutes=18)

    assert captured["url"].endswith("/rest/v1/mock_interview_results")
    assert captured["payload"]["attempt_number"] == 2
    assert captured["payload"]["interview_score"] == 88
    assert captured["payload"]["technical_score"] == 90.0
    assert captured["payload"]["communication_score"] == 86.0
    assert captured["payload"]["behavioral_score"] == 80.0
    assert captured["payload"]["weak_areas"] == ["Quantify impact"]
    assert captured["payload"]["feedback_notes"] == "Strong interview."
    assert captured["payload"]["transcript"] == []


def test_result_store_defaults_to_thirty_minutes(monkeypatch):
    captured = {}

    def fake_urlopen(req, timeout):
        captured["payload"] = json.loads(req.data.decode())
        return FakeResponse()

    monkeypatch.setattr("scoring.result_store.request.urlopen", fake_urlopen)
    SupabaseResultStore(
        url="https://example.supabase.co",
        service_key="server-only",
    ).save("student-1", InterviewResult(interview_score=78.5))

    assert captured["payload"]["duration_minutes"] == 30
