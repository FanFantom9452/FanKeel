#!/usr/bin/env bash
# The retry limit the orders code reads, beside a legacy copy nothing requires.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
. "$here/../repo.sh"
repo_filler
mkdir -p lib/config lib/legacy
printf "'use strict';\n// How often a failed order is retried before it is parked.\nconst RETRY_LIMIT = %s;\n\nexports.RETRY_LIMIT = RETRY_LIMIT;\n" "$((7 + s))" > lib/config/limits.js
printf "'use strict';\n// The limits before the 2025 rewrite. Nothing requires this file any more.\nconst RETRY_LIMIT = %s;\n\nexports.RETRY_LIMIT = RETRY_LIMIT;\n" "$((3 + s))" > lib/legacy/limits.js
printf "'use strict';\nconst { RETRY_LIMIT } = require('./config/limits.js');\n\nfunction shouldPark(tries) {\n    return tries >= RETRY_LIMIT;\n}\n\nexports.shouldPark = shouldPark;\n" > lib/orders.js
repo_commit
