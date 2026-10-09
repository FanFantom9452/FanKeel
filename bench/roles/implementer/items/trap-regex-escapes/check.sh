#!/usr/bin/env bash
# The regex's backslashes are escapes: \d and \. match a digit and a dot, not the letter d and any character.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1"
