from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from security.auth.jwt_service import (
    ACCESS_TOKEN_TTL,
    REFRESH_TOKEN_TTL,
    JwtService,
    RefreshIdentity,
    TokenValidationError,
    UserIdentity,
)


class AuthStore(Protocol):
    """Persistence and credential-verification adapter required by the routes.

    ``authenticate`` must verify the password hash and reject inactive accounts.
    ``get_active_user`` must read the current role and status from the database
    for the given user and tenant; token claims must not be used for either.
    ``rotate_refresh_token`` must atomically consume an unexpired, unrevoked old
    hash and persist the new hash, returning the identity bound to that row.
    """

    def authenticate(self, login: str, password: str) -> UserIdentity | None: ...

    def get_active_user(
        self,
        user_id: str,
        tenant_id: str,
    ) -> UserIdentity | None: ...

    def create_refresh_token(
        self,
        token_hash: str,
        user_id: str,
        tenant_id: str,
        expires_at: datetime,
    ) -> None: ...

    def rotate_refresh_token(
        self,
        old_token_hash: str,
        new_token_hash: str,
        now: datetime,
        new_expires_at: datetime,
    ) -> RefreshIdentity | None: ...


class LoginRequest(BaseModel):
    login: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = int(ACCESS_TOKEN_TTL.total_seconds())


def create_current_user_dependency(
    jwt_service: JwtService,
    store: AuthStore,
):
    bearer_scheme = HTTPBearer(auto_error=False)

    def get_current_user(
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    ) -> UserIdentity:
        unauthorized = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        if credentials is None or credentials.scheme.lower() != "bearer":
            raise unauthorized
        try:
            claims = jwt_service.validate_access_token(credentials.credentials)
        except TokenValidationError as exc:
            raise unauthorized from exc
        user = store.get_active_user(
            user_id=claims["user_id"],
            tenant_id=claims["tenant_id"],
        )
        if user is None:
            raise unauthorized
        return user

    return get_current_user


def create_auth_router(jwt_service: JwtService, store: AuthStore) -> APIRouter:
    router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

    @router.post("/login", response_model=TokenResponse)
    def login(payload: LoginRequest) -> TokenResponse:
        user = store.authenticate(payload.login, payload.password)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid login credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        refresh_token, refresh_hash = jwt_service.create_refresh_token()
        now = datetime.now(timezone.utc)
        store.create_refresh_token(
            token_hash=refresh_hash,
            user_id=user.user_id,
            tenant_id=user.tenant_id,
            expires_at=now + REFRESH_TOKEN_TTL,
        )
        return TokenResponse(
            access_token=jwt_service.create_access_token(user),
            refresh_token=refresh_token,
        )

    @router.post("/refresh", response_model=TokenResponse)
    def refresh(payload: RefreshRequest) -> TokenResponse:
        now = datetime.now(timezone.utc)
        new_refresh_token, new_refresh_hash = jwt_service.create_refresh_token()
        identity = store.rotate_refresh_token(
            old_token_hash=jwt_service.hash_refresh_token(payload.refresh_token),
            new_token_hash=new_refresh_hash,
            now=now,
            new_expires_at=now + REFRESH_TOKEN_TTL,
        )
        if identity is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = store.get_active_user(identity.user_id, identity.tenant_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return TokenResponse(
            access_token=jwt_service.create_access_token(user),
            refresh_token=new_refresh_token,
        )

    return router
