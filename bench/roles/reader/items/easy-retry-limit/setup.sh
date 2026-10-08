#!/usr/bin/env bash
# One retry limit in one file, with a comment naming it.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
. "$here/../repo.sh"
repo_filler
mkdir -p lib/config
printf "'use strict';\n// How often a failed order is retried before it is parked.\nconst RETRY_LIMIT = %s;\n\nexports.RETRY_LIMIT = RETRY_LIMIT;\n" "$((7 + s))" > lib/config/retry.js
repo_commit
