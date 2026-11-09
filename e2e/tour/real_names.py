"""Gives the seeded sample NFL teams and players real names, for the tour's screenshots only.

    PYTHONPATH=. python e2e/tour/real_names.py   (from the repo root, after seed_e2e)

The fixtures use made-up names so no test depends on real ones; the tour is the one place a
reader should recognise the players. Team abbreviations stay as seeded because the replay
file refers to them. Refuses any database that is not a throwaway one.
"""

import asyncio

from sqlalchemy import text

from api.db import session as db_session
from api.scripts.seed_e2e import _database_name

TEAMS = {
    1: ("Kansas City", "Chiefs"),
    2: ("Buffalo", "Bills"),
    3: ("Baltimore", "Ravens"),
    4: ("Houston", "Texans"),
    5: ("Philadelphia", "Eagles"),
    6: ("Los Angeles", "Rams"),
    7: ("Detroit", "Lions"),
    8: ("San Francisco", "49ers"),
}
# Slots follow the fixtures: QB, RB, RB, WR, WR, TE, K (the team defense is renamed from its city).
PLAYERS = {
    1: ["Patrick Mahomes", "Isiah Pacheco", "Kareem Hunt", "Rashee Rice", "Xavier Worthy", "Travis Kelce", "Harrison Butker"],
    2: ["Josh Allen", "James Cook", "Ray Davis", "Khalil Shakir", "Keon Coleman", "Dalton Kincaid", "Tyler Bass"],
    3: ["Lamar Jackson", "Derrick Henry", "Justice Hill", "Zay Flowers", "Rashod Bateman", "Mark Andrews", "Justin Tucker"],
    4: ["C.J. Stroud", "Joe Mixon", "Dameon Pierce", "Nico Collins", "Tank Dell", "Dalton Schultz", "Ka'imi Fairbairn"],
    5: ["Jalen Hurts", "Saquon Barkley", "Kenneth Gainwell", "A.J. Brown", "DeVonta Smith", "Dallas Goedert", "Jake Elliott"],
    6: ["Matthew Stafford", "Kyren Williams", "Blake Corum", "Puka Nacua", "Cooper Kupp", "Tyler Higbee", "Joshua Karty"],
    7: ["Jared Goff", "Jahmyr Gibbs", "David Montgomery", "Amon-Ra St. Brown", "Jameson Williams", "Sam LaPorta", "Jake Bates"],
    8: ["Brock Purdy", "Christian McCaffrey", "Jordan Mason", "Deebo Samuel", "Brandon Aiyuk", "George Kittle", "Jake Moody"],
}


async def main() -> None:
    _database_name()
    db_session.init_db()
    async with db_session.get_session_factory()() as db:
        for team_id, (city, name) in TEAMS.items():
            await db.execute(
                text(
                    "UPDATE nfl.nfl_teams SET team_city = :city, team_name = :name WHERE id = :id"
                ),
                {"city": city, "name": name, "id": team_id},
            )
            names = [*PLAYERS[team_id], f"{city} Defense"]
            for slot, player in enumerate(names):
                await db.execute(
                    text("UPDATE nfl.nfl_players SET name = :name WHERE id = :id"),
                    {"name": player, "id": team_id * 100 + slot + 1},
                )
        await db.commit()
    await db_session.close_db()


if __name__ == "__main__":
    asyncio.run(main())
