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
| `getNFLGamesForWeek` | `week=all`, `seasonType=post`, `season` | Playoff game list (schedule, `gameTime_epoch`, `espnLink`) |
| `getNFLBoxScore` | `gameID` (e.g. `20260110_LAR@CAR`) | Playoff box scores and per-game player stats |
| `getNFLGamesForPlayer` | `playerID`, `season`, `numberOfGames` | Not used yet: per-game stats in the same nested shape |
| `getNFLPlayerInfo` | not recorded | Not used |
| `getNFLTeamRoster` + `archiveDate=YYYYMMDD` | | Player id lists only, no stats |

## Season semantics

- **`getNFLTeamRoster` has no season parameter.** It always returns the current in-progress
  season, so rows are labelled with `SEASON_YEAR` and the seed is only correct when that is
  the current season. `archiveDate` does not return stats.
- `getNFLGamesForWeek` takes `season` = the NFL season year. The January 2026 playoffs are
  season **2025**. 2026 postseason games will not exist until January 2027, so box-score
  ingest for 2026 legitimately finds 0 games until then.
- `playerID` is the ESPN id, as a string.

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
| `punt_return_yards`, `punt_return_td` | `Punting.puntReturnYds`, `puntReturnTD` | box only |
| `kick_return_yards`, `kick_return_td` | `Kicking.kickReturnYds`, `kickReturnTD` | box only |
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

## Known gaps

- **No FG distances per kick.** Made-kick distances are parsed from `scoringPlays`
  (`"Harrison Mevis 46 Yd Field Goal"`, `scoreType == "FG"`, first `playerIDs` entry is the
  kicker). Missed-kick distances do not exist anywhere, and roster stats have only counts.
- **`DST` in a box score is per team**, not per player: `{away, home: {defTD,
  defensiveInterceptions, sacks, ydsAllowed, fumblesRecovered, ptsAllowed, safeties}}`. It is
  stored raw on `NFLGame.dst`; per-player `dst_*` columns stay 0.

## Unverified

Nothing here has been confirmed against the official endpoint list. Add the endpoint list
from RapidAPI here when available, along with any parameters we have not exercised (for
example `week` values other than `all`, and whether `getNFLGamesForWeek` accepts
`seasonType=reg`).
