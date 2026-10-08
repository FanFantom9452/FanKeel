#!/usr/bin/env bash
# A module constant that a function shadows with a local of another value.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
. "$here/../repo.sh"
repo_filler
printf "'use strict';\n// Pages of the order report.\nconst PAGE_SIZE = 25;\n\nfunction render(rows) {\n    const PAGE_SIZE = %s;\n    return rows.slice(0, PAGE_SIZE);\n}\n\nexports.PAGE_SIZE = PAGE_SIZE;\nexports.render = render;\n" "$((10 + s))" > lib/report.js
repo_commit
