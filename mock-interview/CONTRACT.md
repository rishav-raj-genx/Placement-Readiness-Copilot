# Mock Interview Contract

**DRAFT v0, not agreed with teammates**

This document is generated from `scoring/schemas.py`. The Pydantic models are
the single source of truth.

## Versioning

- `contract_version` is `"v0"` on every context and result.
- `interview_score` is always a top-level number from 0 through 100.
- Transcript speakers are `"ai"` or `"student"`, with `timestamp_sec`.

## Internal interview context

```json
{
  "additionalProperties": false,
  "description": "Normalized context consumed by interview and scoring code.",
  "properties": {
    "candidate_name": {
      "default": "",
      "title": "Candidate Name",
      "type": "string"
    },
    "contract_version": {
      "const": "v0",
      "default": "v0",
      "title": "Contract Version",
      "type": "string"
    },
    "education": {
      "items": {
        "type": "string"
      },
      "title": "Education",
      "type": "array"
    },
    "experience": {
      "items": {
        "type": "string"
      },
      "title": "Experience",
      "type": "array"
    },
    "projects": {
      "items": {
        "type": "string"
      },
      "title": "Projects",
      "type": "array"
    },
    "skills": {
      "items": {
        "type": "string"
      },
      "title": "Skills",
      "type": "array"
    },
    "summary": {
      "default": "",
      "title": "Summary",
      "type": "string"
    },
    "target_role": {
      "default": "",
      "title": "Target Role",
      "type": "string"
    }
  },
  "title": "InterviewContext",
  "type": "object"
}
```

## Interview result

```json
{
  "$defs": {
    "DimensionScore": {
      "additionalProperties": false,
      "properties": {
        "feedback": {
          "default": "",
          "title": "Feedback",
          "type": "string"
        },
        "improvement_areas": {
          "items": {
            "type": "string"
          },
          "title": "Improvement Areas",
          "type": "array"
        },
        "score": {
          "maximum": 100,
          "minimum": 0,
          "title": "Score",
          "type": "integer"
        },
        "strengths": {
          "items": {
            "type": "string"
          },
          "title": "Strengths",
          "type": "array"
        }
      },
      "required": [
        "score"
      ],
      "title": "DimensionScore",
      "type": "object"
    },
    "TranscriptTurn": {
      "additionalProperties": false,
      "properties": {
        "speaker": {
          "enum": [
            "ai",
            "student"
          ],
          "title": "Speaker",
          "type": "string"
        },
        "text": {
          "title": "Text",
          "type": "string"
        },
        "timestamp_sec": {
          "anyOf": [
            {
              "minimum": 0,
              "type": "number"
            },
            {
              "type": "null"
            }
          ],
          "default": null,
          "title": "Timestamp Sec"
        }
      },
      "required": [
        "speaker",
        "text"
      ],
      "title": "TranscriptTurn",
      "type": "object"
    }
  },
  "additionalProperties": false,
  "description": "Stable result returned after an interview and persisted for consumers.",
  "properties": {
    "contract_version": {
      "const": "v0",
      "default": "v0",
      "title": "Contract Version",
      "type": "string"
    },
    "dimensions": {
      "additionalProperties": {
        "$ref": "#/$defs/DimensionScore"
      },
      "title": "Dimensions",
      "type": "object"
    },
    "improvement_areas": {
      "items": {
        "type": "string"
      },
      "title": "Improvement Areas",
      "type": "array"
    },
    "interview_score": {
      "maximum": 100,
      "minimum": 0,
      "title": "Interview Score",
      "type": "number"
    },
    "strengths": {
      "items": {
        "type": "string"
      },
      "title": "Strengths",
      "type": "array"
    },
    "summary": {
      "default": "",
      "title": "Summary",
      "type": "string"
    },
    "transcript": {
      "items": {
        "$ref": "#/$defs/TranscriptTurn"
      },
      "title": "Transcript",
      "type": "array"
    }
  },
  "required": [
    "interview_score"
  ],
  "title": "InterviewResult",
  "type": "object"
}
```

## Supporting objects

### Transcript turn

```json
{
  "additionalProperties": false,
  "properties": {
    "speaker": {
      "enum": [
        "ai",
        "student"
      ],
      "title": "Speaker",
      "type": "string"
    },
    "text": {
      "title": "Text",
      "type": "string"
    },
    "timestamp_sec": {
      "anyOf": [
        {
          "minimum": 0,
          "type": "number"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "title": "Timestamp Sec"
    }
  },
  "required": [
    "speaker",
    "text"
  ],
  "title": "TranscriptTurn",
  "type": "object"
}
```

### Dimension score

```json
{
  "additionalProperties": false,
  "properties": {
    "feedback": {
      "default": "",
      "title": "Feedback",
      "type": "string"
    },
    "improvement_areas": {
      "items": {
        "type": "string"
      },
      "title": "Improvement Areas",
      "type": "array"
    },
    "score": {
      "maximum": 100,
      "minimum": 0,
      "title": "Score",
      "type": "integer"
    },
    "strengths": {
      "items": {
        "type": "string"
      },
      "title": "Strengths",
      "type": "array"
    }
  },
  "required": [
    "score"
  ],
  "title": "DimensionScore",
  "type": "object"
}
```
