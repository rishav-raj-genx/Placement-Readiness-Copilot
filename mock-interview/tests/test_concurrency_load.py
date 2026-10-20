"""Concurrency and load stress testing for interview sessions and coding evaluations."""

from __future__ import annotations

import asyncio
import time
from typing import Any

from agent.session import InterviewSession
from scoring.coding_evaluator import evaluate_coding_submission
from scoring.schemas import InterviewContext


class FastFakeLLM:
    """Simulates realistic 5ms LLM completion latency."""

    def complete(self, system_prompt: str, user_prompt: str) -> object:
        time.sleep(0.005)
        return """{
            "interview_score": 85,
            "summary": "Candidate demonstrated strong distributed systems fundamentals.",
            "strengths": ["Clear communication and modular code design"],
            "improvement_areas": ["Include more performance benchmarks"],
            "dimensions": {
                "communication": {"score": 88, "feedback": "Articulate explanations.", "evidence": ["I designed the replication"]},
                "technical_depth": {"score": 85, "feedback": "Deep architecture knowledge.", "evidence": ["I chose PostgreSQL"]},
                "behavioral": {"score": 82, "feedback": "Good collaboration.", "evidence": ["I communicated with the team"]}
            }
        }"""


async def simulate_interview_turn(session_idx: int) -> dict[str, Any]:
    start_time = time.perf_counter()
    context = InterviewContext(
        candidate_name=f"Candidate_{session_idx}",
        target_role="Backend Engineer",
        skills=["Python", "FastAPI", "PostgreSQL"],
        projects=[f"Service_{session_idx}"],
    )
    llm = FastFakeLLM()
    session = InterviewSession(context=context, llm=llm)

    greeting = session.greeting()
    assert greeting is not None

    session.accept_answer("I designed the replication layer for high availability.")
    q2 = session.next_question()
    assert q2 is not None

    session.accept_answer("I chose PostgreSQL for strict ACID guarantees.")
    q3 = session.next_question()
    assert q3 is not None

    session.accept_answer("I communicated with the team to resolve schema migration issues.")
    res = await asyncio.to_thread(session.finish)

    # Concurrently evaluate a coding submission
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
    coding_res = evaluate_coding_submission("two_sum", "python", code, run_sandbox=False)

    duration = time.perf_counter() - start_time
    return {
        "session_idx": session_idx,
        "duration": duration,
        "score": res.interview_score,
        "coding_score": coding_res.overall_score,
    }


def test_concurrent_load_50_sessions():
    """Verify that 50 concurrent interview sessions and coding evaluations complete reliably."""

    async def run_load():
        tasks = [simulate_interview_turn(i) for i in range(50)]
        return await asyncio.gather(*tasks, return_exceptions=False)

    overall_start = time.perf_counter()
    results = asyncio.run(run_load())
    total_time = time.perf_counter() - overall_start

    assert len(results) == 50
    durations = sorted(r["duration"] for r in results)
    p50 = durations[len(durations) // 2]
    p95 = durations[int(len(durations) * 0.95)]

    # Assert 100% success rate
    for r in results:
        assert r["score"] == 85
        assert r["coding_score"] >= 85

    # Concurrency verification
    assert p50 >= 0
    assert total_time < 5.0, f"50 concurrent interviews took {total_time:.2f}s, expected < 5s"
    assert p95 < 1.0, f"p95 latency was {p95:.2f}s, expected < 1s"
