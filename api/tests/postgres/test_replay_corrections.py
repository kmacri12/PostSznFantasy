"""A stat correction on a real box score from the replay fixture, end to end: ingest it
as final, ingest it again with a corrected stat, read the tooltip's numbers back from
the team page and the round breakdown."""

import copy
import json
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import NFLPlayer, NFLTeam, TeamPlayer
from api.services.ingestion import poll_game_box_score
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season
from api.tests.postgres.test_live_polling import FakeClient

REPLAY = Path(__file__).resolve().parents[3] / "e2e" / "fixtures" / "replay.json"
GAME_ID = "20261229_KCC@BUF"  # a completed Divisional Round game
PASSER_ID = 201  # 332 passing yards, 1 TD, 0 INT in the fixture


async def test_a_corrected_stat_in_the_replay_fixture_reaches_the_team_page_and_breakdown(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    box: dict[str, Any] = json.loads(REPLAY.read_text())["boxes"][GAME_ID]
    corrected = copy.deepcopy(box)
    corrected["playerStats"][str(PASSER_ID)]["Passing"]["passYds"] = "357"
    season, _, teams, _ = await make_season(db, draft_status="completed")
    season.year = 2026
    home, away = int(box["teamIDHome"]), int(box["teamIDAway"])
    db.add_all(
        NFLTeam(id=team_id, team_abv=f"T{team_id}", is_active=True, in_playoffs=True)
        for team_id in (home, away)
    )
    await db.flush()
    db.add(NFLPlayer(id=PASSER_ID, name="Josh Allen", position="QB", team_id=home))
    await db.flush()
    db.add(TeamPlayer(team_id=teams[0].id, season_id=season.id, player_id=PASSER_ID))
    await db.flush()

    for payload in (box, corrected):
        client = FakeClient([], {GAME_ID: payload})
        await poll_game_box_score(db, GAME_ID, "2026", client=client)  # type: ignore[arg-type]

    async with client_as("uid-0") as owner:
        team = (await owner.get(f"/api/teams/{teams[0].id}")).json()
        breakdown = (await owner.get(f"/api/teams/{teams[0].id}/breakdown")).json()
    divisional = next(r for r in team["lineups"] if r["round"] == 2)
    passer = next(p for p in divisional["unassigned"] if p["id"] == PASSER_ID)
    # 332 yds x 0.04 + 1 TD x 4 = 17.28; 25 more yards = +1.
    assert passer["points"] == 18.28
    assert passer["scoreChange"]["previousPoints"] == 17.28
    assert passer["scoreChange"]["newPoints"] == 18.28
    assert passer["scoreChange"]["changedAt"]
    bench = breakdown["rounds"][1]["bench"]
    assert [p["scoreChange"]["newPoints"] for p in bench] == [18.28]
