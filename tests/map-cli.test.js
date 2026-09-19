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

const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'map.js');
const root = () => tmp('fankeel-mapcli-');

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

test('--root=<dir> is the same flag', () => {
  const dir = root();
  execFileSync(process.execPath, [SCRIPT, '--root=' + dir], { encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(dir, '.fankeel', 'map.md')), 'the equals form was not read as --root');
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

// A reviewer told to touch nothing still needs to read the map. Without a
// print-only mode the only way to read it is to write it: a build reviewer
// wrote .fankeel/map.md twice on 2026-09-08 doing exactly that.
test('--print writes nothing and puts the map on stdout', () => {
  const dir = root();
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '| a | b |\n|---|---|\n| 1 | 2 |\n');
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--print'], { encoding: 'utf8' });
  assert.match(out, /status: generated/);
  assert.ok(!fs.existsSync(path.join(dir, '.fankeel', 'map.md')), 'a map was written');
  assert.ok(!fs.existsSync(path.join(dir, '.fankeel', '.gitignore')), 'a .gitignore was written');
});

test('without --print the map is still written', () => {
  const dir = root();
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '| a | b |\n|---|---|\n| 1 | 2 |\n');
  run(dir);
  assert.ok(fs.existsSync(path.join(dir, '.fankeel', 'map.md')), 'no map written');
});

// This repository's own tree, read the way every stage reads it. The design
// (docs/plans/2026-09-19-station-live-design.md §5) asked for the eleven
// top-level directories with a responsibility each and the entry files of
// lib/, scripts/ and hooks/, inside the fifty rows MAX_TREE carries. The top
// rows are checked against the tracked tree, so a directory added later
// without a row fails here, and every entry file against the disk.
test('this repository\'s README carries a tree the map reads whole, with no row left unfilled', () => {
  const ROOT = path.join(__dirname, '..');
  const out = execFileSync(process.execPath, [SCRIPT, '--print', '--root', ROOT], { encoding: 'utf8' });
  const lines = out.split(/\r?\n/);
  const head = lines.find((l) => l.startsWith('tree — '));
  assert.ok(head, 'no tree line: ' + lines.filter((l) => /tree/.test(l)).join(' | '));
  assert.match(head, /^tree — \d+ rows from README\.md, under What lives where$/);
  assert.doesNotMatch(head, /with no responsibility/);
  assert.doesNotMatch(head, /shown/, 'the map cut the tree short');
  assert.ok(Number(/^tree — (\d+) rows/.exec(head)[1]) <= 50, head);
  const { trackedFiles } = require('../lib/tracked.js');
  const { rows } = require('../scripts/layout.js');
  const dirs = [...rows(ROOT, trackedFiles(ROOT).files).dirs.keys()].sort().map((d) => d + '/');
  const top = lines.filter((l) => /^ {2}[├└]── /.test(l)).map((l) => l.slice(6).split(/\s+/)[0]);
  assert.deepEqual(top, dirs, 'one row per top-level directory, in order');
  const entries = {};
  let current = null;
  for (const l of lines) {
    const t = /^ {2}[├└]── (\S+)/.exec(l);
    if (t) { current = t[1]; continue; }
    const e = /^ {2}[│ ] {3}[├└]── (\S+)/.exec(l);
    if (e && current) (entries[current] = entries[current] || []).push(e[1]);
  }
  assert.deepEqual(Object.keys(entries).sort(), ['hooks/', 'lib/', 'scripts/']);
  for (const dir of Object.keys(entries)) {
    for (const name of entries[dir]) assert.ok(fs.existsSync(path.join(ROOT, dir, name)), dir + name + ' is in the tree and not on disk');
  }
});
