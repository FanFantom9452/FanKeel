'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'layout.js');
const { rows } = require('../scripts/layout.js');

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-layout-'));
  for (const [rel, text] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return root;
}

const run = (root) => execFileSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' });

test('every directory appears once, with a size and an empty responsibility', () => {
  const root = fixture({
    'README.md': '# x\n',
    'lib/a.js': 'a',
    'lib/b.js': 'bb',
    'scripts/c.js': 'ccc',
    'docs/deep/d.md': 'dddd',
  });
  const out = run(root);
  for (const d of ['lib/', 'scripts/', 'docs/']) {
    assert.equal(out.split('\n').filter((l) => l.startsWith(d)).length, 1, d + ' appeared other than once');
  }
  assert.match(out, /docs\/.*1 directory below/);
  assert.match(out, /lib\/.*2 files/);
  // The responsibility column is what a person fills in; the tool leaves it open.
  for (const line of out.split('\n').filter((l) => /^(lib|scripts|docs)\//.test(l))) {
    assert.match(line, /#\s*$/, 'a row arrived with something already in it: ' + line);
  }
});

test('a file loose at the top is reported rather than dropped', () => {
  const root = fixture({ 'README.md': '# x\n', 'index.js': 'x', 'lib/a.js': 'a' });
  assert.match(run(root), /files loose at the top: README\.md, index\.js/);
});

test('the run writes nothing at all', () => {
  const root = fixture({ 'README.md': '# x\n', 'lib/a.js': 'a' });
  const before = fs.readdirSync(root).sort();
  const readme = fs.readFileSync(path.join(root, 'README.md'));
  run(root);
  assert.deepEqual(fs.readdirSync(root).sort(), before);
  assert.deepEqual(fs.readFileSync(path.join(root, 'README.md')), readme);
});

test('a root with nothing readable says so rather than printing an empty tree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-layout-'));
  assert.match(run(root), /nothing readable under/);
});

test('rows groups by first segment and counts what is below', () => {
  const root = fixture({ 'lib/a.js': 'a', 'lib/sub/b.js': 'bb', 'top.js': 'c' });
  const { dirs, loose } = rows(root, ['lib/a.js', 'lib/sub/b.js', 'top.js']);
  assert.deepEqual([...dirs.keys()], ['lib']);
  assert.equal(dirs.get('lib').files, 2);
  assert.deepEqual([...dirs.get('lib').below], ['sub']);
  assert.deepEqual(loose.map((f) => f.rel), ['top.js']);
});
