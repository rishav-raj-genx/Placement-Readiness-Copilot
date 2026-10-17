from .calculator import WEIGHTS, PlacementReadinessCalculator
from .models import (
    ALGORITHM_VERSION,
    CANONICAL_INTERVIEW_CONTRACT_VERSION,
    ActionItem,
    CanonicalInterviewResult,
    CoCurricularInput,
    CodingPracticeInput,
    GitHubActivityInput,
    InterviewDimensions,
    LinkedInInput,
    ProjectItem,
    ReadinessReport,
    ResumeInput,
    StudentProfileEvaluation,
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
    "CANONICAL_INTERVIEW_CONTRACT_VERSION",
]
