#!/usr/bin/env bash
# the emptiness test inverted: both specs see it.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" lib/empty.js kill
