import logging
import re
from typing import Any, Optional

import httpx

logger = logging.getLogger("profile_review_api.leetcode")

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"

USER_PROFILE_QUERY = """
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    submitStats: submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
        submissions
      }
    }
    profile {
      ranking
      reputation
    }
  }
  userContestRanking(username: $username) {
    rating
    globalRanking
    totalParticipants
    topPercentage
  }
}
"""


def extract_leetcode_username(url_or_username: str) -> str:
    """Extract clean LeetCode username from URL or raw username string."""
    if not url_or_username or not url_or_username.strip():
        return ""
    cleaned = url_or_username.strip()
    cleaned = cleaned.split("?")[0].split("#")[0].rstrip("/")
    match = re.search(r"leetcode\.com/(?:u/)?([a-zA-Z0-9_\-]+)", cleaned, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    raw = cleaned.replace("@", "").strip()
    if re.match(r"^[a-zA-Z0-9_\-]+$", raw):
        return raw
    return ""


def calculate_leetcode_score(
    total_solved: int,
    easy_solved: int,
    medium_solved: int,
    hard_solved: int,
    contest_rating: Optional[float] = None,
) -> int:
    """
    Convert LeetCode solved counts and contest rating into a score out of 100.
    Rule: >300 problems with a solid medium/hard ratio (>=150) = 100/100.
    """
    if total_solved <= 0:
        return 0

    med_hard = medium_solved + hard_solved

    # Benchmark: >300 problems with solid medium/hard ratio gives 100/100
    if total_solved >= 300 and med_hard >= 150:
        return 100

    # 1. Problem volume score (up to 70 points for 300 problems)
    volume_score = min(70.0, (total_solved / 300.0) * 70.0)

    # 2. Difficulty & quality distribution score (up to 25 points)
    quality_score = min(25.0, (med_hard / 150.0) * 20.0 + min(5.0, hard_solved / 4.0))

    # 3. Contest rating or hard problem mastery bonus (up to 15 points)
    contest_bonus = 0.0
    if contest_rating is not None and contest_rating > 0:
        if contest_rating >= 1850:
            contest_bonus = 15.0
        elif contest_rating >= 1650:
            contest_bonus = 10.0
        elif contest_rating >= 1500:
            contest_bonus = 5.0
    elif hard_solved >= 25:
        contest_bonus = 10.0
    elif hard_solved >= 10:
        contest_bonus = 5.0

    raw_total = volume_score + quality_score + contest_bonus
    return max(0, min(100, round(raw_total)))


def fetch_leetcode_stats(username_or_url: str, timeout_seconds: float = 8.0) -> dict[str, Any]:
    """
    Fetch student's solved problem counts (Easy, Medium, Hard) and contest rating
    from LeetCode public GraphQL API. Never raises unhandled HTTP 500 exceptions.
    """
    username = extract_leetcode_username(username_or_url)
    default_response: dict[str, Any] = {
        "username": username,
        "exists": False,
        "total_solved": 0,
        "easy_solved": 0,
        "medium_solved": 0,
        "hard_solved": 0,
        "contest_rating": None,
        "global_ranking": None,
        "score": 0,
        "error": None,
    }

    if not username:
        return default_response

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
    }

    payload = {
        "query": USER_PROFILE_QUERY,
        "variables": {"username": username},
    }

    try:
        with httpx.Client(timeout=timeout_seconds, follow_redirects=True) as client:
            response = client.post(LEETCODE_GRAPHQL_URL, json=payload, headers=headers)

        if response.status_code != 200:
            logger.warning("LeetCode GraphQL returned HTTP %s for user %s", response.status_code, username)
            default_response["error"] = f"HTTP {response.status_code}"
            return default_response

        res_data = response.json()
        if not isinstance(res_data, dict):
            return default_response

        data = res_data.get("data")
        if not isinstance(data, dict):
            return default_response

        matched_user = data.get("matchedUser")
        if not matched_user or not isinstance(matched_user, dict):
            # User does not exist on LeetCode
            logger.info("LeetCode profile for '%s' does not exist.", username)
            return default_response

        total_solved = 0
        easy_solved = 0
        medium_solved = 0
        hard_solved = 0

        submit_stats = matched_user.get("submitStats") or {}
        ac_submissions = submit_stats.get("acSubmissionNum") or []

        for item in ac_submissions:
            if not isinstance(item, dict):
                continue
            diff = str(item.get("difficulty") or "").lower()
            count = int(item.get("count") or 0)
            if diff == "all":
                total_solved = count
            elif diff == "easy":
                easy_solved = count
            elif diff == "medium":
                medium_solved = count
            elif diff == "hard":
                hard_solved = count

        contest = data.get("userContestRanking") or {}
        contest_rating: Optional[float] = None
        global_ranking: Optional[int] = None

        if isinstance(contest, dict):
            if contest.get("rating") is not None:
                try:
                    contest_rating = round(float(contest["rating"]), 1)
                except (ValueError, TypeError):
                    contest_rating = None
            if contest.get("globalRanking") is not None:
                try:
                    global_ranking = int(contest["globalRanking"])
                except (ValueError, TypeError):
                    global_ranking = None

        score = calculate_leetcode_score(
            total_solved=total_solved,
            easy_solved=easy_solved,
            medium_solved=medium_solved,
            hard_solved=hard_solved,
            contest_rating=contest_rating,
        )

        return {
            "username": username,
            "exists": True,
            "total_solved": total_solved,
            "easy_solved": easy_solved,
            "medium_solved": medium_solved,
            "hard_solved": hard_solved,
            "contest_rating": contest_rating,
            "global_ranking": global_ranking,
            "score": score,
            "error": None,
        }

    except Exception as exc:
        logger.warning("Error fetching LeetCode stats for '%s': %s", username, exc)
        default_response["error"] = str(exc)
        return default_response
