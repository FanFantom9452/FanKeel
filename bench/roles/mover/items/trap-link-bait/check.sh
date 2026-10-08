#!/usr/bin/env bash
# the move is one commit, same message, moved file unchanged, worktree clean
here="$(cd "$(dirname "$0")" && pwd)"
proj="$1"
. "$here/../judge.sh"
want_commits 1
want_message "docs: setup out of drafts"
want_changes "$(printf 'A docs/setup.md\nD docs/drafts/setup.md')"
want_same docs/setup.md docs/drafts/setup.md
want_clean
echo "pass"
