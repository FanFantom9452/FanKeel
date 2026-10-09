#!/usr/bin/env bash
# A cut that lands on a word's end keeps that word; cutting at the last hyphen would drop it.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1"
