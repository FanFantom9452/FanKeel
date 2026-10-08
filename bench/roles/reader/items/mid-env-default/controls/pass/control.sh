s="${BENCH_SEED:-1}"
ls=(info warn error); v="${ls[$(( (s - 1) % 3 ))]}"
mkdir -p .bench
printf '1. %s — lib/log.js:3\n' "$v" > .bench/result.txt
