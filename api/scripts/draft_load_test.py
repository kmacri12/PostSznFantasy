"""Load test for the draft room: 12 teams and 30 sockets drafting a full draft.

    python -m api.scripts.draft_load_test --base-url http://localhost:8100

Needs an API with `TEST_AUTH_STUB=true` on a seeded e2e database (`make e2e-install` is not
required; `python -m api.scripts.seed_e2e` then `uvicorn api.main:app --port 8100` with
`ENVIRONMENT=test PLAYOFF_FIELD_SIZE=8`). Every team is a socket that picks `--interval`
seconds after it comes on the clock; the rest of the 30 sockets only watch. The result
(picks recorded, picks any socket missed or saw twice, broadcast latency from a pick to the
last socket receiving it) is printed as Markdown for docs/deploy/performance.md; the exit
code is 1 when a pick was lost or duplicated.
"""

import argparse
import asyncio
import json
import statistics
import sys
import time
from typing import Any

import httpx
import websockets

TEAMS = 12
SOCKETS = 30
# The e2e pool holds 8 NFL teams (64 players); two rounds of RB and WR fit 12 teams.
ROSTER = {
    "numberTeams": TEAMS,
    "rosterTotal": 2,
    "rosterNumQb": 0,
    "rosterNumRb": 1,
    "rosterNumWr": 1,
    "rosterNumTe": 0,
    "rosterNumFlexWrRbTe": 0,
    "rosterNumK": 0,
    "rosterNumDst": 0,
    "rosterNumBench": 0,
}


def _headers(uid: str) -> dict[str, str]:
    return {"Authorization": f"Bearer e2e-user:{uid}"}


class Run:
    def __init__(self, base_url: str, interval: float) -> None:
        self.base_url = base_url.rstrip("/")
        self.ws_url = self.base_url.replace("http", "ws", 1)
        self.interval = interval
        self.sent_at: dict[int, float] = {}
        self.seen: dict[int, list[int]] = {}
        self.last_seen_at: dict[int, float] = {}
        self.first_seen_at: dict[int, float] = {}
        self.pool: list[dict[str, Any]] = []
        self.taken: set[int] = set()
        self.done = asyncio.Event()
        self.total_picks = 0
        self.errors: list[str] = []

    async def setup(
        self, http: httpx.AsyncClient, tag: str
    ) -> tuple[int, list[tuple[str, int]]]:
        uids = [f"load-{tag}-{i}" for i in range(TEAMS)]
        for uid in uids:
            await self._ok(
                http.post(
                    "/api/auth/login",
                    json={"username": uid[:20]},
                    headers=_headers(uid),
                )
            )
        host = uids[0]
        created = await self._ok(
            http.post(
                "/api/leagues/create-league",
                headers=_headers(host),
                json={
                    "leagueName": f"Load {tag}",
                    "rosterSettings": ROSTER,
                    "teamUnitSettings": {"teamQb": False, "teamK": False},
                },
            )
        )
        season_id = created["seasonId"]
        code = (
            await self._ok(
                http.post(
                    f"/api/leagues/{created['leagueId']}/invite",
                    json={},
                    headers=_headers(host),
                )
            )
        )["code"]
        for uid in uids[1:]:
            await self._ok(
                http.post(f"/api/invites/{code}/join", headers=_headers(uid))
            )
        teams = []
        for uid in uids:
            season = await self._ok(
                http.get(f"/api/seasons/{season_id}", headers=_headers(uid))
            )
            teams.append((uid, season["myTeamId"]))
        await self._ok(
            http.put(
                f"/api/drafts/{season_id}/order",
                json={"teamIds": [team for _, team in teams]},
                headers=_headers(host),
            )
        )
        await self._ok(
            http.post(f"/api/drafts/{season_id}/control/lobby", headers=_headers(host))
        )
        pool = await self._ok(
            http.get(
                "/api/players/draft-pool",
                params={"seasonId": season_id},
                headers=_headers(host),
            )
        )
        self.pool = [p for p in pool if p["position"] in ("RB", "WR")]
        self.total_picks = TEAMS * ROSTER["rosterTotal"]
        return season_id, teams

    async def _ok(self, call: Any) -> Any:
        response = await call
        if response.status_code >= 300:
            raise SystemExit(
                f"{response.request.method} {response.request.url} -> {response.status_code} {response.text}"
            )
        return response.json() if response.content else None

    async def socket(
        self, season_id: int, uid: str, my_team: int | None, index: int
    ) -> None:
        async with websockets.connect(f"{self.ws_url}/api/drafts/ws/{season_id}") as ws:
            await ws.send(json.dumps({"eventType": "AUTH", "token": f"e2e-user:{uid}"}))
            attempted: set[int] = set()
            async for raw in ws:
                message = json.loads(raw)
                kind, data = message["eventType"], message.get("data")
                if kind == "PICK_MADE":
                    number = data["numberPickOverall"]
                    now = time.monotonic()
                    self.seen.setdefault(index, []).append(number)
                    self.first_seen_at.setdefault(number, now)
                    self.last_seen_at[number] = now
                    self.taken.add(data["playerId"])
                    if number >= self.total_picks and all(
                        len(self.seen.get(i, [])) >= self.total_picks
                        for i in range(SOCKETS)
                    ):
                        self.done.set()
                elif kind == "ERROR":
                    self.errors.append(message.get("message") or "error")
                elif kind in ("SNAPSHOT", "DRAFT_STATE") and my_team is not None:
                    if kind == "SNAPSHOT":
                        for pick in data["picks"]:
                            self.taken.add(pick["playerId"])
                    overall = data.get("currentPickOverall")
                    if (
                        data.get("status") == "in_progress"
                        and data.get("onTheClockTeamId") == my_team
                        and overall not in attempted
                    ):
                        attempted.add(overall)
                        asyncio.create_task(self.pick(ws, overall))

    async def pick(self, ws: Any, overall: int) -> None:
        await asyncio.sleep(self.interval)
        choice = next(p for p in self.pool if p["id"] not in self.taken)
        self.taken.add(choice["id"])
        self.sent_at[overall] = time.monotonic()
        await ws.send(
            json.dumps({"eventType": "MAKE_PICK", "data": {"playerId": choice["id"]}})
        )


async def main(base_url: str, interval: float) -> int:
    run = Run(base_url, interval)
    async with httpx.AsyncClient(base_url=run.base_url, timeout=30) as http:
        season_id, teams = await run.setup(http, str(int(time.time())))
        sockets = [
            asyncio.create_task(run.socket(season_id, uid, team, i))
            for i, (uid, team) in enumerate(teams)
        ]
        spectators = [
            asyncio.create_task(run.socket(season_id, teams[i % TEAMS][0], None, i))
            for i in range(TEAMS, SOCKETS)
        ]
        await asyncio.sleep(2)
        started = time.monotonic()
        await run._ok(
            http.post(
                f"/api/drafts/{season_id}/control/start", headers=_headers(teams[0][0])
            )
        )
        try:
            await asyncio.wait_for(
                run.done.wait(), timeout=run.total_picks * (interval + 5) + 30
            )
        except TimeoutError:
            pass
        elapsed = time.monotonic() - started
        final = await run._ok(
            http.get(
                f"/api/drafts/draft-info/{season_id}", headers=_headers(teams[0][0])
            )
        )
        for task in [*sockets, *spectators]:
            task.cancel()

    latencies = sorted(
        (run.last_seen_at[n] - run.sent_at[n]) * 1000
        for n in run.sent_at
        if n in run.last_seen_at
    )
    missed = {
        i: sorted(set(range(1, run.total_picks + 1)) - set(run.seen.get(i, [])))
        for i in range(SOCKETS)
    }
    lost = sum(len(m) for m in missed.values())
    duplicated = sum(len(s) - len(set(s)) for s in run.seen.values())
    median, p95, worst = (
        (
            statistics.median(latencies),
            latencies[int(0.95 * (len(latencies) - 1))],
            latencies[-1],
        )
        if latencies
        else (float("nan"),) * 3
    )
    print("| Metric | Result |\n| :-- | --: |")
    print(f"| Teams / sockets | {TEAMS} / {SOCKETS} |")
    print(f"| Picks recorded | {len(final['picks'])} of {run.total_picks} |")
    print(
        f"| Wall time | {elapsed:.1f} s ({elapsed / max(1, len(final['picks'])):.2f} s per pick, {interval:g} s think time) |"
    )
    print(f"| Picks a socket never received | {lost} |")
    print(f"| Picks a socket received twice | {duplicated} |")
    print(
        f"| Pick to last socket, median / p95 / max | {median:.0f} / {p95:.0f} / {worst:.0f} ms |"
    )
    print(f"| Errors from the server | {len(run.errors)} |")
    ok = len(final["picks"]) == run.total_picks and lost == 0 and duplicated == 0
    return 0 if ok else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base-url", default="http://localhost:8100")
    parser.add_argument(
        "--interval", type=float, default=2.0, help="seconds each team thinks"
    )
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.base_url, args.interval)))
