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
  assert.deepEqual(suite.parseTap('TAP version 13\n# pass 12\n# fail 1\n'), { pass: 12, fail: 1, failed: [] });
  assert.deepEqual(suite.parseTap('ok\n'), { pass: null, fail: null, failed: [] });
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

test('parseTap keeps the leaf name of each not ok line, not its failing parent, and no TODO', () => {
  const tap = ['    not ok 1 - leaf one', '    ok 2 - leaf ok', 'not ok 1 - outer', 'not ok 2 - a', 'not ok 3 - b # TODO', '# pass 1', '# fail 3'].join('\n');
  assert.deepEqual(suite.parseTap(tap).failed, ['leaf one', 'a']);
});

test('a red run records the failing test names in suite.json, a green one none', () => {
  const dir = repo();
  assert.deepEqual(suite.runSuite(dir, 'node --test').failed, []);
  fs.writeFileSync(path.join(dir, 'a.test.js'), RED);
  const red = suite.runSuite(dir, 'node --test');
  assert.deepEqual(red.failed, ['a']);
  const file = suite.record(dir, DATA, red);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).failed, ['a']);
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

test('an entry whose worktree is gone: blocker refuses and suite.js records nothing', () => {
  const dir = repo();
  const data = { ...DATA, worktree: { path: '.fankeel/worktrees/gone', branch: 'fk/gone' } };
  assert.match(suite.blocker(dir, data, dir), /\.fankeel\/worktrees\/gone is not a worktree any more — land stops$/);
  registry.writeSession(dir, 'abcdef0123', data);
  const r = main(['--session', 'abcdef0123', '--root', dir]);
  assert.equal(r.ok, false);
  assert.match(r.text, /^suite: \.fankeel\/worktrees\/gone is not a worktree any more$/);
  assert.equal(suite.readRecord(dir, data), null);
});

test('a suite record that does not parse refuses where package.json has no test script', () => {
  const dir = tmp('fankeel-suite-');
  assert.equal(suite.blocker(dir, DATA, dir), null);
  const file = suite.recordPath(dir, DATA);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{not json');
  assert.match(suite.blocker(dir, DATA, dir), /^suite record at .*suite\.json does not parse — run suite\.js again$/);
});

test('a green record whose tree git cannot read HEAD in refuses', () => {
  const dir = tmp('fankeel-suite-');
  fs.mkdirSync(path.join(dir, 'plain'));
  fs.writeFileSync(path.join(dir, 'plain', 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  const data = { ...DATA, worktree: { path: 'plain', branch: 'fk/plain' } };
  suite.record(dir, data, { sha: 'a'.repeat(40), at: 'now', command: 'node --test', pass: 1, fail: 0, ok: true });
  assert.match(suite.blocker(dir, data, dir), /^suite ran at aaaaaaaa and git cannot read HEAD in .*plain — run suite\.js again$/);
});

test('suite.js prints "suite: <pass> pass, <fail> fail @ <sha8>" with the record\'s own numbers', () => {
  const dir = repo();
  registry.writeSession(dir, 'abcdef0123', { ...DATA });
  const r = main(['--session', 'abcdef0123', '--root', dir]);
  const m = /^suite: (\d+) pass, (\d+) fail @ [0-9a-f]{8}$/.exec(r.text);
  assert.ok(m, r.text);
  const rec = suite.readRecord(dir, DATA);
  assert.equal(Number(m[1]), rec.pass);
  assert.equal(Number(m[2]), rec.fail);
});

test('--tree runs the suite in a worktree the entry does not know, and blocker checks against that tree while it exists', () => {
  const dir = repo();
  const wt = path.join(tmp('fankeel-suite-manual-'), 'wt');
  git(dir, ['worktree', 'add', '-q', '-b', 'manual', wt]);
  fs.writeFileSync(path.join(wt, 'lib.js'), 'x\n');
  git(wt, ['add', '.']);
  git(wt, ['commit', '-qm', 'code']);
  const wtHead = git(wt, ['rev-parse', 'HEAD']);
  registry.writeSession(dir, 'abcdef0124', DATA);
  const bare = main(['--session', 'abcdef0124', '--root', dir, '--tree']);
  assert.equal(bare.ok, false);
  assert.equal(bare.text, 'suite: --tree needs a directory.');
  const missing = main(['--session', 'abcdef0124', '--root', dir, '--tree', path.join(wt, 'nope')]);
  assert.equal(missing.ok, false);
  assert.match(missing.text, /^suite: --tree .* does not exist$/);
  assert.equal(suite.readRecord(dir, DATA), null);
  const r = main(['--session', 'abcdef0124', '--root', dir, '--tree', wt]);
  assert.equal(r.ok, true);
  assert.ok(r.text.endsWith('@ ' + wtHead.slice(0, 8)), r.text);
  const rec = suite.readRecord(dir, DATA);
  assert.equal(rec.sha, wtHead);
  assert.equal(rec.tree, path.resolve(wt));
  assert.equal(suite.blocker(dir, DATA, dir), null);
  git(dir, ['worktree', 'remove', '--force', wt]);
  assert.match(suite.blocker(dir, DATA, dir), /^suite ran at [0-9a-f]{8}, and lib\.js changed since — run suite\.js again$/);
});

test('--tree is refused for an entry with its own worktree, and for a directory that is not this project\'s checkout; blocker ignores a record\'s tree in both cases', () => {
  const dir = repo();
  const rel = '.fankeel/worktrees/abcdef01';
  git(dir, ['worktree', 'add', '-q', '-b', 'fk/abcdef01', path.join(dir, rel)]);
  const data = { ...DATA, worktree: { path: rel, branch: 'fk/abcdef01' } };
  registry.writeSession(dir, 'abcdef0123', data);
  const other = path.join(tmp('fankeel-suite-manual-'), 'wt');
  git(dir, ['worktree', 'add', '-q', '-b', 'manual', other]);
  const refused = main(['--session', 'abcdef0123', '--root', dir, '--tree', other]);
  assert.equal(refused.ok, false);
  assert.match(refused.text, /has its own worktree/);
  fs.writeFileSync(path.join(dir, rel, 'lib.js'), 'x\n');
  git(path.join(dir, rel), ['add', '.']);
  git(path.join(dir, rel), ['commit', '-qm', 'code']);
  suite.record(dir, data, { sha: git(other, ['rev-parse', 'HEAD']), at: 'now', command: 'node --test', pass: 1, fail: 0, ok: true, tree: other });
  assert.match(suite.blocker(dir, data, dir), /changed since|run suite\.js again/);

  const foreign = repo();
  fs.writeFileSync(path.join(foreign, 'extra.js'), 'z\n');
  git(foreign, ['add', '.']);
  git(foreign, ['commit', '-qm', 'extra']);
  registry.writeSession(dir, 'abcdef0124', DATA);
  const notMine = main(['--session', 'abcdef0124', '--root', dir, '--tree', foreign]);
  assert.equal(notMine.ok, false);
  assert.match(notMine.text, /is not a checkout of/);
  suite.record(dir, DATA, { sha: git(foreign, ['rev-parse', 'HEAD']), at: 'now', command: 'node --test', pass: 1, fail: 0, ok: true, tree: foreign });
  assert.notEqual(suite.blocker(dir, DATA, dir), null);
});
