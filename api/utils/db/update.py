"""Real async DB update functions for NFL data ingestion.

Each function accepts an open AsyncSession. Callers are responsible for
committing or rolling back the session.
"""

import logging
from typing import Any

from api.db.models.nfl import (
    NFLGame,
    NFLPlayer,
    NFLPlayerGameStats,
    NFLPlayerSeasonStats,
    NFLTeam,
)
from api.utils.rapidapi.rapidapi import get_rapidapi_client
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def _int(val: object, default: int = 0) -> int:
    try:
        return int(val)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _str(val: object) -> str | None:
    return str(val) if val is not None else None


async def sync_nfl_teams(db: AsyncSession) -> None:
    """Fetch teams from RapidAPI and upsert into nfl_teams."""
    client = get_rapidapi_client()
    teams = await client.get_nfl_teams()
    for raw in teams:
        team_id = _int(raw.get("teamID"))
        if not team_id:
            continue
        stmt = (
            insert(NFLTeam)
            .values(
                id=team_id,
                team_abv=_str(raw.get("teamAbv")),
                team_city=_str(raw.get("teamCity")),
                team_name=_str(raw.get("teamName")),
                team_logo_url=_str(raw.get("teamLogoUrl")),
                is_active=True,
            )
            .on_conflict_do_update(
                index_elements=["id"],
                set_={
                    "team_abv": _str(raw.get("teamAbv")),
                    "team_city": _str(raw.get("teamCity")),
                    "team_name": _str(raw.get("teamName")),
                    "team_logo_url": _str(raw.get("teamLogoUrl")),
                },
            )
        )
        await db.execute(stmt)
    logger.info("Synced %d NFL teams", len(teams))


async def sync_nfl_players(db: AsyncSession) -> None:
    """Fetch all players from RapidAPI and upsert into nfl_players."""
    client = get_rapidapi_client()
    players = await client.get_nfl_players()
    for raw in players:
        player_id = _int(raw.get("playerID"))
        if not player_id:
            continue
        stmt = (
            insert(NFLPlayer)
            .values(
                id=player_id,
                name=_str(raw.get("longName")),
                position=_str(raw.get("pos")),
                espn_headshot_url=_str(raw.get("espnHeadshot")),
                jersey_num=_str(raw.get("jerseyNum")),
                birthday=_str(raw.get("bDay")),
                height=_str(raw.get("height")),
                weight=_str(raw.get("weight")),
                exp=_str(raw.get("exp")),
                team_id=_int(raw.get("teamID")) or None,
            )
            .on_conflict_do_update(
                index_elements=["id"],
                set_={
                    "name": _str(raw.get("longName")),
                    "position": _str(raw.get("pos")),
                    "espn_headshot_url": _str(raw.get("espnHeadshot")),
                    "jersey_num": _str(raw.get("jerseyNum")),
                    "birthday": _str(raw.get("bDay")),
                    "height": _str(raw.get("height")),
                    "weight": _str(raw.get("weight")),
                    "exp": _str(raw.get("exp")),
                    "team_id": _int(raw.get("teamID")) or None,
                },
            )
        )
        await db.execute(stmt)
    logger.info("Synced %d NFL players", len(players))


def _parse_season_stats(raw_player: dict[str, Any], season: str) -> dict[str, Any]:
    """Map RapidAPI roster-with-stats keys to NFLPlayerSeasonStats columns."""
    s: dict[str, Any] = raw_player.get("stats", {}) or {}
    fg_yards: list[int] = []  # RapidAPI aggregates do not give per-FG yard distances

    return {
        "season": season,
        "player_id": _int(raw_player.get("playerID")),
        "passing_completions": _int(s.get("PassingComp")),
        "passing_attempts": _int(s.get("PassingAtt")),
        "passing_yards": _int(s.get("PassingYds")),
        "passing_touchdowns": _int(s.get("PassingTD")),
        "passing_interceptions": _int(s.get("PassingInts")),
        "passing_sacked": _int(s.get("PassingSacked")),
        "passing_sacked_yards": _int(s.get("PassingSackedYds")),
        "passing_two_point_conversions": _int(s.get("Passing2PtConv")),
        "rushing_carries": _int(s.get("RushingAtt")),
        "rushing_yards": _int(s.get("RushingYds")),
        "rushing_touchdowns": _int(s.get("RushingTD")),
        "rushing_long_rush": _int(s.get("RushingLong")),
        "rushing_two_point_conversions": _int(s.get("Rushing2PtConv")),
        "receiving_receptions": _int(s.get("Receptions")),
        "receiving_targets": _int(s.get("Targets")),
        "receiving_yards": _int(s.get("ReceivingYds")),
        "receiving_touchdowns": _int(s.get("ReceivingTD")),
        "receiving_long_reception": _int(s.get("ReceivingLong")),
        "receiving_two_point_conversions": _int(s.get("Receiving2PtConv")),
        "carrying_fumbles": _int(s.get("Fumbles")),
        "carrying_fumbles_lost": _int(s.get("FumblesLost")),
        "punt_return_yards": _int(s.get("PuntReturnYds")),
        "punt_return_td": _int(s.get("PuntReturnTD")),
        "kick_return_yards": _int(s.get("KickReturnYds")),
        "kick_return_td": _int(s.get("KickReturnTD")),
        "kicking_xp_made": _int(s.get("XPMade")),
        "kicking_xp_missed": _int(s.get("XPMissed")),
        "kicking_fg_missed": _int(s.get("FGMissed")),
        "kicking_fg_yards_made": fg_yards,
        "dst_yards_allowed": _int(s.get("DSTYdsAllowed")),
        "dst_points_allowed": _int(s.get("DSTPtsAllowed")),
        "dst_sacks": _int(s.get("DSTSacks")),
        "dst_def_td": _int(s.get("DSTDefTD")),
        "dst_safeties": _int(s.get("DSTSafeties")),
        "dst_fumbles_recovered": _int(s.get("DSTFumblesRecovered")),
        "dst_interceptions": _int(s.get("DSTInterceptions")),
    }


async def sync_nfl_players_and_stats(db: AsyncSession) -> None:
    """Fetch per-team roster+stats from RapidAPI and upsert season stats rows."""
    from api.core.config import get_settings

    season = str(get_settings().season_year)
    client = get_rapidapi_client()

    active_teams = (
        (await db.execute(select(NFLTeam).where(NFLTeam.is_active.is_(True))))
        .scalars()
        .all()
    )

    for team in active_teams:
        if not team.team_abv:  # type: ignore[attr-defined]
            continue
        roster = await client.get_stats_for_team(str(team.id), team.team_abv or "")
        for raw in roster:
            player_id = _int(raw.get("playerID"))
            if not player_id:
                continue
            values = _parse_season_stats(raw, season)
            stmt = (
                insert(NFLPlayerSeasonStats)
                .values(**values)
                .on_conflict_do_update(
                    index_elements=["season", "player_id"],
                    set_={
                        k: v
                        for k, v in values.items()
                        if k not in ("season", "player_id")
                    },
                )
            )
            await db.execute(stmt)
        logger.debug("Synced season stats for team %s", team.team_abv)


def _parse_game_player_stats(
    game_id: str,
    player_stats_json: dict[str, Any],
) -> list[dict[str, Any]]:
    """Parse the box score playerStats blob into NFLPlayerGameStats row dicts.

    The RapidAPI box score returns playerStats as a dict keyed by player ID,
    where each value is a flat dict of stat keys.
    """
    rows: list[dict[str, Any]] = []
    for pid_str, s in player_stats_json.items():
        player_id = _int(pid_str)
        if not player_id or not isinstance(s, dict):
            continue

        # FG made yard distances — some APIs give "FGYardsMade" as a list
        fg_raw = s.get("FGYardsMade", [])
        fg_yards: list[int] = (
            [_int(y) for y in fg_raw] if isinstance(fg_raw, list) else []
        )
        fg_missed_raw = s.get("FGYardsMissed", [])
        fg_yards_missed: list[int] = (
            [_int(y) for y in fg_missed_raw] if isinstance(fg_missed_raw, list) else []
        )

        rows.append(
            {
                "game_id": game_id,
                "player_id": player_id,
                "passing_completions": _int(s.get("PassingComp")),
                "passing_attempts": _int(s.get("PassingAtt")),
                "passing_yards": _int(s.get("PassingYds")),
                "passing_touchdowns": _int(s.get("PassingTD")),
                "passing_interceptions": _int(s.get("PassingInts")),
                "passing_sacked": _int(s.get("PassingSacked")),
                "passing_sacked_yards": _int(s.get("PassingSackedYds")),
                "passing_two_point_conversions": _int(s.get("Passing2PtConv")),
                "rushing_carries": _int(s.get("RushingAtt")),
                "rushing_yards": _int(s.get("RushingYds")),
                "rushing_touchdowns": _int(s.get("RushingTD")),
                "rushing_long_rush": _int(s.get("RushingLong")),
                "rushing_two_point_conversions": _int(s.get("Rushing2PtConv")),
                "receiving_receptions": _int(s.get("Receptions")),
                "receiving_targets": _int(s.get("Targets")),
                "receiving_yards": _int(s.get("ReceivingYds")),
                "receiving_touchdowns": _int(s.get("ReceivingTD")),
                "receiving_long_reception": _int(s.get("ReceivingLong")),
                "receiving_two_point_conversions": _int(s.get("Receiving2PtConv")),
                "carrying_fumbles": _int(s.get("Fumbles")),
                "carrying_fumbles_lost": _int(s.get("FumblesLost")),
                "punt_return_yards": _int(s.get("PuntReturnYds")),
                "punt_return_td": _int(s.get("PuntReturnTD")),
                "kick_return_yards": _int(s.get("KickReturnYds")),
                "kick_return_td": _int(s.get("KickReturnTD")),
                "kicking_xp_made": _int(s.get("XPMade")),
                "kicking_xp_missed": _int(s.get("XPMissed")),
                "kicking_fg_missed": _int(s.get("FGMissed")),
                "kicking_fg_yards_made": fg_yards,
                "kicking_fg_yards_missed": fg_yards_missed,
                "dst_yards_allowed": _int(s.get("DSTYdsAllowed")),
                "dst_points_allowed": _int(s.get("DSTPtsAllowed")),
                "dst_sacks": _int(s.get("DSTSacks")),
                "dst_def_td": _int(s.get("DSTDefTD")),
                "dst_safeties": _int(s.get("DSTSafeties")),
                "dst_fumbles_recovered": _int(s.get("DSTFumblesRecovered")),
                "dst_interceptions": _int(s.get("DSTInterceptions")),
                "dst_blocked_kicks": _int(s.get("DSTBlockedKicks")),
                "dst_two_point_returns": _int(s.get("DST2PtReturns")),
            }
        )
    return rows


async def sync_game_box_scores(
    db: AsyncSession,
    season: str,
    season_type: str,
    week: str = "all",
) -> None:
    """Fetch games list then pull each box score and upsert NFLGame + NFLPlayerGameStats."""
    client = get_rapidapi_client()
    games = await client.get_nfl_games_list(season, season_type, week)

    for game_summary in games:
        game_id = _str(game_summary.get("gameID"))
        if not game_id:
            continue

        box = await client.get_nfl_box_score(game_id)
        if not box:
            continue

        game_week_val = _int(game_summary.get("gameWeek")) or None

        # Upsert NFLGame
        game_values: dict[str, Any] = {
            "id": game_id,
            "game_status": _str(box.get("gameStatus")),
            "game_date": _str(box.get("gameDate")),
            "game_time_epoch": _str(box.get("gameTimeEpoch")),
            "game_week": game_week_val,
            "season": _int(season) or None,
            "espn_link": _str(box.get("espnLink")),
            "team_id_home": _int(box.get("teamIDHome")) or None,
            "team_id_away": _int(box.get("teamIDAway")) or None,
            "home_pts": _int(box.get("homePts")) or None,
            "away_pts": _int(box.get("awayPts")) or None,
            "season_type": season_type,
            "team_stats": box.get("teamStats"),
            "scoring_plays": box.get("scoringPlays"),
            "line_score": box.get("lineScore"),
            "player_stats": box.get("playerStats"),
            "dst": box.get("DST"),
            "game_clock": _str(box.get("gameClock")),
        }
        await db.execute(
            insert(NFLGame)
            .values(**game_values)
            .on_conflict_do_update(
                index_elements=["id"],
                set_={k: v for k, v in game_values.items() if k != "id"},
            )
        )

        # Upsert per-player game stats
        player_stats_raw = box.get("playerStats")
        if isinstance(player_stats_raw, dict):
            for row in _parse_game_player_stats(game_id, player_stats_raw):
                await db.execute(
                    insert(NFLPlayerGameStats)
                    .values(**row)
                    .on_conflict_do_update(
                        index_elements=["game_id", "player_id"],
                        set_={
                            k: v
                            for k, v in row.items()
                            if k not in ("game_id", "player_id")
                        },
                    )
                )
        logger.debug("Synced box score for game %s", game_id)

    logger.info("Synced box scores for %d games (week=%s)", len(games), week)


async def mark_eliminated_teams(
    db: AsyncSession, eliminated_team_ids: list[int]
) -> None:
    """Set is_active = False for all given NFL team IDs."""
    if not eliminated_team_ids:
        return
    await db.execute(
        update(NFLTeam)
        .where(NFLTeam.id.in_(eliminated_team_ids))
        .values(is_active=False)
    )
    logger.info("Marked %d teams as eliminated", len(eliminated_team_ids))
