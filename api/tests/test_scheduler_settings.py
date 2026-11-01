"""Production-safe scheduler defaults: off, and no setting can burn the daily quota."""

import pytest
from pydantic import ValidationError

from api.core.config import Settings


def make_settings(**overrides: object) -> Settings:
    return Settings(_env_file=None, pg_host="localhost", **overrides)  # type: ignore[arg-type]


def test_the_scheduler_is_off_by_default() -> None:
    assert make_settings().scheduler_enabled is False


def test_polling_faster_than_a_minute_is_refused() -> None:
    with pytest.raises(ValidationError):
        make_settings(scheduler_live_poll_seconds=10)
    assert make_settings(scheduler_live_poll_seconds=60)


def test_a_zero_hour_roster_sync_is_refused() -> None:
    with pytest.raises(ValidationError):
        make_settings(scheduler_roster_sync_hours=0)


def test_replay_is_refused_in_production() -> None:
    with pytest.raises(ValidationError, match="production"):
        make_settings(environment="production", scheduler_replay_file="r.json")
    assert make_settings(environment="development", scheduler_replay_file="r.json")
