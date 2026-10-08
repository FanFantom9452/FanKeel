#!/usr/bin/env bash
# Only the trailing dots go; an unanchored replace would strip the dot inside a.b as well.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1"
