from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from security import get_current_user, require_role
from security.dependencies import get_db_session
from security.schemas import CurrentUser


@asynccontextmanager
async def lifespan(app: FastAPI):
    # app.state.user_repo = <Postgres-backed repo>
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/api/v1/me")
async def me(current_user: Annotated[CurrentUser, Depends(get_current_user)]):
    return {
        "user_id": str(current_user.user_id),
        "tenant_id": str(current_user.tenant_id),
        "role": current_user.role,
    }


@app.get("/api/v1/incidents/count")
async def incident_count(
    session: Annotated[AsyncSession, Depends(get_db_session)],
):
    # RLS is active inside this transaction.
    result = await session.execute(text("SELECT count(*) FROM incidents"))
    return {"count": result.scalar_one()}


@app.get("/api/v1/admin/ping")
async def admin_ping(
    current_user: Annotated[CurrentUser, Depends(require_role("admin"))],
):
    return {"ok": True, "role": current_user.role}