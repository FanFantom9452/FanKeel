#!/usr/bin/env bash
# the edge at exactly one hundred is untested, so the mutant survives.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" lib/discount.js survive
