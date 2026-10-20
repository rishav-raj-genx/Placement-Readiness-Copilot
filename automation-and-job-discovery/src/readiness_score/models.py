from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

# Contract version for interview session payload
CANONICAL_INTERVIEW_CONTRACT_VERSION = "v0"
ALGORITHM_VERSION = "v2.0.0"


class InterviewDimensions(BaseModel):
    score: float = Field(default=0.0, ge=0.0, le=100.0)
    feedback: Optional[str] = ""
    strengths: List[str] = Field(default_factory=list)
    improvement_areas: List[str] = Field(default_factory=list)


class CanonicalInterviewResult(BaseModel):
    contract_version: str = CANONICAL_INTERVIEW_CONTRACT_VERSION
    interview_score: float = Field(default=0.0, ge=0.0, le=100.0)
    transcript: List[Dict[str, Any]] = Field(default_factory=list)
    summary: Optional[str] = ""
    dimensions: Optional[Dict[str, InterviewDimensions]] = None
    is_provisional: bool = False
    is_fallback: bool = False

    @model_validator(mode="before")
    @classmethod
    def validate_version(cls, data: Any) -> Any:
        if isinstance(data, dict):
            ver = data.get("contract_version")
            if ver != CANONICAL_INTERVIEW_CONTRACT_VERSION:
                raise ValueError(
                    f"Unsupported interview contract_version: '{ver}'. Expected '{CANONICAL_INTERVIEW_CONTRACT_VERSION}'"
                )
        return data


class ResumeInput(BaseModel):
    score: float = Field(default=0.0, ge=0.0, le=100.0, description="Resume quality score (0-100)")
    has_metrics: bool = False
    page_count: int = 1
    has_action_verbs: bool = False
    has_clean_formatting: bool = False
    missing_elements: List[str] = Field(default_factory=list)


class ProjectItem(BaseModel):
    name: str = "Project"
    live_url: Optional[str] = None
    repo_url: Optional[str] = None
    live_link_score: float = Field(default=0.0, ge=0.0, le=100.0)
    code_quality_score: float = Field(default=0.0, ge=0.0, le=100.0)
    documentation_score: float = Field(default=0.0, ge=0.0, le=100.0)
    has_readme: bool = False
    is_live: bool = False
    is_verified: bool = False


class GitHubActivityInput(BaseModel):
    score: float = Field(
        default=0.0, ge=0.0, le=100.0, description="GitHub profile activity score (0-100)"
    )
    pinned_repos_count: int = 0
    recent_commit_streak_days: int = 0
    has_profile_readme: bool = False


class CodingPracticeInput(BaseModel):
    score: float = Field(
        default=0.0, ge=0.0, le=100.0, description="Coding practice / LeetCode score (0-100)"
    )
    problems_solved: int = 0
    easy_count: int = 0
    medium_count: int = 0
    hard_count: int = 0


class LinkedInInput(BaseModel):
    score: float = Field(
        default=0.0, ge=0.0, le=100.0, description="LinkedIn profile score (0-100)"
    )
    has_headline: bool = False
    has_about_summary: bool = False
    experience_matches_resume: bool = False


class CoCurricularInput(BaseModel):
    score: float = Field(
        default=0.0, ge=0.0, le=100.0, description="Achievements, hackathons, clubs (0-100)"
    )
    hackathons_count: int = 0
    certifications_count: int = 0
    club_leadership: bool = False


class StudentProfileEvaluation(BaseModel):
    student_id: str = "student_001"
    student_name: Optional[str] = "Student Candidate"
    resume: Optional[ResumeInput] = None
    projects: List[ProjectItem] = Field(default_factory=list)
    interview_session_result: Optional[CanonicalInterviewResult] = None
    # Provisional backward compatibility
    mock_interview_legacy_score: Optional[float] = None
    github: Optional[GitHubActivityInput] = None
    coding_practice: Optional[CodingPracticeInput] = None
    linkedin: Optional[LinkedInInput] = None
    co_curricular: Optional[CoCurricularInput] = None

    @classmethod
    def from_profile_review_api(
        cls,
        review_data: Dict[str, Any],
        student_id: str = "student_001",
        projects: Optional[List[ProjectItem]] = None,
        interview_session_result: Optional[CanonicalInterviewResult] = None,
    ) -> "StudentProfileEvaluation":
        """
        Adapter that ingests Member 2 (Rishav)'s Profile Review API response:
        POST /analyze-profile -> { resume_review, github_review, linkedin_review }
        """
        resume_data = review_data.get("resume_review")
        resume_input = None
        if resume_data:
            resume_input = ResumeInput(
                score=float(resume_data.get("score", 0.0)),
                has_clean_formatting=resume_data.get("is_ats_friendly", True),
                has_action_verbs=resume_data.get("uses_action_verbs", True),
                page_count=1 if resume_data.get("is_one_page", True) else 2,
                missing_elements=resume_data.get("specific_fixes", []),
            )

        github_data = review_data.get("github_review")
        github_input = None
        if github_data:
            github_input = GitHubActivityInput(score=float(github_data.get("score", 0.0)))

        linkedin_data = review_data.get("linkedin_review")
        linkedin_input = None
        if linkedin_data:
            linkedin_input = LinkedInInput(
                score=float(linkedin_data.get("score", 0.0)),
                has_headline=True,
                has_about_summary=linkedin_data.get("has_complete_profile", True),
            )

        return cls(
            student_id=student_id,
            resume=resume_input,
            github=github_input,
            linkedin=linkedin_input,
            projects=projects or [],
            interview_session_result=interview_session_result,
        )


class ActionItem(BaseModel):
    rank: int
    category: str
    action: str
    potential_point_gain: float
    description: str


class PersistenceStatus(BaseModel):
    attempted: bool = False
    success: bool = False
    source: Literal["not_requested", "supabase", "local_sqlite"] = "not_requested"


class ReadinessReport(BaseModel):
    student_id: str
    algorithm_version: str = ALGORITHM_VERSION
    total_score: float
    is_provisional: bool
    missing_components: List[str]
    readiness_level: str  # 'Not ready' (0-49), 'Almost ready' (50-74), 'Placement ready' (75-100), or 'Incomplete'
    category_scores: Dict[str, Dict[str, Any]]
    top_actions: List[ActionItem]
    is_placement_ready: bool
    persistence: PersistenceStatus = Field(default_factory=PersistenceStatus)
