# Weekly keep-alive and encrypted backup

`.github/workflows/backup.yml` runs every Monday at 06:17 UTC (and on demand from the Actions tab). It uses [`scripts/backup-db.sh`](../../scripts/backup-db.sh), which:

1. runs `select ... now()` against the database, so the Supabase Free project never counts as idle (it pauses after a week without activity);
2. `pg_dump`s the `public`, `nfl` and `fantasy` schemas (custom format). That includes user emails and the Alembic revision. Supabase-managed schemas such as `auth` are deliberately not included (no password hashes or tokens in the file), so sign-in accounts are not restored by it; they are recreated from `fantasy.users` afterwards, see [Recreating sign-in accounts](#recreating-sign-in-accounts);
3. encrypts the dump with a **public** gpg key, so the workflow can write backups but can never read them;
4. uploads `postszn-<UTC timestamp>.dump.gpg` as a workflow artifact, kept 90 days (the GitHub maximum). Artifacts are visible only to people with access to the repository. The final shutdown dump (#111) must be kept somewhere else.

The workflow does not depend on the API, so it also covers a window where the backend is down. If a run fails, GitHub emails the person who last edited the workflow; also glance at the Actions tab weekly during the season. **A public repository's scheduled workflows are switched off after 60 days without repository activity**, which would silently stop the keep-alive: re-enable it from the Actions tab if that ever shows.

## One-time setup

Generate the key pair on your own machine (not in CI, not in chat):

```bash
gpg --quick-generate-key "postszn-backup <you@example.com>" default default 2y
gpg --armor --export postszn-backup > postszn-backup-public.asc      # safe to share
gpg --armor --export-secret-keys postszn-backup > postszn-backup-private.asc
```

- Store `postszn-backup-private.asc` and its passphrase in your password manager (and one offline copy). **Without it every backup is unreadable. Never commit it or put it in GitHub.**
- Add the repository secrets (Settings, Secrets and variables, Actions): `BACKUP_GPG_PUBLIC_KEY` = the contents of `postszn-backup-public.asc`, and `PROD_DATABASE_URL` = the Supabase **session pooler** string (port 5432; the direct host is IPv6-only and GitHub runners cannot reach it). `gh secret set BACKUP_GPG_PUBLIC_KEY < postszn-backup-public.asc` avoids pasting.
- Run the workflow once by hand and confirm an artifact appears.
- Key expiry (2 years above) means you must extend or rotate it; set a reminder.

## Restore

Needs `gpg` with the private key imported (`gpg --import postszn-backup-private.asc`) and PostgreSQL 17 client tools. Download the artifact from the workflow run (it is a zip around the `.dump.gpg`), then:

```bash
# 1. Make an EMPTY target database (local, or a fresh Supabase project)
createdb -h localhost -p 5433 -U postgres restore_check

# 2. Decrypt and restore (gpg asks for the key passphrase)
scripts/restore-backup.sh postszn-<timestamp>.dump.gpg \
  postgresql://postgres:postgres@localhost:5433/restore_check
# prints: restored, alembic revision <n>
```

The restore runs in one transaction, so a failure leaves the target empty. Point the API at the restored database by changing `PG_URI`; because the dump contains the `alembic_version` row, a later `alembic upgrade head` applies only newer migrations. Against the **same** Supabase project nothing more is needed: users sign in with the same accounts and their `supabase_uid` values match the restored `fantasy.users`. Against a **new** project, recreate the accounts first (next section).

Deleted leagues are ordinary rows with `fantasy.leagues.deleted_at` set, so a dump contains them and a restore keeps them deleted. To bring one back afterwards, see [Restore a deleted league](../owner/league-restore.md) (`python -m api.scripts.restore_league <id>`).

## Recreating sign-in accounts

Decision (#215): keep the Supabase project active all off-season (the weekly keep-alive above), and treat a lost project as a recovery: `api/scripts/recreate_auth_users.py` reads `fantasy.users` from the restored database and creates each user in the new project through the Auth admin API with the **same id** and a confirmed email. Why this and not the alternatives is in [the research note](../research/supabase-auth-backup.md): no password hashes ever enter a backup, nothing changes in the sign-in path, and linking by email in the app (which would risk account takeover) is not used.

- Needs the new project's `service_role` key in `SUPABASE_SERVICE_ROLE_KEY` (environment only; never a Fly or GitHub secret, never an argument). It defaults to a dry run; `--apply` creates users and can be run twice (existing users count as "already present").
- Users with no stored email are skipped and listed; they sign up again.
- Google sign-in links to the recreated user through the confirmed email (Supabase links identities by verified email); not yet confirmed on a real project, so check it with your own account right after the first real use.
- **Rehearsal, no production needed:** `make rehearse-auth-restore` (local database, `make db-up migrate`) runs the whole flow twice against a fake Auth server and prints `created N, already present 0, failed 0`, then the second run's count. To also rehearse the restore, restore a dump into a scratch database as above and run `PG_URI=postgresql://...scratch python -m api.scripts.recreate_auth_users`.

## Tested round trip (local, throwaway key and database)

Done on 2026-10-29 against the compose Postgres 17 with the real scripts:

1. Scratch database `rt_src`: `alembic upgrade head` (3 migrations) plus two `fantasy.users` rows with emails.
2. `scripts/backup-db.sh` with a freshly generated throwaway public key printed `keep-alive ok ...` and wrote a `.dump.gpg` (about 9.9 KB). Searching the file for a user's email found nothing (ciphertext only).
3. `scripts/restore-backup.sh` with the throwaway private key restored into an empty `rt_restore` database and printed `restored, alembic revision 0003`; both databases then showed the same 21 tables and the same two emails.
4. Restoring with a keyring that lacks the key failed with `gpg: decryption failed: No secret key`.

Repeat this yourself after setting up the real key (use any scratch database as the source) before relying on the backups. The host's `pg_dump` must be version 17 for a Postgres 17 server; version 14 refuses, which is why the workflow installs the 17 client.

Not validated: the GitHub-hosted run itself (apt install of the 17 client, secrets, artifact upload) and a connection through the Supabase pooler.
