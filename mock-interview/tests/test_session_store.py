import json

from scoring.result_store import SupabaseInterviewSessionStore
from scoring.schemas import InterviewResult


class FakeResponse:
    status = 204

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
    ).save("intv-1", InterviewResult(interview_score=84))

    assert captured["method"] == "PATCH"
    assert captured["url"].endswith("/rest/v1/interview_sessions?id=eq.intv-1")
    assert captured["payload"]["result"]["contract_version"] == "v0"
    assert captured["payload"]["result"]["interview_score"] == 84
    assert captured["payload"]["status"] == "completed"
