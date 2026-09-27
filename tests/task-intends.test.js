'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const B = 'bbbbbbbb-1111-2222-3333-444444444444';

const PLAN = '# P\n\n## Task 1: one\n\n**Files:**\n- Modify: `lib/a.js` — x\n- Test: `tests/a.test.js`\n';
const DESIGN = '# D\n\n| file | why |\n|---|---|\n| `lib/b.js` | y |\n';

function seed(root, id, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({ task: 'task ' + id.slice(0, 1), stage: 'plan', active: true,
    started: new Date(Date.now() - 3600e3).toISOString(), updated: new Date().toISOString() }, over);
  fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(data) + '\n');
}

function intends(dir, file) {
  const cfg = path.join(dir, 'cfg');
  return execFileSync(process.execPath, [SCRIPT, 'intends', file, '--session', A, '--root', dir, '--claude-dir', cfg],
    { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

function setup(neighbour) {
  const dir = tmp('fankeel-intends-');
  seed(dir, A);
  if (neighbour) seed(dir, B, neighbour);
  fs.writeFileSync(path.join(dir, 'plan.md'), PLAN);
  fs.writeFileSync(path.join(dir, 'x-design.md'), DESIGN);
  return dir;
}

test('a neighbour at build already holding a plan file is a warn', () => {
  const dir = setup({ task: 'their build', stage: 'build', claims: ['lib/a.js'] });
  const out = intends(dir, path.join(dir, 'plan.md'));
  assert.match(out, /^warn: their build @ build — lib\/a\.js$/m);
  assert.deepEqual(registry.readSession(dir, A).intends, ['lib/a.js', 'tests/a.test.js']);
});

test('a neighbour at design intending the same file is a note', () => {
  const dir = setup({ task: 'their design', stage: 'design', intends: ['tests/a.test.js'] });
  assert.match(intends(dir, path.join(dir, 'plan.md')), /^note: their design @ design — tests\/a\.test\.js$/m);
});

test('nothing shared prints none', () => {
  const dir = setup({ task: 'elsewhere', stage: 'build', claims: ['other.js'] });
  assert.match(intends(dir, path.join(dir, 'plan.md')), /^none$/m);
});

test('a design file is read through its file table', () => {
  const dir = setup(null);
  intends(dir, path.join(dir, 'x-design.md'));
  assert.deepEqual(registry.readSession(dir, A).intends, ['lib/b.js']);
});

test('intends is capped at MAX_INTENDS, same as claims', () => {
  assert.equal(registry.MAX_INTENDS, 60);
});
