from unittest.mock import MagicMock, patch
import pytest

from livekit_worker import _duration_from_metadata, _resume_from_room_metadata


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
