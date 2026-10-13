from .calculator import PlacementReadinessCalculator, WEIGHTS
from .models import (
    StudentProfileEvaluation,
    ReadinessReport,
    ActionItem,
    ProjectItem,
    ResumeInput,
    CanonicalInterviewResult,
    InterviewDimensions,
    GitHubActivityInput,
    CodingPracticeInput,
    LinkedInInput,
    CoCurricularInput,
    ALGORITHM_VERSION,
    CANONICAL_INTERVIEW_CONTRACT_VERSION
)

# Backward compatibility alias
MockInterviewInput = CanonicalInterviewResult

__all__ = [
    "PlacementReadinessCalculator",
    "WEIGHTS",
    "StudentProfileEvaluation",
    "ReadinessReport",
    "ActionItem",
    "ProjectItem",
    "ResumeInput",
    "CanonicalInterviewResult",
    "InterviewDimensions",
    "MockInterviewInput",
    "GitHubActivityInput",
    "CodingPracticeInput",
    "LinkedInInput",
    "CoCurricularInput",
    "ALGORITHM_VERSION",
    "CANONICAL_INTERVIEW_CONTRACT_VERSION"
]
