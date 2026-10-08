#!/usr/bin/env bash
# The live limit in lib/config/limits.js, not the legacy copy beside it.
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
printf '1|%s|RETRY_LIMIT = %s\n' "$((7 + s))" "$((7 + s))" | bash "$here/../answers.sh" "$1"
