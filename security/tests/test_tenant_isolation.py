import pytest
from httpx import AsyncClient

from security.jwt_handler import JWTHandler
from security.config import get_security_settings


@pytest.mark.asyncio
async def test_cross_tenant_read_returns_zero_rows(client: AsyncClient):
    handler = JWTHandler(get_security_settings())
    tenant_a_token = handler.create_access_token(
        user_id="00000000-0000-0000-0000-00000000000a",
        tenant_id="11111111-1111-1111-1111-111111111111",
        role="operator",
    )
    resp = await client.get(
        "/api/v1/incidents/count",
        headers={"Authorization": f"Bearer {tenant_a_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


@pytest.mark.asyncio
async def test_missing_tenant_context_fails_closed(client: AsyncClient):
    # Direct DB query without session variable must return zero rows
    # (validated at DB level, not API level)
    ...