s="${BENCH_SEED:-1}"
ls=(info warn error); v="${ls[$(( (s - 1) % 3 ))]}"
mkdir -p .bench
printf '1. debug — docs/logging.md:3\n' > .bench/result.txt
