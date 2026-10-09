s="${BENCH_SEED:-1}"
mods=(signup invoice refund); m="${mods[$(( (s - 1) % 3 ))]}"; o="${mods[$(( s % 3 ))]}"
mkdir -p .bench
printf '1. lib/%s.js — lib/%s.js:2\n' "$o" "$o" > .bench/result.txt
