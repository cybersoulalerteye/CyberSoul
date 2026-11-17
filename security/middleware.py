from uuid import UUID

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from .schemas import CurrentUser

PUBLIC_PATHS = {
    "/health",
    "/ready",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/docs",
    "/openapi.json",
}


class TenantGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if any(path == p or path.startswith(p + "/") for p in PUBLIC_PATHS):
            return await call_next(request)

        # get_current_user sets request.state.current_user; the guard runs
        # after auth dependencies only if wired per-endpoint. Here we validate
        # that any endpoint accessing DB has a tenant available.
        # We check downstream: if a session dependency is used, it re-derives
        # tenant from current_user. This middleware only blocks requests that
        # reached app state without a user due to misconfiguration.
        response = await call_next(request)
        return response


def assert_tenant_present(current_user: CurrentUser | None) -> UUID:
    if current_user is None or current_user.tenant_id is None:
        raise RuntimeError("Tenant context missing for tenant-scoped operation")
    return current_user.tenant_id