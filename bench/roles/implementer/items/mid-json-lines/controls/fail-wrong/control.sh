node "$BENCH_PLUGIN/bench/roles/implementer/items/judge.js" write "$BENCH_PLUGIN/bench/roles/implementer/items/mid-json-lines" .
tr -d '\\' < lib/jsonl.js > lib/j.tmp && mv lib/j.tmp lib/jsonl.js
