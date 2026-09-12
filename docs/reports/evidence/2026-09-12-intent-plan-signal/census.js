// Census of `status:` across docs/, measured with the repo's own contractOf
// rather than a re-typed regex.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../../..');
const docs = require(path.join(root, 'lib/docs.js'));

const out = [];
(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.md')) out.push(p);
    }
})(path.join(root, 'docs'));

const byStatus = new Map();
const byKind = new Map();
const intent = [];
for (const p of out) {
    const c = docs.contractOf(fs.readFileSync(p, 'utf8'));
    const s = c.status === undefined ? '(none)' : String(c.status);
    const k = c.kind === undefined ? '(none)' : String(c.kind);
    byStatus.set(s, (byStatus.get(s) || 0) + 1);
    byKind.set(k, (byKind.get(k) || 0) + 1);
    if (k === 'intent') intent.push(path.relative(root, p).replace(/\\/g, '/'));
}

console.log('files under docs/:', out.length);
console.log('\nby status:');
for (const [s, n] of [...byStatus].sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '  ' + s);
console.log('\nby kind:');
for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '  ' + k);
console.log('\nkind=intent:');
for (const f of intent) console.log('  ' + f);
