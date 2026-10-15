from datetime import datetime, timedelta, timezone

import jwt

from agent.auth import AuthenticationError, authenticate_student, parse_bearer_token


def _token(subject="student-123", expired=False):
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": subject,
            "aud": "authenticated",
            "iat": now,
            "exp": now - timedelta(minutes=1) if expired else now + timedelta(minutes=5),
        },
        "test-secret-that-is-at-least-32-bytes",
        algorithm="HS256",
    )


def test_authentication_returns_subject():
    assert authenticate_student(
        _token(), "student-123", jwt_secret="test-secret-that-is-at-least-32-bytes"
    ) == "student-123"


def test_bearer_header_is_parsed_without_altering_token():
    token = _token()
    assert parse_bearer_token(f"Bearer {token}") == token


def test_bearer_header_rejects_other_schemes():
    try:
        parse_bearer_token("Basic credentials")
    except AuthenticationError:
        pass
    else:
        raise AssertionError("non-bearer authorization was accepted")


def test_authentication_rejects_subject_mismatch():
    try:
        authenticate_student(
            _token(), "other-student", jwt_secret="test-secret-that-is-at-least-32-bytes"
        )
    except AuthenticationError as exc:
        assert "does not match" in str(exc)
    else:
        raise AssertionError("mismatched student identity was accepted")


def test_authentication_rejects_expired_token():
    try:
        authenticate_student(
            _token(expired=True), jwt_secret="test-secret-that-is-at-least-32-bytes"
        )
    except AuthenticationError:
        pass
    else:
        raise AssertionError("expired token was accepted")
