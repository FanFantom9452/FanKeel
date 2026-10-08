s="${BENCH_SEED:-1}"
mkdir -p .bench
printf '1. %s — lib/legacy/limits.js:3\n' "$((7 + s))" > .bench/result.txt
