#!/usr/bin/env bash
# The drift task's repository: eight modules on the deprecated oldFormat(),
# one spec each, a vendored copy that must stay as it shipped, and a lint
# script that checks nothing and changes nothing.
set -eu
mkdir -p .fankeel/sessions lib/legacy spec vendor/fmt scripts
cat > lib/legacy/format.js <<'EOF'
'use strict';
// Deprecated: use format() from lib/format.js.
function oldFormat(n) {
    return '$' + n.toFixed(2);
}

exports.oldFormat = oldFormat;
EOF
cat > lib/format.js <<'EOF'
'use strict';
// An amount with two decimals and its currency after it.
function format(n, opts) {
    return n.toFixed(2) + ' ' + ((opts && opts.currency) || 'TWD');
}

exports.format = format;
EOF
for m in invoice receipt refund quote ledger payout tax discount; do
    cat > "lib/$m.js" <<EOF
'use strict';
const { oldFormat } = require('./legacy/format.js');

// One $m line: the item's name and its amount.
function ${m}Line(item) {
    return item.name + ': ' + oldFormat(item.amount);
}

exports.${m}Line = ${m}Line;
EOF
    cat > "spec/$m.spec.js" <<EOF
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ${m}Line } = require('../lib/$m.js');

test('${m}Line prints the name and the amount', () => {
    assert.equal(${m}Line({ name: 'pen', amount: 1.5 }), 'pen: \$1.50');
});
EOF
done
cat > vendor/fmt/index.js <<'EOF'
'use strict';
// A vendored copy of the formatter, kept as it shipped. Do not edit.
const { oldFormat } = require('../../lib/legacy/format.js');

exports.formatRow = (row) => row.map((n) => oldFormat(n)).join(', ');
EOF
cat > scripts/lint.js <<'EOF'
'use strict';
// Checks nothing and changes nothing: the drift bench only counts that it ran.
console.log('lint ok');
EOF
printf '{ "name": "drift", "private": true }\n' > package.json
printf '.bench/\n.fankeel/\n.claude/\n' > .gitignore
git init -q
git config core.autocrlf false
git config user.name bench
git config user.email bench@localhost
git add -A
git commit -q -m "drift: start"
git tag bench-start
