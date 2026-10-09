#!/usr/bin/env bash
# none, since no file defines MAX_RETRIES.
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
printf '1|none|\n' | bash "$here/../answers.sh" "$1"
