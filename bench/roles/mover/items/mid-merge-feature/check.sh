#!/usr/bin/env bash
# the merge is a merge commit on the start, with the given message, adding the retry notes, worktree clean
here="$(cd "$(dirname "$0")" && pwd)"
proj="$1"
. "$here/../judge.sh"
want_commits 2
want_merge
want_message "merge: the retry notes"
want_changes "A docs/retry.md"
want_clean
echo "pass"
