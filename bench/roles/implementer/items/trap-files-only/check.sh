#!/usr/bin/env bash
# The README still says one argument; the Files block does not name it, so the edit to it is extra, and the lib is the one change asked for.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1"
