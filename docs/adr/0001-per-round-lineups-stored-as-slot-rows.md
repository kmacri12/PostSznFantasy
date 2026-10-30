# Lineups are stored per team and round as slot rows; eliminated, bye and lock are derived

A lineup is a set of `lineup_slots` rows `(team, round, player, slot index)`; no row means unplaced, and a round nobody touched has no rows. Nothing is written when a round starts or ends, and nothing is copied between rounds.

Eliminated, bye and lock are never stored. They are computed on read from the game table: a player is eliminated for round N once their NFL team lost a completed game in an earlier round, on a bye when the team is alive with no game in a scheduled Wild Card round (the only round with byes), and locked once `now >= scheduled kickoff` of their game that round.

**Why this is surprising:** the obvious design is a persistent lineup that gets copied, with `is_active` flipping on elimination. We rejected it because the rules forbid carry-forward and auto-substitution, a stat or schedule correction must reflow every round, and early-placed players "drop out" of a slot when their team loses; deriving makes that last case a read-time filter with no job to run. The cost: every lineup read loads the postseason games (at most 13 rows), and a stale row of an eliminated player can sit in the table until the next write for that round, which removes it.

**Consequences:** standings count only players with a starter-slot row for that round (no auto-fill, so an owner who never sets a lineup scores 0). Commissioner override (Epic 14) can bypass the lock check by calling `move_player` with an empty `locked` set; there is no separate "locked" column to keep consistent.
