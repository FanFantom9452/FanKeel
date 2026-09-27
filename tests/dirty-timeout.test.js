'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dirty = require('../lib/dirty.js');
const mkTmp = require('./tmp.js');

// A `git` that sleeps five seconds, first on PATH. On Windows the lookup
// only tries git.exe and git.com, so it is node under that name with a
// preload that sleeps; elsewhere a shell script.
function slowGit() {
  const bin = mkTmp('fankeel-slowgit-');
  if (process.platform === 'win32') {
    const exe = path.join(bin, 'git.exe');
    try {
      fs.linkSync(process.execPath, exe);
    } catch (e) {
      fs.copyFileSync(process.execPath, exe);
    }
    const pre = path.join(bin, 'sleep.js');
    fs.writeFileSync(pre, 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000); process.exit(0);\n');
    return { bin, env: { NODE_OPTIONS: '--require "' + pre.replace(/\\/g, '/') + '"' } };
  }
  fs.writeFileSync(path.join(bin, 'git'), '#!/bin/sh\nsleep 5\n', { mode: 0o755 });
  return { bin, env: {} };
}

test('a git that hangs is cut off and answers null inside three seconds', () => {
  const repo = mkTmp('fankeel-dirty-slow-');
  fs.mkdirSync(path.join(repo, '.git'));
  const { bin, env } = slowGit();
  const saved = { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS };
  process.env.PATH = bin + path.delimiter + process.env.PATH;
  for (const k of Object.keys(env)) process.env[k] = env[k];
  const began = Date.now();
  let got;
  try {
    got = dirty.dirtyPaths(repo);
  } finally {
    process.env.PATH = saved.PATH;
    if (saved.NODE_OPTIONS === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = saved.NODE_OPTIONS;
  }
  const took = Date.now() - began;
  assert.equal(got, null);
  assert.ok(took < 3000, 'took ' + took + 'ms against a 2500ms timeout');
});
