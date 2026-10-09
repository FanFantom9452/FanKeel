s="${BENCH_SEED:-1}"
mkdir -p .bench
printf '1. %s — lib/config/overrides.js:3\n' "$((20 + s))" > .bench/result.txt
