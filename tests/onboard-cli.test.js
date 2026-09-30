'use strict';

// docs/90-agent/plans/2026-09-30-init-design.md §1: one line per check, the
// same answer for a check whether or not --full is asked, exit 1 on a fail.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const docs = require('../lib/docs.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'onboard.js');
const TICKS = '`'.repeat(3);
const TREE = ['# fixture', '', '## Layout', '', TICKS + 'text',
  '├── docs/     the pages a person reads',
  '├── lib/      the logic, tested directly',
  '└── tests/    one file per module', TICKS, ''].join('\n');

function project(withTree) {
  const root = tmp('fankeel-onboard-cli-');
  const files = { 'README.md': TREE, 'docs/guide.md': '---\nstatus: current\n---\n# guide\n', 'lib/a.js': '\n', 'tests/a.test.js': '\n' };
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel.split('/').join(path.sep));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  if (withTree) docs.write(root, { buckets: [{ path: 'docs', role: 'reference' }] });
  return root;
}

function run(args) {
  const env = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: tmp('fankeel-onboard-cfg-') });
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env }), code: 0 };
  } catch (e) {
    return { out: String(e.stdout || ''), code: e.status };
  }
}

test('no docs.json: a fail line naming it, and exit 1', () => {
  const r = run(['--root', project(false)]);
  assert.equal(r.code, 1);
  assert.match(r.out, /^fail docs\.json · /m);
});

test('a filed project: three pass lines and exit 0', () => {
  const r = run(['--root', project(true)]);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(r.out.trim().split('\n').map((l) => l.split(' · ')[0]), ['pass docs.json', 'pass unfiled', 'pass tree']);
});

function stale(root) {
  // Drift by mtime (the fixture is no repository): the page is 40 days older than the code it names.
  fs.writeFileSync(path.join(root, 'docs', 'guide.md'), '---\nstatus: current\n---\n# guide\n\nSee `lib/a.js`.\n');
  const old = new Date(Date.now() - 40 * 86400000);
  fs.utimesSync(path.join(root, 'docs', 'guide.md'), old, old);
  return root;
}

function dead(root) {
  fs.writeFileSync(path.join(root, 'docs', 'guide.md'), '---\nstatus: current\n---\n# guide\n\nSee `lib/missing-file.js`.\n');
  return root;
}

test('--full gives the same three lines first, then docs-check and drift', () => {
  const root = project(true);
  const cheap = run(['--root', root]).out.trim().split('\n');
  const r = run(['--full', '--root', root]);
  const full = r.out.trim().split('\n');
  assert.deepEqual(full.slice(0, 3), cheap);
  assert.match(full[3], /^pass docs-check · 0 findings/);
  assert.match(full[4], /^pass drift · 0 pages/);
  assert.equal(full.length, 5);
  assert.equal(r.code, 0, r.out);
});

test('--full on a dead reference: fail docs-check, exit 1', () => {
  const r = run(['--full', '--root', dead(project(true))]);
  assert.equal(r.code, 1);
  assert.match(r.out, /^fail docs-check · [1-9]\d* findings/m);
  assert.match(r.out, /^pass drift · /m);
});

test('--full on a stale page: fail drift, exit 1', () => {
  const r = run(['--full', '--root', stale(project(true))]);
  assert.equal(r.code, 1);
  assert.match(r.out, /^pass docs-check · /m);
  assert.match(r.out, /^fail drift · [1-9]\d* pages/m);
});

test('full() returns the five checks with real pass values', () => {
  const { full } = require('../scripts/onboard.js');
  const cfg = tmp('fankeel-onboard-cfg-');
  const ok = full(project(true), cfg);
  assert.deepEqual(Object.keys(ok), ['docsJson', 'unfiled', 'tree', 'docsCheck', 'drift']);
  for (const k of Object.keys(ok)) assert.equal(ok[k].pass, true, k);
  const bad = dead(project(true));
  assert.equal(full(bad, cfg).docsCheck.pass, false);
  assert.equal(full(bad, cfg).drift.pass, true);
  assert.equal(full(stale(project(true)), cfg).drift.pass, false);
});

test('full() on an unreadable root: docs-check and drift fail, saying nothing could be read', () => {
  const { full } = require('../scripts/onboard.js');
  const gone = path.join(tmp('fankeel-onboard-gone-'), 'nope');
  const r = full(gone, tmp('fankeel-onboard-cfg-'));
  assert.equal(r.docsCheck.pass, false);
  assert.match(r.docsCheck.evidence, /^nothing under .* could be read$/);
  assert.equal(r.drift.pass, false);
  assert.match(r.drift.evidence, /^nothing under .* could be read$/);
});

test('main: a bad argv is code 2 with the usage line', () => {
  const { main } = require('../scripts/onboard.js');
  for (const argv of [['--bogus'], ['--root']]) {
    const r = main(argv);
    assert.equal(r.code, 2, argv.join(' '));
    assert.match(r.text, /^onboard\.js: /);
    assert.match(r.text, /\nusage: onboard\.js \[--full\] \[--root <dir>\]$/);
  }
});

test('init.skip on the project: main and --full still run the checks', () => {
  const root = project(true);
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'init.skip': true }));
  const r = run(['--full', '--root', root]);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(r.out.trim().split('\n').map((l) => l.split(' · ')[0]),
    ['pass docs.json', 'pass unfiled', 'pass tree', 'pass docs-check', 'pass drift']);
  const bare = project(false);
  fs.mkdirSync(path.join(bare, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(bare, '.fankeel', 'profile.json'), JSON.stringify({ 'init.skip': true }));
  const b = run(['--root', bare]);
  assert.equal(b.code, 1);
  assert.match(b.out, /^fail docs\.json · /m);
});
