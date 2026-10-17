"""Translate fixture/external resume payloads into the internal context model.

Only this module knows the currently provisional resume shape.
"""

from __future__ import annotations

import re
from collections.abc import Mapping

from scoring.schemas import CONTRACT_VERSION, InterviewContext

SECTION_HEADINGS = {
    "education",
    "experience",
    "projects",
    "skills",
    "summary",
}


def adapt_resume(resume: object | None) -> InterviewContext:
    """Return safe normalized context for an incomplete or malformed resume."""

    source = _mapping(resume)
    student = _mapping(source.get("student"))
    nested_resume = _mapping(source.get("resume"))
    resume_data = nested_resume or source
    job = _mapping(source.get("job"))
    parsed_text = _text(
        resume_data.get("parsedText")
        or resume_data.get("parsed_text")
        or resume_data.get("text")
        or resume_data.get("summary")
    )
    skills = _texts(resume_data.get("keySkills") or resume_data.get("skills"))
    projects = _project_texts(resume_data.get("projects"))
    experience = _texts(resume_data.get("experience"))
    education = _texts(resume_data.get("education"))

    return InterviewContext(
        contract_version=CONTRACT_VERSION,
        candidate_name=_text(student.get("name") or source.get("name") or source.get("full_name")),
        target_role=_text(
            student.get("targetRole")
            or job.get("title")
            or source.get("target_role")
            or source.get("role")
        ),
        summary=parsed_text,
        skills=skills or _skills_from_text(parsed_text),
        projects=projects or _section_lines(parsed_text, "projects"),
        experience=experience or _section_lines(parsed_text, "experience"),
        education=education or _section_lines(parsed_text, "education"),
    )


def _mapping(value: object | None) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        return {}
    return {key: item for key, item in value.items() if isinstance(key, str)}


def _text(value: object | None) -> str:
    return value.strip() if isinstance(value, str) else ""


def _texts(value: object | None) -> list[str]:
    if not isinstance(value, list):
        return []
    return [_text(item) for item in value if isinstance(item, str) and item.strip()]


def _project_texts(value: object | None) -> list[str]:
    if not isinstance(value, list):
        return []
    projects: list[str] = []
    for project in value:
        if isinstance(project, str) and project.strip():
            projects.append(project.strip())
        elif isinstance(project, Mapping):
            normalized = _mapping(project)
            name = _text(normalized.get("name") or normalized.get("title"))
            description = _text(normalized.get("description"))
            text = " - ".join(part for part in (name, description) if part)
            if text:
                projects.append(text)
    return projects


def _section_lines(text: str, heading: str) -> list[str]:
    if not text:
        return []

    collected: list[str] = []
    in_section = False
    for raw_line in text.splitlines():
        line = raw_line.strip()
        normalized = line.lower().rstrip(":")
        if normalized in SECTION_HEADINGS:
            in_section = normalized == heading
            continue
        if in_section and line:
            collected.append(line)
    return collected[:5]


def _skills_from_text(text: str) -> list[str]:
    lines = _section_lines(text, "skills")
    if not lines:
        return []
    candidates = re.split(r"[,|;/\s]+", " ".join(lines))
    return [candidate for candidate in candidates if candidate][:12]
