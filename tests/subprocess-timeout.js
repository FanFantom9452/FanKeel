'use strict';

// Loaded by `node --test --require ./tests/subprocess-timeout.js` (package.json's
// test and test:fast). A synchronous subprocess that never exits blocks the event
// loop, so --test-timeout cannot fire and the whole suite hangs — seven of eight
// runs did on 2026-10-16 (docs/90-agent/reports/2026-10-16-inflight-4-6-8.md §3).
// Every execFileSync, spawnSync and execSync that names no timeout gets one here,
// so a stuck child turns one test red instead.

const cp = require('node:child_process');

const ms = Number(process.env.FANKEEL_TEST_SUBPROCESS_TIMEOUT) || 120000;
const withTimeout = (opts) => (opts && opts.timeout !== undefined ? opts : { ...opts, timeout: ms });

for (const name of ['execFileSync', 'spawnSync']) {
  const original = cp[name];
  cp[name] = function (file, args, opts) {
    if (args == null || Array.isArray(args)) return original.call(this, file, args || [], withTimeout(opts));
    return original.call(this, file, withTimeout(args));
  };
}

const execSync = cp.execSync;
cp.execSync = function (command, opts) {
  return execSync.call(this, command, withTimeout(opts));
};
