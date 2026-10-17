'use strict';
// lib/suitelock.js: one scripts/suite.js at a time on this machine.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const lock = require('../lib/suitelock.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const scratch = () => path.join(tmp('fankeel-suitelock-'), 'suite.lock');
const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid;
const hold = (file, holder) => fs.writeFileSync(file, JSON.stringify(holder));
const waited = () => { throw new Error('waited'); };

test('lockFile is FANKEEL_SUITE_LOCK when set, else fankeel-suite.lock in the temp directory', () => {
  assert.equal(lock.lockFile({ FANKEEL_SUITE_LOCK: 'x.lock' }), 'x.lock');
  assert.equal(path.basename(lock.lockFile({})), 'fankeel-suite.lock');
});

test('acquire writes this pid into a free lock, and release removes it', () => {
  const file = scratch();
  const h = lock.acquire({ file, owner: { session: 's1', tree: 't' }, onWait: waited });
  const held = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(held.pid, process.pid);
  assert.equal(held.session, 's1');
  h.release();
  assert.equal(fs.existsSync(file), false);
});

test('a lock held by a live pid waits: onWait gets the holder, not stuck', () => {
  const file = scratch();
  hold(file, { pid: process.pid, at: new Date().toISOString(), session: 'other' });
  let seen = null;
  let stuck = null;
  assert.throws(() => lock.acquire({ file, onWait: (h, s) => { seen = h; stuck = s; waited(); } }), /waited/);
  assert.equal(seen.session, 'other');
  assert.equal(stuck, false);
});

test('a lock whose pid is dead is cleared and taken', () => {
  const file = scratch();
  hold(file, { pid: deadPid(), at: new Date().toISOString() });
  lock.acquire({ file, onWait: waited }).release();
});

test('a lock older than maxAgeMs is cleared and taken even when its pid is alive', () => {
  const file = scratch();
  hold(file, { pid: process.pid, at: new Date(Date.now() - lock.MAX_AGE_MS - 1000).toISOString() });
  lock.acquire({ file, onWait: waited }).release();
});

test('a holder with pid 0 or no pid and a fresh at is cleared and taken', () => {
  const file = scratch();
  hold(file, { pid: 0, at: new Date().toISOString() });
  lock.acquire({ file, onWait: waited }).release();
  hold(file, { at: new Date().toISOString() });
  lock.acquire({ file, onWait: waited }).release();
});

test('a live-pid holder whose at is garbage is cleared and taken', () => {
  const file = scratch();
  hold(file, { pid: process.pid, at: 'garbage' });
  lock.acquire({ file, onWait: waited }).release();
});

test('clearStale removes the holder it was given, and puts back a different lock it moved aside', () => {
  const file = scratch();
  const dir = path.dirname(file);
  const h1 = { pid: 1, at: 'a' };
  const h2 = { pid: 2, at: 'b' };
  hold(file, h2);
  assert.equal(lock.clearStale(file, h1), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), h2);
  assert.deepEqual(fs.readdirSync(dir), ['suite.lock']);
  assert.equal(lock.clearStale(file, JSON.parse(fs.readFileSync(file, 'utf8'))), true);
  assert.deepEqual(fs.readdirSync(dir), []);
  assert.equal(lock.clearStale(file, h1), false);
});

test('a lock that does not parse waits while it is fresh, and is cleared once it is not', () => {
  const file = scratch();
  fs.writeFileSync(file, '');
  assert.throws(() => lock.acquire({ file, onWait: waited }), /waited/);
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(file, old, old);
  lock.acquire({ file, onWait: waited }).release();
});

test('release leaves a lock another pid holds', () => {
  const file = scratch();
  const h = lock.acquire({ file, onWait: waited });
  hold(file, { pid: process.pid + 1, at: new Date().toISOString() });
  h.release();
  assert.equal(fs.existsSync(file), true);
});

test('a lock reading null or [], or a directory at the lock path, is unreadable: waited on while fresh, cleared once old', () => {
  const file = scratch();
  for (const text of ['null', '[]']) {
    fs.writeFileSync(file, text);
    assert.throws(() => lock.acquire({ file, onWait: waited }), /waited/, text);
  }
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(file, old, old);
  lock.acquire({ file, onWait: waited }).release();
  const dir = scratch();
  fs.mkdirSync(dir);
  fs.utimesSync(dir, old, old);
  lock.acquire({ file: dir, onWait: waited }).release();
});

test('sleepMs, the one wait suitelock polls with, blocks for at least the time it is given', () => {
  const t0 = Date.now();
  registry.sleepMs(40);
  assert.ok(Date.now() - t0 >= 35, 'sleepMs returned early');
});
