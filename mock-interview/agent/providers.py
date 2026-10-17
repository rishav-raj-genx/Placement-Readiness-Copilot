"""Provider interfaces and HTTP clients for STT, TTS, and Groq."""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from typing import Protocol
from urllib import request


class SpeechToText(Protocol):
    def transcribe(self, audio: bytes, content_type: str = "audio/webm") -> str: ...


class TextToSpeech(Protocol):
    def synthesize(self, text: str) -> bytes: ...


class InterviewLLM(Protocol):
    def complete(self, system_prompt: str, user_prompt: str) -> object: ...


class HTTPProviderError(RuntimeError):
    """A provider request failed or returned an unusable response."""


class DeepgramSTT:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        self.model = model or os.getenv("DEEPGRAM_STT_MODEL", "nova-3")

    def transcribe(self, audio: bytes, content_type: str = "audio/webm") -> str:
        if not self.api_key:
            raise HTTPProviderError("DEEPGRAM_API_KEY is required for speech-to-text")
        url = f"https://api.deepgram.com/v1/listen?model={self.model}&smart_format=true"
        req = request.Request(
            url,
            data=audio,
            headers={"Authorization": f"Token {self.api_key}", "Content-Type": content_type},
            method="POST",
        )
        return _deepgram_text(_json_request(req))


class DeepgramTTS:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        self.model = model or os.getenv("DEEPGRAM_TTS_MODEL", "aura-2-thalia-en")

    def synthesize(self, text: str) -> bytes:
        if not self.api_key:
            raise HTTPProviderError("DEEPGRAM_API_KEY is required for text-to-speech")
        url = f"https://api.deepgram.com/v1/speak?model={self.model}"
        req = request.Request(
            url,
            data=json.dumps({"text": text}).encode(),
            headers={
                "Authorization": f"Token {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=30) as response:
                return response.read()
        except Exception as exc:
            raise HTTPProviderError("Deepgram text-to-speech request failed") from exc


class GroqLLM:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.model = model or os.getenv("GROQ_SCORING_MODEL", "llama-3.1-8b-instant")

    def complete(self, system_prompt: str, user_prompt: str) -> object:
        if not self.api_key:
            raise HTTPProviderError("GROQ_API_KEY is required for interview scoring")
        req = request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=json.dumps(
                {
                    "model": self.model,
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                }
            ).encode(),
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        data = _json_request(req)
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            raise HTTPProviderError("Groq returned an invalid completion")
        first_choice = choices[0]
        if not isinstance(first_choice, Mapping):
            raise HTTPProviderError("Groq returned an invalid completion")
        message = first_choice.get("message")
        if not isinstance(message, Mapping):
            raise HTTPProviderError("Groq returned an invalid completion")
        content = message.get("content")
        if not isinstance(content, str):
            raise HTTPProviderError("Groq returned an invalid completion")
        return content


def _json_request(req: request.Request) -> dict[str, object]:
    try:
        with request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read())
    except Exception as exc:
        raise HTTPProviderError("provider request failed") from exc
    if not isinstance(data, dict) or not all(isinstance(key, str) for key in data):
        raise HTTPProviderError("provider returned a non-object response")
    return data


def _deepgram_text(data: dict[str, object]) -> str:
    results = data.get("results")
    if not isinstance(results, Mapping):
        raise HTTPProviderError("Deepgram returned an invalid transcript")
    channels = results.get("channels")
    if not isinstance(channels, list) or not channels:
        raise HTTPProviderError("Deepgram returned an invalid transcript")
    first_channel = channels[0]
    if not isinstance(first_channel, Mapping):
        raise HTTPProviderError("Deepgram returned an invalid transcript")
    alternatives = first_channel.get("alternatives")
    if not isinstance(alternatives, list) or not alternatives:
        raise HTTPProviderError("Deepgram returned an invalid transcript")
    first_alternative = alternatives[0]
    if not isinstance(first_alternative, Mapping):
        raise HTTPProviderError("Deepgram returned an invalid transcript")
    text = first_alternative.get("transcript")
    if not isinstance(text, str):
        raise HTTPProviderError("Deepgram transcript was not text")
    return text.strip()
