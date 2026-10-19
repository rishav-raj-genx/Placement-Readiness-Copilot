from .calculator import WEIGHTS, PlacementReadinessCalculator
from .models import (
    ALGORITHM_VERSION,
    CANONICAL_INTERVIEW_CONTRACT_VERSION,
    ActionItem,
    CanonicalInterviewResult,
    CoCurricularInput,
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
    "LinkedInInput",
    "CoCurricularInput",
    "ALGORITHM_VERSION",
    "CANONICAL_INTERVIEW_CONTRACT_VERSION",
]
