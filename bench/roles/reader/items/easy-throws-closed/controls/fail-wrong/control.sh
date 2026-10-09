s="${BENCH_SEED:-1}"
names=(openLedger appendEntry closeLedger); f="${names[$(( (s - 1) % 3 ))]}"; o="${names[$(( s % 3 ))]}"
mkdir -p .bench
printf '1. %s — lib/ledger.js:%s\n' "$o" "$(( 3 + s % 3 ))" > .bench/result.txt
