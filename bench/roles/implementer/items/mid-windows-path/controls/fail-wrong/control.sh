node "$BENCH_PLUGIN/bench/roles/implementer/items/judge.js" write "$BENCH_PLUGIN/bench/roles/implementer/items/mid-windows-path" .
tr -d '\\' < lib/winpath.js > lib/w.tmp && mv lib/w.tmp lib/winpath.js
