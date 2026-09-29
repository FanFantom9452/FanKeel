'use strict';

// A todo entry is one file per deferred thing, forty of them in this
// repository: the audit's reading half does not batch them, and the index is
// not asked to list them, as for an archive or a fixture.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const docs = require('../lib/docs.js');
const audit = require('../scripts/docs-audit.js');
const tmp = require('./tmp.js');

test('the audit batches no todo entry and does not ask the index to list one', () => {
  const dir = tmp('fankeel-audittodo-');
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  put('README.md', '# r\n');
  put('docs/README.md', '# index\n\n[a](a.md)\n');
  put('docs/a.md', '# a\n');
  put('docs/todo/x-1.md', '---\nlabel: x\ntitle: t\ndescription: d\nstate: ready\n---\n');
  docs.write(dir, { preset: 'custom', index: 'docs/README.md', buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] });
  const batched = audit.batches(dir).flatMap((b) => b.pages);
  assert.ok(!batched.includes('docs/todo/x-1.md'), JSON.stringify(batched));
  const swept = audit.sweep(dir, 14, Date.now());
  assert.ok(!swept.index.missing.includes('docs/todo/x-1.md'), JSON.stringify(swept.index.missing));
});
