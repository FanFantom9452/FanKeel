#!/usr/bin/env bash
# The ampersand is escaped first, or the escapes it adds are escaped again.
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1"
