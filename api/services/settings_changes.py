from collections.abc import Mapping
from decimal import Decimal
from typing import Any

from pydantic.alias_generators import to_camel
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.activity_models import SettingChange, SettingsChangePayload
from api.services import activity
from api.services.standings import refresh_standings_if_drafted


def _plain(value: Any) -> Any:
    """Numbers as they read in the feed: 4, not Decimal('4.00') or 4.0."""
    if isinstance(value, Decimal | float) and not isinstance(value, bool):
        number = float(value)
        return int(number) if number.is_integer() else number
    return value


def diff_settings(
    before: Mapping[str, Any], after: Mapping[str, Any]
) -> list[SettingChange]:
    """The fields of `after` whose value differs from `before`, named as the API does."""
    return [
        SettingChange(field=to_camel(field), before=_plain(before[field]), after=new)
        for field, value in after.items()
        if _plain(before[field]) != (new := _plain(value))
    ]


async def record_settings_change(
    db: AsyncSession,
    league_id: int,
    actor: activity.Actor,
    before: Mapping[str, Any],
    after: Mapping[str, Any],
) -> None:
    """Log a settings edit, one event for all fields that changed; none if nothing did.

    Both mappings are keyed by the `league_settings` column name; `after` holds only
    the fields that were set. Anything that edits league settings calls this (the
    settings PATCH does through `on_editable_settings_changed`).
    """
    changes = diff_settings(before, after)
    if changes:
        await activity.append(
            db, league_id, SettingsChangePayload(changes=changes), actor=actor
        )


async def on_editable_settings_changed(
    db: AsyncSession,
    league_id: int,
    *,
    actor: activity.Actor,
    before: Mapping[str, Any],
    after: Mapping[str, Any],
) -> None:
    """Scoring, multipliers and team QB/K stay editable after the draft starts.

    The change goes to the activity feed and everything derived from the settings is
    recomputed.
    """
    await record_settings_change(db, league_id, actor, before, after)
    await refresh_standings_if_drafted(db, league_id)
