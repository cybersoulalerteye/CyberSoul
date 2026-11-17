from __future__ import annotations

from datetime import datetime

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from security.auth.dependencies import create_auth_router, create_current_user_dependency
from security.auth.jwt_service import (
    JwtService,
    RefreshIdentity,
    UserIdentity,
)
from security.auth.jwks_endpoint import create_jwks_router


class UserStore:
    def __init__(self, user: UserIdentity | None) -> None:
        self.user = user
        self.reads = 0

    def get_active_user(self, user_id: str, tenant_id: str) -> UserIdentity | None:
        self.reads += 1
        if self.user is None:
            return None
        if (self.user.user_id, self.user.tenant_id) != (user_id, tenant_id):
            return None
        return self.user


class RouteStore(UserStore):
    def __init__(self, user: UserIdentity) -> None:
        super().__init__(user)
        self.refresh_tokens: dict[str, tuple[str, str, datetime]] = {}

    def authenticate(self, login: str, password: str) -> UserIdentity | None:
        if login == "alice" and password == "correct-password":
            return self.user
        return None

    def create_refresh_token(
        self,
        token_hash: str,
        user_id: str,
        tenant_id: str,
        expires_at: datetime,
    ) -> None:
        self.refresh_tokens[token_hash] = (user_id, tenant_id, expires_at)

    def rotate_refresh_token(
        self,
        old_token_hash: str,
        new_token_hash: str,
        now: datetime,
        new_expires_at: datetime,
    ) -> RefreshIdentity | None:
        old_token = self.refresh_tokens.pop(old_token_hash, None)
        if old_token is None or old_token[2] <= now:
            return None
        user_id, tenant_id, _ = old_token
        self.refresh_tokens[new_token_hash] = (user_id, tenant_id, new_expires_at)
        return RefreshIdentity(user_id=user_id, tenant_id=tenant_id)


def test_valid_rs256_token_returns_identity(jwt_service: JwtService) -> None:
    identity = UserIdentity(user_id="user-123", tenant_id="tenant-456", role="member")
    token = jwt_service.create_access_token(identity)

    claims = jwt_service.validate_access_token(token)

    assert claims["user_id"] == identity.user_id
    assert claims["tenant_id"] == identity.tenant_id


def test_current_user_uses_role_from_database(jwt_service: JwtService) -> None:
    token_identity = UserIdentity("user-123", "tenant-456", "admin")
    database_identity = UserIdentity("user-123", "tenant-456", "member")
    store = UserStore(database_identity)
    app = FastAPI()
    current_user = create_current_user_dependency(jwt_service, store)

    @app.get("/me")
    def me(user: UserIdentity = Depends(current_user)):
        return {"role": user.role}

    response = TestClient(app).get(
        "/me",
        headers={"Authorization": f"Bearer {jwt_service.create_access_token(token_identity)}"},
    )

    assert response.status_code == 200
    assert response.json() == {"role": "member"}
    assert store.reads == 1


def test_jwks_exposes_only_public_key(jwt_service: JwtService) -> None:
    app = FastAPI()
    app.include_router(create_jwks_router(jwt_service))

    response = TestClient(app).get("/.well-known/jwks.json")

    assert response.status_code == 200
    keys = response.json()["keys"]
    assert len(keys) == 1
    assert keys[0]["alg"] == "RS256"
    assert keys[0]["kid"] == "test-key"
    assert {"d", "p", "q", "dp", "dq", "qi"}.isdisjoint(keys[0])


def test_login_and_refresh_rotate_hashed_refresh_token(jwt_service: JwtService) -> None:
    user = UserIdentity("user-123", "tenant-456", "member")
    store = RouteStore(user)
    app = FastAPI()
    app.include_router(create_auth_router(jwt_service, store))
    client = TestClient(app)

    login_response = client.post(
        "/api/v1/auth/login",
        json={"login": "alice", "password": "correct-password"},
    )

    assert login_response.status_code == 200
    login_tokens = login_response.json()
    old_refresh_token = login_tokens["refresh_token"]
    old_refresh_hash = jwt_service.hash_refresh_token(old_refresh_token)
    assert old_refresh_hash in store.refresh_tokens
    assert old_refresh_token not in store.refresh_tokens

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )

    assert refresh_response.status_code == 200
    refreshed_tokens = refresh_response.json()
    assert refreshed_tokens["refresh_token"] != old_refresh_token
    assert old_refresh_hash not in store.refresh_tokens
    assert jwt_service.hash_refresh_token(refreshed_tokens["refresh_token"]) in store.refresh_tokens
