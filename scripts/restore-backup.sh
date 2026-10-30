#!/usr/bin/env bash
# Decrypt a backup made by scripts/backup-db.sh and restore it into an EMPTY database.
# Needs the private key in your gpg keyring (gpg prompts for its passphrase).
#
# Usage: scripts/restore-backup.sh postszn-<timestamp>.dump.gpg postgresql://user:pass@host:port/scratch_db
# Never point this at production: the schemas must not exist in the target.
# GPG_FLAGS adds gpg options for non-interactive use (for example in a test).
set -euo pipefail

[[ $# -eq 2 ]] || { echo "usage: $0 <backup.dump.gpg> <target database url>" >&2; exit 2; }
backup=$1
target_url=$2

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# shellcheck disable=SC2086
gpg ${GPG_FLAGS:-} --quiet --output "$work/dump" --decrypt "$backup"
# Every database already has a public schema; restoring its CREATE SCHEMA would fail.
pg_restore --list "$work/dump" | grep -v ' SCHEMA - public ' > "$work/restore.list"
pg_restore --no-owner --no-privileges --single-transaction --exit-on-error --use-list "$work/restore.list" \
  --dbname "$target_url" "$work/dump"
psql "$target_url" --no-psqlrc -tA -c "select 'restored, alembic revision ' || version_num from public.alembic_version"
