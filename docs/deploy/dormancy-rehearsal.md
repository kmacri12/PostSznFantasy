# Rehearse shutdown and restore (#113)

Do this once, after the API is live and has real data, and before the first real shutdown. Goal: prove the [shutdown](shutdown-runbook.md) and [wake-up](wake-up-runbook.md) runbooks work as written, and learn how long each part takes. Fix the runbook wherever it was wrong, in the same pull request.

Everything here is **OWNER**: it needs your Supabase, Fly, GitHub and RapidAPI logins. Allow about two hours the first time. It affects production only briefly (part B takes the API down), so pick a quiet day with no draft. Write times down as you go.

## Part A: restore the stored dump into a scratch Supabase project

1. Create a new Free Supabase project named `postszn-restore-test` (Postgres 17; the free plan allows two active projects, so delete an unused one first if needed).
2. Take a fresh dump the way shutdown step 1 does (`gh workflow run backup.yml`, then `gh run download ...`). Use the **stored copy**, not a file still in your downloads, so you prove the storage works. Verify: the run is green. Time: how long it took.
3. Restore into the scratch project's **session pooler** string (port 5432, from its Connect dialog; the direct host is IPv6-only):

```bash
time scripts/restore-backup.sh final-dump/postszn-<timestamp>.dump.gpg '<scratch session pooler string>'
```

4. Compare with production:

```bash
q='select (select count(*) from fantasy.users),
  (select count(*) from fantasy.leagues),
  (select count(*) from nfl.players),
  (select version_num from public.alembic_version)'
for url in '<production pooler>' '<scratch pooler>'; do
  psql "$url" --no-psqlrc -tA -c "$q"
done
```

**Verify:** the restore printed `restored, alembic revision <latest>` and both rows are identical. Note anything that failed: Supabase-specific roles or extensions are the likely trouble; add the fix to [backup.md](backup.md).

5. A deleted league stays deleted. Before the dump, delete one league in the app (or `UPDATE fantasy.leagues SET deleted_at = now() WHERE id = <id>`); after the restore run `psql "$scratch" -tA -c "select id from fantasy.leagues where deleted_at is not null"` and the same id is listed, and `curl` of `/api/leagues/user-leagues` for a member does not include it (#231).
6. Point a throwaway API at it, to prove it starts: `cd api && PG_URI='<scratch string>' SUPABASE_URL='https://<scratch ref>.supabase.co' uv run uvicorn api.main:app --port 8002`, then `curl -s localhost:8002/api` prints `{"status":"healthy"}`.
7. Delete the scratch project when done. Verify: it no longer appears in the dashboard.

## Part B: shutdown and wake-up, end to end

Run the [shutdown runbook](shutdown-runbook.md) steps 1 to 7 for real, but with the Supabase project kept active (Option A) and the Tank01 plan left alone (just read the page; do not cancel). Then run the [wake-up runbook](wake-up-runbook.md) steps 1 to 6 and the scheduler step as a dry read. Keep it to the same day; the dormant window itself needs no waiting for.

**Verify:** each runbook step's own Verify line passed, and the dark time (API down to API back) is written down below.

## Timing table (fill in)

Minutes, with notes:

- Fresh dump (workflow):
- Download and store the dump:
- Restore into the scratch project:
- Shutdown, scheduler off and machine stopped:
- Shutdown, dormant page verified:
- Wake, machine started and health green:
- Wake, Deploy API with the new SEASON_YEAR:
- Wake, seed NFL data:
- Wake, smoke test (mock draft):
- **Total dark time (API down to API back):**

## Done when

- [ ] The restore worked from the **stored** dump into a scratch Supabase project, and the counts matched.
- [ ] A league deleted before the dump is still deleted after the restore.
- [ ] Shutdown and wake-up ran end to end once, and `scripts/dormancy-check.sh dormant` / `awake` passed at the right moments.
- [ ] The timing table above is filled in and committed.
- [ ] Every place a runbook was wrong is fixed.
