Fixes #121

## What changed
Standings are now written: `api/services/standings.py` recomputes `fantasy.standings` (rank, players left, per-round points, total) for every league of the season whose draft is complete (an unfinished draft has no table, and writing one would row-lock teams that people are joining).

- **Scoring**: starters only (the slot layout the team page shows, bench excluded), `calculate_player_points` × the league's round multiplier, grouped by postseason round. Ranked by total, then players left; teams level on both share a rank.
- **When**: after `eliminate_losing_teams` in the poll/reconcile cycle, and after the admin game-result, eliminate-teams, box-score and update-all (with box scores) endpoints. Also when a draft completes (a zero-point table, so the page isn't blank); undoing the final pick removes the table.
- **Concurrency**: a per-league advisory lock serializes the poll cycle against draft completion.
- **Failure**: each league is recomputed in a savepoint inside the caller's transaction; one that raises is logged and keeps its last good rows, never zeros.
- Migration 0004 makes the round-point columns `DECIMAL(10,2)` (they were integers, which truncated fractional points). The standings route returns them as floats.
- Removes the dead `get_team_fantasy_points_by_week` (read `Lineup` rows nothing writes).
- e2e: removed the `test.fixme` and `seed_e2e_standings.py`; the replay suite now asserts players left dropping and points accruing as games finish.

## Not covered
Roster changes after the draft (add/drop, lineup moves) don't trigger a recompute; the next poll or admin action does.
