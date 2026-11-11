"""Owner kill switches stored in the database, so the owner can flip one from a phone
(`PUT /api/admin/feature-flags/{key}` or `python -m api.scripts.set_feature_flag`)
without a deploy."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.feature_flag import FeatureFlag

BRACKET = "bracket"
# What a flag is while nobody has flipped it.
DEFAULTS: dict[str, bool] = {BRACKET: True}


class UnknownFlagError(ValueError):
    pass


def _known(key: str) -> str:
    if key not in DEFAULTS:
        raise UnknownFlagError(f"Unknown feature flag: {key}")
    return key


async def all_flags(db: AsyncSession) -> dict[str, bool]:
    stored = {
        row.key: row.enabled
        for row in (await db.execute(select(FeatureFlag))).scalars()
    }
    return {key: stored.get(key, default) for key, default in DEFAULTS.items()}


async def is_enabled(db: AsyncSession, key: str) -> bool:
    return (await all_flags(db))[_known(key)]


async def set_flag(db: AsyncSession, key: str, enabled: bool) -> None:
    row = await db.get(FeatureFlag, _known(key))
    now = datetime.now(UTC)
    if row is None:
        db.add(FeatureFlag(key=key, enabled=enabled, updated_at=now))
    else:
        row.enabled = enabled
        row.updated_at = now
    await db.flush()
