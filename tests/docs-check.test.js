'use strict';

// `docs-check` shipped without a test file, and with two hand-rolled truncation
// lines that said `(N more)` and `(N more not listed)` where the other scanners
// said `... and N more, not listed`. The refactor that unified that sentence
// reached the four scripts holding a copy of `section`; this one never had a
// copy, so it kept both of its own spellings. What is pinned here is the
// sentence and the cap, because a fifth and sixth spelling is what happens to
// a line nothing asserts.
//
// `report` is called with a scan result built by hand. Every branch under test
// is a formatting one, and building a directory of markdown to reach it would
// test `scan` instead.

const test = require('node:test');
const assert = require('node:assert/strict');

const { report } = require('../scripts/docs-check.js');

const result = (over) => ({
  tree: { preset: 'flat' },
  error: null,
  counts: {},
  unfiled: [],
  markdown: 0,
  findings: [],
  ...over,
});

const finding = (i) => ({
  tag: 'gone', file: 'docs/' + i + '.md', line: 1, what: 'names docs/x.md', role: 'reference',
});

test('the unfiled list stops at twenty and says how many it cut', () => {
  const files = Array.from({ length: 23 }, (_, i) => 'docs/' + i + '.md');
  const text = report(result({ unfiled: files, markdown: 23 }));

  assert.match(text, /23 in no bucket/);
  assert.equal(text.includes('  docs/19.md'), true, 'the twentieth is inside the cap');
  assert.equal(text.includes('  docs/20.md'), false, 'the twenty-first is not');
  assert.match(text, /^ {2}\.\.\. and 3 more, not listed$/m);
});

test('a list inside the cap gets no truncation line at all', () => {
  const text = report(result({ unfiled: ['docs/a.md'], markdown: 1 }));

  assert.match(text, /1 in no bucket/);
  assert.equal(/more, not listed/.test(text), false, 'nothing was dropped, so nothing says so');
});

test('nothing unfiled renders no heading over an empty list', () => {
  const text = report(result({}));

  assert.equal(text.includes('in no bucket'), false, 'a heading over no rows reads as a finding');
});

test('the findings list stops at the cap and says it in the same words', () => {
  const findings = Array.from({ length: 203 }, (_, i) => finding(i));
  const text = report(result({ findings, markdown: 203 }));

  assert.match(text, /203 references that no longer resolve:/);
  assert.match(text, /^ {2}\.\.\. and 3 more, not listed$/m);
});

test('one finding is a reference, not references', () => {
  const text = report(result({ findings: [finding(1)], markdown: 1 }));

  assert.match(text, /1 reference that no longer resolves:/);
  assert.match(text, /^ {2}gone: docs\/1\.md:1 {2}names docs\/x\.md {2}\[reference\]$/m);
});
