node "$BENCH_PLUGIN/bench/roles/implementer/items/judge.js" write "$BENCH_PLUGIN/bench/roles/implementer/items/easy-word-count" .
tr -d '\\' < lib/words.js > lib/w.tmp && mv lib/w.tmp lib/words.js
