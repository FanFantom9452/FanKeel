'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plantasks = require('../lib/plantasks.js');
const tmp = require('./tmp.js');

test('READ_CAP and FILE_CAP are exported constants', () => {
  assert.equal(plantasks.READ_CAP, 1500);
  assert.equal(plantasks.FILE_CAP, 3);
});

test('readSize sums a ranged Modify: entry as b - a + 1, without touching disk', () => {
  assert.equal(plantasks.readSize(undefined, { modify: ['lib/a.js:10-20'] }), 11);
});

test('readSize reads an unranged Modify: entry\'s whole file from root', () => {
  const dir = tmp('fankeel-plantasks-readsize-');
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib', 'a.js'), 'one\ntwo\nthree\n');
  assert.equal(plantasks.readSize(dir, { modify: ['lib/a.js'] }), 3);
});

test('readSize counts a Modify: entry naming a file not yet on disk as zero', () => {
  const dir = tmp('fankeel-plantasks-readsize-');
  assert.equal(plantasks.readSize(dir, { modify: ['lib/new.js'] }), 0);
});

test('readSize is silent about an unranged entry with no root to read it against', () => {
  assert.equal(plantasks.readSize(undefined, { modify: ['lib/a.js'] }), 0);
});

test('readSize sums more than one Modify: entry', () => {
  assert.equal(plantasks.readSize(undefined, { modify: ['lib/a.js:1-10', 'lib/b.js:1-5'] }), 15);
});

test('readSize throws on a Modify: entry naming a directory rather than silently counting zero', () => {
  const dir = tmp('fankeel-plantasks-readsize-');
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  assert.throws(() => plantasks.readSize(dir, { modify: ['lib'] }));
});
