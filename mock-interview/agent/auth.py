"""Authentication boundary for student-scoped interview sessions."""

from __future__ import annotations

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
    """Verify a Supabase JWT and return its subject.

    The token is accepted only from the websocket start message and is never
    logged or returned. A client-supplied student ID must match the JWT subject.
    """

    if not isinstance(token, str) or not token.strip():
        raise AuthenticationError("authentication token is required")
    secret = jwt_secret or os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise AuthenticationError("SUPABASE_JWT_SECRET is not configured")
    try:
        import jwt

        decoded: object = jwt.decode(
            token,
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
