#!/usr/bin/env bash
# a tie changes no value, so no spec can see it.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" lib/max.js survive
