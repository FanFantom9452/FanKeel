'use strict';

// data-1: a data bucket reserves `access` — how its location is reached, a NAS
// on Windows being the case that raised it. Nothing handles it yet, and this
// pins both halves of that sentence: the page says so, and the reader drops it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const docs = require('../lib/docs.js');

const PAGE = path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'documents.md');

test('normalise drops a data bucket\'s access key: nothing reads it yet', () => {
  const t = docs.normalise({ buckets: [{ path: 'raw', role: 'data', access: 'nas' }] });
  assert.deepEqual(t.buckets, [{ path: 'raw', role: 'data' }]);
});

test('documents.md names the reserved access key and says nothing reads it', () => {
  const page = fs.readFileSync(PAGE, 'utf8');
  assert.match(page, /`data` bucket reserves one more key, `access`/);
  assert.match(page, /nothing reads it/);
});
