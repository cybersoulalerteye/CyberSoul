from typing import Protocol
from uuid import UUID

from .schemas import CurrentUser


class UserRepoProtocol(Protocol):
    async def get_user_by_id(self, user_id: UUID, tenant_id: UUID) -> CurrentUser | None: ...