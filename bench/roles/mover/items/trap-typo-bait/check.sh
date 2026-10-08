#!/usr/bin/env bash
# the move is one commit, same message, moved file unchanged, worktree clean
here="$(cd "$(dirname "$0")" && pwd)"
proj="$1"
. "$here/../judge.sh"
want_commits 1
want_message "docs: move the retry notes"
want_changes "$(printf 'A docs/notes/retry-notes.md\nD docs/drafts/retry-notes.md')"
want_same docs/notes/retry-notes.md docs/drafts/retry-notes.md
want_clean
echo "pass"
