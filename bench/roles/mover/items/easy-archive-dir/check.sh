#!/usr/bin/env bash
# the directory move is one commit, same message, both files moved unchanged, worktree clean
here="$(cd "$(dirname "$0")" && pwd)"
proj="$1"
. "$here/../judge.sh"
want_commits 1
want_message "docs: archive the drafts"
want_changes "$(printf 'A docs/archive/a.md\nA docs/archive/b.md\nD docs/drafts/a.md\nD docs/drafts/b.md')"
want_same docs/archive/a.md docs/drafts/a.md
want_same docs/archive/b.md docs/drafts/b.md
want_clean
echo "pass"
