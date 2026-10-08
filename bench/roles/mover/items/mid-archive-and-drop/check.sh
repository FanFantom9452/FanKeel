#!/usr/bin/env bash
# the move and the deletion are one commit, same message, the moved file unchanged, worktree clean
here="$(cd "$(dirname "$0")" && pwd)"
proj="$1"
. "$here/../judge.sh"
want_commits 1
want_message "docs: archive the plan, drop the scratch"
want_changes "$(printf 'A docs/archive/plan.md\nD docs/plan.md\nD docs/scratch.md')"
want_same docs/archive/plan.md docs/plan.md
want_clean
echo "pass"
