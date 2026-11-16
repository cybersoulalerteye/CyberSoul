from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import jwt
from jwt.exceptions import InvalidTokenError

from .config import SecuritySettings


class TokenError(Exception):
    pass


class JWTHandler:
    def __init__(self, settings: SecuritySettings):
        self.settings = settings

    def create_access_token(
        self,
        *,
        user_id: str,
        tenant_id: str,
        role: str,
        extra_claims: dict[str, Any] | None = None,
    ) -> str:
        now = datetime.now(timezone.utc)
        payload: dict[str, Any] = {
            "sub": user_id,
            "tid": tenant_id,
            "role": role,
            "iss": self.settings.jwt_issuer,
            "aud": self.settings.jwt_audience,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=self.settings.access_token_ttl_seconds)).timestamp()),
            "jti": str(uuid4()),
            "typ": "access",
        }
        if extra_claims:
            payload.update(extra_claims)
        return jwt.encode(
            payload,
            self.settings.jwt_private_key,
            algorithm=self.settings.jwt_algorithm,
        )

    def create_refresh_token(self, *, user_id: str, tenant_id: str) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            "sub": user_id,
            "tid": tenant_id,
            "iss": self.settings.jwt_issuer,
            "aud": self.settings.jwt_audience,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=self.settings.refresh_token_ttl_seconds)).timestamp()),
            "jti": str(uuid4()),
            "typ": "refresh",
        }
        return jwt.encode(
            payload,
            self.settings.jwt_private_key,
            algorithm=self.settings.jwt_algorithm,
        )

    def decode(self, token: str) -> dict[str, Any]:
        try:
            return jwt.decode(
                token,
                self.settings.jwt_public_key,
                algorithms=[self.settings.jwt_algorithm],
                audience=self.settings.jwt_audience,
                issuer=self.settings.jwt_issuer,
                options={"require": ["exp", "iat", "sub", "tid", "jti", "typ"]},
            )
        except InvalidTokenError as exc:
            raise TokenError(str(exc)) from exc