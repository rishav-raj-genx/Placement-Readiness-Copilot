from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from leetcode_service import (
    calculate_leetcode_score,
    extract_leetcode_username,
    fetch_leetcode_stats,
)
from main import app

client = TestClient(app)


def test_extract_leetcode_username() -> None:
    assert extract_leetcode_username("https://leetcode.com/u/rishav-raj") == "rishav-raj"
    assert extract_leetcode_username("https://leetcode.com/rishav-raj/") == "rishav-raj"
    assert extract_leetcode_username("https://leetcode.com/u/rishav_99?tab=overview") == "rishav_99"
    assert extract_leetcode_username("@rishav") == "rishav"
    assert extract_leetcode_username("rishav-raj") == "rishav-raj"
    assert extract_leetcode_username("") == ""


def test_calculate_leetcode_score() -> None:
    # 0 solved
    assert calculate_leetcode_score(0, 0, 0, 0) == 0

    # >300 solved with solid medium/hard ratio (>=150) = 100/100
    perfect_score = calculate_leetcode_score(
        total_solved=320,
        easy_solved=120,
        medium_solved=160,
        hard_solved=40,
    )
    assert perfect_score == 100

    # Moderate solved: 150 solved (50 Easy, 85 Medium, 15 Hard)
    mod_score = calculate_leetcode_score(
        total_solved=150,
        easy_solved=50,
        medium_solved=85,
        hard_solved=15,
    )
    assert 50 <= mod_score <= 80

    # Low solved
    low_score = calculate_leetcode_score(
        total_solved=25,
        easy_solved=20,
        medium_solved=5,
        hard_solved=0,
    )
    assert 0 < low_score <= 25


def test_fetch_leetcode_stats_nonexistent_user() -> None:
    # Mocking LeetCode response for non-existent user
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "data": {
            "matchedUser": None,
            "userContestRanking": None,
        }
    }

    with patch("httpx.Client.post", return_value=mock_resp):
        stats = fetch_leetcode_stats("this_user_does_not_exist_xyz")
        assert stats["exists"] is False
        assert stats["total_solved"] == 0
        assert stats["score"] == 0
        assert stats["error"] is None


def test_fetch_leetcode_stats_success() -> None:
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "data": {
            "matchedUser": {
                "username": "rishav_coder",
                "submitStats": {
                    "acSubmissionNum": [
                        {"difficulty": "All", "count": 350},
                        {"difficulty": "Easy", "count": 100},
                        {"difficulty": "Medium", "count": 200},
                        {"difficulty": "Hard", "count": 50},
                    ]
                },
                "profile": {"ranking": 25000, "reputation": 10},
            },
            "userContestRanking": {
                "rating": 1820.5,
                "globalRanking": 12000,
            },
        }
    }

    with patch("httpx.Client.post", return_value=mock_resp):
        stats = fetch_leetcode_stats("https://leetcode.com/u/rishav_coder")
        assert stats["exists"] is True
        assert stats["username"] == "rishav_coder"
        assert stats["total_solved"] == 350
        assert stats["easy_solved"] == 100
        assert stats["medium_solved"] == 200
        assert stats["hard_solved"] == 50
        assert stats["contest_rating"] == 1820.5
        assert stats["score"] == 100


def test_review_leetcode_endpoint(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_SERVICE_KEY", "test-secret-key-1234")
    monkeypatch.setenv("E2E_MODE", "false")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "data": {
            "matchedUser": None,
            "userContestRanking": None,
        }
    }

    with patch("httpx.Client.post", return_value=mock_resp):
        response = client.get(
            "/review/leetcode/nonexistent_person",
            headers={"Authorization": "Bearer test-secret-key-1234"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "nonexistent_person"
        assert data["score"] == 0
        assert data["exists"] is False
