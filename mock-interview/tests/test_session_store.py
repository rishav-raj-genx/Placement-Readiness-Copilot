import json

from scoring.result_store import SupabaseInterviewSessionStore, save_coding_interview_session
from scoring.schemas import DimensionScore, InterviewResult, TranscriptTurn


class FakeResponse:
    status = 200

    def read(self):
        return b'[{"id":"intv-1"}]'

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_platform_store_patches_authoritative_interview_session(monkeypatch):
    captured = {}

    def fake_urlopen(req, timeout):
        captured["method"] = req.method
        captured["url"] = req.full_url
        captured["payload"] = json.loads(req.data.decode())
        return FakeResponse()

    monkeypatch.setattr("scoring.result_store.request.urlopen", fake_urlopen)
    SupabaseInterviewSessionStore(
        url="https://example.supabase.co",
        service_key="server-only",
    ).save(
        "intv-1",
        InterviewResult(
            interview_score=84,
            transcript=[TranscriptTurn(speaker="student", text="A complete answer.")],
            summary="Strong interview.",
            strengths=["Clear communication"],
            improvement_areas=["Add metrics"],
            dimensions={
                "communication": DimensionScore(score=86),
                "technical_depth": DimensionScore(score=84),
                "behavioral": DimensionScore(score=82),
            },
        ),
    )

    assert captured["method"] == "PATCH"
    assert "id=eq.intv-1" in captured["url"]
    assert "status=in.(created,active,in_progress)" in captured["url"]
    assert captured["payload"]["result"]["contract_version"] == "v0"
    assert captured["payload"]["result"]["interview_score"] == 84
    assert captured["payload"]["transcript"][0]["text"] == "A complete answer."
    assert captured["payload"]["viva_scores"]["dimensions"]["technical_depth"]["score"] == 84
    assert captured["payload"]["status"] == "completed"


def test_platform_store_persists_raw_transcript_before_scoring(monkeypatch):
    captured = {}

    def fake_urlopen(req, timeout):
        captured["url"] = req.full_url
        captured["payload"] = json.loads(req.data.decode())
        return FakeResponse()

    monkeypatch.setattr("scoring.result_store.request.urlopen", fake_urlopen)
    SupabaseInterviewSessionStore(
        url="https://example.supabase.co",
        service_key="server-only",
    ).save_transcript(
        "intv-1",
        [TranscriptTurn(speaker="student", text="Raw answer survives scorer failure.")],
    )

    assert "status=in.(created,in_progress,active)" in captured["url"]
    assert captured["payload"]["transcript"][0]["text"] == "Raw answer survives scorer failure."


def test_coding_store_persists_final_code_and_efficiency_scores(monkeypatch):
    captured = {}

    def fake_urlopen(req, timeout):
        captured["url"] = req.full_url
        captured["payload"] = json.loads(req.data.decode())
        return FakeResponse()

    monkeypatch.setattr("scoring.result_store.request.urlopen", fake_urlopen)
    interview_id = save_coding_interview_session(
        student_id="00000000-0000-0000-0000-000000000001",
        problem_id="two_sum",
        result={
            "overall_score": 92,
            "estimated_time_complexity": "O(N)",
            "estimated_space_complexity": "O(N)",
            "strengths": ["Optimal hash-map lookup"],
            "improvement_areas": ["Explain collision behavior"],
        },
        code="function twoSum(nums, target) { return [0, 1]; }",
        language="javascript",
        url="https://example.supabase.co",
        service_key="server-only",
    )

    assert interview_id.startswith("coding_")
    assert captured["url"].endswith("/rest/v1/interview_sessions")
    assert captured["payload"]["status"] == "completed"
    assert captured["payload"]["code_history"].startswith("function twoSum")
    assert captured["payload"]["viva_scores"]["estimated_time_complexity"] == "O(N)"
