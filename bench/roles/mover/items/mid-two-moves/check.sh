#!/usr/bin/env bash
# both moves are one commit, same message, both files moved unchanged, worktree clean
here="$(cd "$(dirname "$0")" && pwd)"
proj="$1"
. "$here/../judge.sh"
want_commits 1
want_message "notes: gather a and b"
want_changes "$(printf 'A notes/a.md\nA notes/b.md\nD docs/a.md\nD docs/b.md')"
want_same notes/a.md docs/a.md
want_same notes/b.md docs/b.md
want_clean
echo "pass"
