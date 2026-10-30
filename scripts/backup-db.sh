#!/usr/bin/env bash
# Keep-alive query, pg_dump of the app schemas, then public-key encryption with gpg.
# The private key is never needed here, so a leaked CI secret cannot decrypt old backups.
#
# Usage: DATABASE_URL=... BACKUP_GPG_PUBLIC_KEY="$(cat public.asc)" scripts/backup-db.sh [out_dir]
# Writes <out_dir>/postszn-<UTC timestamp>.dump.gpg and prints its path on the last line.
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL (Supabase session pooler string in CI)}"
: "${BACKUP_GPG_PUBLIC_KEY:?set BACKUP_GPG_PUBLIC_KEY to the ASCII-armored public key}"
out_dir=${1:-.}
mkdir -p "$out_dir"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export GNUPGHOME="$work/gnupg"
mkdir -m 700 "$GNUPGHOME"

# A real query, so a Supabase Free project counts as active even if the API is down.
psql "$DATABASE_URL" --no-psqlrc -v ON_ERROR_STOP=1 -tA -c "select 'keep-alive ok ' || now()"

# fantasy and nfl hold the app data (including user emails); public holds alembic_version.
# Supabase-managed schemas (auth, storage, ...) are deliberately left out.
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=nfl --schema=fantasy --file="$work/dump"

printf '%s\n' "$BACKUP_GPG_PUBLIC_KEY" | gpg --batch --quiet --import
fingerprint=$(gpg --batch --list-keys --with-colons | awk -F: '/^fpr/ {print $10; exit}')

target="$out_dir/postszn-$(date -u +%Y%m%dT%H%M%SZ).dump.gpg"
gpg --batch --quiet --trust-model always --recipient "$fingerprint" \
  --output "$target" --encrypt "$work/dump"
echo "$target"
