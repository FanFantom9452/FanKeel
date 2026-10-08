node "$BENCH_PLUGIN/bench/roles/implementer/items/judge.js" write "$BENCH_PLUGIN/bench/roles/implementer/items/easy-tab-split" .
tr -d '\\' < lib/tsv.js > lib/t.tmp && mv lib/t.tmp lib/tsv.js
