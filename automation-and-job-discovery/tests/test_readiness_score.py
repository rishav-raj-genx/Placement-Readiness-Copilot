import pytest
from pydantic import ValidationError
from src.readiness_score.models import (
    StudentProfileEvaluation,
    ResumeInput,
    ProjectItem,
    CanonicalInterviewResult,
    GitHubActivityInput,
    CodingPracticeInput,
    LinkedInInput,
    CoCurricularInput,
    ALGORITHM_VERSION
)
from src.readiness_score.calculator import PlacementReadinessCalculator, WEIGHTS

def test_weights_sum_to_one():
    total_weight = sum(WEIGHTS.values())
    assert abs(total_weight - 1.0) < 0.0001

def test_all_scores_present_canonical_interview():
    interview_payload = {
        "contract_version": "v0",
        "interview_score": 85.0,
        "transcript": [{"speaker": "ai", "text": "Hello"}],
        "summary": "Solid technical performance",
        "dimensions": {
            "technical_depth": {"score": 85.0, "feedback": "Good architecture"},
            "communication": {"score": 85.0, "feedback": "Clear answers"},
            "behavioral": {"score": 85.0, "feedback": "Collaborative mindset"}
        }
    }
    profile = StudentProfileEvaluation(
        student_id="student_complete",
        resume=ResumeInput(score=80.0),
        projects=[ProjectItem(name="App", live_link_score=90.0, code_quality_score=85.0, documentation_score=80.0, is_live=True)],
        interview_session_result=CanonicalInterviewResult(**interview_payload),
        github=GitHubActivityInput(score=75.0),
        coding_practice=CodingPracticeInput(score=80.0),
        linkedin=LinkedInInput(score=70.0),
        co_curricular=CoCurricularInput(score=85.0)
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
        projects=[ProjectItem(name="App", live_link_score=90.0, code_quality_score=90.0, documentation_score=90.0, is_live=True)],
        interview_session_result=None,  # Missing!
        github=GitHubActivityInput(score=90.0),
        coding_practice=CodingPracticeInput(score=90.0),
        linkedin=LinkedInInput(score=90.0),
        co_curricular=CoCurricularInput(score=90.0)
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
    interview_payload = {
        "contract_version": "v0",
        "interview_score": 80.0,
        "transcript": []
    }
    profile = StudentProfileEvaluation(
        student_id="student_missing_inputs",
        resume=None,
        projects=[],
        interview_session_result=CanonicalInterviewResult(**interview_payload),
        github=None,
        coding_practice=None,
        linkedin=None,
        co_curricular=None
    )

    report = PlacementReadinessCalculator.calculate_readiness(profile, save_to_db=False)
    assert report.is_provisional is True
    assert "resume" in report.missing_components
    assert "projects" in report.missing_components
    assert report.readiness_level == "Not ready"

def test_out_of_range_values_are_clamped():
    interview_payload = {
        "contract_version": "v0",
        "interview_score": 100.0,  # Validated in model
        "transcript": []
    }
    profile = StudentProfileEvaluation(
        student_id="student_out_of_range",
        resume=ResumeInput(score=100.0),
        projects=[ProjectItem(name="App", live_link_score=100.0, code_quality_score=100.0, documentation_score=100.0, is_live=True)],
        interview_session_result=CanonicalInterviewResult(**interview_payload)
    )
    # Test internal clamp
    assert PlacementReadinessCalculator.clamp(150.0) == 100.0
    assert PlacementReadinessCalculator.clamp(-35.0) == 0.0

def test_unsupported_contract_version_rejected():
    with pytest.raises(ValidationError):
        CanonicalInterviewResult(
            contract_version="v99_unsupported",
            interview_score=80.0,
            transcript=[]
        )

def test_idempotent_duplicate_updates():
    interview_payload = {
        "contract_version": "v0",
        "interview_score": 75.0,
        "transcript": []
    }
    profile = StudentProfileEvaluation(
        student_id="student_idempotent",
        resume=ResumeInput(score=70.0),
        projects=[ProjectItem(name="App", live_link_score=80.0, code_quality_score=75.0, documentation_score=70.0, is_live=True)],
        interview_session_result=CanonicalInterviewResult(**interview_payload)
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
            "specific_fixes": [
                "Add measurable impact to project descriptions."
            ]
        },
        "github_review": {
            "score": 76,
            "specific_fixes": ["Add README files"]
        },
        "linkedin_review": {
            "score": 79,
            "has_complete_profile": True,
            "skills_relevant": True,
            "suggested_rewrites": []
        },
        "total_readiness_score": 79.0
    }

    interview_payload = CanonicalInterviewResult(
        contract_version="v0",
        interview_score=85.0,
        transcript=[]
    )

    profile = StudentProfileEvaluation.from_profile_review_api(
        review_data=rishav_response,
        student_id="student_rishav_test",
        projects=[ProjectItem(name="App", live_link_score=90.0, code_quality_score=85.0, documentation_score=80.0, is_live=True)],
        interview_session_result=interview_payload
    )

    assert profile.resume.score == 82.0
    assert profile.github.score == 76.0
    assert profile.linkedin.score == 79.0
    assert profile.coding_practice is None  # Optional/absent LeetCode

    report = PlacementReadinessCalculator.calculate_readiness(profile, save_to_db=False)
    assert report.category_scores["resume"]["raw_score"] == 82.0
    assert report.category_scores["github"]["raw_score"] == 76.0
    assert report.category_scores["linkedin"]["raw_score"] == 79.0
    assert report.category_scores["mock_interview"]["raw_score"] == 85.0
    assert report.total_score > 70.0

