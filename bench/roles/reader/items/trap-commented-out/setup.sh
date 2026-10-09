#!/usr/bin/env bash
# A batch size whose old value sits in a comment above the live one.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
. "$here/../repo.sh"
repo_filler
mkdir -p lib/config
printf "'use strict';\n// How many orders one batch takes.\n// const BATCH_SIZE = 100; (before the 2025 rewrite)\nconst BATCH_SIZE = %s;\n\nexports.BATCH_SIZE = BATCH_SIZE;\n" "$((40 + s))" > lib/config/batch.js
repo_commit
