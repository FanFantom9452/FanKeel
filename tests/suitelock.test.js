'use strict';
// lib/suitelock.js: one scripts/suite.js at a time on this machine.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const lock = require('../lib/suitelock.js');
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

test('a lock held by a live pid waits: onWait gets the holder', () => {
  const file = scratch();
  hold(file, { pid: process.pid, at: new Date().toISOString(), session: 'other' });
  let seen = null;
  assert.throws(() => lock.acquire({ file, onWait: (h) => { seen = h; waited(); } }), /waited/);
  assert.equal(seen.session, 'other');
});

test('a lock whose pid is dead, or older than maxAgeMs, is cleared and taken', () => {
  const file = scratch();
  hold(file, { pid: deadPid(), at: new Date().toISOString() });
  lock.acquire({ file, onWait: waited }).release();
  hold(file, { pid: process.pid, at: new Date(Date.now() - lock.MAX_AGE_MS - 1000).toISOString() });
  lock.acquire({ file, onWait: waited }).release();
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
