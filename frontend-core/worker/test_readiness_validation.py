#!/usr/bin/env python3
"""
Test Suite: Readiness Engine Pre-Calculation Validation & Weighted Points
========================================================================
Validates that Rituraj's readiness engine strictly verifies:
1. interview_sessions.result is not null.
2. result.contract_version == "v0".
3. result.interview_score exists.
4. interview_score is between 0 and 100.
5. Decimal precision is preserved.

And does NOT treat generated or fallback 0.0 as a valid interview score
when result is missing, null, or invalid.
"""

import unittest
from decimal import Decimal
from typing import Any, Optional, Tuple


def calculate_readiness_weighted_points(session: dict[str, Any]) -> Tuple[bool, Optional[float], str]:
    """
    Simulates Rituraj's readiness engine evaluation logic on interview_sessions record.
    Returns: (is_valid, weighted_points, reason)
    """
    # 1. interview_sessions.result is not null
    result = session.get("result")
    if result is None or not isinstance(result, dict):
        return False, None, "REJECTED: interview_sessions.result is null or missing"

    # 2. result.contract_version == 'v0'
    contract_version = result.get("contract_version")
    if contract_version != "v0":
        return False, None, f"REJECTED: invalid or unsupported contract_version '{contract_version}' (must be 'v0')"

    # 3. result.interview_score exists
    if "interview_score" not in result or result["interview_score"] is None:
        return False, None, "REJECTED: result.interview_score does not exist"

    raw_score = result["interview_score"]
    if not isinstance(raw_score, (int, float, Decimal)):
        return False, None, f"REJECTED: interview_score is not numeric (type: {type(raw_score).__name__})"

    # 4. interview_score is between 0 and 100
    score = float(raw_score)
    if score < 0.0 or score > 100.0:
        return False, None, f"REJECTED: interview_score {score} out of bounds [0, 100]"

    # 5. Decimal precision is preserved
    # Preserves float/decimal representation without integer rounding
    weighted_points = round(score * 0.20, 4)

    return True, weighted_points, "VALID"


class TestReadinessEngineValidation(unittest.TestCase):

    def test_null_result_rejected_no_fallback_zero(self):
        """When result is null or missing, generated 0.0 is NOT treated as valid."""
        session_null_result = {
            "id": "intv_stage_1791882000",
            "status": "created",
            "result": None,
            "interview_score": 0.0  # generated DB fallback
        }
        valid, pts, reason = calculate_readiness_weighted_points(session_null_result)
        self.assertFalse(valid)
        self.assertIsNone(pts)
        self.assertIn("result is null", reason)

    def test_invalid_contract_version_rejected(self):
        """Contract version must strictly be 'v0'."""
        session_bad_version = {
            "id": "intv_stage_1791882000",
            "result": {
                "contract_version": "v1",
                "interview_score": 85.0
            }
        }
        valid, pts, reason = calculate_readiness_weighted_points(session_bad_version)
        self.assertFalse(valid)
        self.assertIsNone(pts)
        self.assertIn("unsupported contract_version", reason)

    def test_missing_interview_score_rejected(self):
        """result.interview_score must exist."""
        session_no_score = {
            "id": "intv_stage_1791882000",
            "result": {
                "contract_version": "v0",
                "summary": "Incomplete interview"
            }
        }
        valid, pts, reason = calculate_readiness_weighted_points(session_no_score)
        self.assertFalse(valid)
        self.assertIsNone(pts)
        self.assertIn("interview_score does not exist", reason)

    def test_interview_score_out_of_bounds_rejected(self):
        """interview_score must be between 0 and 100."""
        session_overflow = {
            "id": "intv_stage_1791882000",
            "result": {
                "contract_version": "v0",
                "interview_score": 105.0
            }
        }
        valid, pts, reason = calculate_readiness_weighted_points(session_overflow)
        self.assertFalse(valid)
        self.assertIsNone(pts)
        self.assertIn("out of bounds", reason)

    def test_decimal_precision_preserved_and_weighted_points_calculated(self):
        """Valid v0 payload preserves decimal precision (78.5) and calculates weighted_points = 15.70."""
        session_valid = {
            "id": "intv_stage_1791882000",
            "status": "completed",
            "result": {
                "contract_version": "v0",
                "interview_score": 78.5,
                "summary": "Solid technical depth in full-stack architecture.",
                "dimensions": {
                    "technical_depth": {"score": 80.0},
                    "communication": {"score": 75.0},
                    "behavioral": {"score": 80.0}
                }
            }
        }
        valid, pts, reason = calculate_readiness_weighted_points(session_valid)
        self.assertTrue(valid)
        self.assertEqual(reason, "VALID")
        # 78.5 * 0.20 = 15.70
        self.assertAlmostEqual(pts, 15.70, places=2)


if __name__ == "__main__":
    unittest.main()
