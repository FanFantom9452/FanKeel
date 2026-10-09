#!/usr/bin/env bash
# A route table naming one of several handlers, all of which exist in lib/handlers.js.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
hs=(issueRefund refundOrder createRefund); h="${hs[$(( (s - 1) % 3 ))]}"; o="${hs[$(( s % 3 ))]}"
. "$here/../repo.sh"
repo_filler
mkdir -p server
{
    printf "'use strict';\n// Every handler, routed or not.\n"
    for x in listOrders createOrder cancelOrder "${hs[@]}"; do printf "function %s() { return '%s'; }\n" "$x" "$x"; done
    printf '\nmodule.exports = { listOrders, createOrder, cancelOrder, issueRefund, refundOrder, createRefund };\n'
} > lib/handlers.js
printf "'use strict';\nconst h = require('../lib/handlers.js');\n\nmodule.exports = [\n    ['GET', '/orders', h.listOrders],\n    ['POST', '/orders', h.createOrder],\n    ['POST', '/refunds', h.%s],\n    ['DELETE', '/orders', h.cancelOrder],\n];\n" "$h" > server/routes.js
repo_commit
