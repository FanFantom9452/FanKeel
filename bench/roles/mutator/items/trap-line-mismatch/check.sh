#!/usr/bin/env bash
# line 4 of clamp.js holds no `n > hi`, so the mutation is refused.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" lib/clamp.js refuse
