# Raw Tank01 response samples

Full, unedited responses (the `{"statusCode", "body"}` wrapper as Tank01 sent it) kept as
developer reference. `api/tests/fixtures/` is for tests; this folder is for reading. Check
this index **before spending an API call**, and add a row for every new sample. No API key,
headers or request URLs are stored here.

Rule for every agent: when you call Tank01 to answer a question, save the full raw response
here (trim only huge lists and say so in the row and in a top-level `_trimmed` key), add a
row below, and mention the file in the doc that records the answer.

| File | Endpoint | Params | Fetched | Game / player | Answers |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `box_20260125_NE-DEN_playbyplay.json` | `getNFLBoxScore` | `gameID=20260125_NE@DEN`, `playByPlay=true` | 2026-10-31 | AFC Championship | `allPlayByPlay` (missed FG distances in `playerStats.<kicker>.Kicking.fgYds`; a BLOCKED FG; punts); `teamStats.blockedFG` credited to the blocking team (NE); `Kicking.fgMissed` 2/2 |
| `box_20260110_GB-CHI.json` | `getNFLBoxScore` | `gameID=20260110_GB@CHI` | 2026-10-31 | Wild Card | missed XP (`Kicking.xpMissed` 1 for McManus); a successful 2-point conversion in `scoringPlays` and `teamStats.twoPointConversions`; 2 missed FGs |
| `box_20260112_HOU-PIT.json` | `getNFLBoxScore` | `gameID=20260112_HOU@PIT` | 2026-10-31 | Wild Card | two defensive TDs (fumble return, interception return): `DST.defTD` 2, `defensiveOrSpecialTeamsTds` 2; `ptsAllowed` minus 6 per `defTD` |
| `box_20260117_SF-SEA.json` | `getNFLBoxScore` | `gameID=20260117_SF@SEA` | 2026-10-31 | Divisional | kickoff-return TD (Shaheed): `Kicking.kickReturnTD`, `scoringPlays` "Kickoff Return", `defensiveOrSpecialTeamsTds` 1 while `DST.defTD` 0; Tank01 `ptsAllowed` (41) does not subtract it |
| `box_20260110_LAR-CAR.json` | `getNFLBoxScore` | `gameID=20260110_LAR@CAR` | 2026-10-30 | Wild Card | blocked punt (`teamStats.blockedPunt` 1 for CAR); full `DST`, `teamStats`, `lineScore` shapes |
| `box_20260208_SEA-NE.json` | `getNFLBoxScore` | `gameID=20260208_SEA@NE` | 2026-10-30 | Super Bowl | pick-six in `scoringPlays` (`playerIDs` order differs from offensive TDs); a failed 2-point conversion |
| `player_list_trimmed.json` | `getNFLPlayerList` | none | 2026-10-30 | 20 of 3833 players (trimmed; `_trimmed` key) | official `pos` (`PK` kickers, `QB`), `injury` shape; full list is ~4 MB |
| `depth_charts.json` | `getNFLDepthCharts` | none | 2026-10-30 | all teams | `QB1` / `PK1` starters per team |
| `roster_CAR_with_stats.json` | `getNFLTeamRoster` | `teamID`, `teamAbv=CAR`, `getStats=true` | 2026-10-29 | Carolina | season stat categories and keys (no return keys, no `fgMissed`) |
| `games_post_2025.json` | `getNFLGamesForWeek` | `week=all`, `seasonType=post`, `season=2025` | 2026-10-30 | 13 playoff games | game ids, `gameWeek`, `gameTime_epoch`, `espnLink`, `gameStatus` `Final` |
| `teams.json` | `getNFLTeams` | none | 2026-10-29 | all 32 teams | team ids and abbreviations |
