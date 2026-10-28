import logging
import re
import urllib.parse
from typing import Any, Optional

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

logger = logging.getLogger("profile_review_api.leetcode")

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"

USER_PROFILE_QUERY = """
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
        submissions
      }
    }
    submitStats {
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
    if not url_or_username or not str(url_or_username).strip():
        return ""
    cleaned = str(url_or_username).strip()
    cleaned = cleaned.split("?")[0].split("#")[0].rstrip("/")
    match = re.search(r"leetcode\.(?:com|cn)/(?:u/)?([a-zA-Z0-9_\-\.]+)", cleaned, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    raw = cleaned.replace("@", "").strip()
    if re.match(r"^[a-zA-Z0-9_\-\.]+$", raw):
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


def _fetch_from_mirror(username: str, timeout_seconds: float = 6.0) -> Optional[dict[str, Any]]:
    """
    High-availability fallback: retrieves profile from public stats API
    if LeetCode primary GraphQL is throttled or challenged by Cloudflare.
    """
    try:
        encoded_username = urllib.parse.quote(username)
        mirror_url = f"https://alfa-leetcode-api.onrender.com/userProfile/{encoded_username}"
        with httpx.Client(timeout=timeout_seconds, follow_redirects=True) as client:
            resp = client.get(mirror_url)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, dict) and "totalSolved" in data:
                    total_solved = int(data.get("totalSolved") or 0)
                    easy_solved = int(data.get("easySolved") or 0)
                    medium_solved = int(data.get("mediumSolved") or 0)
                    hard_solved = int(data.get("hardSolved") or 0)
                    ranking = data.get("ranking")
                    global_ranking = int(ranking) if ranking is not None else None
                    score = calculate_leetcode_score(
                        total_solved=total_solved,
                        easy_solved=easy_solved,
                        medium_solved=medium_solved,
                        hard_solved=hard_solved,
                        contest_rating=None,
                    )
                    logger.info("Successfully fetched LeetCode stats for '%s' from mirror fallback", username)
                    return {
                        "username": username,
                        "exists": True,
                        "total_solved": total_solved,
                        "easy_solved": easy_solved,
                        "medium_solved": medium_solved,
                        "hard_solved": hard_solved,
                        "contest_rating": None,
                        "global_ranking": global_ranking,
                        "score": score,
                        "error": None,
                    }
    except Exception as exc:
        logger.debug("LeetCode mirror fallback fetch failed for '%s': %s", username, exc)
    return None


def fetch_leetcode_stats(username_or_url: str, timeout_seconds: float = 8.0) -> dict[str, Any]:
    """
    Fetch student's solved problem counts (Easy, Medium, Hard) and contest rating
    from LeetCode public GraphQL API with automatic HTTP/2, browser emulation,
    and mirror fallback. Never raises unhandled HTTP 500 exceptions.
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
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/u/{urllib.parse.quote(username)}/",
        "Origin": "https://leetcode.com",
    }

    payload = {
        "query": USER_PROFILE_QUERY,
        "variables": {"username": username},
    }

    def _is_transient_leetcode_error(exc: BaseException) -> bool:
        if isinstance(exc, (httpx.RequestError, httpx.TimeoutException, ConnectionError, OSError)):
            return True
        return False

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=0.2, min=0.2, max=1.0),
        retry=retry_if_exception(_is_transient_leetcode_error),
        reraise=False,
    )
    def _execute_query():
        with httpx.Client(http2=True, timeout=timeout_seconds, follow_redirects=True) as client:
            return client.post(LEETCODE_GRAPHQL_URL, json=payload, headers=headers)

    try:
        response = _execute_query()

        if response is None or response.status_code != 200:
            status = response.status_code if response else "no_response"
            logger.warning("LeetCode GraphQL returned status %s for user '%s' — trying mirror fallback", status, username)
            mirror_result = _fetch_from_mirror(username, timeout_seconds=timeout_seconds)
            if mirror_result is not None:
                return mirror_result
            default_response["error"] = f"Link invalid or service unreachable (HTTP {status})"
            return default_response

        res_data = response.json()
        if not isinstance(res_data, dict):
            mirror_result = _fetch_from_mirror(username, timeout_seconds=timeout_seconds)
            return mirror_result or default_response

        data = res_data.get("data")
        if not isinstance(data, dict):
            mirror_result = _fetch_from_mirror(username, timeout_seconds=timeout_seconds)
            return mirror_result or default_response

        matched_user = data.get("matchedUser")
        if not matched_user or not isinstance(matched_user, dict):
            # Check mirror before assuming user does not exist
            mirror_result = _fetch_from_mirror(username, timeout_seconds=timeout_seconds)
            if mirror_result is not None:
                return mirror_result
            logger.info("LeetCode profile for '%s' does not exist.", username)
            return default_response

        total_solved = 0
        easy_solved = 0
        medium_solved = 0
        hard_solved = 0

        submit_stats = matched_user.get("submitStatsGlobal") or matched_user.get("submitStats") or {}
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

        # If submitStats returned 0 across all categories, cross-check with mirror
        if total_solved == 0:
            mirror_result = _fetch_from_mirror(username, timeout_seconds=timeout_seconds)
            if mirror_result and mirror_result.get("total_solved", 0) > 0:
                return mirror_result

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

        profile_data = matched_user.get("profile") or {}
        if global_ranking is None and isinstance(profile_data, dict) and profile_data.get("ranking") is not None:
            try:
                global_ranking = int(profile_data["ranking"])
            except (ValueError, TypeError):
                pass

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
        logger.warning("Error fetching LeetCode stats for '%s': %s — attempting mirror fallback", username, exc)
        mirror_result = _fetch_from_mirror(username, timeout_seconds=timeout_seconds)
        if mirror_result is not None:
            return mirror_result
        default_response["error"] = f"Link invalid or service unreachable: {exc}"
        return default_response
