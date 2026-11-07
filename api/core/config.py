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


DEFAULT_RESEND_API_URL = "https://api.resend.com/emails"


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

    # Chat accepts a GIF only from these hosts (and their subdomains), stored as given.
    # No provider API is wired in yet; the frontend picks one and extends this list.
    gif_allowed_hosts: Annotated[list[str], NoDecode] = [
        "giphy.com",
        "tenor.com",
        "klipy.com",
    ]

    @field_validator(
        "admin_supabase_uids", "cors_origins", "gif_allowed_hosts", mode="before"
    )
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
    scheduler_roster_sync_hours: int = Field(default=24, ge=1)
    # Floor: each tick spends one call per live game, and 700 calls a day must last a
    # whole Saturday plus Sunday.
    scheduler_live_poll_seconds: int = Field(default=180, ge=60)
    # Rehearsal: replay a saved postseason (api.scripts.export_replay) instead of
    # calling RapidAPI. The speed multiplies the virtual clock.
    scheduler_replay_file: str = ""
    scheduler_replay_speed: float = 60.0

    # "postgres" fans draft broadcasts out to every API instance over LISTEN/NOTIFY, for
    # running more than one process. Needs a direct or session-mode connection
    # (not Supabase's transaction pooler); "local" keeps broadcasts in-process.
    draft_broadcast: Literal["local", "postgres"] = "local"

    # Logging
    environment: str = "development"
    log_level: str = "INFO"
    log_format: Literal["auto", "json", "console"] = "auto"

    # Error reporting stays off (no SDK client, no network) while the DSN is empty.
    sentry_dsn: str = ""
    sentry_release: str = ""

    # Web push (#266) stays off while the keys are empty: the endpoints answer "not
    # configured" and nothing is sent. Generate a pair with
    # `python -m api.scripts.generate_vapid_keys`.
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    # Contact the push services may use, `mailto:you@example.com` or an https URL.
    vapid_subject: str = ""

    # "Report a problem" (#296) emails support through Resend and answers "not set up"
    # while either value is empty. The key is its own Resend key (`api-support`, Sending
    # access), separate from the one Supabase uses for sign-in codes.
    resend_api_key: str = ""
    support_email: str = ""
    # Must be an address on the domain verified in Resend.
    support_from_email: str = "PostSzn Support <no-reply@postsznfantasy.com>"
    # E2E only: a local stand-in for Resend. Refused when ENVIRONMENT is production.
    resend_api_url: str = DEFAULT_RESEND_API_URL

    # Avatars (#316) live in a private Supabase Storage bucket, read and written only by
    # this API with the service-role key; empty keeps pictures off (uploads answer
    # "not set up"). Never give the key to the browser.
    supabase_service_role_key: str = ""
    avatar_bucket: str = "avatars"
    # Dev and e2e only: keep the images in this directory instead of Supabase. Refused
    # when ENVIRONMENT is production.
    avatar_local_dir: str = ""

    # Commit the image was built from (Dockerfile build arg GIT_SHA); the deploy workflow
    # reads it from GET /api to learn what production runs. Empty outside Fly builds.
    git_sha: str = ""

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
    def _require_complete_vapid_config(self) -> "Settings":
        configured = [self.vapid_public_key, self.vapid_private_key, self.vapid_subject]
        if any(configured) and not all(configured):
            raise ValueError(
                "Web push needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT "
                "together; set all three or none"
            )
        return self

    @property
    def support_enabled(self) -> bool:
        return bool(self.resend_api_key and self.support_email)

    @property
    def push_enabled(self) -> bool:
        return bool(self.vapid_public_key)

    @model_validator(mode="after")
    def _refuse_replay_in_production(self) -> "Settings":
        if self.scheduler_replay_file and self.environment == "production":
            raise ValueError(
                "SCHEDULER_REPLAY_FILE replaces live scores with a recording; "
                "it is refused when ENVIRONMENT is production"
            )
        return self

    @model_validator(mode="after")
    def _refuse_resend_override_in_production(self) -> "Settings":
        if (
            self.resend_api_url != DEFAULT_RESEND_API_URL
            and self.environment == "production"
        ):
            raise ValueError(
                "RESEND_API_URL redirects support reports; "
                "it is refused when ENVIRONMENT is production"
            )
        return self

    @model_validator(mode="after")
    def _refuse_local_avatars_in_production(self) -> "Settings":
        if self.avatar_local_dir and self.environment == "production":
            raise ValueError(
                "AVATAR_LOCAL_DIR keeps pictures on the API's disk; "
                "it is refused when ENVIRONMENT is production"
            )
        return self

    @property
    def avatars_enabled(self) -> bool:
        return bool(self.avatar_local_dir or self.supabase_service_role_key)

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
