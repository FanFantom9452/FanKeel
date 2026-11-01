'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'layout.js');
const { rows } = require('../scripts/layout.js');
const tmp = require('./tmp.js');

function fixture(files) {
  const root = tmp('fankeel-layout-');
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
  const root = tmp('fankeel-layout-');
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

test('layout reads --root with residue\'s parser, the one copy both scripts share', () => {
  const { parseArgs } = require('../scripts/residue.js');
  const dir = tmp('fankeel-layout-');
  assert.equal(parseArgs(['--root', dir]).root, path.resolve(dir));
  assert.equal(parseArgs(['--root']).root, parseArgs([]).root, 'a bare --root falls back to the default');
  assert.equal(parseArgs(['--quiet', 'x']).root, parseArgs([]).root, 'an unknown flag stays silent');
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'layout.js'), 'utf8');
  assert.match(src, /require\('\.\/residue\.js'\)/);
  assert.doesNotMatch(src, /function parseArgs/);
});

test('the architecture diagram names the guard, the stage agent and the registry, and chartroom hangs off the body', () => {
  const md = fs.readFileSync(path.join(__dirname, '..', 'docs', '02-architecture', 'layout.md'), 'utf8');
  const block = (md.match(/```mermaid\n([\s\S]*?)\n```/) || [])[1];
  assert.ok(block, 'layout.md has no mermaid block');
  for (const name of ['guard.js', 'fankeel-brain', '.fankeel/sessions']) {
    assert.ok(block.includes(name), 'the diagram does not mention ' + name);
  }
  const chart = [...block.matchAll(/^\s*(\w+)\s*\[[^\n]*chartroom/gm)].map((m) => m[1]);
  assert.ok(chart.length >= 1, 'no node labelled chartroom');
  const edge = /^\s*(\w+)\s*(?:--\s*"[^"]*"\s*-->|-\.\s*"[^"]*"\s*\.->|-->|-\.->)\s*(\w+)\s*$/gm;
  const edges = [...block.matchAll(edge)].map((m) => [m[1], m[2]]);
  const outward = edges.filter(([a, b]) => (chart.includes(a) !== chart.includes(b)));
  assert.ok(outward.length >= 1, 'a chartroom node has no edge to a node outside chartroom');
});
