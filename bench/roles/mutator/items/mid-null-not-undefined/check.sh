#!/usr/bin/env bash
# nothing found now comes back undefined: the null spec sees it.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" lib/find.js kill
