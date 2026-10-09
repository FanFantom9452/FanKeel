#!/usr/bin/env bash
# the tax subtracted instead of added: the tax spec sees it.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" lib/total.js kill
