from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class CurrentUser:
    user_id: UUID
    tenant_id: UUID
    role: str
    email: str
    is_active: bool