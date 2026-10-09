#!/usr/bin/env bash
# The separator is a tab character; a backslash lost from the escape splits on the letter t instead.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1"
