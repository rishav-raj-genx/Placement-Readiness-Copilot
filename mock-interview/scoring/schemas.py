"""Pydantic schemas shared by the mock interview service and its consumers.

This module is the single source of truth for the draft v0 output contract.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

CONTRACT_VERSION = "v0"


class InterviewContext(BaseModel):
    """Normalized context consumed by interview and scoring code."""

    model_config = ConfigDict(extra="forbid")

    contract_version: Literal["v0"] = CONTRACT_VERSION
    candidate_name: str = ""
    target_role: str = ""
    summary: str = ""
    skills: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)
    experience: list[str] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)


class TranscriptTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    speaker: Literal["ai", "student"]
    text: str
    timestamp_sec: float | None = Field(default=None, ge=0)


class DimensionScore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    score: int = Field(ge=0, le=100)
    feedback: str = ""
    strengths: list[str] = Field(default_factory=list)
    improvement_areas: list[str] = Field(default_factory=list)


class InterviewResult(BaseModel):
    """Stable result returned after an interview and persisted for consumers."""

    model_config = ConfigDict(extra="forbid")

    contract_version: Literal["v0"] = CONTRACT_VERSION
    interview_score: float = Field(ge=0, le=100)
    transcript: list[TranscriptTurn] = Field(min_length=1)
    summary: str = Field(min_length=1)
    strengths: list[str] = Field(min_length=1)
    improvement_areas: list[str] = Field(min_length=1)
    dimensions: dict[str, DimensionScore] = Field(min_length=3)

    @model_validator(mode="after")
    def require_scoring_dimensions(self) -> InterviewResult:
        required = {"communication", "technical_depth", "behavioral"}
        missing = sorted(required.difference(self.dimensions))
        if missing:
            raise ValueError(f"missing scoring dimensions: {', '.join(missing)}")
        return self


def contract_markdown() -> str:
    """Render the draft contract from the Pydantic models.

    Keeping this renderer next to the models makes the generated markdown
    discoverable and prevents documentation from becoming a second schema.
    """

    result_schema = InterviewResult.model_json_schema()
    context_schema = InterviewContext.model_json_schema()
    transcript_schema = TranscriptTurn.model_json_schema()
    dimension_schema = DimensionScore.model_json_schema()
    return f"""# Mock Interview Contract

**DRAFT v0, not agreed with teammates**

This document is generated from `scoring/schemas.py`. The Pydantic models are
the single source of truth.

## Versioning

- `contract_version` is `"v0"` on every context and result.
- `interview_score` is always a top-level number from 0 through 100.
- Transcript speakers are `"ai"` or `"student"`, with `timestamp_sec`.

## Internal interview context

```json
{_pretty_json(context_schema)}
```

## Interview result

```json
{_pretty_json(result_schema)}
```

## Supporting objects

### Transcript turn

```json
{_pretty_json(transcript_schema)}
```

### Dimension score

```json
{_pretty_json(dimension_schema)}
```
"""


def _pretty_json(value: object) -> str:
    import json

    return json.dumps(value, indent=2, sort_keys=True)
