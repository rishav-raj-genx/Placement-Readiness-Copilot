"""Deterministic providers used only by the repository E2E harness."""

from __future__ import annotations

from scoring.schemas import InterviewResult


class DeterministicInterviewLLM:
    def complete(self, system_prompt: str, user_prompt: str) -> object:
        if "Return only valid JSON" not in system_prompt:
            raise ValueError("scoring system prompt contract is missing")
        if "Interview transcript" not in user_prompt:
            raise ValueError("interview transcript is missing from scoring prompt")
        return {
            "interview_score": 84,
            "summary": "Strong project ownership and clear technical reasoning.",
            "strengths": [
                "Explained architecture decisions clearly",
                "Connected implementation details to reliability",
            ],
            "improvement_areas": ["Quantify latency and adoption outcomes more precisely"],
            "dimensions": {
                "communication": {
                    "score": 86,
                    "feedback": "Answers were structured and concise.",
                    "strengths": ["Clear structure"],
                    "improvement_areas": ["State metrics earlier"],
                },
                "technical_depth": {
                    "score": 85,
                    "feedback": "Good API and reliability depth.",
                    "strengths": ["Explained idempotency"],
                    "improvement_areas": ["Discuss load-test thresholds"],
                },
                "behavioral": {
                    "score": 80,
                    "feedback": "Demonstrated ownership and reflection.",
                    "strengths": ["Owned trade-offs"],
                    "improvement_areas": ["Clarify stakeholder impact"],
                },
            },
        }


class TextOnlyTTS:
    def synthesize(self, text: str) -> bytes:
        return f"e2e-audio:{text}".encode()


class NoopResultStore:
    def save(self, student_id: str, result: InterviewResult) -> None:
        return
