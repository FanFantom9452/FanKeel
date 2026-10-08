#!/usr/bin/env bash
# the move is one commit whose message has a subject and a body paragraph, moved file unchanged, worktree clean
here="$(cd "$(dirname "$0")" && pwd)"
proj="$1"
. "$here/../judge.sh"
want_commits 1
want_message "$(printf 'docs: move the retry notes\n\nDrafts hold only notes still in question.')"
want_changes "$(printf 'A docs/notes/retry-notes.md\nD docs/drafts/retry-notes.md')"
want_same docs/notes/retry-notes.md docs/drafts/retry-notes.md
want_clean
echo "pass"
