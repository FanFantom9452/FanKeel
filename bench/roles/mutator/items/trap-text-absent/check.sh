#!/usr/bin/env bash
# line 5 holds count++, not count += 1, so the mutation is refused.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" lib/counter.js refuse
