'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const live = require('../lib/live.js');

const SID = '23916a07-5213-4e61-a3f0-70b5c462fd82';
const OTHER = '8f2c1d90-0000-4000-8000-000000000001';

// A pid no operating system hands out: Linux caps `pid_max` at 2^22 and Windows
// never comes near it, so signalling it is ESRCH on both. Spawning a process and
// waiting for it to die would test the same thing while leaving the answer to
// whether the pid got reused in the meantime.
const GONE_PID = 2147483646;

function tmpConfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-live-'));
  fs.mkdirSync(path.join(dir, 'sessions'));
  return dir;
}

// Named for the pid and carrying it inside, which is how Claude Code writes them.
function seed(configDir, pid, sessionId) {
  const data = {
    pid,
    sessionId,
    cwd: 'F:\\ymlab\\fankeel',
    startedAt: Date.now(),
    procStart: '134310286479529478',
    version: '2.1.228',
    kind: 'interactive',
    entrypoint: 'cli',
    status: 'idle',
  };
  fs.writeFileSync(path.join(configDir, 'sessions', pid + '.json'), JSON.stringify(data));
}

function seedRaw(configDir, name, text) {
  fs.writeFileSync(path.join(configDir, 'sessions', name), text);
}

// `process.ppid` is the runner that spawned this file and is waiting on its
// result, so it is a second real pid that cannot have gone while the test runs.
test('a session whose file is there and whose pid is running is live', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  seed(dir, process.ppid, OTHER);
  const state = live.readLive(dir, SID);
  assert.equal(state.known, true);
  assert.equal(live.isLive(state, OTHER), true);
});

// Claude Code deletes its own entry on a clean exit, so the file being gone is
// the exit itself rather than a hint about one.
test('a session with no file in the registry has exited', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  const state = live.readLive(dir, SID);
  assert.equal(state.known, true);
  assert.equal(live.isLive(state, OTHER), false);
});

// The orphan a crash leaves behind, which is why the pid is checked and not just
// the file counted.
test('an orphaned file whose pid is gone is not live', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  seed(dir, GONE_PID, OTHER);
  const state = live.readLive(dir, SID);
  assert.equal(state.known, true);
  assert.equal(live.isLive(state, OTHER), false);
});

// Stubbed rather than aimed at a real privileged pid, because which pid answers
// EPERM is a fact about the platform and this is a fact about the branch.
test('a pid this user cannot signal counts as dead rather than live', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  seed(dir, 4, OTHER);
  const real = process.kill;
  process.kill = (pid, signal) => {
    if (pid === 4) {
      const err = new Error('kill EPERM');
      err.code = 'EPERM';
      throw err;
    }
    return real.call(process, pid, signal);
  };
  try {
    const state = live.readLive(dir, SID);
    assert.equal(state.known, true);
    assert.equal(live.isLive(state, OTHER), false);
  } finally {
    process.kill = real;
  }
});

// The whole fallback rests on this: the session doing the reading is running, so
// a registry that cannot see it is not the registry this machine is using.
test('a registry this session cannot find itself in makes liveness unknown', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, OTHER);
  const state = live.readLive(dir, SID);
  assert.equal(state.known, false);
  assert.equal(state.ids.size, 0);
});

test('unknown liveness makes every session live, because unknown means warn', () => {
  const unknown = { known: false, ids: new Set() };
  assert.equal(live.isLive(unknown, SID), true);
  assert.equal(live.isLive(unknown, OTHER), true);
  assert.equal(live.isLive(null, SID), true);
});

test('a file that is not JSON does not take its siblings down with it', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  seed(dir, process.ppid, OTHER);
  seedRaw(dir, '9001.json', '{ not json');
  const state = live.readLive(dir, SID);
  assert.equal(state.known, true);
  assert.equal(live.isLive(state, SID), true);
  assert.equal(live.isLive(state, OTHER), true);
});

// The directory really does hold `.key` files beside the entries, and a version
// that stops writing one of these fields must cost that entry and no other.
test('an entry with no pid, one with no sessionId and a file that is not .json are skipped', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  seedRaw(dir, '4001.json', JSON.stringify({ sessionId: OTHER, status: 'idle' }));
  seedRaw(dir, '4002.json', JSON.stringify({ pid: process.pid }));
  seedRaw(dir, '4003.38b3835161c49faafce33e456866c58.key', 'not json at all');
  const state = live.readLive(dir, SID);
  assert.equal(state.known, true);
  assert.deepEqual([...state.ids], [SID]);
});

// Empty would mean every claim is dead and every warning is suppressed, which is
// the one wrong answer that fails silently.
test('a missing sessions directory is unknown rather than nobody being live', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-live-'));
  const state = live.readLive(dir, SID);
  assert.equal(state.known, false);
  assert.equal(state.ids.size, 0);
  assert.equal(live.isLive(state, OTHER), true);
});

test('liveConfigDir follows CLAUDE_CONFIG_DIR and falls back to ~/.claude', () => {
  const saved = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = 'X:/elsewhere/.claude';
  try {
    assert.equal(live.liveConfigDir(), 'X:/elsewhere/.claude');
    delete process.env.CLAUDE_CONFIG_DIR;
    assert.equal(live.liveConfigDir(), path.join(os.homedir(), '.claude'));
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = saved;
  }
});
