"""Stateful, lifecycle-managed interview orchestration with adaptive policy."""

from __future__ import annotations

import time
from dataclasses import dataclass
from enum import Enum

from agent.providers import InterviewLLM
from scoring.prompt import (
    SCORING_SYSTEM_PROMPT,
    build_scoring_prompt,
    parse_scoring_result,
)
from scoring.schemas import (
    InterviewContext,
    InterviewResult,
    SessionConfig,
    TranscriptTurn,
)


class SessionState(str, Enum):
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    SCORING = "scoring"
    COMPLETED = "completed"
    FAILED = "failed"


class QuestionCategory(str, Enum):
    INTRO = "intro"
    PROJECT_DEEP_DIVE = "project_deep_dive"
    TECHNICAL = "technical"
    RELIABILITY = "reliability"
    BEHAVIORAL = "behavioral"


@dataclass(frozen=True)
class QuestionItem:
    id: str
    category: QuestionCategory
    text: str
    probe_goal: str


class InterviewSession:
    """A bounded, resume-grounded interview session with configurable duration and question plan."""

    TARGET_DURATION_MINUTES: int = 15
    MAX_DURATION_MINUTES: int = 20

    def __init__(
        self,
        context: InterviewContext,
        llm: InterviewLLM,
        config: SessionConfig | None = None,
    ) -> None:
        self.context = context
        self.llm = llm
        self.config = config or SessionConfig(
            target_duration_minutes=15,
            technical_question_count=2,
            project_deep_dive_count=2,
            hr_question_count=1,
        )


        self.target_duration_minutes = self.config.target_duration_minutes
        self.max_duration_minutes = self.config.effective_max_minutes

        self.state: SessionState = SessionState.CREATED
        self.transcript: list[TranscriptTurn] = []
        self._start_time: float = time.monotonic()
        self._question_items = build_question_plan(self.context, self.config)
        self.questions = tuple(q.text for q in self._question_items)
        self.question_number = 0
        self._current_question_follow_ups = 0

    @property
    def has_more_questions(self) -> bool:
        return self.question_number < len(self.questions)

    @property
    def is_complete(self) -> bool:
        return self.question_number >= len(self.questions)

    @property
    def elapsed_seconds(self) -> float:
        return round(time.monotonic() - self._start_time, 1)

    @property
    def system_prompt(self) -> str:
        return build_agent_system_prompt(self.context, self.config)

    def greeting(self) -> str:
        if self.state not in {SessionState.CREATED, SessionState.IN_PROGRESS}:
            raise ValueError(f"cannot start session in state '{self.state.value}'")
        self.state = SessionState.IN_PROGRESS
        name = f" {self.context.candidate_name}" if self.context.candidate_name else ""
        text = (
            f"Hi{name}, welcome to your mock interview. "
            f"This session is configured for about {self.target_duration_minutes} minutes. "
            "We will explore your background, technical depth, architectural trade-offs, "
            "and teamwork experience with adaptive follow-ups where helpful. "
            "Let’s begin."
        )
        self._record_turn(speaker="ai", text=text)
        return text

    def next_question(self) -> str:
        if self.state == SessionState.CREATED:
            self.state = SessionState.IN_PROGRESS
        elif self.state != SessionState.IN_PROGRESS:
            raise ValueError(f"cannot ask next question in state '{self.state.value}'")
        if not self.has_more_questions:
            raise ValueError("all interview questions have been asked; finish the session")

        # Determine if we should ask an adaptive follow-up or advance to the next primary question
        should_follow_up, follow_up_text = self._evaluate_adaptive_follow_up()
        if should_follow_up and follow_up_text:
            self._current_question_follow_ups += 1
            self._record_turn(speaker="ai", text=follow_up_text)
            return follow_up_text

        # Otherwise, advance to next primary question
        self._current_question_follow_ups = 0
        self.question_number += 1
        base_question = self.questions[self.question_number - 1]

        acknowledgment = ""
        if self.question_number > 1 and self.transcript:
            last_student_turn = next(
                (turn.text for turn in reversed(self.transcript) if turn.speaker == "student"),
                "",
            )
            acknowledgment = _generate_conversational_acknowledgment(last_student_turn)

        text = f"{acknowledgment} {base_question}".strip() if acknowledgment else base_question
        self._record_turn(speaker="ai", text=text)
        return text

    def accept_answer(self, text: str) -> None:
        cleaned = text.strip()
        if not cleaned:
            raise ValueError("answer text cannot be empty")
        if self.state not in {SessionState.CREATED, SessionState.IN_PROGRESS}:
            raise ValueError(f"cannot accept answer when session is in state '{self.state.value}'")
        if self.state == SessionState.CREATED:
            self.state = SessionState.IN_PROGRESS
        self._record_turn(speaker="student", text=cleaned)


    def finish(self) -> InterviewResult:
        if self.state not in {SessionState.IN_PROGRESS, SessionState.SCORING}:
            if self.state == SessionState.COMPLETED and hasattr(self, "_cached_result"):
                return self._cached_result
            raise ValueError(f"cannot finish session in state '{self.state.value}'")

        self.state = SessionState.SCORING
        try:
            raw = self.llm.complete(
                SCORING_SYSTEM_PROMPT, build_scoring_prompt(self.context, self.transcript)
            )
        except (RuntimeError, ValueError, TypeError, OSError):
            raw = None

        try:
            result = parse_scoring_result(raw, self.transcript, self.context)
            student_turns_count = len([t for t in self.transcript if t.speaker == "student"])
            if student_turns_count < 3:
                result.is_provisional = True
                result.is_abandoned = True
                result.session_status = "abandoned"
                if not result.summary.startswith("[ABANDONED") and not result.summary.startswith("[PARTIAL"):
                    result.summary = f"[ABANDONED / EARLY TERMINATION - {student_turns_count} ANSWERS] {result.summary}"
            else:
                result.is_abandoned = False
                result.session_status = "completed"
            self._cached_result = result
            self.state = SessionState.COMPLETED
            return result
        except Exception:
            self.state = SessionState.FAILED
            raise

    def _record_turn(self, speaker: str, text: str) -> None:
        turn = TranscriptTurn(
            speaker="student" if speaker in {"student", "user"} else "ai",
            text=text.strip(),
            timestamp_sec=self.elapsed_seconds,
            turn_id=len(self.transcript) + 1,
        )
        self.transcript.append(turn)

    def _evaluate_adaptive_follow_up(self) -> tuple[bool, str | None]:
        """Shared interview policy deciding if a single targeted follow-up is warranted."""
        # Never follow up on the first turn (intro) or if we already followed up on this question
        follow_up_limit = 2 if self.config.difficulty == "hard" else 1
        if self.question_number == 0 or self._current_question_follow_ups >= follow_up_limit:
            return False, None

        last_student_turn = next(
            (turn.text for turn in reversed(self.transcript) if turn.speaker == "student"),
            "",
        )
        if not last_student_turn:
            return False, None

        clean = last_student_turn.strip().lower()

        # 1. Candidate is unsure or passed -> do NOT grill with follow-up, advance to next question
        unsure_phrases = ["i don't know", "dont know", "not sure", "no idea", "pass", "skip", "cannot say"]
        if any(p in clean for p in unsure_phrases):
            return False, None

        if self.config.difficulty == "hard" and len(clean.split()) < 20:
            return True, "Why? How does that scale to 1 million users?"

        # 2. Vague or very short answer -> nudge for concrete implementation details once
        words = clean.split()
        if len(words) < 6 and self.question_number in {2, 3, 4}:
            return True, "Could you elaborate a bit more on the specific architectural steps and challenges you encountered?"

        # 3. Candidate gave a strong technical response mentioning deep scale/load -> probe edge cases
        deep_scale_terms = ["100k", "million requests", "high concurrency", "traffic spike", "network partition", "distributed consensus"]
        if any(t in clean for t in deep_scale_terms) and self.question_number in {2, 3}:
            return True, "How would that design handle edge-case failures, such as network partitions or sudden 10x traffic spikes?"

        return False, None


# ---------------------------------------------------------------------------
# Configurable Question Bank & Plan Generator
# ---------------------------------------------------------------------------

BACKEND_QUESTION_POOL = [
    (
        "How do you design database transactions to prevent race conditions and dirty reads in high-concurrency writes?",
        "Assess database concurrency control and isolation levels",
    ),
    (
        "Explain your strategy for cache invalidation when using Redis with a primary relational database. How do you handle cache stampedes?",
        "Assess caching patterns, consistency, and stampede mitigation",
    ),
    (
        "When designing RESTful or RPC APIs, how do you implement idempotency for financial or write-heavy endpoints?",
        "Assess idempotency key mechanisms and safe retries",
    ),
    (
        "Compare synchronous microservice communication via HTTP/gRPC versus asynchronous event streams via Kafka. What trade-offs dictate your choice?",
        "Assess distributed messaging and decoupling trade-offs",
    ),
    (
        "Walk me through how database indexes (B-trees, hash, composite) function internally, and how an unoptimized query can trigger sequential scans.",
        "Assess query optimization and database indexing mechanics",
    ),
    (
        "How do you approach automated testing and CI/CD pipelines to ensure zero-downtime database migrations in production?",
        "Assess continuous delivery, schema migration safety, and testing",
    ),
]

FRONTEND_QUESTION_POOL = [
    (
        "Explain how the Virtual DOM reconciliation algorithm works in React, and how improper key usage affects component remounts and performance.",
        "Assess rendering optimization and Virtual DOM internals",
    ),
    (
        "How do you manage client-side state in complex SPAs? When do you choose component-level state versus a global store like Zustand or Redux?",
        "Assess state management architecture and component cohesion",
    ),
    (
        "Describe your approach to Core Web Vitals optimization, specifically improving Largest Contentful Paint (LCP) and Interaction to Next Paint (INP).",
        "Assess modern web performance profiling and asset delivery",
    ),
    (
        "How do you architect resilient WebSocket or SSE connections in the browser, including reconnection backoff and message deduplication?",
        "Assess real-time communication resilience in browser clients",
    ),
    (
        "Explain the differences between Server-Side Rendering (SSR), Static Site Generation (SSG), and Client-Side Hydration, including trade-offs.",
        "Assess rendering architecture and hydration overhead",
    ),
    (
        "How do you design reusable, accessible UI component systems (ARIA, keyboard navigation, focus management) across multi-page workflows?",
        "Assess design systems and web accessibility compliance",
    ),
]

BEHAVIORAL_QUESTION_POOL = [
    (
        "Tell me about a time you received difficult feedback or had a technical disagreement with a teammate. Using the STAR framework, what was the situation, action, and outcome?",
        "Evaluate constructive alignment and emotional intelligence",
    ),
    (
        "Describe a high-pressure situation where a production incident or tight deadline occurred. How did you prioritize tasks and communicate with stakeholders?",
        "Evaluate incident triage and cross-functional communication",
    ),
    (
        "Give an example of a goal you set for yourself on a technical project and how you achieved it despite unexpected obstacles. What was the impact?",
        "Evaluate goal orientation, grit, and initiative",
    ),
]


def build_agent_system_prompt(context: InterviewContext, config: SessionConfig) -> str:
    """Build dynamic AI system prompt with industry-standard FAANG instructions for Hard mode."""
    focus_topics = ", ".join(config.focus_topics) if config.focus_topics else "resume-grounded engineering topics"
    if config.difficulty == "hard":
        difficulty_instructions = (
            "- Act as a Principal Staff Engineer at a FAANG company.\n"
            "- Do not provide hints unless explicitly asked.\n"
            "- Probe deeply into system architecture, scalability bottlenecks, memory management, and time/space complexity trade-offs.\n"
            "- If the candidate gives a superficial answer, aggressively ask 'Why?' and 'How does that scale to 1 million users?'\n"
        )
    else:
        difficulty_instructions = (
            "- Ask at most ONE concise follow-up per question when an answer is incomplete. "
            "If the candidate passes, move supportively to the next question.\n"
        )

    return (
        f"You are an experienced, empathetic, and professional mock interviewer conducting a {config.target_duration_minutes}-minute "
        f"technical and behavioral session for the {context.target_role or config.role_category} position.\n\n"
        f"Configured difficulty: {config.difficulty.upper()}\n"
        f"Candidate experience level: {config.experience_level}\n"
        f"Required focus topics: {focus_topics}\n\n"
        "### Interview Conduct Guidelines\n"
        "- Speak with a calm, conversational, professional cadence. Do not sound robotic.\n"
        "- Ask questions one at a time. Never dump multiple questions simultaneously.\n"
        "- Active Listening: Before asking the next primary question, briefly acknowledge a concrete point from the candidate's answer.\n"
        f"{difficulty_instructions}"
        f"- Target {config.target_duration_minutes} minutes and wrap up by {config.effective_max_minutes} minutes.\n"
        "- Never reveal live scores or grading during the conversation.\n"
        "- Prompt the user to write actual code in the Monaco IDE for Round 2, and parse the execution results to grade their algorithmic efficiency.\n"
    )


def build_question_plan(context: InterviewContext, config: SessionConfig) -> list[QuestionItem]:
    """Build a structured, configurable question plan conforming to Problem Statement 2."""
    role = _shorten(context.target_role) or "your target role"
    project = _shorten(context.projects[0]) if context.projects else ""
    skill = _shorten(config.focus_topics[0]) if config.focus_topics else (
        _shorten(context.skills[0]) if context.skills else ""
    )
    experience = _shorten(context.experience[0]) if context.experience else ""
    resume_detail = _shorten(context.summary)

    project_focus = project or resume_detail or "the strongest project on your resume"
    skill_focus = skill or "the primary technology used in that project"
    experience_focus = experience or project_focus

    items: list[QuestionItem] = []

    # 1. Warm-up Introduction (HR 1)
    items.append(
        QuestionItem(
            id="q_intro",
            category=QuestionCategory.INTRO,
            text=f"Could you introduce yourself and explain what excites you about {role}?",
            probe_goal="Evaluate communication clarity, professional background, and role alignment",
        )
    )

    # 2. Project Deep-Dive(s) - Supports up to 3 deep-dives matching SessionConfig
    for idx in range(config.project_deep_dive_count):
        proj_text = context.projects[idx] if idx < len(context.projects) else project_focus
        if idx == 0:
            items.append(
                QuestionItem(
                    id=f"q_project_{idx+1}",
                    category=QuestionCategory.PROJECT_DEEP_DIVE,
                    text=(
                        f"Your resume mentions {proj_text}. What problem did it solve, what was "
                        "your personal contribution, and how did you design the core architecture?"
                    ),
                    probe_goal="Probe system architecture, personal ownership, and component design",
                )
            )
        elif idx == 1:
            items.append(
                QuestionItem(
                    id=f"q_project_{idx+1}",
                    category=QuestionCategory.PROJECT_DEEP_DIVE,
                    text=(
                        f"Deep-diving into {proj_text}, describe the hardest technical trade-off "
                        "you made, the alternative you rejected, and the measurable outcome."
                    ),
                    probe_goal="Probe technical trade-offs, rejection rationale, and measurable results",
                )
            )
        else:
            items.append(
                QuestionItem(
                    id=f"q_project_{idx+1}",
                    category=QuestionCategory.PROJECT_DEEP_DIVE,
                    text=(
                        f"Regarding {proj_text}, how did you ensure test coverage, monitor production reliability, and handle unexpected edge cases or load spikes?"
                    ),
                    probe_goal="Probe production hardening, telemetry, and resilience in projects",
                )
            )

    # 3. Technical Questions from Question Bank
    role_lower = (context.target_role or config.role_category).lower()
    is_frontend = any(kw in role_lower for kw in ["frontend", "react", "ui", "web"])
    pool = FRONTEND_QUESTION_POOL if is_frontend else BACKEND_QUESTION_POOL

    tech_target = config.technical_question_count

    # Tech Question A: Skill focus
    if tech_target >= 1:
        items.append(
            QuestionItem(
                id="q_tech_skill",
                category=QuestionCategory.TECHNICAL,
                text=(
                    f"Your resume highlights {skill_focus}. Explain one production-level use of it, "
                    "including failure handling, testing, and performance considerations."
                ),
                probe_goal=f"Assess production-level competency in {skill_focus}",
            )
        )

    # Tech Question B: Reliability & debugging
    if tech_target >= 2:
        items.append(
            QuestionItem(
                id="q_tech_reliability",
                category=QuestionCategory.RELIABILITY,
                text=(
                    f"Based on {experience_focus}, walk me through a difficult defect or reliability "
                    "problem: how did you isolate the cause and verify the fix?"
                ),
                probe_goal="Assess debugging methodology, root-cause isolation, and verification",
            )
        )

    # Remaining technical questions from curated bank to meet config.technical_question_count
    remaining_tech = max(0, tech_target - 2)
    for idx in range(remaining_tech):
        q_text, probe_goal = pool[idx % len(pool)]
        items.append(
            QuestionItem(
                id=f"q_tech_{idx+1}",
                category=QuestionCategory.TECHNICAL,
                text=q_text,
                probe_goal=probe_goal,
            )
        )

    # 4. Behavioral / HR Questions (STAR framework)
    for idx in range(config.hr_question_count):
        q_text, probe_goal = BEHAVIORAL_QUESTION_POOL[idx % len(BEHAVIORAL_QUESTION_POOL)]
        items.append(
            QuestionItem(
                id=f"q_hr_{idx+1}",
                category=QuestionCategory.BEHAVIORAL,
                text=q_text,
                probe_goal=probe_goal,
            )
        )

    return items



def _shorten(value: str, limit: int = 180) -> str:
    compact = " ".join(value.split()).rstrip(" .,:;")
    return compact if len(compact) <= limit else f"{compact[: limit - 1].rstrip()}…"


def _generate_conversational_acknowledgment(answer: str) -> str:
    """Produce an empathetic, content-aware transition acknowledging candidate input."""
    clean = answer.strip().lower()
    if not clean:
        return ""

    # 1. Candidate is unsure, passed, or lacks specific exposure
    unsure_phrases = [
        "i don't know", "dont know", "not sure", "no idea", "pass", "skip",
        "can't say", "cannot say", "haven't used", "have not used", "never used",
    ]
    if any(phrase in clean for phrase in unsure_phrases):
        return (
            "Understood, that's completely fair! In engineering, knowing the bounds of your "
            "experience is valuable. Let's explore another area."
        )

    # 2. Scalability, caching, and distributed systems
    scale_keywords = [
        "scale", "scaling", "traffic", "throughput", "latency", "redis", "kafka",
        "rabbitmq", "sharding", "replication", "partition", "caching", "cache",
        "rate limit", "load balancer", "cdn", "elasticsearch", "queue",
    ]
    if any(kw in clean for kw in scale_keywords):
        return "That's a thoughtful approach to handling throughput, data flow, and system scalability."

    # 3. Backend architectures, APIs, and data layers
    backend_keywords = [
        "fastapi", "postgresql", "postgres", "django", "node", "express", "go", "golang",
        "python", "graphql", "rest", "idempotency", "transactions", "microservices",
        "sql", "nosql", "mongodb", "database", "orm", "prisma", "sqlalchemy", "jwt",
    ]
    matched_backend = [kw for kw in backend_keywords if kw in clean]
    if matched_backend:
        tech_name = matched_backend[0].capitalize() if matched_backend[0] not in {"fastapi", "postgresql"} else matched_backend[0]
        return f"I like how you structured the engineering around {tech_name} and clean data contracts."

    # 4. Frontend, user interface, and client state
    frontend_keywords = [
        "react", "next.js", "vue", "angular", "redux", "zustand", "tailwind",
        "css", "dom", "component", "hydration", "ssr", "responsive", "monaco",
    ]
    if any(kw in clean for kw in frontend_keywords):
        return "That gives clear insight into how you manage client state, component hierarchy, and user experience."

    # 5. Testing, reliability, observability, and DevOps
    reliability_keywords = [
        "test", "testing", "pytest", "jest", "mock", "docker", "kubernetes",
        "k8s", "ci/cd", "pipeline", "sentry", "monitoring", "telemetry", "prometheus",
        "grafana", "defect", "bug", "debugging", "isolation", "logs",
    ]
    if any(kw in clean for kw in reliability_keywords):
        return "Excellent emphasis on verification, observability, and defensive engineering."

    # 6. Algorithms, complexity, and data structures
    dsa_keywords = [
        "complexity", "o(n)", "o(1)", "o(log n)", "binary search", "hash map",
        "tree", "graph", "dynamic programming", "space complexity", "time complexity",
    ]
    if any(kw in clean for kw in dsa_keywords):
        return "That is a sound breakdown of algorithmic trade-offs and complexity constraints."

    # 7. Team collaboration, feedback, and leadership
    behavioral_keywords = [
        "team", "feedback", "manager", "disagreed", "agreed", "collaborated",
        "mentor", "sprint", "agile", "stakeholder", "retrospective", "priority",
    ]
    if any(kw in clean for kw in behavioral_keywords):
        return "I appreciate you sharing that real-world perspective on team dynamics and constructive alignment."

    # 8. Brief response
    words = clean.split()
    if len(words) < 6:
        return "Got it, thanks for that initial summary. Let's build on that."

    # 9. General thoughtful response
    return "Thank you for walking me through that approach."
