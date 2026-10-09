#!/usr/bin/env bash
# The DEFAULT_LEVEL in lib/log.js, not the doc page that says debug.
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
ls=(info warn error); v="${ls[$(( (s - 1) % 3 ))]}"
printf "1|%s|DEFAULT_LEVEL = '%s'\n" "$v" "$v" | bash "$here/../answers.sh" "$1"
