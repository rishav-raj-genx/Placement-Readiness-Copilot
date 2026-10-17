"""
Staging End-to-End Verification Script:
LiveKit Worker -> Supabase interview_sessions -> Readiness Engine -> Supabase readiness_scores
"""

import sys

# Ensure import paths
sys.path.insert(0, ".")

from src.db.supabase_client import db_client
from src.readiness_score.calculator import PlacementReadinessCalculator
from src.readiness_score.models import (
    CANONICAL_INTERVIEW_CONTRACT_VERSION,
    CanonicalInterviewResult,
    StudentProfileEvaluation,
)


def run_staging_verification(student_id: str = "staging_student_test"):
    print(f"=== STAGING E2E VERIFICATION FOR STUDENT: {student_id} ===")

    if not db_client.is_live or not db_client.supabase:
        print(
            "❌ Error: Supabase client is not connected. Check SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY in .env"
        )
        return False

    client = db_client.supabase

    # 1. Fetch latest interview_session for the student
    print(f"1. Querying Supabase 'interview_sessions' for student '{student_id}'...")
    res = (
        client.table("interview_sessions")
        .select("*")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not res.data:
        print(
            f"❌ No completed interview session found for '{student_id}'. Run a real staging interview first."
        )
        return False

    session_row = res.data[0]
    print(f"✔ Found session id: {session_row['id']} (status: {session_row.get('status')})")
    if session_row.get("status") != "completed":
        print(f"❌ Session is not completed: {session_row.get('status')}")
        return False
    if not session_row.get("completed_at"):
        print("❌ Session completed_at is missing.")
        return False

    # 2. Verify payload and contract_version
    result_json = session_row.get("result")
    if not result_json or not isinstance(result_json, dict):
        print("❌ Failure: interview_sessions.result is empty or not a JSON object.")
        return False

    contract_version = result_json.get("contract_version")
    print(f"2. Validating contract_version: '{contract_version}'...")
    if contract_version != CANONICAL_INTERVIEW_CONTRACT_VERSION:
        print(
            f"❌ Contract Version Mismatch: Expected '{CANONICAL_INTERVIEW_CONTRACT_VERSION}', got '{contract_version}'. REJECTED."
        )
        return False
    print(
        f"✔ Contract version is exactly '{CANONICAL_INTERVIEW_CONTRACT_VERSION}' (numeric zero '0')."
    )

    # 3. Verify interview_score and decimal precision
    score_raw = result_json.get("interview_score")
    print(f"3. Validating interview_score: {score_raw} (type: {type(score_raw).__name__})...")
    if score_raw is None or not (0.0 <= float(score_raw) <= 100.0):
        print(f"❌ Score out of range or null: {score_raw}. REJECTED.")
        return False
    score_float = float(score_raw)
    print(f"✔ Preserved decimal interview score: {score_float}")

    dimensions = result_json.get("dimensions")
    required_dimensions = {"technical_depth", "communication", "behavioral"}
    if not isinstance(dimensions, dict) or not required_dimensions.issubset(dimensions):
        print("❌ Required interview dimensions are missing. REJECTED.")
        return False
    print("✔ All required interview dimensions are present.")

    # 4. Ingest into readiness engine
    print("4. Calculating readiness score with 20% mock-interview weighting...")
    interview_model = CanonicalInterviewResult(**result_json)
    profile = StudentProfileEvaluation(
        student_id=student_id, interview_session_result=interview_model
    )

    report = PlacementReadinessCalculator.calculate_readiness(
        profile,
        save_to_db=True,
        require_supabase=True,
    )
    interview_points = report.category_scores["mock_interview"]["weighted_points"]
    expected_points = round(score_float * 0.20, 2)

    print(
        f"✔ Mock interview weighted points: {interview_points} pts (Expected: {expected_points} pts)"
    )
    assert interview_points == expected_points, "Weight calculation mismatch!"

    print(f"✔ Total calculated readiness score: {report.total_score}/100")
    print("✔ Stored to Supabase 'readiness_scores' table successfully.")

    print("\n✅ ALL 7 STAGING E2E VERIFICATION CRITERIA PASSED!")
    return True


if __name__ == "__main__":
    sid = sys.argv[1] if len(sys.argv) > 1 else "staging_student_test"
    success = run_staging_verification(sid)
    sys.exit(0 if success else 1)
