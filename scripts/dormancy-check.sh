#!/usr/bin/env bash
# Read-only checks for the shutdown and wake-up runbooks (docs/deploy/shutdown-runbook.md,
# wake-up-runbook.md). Changes nothing; prints PASS/FAIL per check and exits non-zero on any FAIL.
#
# Usage: scripts/dormancy-check.sh dormant|awake
# Env:   FLY_APP (postszn-api), SITE_URL (https://postsznfantasy.com),
#        API_URL (https://api.postsznfantasy.com). Fly checks are skipped without flyctl.
# No -e on purpose: one failing check must not hide the results of the others.
set -uo pipefail

mode=${1:-}
[[ $mode == dormant || $mode == awake ]] || { echo "usage: $0 dormant|awake" >&2; exit 2; }
FLY_APP=${FLY_APP:-postszn-api}
SITE_URL=${SITE_URL:-https://postsznfantasy.com}
API_URL=${API_URL:-https://api.postsznfantasy.com}

failed=0
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; failed=1; }
skip() { echo "SKIP  $1"; }
warn() { echo "WARN  $1"; }

site_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$SITE_URL/") || site_code=000
[[ $site_code == 200 ]] && pass "static shell answers 200 at $SITE_URL" \
  || fail "static shell at $SITE_URL returned $site_code (expected 200)"

deep_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$SITE_URL/leagues/1") || deep_code=000
[[ $deep_code == 200 ]] && pass "deep link /leagues/1 serves the app (SPA fallback)" \
  || fail "deep link returned $deep_code (expected 200)"

api_body=$(curl -s --max-time 15 -w '\n%{http_code}' "$API_URL/api") || api_body=$'\n000'
api_code=${api_body##*$'\n'}
if [[ $mode == awake ]]; then
  [[ $api_code == 200 && $api_body == *healthy* ]] && pass "API health is 200 healthy" \
    || fail "API health returned $api_code (expected 200 healthy)"
else
  [[ $api_code != 2* ]] && pass "API health is not 2xx ($api_code), so the SPA shows the dormant page" \
    || fail "API still answers $api_code; the dormant page will not show"
fi

if command -v fly >/dev/null 2>&1; then
  states=$(fly machine list --app "$FLY_APP" --json 2>/dev/null | python3 -c \
    'import json,sys; print(" ".join(m["state"] for m in json.load(sys.stdin)))') || states=""
  if [[ -z $states ]]; then
    fail "could not read machines (fly auth login? app name?)"
  elif [[ $mode == awake ]]; then
    [[ $states == started ]] && pass "exactly one machine, started" \
      || fail "machine states: $states (expected exactly one: started)"
  else
    [[ $states != *started* && $states != *starting* ]] && pass "no machine running (states: $states)" \
      || fail "a machine is still running (states: $states)"
  fi
else
  skip "flyctl not installed: machine state not checked"
fi

# A Free Supabase project pauses after a week without database activity, and the weekly
# backup workflow's keep-alive query is what prevents it (docs/research/supabase-auth-backup.md).
# Only a warning: pausing on purpose (shutdown runbook, option B) is allowed.
if [[ $mode == dormant ]] && command -v gh >/dev/null 2>&1; then
  last_run=$(gh run list --workflow backup.yml --status success --limit 1 \
    --json createdAt --jq '.[0].createdAt // empty' 2>/dev/null) || last_run=""
  if [[ -z $last_run ]]; then
    warn "no successful Weekly backup run found: Supabase may pause, and sign-in accounts need recreating after a lost project (wake-up runbook step 1)"
  elif (( $(date +%s) - $(date -d "$last_run" +%s) > 8 * 86400 )); then
    warn "last successful Weekly backup was $last_run (over 8 days ago): the keep-alive is not running, so Supabase may pause"
  else
    pass "Weekly backup ran successfully on $last_run, so Supabase stays active"
  fi
fi

exit $failed
