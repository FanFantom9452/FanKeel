#!/usr/bin/env bash
# The override value, since overrides.js wins whenever it is set.
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
printf '1|%s|MAX_BATCH: %s\n' "$((20 + s))" "$((20 + s))" | bash "$here/../answers.sh" "$1"
