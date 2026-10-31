# Step 15: mock draft on phones, then the launch checklist

1 to 2 hours with friends. Issue #95. Needs Steps 1 to 13. [Back to the list](README.md)

## A. Set a pretend playoff field (only before the real playoffs)

A draft only starts when exactly 14 NFL teams are marked as playoff teams. Before January nobody has qualified, so pick any 14 for the test. This writes to the production database once; there is no button or script for it yet:

```bash
psql '<Supabase session pooler URL>' -c "update nfl.nfl_teams set in_playoffs = (team_abv in ('BUF','KC','BAL','HOU','PIT','LAC','DEN','PHI','DET','LAR','TB','GB','MIN','WSH'))"
psql '<Supabase session pooler URL>' -c 'select count(*) from nfl.nfl_teams where in_playoffs'
```

The second line prints `14`. The real field replaces it later: playoff games mark teams automatically, and the coordinator sets the final 14 once the seeds are known.

## B. The mock draft

1. Get 3 or more friends (or 2 plus a second phone). Everyone opens https://postsznfantasy.com and signs in (Google, or magic link).
2. Create a league and send the invite link. Everyone joins.
3. Start a draft with a 30-second pick timer. Pick from different phones.
4. Try these on purpose:
   - Let one timer run out: the auto-pick fires and that person gets a notice.
   - Fill a position up to its cap: those players grey out, and an auto-pick skips that position.
   - Lock one phone for a minute, unlock: it catches up without a reload.
   - Airplane mode on one phone for a few seconds, then off: it says **Reconnecting**, then recovers.
5. After the draft, on each phone: standings, a team page, set a lineup. Nothing is cut off or broken.
6. Check `fly logs --app postszn-api` and Sentry for unexpected errors.
7. Optional rehearsal of live scoring: wait for real games ([Step 16](16-scheduler.md)), or ask the coordinator to run the replay mode (`SCHEDULER_REPLAY_FILE`) on a test copy.
8. Write down every problem and paste the list on #95. The coordinator turns them into issues.

## C. Launch checklist

Tick every box in Stage 8 of [the cutover runbook](../deploy/cutover-runbook.md).

## Verify

- A full mock draft finished on phones with live picks, one auto-pick and one reconnect.
- Stage 8 of the cutover runbook is all ticked.

Then close #95.

## If it goes wrong

- "The draft can't start until the playoff field is set": part A did not print 14.
- "Drafts must start before the first Wild Card kickoff": the real playoffs have started; mock drafts are over for this season.
