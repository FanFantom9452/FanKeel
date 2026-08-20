'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { render, STAGE_RULES } = require('../lib/render.js');

const NOW = Date.parse('2026-08-21T12:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

const entry = (sessionId, over) => ({
  sessionId,
  data: Object.assign({
    task: 'rework the colour ramp',
    scope: ['statusline.ps1', 'statusline.sh'],
    stage: 'implement',
    active: true,
    started: ago(2 * 3600e3),
    updated: ago(60e3),
  }, over),
});

// The also-in-progress entries and the stage rules share the "  - " prefix, so a
// bare filter over the whole output counts both. Slice the block by its heading.
function blockAfter(out, heading) {
  const lines = out.split('\n');
  const start = lines.indexOf(heading);
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => !l.startsWith('  - '));
  return end === -1 ? rest : rest.slice(0, end);
}

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const THEIRS = 'bbbbbbbb-0000-4000-8000-000000000002';
const THIRD = 'cccccccc-0000-4000-8000-000000000003';

test('the header names the task and its stage', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.match(out, /^FANKEEL ACTIVE — rework the colour ramp @ implement$/m);
});

test('the scope is listed under the header', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.match(out, /^scope: statusline\.ps1, statusline\.sh$/m);
});

test('with no other sessions there is no also-in-progress block', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.equal(out.includes('also in progress'), false);
});

test('an empty scope omits the scope line rather than rendering an empty one', () => {
  const out = render({ mine: entry(MINE, { scope: [] }), others: [], now: NOW });
  assert.equal(out.includes('scope:'), false);
  assert.equal(out.includes('undefined'), false);
});

test('a missing scope does not render undefined', () => {
  const out = render({ mine: entry(MINE, { scope: undefined }), others: [], now: NOW });
  assert.equal(out.includes('undefined'), false);
});

test('a disjoint other session is listed without an overlap marker', () => {
  const others = [entry(THEIRS, { task: 'rewrite the installer', stage: 'design', scope: ['install.ps1'] })];
  const out = render({ mine: entry(MINE), others, now: NOW });
  assert.match(out, /^also in progress:$/m);
  assert.match(out, /^ {2}- rewrite the installer @ design {2}\(scope: install\.ps1\)$/m);
  assert.equal(out.includes('overlaps'), false);
});

test('an overlapping other session is marked and names the shared paths', () => {
  const others = [entry(THEIRS, { task: 'retune the 5h ramp', scope: ['statusline.ps1'] })];
  const out = render({ mine: entry(MINE), others, now: NOW });
  assert.match(out, /<< overlaps: statusline\.ps1$/m);
});

test('a stale disjoint session carries its age and no marker', () => {
  const others = [entry(THEIRS, { task: 'triage', stage: 'investigate', scope: ['README.md'], updated: ago(14 * 3600e3) })];
  const out = render({ mine: entry(MINE), others, now: NOW });
  assert.match(out, /\(last seen 14h ago\)$/m);
  assert.equal(out.includes('overlaps'), false);
});

test('a stale overlapping session carries both the age and the marker', () => {
  const others = [entry(THEIRS, { task: 'triage', scope: ['statusline.sh'], updated: ago(19 * 24 * 3600e3) })];
  const out = render({ mine: entry(MINE), others, now: NOW });
  const line = out.split('\n').find((l) => l.includes('triage'));
  assert.match(line, /\(last seen 19d ago\)/);
  assert.match(line, /<< overlaps: statusline\.sh/);
});

test('two other sessions render one line each, in the order given', () => {
  const others = [
    entry(THEIRS, { task: 'first', scope: ['a.ts'] }),
    entry(THIRD, { task: 'second', scope: ['b.ts'] }),
  ];
  const out = render({ mine: entry(MINE), others, now: NOW });
  const lines = blockAfter(out, 'also in progress:');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('first'));
  assert.ok(lines[1].includes('second'));
});

test('a missing stage renders as ? rather than throwing', () => {
  const others = [entry(THEIRS, { task: 'nameless', stage: undefined, scope: ['a.ts'] })];
  const out = render({ mine: entry(MINE, { stage: undefined }), others, now: NOW });
  assert.match(out, /^FANKEEL ACTIVE — rework the colour ramp @ \?$/m);
  assert.match(out, /^ {2}- nameless @ \? {2}\(scope: a\.ts\)$/m);
});

test('a missing task name renders as untitled', () => {
  const out = render({ mine: entry(MINE, { task: undefined }), others: [], now: NOW });
  assert.match(out, /^FANKEEL ACTIVE — untitled @ implement$/m);
});

test('an other session with no scope is listed without a scope clause', () => {
  const others = [entry(THEIRS, { task: 'no scope', scope: [] })];
  const out = render({ mine: entry(MINE), others, now: NOW });
  assert.match(out, /^ {2}- no scope @ implement$/m);
});

test('every render ends with the stage rules', () => {
  for (const others of [[], [entry(THEIRS, { scope: ['statusline.ps1'] })]]) {
    const out = render({ mine: entry(MINE), others, now: NOW });
    assert.match(out, /^stage rules:$/m);
    for (const rule of STAGE_RULES) assert.ok(out.includes('  - ' + rule), rule);
  }
});

test('the stage rules are the agreed discipline, not a placeholder string', () => {
  assert.ok(STAGE_RULES.length >= 4);
  assert.equal(STAGE_RULES.some((r) => /TODO|TBD|placeholder/i.test(r)), false);
});
