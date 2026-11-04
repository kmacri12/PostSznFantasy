#!/usr/bin/env bash
# Reads changed file paths on stdin. Prints "true" when the end-to-end suite
# must run, "false" when every path is one it cannot observe.
#
# The list below is an allowlist of files that cannot reach the suite; anything
# not named here (new directories included) runs e2e. api/, frontend/, e2e/,
# lockfiles, Makefile, docker-compose.yml and ci.yml are deliberately absent.
set -euo pipefail

skippable='^(docs/.*|.*\.md|LICENSE|\.gitignore|\.pre-commit-config\.yaml|\.dockerignore|Dockerfile|fly\.toml|scripts/.*|\.github/dependabot\.yml|\.github/workflows/(deploy|backup|docker-build)\.yml)$'

changed=$(cat)
if [ -z "$changed" ] || printf '%s\n' "$changed" | grep -qvE "$skippable"; then
  echo true
else
  echo false
fi
