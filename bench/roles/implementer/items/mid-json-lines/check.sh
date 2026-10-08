#!/usr/bin/env bash
# Each record is one line ending in a newline character; split and join both need that escape.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1"
