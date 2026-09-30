'use strict';

// upgrade-2: readTodo returned null for every error, so a TODO.md that is
// there and cannot be read looked like a project with no TODO.md at all.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const upgrade = require('../scripts/upgrade.js');
const tmp = require('./tmp.js');

const PLUGIN = path.join(__dirname, '..');
const SCRIPT = path.join(PLUGIN, 'scripts', 'upgrade.js');

function project() {
  const dir = tmp('fankeel-upgrade-readtodo-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'),
    JSON.stringify({ preset: 'flat', buckets: [{ path: 'docs/todo', role: 'todo' }] }));
  return dir;
}

test('no TODO.md is no step, not an error', () => {
  assert.deepEqual(upgrade.steps(project(), PLUGIN), []);
});

test('a TODO.md that cannot be read is thrown, not read as absent', () => {
  const dir = project();
  fs.mkdirSync(path.join(dir, 'TODO.md'));
  assert.throws(() => upgrade.steps(dir, PLUGIN), (e) => Boolean(e && e.code) && e.code !== 'ENOENT');
});

test('the command line exits non-zero on it rather than saying nothing is pending', () => {
  const dir = project();
  fs.mkdirSync(path.join(dir, 'TODO.md'));
  const r = spawnSync(process.execPath, [SCRIPT, '--root', dir], { cwd: dir, encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: tmp('fankeel-upgrade-readtodo-cfg-') }) });
  assert.notEqual(r.status, 0, r.stdout);
  assert.doesNotMatch(r.stdout, /nothing pending/);
});
