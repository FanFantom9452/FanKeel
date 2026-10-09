#!/usr/bin/env bash
# the plus turned to a minus: both specs see it.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" lib/sum.js kill
