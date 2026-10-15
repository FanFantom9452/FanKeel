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

test('a git that hangs is cut off and answers null well before the hang ends', () => {
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
  // Under the five-second hang with room for a loaded machine to spawn and
  // kill git: a missing cut waits the whole five.
  assert.ok(took < 4500, 'took ' + took + 'ms against a 2500ms timeout');
});

test('FANKEEL_GIT_TIMEOUT lets a slow git finish instead of answering null', () => {
  const repo = mkTmp('fankeel-dirty-slow-');
  fs.mkdirSync(path.join(repo, '.git'));
  const { bin, env } = slowGit();
  const saved = { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS };
  process.env.PATH = bin + path.delimiter + process.env.PATH;
  for (const k of Object.keys(env)) process.env[k] = env[k];
  process.env.FANKEEL_GIT_TIMEOUT = '10000';
  let got;
  try {
    got = dirty.dirtyPaths(repo);
  } finally {
    process.env.PATH = saved.PATH;
    delete process.env.FANKEEL_GIT_TIMEOUT;
    if (saved.NODE_OPTIONS === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = saved.NODE_OPTIONS;
  }
  assert.deepEqual(got, []);
});

test('logicalFile waits out a slow git under FANKEEL_GIT_TIMEOUT instead of cutting it at 2.5s', () => {
  const guard = require('../lib/guard.js');
  const root = mkTmp('fankeel-guard-root-');
  const elsewhere = mkTmp('fankeel-guard-else-');
  const { bin, env } = slowGit();
  const saved = { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS };
  process.env.PATH = bin + path.delimiter + process.env.PATH;
  for (const k of Object.keys(env)) process.env[k] = env[k];
  process.env.FANKEEL_GIT_TIMEOUT = '10000';
  const began = Date.now();
  try {
    guard.logicalFile(root, path.join(elsewhere, 'a.js'));
  } finally {
    process.env.PATH = saved.PATH;
    delete process.env.FANKEEL_GIT_TIMEOUT;
    if (saved.NODE_OPTIONS === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = saved.NODE_OPTIONS;
  }
  // The slow git sleeps five seconds: a 2500 cut answers in under three.
  const took = Date.now() - began;
  assert.ok(took > 4500, 'took ' + took + 'ms; the 10000ms override was not used');
});
