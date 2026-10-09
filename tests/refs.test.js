'use strict';
// lib/refs.js: the path shapes a document or a test cites, moved out of
// scripts/docs-check.js on 2026-10-09 so lib/reviewcheck.js can read them
// without a lib requiring a script.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PATHISH, resolveRef, external, quoteBeside } = require('../lib/refs.js');
const docsCheck = require('../scripts/docs-check.js');
const tmp = require('./tmp.js');

test('PATHISH takes a repository path with an optional line or range, and nothing without a slash', () => {
  assert.ok(PATHISH.test('lib/render.js'));
  assert.ok(PATHISH.test('lib/render.js:12'));
  assert.ok(PATHISH.test('lib/render.js:12-20'));
  assert.equal(PATHISH.test('render.js'), false);
  assert.equal(PATHISH.test('see the registry'), false);
});

test('resolveRef resolves beside the citing file first, then from the root, and never above it', () => {
  const root = tmp('fankeel-refs-');
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'a.md'), '# a\n');
  fs.writeFileSync(path.join(root, 'top.md'), '# top\n');
  assert.equal(resolveRef(root, 'docs/b.md', 'a.md'), 'docs/a.md');
  assert.equal(resolveRef(root, 'docs/b.md', 'top.md'), 'top.md');
  assert.equal(resolveRef(root, 'docs/b.md', '../../etc/passwd'), null);
  assert.equal(resolveRef(root, 'docs/b.md', 'gone.md'), null);
  // A real file above the root, so only the '..' guard keeps it out.
  const above = tmp('fankeel-refs-');
  const inner = path.join(above, 'root');
  fs.mkdirSync(path.join(inner, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(above, 'marker.md'), '# marker\n');
  assert.equal(resolveRef(inner, 'docs/b.md', '../../marker.md'), null);
});

test('quoteBeside is the first code span on the line unless that span is itself a path; external refs are not paths', () => {
  assert.equal(quoteBeside('cite lib/a.js:10 — `const X = 1` here\n', 0), 'const X = 1');
  assert.equal(quoteBeside('cite lib/a.js:10 — `lib/b.js`\n', 0), null);
  assert.equal(quoteBeside('cite lib/a.js:10 with nothing\n', 0), null);
  assert.ok(external('https://x.y/z'));
  assert.ok(external('#heading'));
  assert.equal(external('lib/a.js'), false);
});

test('scripts/docs-check.js still exports the same names, and they are lib/refs.js\'s', () => {
  assert.equal(docsCheck.PATHISH, PATHISH);
  assert.equal(docsCheck.resolveRef, resolveRef);
  assert.equal(docsCheck.external, external);
});
