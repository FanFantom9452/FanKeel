#!/usr/bin/env bash
# the rename is one commit, same message, the file's content unchanged, worktree clean
here="$(cd "$(dirname "$0")" && pwd)"
proj="$1"
. "$here/../judge.sh"
want_commits 1
want_message "docs: rename howto to guide"
want_changes "$(printf 'A docs/guide.md\nD docs/howto.md')"
want_same docs/guide.md docs/howto.md
want_clean
echo "pass"
