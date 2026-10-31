# Step 11: weekly encrypted backup

About 40 minutes. Issue #107. Needs Step 4 (the GitHub secret `PROD_DATABASE_URL`). [Back to the list](README.md)

Every Monday a GitHub job copies the production database, encrypts it with a key only you hold, and keeps it for 90 days. It also stops the free Supabase project from pausing. Details: [docs/deploy/backup.md](../deploy/backup.md).

## A. Make the encryption key (in your home folder, never in the project)

```bash
cd ~
gpg --quick-generate-key "postszn-backup <your email>" default default 2y
```

It asks for a passphrase. Pick a long one and **save it in your password manager now**. Then:

```bash
gpg --armor --export postszn-backup > postszn-backup-public.asc
gpg --armor --export-secret-keys postszn-backup > postszn-backup-private.asc
```

- Save the **contents** of `postszn-backup-private.asc` in your password manager as a secure note, and put one copy on a USB stick. Without it every backup is unreadable.
- Add a calendar reminder 20 months from now: the key expires in 2 years.

## B. Give GitHub the public half

```bash
cd ~
gh secret set BACKUP_GPG_PUBLIC_KEY --repo kmacri12/PostSznFantasy < postszn-backup-public.asc
```

## C. Run it once

```bash
gh workflow run backup.yml --repo kmacri12/PostSznFantasy
gh run watch --repo kmacri12/PostSznFantasy
```

Pick the backup run if it asks. It must finish green.

## D. Test a restore once

Supabase runs Postgres 17, so you need the version 17 tools. Check first:

```bash
pg_restore --version
```

If it does not say 17, install them (Ubuntu):

```bash
sudo apt install -y curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
sudo apt update && sudo apt install -y postgresql-client-17
/usr/lib/postgresql/17/bin/pg_restore --version
```

Then restore the newest backup into a throwaway local database (start it with `make db-up` in the repo first):

```bash
cd ~ && mkdir -p backup-test && cd backup-test
RUN=$(gh run list --workflow backup.yml --repo kmacri12/PostSznFantasy --limit 1 --json databaseId -q '.[0].databaseId')
gh run download "$RUN" -n "postszn-backup-$RUN" --repo kmacri12/PostSznFantasy
docker exec postszn-postgres psql -U postgres -c "create database restore_check"
PATH=/usr/lib/postgresql/17/bin:$PATH ~/code/PostSznFantasy/scripts/restore-backup.sh ./postszn-*.dump.gpg postgresql://postgres:postgres@localhost:5433/restore_check
```

gpg asks for your passphrase. Clean up afterwards:

```bash
docker exec postszn-postgres psql -U postgres -c "drop database restore_check"
rm -rf ~/backup-test
```

## Verify

- The backup run is green and its page lists an artifact named `postszn-backup-<number>`.
- The restore printed `restored, alembic revision ...`.
- The private key and passphrase are in your password manager.

Close #107.

## If it goes wrong

- "unsupported version in file header": you used older tools. Use the `PATH=/usr/lib/postgresql/17/bin:$PATH` line.
- "No such file" for the `.dump.gpg`: run `ls -R ~/backup-test` and use the path it shows.
- The run failed at the database step: `PROD_DATABASE_URL` must be the **session pooler** string. Re-run Step 4's script or set it with `gh secret set PROD_DATABASE_URL --repo kmacri12/PostSznFantasy` (it asks for the value hidden).
