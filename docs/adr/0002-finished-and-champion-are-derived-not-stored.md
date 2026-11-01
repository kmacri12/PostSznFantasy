# A league is finished, and its champion crowned, by derivation on read

A league counts as finished when its season's Super Bowl is final, and the champion is whoever ranks first in the live standings; neither is stored as a flag or a row.

We considered a `completed_at` / `champion_team_id` written when the last game goes final. It would freeze the result, but it adds a second source of truth that a late stat correction or an admin game override can contradict, and a missed write would leave a league editable forever. Deriving keeps the recap, the archive guard and the standings in agreement by construction.

The cost is that a stat correction after the final can still change the champion, and each write to a league checks the games once. We accept both: corrections are rare and visible in the activity feed, and the check is one small query. Nothing about a season ending is stored: that the next season exists is a fact about what a commissioner did, and it is a row in `seasons`.
