from contextlib import asynccontextmanager

from fastapi import FastAPI

from security import get_current_user, require_role
from security.schemas import CurrentUser
from typing import Annotated
from fastapi import Depends


@asynccontextmanager
async def lifespan(app: FastAPI):
    # app.state.user_repo = <your Postgres-backed repo>
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/api/v1/me")
async def me(current_user: Annotated[CurrentUser, Depends(get_current_user)]):
    return {
        "user_id": str(current_user.user_id),
        "tenant_id": str(current_user.tenant_id),
        "role": current_user.role,
        "email": current_user.email,
    }


@app.get("/api/v1/admin/ping")
async def admin_ping(
    current_user: Annotated[CurrentUser, Depends(require_role("admin"))],
):
    return {"ok": True, "role": current_user.role}