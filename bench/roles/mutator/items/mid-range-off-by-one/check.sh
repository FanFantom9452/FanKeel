#!/usr/bin/env bash
# the range stops one short: the three spec sees it.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" lib/range.js kill
