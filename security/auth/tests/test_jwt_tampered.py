from __future__ import annotations

import base64
import json

import pytest

from security.auth.jwt_service import JwtService, TokenValidationError, UserIdentity


def _encode_segment(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def test_tampered_payload_fails_signature_check(jwt_service: JwtService) -> None:
    token = jwt_service.create_access_token(
        UserIdentity(user_id="user-123", tenant_id="tenant-456", role="member")
    )
    header, payload, signature = token.split(".")
    claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    claims["tenant_id"] = "other-tenant"
    tampered = f"{header}.{_encode_segment(json.dumps(claims).encode())}.{signature}"

    with pytest.raises(TokenValidationError):
        jwt_service.validate_access_token(tampered)
