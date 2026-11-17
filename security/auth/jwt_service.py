from __future__ import annotations

import base64
import hashlib
import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Mapping, Protocol

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


ACCESS_TOKEN_TTL = timedelta(minutes=15)
REFRESH_TOKEN_TTL = timedelta(days=7)


class TokenValidationError(ValueError):
    """Raised when an access token is invalid or cannot be trusted."""


class KeyConfigurationError(RuntimeError):
    """Raised when a signing key cannot be loaded or is malformed."""


@dataclass(frozen=True)
class UserIdentity:
    user_id: str
    tenant_id: str
    role: str


@dataclass(frozen=True)
class RefreshIdentity:
    user_id: str
    tenant_id: str


@dataclass(frozen=True)
class SigningKey:
    kid: str
    private_key: rsa.RSAPrivateKey

    @property
    def public_key(self) -> rsa.RSAPublicKey:
        return self.private_key.public_key()


class SecretsManagerClient(Protocol):
    def get_secret_value(self, *, SecretId: str) -> Mapping[str, object]: ...


class AwsSecretsManagerKeyProvider:
    """Loads a JSON secret containing ``kid`` and a PEM ``private_key``."""

    def __init__(
        self,
        secret_id: str,
        *,
        region_name: str | None = None,
        client: SecretsManagerClient | None = None,
    ) -> None:
        if not secret_id:
            raise ValueError("secret_id must not be empty")
        if client is None:
            import boto3

            client = boto3.client("secretsmanager", region_name=region_name)
        self._secret_id = secret_id
        self._client = client

    def load_signing_key(self) -> SigningKey:
        response = self._client.get_secret_value(SecretId=self._secret_id)
        secret_string = response.get("SecretString")
        if not isinstance(secret_string, str):
            raise KeyConfigurationError("The signing secret has no SecretString")
        try:
            secret = json.loads(secret_string)
            kid = secret["kid"]
            private_key_pem = secret["private_key"]
            if not isinstance(kid, str) or not kid:
                raise ValueError("kid must be a non-empty string")
            if not isinstance(private_key_pem, str):
                raise ValueError("private_key must be a PEM string")
            private_key = serialization.load_pem_private_key(
                private_key_pem.encode("utf-8"),
                password=None,
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise KeyConfigurationError(
                "The signing secret must contain a valid kid and RSA private_key"
            ) from exc
        if not isinstance(private_key, rsa.RSAPrivateKey):
            raise KeyConfigurationError("The signing key must be an RSA private key")
        return SigningKey(kid=kid, private_key=private_key)


class JwtService:
    def __init__(self, signing_key: SigningKey, *, issuer: str, audience: str) -> None:
        if not issuer or not audience:
            raise ValueError("issuer and audience must not be empty")
        self._signing_key = signing_key
        self.issuer = issuer
        self.audience = audience

    @classmethod
    def from_aws_secrets_manager(
        cls,
        secret_id: str,
        *,
        issuer: str,
        audience: str,
        region_name: str | None = None,
        client: SecretsManagerClient | None = None,
    ) -> JwtService:
        key = AwsSecretsManagerKeyProvider(
            secret_id,
            region_name=region_name,
            client=client,
        ).load_signing_key()
        return cls(key, issuer=issuer, audience=audience)

    def create_access_token(
        self,
        user: UserIdentity,
        *,
        now: datetime | None = None,
    ) -> str:
        issued_at = now or datetime.now(timezone.utc)
        if issued_at.tzinfo is None:
            raise ValueError("now must be timezone-aware")
        claims = {
            "user_id": user.user_id,
            "tenant_id": user.tenant_id,
            "role": user.role,
            "iss": self.issuer,
            "aud": self.audience,
            "iat": issued_at,
            "exp": issued_at + ACCESS_TOKEN_TTL,
            "jti": secrets.token_urlsafe(16),
            "token_use": "access",
        }
        return jwt.encode(
            claims,
            self._signing_key.private_key,
            algorithm="RS256",
            headers={"kid": self._signing_key.kid, "typ": "JWT"},
        )

    def validate_access_token(self, token: str) -> Mapping[str, object]:
        if not isinstance(token, str) or not token:
            raise TokenValidationError("Invalid access token")
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") != "RS256" or header.get("kid") != self._signing_key.kid:
                raise TokenValidationError("Invalid access token")
            claims = jwt.decode(
                token,
                self._signing_key.public_key,
                algorithms=["RS256"],
                audience=self.audience,
                issuer=self.issuer,
                options={
                    "require": [
                        "aud",
                        "exp",
                        "iat",
                        "iss",
                        "role",
                        "tenant_id",
                        "token_use",
                        "user_id",
                    ]
                },
            )
        except jwt.PyJWTError as exc:
            raise TokenValidationError("Invalid access token") from exc
        if (
            claims.get("token_use") != "access"
            or not isinstance(claims.get("user_id"), str)
            or not claims["user_id"]
            or not isinstance(claims.get("tenant_id"), str)
            or not claims["tenant_id"]
            or not isinstance(claims.get("role"), str)
            or not claims["role"]
        ):
            raise TokenValidationError("Invalid access token")
        return claims

    @staticmethod
    def create_refresh_token() -> tuple[str, str]:
        raw_token = secrets.token_urlsafe(64)
        return raw_token, JwtService.hash_refresh_token(raw_token)

    @staticmethod
    def hash_refresh_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def public_jwk(self) -> dict[str, str]:
        public_numbers = self._signing_key.public_key.public_numbers()
        return {
            "kty": "RSA",
            "use": "sig",
            "alg": "RS256",
            "kid": self._signing_key.kid,
            "n": _base64url_uint(public_numbers.n),
            "e": _base64url_uint(public_numbers.e),
        }


def _base64url_uint(value: int) -> str:
    byte_length = (value.bit_length() + 7) // 8
    encoded = base64.urlsafe_b64encode(value.to_bytes(byte_length, "big"))
    return encoded.rstrip(b"=").decode("ascii")
