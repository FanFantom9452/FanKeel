'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { render, SCRIPTS, SURVEY_SCRIPT, TODO_CHECK_SCRIPT } = require('../lib/render.js');
const { ALWAYS, byName, rulesFor, SURVEY_TOKEN, TOKENS } = require('../lib/stages.js');

const sub = (stage) => rulesFor(stage, SCRIPTS);

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

test('every render ends with the rules for the stage it is in', () => {
  for (const others of [[], [entry(THEIRS, { scope: ['statusline.ps1'] })]]) {
    const out = render({ mine: entry(MINE, { stage: 'build' }), others, now: NOW });
    assert.match(out, /^stage rules:$/m);
    for (const rule of sub('build')) assert.ok(out.includes('  - ' + rule), rule);
  }
});

test('the rules sent are this stage’s, not another stage’s', () => {
  const out = render({ mine: entry(MINE, { stage: 'survey' }), others: [], now: NOW });
  for (const rule of sub('survey')) assert.ok(out.includes(rule), rule);
  // land's own rules only. The always-on three belong to every stage, so
  // comparing the whole list would assert they are absent from the stage that
  // must carry them.
  for (const rule of byName('land').rules) assert.equal(out.includes(rule), false, rule);
});

test('the survey rule names a runnable path, not a placeholder', () => {
  const out = render({ mine: entry(MINE, { stage: 'survey' }), others: [], now: NOW });
  assert.equal(out.includes(SURVEY_TOKEN), false, 'the token survived into the output');
  assert.match(out, /node .*survey\.js/);
  assert.ok(require('node:fs').existsSync(SURVEY_SCRIPT), SURVEY_SCRIPT + ' does not exist');
});

test('the land rule names a runnable todo-check path, not a placeholder', () => {
  const out = render({ mine: entry(MINE, { stage: 'land' }), others: [], now: NOW });
  assert.equal(out.includes(TOKENS.todoCheck), false, 'the token survived into the output');
  assert.match(out, /node .*todo-check\.js/);
  assert.ok(require('node:fs').existsSync(TODO_CHECK_SCRIPT), TODO_CHECK_SCRIPT + ' does not exist');
});

test('every token this file knows about is substituted somewhere', () => {
  // A token added to stages.js without a script added to render.js would
  // otherwise ship as literal `{{...}}` in the injected text.
  for (const key of Object.keys(TOKENS)) {
    assert.ok(SCRIPTS[key], 'no script supplied for token ' + key);
  }
});

test('an unsubstituted rulesFor still returns the token, so callers cannot forget silently', () => {
  assert.ok(byName('survey').rules.some((r) => r.includes(SURVEY_TOKEN)));
  assert.ok(rulesFor('survey').some((r) => r.includes(SURVEY_TOKEN)));
  assert.ok(rulesFor('land').some((r) => r.includes(TOKENS.todoCheck)));
});

test('an unknown stage still gets the always-on rules', () => {
  const out = render({ mine: entry(MINE, { stage: 'nonsense' }), others: [], now: NOW });
  for (const rule of ALWAYS) assert.ok(out.includes(rule), rule);
});

test('next is rendered as one line when set', () => {
  const out = render({ mine: entry(MINE, { next: 'wire the badge into TokenBar' }), others: [], now: NOW });
  assert.match(out, /^next: wire the badge into TokenBar$/m);
});

test('next is absent rather than empty when unset', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.equal(out.includes('next:'), false);
});

test('notes render as a so-far block', () => {
  const notes = ['ANSI 256 has no true mid green', 'decided 12h for stale, not 24h'];
  const out = render({ mine: entry(MINE, { notes }), others: [], now: NOW });
  assert.match(out, /^so far:$/m);
  for (const n of notes) assert.ok(out.includes('  - ' + n), n);
});

test('an empty notes list produces no so-far block', () => {
  const out = render({ mine: entry(MINE, { notes: [] }), others: [], now: NOW });
  assert.equal(out.includes('so far:'), false);
});

test('the render never carries more than the capped number of notes', () => {
  const notes = Array.from({ length: 20 }, (_, i) => 'note ' + i);
  const out = render({ mine: entry(MINE, { notes }), others: [], now: NOW });
  const shown = out.split('\n').filter((l) => /^ {2}- note \d+$/.test(l));
  assert.equal(shown.length, 5);
  assert.ok(shown[shown.length - 1].includes('note 19'), 'the newest note was evicted');
});

test('malformed notes are dropped rather than rendered', () => {
  const out = render({ mine: entry(MINE, { notes: ['real', null, 42, '  '] }), others: [], now: NOW });
  assert.match(out, /^ {2}- real$/m);
  assert.equal(out.includes('undefined'), false);
  assert.equal(out.includes('null'), false);
  assert.equal(out.includes('42'), false);
});

test('notes is not an array does not throw', () => {
  const out = render({ mine: entry(MINE, { notes: 'oops' }), others: [], now: NOW });
  assert.equal(out.includes('so far:'), false);
});

test('a style set on the entry renders its digest last', () => {
  const out = render({ mine: entry(MINE, { style: 'terse' }), others: [], now: NOW });
  const lines = out.split('\n').filter(Boolean);
  assert.match(out, /^voice \(terse\):$/m);
  assert.match(lines[lines.length - 1], /language the user writes in/);
  // Last on purpose: it is the block closest to what gets generated next.
  assert.ok(out.indexOf('voice (') > out.indexOf('stage rules:'));
});

test('no style on the entry means no voice block at all', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.equal(out.includes('voice ('), false);
});

test('a style name nothing matches renders nothing rather than an empty block', () => {
  const out = render({ mine: entry(MINE, { style: 'shouty' }), others: [], now: NOW });
  assert.equal(out.includes('voice ('), false);
  assert.equal(out.includes('undefined'), false);
});

test('the whole injection stays a readable size with everything populated', () => {
  // The worst case on purpose: the longest stage, both memory fields full, a
  // second session to report, and the voice digest present. This rides on every
  // prompt, so the number it produces is the per-turn rent the whole design
  // pays and it should be looked at when it moves.
  const out = render({
    mine: entry(MINE, {
      stage: 'land',
      style: 'pipeline',
      next: 'wire the badge into TokenBar',
      notes: Array.from({ length: 5 }, (_, i) => 'a lesson learned number ' + i),
    }),
    others: [entry(THEIRS, { task: 'retune the 5h ramp', scope: ['statusline.ps1'] })],
    now: NOW,
  });
  // 2200, raised from 2000 with the fourth always-on rule and the line formats
  // that replaced the stages' word counts. About 550 tokens a turn with a long
  // task line, notes and another live session all present at once.
  assert.ok(out.length < 2200, 'injection is ' + out.length + ' chars');
});

test('no stage’s rules cost more than a readable preamble', () => {
  // survey and land both name a script by absolute path, so they are the two
  // that can quietly grow. Checked per stage rather than only on the one the
  // fixture happens to sit in.
  for (const stage of ['survey', 'design', 'build', 'verify', 'land']) {
    const out = render({ mine: entry(MINE, { stage }), others: [], now: NOW });
    assert.ok(out.length < 1600, stage + ' injection is ' + out.length + ' chars');
  }
});
