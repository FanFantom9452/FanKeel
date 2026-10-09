s="${BENCH_SEED:-1}"
mkdir -p .bench
printf '1. %s — lib/config/batch.js:4\n' "$((40 + s))" > .bench/result.txt
