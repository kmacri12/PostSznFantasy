from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    Draft,
    League,
    LeagueSettings,
    NFLPlayer,
    NFLTeam,
    Team,
    User,
)
from api.models.league_models import RosterSettings, ScoringSettings


async def make_league(
    db: AsyncSession, *, teams: int = 2, roster_total: int = 2, **roster: int
) -> tuple[League, list[User], list[Team], Draft]:
    """A league with one user per team; user 0 is the commissioner."""
    users = [
        User(supabase_uid=f"uid-{i}", username=f"user{i}", email=f"u{i}@x.co")
        for i in range(teams)
    ]
    db.add_all(users)
    await db.flush()

    league = League(name="Test League", commissioner_id=users[0].id)
    db.add(league)
    await db.flush()

    roster_settings = RosterSettings(
        number_teams=teams, roster_total=roster_total, **roster
    )
    db.add(
        LeagueSettings(
            league_id=league.id,
            **roster_settings.model_dump(by_alias=False),
            **ScoringSettings().model_dump(by_alias=False),
        )
    )
    fantasy_teams = [
        Team(name=f"Team {i}", owner_id=u.id, league_id=league.id)
        for i, u in enumerate(users)
    ]
    db.add_all(fantasy_teams)
    await db.flush()

    draft = Draft(
        league_id=league.id, draft_order_team_ids=[t.id for t in fantasy_teams]
    )
    db.add(draft)
    await db.flush()
    return league, users, fantasy_teams, draft


async def make_players(
    db: AsyncSession,
    positions: list[str],
    *,
    nfl_team: NFLTeam | None = None,
    first_id: int = 1000,
) -> list[NFLPlayer]:
    players = [
        NFLPlayer(
            id=first_id + i,
            name=f"Player {i}",
            position=pos,
            team_id=nfl_team.id if nfl_team else None,
        )
        for i, pos in enumerate(positions)
    ]
    db.add_all(players)
    await db.flush()
    return players
