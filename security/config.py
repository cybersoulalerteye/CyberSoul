from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class SecuritySettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="VERILATENCY_SEC_", env_file=".env")

    jwt_public_key: str
    jwt_private_key: str
    jwt_algorithm: str = "RS256"
    jwt_issuer: str = "verilatency"
    jwt_audience: str = "verilatency-api"
    access_token_ttl_seconds: int = 900
    refresh_token_ttl_seconds: int = 604800
    role_cache_ttl_seconds: int = 60


@lru_cache
def get_security_settings() -> SecuritySettings:
    return SecuritySettings()