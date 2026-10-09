node "$BENCH_PLUGIN/bench/roles/implementer/items/judge.js" write "$BENCH_PLUGIN/bench/roles/implementer/items/easy-trim-dots" .
tr -d '\\' < lib/dots.js > lib/d.tmp && mv lib/d.tmp lib/dots.js
