#!/usr/bin/env bash
# Removes git worktrees nobody needs any more, so they stop filling the disk (each is ~1 GB
# with node_modules and .venv). A worktree goes only when removing it cannot lose work:
#   - clean (no tracked or untracked changes),
#   - every commit on it already exists on an origin/* branch or in a merged PR,
#   - no process is running inside it, and it has been idle for MIN_AGE_HOURS.
# The branch itself is never deleted. Run with --dry-run to only list what would go.
set -euo pipefail

dry_run=false
[[ "${1:-}" == "--dry-run" ]] && dry_run=true
min_age_hours="${MIN_AGE_HOURS:-6}"
repo="${REPO_DIR:-$HOME/code/PostSznFantasy}"

cd "$repo"
git fetch -q origin || echo "prune-worktrees: fetch failed, using the last known origin state" >&2

in_use() {
    local dir="$1" p
    for p in /proc/[0-9]*/cwd; do
        [[ "$(readlink "$p" 2>/dev/null)" == "$dir"* ]] && return 0
    done
    return 1
}

removed=0
main_checkout="$(git rev-parse --show-toplevel)"
while read -r dir; do
    [[ "$dir" == "$main_checkout" ]] && continue
    [[ -d "$dir" ]] || continue

    if in_use "$dir"; then echo "keep (in use): $dir"; continue; fi

    git_dir="$(git -C "$dir" rev-parse --git-dir)"
    if [[ -n "$(find "$git_dir/HEAD" -mmin "-$((min_age_hours * 60))" 2>/dev/null)" ]]; then
        echo "keep (active in the last ${min_age_hours}h): $dir"; continue
    fi

    if [[ -n "$(git -C "$dir" status --porcelain)" ]]; then echo "keep (uncommitted changes): $dir"; continue; fi

    head_sha="$(git -C "$dir" rev-parse HEAD)"
    branch="$(git -C "$dir" branch --show-current)"
    on_origin=false
    [[ -n "$(git branch -r --contains "$head_sha" 2>/dev/null)" ]] && on_origin=true
    if ! $on_origin && [[ -n "$branch" ]]; then
        open="$(gh pr list --head "$branch" --state open --json number --jq length 2>/dev/null || echo 1)"
        merged="$(gh pr list --head "$branch" --state merged --json number --jq length 2>/dev/null || echo 0)"
        [[ "$open" == "0" && "$merged" != "0" ]] && on_origin=true
    fi
    if ! $on_origin; then echo "keep (commits not on origin or in a merged PR): $dir"; continue; fi

    echo "remove: $dir ($(du -sh "$dir" | cut -f1))"
    if ! $dry_run; then
        git worktree unlock "$dir" 2>/dev/null || true
        git worktree remove --force "$dir"
        removed=$((removed + 1))
    fi
done < <(git worktree list --porcelain | awk '/^worktree /{sub(/^worktree /, ""); print}')

$dry_run || git worktree prune
echo "prune-worktrees: removed $removed worktree(s)"
