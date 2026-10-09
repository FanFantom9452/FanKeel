s="${BENCH_SEED:-1}"
mkdir -p .bench
printf '1. %s\n' "$((7 + s))" > .bench/result.txt
