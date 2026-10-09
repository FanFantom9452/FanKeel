#!/usr/bin/env bash
# Whitespace runs count as one separator; splitting on single spaces would over-count.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1"
