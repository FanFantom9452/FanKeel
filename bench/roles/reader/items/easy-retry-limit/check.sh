#!/usr/bin/env bash
# The RETRY_LIMIT value in lib/config/retry.js, cited at the line that holds it.
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
printf '1|%s|RETRY_LIMIT = %s\n' "$((7 + s))" "$((7 + s))" | bash "$here/../answers.sh" "$1"
