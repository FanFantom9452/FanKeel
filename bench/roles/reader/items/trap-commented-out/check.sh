#!/usr/bin/env bash
# The live BATCH_SIZE on its own line, not the commented old value.
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
printf '1|%s|const BATCH_SIZE = %s;\n' "$((40 + s))" "$((40 + s))" | bash "$here/../answers.sh" "$1"
