#!/usr/bin/env bash
# A backslash in JavaScript source is two characters; the separator is one backslash.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1"
