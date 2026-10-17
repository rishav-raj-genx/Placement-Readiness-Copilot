import logging
from typing import Any, Dict, List, Optional, Tuple

from src.db.supabase_client import db_client
from src.readiness_score.models import (
    ALGORITHM_VERSION,
    CANONICAL_INTERVIEW_CONTRACT_VERSION,
    ActionItem,
    PersistenceStatus,
    ProjectItem,
    ReadinessReport,
    StudentProfileEvaluation,
)

logger = logging.getLogger("readiness_calculator")


class ReadinessPersistenceError(RuntimeError):
    """Raised when a caller requires a live Supabase write but it did not occur."""


# Official weights (Problem 2, Page 12)
WEIGHTS = {
    "resume": 0.25,
    "projects": 0.25,
    "mock_interview": 0.20,
    "github": 0.10,
    "coding_practice": 0.10,
    "linkedin": 0.05,
    "co_curricular": 0.05,
}


class PlacementReadinessCalculator:
    """
    Placement Readiness Score Algorithm v1.0.0.
    Implements canonical extraction from `interview_sessions.result` (contract_version: v0),
    official weights, bounding [0, 100], missing-input handling, and top 5 actions.
    """

    @classmethod
    def clamp(cls, value: float) -> float:
        """Clamps score between 0.0 and 100.0."""
        return max(0.0, min(100.0, float(value)))

    @classmethod
    def calculate_project_score(cls, projects: List[ProjectItem]) -> float:
        if not projects:
            return 0.0

        project_scores = []
        for p in projects:
            p_score = (
                (cls.clamp(p.live_link_score) * 0.40)
                + (cls.clamp(p.code_quality_score) * 0.40)
                + (cls.clamp(p.documentation_score) * 0.20)
            )
            project_scores.append(p_score)

        return round(sum(project_scores) / len(project_scores), 2)

    @classmethod
    def extract_interview_score(
        cls, profile: StudentProfileEvaluation
    ) -> Tuple[Optional[float], Optional[str]]:
        """
        Extracts interview score from canonical `interview_sessions.result`.
        Falls back to provisional legacy source if canonical is absent.
        Returns: (score, error_message)
        """
        if profile.interview_session_result is not None:
            # Canonical interview_sessions.result
            if (
                profile.interview_session_result.contract_version
                != CANONICAL_INTERVIEW_CONTRACT_VERSION
            ):
                return (
                    None,
                    f"Unsupported contract_version '{profile.interview_session_result.contract_version}'",
                )
            return cls.clamp(profile.interview_session_result.interview_score), None

        if profile.mock_interview_legacy_score is not None:
            logger.info("Using provisional legacy mock interview score")
            return cls.clamp(profile.mock_interview_legacy_score), None

        return None, "No interview session result present"

    @classmethod
    def calculate_readiness(
        cls,
        profile: StudentProfileEvaluation,
        save_to_db: bool = True,
        require_supabase: bool = False,
    ) -> ReadinessReport:
        missing_components: List[str] = []

        # 1. Resume subscore
        if profile.resume is not None:
            resume_raw = cls.clamp(profile.resume.score)
        else:
            resume_raw = 0.0
            missing_components.append("resume")

        # 2. Projects subscore
        if profile.projects:
            projects_raw = cls.calculate_project_score(profile.projects)
        else:
            projects_raw = 0.0
            missing_components.append("projects")

        # 3. Interview subscore (Canonical: interview_sessions.result)
        interview_score_val, interview_err = cls.extract_interview_score(profile)
        if interview_score_val is not None:
            interview_raw = interview_score_val
        else:
            interview_raw = 0.0
            missing_components.append("mock_interview")

        # 4. GitHub
        if profile.github is not None:
            github_raw = cls.clamp(profile.github.score)
        else:
            github_raw = 0.0
            missing_components.append("github")

        # 5. Coding practice
        if profile.coding_practice is not None:
            coding_raw = cls.clamp(profile.coding_practice.score)
        else:
            coding_raw = 0.0
            missing_components.append("coding_practice")

        # 6. LinkedIn
        if profile.linkedin is not None:
            linkedin_raw = cls.clamp(profile.linkedin.score)
        else:
            linkedin_raw = 0.0
            missing_components.append("linkedin")

        # 7. Co-curricular
        if profile.co_curricular is not None:
            co_curr_raw = cls.clamp(profile.co_curricular.score)
        else:
            co_curr_raw = 0.0
            missing_components.append("co_curricular")

        # Breakdown calculation
        weighted_breakdown = {
            "resume": {
                "weight": WEIGHTS["resume"],
                "raw_score": resume_raw,
                "weighted_points": round(resume_raw * WEIGHTS["resume"], 2),
                "present": "resume" not in missing_components,
            },
            "projects": {
                "weight": WEIGHTS["projects"],
                "raw_score": projects_raw,
                "weighted_points": round(projects_raw * WEIGHTS["projects"], 2),
                "present": "projects" not in missing_components,
            },
            "mock_interview": {
                "weight": WEIGHTS["mock_interview"],
                "raw_score": interview_raw,
                "weighted_points": round(interview_raw * WEIGHTS["mock_interview"], 2),
                "present": "mock_interview" not in missing_components,
            },
            "github": {
                "weight": WEIGHTS["github"],
                "raw_score": github_raw,
                "weighted_points": round(github_raw * WEIGHTS["github"], 2),
                "present": "github" not in missing_components,
            },
            "coding_practice": {
                "weight": WEIGHTS["coding_practice"],
                "raw_score": coding_raw,
                "weighted_points": round(coding_raw * WEIGHTS["coding_practice"], 2),
                "present": "coding_practice" not in missing_components,
            },
            "linkedin": {
                "weight": WEIGHTS["linkedin"],
                "raw_score": linkedin_raw,
                "weighted_points": round(linkedin_raw * WEIGHTS["linkedin"], 2),
                "present": "linkedin" not in missing_components,
            },
            "co_curricular": {
                "weight": WEIGHTS["co_curricular"],
                "raw_score": co_curr_raw,
                "weighted_points": round(co_curr_raw * WEIGHTS["co_curricular"], 2),
                "present": "co_curricular" not in missing_components,
            },
        }

        total_score = round(sum(item["weighted_points"] for item in weighted_breakdown.values()), 2)
        is_provisional = len(missing_components) > 0

        # Readiness level (Problem 2, Page 12)
        # 0–49: Not ready, 50–74: Almost ready, 75–100: Placement ready
        if total_score >= 75.0:
            readiness_level = "Placement ready"
        elif total_score >= 50.0:
            readiness_level = "Almost ready"
        else:
            readiness_level = "Not ready"

        top_actions = cls._generate_top_actions(profile, weighted_breakdown, missing_components)

        persistence = PersistenceStatus()

        if save_to_db:
            db_payload = {
                "student_id": profile.student_id,
                "algorithm_version": ALGORITHM_VERSION,
                "total_score": total_score,
                "readiness_level": readiness_level,
                "breakdown": weighted_breakdown,
                "top_actions": [action.model_dump() for action in top_actions],
                "raw_inputs": {
                    "algorithm_version": ALGORITHM_VERSION,
                    "is_provisional": is_provisional,
                    "missing_components": missing_components,
                },
            }
            persistence_result = db_client.save_readiness_score(db_payload)
            persistence_source = persistence_result.get("source", "local_sqlite")
            persistence = PersistenceStatus(
                attempted=True,
                success=bool(persistence_result.get("success")),
                source=persistence_source,
            )

            if require_supabase and (not persistence.success or persistence.source != "supabase"):
                raise ReadinessPersistenceError(
                    "Live Supabase persistence was required, but the score was not "
                    f"written to Supabase (source={persistence.source})."
                )

        report = ReadinessReport(
            student_id=profile.student_id,
            algorithm_version=ALGORITHM_VERSION,
            total_score=total_score,
            is_provisional=is_provisional,
            missing_components=missing_components,
            readiness_level=readiness_level,
            category_scores=weighted_breakdown,
            top_actions=top_actions,
            is_placement_ready=(readiness_level == "Placement ready" and not is_provisional),
            persistence=persistence,
        )

        return report

    @classmethod
    def _generate_top_actions(
        cls,
        profile: StudentProfileEvaluation,
        breakdown: Dict[str, Dict[str, Any]],
        missing_components: List[str],
    ) -> List[ActionItem]:
        candidates: List[Dict[str, Any]] = []

        if "mock_interview" in missing_components:
            candidates.append(
                {
                    "category": "Mock Interview",
                    "action": "Complete your first 15-minute AI technical mock viva",
                    "potential_point_gain": round(100 * WEIGHTS["mock_interview"], 1),
                    "description": "Mock interview is worth 20 points. Completing it will immediately raise your readiness score.",
                }
            )

        if "projects" in missing_components:
            candidates.append(
                {
                    "category": "Projects",
                    "action": "Add and deploy at least 1-2 featured projects with live links",
                    "potential_point_gain": round(100 * WEIGHTS["projects"], 1),
                    "description": "Projects account for 25% of your total placement score.",
                }
            )

        if "resume" in missing_components:
            candidates.append(
                {
                    "category": "Resume",
                    "action": "Upload and parse your ATS resume",
                    "potential_point_gain": round(100 * WEIGHTS["resume"], 1),
                    "description": "Resume quality is worth 25 points.",
                }
            )

        # Deficit scoring
        for cat, info in breakdown.items():
            if info["present"] and info["raw_score"] < 85.0:
                potential_gain = round((90.0 - info["raw_score"]) * info["weight"], 1)
                if cat == "projects":
                    candidates.append(
                        {
                            "category": "Projects",
                            "action": "Deploy live links with SSL and add README test instructions",
                            "potential_point_gain": max(3.0, potential_gain),
                            "description": "Ensure project URLs load without console errors on mobile viewports.",
                        }
                    )
                elif cat == "resume":
                    candidates.append(
                        {
                            "category": "Resume",
                            "action": "Add measurable metrics (percentages and numbers) to project bullets",
                            "potential_point_gain": max(2.5, potential_gain),
                            "description": "ATS algorithms score resumes higher when bullets demonstrate quantifiable business impact.",
                        }
                    )
                elif cat == "mock_interview":
                    candidates.append(
                        {
                            "category": "Mock Interview",
                            "action": "Retake AI mock interview to improve technical depth and communication",
                            "potential_point_gain": max(2.0, potential_gain),
                            "description": "Higher mock viva scores directly raise your placement readiness tier.",
                        }
                    )
                elif cat == "coding_practice":
                    candidates.append(
                        {
                            "category": "Coding Practice",
                            "action": "Solve 20 more LeetCode Medium problems in DSA",
                            "potential_point_gain": max(1.5, potential_gain),
                            "description": "Screening rounds require strong fundamentals in Graphs, Trees, and DP.",
                        }
                    )
                elif cat == "github":
                    candidates.append(
                        {
                            "category": "GitHub",
                            "action": "Improve repository READMEs and publish recent project commits",
                            "potential_point_gain": max(1.0, potential_gain),
                            "description": "Clear documentation and recent activity make project work easier to verify.",
                        }
                    )
                elif cat == "linkedin":
                    candidates.append(
                        {
                            "category": "LinkedIn",
                            "action": "Align your headline, skills, and project experience with target roles",
                            "potential_point_gain": max(0.5, potential_gain),
                            "description": "A complete role-specific profile improves recruiter discoverability.",
                        }
                    )
                elif cat == "co_curricular":
                    candidates.append(
                        {
                            "category": "Co-curricular",
                            "action": "Add verified hackathon, certification, or leadership achievements",
                            "potential_point_gain": max(0.5, potential_gain),
                            "description": "Evidence of initiative and teamwork strengthens the overall profile.",
                        }
                    )

        candidates.sort(key=lambda x: x["potential_point_gain"], reverse=True)

        actions: List[ActionItem] = []
        for i, item in enumerate(candidates[:5]):
            actions.append(
                ActionItem(
                    rank=i + 1,
                    category=item["category"],
                    action=item["action"],
                    potential_point_gain=item["potential_point_gain"],
                    description=item["description"],
                )
            )

        return actions
