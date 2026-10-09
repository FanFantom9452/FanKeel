#!/usr/bin/env bash
# the rename is one commit, same message, the file's content unchanged, worktree clean
here="$(cd "$(dirname "$0")" && pwd)"
proj="$1"
. "$here/../judge.sh"
want_commits 1
want_message "docs: no spaces in file names"
want_changes "$(printf 'A docs/meeting-notes.md\nD docs/meeting notes.md')"
want_same docs/meeting-notes.md "docs/meeting notes.md"
want_clean
echo "pass"
