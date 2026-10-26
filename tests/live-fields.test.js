'use strict';
// station-57: runningSessions keeps what the station needs to list a session
// no registry knows — its pid, how it was started, its name, idle or busy, and
// whether Remote Control is attached (a non-empty bridgeSessionId).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const live = require('../lib/live.js');
const tmp = require('./tmp.js');

function cfgWith(entry) {
  const dir = tmp('fankeel-live-fields-');
  fs.mkdirSync(path.join(dir, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'sessions', process.pid + '.json'),
    JSON.stringify(Object.assign({ pid: process.pid, sessionId: 'sid-1', cwd: 'F:/x' }, entry)));
  return dir;
}

test('the Desktop fields and Remote Control ride along', () => {
  const [row] = live.runningSessions(cfgWith({ entrypoint: 'claude-desktop', name: 'Quick-IME', status: 'idle', bridgeSessionId: 'session_01abc' }));
  assert.equal(row.pid, process.pid);
  assert.equal(row.entrypoint, 'claude-desktop');
  assert.equal(row.name, 'Quick-IME');
  assert.equal(row.status, 'idle');
  assert.equal(row.bridge, true);
});

test('a file without them reads as empty strings and no bridge', () => {
  const [row] = live.runningSessions(cfgWith({ bridgeSessionId: '' }));
  assert.deepEqual([row.entrypoint, row.name, row.status, row.bridge], ['', '', '', false]);
});
