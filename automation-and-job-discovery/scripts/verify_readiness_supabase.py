"""Calculate the canonical fixture and verify its persisted Supabase row."""

import json

from src.db.supabase_client import db_client
from src.readiness_score.calculator import PlacementReadinessCalculator
from src.readiness_score.models import (
    CanonicalInterviewResult,
    CoCurricularInput,
    CodingPracticeInput,
    GitHubActivityInput,
    LinkedInInput,
    ProjectItem,
    ResumeInput,
    StudentProfileEvaluation,
)

STUDENT_ID = "automation_integration_test"


def build_fixture() -> StudentProfileEvaluation:
    return StudentProfileEvaluation(
        student_id=STUDENT_ID,
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
        coding_practice=CodingPracticeInput(score=70.0),
        linkedin=LinkedInInput(score=90.0),
        co_curricular=CoCurricularInput(score=60.0),
    )


def main() -> None:
    if not db_client.is_live or db_client.supabase is None:
        raise SystemExit(
            "Supabase is not configured. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY before running this verifier."
        )

    report = PlacementReadinessCalculator.calculate_readiness(
        build_fixture(),
        save_to_db=True,
        require_supabase=True,
    )
    response = (
        db_client.supabase.table("readiness_scores")
        .select(
            "student_id,total_score,readiness_level,breakdown,top_actions,"
            "algorithm_version,updated_at"
        )
        .eq("student_id", STUDENT_ID)
        .single()
        .execute()
    )
    persisted = response.data
    if not persisted or float(persisted["total_score"]) != report.total_score:
        raise RuntimeError("Supabase read-back did not match the calculated score")

    print(json.dumps({"report": report.model_dump(), "persisted": persisted}, indent=2))


if __name__ == "__main__":
    main()
