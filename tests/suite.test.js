'use strict';
// lib/suite.js and scripts/suite.js: the full suite's record, and the three
// reasons `task.js land` refuses on it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const suite = require('../lib/suite.js');
const registry = require('../lib/registry.js');
const { main } = require('../scripts/suite.js');
const tmp = require('./tmp.js');

const git = (dir, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
const DATA = { task: 't', stage: 'land', active: true, started: '2026-09-19T09:30:12.345Z' };
const GREEN = "const test = require('node:test'); test('a', () => {});\n";
const RED = "const test = require('node:test'); test('a', () => { throw new Error('no'); });\n";

function repo() {
  const dir = tmp('fankeel-suite-');
  git(dir, ['init', '-q']);
  fs.mkdirSync(path.join(dir, '.fankeel'));
  fs.writeFileSync(path.join(dir, '.fankeel', '.gitignore'), 'build/\n');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { test: 'node --test' } }));
  fs.writeFileSync(path.join(dir, 'a.test.js'), GREEN);
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'a']);
  return dir;
}

test('parseTap reads node --test totals and gives null where there are none', () => {
  assert.deepEqual(suite.parseTap('TAP version 13\n# pass 12\n# fail 1\n'), { pass: 12, fail: 1 });
  assert.deepEqual(suite.parseTap('ok\n'), { pass: null, fail: null });
});

test('runSuite records a green node --test run with its sha, and a red one as not ok', () => {
  const dir = repo();
  const green = suite.runSuite(dir, suite.testCommand(dir));
  assert.equal(green.ok, true);
  assert.equal(green.pass, 1);
  assert.equal(green.fail, 0);
  assert.equal(green.sha, git(dir, ['rev-parse', 'HEAD']));
  fs.writeFileSync(path.join(dir, 'a.test.js'), RED);
  const red = suite.runSuite(dir, 'node --test');
  assert.equal(red.ok, false);
  assert.equal(red.fail, 1);
});

test('blocker: no record where a suite is runnable; a red record; a record older than a code change; null otherwise', () => {
  const dir = repo();
  const sha = git(dir, ['rev-parse', 'HEAD']);
  assert.match(suite.blocker(dir, DATA, dir), /^no suite record/);
  suite.record(dir, DATA, { sha, at: 'now', command: 'node --test', pass: 1, fail: 2, ok: false });
  assert.match(suite.blocker(dir, DATA, dir), /^suite is red at [0-9a-f]{8} \(2 fail\) — land stops$/);
  suite.record(dir, DATA, { sha, at: 'now', command: 'node --test', pass: 3, fail: 0, ok: true });
  assert.equal(suite.blocker(dir, DATA, dir), null);
  suite.record(dir, DATA, { sha, at: 'now', command: 'x', pass: null, fail: null, ok: false });
  assert.match(suite.blocker(dir, DATA, dir), /^suite is red at [0-9a-f]{8} — land stops$/);
  suite.record(dir, DATA, { sha, at: 'now', command: 'node --test', pass: 3, fail: 0, ok: true });
  fs.writeFileSync(path.join(dir, 'README.md'), '# docs only\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'docs']);
  assert.equal(suite.blocker(dir, DATA, dir), null, 'a .md change after the run does not stale it');
  fs.writeFileSync(path.join(dir, 'lib.js'), 'x\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'code']);
  assert.match(suite.blocker(dir, DATA, dir), /^suite ran at [0-9a-f]{8}, and lib\.js changed since — run suite\.js again$/);
  fs.writeFileSync(path.join(dir, 'lib2.js'), 'y\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'code2']);
  assert.match(suite.blocker(dir, DATA, dir), /^suite ran at [0-9a-f]{8}, and lib\.js and 1 more changed since — run suite\.js again$/);
});

test('a package.json that does not parse is refused by name, by blocker and by the script', () => {
  const dir = tmp('fankeel-suite-');
  fs.writeFileSync(path.join(dir, 'package.json'), '{');
  assert.match(suite.blocker(dir, DATA, dir), /^package\.json does not parse —/);
  registry.writeSession(dir, 'abcdef0123', { ...DATA });
  const r = main(['--session', 'abcdef0123', '--root', dir]);
  assert.equal(r.ok, false);
  assert.match(r.text, /package\.json does not parse/);
});

test('blocker is null with no record where nothing is runnable, and null where the entry has no started stamp', () => {
  const dir = tmp('fankeel-suite-');
  assert.equal(suite.blocker(dir, DATA, dir), null);
  assert.equal(suite.recordPath(dir, { task: 't' }), null);
});

test('scripts/suite.js needs a session', () => {
  const r = main([]);
  assert.equal(r.ok, false);
  assert.match(r.text, /--session <id> is required/);
});

test('an entry with its own worktree: suite.js records that tree\'s HEAD and blocker checks against it', () => {
  const dir = repo();
  const mainHead = git(dir, ['rev-parse', 'HEAD']);
  const rel = '.fankeel/worktrees/abcdef01';
  git(dir, ['worktree', 'add', '-q', '-b', 'fk/abcdef01', path.join(dir, rel)]);
  const wt = path.join(dir, rel);
  fs.writeFileSync(path.join(wt, 'lib.js'), 'x\n');
  git(wt, ['add', '.']);
  git(wt, ['commit', '-qm', 'code']);
  const wtHead = git(wt, ['rev-parse', 'HEAD']);
  const data = { ...DATA, worktree: { path: rel, branch: 'fk/abcdef01' } };
  registry.writeSession(dir, 'abcdef0123', data);
  const r = main(['--session', 'abcdef0123', '--root', dir]);
  assert.equal(r.ok, true);
  assert.ok(r.text.endsWith('@ ' + wtHead.slice(0, 8)), r.text);
  assert.equal(suite.readRecord(dir, data).sha, wtHead);
  assert.equal(suite.blocker(dir, data, dir), null);
  suite.record(dir, data, { sha: mainHead, at: 'now', command: 'node --test', pass: 1, fail: 0, ok: true });
  assert.match(suite.blocker(dir, data, dir), /^suite ran at [0-9a-f]{8}, and lib\.js changed since — run suite\.js again$/);
});
