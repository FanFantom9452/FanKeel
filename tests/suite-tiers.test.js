'use strict';
// .fankeel/suite.json (spec 2026-11-01 §1): lib/suite.js reads the two tiers,
// runs one in order, and blocker counts a daily tier as a suite to run;
// scripts/suite.js runs daily by default and nightly with --nightly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const suite = require('../lib/suite.js');
const tmp = require('./tmp.js');

// main() takes the machine lock; a scratch one keeps this file off the real
// lock a running suite.js holds, which would make it wait on its own parent.
process.env.FANKEEL_SUITE_LOCK = path.join(tmp('fankeel-suitelock-'), 'suite.lock');
delete process.env.FANKEEL_SUITE_HELD;

const DATA = { task: 't', stage: 'land', active: true, started: '2026-09-19T09:30:12.345Z' };
const OK = 'node -e "process.exit(0)"';
const RED = 'node -e "process.exit(1)"';
// Leaves `ran` in its cwd, so a test can see where, and whether, an entry ran.
const MARK = "node -e \"require('fs').writeFileSync('ran', '')\"";

// A scratch tree holding .fankeel/suite.json — an object is written as JSON,
// a string as it is — and one directory per name in dirs.
function project(decl, dirs = []) {
  const dir = tmp('fankeel-tiers-');
  fs.mkdirSync(path.join(dir, '.fankeel'));
  for (const d of dirs) fs.mkdirSync(path.join(dir, d), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'suite.json'), typeof decl === 'string' ? decl : JSON.stringify(decl));
  return dir;
}

test('declared: null with no file, { error } where it does not parse, and both tiers with a missing one as []', () => {
  assert.equal(suite.declared(tmp('fankeel-tiers-')), null);
  assert.deepEqual(suite.declared(project('{')), { error: '.fankeel/suite.json does not parse' });
  const dir = project({ daily: [{ dir: 'a', run: ' npm test ' }, { dir: '.', run: OK }] }, ['a']);
  assert.deepEqual(suite.declared(dir), { daily: [{ dir: 'a', run: 'npm test' }, { dir: '.', run: OK }], nightly: [] });
});

test('declared: the wrong shape is an { error } naming where', () => {
  assert.deepEqual(suite.declared(project('[]')), { error: '.fankeel/suite.json is not an object' });
  assert.deepEqual(suite.declared(project({ daily: {} })), { error: '.fankeel/suite.json: daily is not an array' });
  assert.deepEqual(suite.declared(project({ nightly: [{ dir: 'a' }] }, ['a'])), { error: '.fankeel/suite.json: nightly[0] needs a string dir and a non-empty run' });
  assert.deepEqual(suite.declared(project({ daily: [null] })), { error: '.fankeel/suite.json: daily[0] needs a string dir and a non-empty run' });
  assert.deepEqual(suite.declared(project({ daily: [{ dir: '../x', run: OK }] })), { error: '.fankeel/suite.json: daily[0] dir ../x is outside the tree' });
  assert.deepEqual(suite.declared(project({ daily: [{ dir: 'gone', run: OK }] })), { error: '.fankeel/suite.json: daily[0] dir gone does not exist' });
});

test('runDeclared runs each entry in its own dir, in order, and stops at the first red, naming it', () => {
  const dir = project({}, ['a', 'b', 'c']);
  const r = suite.runDeclared(dir, 'daily', [{ dir: 'a', run: MARK }, { dir: 'b', run: RED }, { dir: 'c', run: MARK }]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.redAt, { dir: 'b', run: RED });
  assert.equal(r.command, '.fankeel/suite.json daily');
  assert.equal(r.tier, 'daily');
  assert.ok(fs.existsSync(path.join(dir, 'a', 'ran')), 'a did not run in a/');
  assert.ok(!fs.existsSync(path.join(dir, 'c', 'ran')), 'c ran after b was red');
  assert.ok(!fs.existsSync(path.join(dir, 'ran')), 'an entry ran in the tree, not in its dir');
});

test('runDeclared: all green is ok with no redAt; totals are summed only where every entry gave them', () => {
  const dir = project({}, ['a', 'b']);
  const green = suite.runDeclared(dir, 'nightly', [{ dir: 'a', run: OK }, { dir: 'b', run: OK }]);
  assert.equal(green.ok, true);
  assert.equal(green.redAt, undefined);
  assert.equal(green.pass, null);
  const fake = (results) => { const left = [...results]; return () => left.shift(); };
  const r = (o) => ({ sha: 'a'.repeat(40), at: 'now', command: 'x', pass: null, fail: null, failed: null, ok: true, ms: 5, stdout: '', ...o });
  const both = suite.runDeclared(dir, 'daily', [{ dir: 'a', run: 'x' }, { dir: 'b', run: 'y' }], {}, {},
    fake([r({ pass: 2, fail: 0, failed: [] }), r({ pass: 3, fail: 1, failed: ['t'], ok: false, stdout: 'TAP' })]));
  assert.deepEqual([both.pass, both.fail, both.failed, both.ms, both.stdout, both.sha], [5, 1, ['t'], 10, 'TAP', 'a'.repeat(40)]);
  const mixed = suite.runDeclared(dir, 'daily', [{ dir: 'a', run: 'x' }, { dir: 'b', run: 'y' }], {}, {},
    fake([r({ pass: 2, fail: 0, failed: [] }), r({})]));
  assert.deepEqual([mixed.pass, mixed.fail, mixed.failed], [null, null, null]);
});

test('blocker: a daily tier with no record is a suite to run; a suite.json that does not parse is refused by name; nightly alone is not', () => {
  const dir = project({ daily: [{ dir: '.', run: OK }] });
  assert.match(suite.blocker(dir, DATA, dir), /^no suite record/);
  const bad = project('{');
  assert.equal(suite.blocker(bad, DATA, bad), '.fankeel/suite.json does not parse — fix it, then run suite.js');
  const nightlyOnly = project({ nightly: [{ dir: '.', run: OK }] });
  assert.equal(suite.blocker(nightlyOnly, DATA, nightlyOnly), null);
});
