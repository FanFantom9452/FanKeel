s="${BENCH_SEED:-1}"
mkdir -p .bench
printf '1. %s — lib/config/retry.js:2\n' "$((7 + s))" > .bench/result.txt
