from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import (
    Field,
    PostgresDsn,
    computed_field,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Anchored to the package so uvicorn, Alembic and pytest agree regardless of cwd.
ENV_FILE = Path(__file__).resolve().parents[1] / ".env"

# The only environments in which the e2e auth stub may be switched on.
TEST_AUTH_ENVIRONMENTS = frozenset({"development", "test"})


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database — accept either a full URI or discrete parts; URI takes priority.
    pg_uri: PostgresDsn | None = None
    pg_host: str | None = None
    pg_port: int = 5433
    pg_user: str = "postgres"
    pg_password: str = "postgres"
    pg_dbname: str = "postszn"

    # Supabase Auth
    # Required: without it there is no key to verify tokens against.
    supabase_url: str = Field(min_length=1)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def supabase_jwks_url(self) -> str:
        """Standard JWKS endpoint for asymmetric JWT verification."""
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    # Deployment
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    db_pool_size: int = 20
    db_max_overflow: int = 10

    # Teams that must be marked in the playoffs before a draft can start. Only the
    # e2e fixtures (8 teams) change it.
    playoff_field_size: int = 14

    # Comma-separated Supabase user ids allowed to call /api/admin/*; empty means nobody.
    admin_supabase_uids: Annotated[list[str], NoDecode] = []

    @field_validator("admin_supabase_uids", "cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    # RapidAPI
    rapidapi_baseurl: str = ""
    rapidapi_apikey: str = ""
    rapidapi_apihost: str = ""
    # Set to a directory to cache API responses on disk (dev only; never expires).
    rapidapi_cache_dir: str = ""
    # Hard stop on calls per UTC day; 700 keeps a 30% margin under the Pro plan's 1,000.
    rapidapi_daily_request_limit: int = 700

    # App
    season_year: int = 2026

    # Background scheduler (off by default; every tick can spend RapidAPI quota)
    scheduler_enabled: bool = False
    scheduler_roster_sync_hours: int = 24
    scheduler_live_poll_seconds: int = 180
    # Rehearsal: replay a saved postseason (api.scripts.export_replay) instead of
    # calling RapidAPI. The speed multiplies the virtual clock.
    scheduler_replay_file: str = ""
    scheduler_replay_speed: float = 60.0

    # Logging
    environment: str = "development"
    log_level: str = "INFO"
    log_format: Literal["auto", "json", "console"] = "auto"

    # Error reporting stays off (no SDK client, no network) while the DSN is empty.
    sentry_dsn: str = ""
    sentry_release: str = ""

    # E2E only: accept `e2e-user:<uid>` bearer tokens instead of Supabase JWTs. Off by
    # default and refused outright outside the environments in TEST_AUTH_ENVIRONMENTS.
    test_auth_stub: bool = False

    @model_validator(mode="after")
    def _refuse_test_auth_stub_outside_test(self) -> "Settings":
        if self.test_auth_stub and self.environment not in TEST_AUTH_ENVIRONMENTS:
            raise ValueError(
                "TEST_AUTH_STUB is only allowed when ENVIRONMENT is one of "
                f"{sorted(TEST_AUTH_ENVIRONMENTS)}, got {self.environment!r}"
            )
        return self

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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the application Settings singleton, parsed once per process."""
    return Settings()
