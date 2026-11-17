from __future__ import annotations

from fastapi import APIRouter

from security.auth.jwt_service import JwtService


def create_jwks_router(jwt_service: JwtService) -> APIRouter:
    router = APIRouter()

    @router.get("/.well-known/jwks.json", name="jwks")
    def get_jwks() -> dict[str, list[dict[str, str]]]:
        return {"keys": [jwt_service.public_jwk()]}

    return router
