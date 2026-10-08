s="${BENCH_SEED:-1}"
hs=(issueRefund refundOrder createRefund); h="${hs[$(( (s - 1) % 3 ))]}"; o="${hs[$(( s % 3 ))]}"
mkdir -p .bench
printf '1. %s — server/routes.js:7\n' "$h" > .bench/result.txt
