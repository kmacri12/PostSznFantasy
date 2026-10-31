# Kicker per-yard scoring from Tank01 (issue 12.2)

> Update 2026-10-31 (issue #77): missed-FG distances **are** obtainable, from `getNFLBoxScore?playByPlay=true` (`allPlayByPlay`); see docs/rapidapi-tank01.md. The "not obtainable" statements below predate that.

Researched 2026-10-30. Two live calls were made through `RapidApiClient` with `RAPIDAPI_CACHE_DIR` set (`getNFLGamesForPlayer` for Harrison Mevis, `getNFLBoxScore` for `20251218_LAR@SEA`; the `x-ratelimit-requests-remaining` reading was 884 after the first and 883 after the second). Everything else came from the repo fixtures and the git-ignored `.rapidapi-cache/`, which held the 2025 playoff games list and four 2025 playoff box scores when I read it (the first of my calls was a cache hit and spent nothing, so I did not fetch them). The key was not printed or written anywhere.

Labels: **Verified** = observed in a real response (source named). **Unverified** = not observed; the calls to settle it are in [Unverified](#unverified-and-risks).

Sources used below: `BOX:CAR` / `BOX:CHI` / `BOX:DEN` / `BOX:SEA` / `BOX:SB` are the cached box scores `20260110_LAR@CAR`, `20260118_LAR@CHI`, `20260117_BUF@DEN`, `20251218_LAR@SEA` (live call) and `20260208_SEA@NE`; `GFP` is the live `getNFLGamesForPlayer` response (`playerID=4574716&season=2025&numberOfGames=30`, 14 games); `ROSTER` is the 32 cached `getNFLTeamRoster` responses (current 2026 regular season); `FIXTURE` is `api/tests/fixtures/box_score_lar_car.json`.

## Answer

Yes, the rule is scoreable per game from Tank01, using data the box score ingest already reads. Recommended derivation for each kicker's game line:

| Component | Derivation | Source |
| :-- | :-- | :-- |
| Made-FG yards | every `scoringPlays` entry with `scoreType == "FG"`; kicker = `playerIDs[0]`; distance = `(\d+) Yd Field Goal` in `score`; points = 0.1 x sum of distances | already `field_goal_yards_by_kicker` |
| Extra points made | `Kicking.xpMade` | already `kicking_xp_made` |
| Missed FG | `Kicking.fgMissed` when present, else `fgAttempts - fgMade` | already `kicking_fg_missed` |
| Missed XP | `Kicking.xpMissed` when present, else `xpAttempts - xpMade` | already `kicking_xp_missed` |

Flat means: set `scoring_kicking_fg_yard = 0.1`, `scoring_kicking_xp_made = 1`, `scoring_kicking_fg_miss = -1`, `scoring_kicking_xp_miss = -1`, `scoring_kicking_fg_made = 0`, and all six `*_0_19 ... *_50_plus` tiers 0. The existing `calculate_kicking_points` in `api/utils/calculations/fantasy_points_utils.py` already computes exactly this for a per-game row, so 12.2 is mostly defaults and tests, not new parsing.

Things to do:

1. **Per-game scoring needs no new endpoint.** The box score gives all four inputs, one call per game, which the postseason loop already spends.
2. **Do not score kickers from season rows.** Season rows have no distances (`fgYds` is `"0.0"` or `"0"` for all 32 kickers, see 4) and no `fgMissed`/`xpMissed`, so a per-yard rule gives 0 for every season FG. Keep season-based kicker points unsupported (or hide them) rather than wrong.
3. **Backfill past seasons with `getNFLGamesForPlayer`** (one call returns many games per kicker, each with its own `scoringPlays`), not with box scores. Two caveats there: it has no `fgMissed`/`xpMissed` keys, and the 2025 response was incomplete (see 5).
4. **Sanity-check each kicker game** and log a warning (do not silently score) when `len(made yards) != fgMade` or `max(yards) != fgLong`. Both held in every kicker game I checked (10 box-score and 14 GFP games), so a mismatch means a parser or upstream problem.
5. **Missed-FG distance is not obtainable.** `kicking_fg_yards_missed` is never written (see 4) and no distance exists upstream (see 3). That does not matter for a flat -1 per miss, but the tiered miss penalties in `LeagueSettings` cannot work from Tank01 data.

## Evidence

### 1. Box score `Kicking` keys (per player)

- **Verified (BOX:CAR, BOX:CHI, BOX:DEN, BOX:SB, BOX:SEA):** a kicker's `playerStats[playerID]` is `{gameID, teamID, snapCounts, team, teamAbv, playerID, longName, Kicking}`. The `Kicking` block has exactly these keys for all 10 kicker-games observed in the five box scores: `fgLong, fgMade, fgAttempts, fgPct, xpMade, xpAttempts, kickingPts, fgMissed, xpMissed`.
- **Verified:** every value is a **string**, including integers (`"2"`) and the percentage (`"100.0"`). Season rows use floats-as-strings (`"14.0"`). `safe_int` (via `float`) handles both.
- **Verified:** there is **no FG distance key** in `Kicking`: only `fgLong` (the longest made kick) exists. Also no `fgYds` or list of kicks.
- **Verified:** `fgLong` is `"0"` when no FG was made (Andy Borregales in BOX:SB).
- **Verified:** non-kickers also carry a `Kicking` block, holding only return stats (`kickReturns, kickReturnTD, kickReturnYds, kickReturnAvg, kickReturnLong`), 14 such blocks across the four box scores. They contain no `fg*`/`xp*` keys. That is why `kick_return_*` is read from `Kicking` and why the kicker test must look for `fgMade`/`xpMade`, not for the presence of a `Kicking` block.
- **Verified:** `playerStats` entries have no `pos` field in a box score (`BOX:SB`, `BOX:CAR`), so identifying a kicker needs the `NFLPlayer.position` join (see 6).

### 2. Can made-FG distances be derived?

- **Verified (all five box scores and GFP):** yes, from `scoringPlays`. A FG entry is `{"score": "Harrison Mevis 46 Yd Field Goal", "scoreType": "FG", "scorePeriod", "scoreTime", "team", "playerIDs": ["4574716"], ...}`. `playerIDs` has exactly one element on every FG play seen (18 FG plays in the four playoff box scores, plus the GFP plays).
- **Verified:** reconciliation holds everywhere I checked. In the 10 box score kicker-games and in all 14 `GFP` games, the count of parsed FG plays equals `fgMade`, and `max(distance)` equals `fgLong`. Examples: `BOX:SB` Jason Myers 33, 39, 41, 41, 26 against `fgMade 5`, `fgLong 41`; `BOX:DEN` (overtime) Wil Lutz 28, 50, 33, 23 against `fgMade 4`, `fgLong 50`, with the OT field goal listed as `scorePeriod "OT"`.
- **Verified:** the `score` text has trailing whitespace on some plays (`"Wil Lutz 50 Yd Field Goal "`), which the current regex `(\d+) Yd Field Goal` handles because it only searches.
- **Verified:** matching is by player id, not name, so the name and tie concerns do not arise for FGs. The FG `playerIDs` has the kicker only. Note the `playerIDs` order is not consistent on TD plays: on a defensive TD (`BOX:SB`, "Uchenna Nwosu 45 Yd Interception Return (Jason Myers Kick)") the kicker's id is **first**, whereas on offensive TDs it is last. So never read the kicker from `playerIDs` of a TD play.
- **Verified:** XP counts do not come from `scoringPlays` and need not (use `xpMade`). A two-point attempt is not counted as an extra-point attempt: `BOX:SB` has "Rhamondre Stevenson 7 Yd pass from Drake Maye (Two-Point Pass Conversion Failed)" with `scoreType "TD"` and NE's kicker shows `xpAttempts "1"` against two NE TDs.
- **Verified, negative:** no box score key holds play-by-play. The top-level keys are `DST, Referees, arena, arenaCapacity, attendance, away, awayPts, awayResult, currentPeriod, gameClock, gameDate, gameID, gameLocation, gameStatus, gameStatusCode, gameWeek, home, homePts, homeResult, lineScore, network, playerStats, scoringPlays, seasonType, teamIDAway, teamIDHome, teamStats` (`BOX:SB`). `scoringPlays` only lists scoring plays, so a missed or blocked FG never appears (see 3).
- **Unverified:** a FG nullified by penalty, a blocked FG returned for a TD, and a FG by a non-kicker. `scoringPlays` for those cases was not observed (none in the sample).

### 3. How misses are derived

- **Verified (BOX:SEA, live call):** a box score does carry `fgMissed` and `xpMissed` as strings, and they are non-zero when relevant. Harrison Mevis in `20251218_LAR@SEA`: `{"fgLong":"41","fgMade":"3","fgAttempts":"4","xpMade":"4","fgPct":"75.0","kickingPts":"13","xpAttempts":"4","fgMissed":"1","xpMissed":"0"}` (so `fgAttempts - fgMade == fgMissed`). Its `scoringPlays` lists only the three made FGs (23, 28, 41), so the missed kick's distance is **not** anywhere in the response.
- **Verified, negative:** no `FGYardsMissed`, `fgYardsMissed` or similar key exists in any `Kicking` block, any box score, GFP, or ROSTER. The ROADMAP Phase 13 note that `kicking_fg_yards_missed` "is read from RapidAPI key `FGYardsMissed`" is not true of the code (`grep` finds no read of it) or of the data.
- **Verified:** `fgMissed`/`xpMissed` are **absent** from `getNFLGamesForPlayer` (GFP `Kicking` keys: `fgAttempts, fgLong, fgMade, fgPct, kickingPts, xpAttempts, xpMade`) and from season roster rows (`fgAttempts, fgMade, fgYds, kickYards, xpAttempts, xpMade`). Derive as attempts minus made there; `_missed` in `schemas.py` already falls back this way. Evidence the arithmetic is right: GFP `20251218_LAR@SEA` has `fgAttempts "4"`, `fgMade "3"`, and BOX:SEA's `fgMissed "1"` is the same game.
- **Verified:** `xpMissed` was `"0"` in every observed game, so a non-zero `xpMissed` was never seen. The derivation `xpAttempts - xpMade` is consistent with the keys but unproven for a real miss (see Unverified).

### 4. What the code stores today

| Column | Written by | Accurate? |
| :-- | :-- | :-- |
| `nfl_player_game_stats.kicking_fg_made`, `kicking_xp_made` | `Kicking.fgMade`, `.xpMade` | Yes (matches box) |
| `kicking_fg_missed`, `kicking_xp_missed` | `fgMissed`/`xpMissed`, else attempts minus made | Yes for box rows; derived for others |
| `nfl_player_game_stats.kicking_fg_yards_made` | `field_goal_yards_by_kicker(scoringPlays)` in `parse_game_player_stats` | **Yes**: fixture test asserts `[46, 42]` for Mevis; matches all 10 box-score kicker-games and 14 GFP games checked here |
| `nfl_player_game_stats.kicking_fg_yards_missed` | **nothing** | Always `[]`. The column and the six `scoring_kicking_fg_miss_*` tier settings are dead for Tank01 data |
| `nfl_player_season_stats.kicking_fg_yards_made` | **nothing** (`parse_player_season_stats` does not set it) | Always `[]`, so season kicker points get only the flat `scoring_kicking_fg_made` and none of the per-yard rule |
| `nfl_player_season_stats.kicking_fg_made`, `xp_made` | roster `Kicking.fgMade`, `.xpMade` | Yes, but see below |

- **Verified (ROSTER, 32 kickers):** `fgYds` is `"0.0"` for 30 kickers and `"0"` for the two with no attempts (Zane Gonzalez, Brandon McManus); `kickYards` is also always zero. So `fgYds` is a dead key. Do not trust it for anything. `fgLong`, `fgMissed` and `xpMissed` do not exist in season rows either (`fgLong` was `None` for all 32).
- **Verified (code):** the per-yard rule is already in `calculate_kicking_points` (`Decimal(yards) * per_yard`), and when `kicking_fg_yards_made` has fewer entries than `kicking_fg_made` the remainder gets only the flat rate. With the flat rate at 0, any missing distance silently scores 0, so the length check in "Answer" item 4 matters.

### 5. `getNFLGamesForPlayer`

- **Verified (GFP):** params `playerID`, `season`, `numberOfGames` are accepted. The body is a dict keyed by `gameID` (not a list), newest first, here 14 entries ending with two preseason games.
- **Verified:** each per-game entry has keys `Kicking, gameID, longName, playerID, scoringPlays, snapCounts, team, teamAbv, teamID`, i.e. the same nested `Kicking` shape as a box score `playerStats` entry (strings, same names) **minus** `fgMissed`/`xpMissed`. `scoringPlays` is filtered to plays that involve this player (Mevis's include both his FGs and the TDs whose XP he kicked), in the same shape as box score `scoringPlays`.
- **Verified:** it works as a distance source: for every game, the FG distances parsed from its `scoringPlays` matched `fgMade` (14/14 games, 10 of them with made FGs, including `20250809_NYJ@GB` 22, 27, 39 against `fgMade "3"`).
- **Verified:** coverage is incomplete. I asked for 30 games and got 14: the response held only 8 regular-season LAR games (`20251109` through `20260104`; nothing earlier than 2025-11-09 except two preseason games), where a season has 17. The two preseason games are included, and so are the four 2025 playoff games. So a backfill must be checked against the games list before it is trusted. Not checked against a full 17-game schedule, so which games are missing and why is **Unverified**.
- **Quota:** **Verified** that a `getNFLBoxScore` call lowers `x-ratelimit-requests-remaining` by 1 (884 to 883). The `getNFLGamesForPlayer` call's own cost was **not** measured separately (my first reading came after it), so "1 request per call" is **Unverified** for it. If it is 1, one call gives up to a whole season for one player where a box score gives one game for all players, so per-kicker backfill is cheaper than box scores for a few kickers (about 32 calls for every team's kicker) and far more expensive for "all players in a game".

### 6. Team K with a backup covering

- **Verified (BOX:*):** the keys are identical for every kicker regardless of which one it is, and in each game each team has at most one `Kicking` block with `fgMade`. In all five box scores each team's kickers-with-stats were exactly one, so a backup K playing was **not observed**.
- **Verified:** per-game rows are keyed `(game_id, player_id)`, so summing across K-position players on one NFL team is a straightforward group-by on `NFLPlayer.team_id` plus `position`. No key differences between players would complicate that.
- **Verified (ROSTER, the sibling note `docs/research/team-qb-k-starter-source.md`):** the position is `"PK"`, not `"K"`, and the box score has no `pos`; `api/models/enums.py` normalises `PK` to `K`. So the join to `NFLPlayer.position` is required and must treat `PK` as K.
- **Unverified:** a game where two kickers of one team both have a populated `Kicking` block with `fgMade`. A non-K who kicks (a punter or the QB on a fake) would show up in `Kicking` and be excluded by the position filter, which is the intended behaviour.

## Unverified and risks

| Item | Why it matters | Call that would settle it |
| :-- | :-- | :-- |
| A real non-zero `xpMissed` (or a missed XP) | `xpMissed` was `"0"` in all 10 observed box-score kicker-games (the GFP and season rows have no such key); derived `xpAttempts - xpMade` is unproven for a real miss | `getNFLBoxScore` for a game with a missed or blocked PAT. Find one with `getNFLGamesForPlayer` for a kicker known to have missed (look for `xpAttempts` > `xpMade` in the response), then fetch that game's box score. Mevis has none in his 14 games. |
| Blocked FG, FG nullified by penalty, FG returned for a TD | Whether it counts in `fgAttempts` / `fgMissed`, and whether it appears in `scoringPlays` | Same approach with a game containing a blocked FG; compare `fgAttempts - fgMade` with `fgMissed` and the `scoringPlays` text |
| Two kickers on one team in a single game | Team K summing across a backup | `getNFLBoxScore` for a game after an in-game kicker injury; check two `Kicking` blocks with `fgMade` on one `teamAbv` |
| Which Mevis 2025 regular-season games `getNFLGamesForPlayer` omits and why | Backfill completeness (a missing game is a missing score) | `getNFLGamesForPlayer playerID=4574716 season=2025 numberOfGames=60`, then compare with `getNFLGamesForWeek season=2025 seasonType=reg` for `LAR` |
| Cost of one `getNFLGamesForPlayer` call | Backfill budget | Read `x-ratelimit-requests-remaining` before and after a single call |
| Whether `fgMissed`/`xpMissed` exist in box scores during a **live** game | The live poll reads partial lines | `getNFLBoxScore` during an in-progress game; check the `Kicking` keys |
| Whether `scoringPlays` order and text stay stable for FGs with trailing text (for example "Yd Field Goal (blocked...)") | Regex is `(\d+) Yd Field Goal` | Scan the next full season of cached `scoringPlays` for `scoreType == "FG"` entries whose `score` does not match the regex |

Risks:

- **No upstream distance for a missed FG**, so tiered miss penalties are impossible; the flat -1 rule is fine.
- **Silent zero**: with `scoring_kicking_fg_made = 0` a made FG with a missing distance scores 0. Mitigate with the length check, and log the box.
- **Mid-game partial data**: a live poll can show `fgMade` before the matching `scoringPlays` entry (not observed; Unverified). The length check will fire during that window, so warn at debug level only for live games.
- **Source inconsistency**: `getNFLGamesForPlayer` omitted games and has no miss keys. It is a backfill aid, not a second source of truth for in-season scoring.
- **Season-row kicker points** (player directory, draft pool sort) will undercount under this rule until distances exist there. Either hide the season total for kickers or compute it from the sum of game rows.
