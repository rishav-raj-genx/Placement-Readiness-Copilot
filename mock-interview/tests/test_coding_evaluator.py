from __future__ import annotations

from fastapi.testclient import TestClient

from app import create_app
from scoring.coding_evaluator import evaluate_coding_submission


def test_evaluate_two_sum_optimal():
    code = """
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
"""
    result = evaluate_coding_submission("two_sum", "python", code)
    assert result.overall_score >= 85
    assert result.estimated_time_complexity == "O(N)"
    assert result.passed_tests == 0
    assert result.evaluation_mode == "static_ast_analysis"
    assert result.test_execution_status == "sandbox_pending"
    assert "optimal" in result.complexity_comparison.lower()
    assert len(result.strengths) >= 1
    assert "sorted" in result.interviewer_follow_up


def test_evaluate_two_sum_suboptimal_nested():
    code = """
def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
"""
    result = evaluate_coding_submission("two_sum", "python", code)
    assert result.estimated_time_complexity == "O(N^2)"
    assert "nested" in result.complexity_comparison.lower()


def test_evaluate_webdev_debounce():
    code = """
function debounce(fn, delayMs) {
    let timer = null;
    function wrapped(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn(...args);
            timer = null;
        }, delayMs);
    }
    wrapped.cancel = () => {
        if (timer) clearTimeout(timer);
    };
    return wrapped;
}
"""
    result = evaluate_coding_submission("use_debounce", "javascript", code)
    assert result.overall_score >= 80
    assert "closure" in result.complexity_comparison.lower()


def test_coding_endpoints_via_testclient():
    app = create_app(require_auth=False)
    client = TestClient(app)

    # 1. Test get problems
    resp = client.get("/api/interview/coding-problems")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert len(data["problems"]) >= 3

    # 2. Test evaluate endpoint
    eval_resp = client.post(
        "/api/interview/coding-evaluate",
        json={
            "problem_id": "two_sum",
            "language": "python",
            "code": "def two_sum(n, t): return [0, 1]",
        },
    )
    assert eval_resp.status_code == 200
    eval_data = eval_resp.json()
    assert eval_data["status"] == "ok"
    assert "overall_score" in eval_data["result"]
    assert eval_data["result"]["passed_tests"] == 0
    assert eval_data["result"]["test_execution_status"] == "sandbox_pending"

    # 3. Test require_auth rejection
    auth_app = create_app(require_auth=True)
    auth_client = TestClient(auth_app)
    unauth_resp = auth_client.post(
        "/api/interview/coding-evaluate",
        json={
            "problem_id": "two_sum",
            "language": "python",
            "code": "def two_sum(n, t): return [0, 1]",
        },
    )
    assert unauth_resp.status_code == 401


def test_evaluate_sandboxed_execution():
    code = """
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
"""
    result = evaluate_coding_submission("two_sum", "python", code, run_sandbox=True)
    assert result.evaluation_mode == "isolated_sandbox_execution"
    assert result.test_execution_status == "passed"
    assert result.passed_tests == 3
    assert result.overall_score >= 85

