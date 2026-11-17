from __future__ import annotations

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from security.auth.jwt_service import JwtService, SigningKey


@pytest.fixture
def jwt_service() -> JwtService:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return JwtService(
        SigningKey(kid="test-key", private_key=private_key),
        issuer="https://issuer.example",
        audience="test-api",
    )
