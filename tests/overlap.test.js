'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { globToRegExp, entriesOverlap, overlapPaths } = require('../lib/overlap.js');

test('an identical path overlaps itself', () => {
  assert.equal(entriesOverlap('a.ts', 'a.ts'), true);
});

test('two different paths do not overlap', () => {
  assert.equal(entriesOverlap('a.ts', 'b.ts'), false);
});

test('** matches below it, whichever side declared it', () => {
  assert.equal(entriesOverlap('src/**', 'src/a.ts'), true);
  assert.equal(entriesOverlap('src/a.ts', 'src/**'), true);
  assert.equal(entriesOverlap('src/**', 'src/deep/nested/a.ts'), true);
});

test('** does not reach into a sibling directory', () => {
  assert.equal(entriesOverlap('src/**', 'lib/a.ts'), false);
});

test('a single star matches within one segment', () => {
  assert.equal(entriesOverlap('src/*.ts', 'src/a.ts'), true);
});

test('a single star does not cross a separator', () => {
  assert.equal(entriesOverlap('src/*.ts', 'src/sub/a.ts'), false);
});

test('? matches exactly one character, and not a separator', () => {
  assert.equal(entriesOverlap('a?.ts', 'ab.ts'), true);
  assert.equal(entriesOverlap('a?.ts', 'abc.ts'), false);
  assert.equal(entriesOverlap('a?b', 'a/b'), false);
});

test('separators are normalised, so a Windows path meets a posix one', () => {
  assert.equal(entriesOverlap('src\\a.ts', 'src/a.ts'), true);
  assert.equal(entriesOverlap('src\\**', 'src/a.ts'), true);
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

test('globToRegExp anchors at both ends', () => {
  const re = globToRegExp('a.ts');
  assert.equal(re.test('a.ts'), true);
  assert.equal(re.test('xa.ts'), false);
  assert.equal(re.test('a.tsx'), false);
});

test('overlapPaths returns the shared entries in the order the owner declared them', () => {
  const mine = ['statusline.ps1', 'statusline.sh', 'preview.ps1'];
  const theirs = ['preview.ps1', 'statusline.ps1'];
  assert.deepEqual(overlapPaths(mine, theirs), ['statusline.ps1', 'preview.ps1']);
});

test('overlapPaths reports a shared entry once even when several patterns hit it', () => {
  assert.deepEqual(overlapPaths(['src/a.ts'], ['src/**', 'src/*.ts']), ['src/a.ts']);
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
