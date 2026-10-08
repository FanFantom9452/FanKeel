#!/usr/bin/env bash
# the deletion is one commit, same message, only that file gone, worktree clean
here="$(cd "$(dirname "$0")" && pwd)"
proj="$1"
. "$here/../judge.sh"
want_commits 1
want_message "docs: drop the old notes"
want_changes "D docs/old-notes.md"
want_clean
echo "pass"
