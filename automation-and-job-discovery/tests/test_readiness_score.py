import pytest
from pydantic import ValidationError

import src.readiness_score.calculator as calculator_module
from src.db.supabase_client import SupabaseHandler
from src.readiness_score.calculator import (
    WEIGHTS,
    PlacementReadinessCalculator,
    ReadinessPersistenceError,
)
from src.readiness_score.models import (
    ALGORITHM_VERSION,
    CanonicalInterviewResult,
    CoCurricularInput,
    CodingPracticeInput,
    GitHubActivityInput,
    LinkedInInput,
    ProjectItem,
    ResumeInput,
    StudentProfileEvaluation,
)

EXPECTED_WEIGHTS = {
    "resume": 0.25,
    "projects": 0.25,
    "mock_interview": 0.20,
    "github": 0.10,
    "coding_practice": 0.10,
    "linkedin": 0.05,
    "co_curricular": 0.05,
}


def build_complete_profile() -> StudentProfileEvaluation:
    return StudentProfileEvaluation(
        student_id="integration_student",
        resume=ResumeInput(score=80.0),
        projects=[
            ProjectItem(
                name="Placement Copilot",
                live_link_score=90.0,
                code_quality_score=80.0,
                documentation_score=70.0,
                is_live=True,
            )
        ],
        interview_session_result=CanonicalInterviewResult(
            contract_version="v0",
            interview_score=85.0,
            transcript=[],
        ),
        github=GitHubActivityInput(score=75.0),
        coding_practice=CodingPracticeInput(score=85.0),
        linkedin=LinkedInInput(score=90.0),
        co_curricular=CoCurricularInput(score=60.0),
    )


def test_weights_sum_to_one():
    assert WEIGHTS == EXPECTED_WEIGHTS
    total_weight = sum(WEIGHTS.values())
    assert abs(total_weight - 1.0) < 0.0001


def test_complete_profile_uses_seven_component_weights():
    report = PlacementReadinessCalculator.calculate_readiness(
        build_complete_profile(),
        save_to_db=False,
    )

    assert report.total_score == 81.0
    assert report.category_scores["projects"]["raw_score"] == 82.0
    assert report.category_scores["resume"]["weighted_points"] == 20.0
    assert report.category_scores["projects"]["weighted_points"] == 20.5
    assert report.category_scores["mock_interview"]["weighted_points"] == 17.0
    assert report.category_scores["github"]["weighted_points"] == 7.5
    assert report.category_scores["coding_practice"]["weighted_points"] == 8.5
    assert report.category_scores["linkedin"]["weighted_points"] == 4.5
    assert report.category_scores["co_curricular"]["weighted_points"] == 3.0
    assert len(report.top_actions) == 5
    assert report.persistence.source == "not_requested"


def test_supabase_upsert_contract_and_persistence_receipt(monkeypatch):
    captured: dict[str, object] = {}

    class FakeResponse:
        data = [{"student_id": "integration_student", "total_score": 81.0}]

    class FakeTable:
        def upsert(self, payload: dict[str, object], on_conflict: str) -> "FakeTable":
            captured["payload"] = payload
            captured["on_conflict"] = on_conflict
            return self

        def execute(self) -> FakeResponse:
            return FakeResponse()

    class FakeSupabase:
        def table(self, table_name: str) -> FakeTable:
            captured["table"] = table_name
            return FakeTable()

    database_client = object.__new__(SupabaseHandler)
    database_client.is_live = True
    database_client.supabase = FakeSupabase()
    monkeypatch.setattr(calculator_module, "db_client", database_client)
    report = PlacementReadinessCalculator.calculate_readiness(
        build_complete_profile(),
        save_to_db=True,
        require_supabase=True,
    )

    assert report.total_score == 81.0
    assert report.persistence.model_dump() == {
        "attempted": True,
        "success": True,
        "source": "supabase",
    }
    assert captured["table"] == "readiness_scores"
    assert captured["on_conflict"] == "student_id"
    payload = captured["payload"]
    assert isinstance(payload, dict)
    assert payload["total_score"] == 81.0
    assert payload["algorithm_version"] == ALGORITHM_VERSION


def test_require_supabase_rejects_local_fallback(monkeypatch):
    class LocalDatabaseClient:
        @staticmethod
        def save_readiness_score(score_data: dict[str, object]) -> dict[str, object]:
            return {"success": True, "source": "local_sqlite"}

    monkeypatch.setattr(calculator_module, "db_client", LocalDatabaseClient())

    with pytest.raises(ReadinessPersistenceError, match="not written to Supabase"):
        PlacementReadinessCalculator.calculate_readiness(
            build_complete_profile(),
            save_to_db=True,
            require_supabase=True,
        )


def test_all_scores_present_canonical_interview():
    interview_payload = {
        "contract_version": "v0",
        "interview_score": 85.0,
        "transcript": [{"speaker": "ai", "text": "Hello"}],
        "summary": "Solid technical performance",
        "dimensions": {
            "technical_depth": {"score": 85.0, "feedback": "Good architecture"},
            "communication": {"score": 85.0, "feedback": "Clear answers"},
            "behavioral": {"score": 85.0, "feedback": "Collaborative mindset"},
        },
    }
    profile = StudentProfileEvaluation(
        student_id="student_complete",
        resume=ResumeInput(score=80.0),
        projects=[
            ProjectItem(
                name="App",
                live_link_score=90.0,
                code_quality_score=85.0,
                documentation_score=80.0,
                is_live=True,
            )
        ],
        interview_session_result=CanonicalInterviewResult(**interview_payload),
        github=GitHubActivityInput(score=75.0),
        coding_practice=CodingPracticeInput(score=85.0),
        linkedin=LinkedInInput(score=70.0),
        co_curricular=CoCurricularInput(score=85.0),
    )

    report = PlacementReadinessCalculator.calculate_readiness(profile, save_to_db=False)
    assert report.algorithm_version == ALGORITHM_VERSION
    assert report.is_provisional is False
    assert len(report.missing_components) == 0
    assert report.total_score >= 75.0
    assert report.readiness_level == "Placement ready"
    assert report.is_placement_ready is True
    assert report.category_scores["mock_interview"]["raw_score"] == 85.0


def test_missing_interview_does_not_silently_pass():
    profile = StudentProfileEvaluation(
        student_id="student_no_interview",
        resume=ResumeInput(score=90.0),
        projects=[
            ProjectItem(
                name="App",
                live_link_score=90.0,
                code_quality_score=90.0,
                documentation_score=90.0,
                is_live=True,
            )
        ],
        interview_session_result=None,  # Missing!
        github=GitHubActivityInput(score=90.0),
        linkedin=LinkedInInput(score=90.0),
        co_curricular=CoCurricularInput(score=90.0),
    )

    report = PlacementReadinessCalculator.calculate_readiness(profile, save_to_db=False)
    # Must be marked provisional and list mock_interview in missing components
    assert report.is_provisional is True
    assert "mock_interview" in report.missing_components
    # Mock interview raw score must be 0, not a fake score
    assert report.category_scores["mock_interview"]["raw_score"] == 0.0
    # Top action must include taking the mock viva
    assert any("mock" in act.action.lower() for act in report.top_actions)


def test_missing_resume_and_projects():
    interview_payload = {"contract_version": "v0", "interview_score": 80.0, "transcript": []}
    profile = StudentProfileEvaluation(
        student_id="student_missing_inputs",
        resume=None,
        projects=[],
        interview_session_result=CanonicalInterviewResult(**interview_payload),
        github=None,
        linkedin=None,
        co_curricular=None,
    )

    report = PlacementReadinessCalculator.calculate_readiness(profile, save_to_db=False)
    assert report.is_provisional is True
    assert "resume" in report.missing_components
    assert "projects" in report.missing_components
    assert report.readiness_level == "Not ready"


def test_out_of_range_values_are_clamped():
    assert PlacementReadinessCalculator.clamp(150.0) == 100.0
    assert PlacementReadinessCalculator.clamp(-35.0) == 0.0


def test_unsupported_contract_version_rejected():
    with pytest.raises(ValidationError):
        CanonicalInterviewResult(
            contract_version="v99_unsupported", interview_score=80.0, transcript=[]
        )


def test_idempotent_duplicate_updates():
    interview_payload = {"contract_version": "v0", "interview_score": 75.0, "transcript": []}
    profile = StudentProfileEvaluation(
        student_id="student_idempotent",
        resume=ResumeInput(score=70.0),
        projects=[
            ProjectItem(
                name="App",
                live_link_score=80.0,
                code_quality_score=75.0,
                documentation_score=70.0,
                is_live=True,
            )
        ],
        interview_session_result=CanonicalInterviewResult(**interview_payload),
    )

    report1 = PlacementReadinessCalculator.calculate_readiness(profile, save_to_db=False)
    report2 = PlacementReadinessCalculator.calculate_readiness(profile, save_to_db=False)
    assert report1.total_score == report2.total_score
    assert report1.readiness_level == report2.readiness_level


def test_from_profile_review_api_adapter():
    rishav_response = {
        "resume_review": {
            "score": 82,
            "is_one_page": True,
            "is_ats_friendly": True,
            "uses_action_verbs": False,
            "specific_fixes": ["Add measurable impact to project descriptions."],
        },
        "github_review": {"score": 76, "specific_fixes": ["Add README files"]},
        "linkedin_review": {
            "score": 79,
            "has_complete_profile": True,
            "skills_relevant": True,
            "suggested_rewrites": [],
        },
        "total_readiness_score": 79.0,
    }

    interview_payload = CanonicalInterviewResult(
        contract_version="v0", interview_score=85.0, transcript=[]
    )

    profile = StudentProfileEvaluation.from_profile_review_api(
        review_data=rishav_response,
        student_id="student_rishav_test",
        projects=[
            ProjectItem(
                name="App",
                live_link_score=90.0,
                code_quality_score=85.0,
                documentation_score=80.0,
                is_live=True,
            )
        ],
        interview_session_result=interview_payload,
    )

    assert profile.resume.score == 82.0
    assert profile.github.score == 76.0
    assert profile.linkedin.score == 79.0

    report = PlacementReadinessCalculator.calculate_readiness(profile, save_to_db=False)
    assert report.category_scores["resume"]["raw_score"] == 82.0
    assert report.category_scores["github"]["raw_score"] == 76.0
    assert report.category_scores["linkedin"]["raw_score"] == 79.0
    assert report.category_scores["mock_interview"]["raw_score"] == 85.0
    assert report.total_score > 70.0


def test_save_readiness_score_sqlite_fallback(monkeypatch, tmp_path):
    from src.db.supabase_client import SupabaseHandler

    client = SupabaseHandler()
    client.is_live = False
    client.supabase = None
    client.local_db_path = tmp_path / "test_local.db"
    client._init_local_fallback()

    payload = {
        "student_id": "test_student_fallback",
        "total_score": 85.5,
        "readiness_level": "Ready",
        "breakdown": {"resume": 80.0},
        "top_actions": [],
        "raw_inputs": {},
        "algorithm_version": "v1.0.0",
        "updated_at": "2026-10-21T00:00:00Z",
    }
    result = client.save_readiness_score(payload)
    assert result["success"] is True
    assert result["source"] == "local_sqlite"

