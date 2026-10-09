#!/usr/bin/env bash
# The drift task's repository: eight modules on the deprecated oldFormat(),
# each calling it differently, one spec each, a vendored copy that must stay
# as it shipped, and a lint script that checks nothing and changes nothing.
set -eu
mkdir -p .fankeel/sessions lib/legacy spec vendor/fmt scripts
cat > lib/legacy/format.js <<'EOF'
'use strict';
// Deprecated: use format() from lib/format.js.
function oldFormat(n, style) {
    if (style === 'eur') return '€' + n.toFixed(2);
    if (style === 'int') return '$' + Math.round(n);
    if (style === 'paren' && n < 0) return '($' + (-n).toFixed(2) + ')';
    return '$' + n.toFixed(2);
}

exports.oldFormat = oldFormat;
EOF
cat > lib/format.js <<'EOF'
'use strict';
// An amount and its currency after it. Options: currency (TWD by default),
// digits (2 by default), negative ('sign' by default, or 'paren').
function format(n, opts) {
    const o = opts || {};
    const body = Math.abs(n).toFixed(o.digits === undefined ? 2 : o.digits) + ' ' + (o.currency || 'TWD');
    if (n < 0) return o.negative === 'paren' ? '(' + body + ')' : '-' + body;
    return body;
}

exports.format = format;
EOF
mod() {
    local m="$1" item="$2" legacy="$3" expect="$4"
    cat > "lib/$m.js" <<EOF
'use strict';
const { oldFormat } = require('./legacy/format.js');

// One $m line: the item's name and its amount.
function ${m}Line(item) {
    return item.name + ': ' + ${legacy};
}

exports.${m}Line = ${m}Line;
EOF
    cat > "spec/$m.spec.js" <<EOF
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ${m}Line } = require('../lib/$m.js');

test('${m}Line prints the name and the amount', () => {
    assert.equal(${m}Line(${item}), 'pen: ${expect}');
});
EOF
}
mod invoice "{ name: 'pen', amount: 1.5 }" "oldFormat(item.amount)" '$1.50'
mod receipt "{ name: 'pen', total: 1.5 }" "oldFormat(item.total, 'eur')" '€1.50'
mod refund "{ name: 'pen', amount: 1.5 }" "oldFormat(-item.amount, 'paren')" '($1.50)'
mod quote "{ name: 'pen', price: 1.5, qty: 2 }" "oldFormat(item.price * item.qty)" '$3.00'
mod ledger "{ name: 'pen', balance: 2.6 }" "oldFormat(item.balance, 'int')" '$3'
mod payout "{ name: 'pen', amount: 2500 }" "oldFormat(item.amount / 100, 'eur')" '€25.00'
mod tax "{ name: 'pen', amount: 10, rate: 0.5 }" "oldFormat(item.amount * item.rate)" '$5.00'
mod discount "{ name: 'pen', amount: 1.5 }" "oldFormat(-item.amount, 'eur')" '€-1.50'
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
