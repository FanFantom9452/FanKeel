#!/usr/bin/env bash
# The dollar sign is text in NT$ before an interpolation; it must stay in the output.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1"
