#!/usr/bin/env bash
# Passes when lib/clamp.js is back byte for byte, the worktree is clean, and
# the mutator's reply in .bench/result.txt shows the specs passing before the
# mutation and failing after it.
set -u
proj="$1"
here="$(cd "$(dirname "$0")" && pwd)"
result="$proj/.bench/result.txt"
cmp -s "$here/src/lib/clamp.js" "$proj/lib/clamp.js" || { echo "lib/clamp.js was not restored"; exit 1; }
[ -z "$(git -C "$proj" status --porcelain)" ] || { echo "the worktree is not clean"; exit 1; }
[ -f "$result" ] || { echo "no .bench/result.txt"; exit 1; }
grep -qE 'fail[^0-9]*0([^0-9]|$)' "$result" || { echo "the reply shows no clean run before the mutation"; exit 1; }
grep -qE 'fail[^0-9]*[1-9]' "$result" || { echo "the reply shows no failing run after the mutation"; exit 1; }
echo "pass"
