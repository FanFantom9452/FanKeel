#!/usr/bin/env bash
# Retry and batch limits, and nothing named MAX_RETRIES.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
. "$here/../repo.sh"
repo_filler
mkdir -p lib/config
printf "'use strict';\n// Retry and batch limits.\nconst RETRY_LIMIT = %s;\nconst MAX_BATCH = %s;\n\nexports.RETRY_LIMIT = RETRY_LIMIT;\nexports.MAX_BATCH = MAX_BATCH;\n" "$((7 + s))" "$((20 + s))" > lib/config/limits.js
repo_commit
