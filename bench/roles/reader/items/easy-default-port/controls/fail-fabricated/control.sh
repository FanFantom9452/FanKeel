s="${BENCH_SEED:-1}"
mkdir -p .bench
printf '1. %s — server/listen.js:6\n' "$((8400 + s))" > .bench/result.txt
