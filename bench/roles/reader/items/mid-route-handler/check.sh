#!/usr/bin/env bash
# The handler named in the POST /refunds route in server/routes.js.
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
hs=(issueRefund refundOrder createRefund); h="${hs[$(( (s - 1) % 3 ))]}"; o="${hs[$(( s % 3 ))]}"
printf '1|%s|%s\n' "$h" "$h" | bash "$here/../answers.sh" "$1"
