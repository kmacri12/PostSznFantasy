#!/usr/bin/env bash
# Exits non-zero if any draft is in the lobby, running or paused.
# Deploys and secret changes restart the API, which drops draft WebSockets, so run this first.
# Usage: DATABASE_URL=postgresql://... scripts/check-live-drafts.sh
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL to a postgresql:// connection string (session pooler for CI)}"

live=$(psql "$DATABASE_URL" --no-psqlrc -v ON_ERROR_STOP=1 -tAF ' ' -c \
  "select league_id, status from fantasy.drafts where status in ('lobby', 'in_progress', 'paused') order by league_id")

if [[ -n "$live" ]]; then
  echo "Live drafts found (league_id status):" >&2
  echo "$live" >&2
  exit 1
fi
echo "No live drafts."
