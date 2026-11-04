#!/usr/bin/env bash
# Decides what a deploy of main has to ship and prints KEY=value lines (append to $GITHUB_OUTPUT).
#   behind    true when production is behind TARGET_SHA (anything to do at all)
#   api       true when the API must be deployed
#   frontend  true when the Pages build must be triggered
#   skip_reason  why nothing ships (empty otherwise)
#
# "Deployed" state: the API reports its build commit on GET /api ("version"); the frontend has no
# such endpoint, so each successful run moves the git tag DEPLOYED_TAG to the commit it shipped.
# Usage: TARGET_SHA=<sha> API_URL=https://api... scripts/deploy-plan.sh   (run inside the clone,
# with full history and the tag fetched)
set -euo pipefail

: "${TARGET_SHA:?}" "${API_URL:?}"
tag="${DEPLOYED_TAG:-deployed}"
api_paths=(api Dockerfile fly.toml .github/workflows/deploy.yml)
frontend_paths=(frontend)

emit() { echo "behind=$1"; echo "api=$2"; echo "frontend=$3"; echo "skip_reason=$4"; }

# A queued older run must not roll production back behind a newer push.
main_head=$(git rev-parse "${MAIN_REF:-origin/main}")
if [[ "$main_head" != "$TARGET_SHA" ]]; then
  emit false false false "main moved on to ${main_head:0:7}; a newer run owns the deploy"
  exit 0
fi

# Unknown commit (no tag yet, or not in history): ship everything.
changed() { # <from> <paths...>
  local from=$1; shift
  if [[ -z "$from" ]] || ! git cat-file -e "$from^{commit}" 2>/dev/null; then return 0; fi
  ! git diff --quiet "$from" "$TARGET_SHA" -- "$@"
}

deployed_all=$(git rev-parse -q --verify "refs/tags/$tag^{commit}" || true)
if [[ "$deployed_all" == "$TARGET_SHA" ]]; then
  emit false false false "production already runs ${TARGET_SHA:0:7}"
  exit 0
fi

# Do not follow redirects or trust a non-JSON reply: unknown just means "deploy the API".
api_version=$(curl -fsS --max-time 10 "$API_URL/api" 2>/dev/null \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("version",""))' 2>/dev/null || true)

api=false; frontend=false
changed "$api_version" "${api_paths[@]}" && api=true
changed "$deployed_all" "${frontend_paths[@]}" && frontend=true
emit true "$api" "$frontend" ""
