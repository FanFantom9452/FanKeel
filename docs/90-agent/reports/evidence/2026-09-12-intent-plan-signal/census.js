// Census of `status:` across every file `trackedFiles()` returns, filtered
// with the same `isMarkdown()` docs-check.js uses — the same list, read
// through the same function, that scripts/docs-audit.js:400-412
// (`trackedFiles(root)` then `markdown = files.filter(isMarkdown)`) and
// lib/map.js:224-237 (`markdownUnder()`) actually read. Not `docs/`, and not a
// re-typed `git ls-files` that only happens to agree with them while the
// working tree is clean. Measured with the repo's own contractOf rather than
// a re-typed regex.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../../..');
const docs = require(path.join(root, 'lib/docs.js'));
const { trackedFiles } = require(path.join(root, 'lib/tracked.js'));
const { isMarkdown } = require(path.join(root, 'scripts/docs-check.js'));

const listed = trackedFiles(root);
const out = listed.files.filter(isMarkdown);

const byStatus = new Map();
const byKind = new Map();
const intent = [];
for (const rel of out) {
    const c = docs.contractOf(fs.readFileSync(root + '/' + rel, 'utf8'));
    const s = c.status === undefined ? '(none)' : String(c.status);
    const k = c.kind === undefined ? '(none)' : String(c.kind);
    byStatus.set(s, (byStatus.get(s) || 0) + 1);
    byKind.set(k, (byKind.get(k) || 0) + 1);
    if (k === 'intent') intent.push(rel);
}

console.log('tracked .md files (trackedFiles() + isMarkdown):', out.length);
console.log('\nby status:');
for (const [s, n] of [...byStatus].sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '  ' + s);
console.log('\nby kind:');
for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '  ' + k);
console.log('\nkind=intent:');
for (const f of intent) console.log('  ' + f);
