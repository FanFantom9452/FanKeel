#!/usr/bin/env bash
# Passes when HEAD is one commit on top of the start, carrying the given
# message, whose only change is the move with the content unchanged, and the
# worktree is clean.
set -u
proj="$1"
g() { git -C "$proj" "$@"; }
want="$(printf 'A docs/notes/retry-notes.md\nD docs/drafts/retry-notes.md')"
[ "$(g rev-list --count HEAD)" = "2" ] || { echo "HEAD is not one commit on top of the start"; exit 1; }
[ "$(g log -1 --format=%s)" = "docs: move the retry notes out of drafts" ] || { echo "the commit message differs"; exit 1; }
[ "$(g diff --name-status --no-renames HEAD~1 HEAD | sort | tr '\t' ' ')" = "$want" ] || { echo "the commit changed more than the move"; exit 1; }
[ "$(g rev-parse HEAD:docs/notes/retry-notes.md)" = "$(g rev-parse HEAD~1:docs/drafts/retry-notes.md)" ] || { echo "the moved file's content changed"; exit 1; }
[ -z "$(g status --porcelain)" ] || { echo "the worktree is not clean"; exit 1; }
echo "pass"
