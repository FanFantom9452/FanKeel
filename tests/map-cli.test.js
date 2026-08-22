'use strict';

// The map is written where every stage will look for it, and kept out of git.
// A generated file in a review is a file nobody wrote, and the reviewer has no
// way to tell that from one somebody did.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'map.js');
const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-mapcli-'));

const run = (dir) => execFileSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });

test('it writes the map where every stage will look for it', () => {
  const dir = root();
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '| a | b |\n|---|---|\n| 1 | 2 |\n');
  const out = run(dir);
  const written = path.join(dir, '.fankeel', 'map.md');
  assert.ok(fs.existsSync(written), 'no map written');
  assert.match(out, /\.fankeel[\\/]map\.md/);
  assert.match(fs.readFileSync(written, 'utf8'), /status: generated/);
});

test('it keeps the generated map out of git', () => {
  const dir = root();
  run(dir);
  const ignore = fs.readFileSync(path.join(dir, '.fankeel', '.gitignore'), 'utf8');
  assert.match(ignore, /^map\.md$/m);
  assert.match(ignore, /^sessions\/$/m);
  assert.match(ignore, /^build\/$/m);
});

test('running twice does not duplicate the ignore line', () => {
  const dir = root();
  run(dir);
  run(dir);
  const ignore = fs.readFileSync(path.join(dir, '.fankeel', '.gitignore'), 'utf8');
  assert.equal(ignore.split(/\r?\n/).filter((l) => l === 'map.md').length, 1);
});

test('it reports what it found rather than only that it wrote a file', () => {
  const dir = root();
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'later.md'), '---\nstatus: design-intent\n---\n# Later\n');
  const out = run(dir);
  assert.match(out, /1 planned, not built/);
});
