#!/usr/bin/env bash
# Reads changed file paths on stdin. Prints "true" when the end-to-end suite
# must run, "false" when every path is one we have chosen not to run it for.
#
# Skippable: files the suite cannot observe, plus backend-only changes under
# api/. Backend-only PRs are skipped on purpose (the full suite on every push
# to main is the safety net), except for the api/ paths the suite's own setup
# depends on, which are listed in must_run. Anything else, new directories
# included, runs e2e.
set -euo pipefail

safe='^(docs/.*|.*\.md|LICENSE|\.gitignore|\.pre-commit-config\.yaml|\.dockerignore|Dockerfile|fly\.toml|scripts/.*|\.github/dependabot\.yml|\.github/workflows/(deploy|backup|docker-build)\.yml)$'

# Seeding, the schema, the test-auth stub and the backend's dependencies.
must_run='^api/(scripts/seed_e2e\.py|alembic/.*|dependencies/auth\.py|core/config\.py|pyproject\.toml|uv\.lock)$'

changed=$(cat)
needed=false
while IFS= read -r path; do
  [ -z "$path" ] && continue
  if printf '%s\n' "$path" | grep -qE "$safe"; then continue; fi
  if printf '%s\n' "$path" | grep -qE '^api/' && ! printf '%s\n' "$path" | grep -qE "$must_run"; then continue; fi
  needed=true
done <<< "$changed"

[ -z "$changed" ] && needed=true
echo "$needed"
