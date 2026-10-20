'use strict';

// docs/90-agent/todo/test-13.md, item two: a red run's result line ends
// ` — TAP: <path of suite.tap>`, and a green run's carries no such suffix.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');
// main() takes the machine lock; a scratch one keeps this file off the lock a
// running suite.js holds, which would make it wait on its own parent.
process.env.FANKEEL_SUITE_LOCK = path.join(tmp('fankeel-suitelock-'), 'suite.lock');
delete process.env.FANKEEL_SUITE_HELD;
const suite = require('../lib/suite.js');
const registry = require('../lib/registry.js');
const { main } = require('../scripts/suite.js');

const DATA = { task: 't', stage: 'land', active: true, started: '2026-09-19T09:30:12.345Z' };
const git = (dir, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' });

test('a red suite line ends with the TAP path, a green one does not @slow', () => {
  const dir = tmp('fankeel-suite-tap-line-');
  git(dir, ['init', '-q']);
  fs.mkdirSync(path.join(dir, '.fankeel'));
  fs.writeFileSync(path.join(dir, '.fankeel', '.gitignore'), 'build/\n');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { test: 'node --test' } }));
  fs.writeFileSync(path.join(dir, 'a.test.js'), "require('node:test')('a', () => { throw new Error('no'); });\n");
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'a']);
  registry.writeSession(dir, 'abcdef0140', DATA);

  const red = main(['--session', 'abcdef0140', '--root', dir]);
  assert.equal(red.ok, false);
  const tap = suite.tapPath(suite.recordPath(dir, DATA));
  assert.ok(red.text.endsWith(' — TAP: ' + tap), red.text);
  assert.equal(fs.existsSync(tap), true);

  fs.writeFileSync(path.join(dir, 'a.test.js'), "require('node:test')('a', () => {});\n");
  const green = main(['--session', 'abcdef0140', '--root', dir]);
  assert.equal(green.ok, true);
  assert.doesNotMatch(green.text, / — TAP: /);
});
