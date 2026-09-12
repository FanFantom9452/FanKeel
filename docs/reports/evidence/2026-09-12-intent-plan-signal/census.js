// Census of `status:` across every git-tracked markdown file in the repo —
// the same population scripts/docs-audit.js:412 (`markdown = files.filter(isMarkdown)`
// over `trackedFiles()`) and lib/map.js:224-237 (`markdownUnder()`) read, not just
// `docs/`. Measured with the repo's own contractOf rather than a re-typed regex.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '../../../..');
const docs = require(path.join(root, 'lib/docs.js'));

const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const out = git(['ls-files'])
    .split('\n')
    .map((s) => s.trim())
    .filter((rel) => /\.md$/i.test(rel));

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

console.log('git-tracked .md files:', out.length);
console.log('\nby status:');
for (const [s, n] of [...byStatus].sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '  ' + s);
console.log('\nby kind:');
for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '  ' + k);
console.log('\nkind=intent:');
for (const f of intent) console.log('  ' + f);
