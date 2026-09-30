'use strict';

// docs/90-agent/plans/2026-09-30-init-design.md §1: three checks that read
// files and never a page's body.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const onboard = require('../lib/onboard.js');
const docs = require('../lib/docs.js');
const tmp = require('./tmp.js');

const TICKS = '`'.repeat(3);
const tree = (last) => ['# fixture', '', '## Layout', '', TICKS + 'text',
  '├── docs/     the pages a person reads',
  '├── lib/      the logic, tested directly',
  '└── tests/' + (last ? '    ' + last : ''), TICKS, ''].join('\n');

function project(files) {
  const root = tmp('fankeel-onboard-');
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel.split('/').join(path.sep));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return root;
}
const cfg = () => tmp('fankeel-onboard-cfg-');
const filed = () => project({ 'README.md': tree('one file per module'), 'docs/guide.md': '# guide\n', 'lib/a.js': '\n', 'tests/a.test.js': '\n' });

test('a project with no docs.json fails the docs.json check', () => {
  const r = onboard.cheap(filed(), cfg());
  assert.equal(r.docsJson.pass, false);
  assert.match(r.failing.join('\n'), /^docs\.json — /m);
});

test('docs.json, a filled tree and no unfiled page pass all three', () => {
  const root = filed();
  docs.write(root, { buckets: [{ path: 'docs', role: 'reference' }] });
  const r = onboard.cheap(root, cfg());
  assert.deepEqual(r.failing, []);
  assert.equal(r.tree.pass, true);
  assert.match(r.tree.evidence, /README\.md: 3 rows, 0 with no responsibility/);
  assert.equal(r.unfiled.pass, true);
});

test('a row with no responsibility fails the tree check, and a page in no bucket fails unfiled', () => {
  const root = project({ 'README.md': tree(''), 'docs/guide.md': '# guide\n', 'notes/loose.md': '# loose\n', 'lib/a.js': '\n', 'tests/a.test.js': '\n' });
  docs.write(root, { buckets: [{ path: 'docs', role: 'reference' }] });
  const r = onboard.cheap(root, cfg());
  assert.equal(r.tree.pass, false);
  assert.match(r.tree.evidence, /1 with no responsibility/);
  assert.equal(r.unfiled.pass, false);
  assert.match(r.unfiled.evidence, /^1 markdown file/);
});

test('a data bucket keeps its pages out of the unfiled count', () => {
  const root = project({ 'README.md': tree('one file per module'), 'docs/guide.md': '# guide\n', 'raw/2024/minutes.md': '# minutes\n', 'lib/a.js': '\n', 'tests/a.test.js': '\n' });
  docs.write(root, { buckets: [{ path: 'docs', role: 'reference' }, { path: 'raw', role: 'data' }] });
  assert.equal(onboard.cheap(root, cfg()).unfiled.pass, true);
});

test('init.skip: skipped, nothing checked; force checks anyway', () => {
  const root = project({ 'README.md': '# bare\n' });
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'init.skip': true }));
  const r = onboard.cheap(root, cfg());
  assert.equal(r.skipped, true);
  assert.equal(r.docsJson, null);
  assert.deepEqual(r.failing, []);
  const forced = onboard.cheap(root, cfg(), { force: true });
  assert.equal(forced.skip, true);
  assert.equal(forced.docsJson.pass, false);
});
