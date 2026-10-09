#!/usr/bin/env bash
# One of three ledger functions throws the error; the other two return.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
names=(openLedger appendEntry closeLedger); f="${names[$(( (s - 1) % 3 ))]}"; o="${names[$(( s % 3 ))]}"
. "$here/../repo.sh"
repo_filler
{
    printf "'use strict';\n// The order ledger.\n"
    for n in "${names[@]}"; do
        if [ "$n" = "$f" ]; then printf "function %s() { throw new Error('ledger closed'); }\n" "$n"; else printf 'function %s() { return true; }\n' "$n"; fi
    done
    printf '\nmodule.exports = { openLedger, appendEntry, closeLedger };\n'
} > lib/ledger.js
repo_commit
