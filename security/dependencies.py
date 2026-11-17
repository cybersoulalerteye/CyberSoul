from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import SecuritySettings, get_security_settings
from .jwt_handler import JWTHandler, TokenError
from .schemas import CurrentUser

bearer_scheme = HTTPBearer(auto_error=False)


def get_jwt_handler(
    settings: Annotated[SecuritySettings, Depends(get_security_settings)],
) -> JWTHandler:
    return JWTHandler(settings)


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    jwt_handler: Annotated[JWTHandler, Depends(get_jwt_handler)],
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        claims = jwt_handler.decode(credentials.credentials)
    except TokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if claims.get("typ") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not an access token",
        )

    # DB-backed identity and role read (do NOT trust the JWT role claim)
    user_repo = request.app.state.user_repo
    user = await user_repo.get_user_by_id(UUID(claims["sub"]), UUID(claims["tid"]))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    if user.tenant_id != UUID(claims["tid"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant mismatch",
        )

    current_user = CurrentUser(
        user_id=user.id,
        tenant_id=user.tenant_id,
        role=user.role,
        email=user.email,
        is_active=user.is_active,
    )

    # tenant context is bound to request state; DB session uses it (next step)
    request.state.current_user = current_user
    return current_user


def require_role(*allowed_roles: str) -> Callable:
    async def _checker(
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )
        return current_user

    return _checker


async def get_tenant_context(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> UUID:
    return current_user.tenant_id

from collections.abc import AsyncIterator
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_sessionmaker
from .tenant_context import set_tenant_context


async def get_db_session(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AsyncIterator[AsyncSession]:
    sessionmaker = get_sessionmaker()
    async with sessionmaker() as session:
        async with session.begin():
            # RLS is active for the duration of this transaction.
            await set_tenant_context(session, current_user.tenant_id)
            yield session