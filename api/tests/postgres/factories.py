from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    Draft,
    League,
    LeagueMember,
    LeagueSettings,
    NFLPlayer,
    NFLTeam,
    Team,
    User,
)
from api.models.league_models import (
    PostseasonSettings,
    RosterSettings,
    ScoringSettings,
    TeamUnitSettings,
)


async def make_league(
    db: AsyncSession,
    *,
    teams: int = 2,
    roster_total: int = 2,
    draft_status: str = "in_progress",
    ordered: bool = True,
    team_qb: bool = False,
    team_k: bool = False,
    **roster: int,
) -> tuple[League, list[User], list[Team], Draft]:
    """A league with one user per team; user 0 is the commissioner."""
    users = [
        User(supabase_uid=f"uid-{i}", username=f"user{i}", email=f"u{i}@x.co")
        for i in range(teams)
    ]
    db.add_all(users)
    await db.flush()

    league = League(name="Test League", season=2025)
    db.add(league)
    await db.flush()

    db.add_all(
        LeagueMember(
            league_id=league.id,
            user_id=u.id,
            role="commissioner" if i == 0 else "member",
        )
        for i, u in enumerate(users)
    )
    roster_settings = RosterSettings(
        number_teams=teams, roster_total=roster_total, **roster
    )
    db.add(
        LeagueSettings(
            league_id=league.id,
            **roster_settings.model_dump(by_alias=False),
            **ScoringSettings().model_dump(by_alias=False),
            **PostseasonSettings().model_dump(by_alias=False, mode="json"),
            **TeamUnitSettings(team_qb=team_qb, team_k=team_k).model_dump(
                by_alias=False
            ),
        )
    )
    fantasy_teams = [
        Team(name=f"Team {i}", owner_id=u.id, league_id=league.id)
        for i, u in enumerate(users)
    ]
    db.add_all(fantasy_teams)
    await db.flush()

    draft = Draft(
        league_id=league.id,
        status=draft_status,
        rounds=roster_total,
        draft_order_team_ids=[t.id for t in fantasy_teams] if ordered else [],
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
    if nfl_team is None:
        nfl_team = NFLTeam(
            id=first_id, team_abv=f"T{first_id}", is_active=True, in_playoffs=True
        )
        db.add(nfl_team)
        await db.flush()
    players = [
        NFLPlayer(
            id=first_id + i,
            name=f"Player {i}",
            position=pos,
            team_id=nfl_team.id,
        )
        for i, pos in enumerate(positions)
    ]
    db.add_all(players)
    await db.flush()
    return players


async def make_playoff_field(db: AsyncSession, *, first_id: int = 9000) -> None:
    """The 14 playoff teams; a draft can't start without them."""
    db.add_all(
        NFLTeam(id=first_id + i, team_abv=f"P{i}", is_active=True, in_playoffs=True)
        for i in range(14)
    )
    await db.flush()
