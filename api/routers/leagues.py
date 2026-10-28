from fastapi import APIRouter
from sqlalchemy import select

from api.db.models.league import LeagueStanding
from api.dependencies.auth import CurrentUser
from api.dependencies.db import DbSession

router = APIRouter()


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


@router.get("/{league_id}/standings")
async def get_standings(
    league_id: int,
    _: CurrentUser,
    db: DbSession,
) -> list[dict[str, object]]:
    """Return stored standing rows for the league.

    players_left and weekly totals are persisted separately by the scoring engine;
    this endpoint serves the current snapshot from the standings table.
    """
    rows = (
        (
            await db.execute(
                select(LeagueStanding)
                .where(LeagueStanding.league_id == league_id)
                .order_by(LeagueStanding.rank)
            )
        )
        .scalars()
        .all()
    )

    return [
        {
            "teamId": row.team_id,
            "rank": row.rank,
            "playersLeft": row.players_left,
            "wildCard": row.wild_card,
            "divisional": row.divisional,
            "confChamp": row.conf_champ,
            "superBowl": row.super_bowl,
            "total": float(row.total) if row.total is not None else None,
        }
        for row in rows
    ]
