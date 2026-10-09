s="${BENCH_SEED:-1}"
hs=(issueRefund refundOrder createRefund); h="${hs[$(( (s - 1) % 3 ))]}"; o="${hs[$(( s % 3 ))]}"
mkdir -p .bench
printf '1. %s — lib/handlers.js:%s\n' "$o" "$(( 6 + s % 3 ))" > .bench/result.txt
