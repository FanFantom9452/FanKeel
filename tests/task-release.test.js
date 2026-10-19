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

function seed(root, id, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({ task: 'task ' + id.slice(0, 1), stage: 'plan', active: true,
    started: new Date(Date.now() - 3600e3).toISOString(), updated: new Date().toISOString() }, over);
  fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(data) + '\n');
}

function release(dir, words) {
  const cfg = path.join(dir, 'cfg');
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, 'release', ...words, '--session', A, '--root', dir],
      { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) }), code: 0 };
  } catch (e) {
    return { out: String(e.stdout || ''), code: e.status };
  }
}

function setup() {
  const dir = tmp('fankeel-release-');
  seed(dir, A, { claims: ['lib/a.js'] });
  seed(dir, B, { task: 'their land', stage: 'land', claims: ['lib/a.js', 'lib/b.js'], notes: ['kept note'], next: 'kept next' });
  return dir;
}

test('two sessions hold one file; release takes it off the neighbour and nothing else of its entry moves', () => {
  const dir = setup();
  const before = registry.readSession(dir, B);
  const r = release(dir, [B, 'lib/a.js']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^fankeel — released from their land @ land: lib\/a\.js$/m);
  const after = registry.readSession(dir, B);
  assert.equal(after.active, true);
  assert.equal(after.stage, 'land');
  assert.deepEqual(after.claims, ['lib/b.js']);
  assert.deepEqual(after.notes, ['kept note']);
  assert.equal(after.next, 'kept next');
  assert.equal(after.started, before.started);
  assert.equal(after.updated, before.updated);
  assert.deepEqual(registry.readSession(dir, A).claims, ['lib/a.js']);
});

test('a path the neighbour does not hold refuses the whole release', () => {
  const dir = setup();
  const r = release(dir, [B, 'lib/a.js', 'lib/c.js']);
  assert.equal(r.code, 1);
  assert.match(r.out, /^Not held by bbbbbbbb-1111-2222-3333-444444444444: lib\/c\.js$/m);
  assert.deepEqual(registry.readSession(dir, B).claims, ['lib/a.js', 'lib/b.js']);
});

test('release refuses this session, a missing path list and a missing entry', () => {
  const dir = setup();
  assert.match(release(dir, [A, 'lib/a.js']).out, /^That is this session\./m);
  assert.match(release(dir, [B]).out, /^Give the paths to release after the session id\.$/m);
  assert.match(release(dir, ['cccccccc-1111-2222-3333-444444444444', 'lib/a.js']).out, /^No entry for cccccccc-/m);
  assert.deepEqual(registry.readSession(dir, A).claims, ['lib/a.js']);
});

test('an entry already stood down is left alone', () => {
  const dir = setup();
  seed(dir, B, { active: false, claims: ['lib/a.js'] });
  const r = release(dir, [B, 'lib/a.js']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /already stood down/);
  assert.deepEqual(registry.readSession(dir, B).claims, ['lib/a.js']);
});

test('the fankeel skill and the registry page name release as the third exception', () => {
  const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel', 'SKILL.md'), 'utf8');
  assert.match(skill, /task\.js release <session-id> <path>\.\.\. --session <id>/);
  assert.match(skill, /and `release`, which takes the\s+paths the user named off its `claims`/);
  assert.match(skill, /`release` is the one exception, and only for paths the user named\./);
  const page = fs.readFileSync(path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'registry.md'), 'utf8');
  assert.match(page, /`task\.js release` for taking named paths off another session's `claims`/);
  assert.match(page, /`release <id>`/);
});
