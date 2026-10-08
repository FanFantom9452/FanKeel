#!/usr/bin/env bash
# the greeting changed: only greet.spec.js sees it.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" lib/greet.js kill
