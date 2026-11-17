from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

TENANT_SETTING = "app.current_tenant_id"


async def set_tenant_context(session: AsyncSession, tenant_id: UUID) -> None:
    if not isinstance(tenant_id, UUID):
        raise ValueError("tenant_id must be a UUID")
    # SET LOCAL scopes the variable to the current transaction only.
    await session.execute(
        text(f"SELECT set_config('{TENANT_SETTING}', :tid, true)"),
        {"tid": str(tenant_id)},
    )


async def clear_tenant_context(session: AsyncSession) -> None:
    await session.execute(
        text(f"SELECT set_config('{TENANT_SETTING}', '', true)")
    )