'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');

test('tmp returns a directory that exists, named for its prefix', () => {
  const dir = tmp('fankeel-tmp-test-');
  assert.equal(fs.existsSync(dir), true);
  assert.equal(fs.statSync(dir).isDirectory(), true);
  assert.equal(path.basename(dir).startsWith('fankeel-tmp-test-'), true);
});

test('the directory is gone once the process that took it exits', () => {
  // A child process, because the handler runs at exit and this process is not
  // exiting. It prints the path it took; this process checks the path is gone.
  const script = [
    "const tmp = require(" + JSON.stringify(path.join(__dirname, 'tmp.js')) + ");",
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const d = tmp('fankeel-tmp-child-');",
    "fs.writeFileSync(path.join(d, 'a.txt'), 'x');",
    'process.stdout.write(d);',
  ].join('\n');
  const dir = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }).trim();
  assert.notEqual(dir, '');
  assert.equal(fs.existsSync(dir), false);
});

test('a child that throws still removes its directory', () => {
  const script = [
    "const tmp = require(" + JSON.stringify(path.join(__dirname, 'tmp.js')) + ");",
    "const d = tmp('fankeel-tmp-throw-');",
    "require('node:fs').writeFileSync(require('node:path').join(d, 'a.txt'), 'x');",
    'process.stdout.write(d + "\\n");',
    "throw new Error('boom');",
  ].join('\n');
  let out = '';
  try {
    execFileSync(process.execPath, ['-e', script], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    out = String(e.stdout || '');
  }
  const dir = out.trim().split('\n')[0];
  assert.notEqual(dir, '');
  assert.equal(fs.existsSync(dir), false);
});
