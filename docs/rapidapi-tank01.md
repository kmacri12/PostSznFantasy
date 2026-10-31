# Tank01 NFL API (RapidAPI)

Derived from live probing in October 2026; the official RapidAPI docs are JS-rendered and
were not readable. Anything not listed under [Unverified](#unverified) was observed in a
real response. Parsers live in `api/services/ingestion/schemas.py`, the client in
`api/utils/rapidapi/rapidapi.py`.

## Basics

- Every response is `{"statusCode": 200, "body": ...}`.
- Every response carries `x-ratelimit-requests-limit` and `x-ratelimit-requests-remaining`.
  The client logs the remaining count (warning when low) and exposes it as
  `RapidApiClient.requests_remaining`; `make seed` prints it at the end. The plan is ~1000
  calls; a full seed spends ~35.
- 429 is retried (honouring `Retry-After`), as are 5xx and transport errors. Other 4xx fail.
- `RAPIDAPI_CACHE_DIR` (dev only) replays responses from disk so re-seeding costs no quota.
  Entries never expire; delete the directory to refresh.

## Endpoints

| Endpoint | Params | Used for |
| :-- | :-- | :-- |
| `getNFLTeams` | | Teams ingest |
| `getNFLPlayerList` | | Players ingest |
| `getNFLTeamRoster` | `teamID`, `teamAbv`, `getStats=true` | Season stats ingest |
| `getNFLDepthCharts` | none (a team filter is unverified) | Team QB / team K starter: `QB1` and `PK1` per team (`services/ingestion/depth_chart_ingest.py`; one call per roster sync). Provenance and refresh cadence are unknown, so a team without a usable entry falls back to the most pass attempts / kicks. See `docs/research/team-qb-k-starter-source.md` |
| `getNFLGamesForWeek` | `week=all`, `seasonType=post`, `season` | Playoff game list (schedule, `gameTime_epoch`, `espnLink`) |
| `getNFLBoxScore` | `gameID` (e.g. `20260110_LAR@CAR`), `playByPlay=true` | Playoff box scores and per-game player stats. The client always sends `playByPlay=true`: same one call, adds `allPlayByPlay` (missed FG distances) |
| `getNFLGamesForPlayer` | `playerID`, `season`, `numberOfGames` | Not used yet: per-game stats in the same nested shape |
| `getNFLPlayerInfo` | not recorded | Not used |
| `getNFLTeamRoster` + `archiveDate=YYYYMMDD` | | Player id lists only, no stats |

## Quota budget (live polling)

The scheduler spends calls only on games that are in progress: one `getNFLBoxScore` per
live game every `SCHEDULER_LIVE_POLL_SECONDS` (default 180). The poll that returns
`Completed` is the final fetch; that game is never polled again. The games list
(`getNFLGamesForWeek`) is refreshed once a day plus once after each kickoff, and teams and
players once a day (season stats are not part of the loop). 13 playoff games at about 3.25
hours each is roughly 800 box score calls for the whole postseason. A failed call rolls
back that game only and leaves its stored data and the "box_scores" freshness stamp as they
were. `POST /api/admin/refresh/live` runs one cycle on demand.

`RAPIDAPI_DAILY_REQUEST_LIMIT` (default 700) caps calls per UTC day, retries included. The
count lives in memory, so a restart resets it; once spent, the client raises
`RapidApiBudgetExceeded`, the poll cycle logs a warning and skips, and
`GET /api/players/sync-status` reports `budgetExhausted: true` so the UI can call the data stale.

## Replay mode (rehearsal, no API calls)

Save a finished postseason once (about 14 calls, free with `RAPIDAPI_CACHE_DIR`):

```bash
uv run python -m api.scripts.export_replay --season 2025 --out replay-2025.json
```

Then set `SCHEDULER_ENABLED=true` and `SCHEDULER_REPLAY_FILE=replay-2025.json`
(`SCHEDULER_REPLAY_SPEED`, default 60, scales the virtual clock). The scheduler serves the
saved games through `api.services.replay.ReplayClient` into the same
`run_poll_cycle` / ingest / elimination code: games go Scheduled, Live, then Final over
3.5 virtual hours, with scores ramping linearly (player stats are served final from
kickoff). Teams and players must already be seeded, and replay writes into the database
like a real run, so use a throwaway one.

## Season semantics

- **`getNFLTeamRoster` has no season parameter.** It always returns the current in-progress
  season, so rows are labelled with `SEASON_YEAR` and the seed is only correct when that is
  the current season. `archiveDate` does not return stats.
- `getNFLGamesForWeek` takes `season` = the NFL season year. The January 2026 playoffs are
  season **2025**. 2026 postseason games will not exist until January 2027, so box-score
  ingest for 2026 legitimately finds 0 games until then.
- `playerID` is the ESPN id, as a string.

## Injury status

`getNFLPlayerList` rows carry `injury: {designation, description, injDate, injReturnDate}`. Only `designation` is stored (`nfl_players.injury_status`, `parse_injury_status` in `schemas.py`), and only when it is `Out`, `Doubtful`, `Questionable` or `Injured Reserve`. See `docs/research/injury-status.md`.

## Stats schema

Roster stats and box-score `playerStats` entries share one nested shape. Values are strings
like `"1474.0"` (roster) or `"304"` (box); the parser goes through `float`.

| DB column | Category.key | Notes |
| :-- | :-- | :-- |
| `passing_completions` / `_attempts` / `_yards` / `_touchdowns` | `Passing.passCompletions` / `passAttempts` / `passYds` / `passTD` | |
| `passing_interceptions` | `Passing.int` | |
| `passing_two_point_conversions` | `Passing.passingTwoPointConversion` | |
| `passing_sacked`, `passing_sacked_yards` | `Passing.sacked` | box only, `"times-yards"` e.g. `"1-9"` |
| `rushing_carries` / `_yards` / `_touchdowns` | `Rushing.carries` / `rushYds` / `rushTD` | |
| `rushing_long_rush` | `Rushing.longRush` | box only |
| `rushing_two_point_conversions` | `Rushing.rushingTwoPointConversion` | |
| `receiving_receptions` / `_targets` / `_yards` / `_touchdowns` | `Receiving.receptions` / `targets` / `recYds` / `recTD` | |
| `receiving_long_reception` | `Receiving.longRec` | box only |
| `receiving_two_point_conversions` | `Receiving.receivingTwoPointConversion` | |
| `carrying_fumbles`, `carrying_fumbles_lost` | `Defense.fumbles`, `Defense.fumblesLost` | fumbles live under `Defense` |
| `punt_return_yards`, `punt_return_td` (stored; scored by the DST, not the returner) | `Punting.puntReturnYds`, `puntReturnTD` | box only |
| `kick_return_yards`, `kick_return_td` (stored; scored by the DST, not the returner) | `Kicking.kickReturnYds`, `kickReturnTD` | box only |
| `kicking_xp_made` | `Kicking.xpMade` | |
| `kicking_xp_missed` | `Kicking.xpMissed`, else `xpAttempts - xpMade` | |
| `kicking_fg_made` | `Kicking.fgMade` | |
| `kicking_fg_missed` | `Kicking.fgMissed`, else `fgAttempts - fgMade` | |

Roster stats also carry metadata (`gamesPlayed`, `teamID`, `team`, `teamAbv`) next to the
categories; an entry with none of the six categories is treated as "no stats". Players with
an empty `stats` get all-zero rows. If players have stats but **none** parse, ingest raises
`StatsShapeError` rather than writing zeros: that is how the original flat-key parser
silently produced an all-zero Players tab.

Box scores also include `snapCounts` per player (ignored; snap-only entries such as
linemen are skipped), `scoringPlays`, `teamStats`, `lineScore`, and `gameStatus`.

## Games

- List `gameStatus` is `"Final"`, box-score `gameStatus` is `"Completed"`. Ingest stores
  `"Completed"` for both; the scheduler and team page compare against it.
- `gameWeek` is `Wild Card`, `Divisional Round`, `Conference Championship` or `Super Bowl`,
  stored as weeks 19 to 22 (`POSTSEASON_WEEKS`).
- `gameTime_epoch` and `espnLink` exist only in the games list; the box score has neither.

## Confirmed keys (issue #77)

Checked 2026-10-31 against all 13 real 2025 postseason box scores (`seasonType=post`,
`season=2025`; Wild Card to Super Bowl) and one `playByPlay=true` fetch of
`20260125_NE@DEN`. 10 live calls in all (9 games not already cached, 1 play-by-play probe); the games list and `getNFLPlayerList` came from cache. A key
is **Confirmed** when seen with a real, non-zero value that reconciles with the
scoring plays or the game result; **Present** when the key exists but every observed
value was `"0"`.

| Stat | Source | Status | Evidence |
| :-- | :-- | :-- | :-- |
| Made FG distance | `scoringPlays` (`scoreType` `FG`, `"... 46 Yd Field Goal"`, kicker = `playerIDs[0]`) | Confirmed | 45 FG plays across 13 games; count equals `Kicking.fgMade` and the maximum equals `fgLong` |
| Missed FG count | `Kicking.fgMissed` | Confirmed | `20260125_NE@DEN`: Lutz 2, Borregales 2 (`fgAttempts - fgMade` held in every game) |
| **Missed FG distance** | **`allPlayByPlay[].playerStats[kicker].Kicking.fgYds`** on plays with `fgAttempts` and no `fgMade` (needs `playByPlay=true`) | Confirmed | `20260125_NE@DEN`: Lutz 54 (wide right) and 45 (blocked), Borregales 63 and 46 (both wide), matching `fgMissed`; fixture `api/tests/fixtures/box_score_ne_den_kicks.json` |
| `FGYardsMissed` key | n/a | **Does not exist** | Absent from every box score, roster stat and play. Stored as `kicking_fg_yards_missed` from the play-by-play instead |
| Missed XP count | `Kicking.xpMissed` | Confirmed | Non-zero for McManus (`20260110_GB@CHI`, 1 of 4), Pineiro, Elliott (`20260111_SF@PHI`), Fairbairn (`20260112_HOU@PIT`) |
| XP made | `Kicking.xpMade` | Confirmed | every game |
| Sacks | `DST[team].sacks` | Confirmed | 26 team-games; equals the sum of `Defense.sacks` |
| Interceptions | `DST[team].defensiveInterceptions` | Confirmed | `20260118_HOU@NE`: NE 4 |
| Fumble recoveries | opponent's `teamStats.fumblesLost` (equals `DST[team].fumblesRecovered`) | Confirmed | `20260117_BUF@DEN`: DEN 3 = BUF `fumblesLost` 3 |
| Defensive TDs | `teamStats.defensiveOrSpecialTeamsTds` (includes return TDs); `DST.defTD` is defense only | Confirmed | `20260112_HOU@PIT`: HOU `defTD` 2 (a fumble return and an interception return); `20260117_SF@SEA`: SEA `defTD` 0 but `defensiveOrSpecialTeamsTds` 1 |
| Kick return TD | `Kicking.kickReturnTD` on the returner, and in `defensiveOrSpecialTeamsTds` | Confirmed | Shaheed 95-yard kickoff return, `20260117_SF@SEA` (`scoreType` `TD`, text "Kickoff Return"). Punt return TD key `Punting.puntReturnTD` is Present only |
| Points allowed | opponent final score minus 6 per opponent defensive or special-teams TD (our rule, `dst_stats.py`) | Confirmed | Tank01's own `DST.ptsAllowed` removes only `defTD` (SF in `20260117_SF@SEA`: 41, not 35), so we do not use it |
| Yards allowed | opponent's `teamStats.totalYards` (equals `DST.ydsAllowed`) | Confirmed | all 26 team-games |
| Blocked kicks, by kind | own `teamStats.blockedPunt`, `blockedFG`, `blockedXP`, each stored in its own column and summed for scoring (the blocking team is credited). Tank01 sends all three kinds as separate keys; the sample had punt and FG blocks, no XP block | Confirmed | `20260125_NE@DEN`: NE `blockedFG` 1, and Lutz's 45-yard FG "is BLOCKED (L.Taylor)" in the play-by-play; `20260110_LAR@CAR`: CAR `blockedPunt` 1. `blockedXP` is Present only |
| Safeties | `DST[team].safeties` | Present | `"0"` in all 26 team-games, so there is no real sample. Credit direction (scoring team) is assumed. There is no `scoreType` for safeties in `scoringPlays` (only `TD` and `FG` occurred), so the old `SF` lookup was dropped |
| 2-point returns | `teamStats.defensiveTwoPointConversionReturns` | Present | `"0"` in all 26 team-games; the 2025 postseason had no defensive 2-point return, so the credit direction is unverified |
| Official position | `getNFLPlayerList` `pos` | Confirmed | every kicker with a `fgMade` key (26 kicker-games) is `PK` (we store `K`), every passer with 4+ attempts (27) is `QB` |

Not observed in the 2025 postseason, so their semantics stay unproven: safeties, defensive
2-point returns, blocked extra points, punt return TDs, a fumble-return TD against the
returner's `Rushing`/`Receiving` TD keys.

## Known gaps

- **Made-kick distances are not per-kick in `playerStats`**, only in `scoringPlays`
  (`"Harrison Mevis 46 Yd Field Goal"`). Missed-kick distances come from `allPlayByPlay`
  (see above); roster stats have only counts, so season rows carry neither distance list.
  If a box score arrives without `allPlayByPlay` (an older replay file), the missed distances
  are empty, the missed count still comes from `fgMissed`, and the per-yard miss setting
  scores 0 for those kicks.
- **`DST` in a box score is per team**, not per player: `{away, home: {defTD,
  defensiveInterceptions, sacks, ydsAllowed, fumblesRecovered, ptsAllowed, safeties}}`. It is
  stored raw on `NFLGame.dst` as a cross-check. DST scoring uses one row per team per game on
  the synthetic DST players (`services/ingestion/dst_stats.py`): yards allowed is the
  opponent's `teamStats.totalYards`, points allowed is the opponent's final score minus 6 per
  opponent `defensiveOrSpecialTeamsTds`, fumble recoveries are the opponent's `fumblesLost`,
  safeties are `DST.safeties`, blocked kicks are the team's `blockedPunt` + `blockedFG` +
  `blockedXP`, 2-point returns are `defensiveTwoPointConversionReturns`.

## Unverified

Nothing here has been confirmed against the official endpoint list. Add the endpoint list
from RapidAPI here when available, along with any parameters we have not exercised (for
example `week` values other than `all`, and whether `getNFLGamesForWeek` accepts
`seasonType=reg`).
