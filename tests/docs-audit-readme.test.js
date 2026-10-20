'use strict';

// docs/90-agent/todo/audit-3.md: a README.md that no bucket files is read as
// reference in its own directory's batch and graded for drift; one that a
// bucket covers keeps that bucket's role. Dates come from mtime, as in
// tests/docs-audit.test.js, because the tree is not a repository.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const docs = require('../lib/docs.js');
const audit = require('../scripts/docs-audit.js');
const tmp = require('./tmp.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 21, 12, 0, 0);

function tree(files) {
  const root = tmp('fankeel-audit-readme-');
  for (const [rel, spec] of Object.entries(files)) {
    const full = path.join(root, rel.split('/').join(path.sep));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, spec.body);
    const at = (NOW - spec.age * DAY) / 1000;
    fs.utimesSync(full, at, at);
  }
  docs.write(root, docs.PRESETS.flat);
  return root;
}

test('a README.md no bucket covers is batched under its own directory and listed when it drifts', () => {
  const root = tree({
    'lib/widget/README.md': { age: 30, body: 'The widget is drawn by `lib/widget/a.js`.\n' },
    'lib/widget/a.js': { age: 1, body: 'x\n' },
    'lib/widget/notes.md': { age: 30, body: 'notes on `lib/widget/a.js`\n' },
    'tools/README.md': { age: 1, body: 'The tool is `tools/b.js`.\n' },
    'tools/b.js': { age: 30, body: 'x\n' },
    'docs/archive/README.md': { age: 30, body: 'once `lib/widget/a.js`\n' },
  });
  const batched = audit.batches(root);
  const where = Object.fromEntries(batched.map((b) => [b.bucket, b.pages]));
  assert.deepEqual(where['lib/widget'], ['lib/widget/README.md'], 'the README is read; notes.md stays unfiled');
  assert.deepEqual(where.tools, ['tools/README.md']);
  assert.ok(!batched.some((b) => b.pages.includes('docs/archive/README.md')), 'a README a bucket covers keeps that bucket\'s role');
  assert.match(audit.main(['--root', root, '--batches'], NOW).text, /\. lib\/widget 1\/1 — 1 page$/m);

  const r = audit.sweep(root, 14, NOW);
  assert.deepEqual(r.drift.map((d) => d.file + ' ' + d.target), ['lib/widget/README.md lib/widget/a.js'],
    'the stale README is listed; the fresh one is not');
  assert.match(audit.report(r), /^ {2}lib\/widget\/README\.md {2}\(/m);
  assert.equal(r.unfiled, 1, 'only notes.md is unfiled');
  assert.equal(r.undeclared, 0, 'a README carries no frontmatter and is not counted for lacking one');
});
