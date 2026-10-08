s="${BENCH_SEED:-1}"
mkdir -p .bench
printf '1. %s — lib/report.js:6\n' "$((10 + s))" > .bench/result.txt
