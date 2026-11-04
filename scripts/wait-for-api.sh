#!/usr/bin/env bash
# Polls GET /api until it reports healthy, and (when EXPECT_VERSION is set) that build commit.
# Exits non-zero after TIMEOUT_SECONDS. Usage: API_URL=https://... [EXPECT_VERSION=<sha>] scripts/wait-for-api.sh
set -euo pipefail

: "${API_URL:?}"
deadline=$((SECONDS + ${TIMEOUT_SECONDS:-300}))
while :; do
  body=$(curl -fsS --max-time 10 "$API_URL/api" 2>/dev/null || true)
  parsed=$(printf '%s' "$body" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("status",""), d.get("version",""))' 2>/dev/null || true)
  read -r status version <<<"$parsed"
  if [[ "${status:-}" == healthy && ( -z "${EXPECT_VERSION:-}" || "${version:-}" == "$EXPECT_VERSION" ) ]]; then
    echo "API healthy${version:+ at ${version:0:7}}."
    exit 0
  fi
  if (( SECONDS >= deadline )); then
    echo "API not healthy${EXPECT_VERSION:+ at ${EXPECT_VERSION:0:7}} after ${TIMEOUT_SECONDS:-300}s (last reply: ${body:-none})" >&2
    exit 1
  fi
  sleep "${POLL_SECONDS:-5}"
done
