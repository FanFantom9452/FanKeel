#!/usr/bin/env bash
# Two config files, the override one wins over the default when it is set.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
. "$here/../repo.sh"
repo_filler
mkdir -p lib/config
printf "'use strict';\nmodule.exports = {\n    MAX_BATCH: 50,\n    TIMEOUT_MS: 3000,\n};\n" > lib/config/defaults.js
printf "'use strict';\nmodule.exports = {\n    MAX_BATCH: %s,\n};\n" "$((20 + s))" > lib/config/overrides.js
printf "'use strict';\nconst defaults = require('./defaults.js');\nconst overrides = require('./overrides.js');\n\nexports.MAX_BATCH = overrides.MAX_BATCH || defaults.MAX_BATCH;\nexports.TIMEOUT_MS = overrides.TIMEOUT_MS || defaults.TIMEOUT_MS;\n" > lib/config/index.js
repo_commit
