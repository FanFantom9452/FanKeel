node "$BENCH_PLUGIN/bench/roles/implementer/items/judge.js" write "$BENCH_PLUGIN/bench/roles/implementer/items/trap-dollar-quote" .
tr -d '$' < lib/money.js > lib/m.tmp && mv lib/m.tmp lib/money.js
