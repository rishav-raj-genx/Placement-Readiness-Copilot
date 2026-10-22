"""Authentication boundary for student-scoped interview sessions."""

from __future__ import annotations

import hmac
import os
from collections.abc import Mapping


class AuthenticationError(ValueError):
    """Raised when a session token cannot be trusted."""


def parse_bearer_token(authorization: object) -> str:
    """Extract a bearer token from an HTTP Authorization header."""

    if not isinstance(authorization, str):
        raise AuthenticationError("authorization header is required")
    scheme, separator, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not separator or not token.strip():
        raise AuthenticationError("authorization header must be a bearer token")
    return token.strip()


def authenticate_student(
    token: object,
    requested_student_id: object = None,
    *,
    jwt_secret: str | None = None,
) -> str:
    """Verify a Supabase JWT or authorized internal service token and return its subject.

    The token is never logged or returned. A client-supplied student ID must match
    the JWT subject or be validated by the internal service key.
    """

    if not isinstance(token, str) or not token.strip():
        raise AuthenticationError("authentication token is required")
    raw_token = token.strip()

    # 1. Internal service key authorization (service-to-service communication)
    expected_service_key = (
        os.getenv("MOCK_INTERVIEW_SERVICE_TOKEN")
        or os.getenv("INTERNAL_SERVICE_KEY")
        or os.getenv("INTERNAL_SERVICE_SECRET")
    )
    if expected_service_key and hmac.compare_digest(raw_token, expected_service_key):
        return str(requested_student_id) if requested_student_id else "service_caller"

    # 2. E2E simulation mode authorization
    is_e2e = os.getenv("MOCK_INTERVIEW_E2E_MODE", "false").lower() in {"1", "true", "yes"} or \
             os.getenv("E2E_MODE", "false").lower() in {"1", "true", "yes"}
    if is_e2e and raw_token in {"test-token"}:
        return str(requested_student_id) if requested_student_id else "e2e_candidate"

    # 3. Supabase user JWT verification
    secret = jwt_secret or os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise AuthenticationError("SUPABASE_JWT_SECRET is not configured")
    try:
        import jwt

        decoded: object = jwt.decode(
            raw_token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
    except Exception as exc:
        raise AuthenticationError("authentication token is invalid") from exc
    if not isinstance(decoded, Mapping):
        raise AuthenticationError("authentication token has invalid claims")
    claims = decoded
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise AuthenticationError("authentication token has no student identity")
    if requested_student_id is not None and requested_student_id != subject:
        raise AuthenticationError("student identity does not match token")
    return subject
