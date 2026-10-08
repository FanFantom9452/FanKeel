#!/usr/bin/env bash
# A logger whose default level is one constant, and a doc page that gets it wrong.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
ls=(info warn error); v="${ls[$(( (s - 1) % 3 ))]}"
. "$here/../repo.sh"
repo_filler
mkdir -p docs
printf "'use strict';\n// The level a line must reach to be printed.\nconst DEFAULT_LEVEL = '%s';\nconst level = process.env.LOG_LEVEL || DEFAULT_LEVEL;\n\nexports.level = level;\n" "$v" > lib/log.js
printf '# Logging\n\nThe level defaults to debug, and LOG_LEVEL overrides it.\n' > docs/logging.md
repo_commit
