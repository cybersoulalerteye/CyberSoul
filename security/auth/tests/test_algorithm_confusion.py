from __future__ import annotations

import base64
import json

import jwt
import pytest

from security.auth.jwt_service import JwtService, TokenValidationError, UserIdentity


def test_none_algorithm_token_is_rejected(jwt_service: JwtService) -> None:
    identity = UserIdentity("user-123", "tenant-456", "member")
    claims = {
        "user_id": identity.user_id,
        "tenant_id": identity.tenant_id,
        "role": identity.role,
        "iss": jwt_service.issuer,
        "aud": jwt_service.audience,
        "iat": 1_800_000_000,
        "exp": 1_800_000_900,
        "token_use": "access",
    }
    forged_token = jwt.encode(claims, key="", algorithm="none", headers={"kid": "test-key"})

    with pytest.raises(TokenValidationError):
        jwt_service.validate_access_token(forged_token)


def test_hs256_token_is_rejected(jwt_service: JwtService) -> None:
    valid_token = jwt_service.create_access_token(
        UserIdentity("user-123", "tenant-456", "member")
    )
    _, payload, _ = valid_token.split(".")
    claims = json.loads(
        base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
    )
    claims["exp"] += 60
    forged_token = jwt.encode(
        claims,
        key="attacker-controlled-key-with-at-least-32-bytes",
        algorithm="HS256",
        headers={"kid": "test-key"},
    )

    with pytest.raises(TokenValidationError):
        jwt_service.validate_access_token(forged_token)
