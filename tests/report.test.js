'use strict';

// The three primitives every scanner shares. They are tested here rather than
// through each scanner because they used to be tested through each scanner —
// four copies of `human` with one test between them, which is how the copies
// drifted apart without a run going red.

const test = require('node:test');
const assert = require('node:assert/strict');

const { human, plural, section, MAX_PER_SECTION } = require('../lib/report.js');

const K = 1024;
const M = K * 1024;
const G = M * 1024;

test('human names gigabytes rather than counting to four thousand megabytes', () => {
  assert.equal(human(0), '0B');
  assert.equal(human(1023), '1023B');
  assert.equal(human(K), '1.0K');
  assert.equal(human(M), '1.0M');
  assert.equal(human(G), '1.0G');
  assert.equal(human(3 * G), '3.0G');
});

// `toFixed(1)` rounds up before the tier does. One byte short of a megabyte is
// where it shows: the arithmetic says kilobytes, and the printing says 1024 of
// them, which is a unit the line above already spells `M`.
test('a size one byte short of the next tier is not printed as 1024 of this one', () => {
  assert.equal(human(M - 1), '1.0M');
  assert.equal(human(K - 1), '1023B');
  assert.equal(human(G - 1), '1.0G');
  assert.equal(human(1024 * G - 1), '1.0T');

  // And the value just below the rounding boundary still reads in the lower
  // tier, so the fix moved the edge rather than swallowing a whole tier.
  assert.equal(human(1048000), '1023.4K');
  assert.equal(human(1073200000), '1023.5M');
});

// The gap that produced `data/ 3071.0M` on a real project, one tier up.
test('the top tier is terabytes, so a big enough number is not 1024.0G', () => {
  assert.equal(human(4 * 1024 * G), '4.0T');
  assert.equal(human(1023 * G), '1023.0G');
});

test('plural agrees with its own noun', () => {
  assert.equal(plural(0, 'path', 'paths'), '0 paths');
  assert.equal(plural(1, 'path', 'paths'), '1 path');
  assert.equal(plural(2, 'path', 'paths'), '2 paths');
  assert.equal(plural(1, 'worktree is', 'worktrees are'), '1 worktree is');
});

test('a section leads with a blank and returns nothing at all when empty', () => {
  assert.deepEqual(section('title:', []), []);
  assert.deepEqual(section('title:', ['a', 'b']), ['', 'title:', '  a', '  b']);
});

// The whole reason this is one function: `scripts/docs-audit.js` sliced its
// pairs list before the section saw it, so the header counted fifteen and the
// list showed twelve with nothing in between.
test('a section cut to its cap says how many it dropped', () => {
  const rows = Array.from({ length: 15 }, (_, i) => 'row' + i);
  const out = section('15 pairs:', rows, 12);
  assert.equal(out.length, 2 + 12 + 1);
  assert.equal(out.at(-1), '  ... and 3 more, not listed');

  // An explicit cap the list does not reach adds no line.
  assert.equal(section('title:', rows, 20).at(-1), '  row14');
});

test('the default cap is used when none is given', () => {
  const rows = Array.from({ length: MAX_PER_SECTION + 4 }, (_, i) => 'row' + i);
  assert.equal(section('title:', rows).at(-1), '  ... and 4 more, not listed');
});

// `scripts/survey.js --all` passes Infinity, which is a cap somebody chose and
// not an absent one. A `Number.isFinite` guard read it as absent and put the
// default back, so `--all` quietly kept capping at twenty-five.
test('Infinity is a cap that was chosen, not a cap that was missing', () => {
  const rows = Array.from({ length: MAX_PER_SECTION + 4 }, (_, i) => 'row' + i);
  const out = section('title:', rows, Infinity);
  assert.equal(out.length, 2 + rows.length);
  assert.equal(out.at(-1), '  row' + (rows.length - 1));

  // And nonsense still falls back rather than dropping every row.
  assert.equal(section('title:', rows, NaN).at(-1), '  ... and 4 more, not listed');
  assert.equal(section('title:', rows, 0).at(-1), '  ... and 4 more, not listed');
});
