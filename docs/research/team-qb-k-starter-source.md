# Tank01 source for team QB / team K starters (issue 13.3)

Researched 2026-10-30. One live call was made through `RapidApiClient` with `RAPIDAPI_CACHE_DIR` set (`getNFLDepthCharts`, no parameters; quota showed 890 remaining afterwards). Everything else came from the repo fixtures and the 34 cached responses in `.rapidapi-cache/` (32 team rosters, the player list, the teams list; git-ignored). The key was not printed or written anywhere. The cached data is the in-progress 2026 regular season (about week 8, 2026-10-30), not a playoff snapshot.

Labels: **Verified** = observed in a real response (source named). **Unverified** = not observed.

## Answer: recommended approach for 13.3

1. **Pick the starter from `getNFLDepthCharts`**, one call for all 32 teams. Use the entry with `depthPosition == "QB1"` in the `QB` list and `"PK1"` in the `PK` list. Seed it with the other ingests (about 1 extra call) and re-run it daily plus before the draft; store the result on the player (for example `is_depth_chart_starter`) or a small `nfl_depth_starter(team_id, position, player_id)` table.
2. **Define "counts as QB / K" by the official roster position**, not by depth and not by stat category: `NFLPlayer.position` from `getNFLPlayerList.pos`. QB is `"QB"`; kicker is `"PK"` (Tank01 never uses `"K"`). Map PK to the product's K.
3. **Scoring sum**: for a team-QB (team-K) slot, sum every `playerStats` entry in the box score where `team` equals the drafted player's NFL team **and** the player's stored `position` is `QB` (`PK`). The box score has no position field (see section 4), so the join to `NFLPlayer.position` by `playerID` is required. A WR who throws is excluded because his `pos` is WR.
4. **Fallback** when a team's depth chart entry is missing or its QB1/PK1 is not in the player list with a matching team and position: the player with the most `Passing.passAttempts` (QB) or `Kicking.fgAttempts` (PK) from `getNFLTeamRoster`, among players whose roster `pos` matches. Log a warning when the fallback is used, and let the commissioner override from the admin page.
5. Draft pool then lists exactly 32 QBs and 32 Ks (the depth chart returned exactly one `QB1` and one `PK1` per team).

The depth chart beats the stats fallback in the current data: on 2 of 32 teams (BAL, NYG) the most-attempts QB is not the depth chart starter (section 3).

## Evidence

### 1. Depth chart endpoint

- **Verified (live call `GET /getNFLDepthCharts`, no params):** it exists and returns `{"statusCode":200,"body":[...]}` with 32 elements, one per team: `{"teamAbv","teamID","depthChart":{...}}`.
- **Verified (same call):** `depthChart` has exactly the keys `DB, DL, LB, PK, QB, RB, TE, WR` for all 32 teams. There is no `P`, `LS`, `OL`, `TE`-split or special-teams key. Each position is a list of `{"depthPosition":"QB1","longName":"...","playerID":"..."}` in depth order; no team, injury or status field per entry. `playerID` is the same ESPN id string as the player list and roster.
- **Verified:** every team has a `QB1` and a `PK1`. QB list lengths: 20 teams have 2, 9 have 3, 2 have 1 (BUF, NE), 1 has 4. `PK` has one entry on 31 teams and two on LAR (`PK2` Blake Grupe, who is on injured reserve).
- **Verified:** all 64 `QB1` / `PK1` players appear in `getNFLPlayerList` with the same team and `pos` (`QB` / `PK`) and in that team's `getNFLTeamRoster`.
- **Verified:** the depth chart includes injured-reserve players further down the list (LAC `QB2` Trey Lance, LAR `QB3` Jimmy Garoppolo, LAR `PK2`); these are in the player list but **not** in the team roster response.
- **Unverified:** whether it accepts a `teamAbv` / `teamID` filter, how often Tank01 refreshes it, and whether it changes the same day a starter is benched. Tank01 states these nowhere we can read (the RapidAPI docs are JS-rendered; see `docs/rapidapi-tank01.md`). The endpoint name was found by call, not from a documentation page.
- **Unverified:** whether its content reflects the official team depth chart or is auto-derived (for example from ESPN). It is not an official NFL source.

### 2. Official roster position, injury and practice squad

- **Verified (`getNFLPlayerList`, 3,833 rows, and `getNFLTeamRoster` rows):** the field is `pos`. The repo stores it as `NFLPlayer.position` (`api/services/ingestion/players_ingest.py`, `safe_str(raw.get("pos"))`).
- **Verified (player list):** `pos` values: WR, LB, CB, DT, S, RB, TE, DE, OT, QB (156), G, C, **PK (69)**, P (54), LS, FB, OL, DB, DL, KR (1). There is no `K`. Kickers are `PK`, punters `P`. The roster fixture `api/tests/fixtures/team_roster_stats.json` agrees (`Harrison Butker`, `pos: "PK"`).
- **Verified (player list):** non-free-agent QBs: 32 teams each have 3 or 4 listed; PKs: 1 to 3 per team. Free agents are `isFreeAgent: "True"` (1,418 of 3,833) and still carry a stale `team` string, so filter on `isFreeAgent != "True"`. The same name can appear twice (Lamar Jackson QB for BAL and Lamar Jackson CB, a free agent).
- **Verified:** injury is a nested object on player-list and roster rows: `injury: {designation, description, injDate, injReturnDate}`. `designation` examples seen: `Questionable`, `Injured Reserve`, empty. Jalen Hurts (PHI) is `Injured Reserve` with a return date of 2027-02-15 and is correctly absent from the PHI depth chart and roster.
- **Verified (cross-check of 32 roster files against the player list):** the roster endpoint is the active (53-man) roster only. It has 87 QBs and 32 PKs, one PK per team. 28 non-free-agent QB/PK players in the player list, status not stated; the ones checked (Trey Lance LAC, Blake Grupe LAR) are `Injured Reserve`; others such as Hendon Hooker TEN were not inspected, are not in any roster. The player list is therefore the only source that includes IR players.
- **Unverified:** practice squad. No field in any response names it, and the roster response did not include a `practiceSquad` or `status` flag. Practice-squad QBs and Ks may be in the player list with a team, or absent; not determined. Likely no scoring impact, since such players rarely play, but they would still be summed if they do.
- **Verified:** the player's `team` and `pos` are current-state fields. `getNFLTeamRoster` has no season parameter (`docs/rapidapi-tank01.md`), so they describe today's team, not the team in a past game.

### 3. Fallbacks and their failure cases

Fallback data: `Passing.passAttempts` and `Kicking.fgAttempts` from the cached rosters (`getStats=true`), 7 games into the season.

- **Verified failure of "most pass attempts" as starter (vs depth chart QB1), 2 of 32 teams:**
  - BAL: Tyler Huntley 106 attempts, Lamar Jackson 96 (Jackson is QB1, back from an injury, Questionable).
  - NYG: Jameis Winston 158, J.J. McCarthy 49 (McCarthy is QB1).
  - The other 30 teams agree (for example TB Mayfield 107 vs Daniels 98, WSH Daniels 116 vs Mariota 51).
  - So an attempts leader is wrong on BAL and NYG at this date, and a late-season injury to a starter (the case the product rule worries about) would show the same failure for most of a year.
- **Verified failure of "most field-goal attempts as the kicker":** LAR's Brandon McManus has 0 attempts and is the `PK1`; MIA's Zane Gonzalez has 0 and is `PK1`. Kicker changes mid-season are therefore invisible to season totals. (Both are the only non-IR PK on the roster, so "the only roster PK" works here.)
- **Verified:** `stats` is `{}` for players with no games (for example Garrett Nussmeier); parsers must treat that as zero (already the case in ingestion).
- **Simpler fallback that held in this data:** the roster response has exactly one `PK` per team (32 of 32), so for kickers "the one roster PK" matched `PK1` on every team. Not guaranteed for the postseason.
- **Unverified:** no cached postseason or late-season data, so how the depth chart looks in January (QB1 after a season-ending injury, or a rested starter in Week 18) is not observed.

### 4. Box score: who appeared in a game

- **Verified (fixture `api/tests/fixtures/box_score_lar_car.json`, a trimmed copy with 4 players):** `playerStats` is a dict keyed by `playerID`. Each value has `longName`, `team`, `teamAbv`, `teamID`, `gameID`, `snapCounts` and only the category blocks the player has (`Passing`, `Rushing`, `Receiving`, `Kicking`, ...). Stafford has `Passing` and `Rushing`; the kickers (Mevis LAR, Fitzgerald CAR) have `Kicking` only.
- **Verified:** there is **no `pos` or position field** in a box score entry. The category present is not a reliable position test: per `docs/rapidapi-tank01.md` the `Kicking` block also carries `kickReturnYds` / `kickReturnTD`, which returners (RB/WR) can have, and a WR passer has a `Passing` block. Hence the join to `NFLPlayer.position` by `playerID` in the recommended approach.
- **Verified:** a player appearing in the dict is the signal that he played (or at least was listed); a backup QB who did not play is absent or has only `snapCounts`. The ingest already skips snap-only entries (`docs/rapidapi-tank01.md`, "Stats schema").
- **Unverified:** a full real box score with both teams' complete `playerStats` (the fixture is trimmed). In particular whether a QB who only took a knee, or a holder, gets an entry; whether a kicker who made no attempts gets a `Kicking` block; and whether an inactive/IR player ever appears. Also not observed: a player who changed teams mid-season in a box score (`team` in the box score is the team in that game, which is the right key for the sum).
- **Unverified:** a punter's block name. Punters (`pos P`) probably use `Punting` (the stats table in `docs/rapidapi-tank01.md` lists `Punting.puntReturnYds`), so should not collide with K scoring, but no punter entry has been observed.

## Unverified items and the calls to verify them

All use `RapidApiClient` with `RAPIDAPI_CACHE_DIR=.rapidapi-cache`; repeats are free. Each is 1 call unless noted.

| # | Question | Call |
| :-- | :-- | :-- |
| 1 | Does the depth chart take a team filter? | `GET /getNFLDepthCharts?teamAbv=KC` |
| 2 | Postseason box score, full `playerStats` for both teams (QB/K appearances, backups, kicker with no attempts) | `GET /getNFLBoxScore?gameID=20260110_LAR@CAR` (the playoff game already trimmed in the fixture) |
| 3 | Same, a game where a backup QB played | `GET /getNFLBoxScore?gameID=<a 2025 or 2026 game with a QB change>` (look one up in `getNFLGamesForWeek` first; that list is already cached for postseason 2025) |
| 4 | Practice squad representation | Inspect the existing cached player list for a known practice-squad QB (no call needed), then `GET /getNFLPlayerInfo?playerID=<that id>` if a flag might exist there |
| 5 | Depth chart behaviour in the postseason | Re-run `GET /getNFLDepthCharts` in January 2027 and diff against this snapshot (cannot be done earlier) |

Calls 1 to 4 total about 4 calls; call 5 is a repeat of the one already used and must wait until the playoffs.

## Risks

- **Depth chart provenance and freshness are unknown** (not official, refresh cadence unknown). Treat it as a hint; re-fetch before the draft and surface the chosen starters to the commissioner for override.
- **Starter flips after the draft.** Drafting a team QB claims the whole position, so a change of QB1 does not change what the owner holds; only the draft pool is affected. Do not re-pick starters for already-drafted teams.
- **Position and team on the player record are current-state only.** A QB traded before a playoff game would be summed under the new team in the box score (`team` in `playerStats`) but the stored `NFLPlayer.team_id` may lag by one daily player sync. Join on the box score `team`, and run the player sync before each round.
- **PK vs K.** Anything that filters on `"K"` finds nothing; use `PK` (and map to K for display). Punters are `P`.
- **Injured reserve players are in the player list but not the roster endpoint**; the depth chart can list them (LAC `QB2`, LAR `PK2`). If they are in the draft pool candidate set, require "listed on the team roster" for the starter only.
- **Duplicate names across teams and free agents** (two Lamar Jacksons): always key on `playerID`, and filter `isFreeAgent != "True"`.
- **Depth chart has no `P` / `LS`**, which is fine here, but means nothing in this source supports a future punter rule.
