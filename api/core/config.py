from functools import lru_cache
from typing import Literal

from pydantic import PostgresDsn, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database — accept either a full URI or discrete parts; URI takes priority.
    pg_uri: PostgresDsn | None = None
    pg_host: str | None = None
    pg_port: int = 5432
    pg_user: str = "postgres"
    pg_password: str = "postgres"
    pg_dbname: str = "postszn"

    # Supabase Auth
    supabase_url: str = ""

    @computed_field  # type: ignore[prop-decorator]
    @property
    def supabase_jwks_url(self) -> str | None:
        """Standard JWKS endpoint for asymmetric JWT verification."""
        if not self.supabase_url:
            return None
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    # RapidAPI
    rapidapi_baseurl: str = ""
    rapidapi_apikey: str = ""
    rapidapi_apihost: str = ""

    # App
    season_year: int = 2025

    # Logging
    environment: str = "development"
    log_level: str = "INFO"
    log_format: Literal["auto", "json", "console"] = "auto"

    @model_validator(mode="after")
    def _require_db_config(self) -> "Settings":
        # At least one of pg_uri or pg_host must be provided.
        if self.pg_uri is None and not self.pg_host:
            raise ValueError(
                "Database not configured: set PG_URI or PG_HOST in the environment / .env file."
            )
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def async_database_url(self) -> str:
        """Async-dialect URL for SQLAlchemy create_async_engine."""
        if self.pg_uri:
            raw = str(self.pg_uri)
            return raw.replace("postgresql://", "postgresql+asyncpg://", 1)
        return (
            f"postgresql+asyncpg://{self.pg_user}:{self.pg_password}"
            f"@{self.pg_host}:{self.pg_port}/{self.pg_dbname}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sync_database_url(self) -> str:
        """Sync-dialect URL for Alembic migrations (psycopg2)."""
        return self.async_database_url.replace(
            "postgresql+asyncpg://", "postgresql+psycopg2://", 1
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the application Settings singleton, parsed once per process."""
    return Settings()
