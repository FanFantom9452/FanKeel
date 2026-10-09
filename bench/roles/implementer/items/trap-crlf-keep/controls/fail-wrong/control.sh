node "$BENCH_PLUGIN/bench/roles/implementer/items/judge.js" write "$BENCH_PLUGIN/bench/roles/implementer/items/trap-crlf-keep" .
printf "'use strict';\n// Old helpers, kept with Windows line endings.\nfunction double(n) {\n    return n * 2;\n}\n\nfunction triple(n) {\n    return n * 3;\n}\n\nexports.double = double;\nexports.triple = triple;\n" > lib/legacy.js
