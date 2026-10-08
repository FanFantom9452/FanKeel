node "$BENCH_PLUGIN/bench/roles/implementer/items/judge.js" write "$BENCH_PLUGIN/bench/roles/implementer/items/trap-crlf-keep" .
printf "'use strict';\r\n// Old helpers, kept with Windows line endings.\r\nfunction double(n) {\r\n    return n * 2;\r\n}\r\n\r\nfunction triple(n) {\r\n    return n * 3;\r\n}\r\n\r\nexports.double = double;\r\nexports.triple = triple;\r\n" > lib/legacy.js
printf 'touched\n' >> README.md
