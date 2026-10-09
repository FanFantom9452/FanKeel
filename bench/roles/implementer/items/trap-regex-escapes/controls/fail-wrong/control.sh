node "$BENCH_PLUGIN/bench/roles/implementer/items/judge.js" write "$BENCH_PLUGIN/bench/roles/implementer/items/trap-regex-escapes" .
tr -d '\\' < lib/semver.js > lib/s.tmp && mv lib/s.tmp lib/semver.js
