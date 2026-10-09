#!/usr/bin/env bash
# The one of three ledger functions whose body throws the ledger closed error.
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
names=(openLedger appendEntry closeLedger); f="${names[$(( (s - 1) % 3 ))]}"; o="${names[$(( s % 3 ))]}"
printf '1|%s|ledger closed\n' "$f" | bash "$here/../answers.sh" "$1"
