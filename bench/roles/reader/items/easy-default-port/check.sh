#!/usr/bin/env bash
# The DEFAULT_PORT value that server/listen.js declares.
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
printf '1|%s|DEFAULT_PORT = %s\n' "$((8400 + s))" "$((8400 + s))" | bash "$here/../answers.sh" "$1"
