import json
from pathlib import Path

from agent.context_adapter import adapt_resume


def test_fixture_is_normalized():
    fixture = json.loads(
        (Path(__file__).parents[1] / "fixtures" / "minimal_resume.json").read_text()
    )

    context = adapt_resume(fixture)

    assert context.contract_version == "v0"
    assert context.candidate_name == "Asha Rao"
    assert context.projects == ["Order platform - Built an idempotent order API."]


def test_missing_resume_fields_use_safe_defaults():
    context = adapt_resume({"name": "  Candidate  ", "projects": None})

    assert context.contract_version == "v0"
    assert context.candidate_name == "Candidate"
    assert context.skills == []
    assert context.projects == []
    assert context.experience == []


def test_unexpected_resume_values_do_not_crash():
    context = adapt_resume({"skills": "Python", "projects": [None, 42, {}]})

    assert context.skills == []
    assert context.projects == []


def test_divyansh_nested_room_metadata_shape_is_normalized():
    context = adapt_resume(
        {
            "student": {"name": "Alexandre Chen", "targetRole": "Systems Engineer"},
            "resume": {
                "parsedText": "Built consensus services.",
                "keySkills": ["Go", "Raft"],
            },
            "job": {"title": "Infrastructure Engineer"},
        }
    )

    assert context.candidate_name == "Alexandre Chen"
    assert context.target_role == "Systems Engineer"
    assert context.summary == "Built consensus services."
    assert context.skills == ["Go", "Raft"]


def test_profile_parser_text_shape_extracts_context_sections():
    context = adapt_resume(
        {
            "text": (
                "EXPERIENCE\nBuilt reliable APIs.\n"
                "SKILLS\nPython PostgreSQL\n"
                "PROJECTS\nPlacement Copilot - Built a resume review pipeline.\n"
                "EDUCATION\nB.Tech Computer Science"
            ),
            "page_count": 1,
        }
    )

    assert context.skills[:2] == ["Python", "PostgreSQL"]
    assert context.projects == ["Placement Copilot - Built a resume review pipeline."]
    assert context.experience == ["Built reliable APIs."]


def test_adapt_resume_resolves_placeholder_via_pdf_extractor(monkeypatch):
    sample_text = (
        "SKILLS\nRust Docker Kubernetes\n"
        "PROJECTS\nMesh Proxy - High-throughput sidecar proxy.\n"
        "EXPERIENCE\nDistributed systems engineer at CloudCorp."
    )
    monkeypatch.setattr("agent.context_adapter.extract_pdf_text", lambda url: sample_text)

    context = adapt_resume(
        {
            "student": {"name": "Priya", "targetRole": "Cloud Architect"},
            "resume": {
                "parsedText": "Resume reference: intv_987654321",
                "pdfUrl": "https://storage.supabase.co/v1/object/sign/resume.pdf",
            },
        }
    )

    assert context.candidate_name == "Priya"
    assert "Rust" in context.skills
    assert context.projects == ["Mesh Proxy - High-throughput sidecar proxy."]
    assert context.experience == ["Distributed systems engineer at CloudCorp."]
