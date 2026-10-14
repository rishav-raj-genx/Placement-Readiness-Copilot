"""
Mock Interview Worker — LiveKit Agent
======================================

This worker joins LiveKit rooms created by the platform's Supabase Edge Function,
conducts a mock interview with the student via real-time audio, and sends results
back to the frontend through LiveKit data-channel messages.

Architecture:
    Student microphone → LiveKit WebRTC → this worker (STT → LLM → TTS) → LiveKit WebRTC → Student speaker

The worker:
  1. Registers as a LiveKit agent (identity: "mock-interview")
  2. Listens for room assignment via LiveKit dispatch
  3. Reads room.metadata for student context (profile, resume URL, job, focus areas)
  4. Downloads the resume PDF from the signed URL in metadata
  5. Conducts a multi-question interview (greeting → questions → transcript)
  6. Listens for the student's "interview:finish" data message
  7. Generates final results and sends them via "interview:results" data message
  8. Persists results to Supabase (interview_sessions table)

Required environment variables (set in .env or deployment secrets):
    LIVEKIT_URL            — e.g. wss://interviewxai-owtcvxdw.livekit.cloud
    LIVEKIT_API_KEY        — LiveKit API key
    LIVEKIT_API_SECRET     — LiveKit API secret
    SUPABASE_URL           — e.g. https://<project>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (for DB writes)
    OPENAI_API_KEY         — For STT (Whisper) and TTS
    GROQ_API_KEY           — For LLM (llama-3.3-70b-versatile) and final scoring

Event contract (data-channel messages FROM this worker TO the frontend):
    interview:greeting    — { message: string }
    interview:question    — { questionId, text, questionNumber, totalQuestions }
    interview:transcript  — { speaker: "interviewer"|"student", text, final, timestamp }
    interview:results     — { overallReadinessDelta, finalScore, summary, categoryScores[], suggestedFixes[], timestamp }
    interview:error       — { code, message }

Event contract (data-channel messages FROM the frontend TO this worker):
    interview:finish      — { reason: "student_requested" }
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore

try:
    from livekit import agents, rtc
    from livekit.agents import (
        Agent,
        AgentSession,
        JobContext,
        JobProcess,
        WorkerOptions,
        WorkerType,
        RoomOutputOptions,
    )
    from livekit.agents.llm import LLM, ChatContext, ChatMessage
    from livekit.agents.stt import STT
    from livekit.agents.tts import TTS
    from livekit.plugins import openai as lk_openai
except ImportError:
    agents = None  # type: ignore
    rtc = None  # type: ignore
    Agent = object  # type: ignore
    AgentSession = None  # type: ignore
    JobContext = None  # type: ignore
    JobProcess = None  # type: ignore
    WorkerOptions = None  # type: ignore
    WorkerType = None  # type: ignore
    RoomOutputOptions = None  # type: ignore
    LLM = None  # type: ignore
    ChatContext = None  # type: ignore
    ChatMessage = None  # type: ignore
    STT = None  # type: ignore
    TTS = None  # type: ignore
    lk_openai = None  # type: ignore

# ---------------------------------------------------------------------------
# Logging — sanitized (no PII, no tokens, no API keys)
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("mock-interview-worker")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

WORKER_IDENTITY = "mock-interview"
MAX_QUESTIONS = 4
INTERVIEW_TIMEOUT_SECONDS = 30 * 60  # 30 minutes (matches token TTL)
SILENCE_TIMEOUT_SECONDS = 120        # disconnect after 2 min of silence
RESULT_DISPATCH_TIMEOUT = 60         # seconds to wait for result generation

# Category names used for scoring — the frontend renders these exactly
SCORE_CATEGORIES = [
    "Technical depth",
    "Communication clarity",
    "Problem-solving approach",
    "Resume alignment",
]


@dataclass
class InterviewContext:
    """Parsed from room.metadata when the worker joins the room."""

    interview_id: str = ""
    student_id: str = ""
    student_name: str = ""
    student_email: str = ""
    target_role: str = ""
    resume_text: str = ""
    resume_key_skills: list[str] = field(default_factory=list)
    resume_pdf_url: str = ""
    job_title: str = ""
    job_company: str = ""
    job_threshold_score: int = 70
    focus_areas: list[str] = field(default_factory=list)
    config: dict[str, Any] = field(default_factory=dict)


@dataclass
class TranscriptEntry:
    speaker: str  # "interviewer" | "student"
    text: str
    timestamp: float


@dataclass
class CategoryScore:
    category: str
    score: int
    benchmark: int
    strengths: list[str]
    critiques: list[str]


@dataclass
class SuggestedFix:
    title: str
    location: str
    recommended_change: str


@dataclass
class InterviewResults:
    overall_readiness_delta: int
    final_score: int
    summary: str
    category_scores: list[CategoryScore]
    suggested_fixes: list[SuggestedFix]
    timestamp: int


# ---------------------------------------------------------------------------
# Room metadata parsing
# ---------------------------------------------------------------------------


def parse_room_metadata(metadata_raw: str) -> InterviewContext:
    """Parse the JSON metadata string set by the Edge Function."""
    ctx = InterviewContext()
    if not metadata_raw:
        logger.warning("room.metadata is empty — proceeding with defaults")
        return ctx

    try:
        data = json.loads(metadata_raw)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse room.metadata JSON: %s", e)
        return ctx

    ctx.interview_id = data.get("interviewId", "")
    ctx.config = data.get("config", {})

    student = data.get("student", {})
    ctx.student_id = student.get("id", "")
    ctx.student_name = student.get("name", "Student")
    ctx.student_email = student.get("email", "")
    ctx.target_role = student.get("targetRole", data.get("config", {}).get("targetRole", "Software Engineer"))

    resume = data.get("resume", {})
    ctx.resume_text = resume.get("parsedText", "")
    ctx.resume_key_skills = resume.get("keySkills", [])
    ctx.resume_pdf_url = resume.get("pdfUrl", "")

    job = data.get("job")
    if job:
        ctx.job_title = job.get("title", "")
        ctx.job_company = job.get("company", "")
        ctx.job_threshold_score = job.get("minimumThresholdScore", 70)

    ctx.focus_areas = data.get("focusAreas", data.get("config", {}).get("focusAreas", []))

    logger.info(
        "Parsed room metadata: interviewId=%s student=%s role=%s job=%s/%s focusAreas=%d resumeUrl=%s",
        ctx.interview_id,
        ctx.student_name,
        ctx.target_role,
        ctx.job_company,
        ctx.job_title,
        len(ctx.focus_areas),
        "present" if ctx.resume_pdf_url else "absent",
    )
    return ctx


async def download_resume_text(pdf_url: str) -> str:
    """Download the resume PDF from the signed URL and extract text.

    The signed URL is valid for 30 minutes (set by the Edge Function).
    Returns empty string if download or parsing fails.
    """
    if not pdf_url:
        return ""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(pdf_url)
            resp.raise_for_status()
            pdf_bytes = resp.content

        # Try pdfplumber for text extraction; fall back to raw decode
        try:
            import io
            import pdfplumber

            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                pages = [page.extract_text() or "" for page in pdf.pages]
                text = "\n".join(pages).strip()
                logger.info("Resume text extracted: %d characters", len(text))
                return text
        except ImportError:
            logger.warning("pdfplumber not installed — returning raw PDF size as placeholder")
            return f"[Resume PDF: {len(pdf_bytes)} bytes — install pdfplumber for text extraction]"
    except Exception as e:
        logger.error("Failed to download/parse resume: %s", e)
        return ""


# ---------------------------------------------------------------------------
# Data-channel helpers
# ---------------------------------------------------------------------------


async def send_data_message(room: rtc.Room, event: str, payload: dict[str, Any]) -> None:
    """Send a JSON data-channel message to all participants in the room."""
    message = json.dumps({"event": event, "payload": payload})
    encoder = rtc.TextEncoder() if hasattr(rtc, "TextEncoder") else None

    # livekit-rtc uses publish_data with bytes
    data = message.encode("utf-8")
    await room.local_participant.publish_data(
        data,
        reliable=True,
        destination_identities=[],  # broadcast to all
    )
    logger.info("Sent data event: %s", event)


# ---------------------------------------------------------------------------
# Interview logic
# ---------------------------------------------------------------------------


def build_system_prompt(ctx: InterviewContext, question_number: int, total_questions: int) -> str:
    """Build the system prompt for the LLM during the interview."""
    parts = [
        f"You are a senior technical interviewer conducting a mock interview for the role of '{ctx.target_role}'.",
        f"Candidate name: {ctx.student_name}.",
        f"This is question {question_number} of {total_questions}.",
        "",
        "Instructions:",
        "- Ask one question at a time. Wait for the candidate to answer before moving on.",
        "- Be professional, encouraging, and realistic.",
        "- If the candidate is stuck, offer a hint, then move on.",
        "- Keep your spoken responses concise (under 60 seconds).",
        "- After the candidate answers, provide brief feedback, then ask the next question.",
    ]

    if ctx.focus_areas:
        parts.append(f"\nFocus areas for this interview: {', '.join(ctx.focus_areas)}")

    if ctx.resume_key_skills:
        parts.append(f"\nCandidate's key skills from resume: {', '.join(ctx.resume_key_skills)}")

    if ctx.resume_text:
        # Truncate resume text to avoid token overflow
        resume_excerpt = ctx.resume_text[:3000]
        parts.append(f"\nCandidate's resume:\n{resume_excerpt}")

    if ctx.job_title:
        parts.append(f"\nTarget job: {ctx.job_title} at {ctx.job_company}")
        parts.append(f"Minimum threshold score: {ctx.job_threshold_score}")

    return "\n".join(parts)


def build_scoring_prompt(ctx: InterviewContext, transcript: list[TranscriptEntry]) -> str:
    """Build the prompt for final scoring via Groq."""
    transcript_text = "\n".join(
        f"[{t.speaker}] ({int(round(t.timestamp))}s): {t.text}" for t in transcript
    )

    return f"""You are an expert interview evaluator. Analyze this mock interview transcript and produce a JSON evaluation.

Interview context:
- Role: {ctx.target_role}
- Candidate: {ctx.student_name}
- Focus areas: {', '.join(ctx.focus_areas) if ctx.focus_areas else 'general'}
{f"- Job: {ctx.job_title} at {ctx.job_company}" if ctx.job_title else ""}
{f"- Job threshold score: {ctx.job_threshold_score}" if ctx.job_title else ""}

Transcript:
{transcript_text}

Produce a JSON object with EXACTLY this structure (no markdown, no extra explanation — valid JSON only):
{{
  "interview_score": <number between 0.0 and 100.0, e.g. 78.5>,
  "summary": "<2-3 sentence overall feedback summary>",
  "overallReadinessDelta": <integer between -10 and +10>,
  "dimensions": {{
    "technical_depth": {{
      "score": <number 0-100>,
      "feedback": "<detailed feedback on technical depth>",
      "strengths": ["<strength 1>", "<strength 2>"],
      "improvement_areas": ["<area 1>", "<area 2>"]
    }},
    "communication": {{
      "score": <number 0-100>,
      "feedback": "<detailed feedback on communication>",
      "strengths": ["<strength 1>"],
      "improvement_areas": ["<area 1>"]
    }},
    "behavioral": {{
      "score": <number 0-100>,
      "feedback": "<detailed feedback on problem solving and behavioral>",
      "strengths": ["<strength 1>"],
      "improvement_areas": ["<area 1>"]
    }}
  }},
  "categoryScores": [
    {{
      "category": "Technical depth",
      "score": <number 0-100>,
      "benchmark": {ctx.job_threshold_score},
      "strengths": ["..."],
      "critiques": ["..."]
    }},
    {{
      "category": "Communication clarity",
      "score": <number 0-100>,
      "benchmark": {ctx.job_threshold_score},
      "strengths": ["..."],
      "critiques": ["..."]
    }},
    {{
      "category": "Problem-solving approach",
      "score": <number 0-100>,
      "benchmark": {ctx.job_threshold_score},
      "strengths": ["..."],
      "critiques": ["..."]
    }},
    {{
      "category": "Resume alignment",
      "score": <number 0-100>,
      "benchmark": {ctx.job_threshold_score},
      "strengths": ["..."],
      "critiques": ["..."]
    }}
  ],
  "suggestedFixes": [
    {{
      "title": "<short title>",
      "location": "resume" | "answers" | "communication",
      "recommendedChange": "<actionable recommendation>"
    }}
  ]
}}"""


def parse_scoring_response_raw(raw: str) -> dict[str, Any]:
    """Parse raw LLM string into JSON dictionary, handling optional markdown code fences."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    return json.loads(text)


def build_canonical_v0_result(
    data: dict[str, Any],
    transcript: list[TranscriptEntry],
) -> dict[str, Any]:
    """Build the canonical v0-compatible payload for interview_sessions.result."""
    # Convert transcript entries to canonical v0 schema:
    # speaker: "ai" | "student", timestamp_sec: integer seconds
    canonical_transcript = []
    for entry in transcript:
        speaker_val = "ai" if entry.speaker in ("interviewer", "ai") else "student"
        sec = max(0, int(round(entry.timestamp)))
        canonical_transcript.append({
            "speaker": speaker_val,
            "timestamp_sec": sec,
            "text": entry.text,
        })

    # Validate and normalize interview_score (0.0 to 100.0, decimal valid)
    score_val = data.get("interview_score")
    if isinstance(score_val, bool) or not isinstance(score_val, (int, float)):
        raise ValueError("scoring response must contain a numeric interview_score")
    score_val = round(float(score_val), 1)
    if not 0.0 <= score_val <= 100.0:
        raise ValueError("interview_score must be between 0 and 100")

    raw_dims = data.get("dimensions", {})
    if not isinstance(raw_dims, dict):
        raise ValueError("scoring response dimensions must be an object")
    dimensions: dict[str, dict[str, Any]] = {}
    for dim_key in ("technical_depth", "communication", "behavioral"):
        raw_dim = raw_dims.get(dim_key)
        if not isinstance(raw_dim, dict):
            raise ValueError(f"scoring response is missing dimensions.{dim_key}")
        dim_score = raw_dim.get("score")
        if isinstance(dim_score, bool) or not isinstance(dim_score, (int, float)):
            raise ValueError(f"dimensions.{dim_key}.score must be numeric")
        dim_score = round(float(dim_score), 1)
        if not 0.0 <= dim_score <= 100.0:
            raise ValueError(f"dimensions.{dim_key}.score must be between 0 and 100")

        dimensions[dim_key] = {
            "score": dim_score,
            "feedback": raw_dim.get("feedback", ""),
            "strengths": raw_dim.get("strengths", []),
            "improvement_areas": raw_dim.get("improvement_areas", []),
        }
        if not isinstance(dimensions[dim_key]["feedback"], str):
            raise ValueError(f"dimensions.{dim_key}.feedback must be a string")
        if not all(isinstance(item, str) for item in dimensions[dim_key]["strengths"]):
            raise ValueError(f"dimensions.{dim_key}.strengths must contain strings")
        if not all(isinstance(item, str) for item in dimensions[dim_key]["improvement_areas"]):
            raise ValueError(f"dimensions.{dim_key}.improvement_areas must contain strings")

    return {
        "contract_version": "v0",
        "interview_score": score_val,
        "transcript": canonical_transcript,
        "summary": str(data.get("summary", "Mock interview completed.")),
        "dimensions": dimensions,
    }


def validate_canonical_v0_result(payload: dict[str, Any]) -> tuple[bool, str]:
    """Validate that the payload conforms strictly to the canonical v0 schema."""
    if not isinstance(payload, dict):
        return False, "Payload must be a dictionary"
    if payload.get("contract_version") != "v0":
        return False, f"contract_version must be 'v0', got {payload.get('contract_version')}"
    score = payload.get("interview_score")
    if not isinstance(score, (int, float)):
        return False, f"interview_score must be a number, got {type(score)}"
    if score < 0 or score > 100:
        return False, f"interview_score must be between 0 and 100, got {score}"
    if not isinstance(payload.get("summary"), str):
        return False, "summary must be a string"
    if not isinstance(payload.get("transcript"), list):
        return False, "transcript must be a list"
    for idx, entry in enumerate(payload["transcript"]):
        if not isinstance(entry, dict):
            return False, f"transcript[{idx}] must be a dict"
        if entry.get("speaker") not in ("ai", "student"):
            return False, f"transcript[{idx}].speaker must be 'ai' or 'student', got {entry.get('speaker')}"
        if not isinstance(entry.get("timestamp_sec"), (int, float)):
            return False, f"transcript[{idx}].timestamp_sec must be numeric"
        if not isinstance(entry.get("text"), str):
            return False, f"transcript[{idx}].text must be a string"
    dims = payload.get("dimensions")
    if not isinstance(dims, dict):
        return False, "dimensions must be a dictionary"
    for dim_name in ("technical_depth", "communication", "behavioral"):
        if dim_name not in dims:
            return False, f"dimensions must contain '{dim_name}'"
        dim = dims[dim_name]
        if not isinstance(dim, dict):
            return False, f"dimensions.{dim_name} must be a dict"
        if isinstance(dim.get("score"), bool) or not isinstance(dim.get("score"), (int, float)):
            return False, f"dimensions.{dim_name}.score must be numeric"
        if not 0 <= dim["score"] <= 100:
            return False, f"dimensions.{dim_name}.score must be between 0 and 100"
        if not isinstance(dim.get("feedback"), str):
            return False, f"dimensions.{dim_name}.feedback must be a string"
        if not isinstance(dim.get("strengths"), list):
            return False, f"dimensions.{dim_name}.strengths must be a list"
        if not isinstance(dim.get("improvement_areas"), list):
            return False, f"dimensions.{dim_name}.improvement_areas must be a list"
    return True, ""


def build_frontend_results_event(
    data: dict[str, Any],
    canonical_v0: dict[str, Any],
) -> dict[str, Any]:
    """Build the interview:results event payload for frontend data channel."""
    final_score = canonical_v0["interview_score"]
    delta = int(data.get("overallReadinessDelta", 0))
    summary = canonical_v0["summary"]

    cat_scores = []
    if data.get("categoryScores"):
        for cs in data["categoryScores"]:
            cat_scores.append({
                "category": str(cs.get("category", "")),
                "score": float(cs.get("score", final_score)),
                "benchmark": int(cs.get("benchmark", 70)),
                "strengths": list(cs.get("strengths", [])),
                "critiques": list(cs.get("critiques", [])),
            })
    else:
        for dim_name, dim_data in canonical_v0["dimensions"].items():
            cat_scores.append({
                "category": dim_name.replace("_", " ").title(),
                "score": dim_data["score"],
                "benchmark": 70,
                "strengths": dim_data["strengths"],
                "critiques": dim_data["improvement_areas"],
            })

    suggested_fixes = []
    for sf in data.get("suggestedFixes", []):
        suggested_fixes.append({
            "title": str(sf.get("title", "Review feedback")),
            "location": str(sf.get("location", "answers")),
            "recommendedChange": str(sf.get("recommendedChange", "")),
        })

    return {
        "overallReadinessDelta": delta,
        "finalScore": final_score,
        "summary": summary,
        "categoryScores": cat_scores,
        "suggestedFixes": suggested_fixes,
        "timestamp": int(time.time() * 1000),
    }


# ---------------------------------------------------------------------------
# Supabase persistence
# ---------------------------------------------------------------------------


async def persist_results_to_supabase(
    interview_id: str,
    canonical_v0_result: dict[str, Any],
) -> bool:
    """Persist results to the interview_sessions table.

    Uses the Supabase service role key to bypass RLS.
    Updates:
      result: canonical v0 JSONB
      status: 'completed'
      completed_at: ISO8601 UTC timestamp
    """
    supabase_url = os.environ.get("SUPABASE_URL", "")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_key:
        logger.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured in environment")
        return False

    url = f"{supabase_url}/rest/v1/interview_sessions?id=eq.{interview_id}"

    payload = {
        "result": canonical_v0_result,
        "status": "completed",
        "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.patch(url, json=payload, headers=headers)
            if resp.status_code in (200, 204):
                logger.info("Canonical v0 results persisted to interview_sessions (id=%s)", interview_id)
                return True
            else:
                logger.error(
                    "Supabase persist failed: status=%d (sanitized response)",
                    resp.status_code,
                )
                return False
    except Exception as e:
        logger.error("Supabase persist exception: %s", type(e).__name__)
        return False


# ---------------------------------------------------------------------------
# The LiveKit Agent
# ---------------------------------------------------------------------------


class MockInterviewAgent(Agent):
    """LiveKit agent that conducts a mock interview."""

    def __init__(self, ctx: InterviewContext) -> None:
        super().__init__(
            instructions=build_system_prompt(ctx, 1, MAX_QUESTIONS),
        )
        self.ctx = ctx
        self.transcript: list[TranscriptEntry] = []
        self.question_count = 0
        self.finish_requested = False
        self.start_time = time.time()
        self._finish_event = asyncio.Event()
        self._finish_lock = asyncio.Lock()
        self._has_finished = False

    async def on_enter(self) -> None:
        """Called when the agent enters the LiveKit room."""
        logger.info(
            "Agent entered room: interviewId=%s student=%s",
            self.ctx.interview_id,
            self.ctx.student_name,
        )

        # 1. Send greeting
        greeting = (
            f"Hi {self.ctx.student_name}, welcome to your mock interview for "
            f"{self.ctx.target_role}. I'll ask you {MAX_QUESTIONS} questions. "
            f"Take your time with each answer. Let's begin!"
        )
        await send_data_message(
            self.room,
            "interview:greeting",
            {"message": greeting},
        )
        self.transcript.append(TranscriptEntry("interviewer", greeting, time.time() - self.start_time))

        # 2. Generate and send the first question
        await self._ask_next_question()

    async def on_user_turn_completed(
        self,
        turn_ctx: ChatContext,
        chat_ctx: ChatContext,
    ) -> None:
        """Called when the user finishes speaking (a turn completes)."""
        # Capture the student's speech into our transcript
        for msg in turn_ctx.messages:
            if msg.role == "user":
                text = msg.content if isinstance(msg.content, str) else str(msg.content)
                self.transcript.append(
                    TranscriptEntry("student", text, time.time() - self.start_time)
                )

        self.question_count += 1

        if self.finish_requested or self.question_count >= MAX_QUESTIONS:
            await self._finish_interview()
        else:
            await self._ask_next_question()

    async def _ask_next_question(self) -> None:
        """Generate the next interview question and send it."""
        q_num = self.question_count + 1
        self.set_instructions(build_system_prompt(self.ctx, q_num, MAX_QUESTIONS))

        question_id = f"q_{q_num}_{uuid.uuid4().hex[:6]}"
        question_text = await self._generate_question_text(q_num)

        await send_data_message(
            self.room,
            "interview:question",
            {
                "questionId": question_id,
                "text": question_text,
                "questionNumber": q_num,
                "totalQuestions": MAX_QUESTIONS,
            },
        )
        self.transcript.append(
            TranscriptEntry("interviewer", question_text, time.time() - self.start_time)
        )
        logger.info("Asked question %d/%d: %s", q_num, MAX_QUESTIONS, question_text[:80])

    async def _generate_question_text(self, q_num: int) -> str:
        """Generate a question using the LLM based on context and focus areas."""
        from livekit.plugins.groq import LLM as GroqLLM

        llm = GroqLLM(
            model="llama-3.3-70b-versatile",
            api_key=os.environ.get("GROQ_API_KEY", ""),
        )

        prompt = f"""Generate a single interview question for a mock interview.

Context:
- Role: {self.ctx.target_role}
- Question number: {q_num} of {MAX_QUESTIONS}
- Focus areas: {', '.join(self.ctx.focus_areas) if self.ctx.focus_areas else 'general'}
{f"- Job: {self.ctx.job_title} at {self.ctx.job_company}" if self.ctx.job_title else ""}

{f"Previous questions asked: {q_num - 1}" if q_num > 1 else ""}

Return ONLY the question text (no quotes, no numbering, no explanation). The question should be:
- Open-ended
- Relevant to the role and focus areas
- Appropriate difficulty for the experience level
- Different from any previous questions

Question:"""

        chat_ctx = ChatContext()
        chat_ctx.add_message(role="system", content=prompt)

        try:
            stream = llm.chat(chat_ctx)
            text = ""
            async for chunk in stream:
                if chunk.delta:
                    text += chunk.delta.content if hasattr(chunk.delta, "content") else str(chunk.delta)
            return text.strip()
        except Exception as e:
            logger.error("Question generation failed: %s — using fallback", e)
            fallbacks = [
                f"Tell me about your experience with {self.ctx.focus_areas[0] if self.ctx.focus_areas else 'software engineering'}.",
                "Describe a challenging project you worked on and your role in it.",
                "How do you approach debugging a complex distributed system issue?",
                "Walk me through your approach to designing a scalable system.",
            ]
            return fallbacks[min(q_num - 1, len(fallbacks) - 1)]

    async def _finish_interview(self) -> None:
        """Finalize transcript, generate scoring, persist to DB, and publish interview:results."""
        async with self._finish_lock:
            if self._has_finished:
                logger.info("Interview already finalized or in progress, skipping duplicate call.")
                return
            self._has_finished = True
            self.finish_requested = True
            logger.info("Finishing interview: interviewId=%s", self.ctx.interview_id)

            try:
                # 1. Finalize transcript and generate results via Groq
                raw_scoring = await self._generate_results_raw()
                canonical_v0 = build_canonical_v0_result(raw_scoring, self.transcript)

                # 2. Validate canonical v0 schema
                valid, err_msg = validate_canonical_v0_result(canonical_v0)
                if not valid:
                    logger.error("Canonical v0 schema validation failed: %s", err_msg)
                    raise ValueError(f"Canonical v0 schema validation failed: {err_msg}")

                frontend_event = build_frontend_results_event(raw_scoring, canonical_v0)

                # 3. Persist to Supabase interview_sessions FIRST
                persisted = False
                for attempt in range(1, 4):
                    persisted = await persist_results_to_supabase(self.ctx.interview_id, canonical_v0)
                    if persisted:
                        break
                    logger.warning("Supabase persist attempt %d failed, retrying in %ds...", attempt, attempt)
                    await asyncio.sleep(attempt)

                if not persisted:
                    # If persistence fails after retry:
                    # - do not publish a success result;
                    # - publish interview:error;
                    # - log a sanitized error;
                    # - keep the failure observable.
                    logger.error("Persistence failed after all retries for interviewId=%s", self.ctx.interview_id)
                    await send_data_message(
                        self.room,
                        "interview:error",
                        {
                            "code": "PERSISTENCE_FAILED",
                            "message": "Failed to persist interview results to database after retries",
                        },
                    )
                    return

                # 4. Publish interview:results ONLY after persistence succeeds
                await send_data_message(self.room, "interview:results", frontend_event)
                logger.info(
                    "Sent interview:results event after DB persistence (finalScore=%s)",
                    canonical_v0["interview_score"],
                )

            except Exception as e:
                logger.error("Failed to generate/persist results: %s", e)
                try:
                    await send_data_message(
                        self.room,
                        "interview:error",
                        {"code": "RESULT_ERROR", "message": "Failed to generate or persist interview results"},
                    )
                except Exception as send_err:
                    logger.error("Failed to send interview:error message: %s", send_err)
            finally:
                # 5. Disconnect from room after finalization concludes
                try:
                    await self.room.disconnect()
                except Exception as disc_err:
                    logger.warning("Room disconnect warning: %s", disc_err)
                logger.info("Interview complete, room disconnected: interviewId=%s", self.ctx.interview_id)

    async def _generate_results_raw(self) -> dict[str, Any]:
        """Call Groq to generate the raw scoring dictionary."""
        from livekit.plugins.groq import LLM as GroqLLM

        llm = GroqLLM(
            model="llama-3.3-70b-versatile",
            api_key=os.environ.get("GROQ_API_KEY", ""),
        )

        scoring_prompt = build_scoring_prompt(self.ctx, self.transcript)
        chat_ctx = ChatContext()
        chat_ctx.add_message(role="system", content=scoring_prompt)

        stream = llm.chat(chat_ctx)
        raw = ""
        async for chunk in stream:
            if chunk.delta:
                raw += chunk.delta.content if hasattr(chunk.delta, "content") else str(chunk.delta)

        logger.info("Scoring LLM response received: %d chars", len(raw))
        return parse_scoring_response_raw(raw)

    async def handle_finish_message(self, payload: dict[str, Any]) -> None:
        """Called when the frontend sends interview:finish."""
        reason = payload.get("reason", "unknown")
        logger.info("Received interview:finish (reason=%s)", reason)
        self.finish_requested = True
        self._finish_event.set()
        await self._finish_interview()


# ---------------------------------------------------------------------------
# Data message listener (for interview:finish from frontend)
# ---------------------------------------------------------------------------


def setup_data_listener(room: rtc.Room, agent: MockInterviewAgent) -> None:
    """Listen for data-channel messages from the frontend."""

    @room.on("data_received")
    def on_data_received(data: bytes, participant: rtc.Participant | None) -> None:
        try:
            text = data.decode("utf-8")
            parsed = json.loads(text)
            event = parsed.get("event", "")
            payload = parsed.get("payload", {})

            if event == "interview:finish":
                asyncio.create_task(agent.handle_finish_message(payload))
            else:
                logger.debug("Received unknown data event: %s", event)

        except Exception as e:
            logger.warning("Failed to parse data message: %s", e)


# ---------------------------------------------------------------------------
# Pre-job hook (runs in the worker process before the agent starts)
# ---------------------------------------------------------------------------


def pre_job(job_ctx: JobContext) -> None:
    """Called before the agent enters the room — used for setup."""
    logger.info("Worker registered, waiting for job dispatch...")


# ---------------------------------------------------------------------------
# Main entrypoint — called when the worker is assigned a room
# ---------------------------------------------------------------------------


async def entrypoint(ctx: JobContext) -> None:
    """LiveKit worker entrypoint — called when a room is assigned."""
    # 1. Read room metadata
    room = ctx.room
    metadata_raw = room.metadata or ""

    logger.info("Job received: room=%s", room.name)
    interview_ctx = parse_room_metadata(metadata_raw)

    # 2. Download resume if URL is present
    if interview_ctx.resume_pdf_url:
        logger.info("Downloading resume from signed URL...")
        interview_ctx.resume_text = await download_resume_text(interview_ctx.resume_pdf_url)
    else:
        logger.info("No resume URL in metadata — proceeding without resume text")

    # 3. Create the agent
    agent = MockInterviewAgent(interview_ctx)

    # 4. Connect to the room
    await ctx.connect(
        rooms=room.name,
        agent=agent,
    )

    # 5. Set up data message listener for interview:finish
    setup_data_listener(room, agent)

    logger.info(
        "Worker connected to room: room=%s interviewId=%s student=%s",
        room.name,
        interview_ctx.interview_id,
        interview_ctx.student_name,
    )

    # 6. Set a timeout — auto-finish after INTERVIEW_TIMEOUT_SECONDS
    async def timeout_guard() -> None:
        await asyncio.sleep(INTERVIEW_TIMEOUT_SECONDS)
        if not agent.finish_requested:
            logger.warning("Interview timeout reached (%ds) — auto-finishing", INTERVIEW_TIMEOUT_SECONDS)
            await agent._finish_interview()

    asyncio.create_task(timeout_guard())


# ---------------------------------------------------------------------------
# Worker options and main
# ---------------------------------------------------------------------------


def main() -> None:
    """Start the LiveKit worker process."""
    logger.info("Starting mock-interview worker (identity=%s)", WORKER_IDENTITY)
    logger.info("Max questions: %d, Timeout: %ds", MAX_QUESTIONS, INTERVIEW_TIMEOUT_SECONDS)

    # Verify required environment variables
    required = [
        "LIVEKIT_URL",
        "LIVEKIT_API_KEY",
        "LIVEKIT_API_SECRET",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "GROQ_API_KEY",
    ]
    missing = [v for v in required if not os.environ.get(v)]
    if not os.environ.get("OPENAI_API_KEY") and not os.environ.get("DEEPGRAM_API_KEY"):
        missing.append("OPENAI_API_KEY or DEEPGRAM_API_KEY")
    if missing:
        logger.error("Missing required environment variables: %s", ", ".join(missing))
        raise SystemExit(1)

    worker = WorkerOptions(
        entrypoint_func=entrypoint,
        pre_job_func=pre_job,
        agent_name=WORKER_IDENTITY,
        worker_type=WorkerType.ROOM,
        # The worker uses OpenAI for STT (Whisper) and TTS
        # Groq for LLM (set per-agent in the MockInterviewAgent)
    )

    agents.cli.run_app(worker)


if __name__ == "__main__":
    main()
