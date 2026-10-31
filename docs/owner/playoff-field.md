# Set the playoff field

About 5 minutes, twice. Issue #214. Needs Steps 6 and 13. [Back to the list](README.md)

A draft only starts when exactly 14 NFL teams are in the playoff field, and only their players can be drafted. Loading playoff games marks the 12 Wild Card teams by itself. The two top seeds have a bye, so they never show up that weekend: **you always set the full 14 yourself.**

When:
- **Mock draft** ([Step 15](15-mock-draft.md)): any 14 teams, before January.
- **For real**: the night the regular season ends, once the 14 seeds are known, before anyone drafts.

## Steps

1. Check no draft is live (a new field changes who can be drafted):
   ```bash
   DATABASE_URL='<Supabase session pooler URL>' scripts/check-live-drafts.sh
   ```
2. Write down the 14 teams' abbreviations (7 AFC, 7 NFC, from any site's final playoff picture). The app uses these spellings:
   - `KC` (not KAN), `WSH` (not WAS), `JAX`, `LV`, `LAC`, `LAR`, `NE`, `NO`, `NYG`, `NYJ`, `SF`, `TB`, `GB`
   - the rest are the usual three letters, like `BUF`, `BAL`, `PHI`, `DET`
   - lower case is fine
3. Run this, with your 14 teams instead of these:
   ```bash
   fly ssh console --app postszn-api -C "python -m api.scripts.set_playoff_field BUF KC BAL HOU PIT LAC DEN PHI DET LAR TB GB MIN WSH"
   ```

Every run replaces the whole field, so a mistake is fixed by running it again with the right 14.

## Verify

1. The last line of the output contains `Playoff field set (14 teams):` followed by your 14 teams with their full names. (The lines are JSON; read the `message` part.)
2. On https://postsznfantasy.com, open a league's draft page: the yellow notice "The draft can't start until all 14 playoff teams are set" is gone.

## If it goes wrong

Each of these means **nothing was changed**. Fix the list and run it again.

- `Playoff field not changed: Unknown team abbreviations: KAN. Known: ARI, ATL, ...`: use the spelling from the `Known` list.
- `Playoff field not changed: The playoff field has exactly 14 teams, got 13`: a team is missing or listed twice.
- `No NFL teams are loaded`: do [Step 13](13-load-data-admin.md) first.
- `usage: set_playoff_field.py ...`: the team list is missing; check the quotes in step 3.
- `No module named 'api'` or `No module named api.scripts.set_playoff_field`: the API running is older than this script. Redeploy it (Step 6), then run step 3 again.

If a draft has already started, ask the coordinator before changing the field. If `fly ssh console` itself fails, paste the error (never a secret) to the coordinator.
