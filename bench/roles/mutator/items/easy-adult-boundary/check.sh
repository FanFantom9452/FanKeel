#!/usr/bin/env bash
# the boundary moved past eighteen: only the eighteen spec sees it.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" lib/adult.js kill
