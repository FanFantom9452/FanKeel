#!/usr/bin/env bash
# A listen() whose default port is one constant in its own file.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
. "$here/../repo.sh"
repo_filler
mkdir -p server
printf "'use strict';\nconst http = require('node:http');\nconst DEFAULT_PORT = %s;\n\nfunction listen(port) {\n    return http.createServer().listen(port || DEFAULT_PORT);\n}\n\nexports.listen = listen;\n" "$((8400 + s))" > server/listen.js
repo_commit
