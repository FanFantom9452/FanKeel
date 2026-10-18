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
const tmp = require('./tmp.js');

// main() takes the machine lock; a scratch one keeps this file off the real
// lock a running suite.js holds, which would make it wait on its own parent.
process.env.FANKEEL_SUITE_LOCK = path.join(tmp('fankeel-suitelock-'), 'suite.lock');
delete process.env.FANKEEL_SUITE_HELD;
const { main, waitLine } = require('../scripts/suite.js');

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

test('runSuite records a green node --test run with its sha, and a red one as not ok @slow', () => {
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

test('runSuite records how long the run took in whole milliseconds, and record keeps it in the run and in runs', () => {
  const dir = repo();
  const r = suite.runSuite(dir, 'node -e "setTimeout(() => {}, 50)"');
  assert.ok(Number.isInteger(r.ms) && r.ms >= 20, 'ms was ' + r.ms);
  const file = suite.record(dir, DATA, r);
  const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(rec.ms, r.ms, 'the top level lost ms');
  assert.equal(rec.runs[rec.runs.length - 1].ms, r.ms, 'the entry in runs lost ms');
});

test('a red run records the failing test names in suite.json, a green one none @slow', () => {
  const dir = repo();
  assert.deepEqual(suite.runSuite(dir, 'node --test').failed, []);
  fs.writeFileSync(path.join(dir, 'a.test.js'), RED);
  const red = suite.runSuite(dir, 'node --test');
  assert.deepEqual(red.failed, ['a']);
  const file = suite.record(dir, DATA, red);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).failed, ['a']);
});

test('blocker: no record where a suite is runnable; a red record; a record older than a code change; null otherwise @slow', () => {
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

test('an entry with its own worktree: suite.js records that tree\'s HEAD and blocker checks against it @slow', () => {
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

test('--tree runs the suite in a worktree the entry does not know, and blocker checks against that tree while it exists @slow', () => {
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

test('--tree is refused for an entry with its own worktree, and for a directory that is not this project\'s checkout; blocker ignores a record\'s tree in both cases @slow', () => {
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

test('record keeps every run: the top level is the last one, runs holds them in order, and redBefore names the red ones before it', () => {
  const dir = repo();
  const sha = git(dir, ['rev-parse', 'HEAD']);
  suite.record(dir, DATA, { sha, at: 'one', command: 'node --test', pass: 1, fail: 1, failed: ['flaky one'], ok: false });
  suite.record(dir, DATA, { sha, at: 'two', command: 'node --test', pass: 2, fail: 0, failed: [], ok: true });
  const rec = suite.readRecord(dir, DATA);
  assert.equal(rec.ok, true);
  assert.equal(rec.at, 'two');
  assert.equal(rec.runs.length, 2);
  assert.deepEqual(rec.runs.map((r) => r.at), ['one', 'two']);
  assert.deepEqual(suite.redBefore(rec), [{ run: 1, sha, failed: ['flaky one'] }]);
  assert.equal(suite.blocker(dir, DATA, dir), null, 'blocker still reads the last run off the top level');
  suite.record(dir, DATA, rec);
  const again = suite.readRecord(dir, DATA);
  assert.equal(again.runs.length, 3);
  assert.equal('runs' in again.runs[2], false, 'a run never carries the list it sits in');
  assert.deepEqual(suite.redBefore({ sha, ok: true }), [], 'a record from before runs existed names nothing');
  assert.deepEqual(suite.redBefore(null), []);
  for (let i = 0; i < 25; i++) suite.record(dir, DATA, { sha, at: 'n' + i, command: 'x', pass: null, fail: null, failed: null, ok: true });
  const kept = suite.readRecord(dir, DATA).runs;
  assert.equal(kept.length, 20);
  assert.equal(kept[19].at, 'n24');
});

test('--check runs no test and writes nothing: a standing record exits 0, no record and a stale one exit 1, nothing to run exits 0', () => {
  const dir = repo();
  registry.writeSession(dir, 'abcdef0125', { ...DATA });
  const none = main(['--session', 'abcdef0125', '--root', dir, '--check']);
  assert.equal(none.ok, false);
  assert.match(none.text, /^suite: no suite record — /);
  assert.equal(suite.readRecord(dir, DATA), null, '--check wrote a record');
  assert.equal(main(['--session', 'abcdef0125', '--root', dir]).ok, true);
  const file = suite.recordPath(dir, DATA);
  const before = fs.readFileSync(file, 'utf8');
  const mtime = fs.statSync(file).mtimeMs;
  // Red in the working tree and not committed: a run would fail on it, a check never sees it.
  fs.writeFileSync(path.join(dir, 'a.test.js'), RED);
  const stands = main(['--session', 'abcdef0125', '--root', dir, '--check']);
  assert.equal(stands.ok, true);
  assert.equal(stands.text, 'suite: record stands @ ' + git(dir, ['rev-parse', 'HEAD']).slice(0, 8));
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(fs.statSync(file).mtimeMs, mtime);
  fs.writeFileSync(path.join(dir, 'lib.js'), 'x\n');
  git(dir, ['add', 'lib.js']);
  git(dir, ['commit', '-qm', 'code']);
  const stale = main(['--session', 'abcdef0125', '--root', dir, '--check']);
  assert.equal(stale.ok, false);
  assert.match(stale.text, /^suite: suite ran at [0-9a-f]{8}, and lib\.js changed since — run suite\.js again$/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  const bare = tmp('fankeel-suite-');
  registry.writeSession(bare, 'abcdef0126', { ...DATA });
  const nothing = main(['--session', 'abcdef0126', '--root', bare, '--check']);
  assert.equal(nothing.ok, true);
  assert.equal(nothing.text, 'suite: no suite to run');
});

test('--check on a green record with no sha says record stands @ no repo', () => {
  const dir = tmp('fankeel-suite-');
  registry.writeSession(dir, 'abcdef0127', { ...DATA });
  suite.record(dir, DATA, { sha: null, at: 'now', command: 'x', pass: null, fail: null, failed: null, ok: true });
  const r = main(['--session', 'abcdef0127', '--root', dir, '--check']);
  assert.equal(r.ok, true);
  assert.equal(r.text, 'suite: record stands @ no repo');
});

const { spawn } = require('node:child_process');
const SUITE = path.join(__dirname, '..', 'scripts', 'suite.js');

test('suite.js removes its lock when the run ends, so the next run in this process does not wait on it', () => {
  const dir = repo();
  registry.writeSession(dir, 'abcdef0134', { ...DATA });
  assert.equal(main(['--session', 'abcdef0134', '--root', dir]).ok, true);
  assert.equal(fs.existsSync(process.env.FANKEEL_SUITE_LOCK), false, 'suite.js left its lock behind');
});

function runChild(args, env) {
  const child = spawn(process.execPath, [SUITE, ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  const done = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  return { child, done, out: () => out };
}

test('suite.js waits while a live pid holds the lock, says on what, and runs once it is released', { timeout: 60000 }, async () => {
  const dir = repo();
  registry.writeSession(dir, 'abcdef0130', { ...DATA });
  const file = path.join(tmp('fankeel-suitelock-'), 'suite.lock');
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), session: 'neighbour', tree: 'F:/elsewhere' }));
  const run = runChild(['--session', 'abcdef0130', '--root', dir], { FANKEEL_SUITE_LOCK: file });
  try {
    // Poll for the line rather than sleep a fixed time: this file runs on a loaded machine.
    for (let t = Date.now(); !/^suite: waiting/m.test(run.out()) && run.child.exitCode === null && Date.now() - t < 20000;) {
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(run.child.exitCode, null, 'suite.js ran while the lock was held');
    assert.match(run.out(), /^suite: waiting — pid \d+ \(session neighbour\) has run the suite in F:\/elsewhere since \d\d:\d\d; lock .*suite\.lock$/m);
  } catch (e) {
    run.child.kill();
    throw e;
  }
  fs.unlinkSync(file);
  assert.equal(await run.done, 0);
  assert.match(run.out(), /^suite: 1 pass, 0 fail @ [0-9a-f]{8}$/m);
  assert.equal(fs.existsSync(file), false, 'suite.js left its lock behind');
});

test('suite.js takes no lock where FANKEEL_SUITE_HELD names its lock file — the suite that spawned it holds it', { timeout: 30000 }, async () => {
  const dir = repo();
  registry.writeSession(dir, 'abcdef0131', { ...DATA });
  const file = path.join(tmp('fankeel-suitelock-'), 'suite.lock');
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  const run = runChild(['--session', 'abcdef0131', '--root', dir], { FANKEEL_SUITE_LOCK: file, FANKEEL_SUITE_HELD: file });
  const timer = setTimeout(() => run.child.kill(), 25000);
  assert.equal(await run.done, 0, 'suite.js waited on the lock its parent holds');
  clearTimeout(timer);
  assert.doesNotMatch(run.out(), /waiting/);
});

test('--fast runs test:fast, which skips @slow, and records fast: true; blocker refuses that record and takes the next full one', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { test: 'node --test', 'test:fast': 'node --test --test-skip-pattern=@slow' } }));
  fs.writeFileSync(path.join(dir, 'b.test.js'), "const test = require('node:test'); test('b @slow', () => { throw new Error('slow'); });\n");
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'slow']);
  registry.writeSession(dir, 'abcdef0132', { ...DATA });
  const fast = main(['--session', 'abcdef0132', '--root', dir, '--fast']);
  assert.equal(fast.ok, true, fast.text);
  assert.equal(suite.readRecord(dir, DATA).fast, true);
  assert.match(suite.blocker(dir, DATA, dir), /^suite ran the fast set at [0-9a-f]{8} — land runs everything: node scripts\/suite\.js --session <id>$/);
  fs.writeFileSync(path.join(dir, 'b.test.js'), "const test = require('node:test'); test('b @slow', () => {});\n");
  git(dir, ['commit', '-qam', 'green']);
  const full = main(['--session', 'abcdef0132', '--root', dir]);
  assert.equal(full.ok, true, full.text);
  assert.equal(suite.readRecord(dir, DATA).fast, undefined);
  assert.equal(suite.blocker(dir, DATA, dir), null);
});

test('--fast where package.json has no test:fast runs test, says so, and records no fast', () => {
  const dir = repo();
  registry.writeSession(dir, 'abcdef0133', { ...DATA });
  const r = main(['--session', 'abcdef0133', '--root', dir, '--fast']);
  assert.equal(r.ok, true);
  assert.match(r.text, /^suite: 1 pass, 0 fail @ [0-9a-f]{8} \(no test:fast script — ran the whole suite\)$/);
  assert.equal(suite.readRecord(dir, DATA).fast, undefined);
});

test('package.json: test is everything, test:fast skips the @slow tag', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.test, 'node --test --require ./tests/subprocess-timeout.js');
  assert.equal(pkg.scripts['test:fast'], 'node --test --test-skip-pattern=@slow --require ./tests/subprocess-timeout.js');
});

test('waitLine names the live holder, and says a stuck dead lock must be deleted by hand', () => {
  const h = { pid: 42, session: 's', tree: 'T', at: new Date(2026, 9, 16, 9, 5).toISOString() };
  assert.equal(waitLine(h, 'x.lock', false), 'suite: waiting — pid 42 (session s) has run the suite in T since 09:05; lock x.lock');
  assert.equal(waitLine(h, 'x.lock', true), 'suite: waiting — lock x.lock is stale and could not be removed; delete it by hand');
});
