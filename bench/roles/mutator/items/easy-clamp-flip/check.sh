#!/usr/bin/env bash
# clamp's upper bound flipped: the three specs see it, two of them fail.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" lib/clamp.js kill
