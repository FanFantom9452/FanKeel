'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL = path.join(__dirname, '..', 'skills', 'fankeel-survey', 'SKILL.md');
const READER = path.join(__dirname, '..', 'agents', 'fankeel-reader.md');
const OPENING = '**An `architectural` class adds a history lens**';

const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// The lens paragraph, from its bold opening to the next blank line, with its
// line wrapping folded to single spaces so a phrase may break anywhere.
function lens() {
  const text = read(SKILL);
  const at = text.indexOf(OPENING);
  assert.ok(at >= 0, 'survey SKILL.md has no history lens paragraph');
  const end = text.indexOf('\n\n', at);
  return text.slice(at, end < 0 ? text.length : end).replace(/\s+/g, ' ');
}

test('the history lens sits in step 5, after the classes and before step 6', () => {
  const text = read(SKILL);
  const at = text.indexOf(OPENING);
  assert.ok(at > text.indexOf('### 5. Classify, out loud'), 'lens is after step 5 opens');
  assert.ok(at < text.indexOf('### 6. Write it down'), 'lens is before step 6');
});

test('the lens is one fankeel-reader running git log -S, git blame and reading commit text', () => {
  const p = lens();
  assert.match(p, /`fankeel:fankeel-reader`/);
  assert.match(p, /`git log -S<term>`/);
  assert.match(p, /`git blame -L`/);
  assert.match(p, /commit text/);
  assert.match(p, /over the files the scan named/);
});

test('each finding returns the commit, the path:line and one of five tiers, in order', () => {
  const p = lens();
  assert.match(p, /the commit, the `path:line`, and one tier/);
  let from = 0;
  for (const tier of ['Direct', 'Supported', 'Inferred', 'Speculative', 'Unknown']) {
    const i = p.indexOf(tier, from);
    assert.ok(i >= 0, tier + ' is missing, or out of order');
    from = i + tier.length;
  }
});

test('the lens closes with a list of what git cannot show', () => {
  assert.match(lens(), /`git cannot show:`/);
});

test('the reader agent keeps its two-mark return shape; the tiers live in the lens brief only', () => {
  const reader = read(READER);
  assert.match(reader, /Mark every line `EXTRACTED` or `INFERRED`/);
  assert.doesNotMatch(reader, /Speculative/);
  assert.match(lens(), /`agents\/fankeel-reader\.md` keeps `EXTRACTED` \/ `INFERRED`/);
});
