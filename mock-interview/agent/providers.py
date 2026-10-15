"""Provider interfaces and HTTP clients for STT, TTS, and Groq."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional, Protocol
from urllib import request


class SpeechToText(Protocol):
    def transcribe(self, audio: bytes, content_type: str = "audio/webm") -> str: ...


class TextToSpeech(Protocol):
    def synthesize(self, text: str) -> bytes: ...


class InterviewLLM(Protocol):
    def complete(self, system_prompt: str, user_prompt: str) -> Any: ...


class HTTPProviderError(RuntimeError):
    """A provider request failed or returned an unusable response."""


class DeepgramSTT:
    def __init__(self, api_key: Optional[str] = None, model: str = "nova-2"):
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        self.model = model

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
    def __init__(self, api_key: Optional[str] = None, model: str = "aura-asteria-en"):
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        self.model = model

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
    def __init__(self, api_key: Optional[str] = None, model: str = "llama-3.1-8b-instant"):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.model = model

    def complete(self, system_prompt: str, user_prompt: str) -> Any:
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
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise HTTPProviderError("Groq returned an invalid completion") from exc


def _json_request(req: request.Request) -> Dict[str, Any]:
    try:
        with request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read())
    except Exception as exc:
        raise HTTPProviderError("provider request failed") from exc
    if not isinstance(data, dict):
        raise HTTPProviderError("provider returned a non-object response")
    return data


def _deepgram_text(data: Dict[str, Any]) -> str:
    try:
        text = data["results"]["channels"][0]["alternatives"][0]["transcript"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPProviderError("Deepgram returned an invalid transcript") from exc
    if not isinstance(text, str):
        raise HTTPProviderError("Deepgram transcript was not text")
    return text.strip()
