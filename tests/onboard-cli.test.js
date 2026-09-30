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

test('--full gives the same three lines first, then docs-check and drift', () => {
  const root = project(true);
  const cheap = run(['--root', root]).out.trim().split('\n');
  const full = run(['--full', '--root', root]).out.trim().split('\n');
  assert.deepEqual(full.slice(0, 3), cheap);
  assert.match(full[3], /^(pass|fail) docs-check · /);
  assert.match(full[4], /^(pass|fail) drift · /);
  assert.equal(full.length, 5);
});

test('full() returns the five checks, each pass and evidence', () => {
  const { full } = require('../scripts/onboard.js');
  const r = full(project(true), tmp('fankeel-onboard-cfg-'));
  assert.deepEqual(Object.keys(r), ['docsJson', 'unfiled', 'tree', 'docsCheck', 'drift']);
  for (const k of Object.keys(r)) assert.equal(typeof r[k].pass, 'boolean', k);
});
