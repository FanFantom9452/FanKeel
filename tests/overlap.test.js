'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { entriesOverlap, overlapPaths } = require('../lib/overlap.js');

test('an identical path overlaps itself', () => {
  assert.equal(entriesOverlap('a.ts', 'a.ts'), true);
});

test('two different paths do not overlap', () => {
  assert.equal(entriesOverlap('a.ts', 'b.ts'), false);
});

// A claim is an observed file path and has been since 2026-08-24: `hooks/touch.js`
// passes what `relPath` made of a tool payload, `lib/dirty.js` passes what git
// porcelain reported, and `scripts/task.js` deletes the `scope` field a record
// written before that carried. Nothing left in the plugin produces a pattern.
//
// So a star is a character in a filename, which POSIX allows and this used to
// read as a wildcard — one real file called `a*.ts` would have collided with
// every `.ts` beside it and warned two sessions off each other over nothing.
test('a star is a character in a name, not a wildcard', () => {
  assert.equal(entriesOverlap('src/a*.ts', 'src/ab.ts'), false);
  assert.equal(entriesOverlap('src/a*.ts', 'src/a*.ts'), true);
  assert.equal(entriesOverlap('src/**', 'src/a.ts'), false);
  assert.equal(entriesOverlap('a?.ts', 'ab.ts'), false);
});

test('separators are normalised, so a Windows path meets a posix one', () => {
  assert.equal(entriesOverlap('src\\a.ts', 'src/a.ts'), true);
  assert.equal(entriesOverlap('src\\sub', 'src/sub/a.ts'), true);
});

test('a leading ./ is not a difference', () => {
  assert.equal(entriesOverlap('./a.ts', 'a.ts'), true);
});

test('a dot is a literal dot, not a wildcard', () => {
  assert.equal(entriesOverlap('a.ts', 'a-ts'), false);
});

test('regex metacharacters in a path are literal', () => {
  assert.equal(entriesOverlap('a+b(c).ts', 'a+b(c).ts'), true);
  assert.equal(entriesOverlap('a+b(c).ts', 'aab(c).ts'), false);
});

test('a bare directory name overlaps what is inside it', () => {
  assert.equal(entriesOverlap('src', 'src/a.ts'), true);
  assert.equal(entriesOverlap('src/a.ts', 'src'), true);
  assert.equal(entriesOverlap('src', 'srcfoo/a.ts'), false);
});

// The property the regular expression was anchored for, now that there is no
// regular expression: a name is the whole name at both ends, so neither a longer
// one that starts the same nor a longer one that ends the same is a match.
test('a name matches at both ends or not at all', () => {
  assert.equal(entriesOverlap('a.ts', 'a.ts'), true);
  assert.equal(entriesOverlap('a.ts', 'xa.ts'), false);
  assert.equal(entriesOverlap('a.ts', 'a.tsx'), false);
});

test('overlapPaths returns the shared entries in the order the owner declared them', () => {
  const mine = ['statusline.ps1', 'statusline.sh', 'preview.ps1'];
  const theirs = ['preview.ps1', 'statusline.ps1'];
  assert.deepEqual(overlapPaths(mine, theirs), ['statusline.ps1', 'preview.ps1']);
});

// The owner's path is reported once however many of the other side's entries
// reach it — here the file itself and the directory holding it.
test('overlapPaths reports a shared entry once even when several entries hit it', () => {
  assert.deepEqual(overlapPaths(['src/a.ts'], ['src', 'src/a.ts']), ['src/a.ts']);
});

test('overlapPaths returns [] when nothing is shared', () => {
  assert.deepEqual(overlapPaths(['a.ts'], ['b.ts']), []);
});

test('overlapPaths tolerates a missing or malformed scope', () => {
  assert.deepEqual(overlapPaths(undefined, ['a.ts']), []);
  assert.deepEqual(overlapPaths(['a.ts'], undefined), []);
  assert.deepEqual(overlapPaths('a.ts', ['a.ts']), []);
  assert.deepEqual(overlapPaths(['a.ts', null, 42], ['a.ts']), ['a.ts']);
});

test('a directory declared bare meets the same directory declared as a glob', () => {
  assert.equal(entriesOverlap('src/**', 'src'), true);
  assert.equal(entriesOverlap('src', 'src/**'), true);
});
