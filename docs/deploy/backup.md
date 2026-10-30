# Weekly keep-alive and encrypted backup

`.github/workflows/backup.yml` runs every Monday at 06:17 UTC (and on demand from the Actions tab). It uses [`scripts/backup-db.sh`](../../scripts/backup-db.sh), which:

1. runs `select ... now()` against the database, so the Supabase Free project never counts as idle (it pauses after a week without activity);
2. `pg_dump`s the `public`, `nfl` and `fantasy` schemas (custom format). That includes user emails and the Alembic revision. Supabase-managed schemas such as `auth` are not included: sign-in accounts live in Supabase and are not restored from this file;
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

The restore runs in one transaction, so a failure leaves the target empty. Point the API at the restored database by changing `PG_URI`; because the dump contains the `alembic_version` row, a later `alembic upgrade head` applies only newer migrations. Users must sign in again through Supabase Auth with the same accounts (their `supabase_uid` values are in the restored `fantasy.users`).

## Tested round trip (local, throwaway key and database)

Done on 2026-10-29 against the compose Postgres 17 with the real scripts:

1. Scratch database `rt_src`: `alembic upgrade head` (3 migrations) plus two `fantasy.users` rows with emails.
2. `scripts/backup-db.sh` with a freshly generated throwaway public key printed `keep-alive ok ...` and wrote a `.dump.gpg` (about 9.9 KB). Searching the file for a user's email found nothing (ciphertext only).
3. `scripts/restore-backup.sh` with the throwaway private key restored into an empty `rt_restore` database and printed `restored, alembic revision 0003`; both databases then showed the same 21 tables and the same two emails.
4. Restoring with a keyring that lacks the key failed with `gpg: decryption failed: No secret key`.

Repeat this yourself after setting up the real key (use any scratch database as the source) before relying on the backups. The host's `pg_dump` must be version 17 for a Postgres 17 server; version 14 refuses, which is why the workflow installs the 17 client.

Not validated: the GitHub-hosted run itself (apt install of the 17 client, secrets, artifact upload) and a connection through the Supabase pooler.
