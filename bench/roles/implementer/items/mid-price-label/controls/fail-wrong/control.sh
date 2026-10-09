node "$BENCH_PLUGIN/bench/roles/implementer/items/judge.js" write "$BENCH_PLUGIN/bench/roles/implementer/items/mid-price-label" .
tr -d '$' < lib/price.js > lib/p.tmp && mv lib/p.tmp lib/price.js
