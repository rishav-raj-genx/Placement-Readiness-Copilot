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


def test_evaluate_compile_error_on_syntax_mismatch():
    # JavaScript code submitted under Python mode (as seen in user screenshot)
    code = """
async function fetchWithRetry(url, options = {}, maxRetries = 3, backoffMs = 200) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url, options);
            return res;
        } catch (err) {
            throw err;
        }
    }
}
"""
    result = evaluate_coding_submission("fetch_with_retry", "python", code)
    assert result.test_execution_status == "compile_error"
    assert result.overall_score == 0
    assert result.passed_tests == 0
    assert "compile error" in result.complexity_comparison.lower()



def test_round1_gating_and_activation(monkeypatch):
    from scoring.result_store import record_round1_completed

    monkeypatch.setenv("INTERNAL_SERVICE_KEY", "test-internal-secret")
    app = create_app(require_auth=True)
    client = TestClient(app)
    headers = {"Authorization": "Bearer test-internal-secret"}

    # 1. Candidate who has not completed Round 1 is locked out
    candidate_id = "student_gate_test_101"
    locked_resp = client.get(f"/api/interview/coding-problems?student_id={candidate_id}", headers=headers)
    assert locked_resp.status_code == 200
    locked_data = locked_resp.json()
    assert locked_data["status"] == "locked"
    assert locked_data["round1_completed"] is False
    assert len(locked_data["problems"]) == 0

    locked_eval = client.post(
        "/api/interview/coding-evaluate",
        headers=headers,
        json={
            "student_id": candidate_id,
            "problem_id": "two_sum",
            "language": "python",
            "code": "def two_sum(n, t): return [0, 1]",
        },
    )
    assert locked_eval.status_code == 200
    eval_locked_data = locked_eval.json()
    assert eval_locked_data["status"] == "locked"
    assert eval_locked_data["round1_completed"] is False

    # 2. Candidate completes Round 1
    record_round1_completed(candidate_id)

    # 3. Candidate is now unlocked for Round 2
    active_resp = client.get(f"/api/interview/coding-problems?student_id={candidate_id}", headers=headers)
    assert active_resp.status_code == 200
    active_data = active_resp.json()
    assert active_data["status"] == "ok"
    assert active_data["round1_completed"] is True
    assert len(active_data["problems"]) >= 3

    # 4. Candidate submits code on IDE -> Evaluates and provides follow-up
    eval_resp = client.post(
        "/api/interview/coding-evaluate",
        headers=headers,
        json={
            "student_id": candidate_id,
            "problem_id": "two_sum",
            "language": "python",
            "code": "def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen: return [seen[target - num], i]\n        seen[num] = i\n    return []",
        },
    )
    assert eval_resp.status_code == 200
    eval_data = eval_resp.json()
    assert eval_data["status"] == "ok"
    assert eval_data["result"]["next_problem_id"] == "lru_cache"
    assert "sorted" in eval_data["result"]["interviewer_follow_up"]

    # 5. Candidate answers the follow-up question -> Evaluator assesses and asks next question
    follow_up_resp = client.post(
        "/api/interview/coding-evaluate",
        headers=headers,
        json={
            "student_id": candidate_id,
            "problem_id": "two_sum",
            "language": "python",
            "code": "def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen: return [seen[target - num], i]\n        seen[num] = i\n    return []",
            "follow_up_answer": "I would use two pointers from left and right moving inwards.",
        },
    )
    assert follow_up_resp.status_code == 200
    follow_up_data = follow_up_resp.json()
    assert follow_up_data["status"] == "ok"
    assert "Two-Pointer" in follow_up_data["result"]["interviewer_follow_up"]
    assert "LRU Cache" in follow_up_data["result"]["interviewer_follow_up"]
    assert follow_up_data["result"]["next_problem_id"] == "lru_cache"


def test_evaluate_wrong_code_fails_in_sandbox():
    wrong_code = "def two_sum(nums, target):\n    return []\n"
    res = evaluate_coding_submission("two_sum", "python", wrong_code, run_sandbox=True)
    assert res.passed_tests == 0
    assert res.total_tests > 0
    assert res.overall_score <= 25
    assert res.test_execution_status == "failed"


def test_evaluate_missing_target_function():
    code = "def unrelated_fn(x):\n    return x + 1\n"
    res = evaluate_coding_submission("two_sum", "python", code, run_sandbox=False)
    assert res.overall_score <= 30
    assert any("two sum" in imp.lower() for imp in res.improvement_areas)


def test_unknown_problem_id_rejected():
    import pytest
    with pytest.raises(ValueError, match="Unknown problem_id"):
        evaluate_coding_submission("unknown_problem_xyz", "python", "x = 1")


def test_api_unknown_problem_id_returns_400():
    client = TestClient(create_app(require_auth=False))
    resp = client.post(
        "/api/interview/coding-evaluate",
        json={
            "student_id": "test_stud",
            "problem_id": "invalid_prob_123",
            "language": "python",
            "code": "print(1)",
        },
    )
    assert resp.status_code == 400
    assert "Unknown problem ID" in resp.json()["detail"]


def test_api_run_action_does_not_persist():
    client = TestClient(create_app(require_auth=False))
    resp = client.post(
        "/api/interview/coding-evaluate",
        json={
            "student_id": "test_stud",
            "problem_id": "two_sum",
            "language": "python",
            "code": "def two_sum(nums, target):\n    return [0, 1]\n",
            "action": "run",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["persisted"] is False


