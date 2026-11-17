from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
import pytest

from security.auth.dependencies import create_current_user_dependency
from security.auth.jwt_service import (
    JwtService,
    TokenValidationError,
    UserIdentity,
)


class UserStore:
    def get_active_user(self, user_id: str, tenant_id: str) -> UserIdentity | None:
        raise AssertionError(
            f"expired tokens must be rejected before lookup: {user_id}/{tenant_id}"
        )


def test_expired_token_is_rejected(jwt_service: JwtService) -> None:
    issued_at = datetime.now(timezone.utc) - timedelta(minutes=20)
    user = UserIdentity("user-123", "tenant-456", "member")
    expired_token = jwt_service.create_access_token(user, now=issued_at)

    with pytest.raises(TokenValidationError):
        jwt_service.validate_access_token(expired_token)

    app = FastAPI()
    current_user = create_current_user_dependency(jwt_service, UserStore())

    @app.get("/me")
    def me(user: UserIdentity = Depends(current_user)):
        return {"user_id": user.user_id}

    response = TestClient(app).get(
        "/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401
