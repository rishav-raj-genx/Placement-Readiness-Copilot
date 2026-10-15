"""Translate fixture/external resume payloads into the internal context model.

Only this module knows the currently provisional resume shape.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, List, Optional

from scoring.schemas import CONTRACT_VERSION, InterviewContext


def adapt_resume(resume: Optional[Mapping[str, Any]]) -> InterviewContext:
    """Return safe normalized context for an incomplete or malformed resume."""

    source = resume if isinstance(resume, Mapping) else {}
    student = source.get("student")
    student = student if isinstance(student, Mapping) else {}
    resume_data = source.get("resume")
    resume_data = resume_data if isinstance(resume_data, Mapping) else source
    job = source.get("job")
    job = job if isinstance(job, Mapping) else {}
    return InterviewContext(
        contract_version=CONTRACT_VERSION,
        candidate_name=_text(
            student.get("name") or source.get("name") or source.get("full_name")
        ),
        target_role=_text(
            student.get("targetRole")
            or job.get("title")
            or source.get("target_role")
            or source.get("role")
        ),
        summary=_text(resume_data.get("parsedText") or resume_data.get("summary")),
        skills=_texts(resume_data.get("keySkills") or resume_data.get("skills")),
        projects=_project_texts(resume_data.get("projects")),
        experience=_texts(resume_data.get("experience")),
        education=_texts(resume_data.get("education")),
    )


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _texts(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [_text(item) for item in value if isinstance(item, str) and item.strip()]


def _project_texts(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    projects: List[str] = []
    for project in value:
        if isinstance(project, str) and project.strip():
            projects.append(project.strip())
        elif isinstance(project, Mapping):
            name = _text(project.get("name") or project.get("title"))
            description = _text(project.get("description"))
            text = " - ".join(part for part in (name, description) if part)
            if text:
                projects.append(text)
    return projects
