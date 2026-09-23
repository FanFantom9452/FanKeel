'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { readBody } = require('../lib/body.js');

test('readBody resolves the whole body under the cap', async () => {
  const s = new PassThrough();
  const p = readBody(s);
  s.end('abc');
  assert.equal(await p, 'abc');
});

test('past the cap it stops appending and still resolves', async () => {
  const s = new PassThrough();
  const p = readBody(s, { max: 4 });
  s.write('abcd');
  s.end('efgh');
  assert.equal(await p, 'abcd');
});

test('destroyOnOverflow drops the stream past the cap', async () => {
  const s = new PassThrough();
  readBody(s, { max: 4, destroyOnOverflow: true });
  s.write('abcdef');
  await new Promise((done) => setImmediate(done));
  assert.equal(s.destroyed, true);
});

test('a character split across two chunks arrives whole', async () => {
  const s = new PassThrough();
  const p = readBody(s);
  const bytes = Buffer.from('中');
  s.write(bytes.subarray(0, 1));
  s.end(bytes.subarray(1));
  assert.equal(await p, '中');
});
