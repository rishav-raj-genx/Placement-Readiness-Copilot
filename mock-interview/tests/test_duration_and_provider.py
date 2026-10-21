
from livekit_worker import (
    _duration_from_metadata,
    _interview_instructions,
    _resume_from_room_metadata,
    _session_config_from_metadata,
)
from scoring.schemas import InterviewContext


def test_duration_from_metadata_exact_20_minutes():
    # 1. Payload with durationMinutes at root
    metadata_root = {"durationMinutes": 20}
    assert _duration_from_metadata(metadata_root) == 20

    # 2. Payload with durationMinutes inside config object
    metadata_config = {"config": {"durationMinutes": 20}}
    assert _duration_from_metadata(metadata_config) == 20

    # 3. Payload with string '20'
    metadata_str = {"durationMinutes": "20"}
    assert _duration_from_metadata(metadata_str) == 20

    # 4. Payload with 15 minutes
    metadata_15 = {"durationMinutes": 15}
    assert _duration_from_metadata(metadata_15) == 15


def test_duration_from_room_metadata_json_parsing():
    json_metadata = '{"durationMinutes": 20, "provider": "ollama_local", "mode": "text"}'
    parsed = _resume_from_room_metadata(json_metadata)
    assert parsed["durationMinutes"] == 20
    assert parsed["provider"] == "ollama_local"
    assert parsed["mode"] == "text"
    assert _duration_from_metadata(parsed) == 20


def test_local_provider_disables_deepgram():
    metadata = {
        "durationMinutes": 20,
        "provider": "ollama_local",
    }
    provider_val = str(metadata.get("provider", "")).lower()
    is_local = provider_val in ("ollama_local", "ollama", "local")
    assert is_local is True


def test_hard_configuration_reads_nested_metadata_and_builds_faang_prompt():
    context = InterviewContext(target_role="Backend Engineer", skills=["Python"])
    metadata = {
        "config": {
            "durationMinutes": 20,
            "difficulty": "hard",
            "focusAreas": ["Distributed Systems", "Memory Management"],
            "experienceLevel": "three_plus",
        }
    }

    config = _session_config_from_metadata(metadata, context)
    prompt = _interview_instructions(context, config)

    assert config.difficulty == "hard"
    assert config.focus_topics == ["Distributed Systems", "Memory Management"]
    assert config.experience_level == "three_plus"
    assert "Act as a Principal Staff Engineer at a FAANG company." in prompt
    assert "Do not provide hints unless explicitly asked." in prompt
    assert "scalability bottlenecks, memory management" in prompt
    assert "How does that scale to 1 million users?" in prompt
    assert "Distributed Systems, Memory Management" in prompt
    assert "Monaco IDE" in prompt


def test_invalid_configuration_falls_back_to_medium_defaults():
    context = InterviewContext(target_role="Frontend Engineer")
    config = _session_config_from_metadata(
        {"config": {"difficulty": "impossible", "focusAreas": "not-a-list"}},
        context,
    )

    assert config.difficulty == "medium"
    assert config.focus_topics == []
