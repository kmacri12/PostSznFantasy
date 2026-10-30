# Per-team DST stats from Tank01 box scores (issue 12.3, "DST scoring and return TDs")

Researched 2026-10-30. Primary sources only: 4 real `getNFLBoxScore` responses fetched through `api/utils/rapidapi/rapidapi.py` (plus 1 games-list call, 5 live calls total, quota afterwards 885 remaining), the stored fixtures under `api/tests/fixtures/`, the 32 cached roster responses in `.rapidapi-cache/`, and the repo code. The API key was not printed, logged or written anywhere. Fetched responses landed in `.rapidapi-cache/` (gitignored) so repeats are free.

Games fetched (2025 postseason, `seasonType=post`): `20260110_LAR@CAR`, `20260117_BUF@DEN` (OT), `20260118_LAR@CHI` (OT), `20260208_SEA@NE`. "Verified" below means observed in those responses (call them B1-B4) unless another source is named. Of the 13 postseason games only these 4 were read.

## Answer

**Yes, almost everything per team per game is in one box score response, and the numbers reconcile.** Sacks, interceptions, fumble recoveries, defensive TDs, points allowed and yards allowed are verified. Safeties, blocked kicks, 2-point returns and kick/punt return TDs have a place to live in the payload but **never had a nonzero value in the 4 games read**, so their direction and semantics are Unverified (list and commands at the end).

### Recommended data model: team-as-player row (smallest change)

One synthetic `NFLPlayer` per NFL team (position `DST`, `team_id` set, name like "Rams D/ST", id outside the ESPN range, e.g. `-teamID`) and one `NFLPlayerGameStats` row per team per game with the existing `dst_*` columns filled. No new table.

Why this is the smallest change:

- `NFLPlayerGameStats` already has every column needed: `dst_yards_allowed`, `dst_points_allowed`, `dst_sacks`, `dst_def_td`, `dst_safeties`, `dst_fumbles_recovered`, `dst_interceptions`, `dst_blocked_kicks`, `dst_two_point_returns` (`api/db/models/nfl.py`, game table; the season table lacks the last two, which is fine because DST is scored from game rows).
- `calculate_player_points(...)` already adds `calculate_dst_points` when the position is DST, and `test_defense_scoring_only_applies_to_defenses` already pins the shutout guard.
- Draft picks, roster slots (`roster_slots.py` already has the DEF slot), standings (`services/standings.py` joins `NFLPlayerGameStats` by player id) and the draft pool all key off `nfl_players.id`. A separate table would need parallel code in all of them.
- `PlayerPosition.DST` and `DRAFTABLE_POSITION_VALUES` already exist. Nothing in ingestion creates DST players today (the Tank01 player list has no DST/DEF `pos`; verified from the cached `getNFLPlayerList`, positions: WR, LB, CB, DT, S, RB, TE, DE, OT, QB, G, C, PK, P, LS, FB, OL, DB, DL, KR).

Work needed: (1) seed 32 DST `NFLPlayer` rows (from `NFLTeam`); (2) in `box_scores_ingest.py`, emit two DST stat rows per game from `box["DST"]`, `box["teamStats"]` and `playerStats` using the mapping below; (3) stop crediting return TDs to individuals (see "Return TDs"); (4) keep `NFLGame.dst` raw as a cross-check.

### Key mapping (per team, per game)

`T` is the team, `O` its opponent. `DST.home|away` and `teamStats.home|away` are keyed by side and carry `teamAbv`/`teamID`, so always join on `teamID`, not on side.

| Needed stat | Source key | Status |
| :-- | :-- | :-- |
| sacks | `DST[T].sacks` (equals sum of `Defense.sacks` over T's players in all 8 team-games) | Verified |
| interceptions | `DST[T].defensiveInterceptions` (equals `teamStats[T].defensiveInterceptions` and the player sum) | Verified |
| fumble recoveries | `DST[T].fumblesRecovered`, which equals **O's `teamStats.fumblesLost`**. Do **not** sum players' `Defense.fumblesRecovered`: it also counts a team recovering its own fumble (B2: DEN DST 3, player sum 4; BUF DST 0, player sum 2; B3: LAR DST 0, player sum 2) | Verified |
| defensive TDs (interception/fumble return) | `DST[T].defTD` (equals sum of `Defense.defTD`; B4 SEA = 1, the Nwosu pick-six, `Defense.interceptionTDs` = 1) | Verified for pick-six only; fumble-return TD Unverified |
| safeties | `DST[T].safeties` and `teamStats[T].safeties` (all 0 in B1-B4) | Key verified, direction Unverified |
| blocked kicks | `teamStats[T].blockedPunt`, `blockedFG`, `blockedXP` (B1: CAR `blockedPunt` = 1, others 0) | Key verified, direction Unverified |
| 2-point returns | `teamStats[T].defensiveTwoPointConversionReturns` (all 0) | Key verified, value Unverified |
| kick/punt return TDs | sum of `Kicking.kickReturnTD` + `Punting.puntReturnTD` over T's players (keys present, all "0") | Key verified, nonzero case Unverified |
| special teams + defensive TDs total (check) | `teamStats[T].defensiveOrSpecialTeamsTds` (B4 SEA = 1 = `defTD`) | Verified equals `defTD` when no return TDs; use as a reconciliation check |
| yards allowed | `DST[T].ydsAllowed` (equals `teamStats[O].totalYards` in 8 of 8) | Verified |
| points allowed | `DST[T].ptsAllowed` (see next section; not always O's final score) | Verified, rule decision needed |

Parsing: all values are strings; go through `safe_int` as the existing parsers do. Missing keys resolve to 0.

## Evidence

### 1. Shape of the box score sections

Top-level keys (B1-B4, identical): `DST, Referees, arena, arenaCapacity, attendance, away, awayPts, awayResult, currentPeriod, gameClock, gameDate, gameLocation, gameStatus, gameStatusCode, gameWeek, home, homePts, homeResult, lineScore, network, playerStats, scoringPlays, seasonType, teamIDAway, teamIDHome, teamStats, gameID`.

Note `api/tests/fixtures/box_score_lar_car.json` is a trimmed copy (3 players, no `teamStats`, no `lineScore`); its `DST` is real and matches B1. Fixtures alone cannot answer teamStats questions.

`DST` (B1, LAR is away):

```json
{"away": {"teamAbv": "LAR", "teamID": "19", "defTD": "0", "defensiveInterceptions": "1",
          "sacks": "2", "ydsAllowed": "333", "fumblesRecovered": "1", "ptsAllowed": "31", "safeties": "0"},
 "home": {"teamAbv": "CAR", "teamID": "5", "defTD": "0", "defensiveInterceptions": "1",
          "sacks": "1", "ydsAllowed": "411", "fumblesRecovered": "0", "ptsAllowed": "34", "safeties": "0"}}
```

Exactly these 9 keys per side. There is **no** blocked-kick, return-TD or 2-point-return key in `DST`; those come from `teamStats` and `playerStats`.

`teamStats.home|away` (per side, 35 keys) includes the DST-relevant ones: `totalYards, sacksAndYardsLost ("1-9"), interceptionsThrown, defensiveInterceptions, fumblesLost, safeties, blockedPunt, blockedFG, blockedXP, defensiveOrSpecialTeamsTds, defensiveTwoPointConversionReturns, turnovers, passTD, rushTD, twoPointConversions, snapCounts{totalSpecialTeams,totalOffensive,totalDefensive}`, plus `teamID`, `team`, `teamAbv`.

`lineScore`: `{"period": "Final", "gameClock": "", "away": {"Q1","Q2","Q3","Q4", ("OT"), "teamID", "currentlyInPossession", "totalPts", "teamAbv"}, "home": {...}}`. `period` is `"Final/OT"` for overtime games. Points per quarter only; no TD detail.

`scoringPlays` entries: `{score, scorePeriod, homeScore, awayScore, teamID, scoreDetails, scoreType, scoreTime, team, playerIDs}`. In B1-B4 `scoreType` was only `TD` or `FG` (42 plays). The pick-six in B4 is `scoreType: "TD"`, `score: "Uchenna Nwosu 45 Yd Interception Return (Jason Myers Kick)"`, `playerIDs: [Nwosu, Myers]`, `scoreDetails: "4 plays, 18 yards, 1:08"`. There is no field marking a defensive score except the text. No safety, blocked-kick or return-TD scoring play was observed, so those `scoreType` values and texts are Unverified.

`playerStats` (dict keyed by playerID): categories seen across B1-B4: `Passing, Rushing, Receiving, Defense, Kicking, Punting, snapCounts`. Relevant keys:

- `Defense`: `totalTackles, soloTackles, tfl, qbHits, sacks, passDeflections, forcedFumbles, defensiveInterceptions, defensiveInterceptionsYards, interceptionTDs, defTD, fumbles, fumblesLost, fumblesRecovered`.
- `Kicking` (returners also carry): `kickReturns, kickReturnYds, kickReturnAvg, kickReturnLong, kickReturnTD`, plus `fg*`/`xp*` for kickers.
- `Punting`: `puntReturns, puntReturnYds, puntReturnAvg, puntReturnLong, puntReturnTD`, plus `punts, puntYds, ...`.
- No per-player safety, blocked-kick or 2-point-return key exists in box `playerStats`.

Roster stats (`getNFLTeamRoster?getStats=true`, 32 cached teams) are different and weaker: categories only `Defense, Receiving, Rushing, Passing, Punting, Kicking`; `Punting` keys `puntTouchBacks, punts, puntsin20, puntYds` and `Kicking` keys `fgAttempts, fgMade, fgYds, kickYards, xpAttempts, xpMade` (no return keys at all, no `kickReturnTD`); `Defense` keys include `twoPointConversionReturn` but no safeties or blocks. So DST **cannot** be built from season roster stats; it needs box scores. This matches the `box only` notes in `docs/rapidapi-tank01.md`.

### 2. Points allowed: final score or adjusted?

Observed (B4, `20260208_SEA@NE`, SEA 29, NE 13; SEA scored 5 FGs, one offensive TD with PAT, and the 45-yard interception return TD with PAT):

| Team | Opponent final | `DST.ptsAllowed` | Note |
| :-- | :-- | :-- | :-- |
| SEA | NE 13 | 13 | NE scored no defensive TD |
| NE | SEA 29 | **23** | = 29 - 6, i.e. the pick-six TD (6) removed, its extra point (1) kept |

In B1-B3 `ptsAllowed` equals the opponent's final score exactly (31/34, 33/30, 17/20), and those games had no defensive TD. So Tank01's field is **opponent final score minus 6 per opposing defensive TD**, observed once (a single pick-six). It is Verified that the field is not simply the final score, and Unverified how it treats multiple defensive TDs, fumble-return TDs, return TDs against, safeties, or 2-point returns.

What the common providers do (their own documentation):

- **ESPN** (<https://support.espn.com/hc/en-us/articles/115003847231>): offensive points from pick-sixes or fumble-recovery TDs "will NOT affect your D/ST score" (excluded from points allowed since 2019); "Special Teams points still count against your D/ST score" (a punt return TD against still counts). Safeties against are not addressed on that page.
- **Yahoo** (<https://help.yahoo.com/kb/SLN6441.html>): excluded from points allowed are safeties (any kind), defensive 2-point-conversion returns, and interception, blocked-FG and fumble-return TDs, except fumble-return TDs on kickoffs and punts, which count. Defensive TDs on kickoff and punt returns count against. PATs are not excluded. For kick/punt return TDs, "Public Leagues award 6 points for DEF/ST and individual players" (private leagues vary; Yahoo credits both, which this project's rule does not).

Both providers use the **adjusted** convention (the opponent's pick-six and the like do not count), and Tank01's 23 is the same convention as Yahoo's (the TD's 6 removed, the PAT kept). The product rule in `docs/product-rules.md` section 5 does not say which to use. **Recommendation: use the adjusted number, take Tank01's `DST.ptsAllowed` as is, and add a logged reconciliation** `ptsAllowed == opponentFinal - 6 * opponent.defTD` (flag when it differs; do not fail ingest). If the owner prefers a rule not tied to Tank01's undocumented adjustment, compute it ourselves from `lineScore`/`homePts`/`awayPts` and `Defense.defTD` with that same formula; it matches the one verified case. Final score alone would punish a defense for the pick-six its own offense threw, which neither major provider does.

### 3. Return TDs: where they appear and the individual-scoring bug

- **Per-player keys exist in box `playerStats`**: `Kicking.kickReturnTD` and `Punting.puntReturnTD` (also yards). 14 players had `kickReturnTD` and 5 had `puntReturnTD` keys in B1-B4, all `"0"`. The existing parser maps them to `kick_return_td` and `punt_return_td` (`schemas.py` `STAT_FIELDS`), so the data path exists.
- **Not observed**: any return TD actually scored. So three things stay Unverified: the `scoringPlays` text (assumed to contain "Kickoff Return"/"Punt Return"), whether the same TD also leaks into the returner's `Rushing.rushTD` or `Receiving.recTD` (would double count against the DST), and whether `DST.defTD` / `teamStats.defensiveOrSpecialTeamsTds` include them. The name `defensiveOrSpecialTeamsTds` suggests it includes ST TDs while `DST.defTD` had only the pick-six in the only nonzero sample.
- **Safe derivation** that needs no answer to the last question: team return TDs = sum of `kickReturnTD` + `puntReturnTD` over the team's players; defensive TDs = `DST.defTD`. Check `defTD + returnTDs == teamStats.defensiveOrSpecialTeamsTds` and log when not.
- **Current scorer wrongly credits the returner.** `calculate_special_teams_points` (`api/utils/calculations/fantasy_points_utils.py`) is added in `calculate_player_points` for every position, and `scoring_special_kick_return_td` / `scoring_special_punt_return_td` default to **6** in `api/models/league_models.py` (lines 71 and 73). A returner's TD would score 6 for the individual, contradicting the product rule "Kick and punt return TDs always go to the DST, never to the individual returner". Smallest fix: remove the `_td` terms from the player scorer (keep return yards, default 0), and make the DST row's `dst_def_td` include return TDs or add a `dst_return_td` column scored with `scoring_dst_td`. The `scoring_special_*_td` settings (and their columns/UI) then become dead and should be removed or fixed to 0 and hidden. Since ingest also stores `kick_return_td` on the player row, leave the raw columns (useful for display and for the cross-check) but do not score them.

### 4. What the code models today

- `NFLGame.dst` stores `box["DST"]` raw (JSON) and `team_stats`, `scoring_plays`, `line_score` are stored raw too (`box_scores_ingest.py` `_game_row`); nothing reads `dst`.
- `NFLPlayerGameStats` has the `dst_*` columns; ingest never fills them (comment: "per-player `dst_*` columns stay 0", `docs/rapidapi-tank01.md`). There are no DST `NFLPlayer` rows, so a DST cannot be drafted or rostered yet.
- `calculate_dst_points` exists and is unit tested; it takes blocked kicks and 2-point returns from `dst_blocked_kicks` and `dst_two_point_returns` (default 0 in settings, matching the requirement for optional items).
- ROADMAP.md line 216 already lists "per-team DST stats" as open.

## Unverified items and risks

1. **Safeties**: which team is credited in `DST.safeties`/`teamStats.safeties` (the defense that scored it, presumably) and whether the safety's 2 points are removed from the victim's `ptsAllowed` (Yahoo excludes them). Zero in all 8 team-games.
2. **Blocked kicks**: `teamStats.blockedPunt/blockedFG/blockedXP` direction (B1: CAR = 1, LAR = 0, but a block could be recorded for the blocker or the blocked team). Verify before using; until then default setting 0 means no scoring risk.
3. **Return TDs** (kick, punt): `scoringPlays` text and `scoreType`, whether `Kicking.kickReturnTD`/`Punting.puntReturnTD` are populated (nonzero), whether the TD also appears in `Rushing.rushTD`/`Receiving.recTD`, and whether `DST.defTD` includes them.
4. **Fumble-return TDs and multiple defensive TDs**: only a single interception return was observed; check `Defense.defTD` vs `interceptionTDs` and the `ptsAllowed` adjustment (-6 each?).
5. **Return TDs against and `ptsAllowed`**: whether Tank01 keeps them in (matches ESPN/Yahoo) or removes them.
6. **2-point returns**: `teamStats.defensiveTwoPointConversionReturns` nonzero case.
7. **Live games**: partial `DST`/`teamStats` while in progress was not read (all four games were `Completed`). The scheduler polls these; confirm `DST` is present mid-game and that `ptsAllowed` tracks the live score.
8. **Product rule vs code defaults** (not Tank01-related, found while reading): `docs/product-rules.md` section 5 says points allowed 0 = 7, 1-13 = 5, 14-21 = 3, 22-28 = 1, 29+ = 0 and yards 0-99/100-199/200-299/300+ (= 6/4/2/0). The code uses seven point tiers (0, 1-6, 7-13, 14-20, 21-27, 28-34, 35+; defaults 10/7/4/1/0/-1/-4) and six yard tiers defaulting to 0, and `fumble_recover`/`interception` default to 2, not 1. 12.3 needs to reconcile those, or the scoring will not match the commissioner's spreadsheet.
9. **Synthetic player ids** must not collide with ESPN ids, and a replay export/import must carry the DST rows. A Tank01 team's `teamID` in box (`"19"`) matches `nfl_teams.id`, so the join is direct.

### Calls the owner would need to run to verify the rest

Run from the repo root with the cache on (repeats are free; each box score is 1 request). Never echo the key.

```bash
# 1) List the remaining 2025 postseason games (already cached for post/2025)
RAPIDAPI_CACHE_DIR=$PWD/.rapidapi-cache PYTHONPATH=$PWD api/.venv/bin/python - <<'E'
import asyncio, json
from api.utils.rapidapi.rapidapi import RapidApiClient
async def main():
    c = RapidApiClient()
    ids = [g["gameID"] for g in await c.get_nfl_games_list("2025", "post")]
    out = {i: await c.get_nfl_box_score(i) for i in ids}   # up to 13 calls, 4 already cached
    for i, b in out.items():
        ts, d = b["teamStats"], b["DST"]
        for side in ("home", "away"):
            t = ts[side]
            flags = {k: t[k] for k in ("safeties","blockedPunt","blockedFG","blockedXP",
                     "defensiveOrSpecialTeamsTds","defensiveTwoPointConversionReturns") if t[k] != "0"}
            if flags or d[side]["defTD"] != "0": print(i, side, flags, "defTD", d[side]["defTD"])
        for p in b["scoringPlays"]:
            if p["scoreType"] not in ("TD", "FG") or any(w in p["score"].lower() for w in ("return", "safety", "block")):
                print(i, p["scoreType"], p["team"], p["score"])
    print("remaining", c.requests_remaining)
    await c.aclose()
asyncio.run(main())
E
```

If those 9 extra postseason games show no safety, blocked kick or return TD, widen to the regular season: `get_nfl_games_list("2025", "reg", week="1".."18")` (1 call per week) and fetch box scores only for games where the list or the score hints at it; a return TD or safety game is a few per season. For each hit check: `playerStats[*].Kicking.kickReturnTD` / `Punting.puntReturnTD` nonzero, the matching `scoringPlays` text, that returner's `Rushing.rushTD`/`Receiving.recTD` (double count), both teams' `DST.ptsAllowed` against `homePts`/`awayPts`, and which side `teamStats.safeties`/`blockedPunt` increment. Total cost about 13 to 30 calls, within one day's Pro quota or about 3% of a month's Basic cap. For live behaviour (item 7), call `getNFLBoxScore` once or twice during a live game in January.
