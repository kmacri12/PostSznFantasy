#!/usr/bin/env bash
# Fails on patterns that make Playwright specs flaky. See "Writing stable e2e specs" in CONTRIBUTING.md.
#
# - waitForTimeout, networkidle, page.pause, test.only: sleeps and idle guesses hide races, the others block CI.
# - .first() / .last() / .nth(): pick one of several matches, so the match order can change under
#   the test. Allowed only with a comment on the same or the previous line saying why the order is
#   stable (or why any match will do).
set -euo pipefail
cd "$(dirname "$0")/../e2e"

files=$(find tests live support -name '*.ts' | sort)
status=0

banned='waitForTimeout|networkidle|page\.pause\(|\.only\(|test\.fixme\(|debugger'
if grep -nE "$banned" $files; then
  echo "error: remove the lines above (fixed sleeps, networkidle, pause, only, fixme, debugger)." >&2
  status=1
fi

unjustified=$(awk '
  FNR == 1 { previous = "" }
  {
    if ($0 ~ /\.(first|last|nth)\(/ && $0 !~ /\/\// && previous !~ /^[[:space:]]*\/\//) {
      printf "%s:%d: %s\n", FILENAME, FNR, $0
    }
    previous = $0
  }
' $files)
if [ -n "$unjustified" ]; then
  echo "$unjustified"
  echo "error: add a // comment (same or previous line) saying why .first/.last/.nth is stable." >&2
  status=1
fi

exit $status
