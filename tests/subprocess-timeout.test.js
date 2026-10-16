'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PRELOAD = path.join(__dirname, 'subprocess-timeout.js');
const ROOT = path.join(__dirname, '..');

const child = (script, ms) => spawnSync(process.execPath, ['--require', PRELOAD, '-e', script], {
  encoding: 'utf8',
  timeout: 30000,
  env: { ...process.env, FANKEEL_TEST_SUBPROCESS_TIMEOUT: String(ms) },
});

test('a subprocess that never exits turns the call red instead of hanging', () => {
  const r = child("require('node:child_process').execFileSync(process.execPath, ['-e', 'setInterval(() => {}, 1000)'])", 500);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ETIMEDOUT/);
});

test('a timeout the caller names is kept', () => {
  const r = child("const r = require('node:child_process').spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { timeout: 300 }); process.stdout.write(String(r.error && r.error.code))", 60000);
  assert.equal(r.stdout, 'ETIMEDOUT');
});

test('a call that leaves out args still gets the default', () => {
  const r = child("const r = require('node:child_process').spawnSync(process.execPath, { input: 'setInterval(() => {}, 1000)' }); process.stdout.write(String(r.error && r.error.code))", 500);
  assert.equal(r.stdout, 'ETIMEDOUT');
});

test('both test scripts load the preload and still read as node --test', () => {
  const { scripts } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const name of ['test', 'test:fast']) {
    assert.match(scripts[name], /--require \.\/tests\/subprocess-timeout\.js/);
    assert.match(scripts[name], /\bnode\s+--test\b/);
  }
});
