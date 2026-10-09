#!/usr/bin/env bash
# The sign is the string '$'; bash's $'...' quoting is not JavaScript's, and a tr of the dollar sign breaks it.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1"
