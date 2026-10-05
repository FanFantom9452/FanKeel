'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tmp = require('./tmp.js');
const { handoffPath, commitPath, answerPath, readGate, writeAnswer, lapsUsed, readsOf, previousHandoff, ledgerCommitPath, newestCommit, skipReason, gateMatches, answersGate, liveMarks } = require('../lib/handoff.js');

const DATA = { started: '2026-09-19T09:30:12.345Z' };
const TICKS = '`'.repeat(3);
const block = (gate) => TICKS + 'json gate\n' + JSON.stringify(gate) + '\n' + TICKS + '\n';
const gateOf = (s) => ({
  questions: [{ question: s, header: 'survey', multiSelect: false, options: [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }] }],
  next: 'pick up ' + s,
});
const moved = (...stages) => Object.assign({}, DATA, { moves: stages.map((s, i) => [s, 1000 + i]) });

test('the handoff lives under .fankeel/build, keyed by started', () => {
  assert.equal(handoffPath('/r', DATA, 'survey'), '/r/.fankeel/build/task-20260919T093012/survey.md');
  assert.equal(answerPath('/r', DATA, 'survey'), '/r/.fankeel/build/task-20260919T093012/survey-answer.md');
});

test('no started, no path: a guess would be somebody else\'s directory', () => {
  assert.equal(handoffPath('/r', {}, 'survey'), null);
  assert.equal(handoffPath('/r', { started: 'yesterday' }, 'survey'), null);
  assert.equal(answerPath('/r', {}, 'survey'), null);
});

test('the gate is the last json gate block, parsed', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  fs.writeFileSync(file, '# report\n\n' + block(gateOf('old')) + '\nrewritten\n\n' + block(gateOf('new')));
  const gate = readGate(file);
  assert.equal(gate.questions[0].question, 'new');
  assert.equal(gate.next, 'pick up new');
});

test('a missing file, no block, bad json or no questions read as no gate', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  assert.equal(readGate(file), null);
  fs.writeFileSync(file, 'no block here\n');
  assert.equal(readGate(file), null);
  fs.writeFileSync(file, TICKS + 'json gate\n{not json\n' + TICKS + '\n');
  assert.equal(readGate(file), null);
  fs.writeFileSync(file, block({ questions: [] }));
  assert.equal(readGate(file), null);
});

test('readGate refuses a gate shape AskUserQuestion would reject, and keeps next for a pause', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  const good = gateOf('ok');
  const cases = [
    [(q) => { delete q.header; }, 'questions[0].header'],
    [(q) => { q.header = '一二三四五六七'; }, 'questions[0].header'],
    [(q) => { delete q.question; }, 'questions[0].question'],
    [(q) => { q.options = [q.options[0]]; }, 'questions[0].options'],
    [(q) => { delete q.options[1].description; }, 'questions[0].options[1]'],
    [(q) => { q.multiSelect = 'no'; }, 'questions[0].multiSelect'],
  ];
  for (const [spoil, field] of cases) {
    const g = JSON.parse(JSON.stringify(good));
    spoil(g.questions[0]);
    fs.writeFileSync(file, block(g));
    const got = readGate(file);
    assert.deepEqual({ invalid: got.invalid, next: got.next }, { invalid: field, next: g.next }, field);
    assert.equal(typeof got.detail, 'string', field + ' has no detail');
  }
  fs.writeFileSync(file, block(good));
  assert.deepEqual(readGate(file), good);
});

// 2026-09-23: this survey gate reached AskUserQuestion through gate.js and was
// rejected there for `questions[0].header`, after readGate had accepted it.
test('the survey gate with no header that reached AskUserQuestion on 2026-09-23 is refused', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  const g = {
    questions: [{
      question: 'Survey found four confirmed gaps in the stage-agent dispatch/gate/brief mechanism. Proceed to design as bounded?',
      options: [
        { label: 'Yes — design next (Recommended)', description: 'Accept bounded classification and the five-stage route already applied.' },
        { label: 'Split into separate tasks', description: 'The four seams are independent.' },
        { label: 'Something else', description: 'A different scope, route, or a seam to drop or add.' },
      ],
      multiSelect: false,
    }],
    next: 'confirm bounded route and move to design for the four stage-agent handoff gaps',
  };
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, 'design'), { invalid: 'questions[0].header', detail: 'header is missing or empty', next: g.next });
});

// 2026-09-23: a design gate headed "15 條一起 design" was refused with only
// "missing or wrong". Sixteen columns: four CJK characters count two each.
test('an over-wide header is refused with its width and the cap', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'design.md');
  const g = gateOf('w');
  g.questions[0].header = '15 條一起 design';
  fs.writeFileSync(file, block(g));
  const got = readGate(file);
  assert.equal(got.invalid, 'questions[0].header');
  assert.match(got.detail, /"15 條一起 design" is 16 columns, 12 is the cap/);
});

// 2026-09-24: round 2 of the measurement paired a short (20-column) label
// with a 385-column description and it was still shown correctly — no
// evidence description length matters, so it stays uncapped.
test('a 200+ column description is not capped', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'build.md');
  const g = gateOf('ok');
  g.questions[0].options[0].description = '字'.repeat(200); // 400 columns
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file), g);
});

test('option one names the next stage when one is given, or standing down at the end', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'verify.md');
  const g = gateOf('v');
  g.questions[0].options[0].label = '退回 build';
  fs.writeFileSync(file, block(g));
  assert.equal(readGate(file, 'audit').invalid, 'questions[0].options[0].label');
  assert.deepEqual(readGate(file), g);
  g.questions[0].options[0].label = '進 audit'; // this test is about naming, not width
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, 'audit'), g);
  g.questions[0].options[0].label = 'Stand down';
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, null), g);
  g.questions[0].options[0].label = '進 audit';
  fs.writeFileSync(file, block(g));
  assert.equal(readGate(file, null).invalid, 'questions[0].options[0].label');
});

// 2026-09-23: verify's gate offered "退回 build" as option one and readGate
// refused it, because only the forward stage counted.
test('option one may send the work back to any stage on the route, never one off it', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'verify.md');
  const g = gateOf('v');
  g.questions[0].options[0].label = '退回 build';
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, 'audit', ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land']), g);
  assert.equal(readGate(file, 'audit', ['survey', 'verify', 'audit']).invalid, 'questions[0].options[0].label');
  assert.equal(readGate(file, 'audit').invalid, 'questions[0].options[0].label');
});

test('the answer is written where answerPath says, directories made', () => {
  const file = answerPath(tmp('fankeel-handoff-'), DATA, 'survey');
  writeAnswer(file, 'Other: read lib/ first');
  assert.equal(fs.readFileSync(file, 'utf8'), 'Other: read lib/ first');
});

test("ledgerCommitPath mirrors the plan-stem dir lib/ledger.js's ledgerPath uses, for a stage agent that writes commits there instead", () => {
  assert.equal(ledgerCommitPath('/r', 'docs/plans/2026-09-23-controller-await.md', 'build'), '/r/.fankeel/build/2026-09-23-controller-await/build-commit.md');
  assert.equal(ledgerCommitPath('/r', null, 'build'), null);
  assert.equal(ledgerCommitPath('/r', 'docs/plans/x.md', null), null);
  assert.equal(ledgerCommitPath(null, 'docs/plans/x.md', 'build'), null);
});

test('newestCommit accepts a bare path or a list, and answers the newest one after since', () => {
  const dir = tmp('fankeel-handoff-');
  const a = path.join(dir, 'a-commit.md');
  const b = path.join(dir, 'b-commit.md');
  fs.writeFileSync(a, 'x');
  fs.utimesSync(a, 1000, 1000);
  assert.equal(newestCommit(a, 0), a);
  assert.equal(newestCommit(a, 2000000), null, 'older than since is not news');
  assert.equal(newestCommit([a, b], 0), a, 'b does not exist yet');
  fs.writeFileSync(b, 'x');
  fs.utimesSync(b, 2000, 2000);
  assert.equal(newestCommit([a, b], 0), b, 'the newer of the two candidates');
  assert.equal(newestCommit(null, 0), null);
  assert.equal(newestCommit([], 0), null);
});

test('a stage keeps its file names on the first visit and numbers each return', () => {
  const dir = '/r/.fankeel/build/task-20260919T093012/';
  assert.equal(handoffPath('/r', moved('build'), 'build'), dir + 'build.md');
  const back = moved('build', 'verify', 'build');
  assert.equal(handoffPath('/r', back, 'build'), dir + 'build-2.md');
  assert.equal(answerPath('/r', back, 'build'), dir + 'build-2-answer.md');
  assert.equal(commitPath('/r', back, 'build'), dir + 'build-2-commit.md');
  assert.equal(handoffPath('/r', back, 'verify'), dir + 'verify.md');
});

test('a record with no moves is on the first visit of every stage', () => {
  assert.equal(handoffPath('/r', DATA, 'build'), '/r/.fankeel/build/task-20260919T093012/build.md');
});

test('a group appends -g<N> before the extension, combined with a lap or alone, and is silent when left out', () => {
  assert.equal(handoffPath('/r', DATA, 'build', undefined, 2), '/r/.fankeel/build/task-20260919T093012/build-g2.md');
  assert.equal(commitPath('/r', DATA, 'build', undefined, 2), '/r/.fankeel/build/task-20260919T093012/build-g2-commit.md');
  assert.equal(handoffPath('/r', DATA, 'build', 2, 3), '/r/.fankeel/build/task-20260919T093012/build-2-g3.md');
  assert.equal(handoffPath('/r', DATA, 'build'), '/r/.fankeel/build/task-20260919T093012/build.md', 'no group: unchanged');
  assert.equal(handoffPath('/r', DATA, 'build', undefined, 0), '/r/.fankeel/build/task-20260919T093012/build.md', 'group 0 is not a group');
});

test('the gate of an earlier lap is not the gate of this one', () => {
  const root = tmp('fankeel-handoff-');
  const first = moved('build');
  const second = moved('build', 'verify', 'build');
  const file = handoffPath(root, first, 'build');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, block(gateOf('lap one')));
  assert.equal(readGate(handoffPath(root, first, 'build')).questions[0].question, 'lap one');
  assert.equal(readGate(handoffPath(root, second, 'build')), null);
});

test('a renamed task numbers its laps past the ones the old task used', () => {
  const dir = '/r/.fankeel/build/task-20260919T093012/';
  const renamed = (...stages) => Object.assign(moved(...stages), { lapped: 2 });
  assert.equal(handoffPath('/r', renamed(), 'build'), dir + 'build-3.md');
  assert.equal(handoffPath('/r', renamed('build'), 'build'), dir + 'build-3.md');
  assert.equal(handoffPath('/r', renamed('build', 'verify', 'build'), 'build'), dir + 'build-4.md');
  assert.equal(lapsUsed(DATA), 1);
  assert.equal(lapsUsed(moved('build', 'verify', 'build')), 2);
  assert.equal(lapsUsed(renamed('build')), 3);
});

const report = (reads) => '# report\n\nbody\n\n' + (reads ? 'reads:\n' + reads.map((r) => '- ' + r).join('\n') + '\n\n' : '') + block(gateOf('q'));

test('readsOf returns the lines under the last reads: line and stops at the blank line', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'r.md');
  fs.writeFileSync(file, 'reads:\n- old — superseded\n\nprose\n\n' + report(['lib/a.js — the caller', 'docs/b.md — the contract']));
  assert.deepEqual(readsOf(file), ['lib/a.js — the caller', 'docs/b.md — the contract']);
  fs.writeFileSync(file, report(null));
  assert.deepEqual(readsOf(file), []);
  assert.deepEqual(readsOf(path.join(path.dirname(file), 'missing.md')), []);
});

test('readsOf stops at the gate fence when no blank line comes before it', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'r.md');
  fs.writeFileSync(file, 'body\n\nreads:\n- lib/a.js — the caller\n- docs/b.md — the contract\n' + block(gateOf('q')));
  assert.deepEqual(readsOf(file), ['lib/a.js — the caller', 'docs/b.md — the contract']);
});

test('readsOf keeps an unbulleted line whose path is inline code', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'r.md');
  fs.writeFileSync(file, 'reads:\n`lib/a.js` — the caller\n`docs/b.md` — the contract\n\n' + block(gateOf('q')));
  assert.deepEqual(readsOf(file), ['`lib/a.js` — the caller', '`docs/b.md` — the contract']);
});

// Four behaviours the doc comment above readsOf claims and none of the tests
// above exercise: CRLF line endings, a `*` bullet, trailing spaces after the
// `reads:` mark itself, and the block sitting at the very end of the file
// with no trailing newline.

test('readsOf splits on \\r\\n as well as \\n, trimming the \\r from each line', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'r.md');
  fs.writeFileSync(file, '# report\r\n\r\nreads:\r\n- a — why\r\n\r\n' + block(gateOf('q')));
  assert.deepEqual(readsOf(file), ['a — why']);
});

test('readsOf strips a star bullet the same as a dash', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'r.md');
  fs.writeFileSync(file, 'reads:\n- a — why\n* b — why2\n\n' + block(gateOf('q')));
  assert.deepEqual(readsOf(file), ['a — why', 'b — why2']);
});

test('readsOf matches the reads: mark line even with trailing spaces after it', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'r.md');
  fs.writeFileSync(file, 'reads:   \n- a — why\n\n' + block(gateOf('q')));
  assert.deepEqual(readsOf(file), ['a — why']);
});

test('readsOf reads the block when it is the last content in the file with no trailing newline', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'r.md');
  fs.writeFileSync(file, '# report\n\nreads:\n- a — why');
  assert.deepEqual(readsOf(file), ['a — why']);
});

test('previousHandoff walks moves back to the newest earlier stage that left a report', () => {
  const root = tmp('fankeel-handoff-');
  const write = (data, stage) => {
    const file = handoffPath(root, data, stage);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'x');
    return file;
  };
  const now = moved('build', 'verify', 'build');
  assert.equal(previousHandoff(root, now), null);
  const buildOne = write(moved('build'), 'build');
  assert.equal(previousHandoff(root, now), buildOne);
  const verifyOne = write(moved('build', 'verify'), 'verify');
  assert.equal(previousHandoff(root, now), verifyOne);
  assert.equal(previousHandoff(root, moved('build')), null);
  // A renamed task's laps start past the old task's: `verify.md` above is not its report.
  const renamed = Object.assign({}, now, { lapped: 2 });
  assert.equal(previousHandoff(root, renamed), null);
  const later = write(Object.assign({}, moved('build', 'verify'), { lapped: 2 }), 'verify');
  assert.equal(previousHandoff(root, renamed), later);
});

// 2026-09-23: a fankeel-brain ran `design`, stage.agents was
// `survey,build,verify`, and the user was asked "design gate placeholder".
test('skipReason names a brain dispatched for a stage stage.agents does not name', () => {
  const mark = { stage: 'design', at: 1758000000000 };
  assert.match(skipReason({ stage: 'design', controlled: false, agents: 'survey,build,verify', inflight: mark, handoff: '/r/design.md' }),
    /fankeel-brain was dispatched for `design`, but stage\.agents \(survey,build,verify\) does not name `design`/);
  assert.equal(skipReason({ stage: 'design', controlled: false, agents: 'survey', inflight: null, handoff: '/r/design.md' }), null);
  assert.equal(skipReason({ stage: 'design', controlled: false, agents: 'survey', inflight: { stage: 'survey' }, handoff: '/r/design.md' }), null);
});

test('skipReason on a controlled stage says which of the two in-file conditions failed', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  assert.match(skipReason({ stage: 'survey', controlled: true, handoff: null }), /no handoff path/);
  assert.match(skipReason({ stage: 'survey', controlled: true, handoff: file }), /does not exist yet/);
  fs.writeFileSync(file, 'a report with no gate block\n');
  assert.match(skipReason({ stage: 'survey', controlled: true, handoff: file }), /no readable `json gate` block/);
});

// 2026-09-24: verify's gate held five questions and AskUserQuestion refused it
// twice. Four is the cap, and the fifth is refused before the call.
test('readGate refuses a fifth question and names the count', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  const g = { questions: [1, 2, 3, 4, 5].map((n) => gateOf('q' + n).questions[0]), next: 'n' };
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file), { invalid: 'questions', detail: '5 questions, 4 is the cap', next: 'n' });
  g.questions.pop();
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file), g);
});

test('skipReason says a controlled stage\'s question does not copy the handoff\'s gate word for word', () => {
  assert.match(skipReason({ stage: 'survey', controlled: true, matches: false, handoff: '/r/survey.md' }),
    /does not copy the handoff's gate word for word/);
  assert.equal(skipReason({ stage: 'survey', controlled: false, matches: false, inflight: null }), null);
});

// gateMatches replaces isPlaceholder as the check hooks/gate.js runs: not "is
// this the fixed placeholder shape" but "does what the controller actually
// asked equal, value for value, what the handoff file's own gate holds".
test('gateMatches: identical questions arrays match', () => {
  const asked = gateOf('q').questions;
  const filed = JSON.parse(JSON.stringify(asked));
  assert.equal(gateMatches(asked, filed), true);
});

test('gateMatches: a question with different question text does not match', () => {
  const filed = gateOf('q').questions;
  const asked = JSON.parse(JSON.stringify(filed));
  asked[0].question = 'q（改過的字）';
  assert.equal(gateMatches(asked, filed), false);
});

test('gateMatches: a differently-worded option label does not match', () => {
  const filed = gateOf('q').questions;
  const asked = JSON.parse(JSON.stringify(filed));
  asked[0].options[0].label = 'not a';
  assert.equal(gateMatches(asked, filed), false);
});

// Picked behaviour: missing vs. present `false` for multiSelect are NOT
// treated as equal — a value dropped in transit is a real difference the
// controller should be told about, not one gateMatches papers over.
test('gateMatches: a missing multiSelect does not match a present multiSelect: false', () => {
  const filed = gateOf('q').questions;
  const asked = JSON.parse(JSON.stringify(filed));
  delete asked[0].multiSelect;
  assert.equal(gateMatches(asked, filed), false);
});

test('readGate: a filed question with no multiSelect reads as multiSelect: false', () => {
  const g = gateOf('q');
  delete g.questions[0].multiSelect;
  const file = path.join(tmp('fk-gate-'), 'survey.md');
  fs.writeFileSync(file, '# r\n\n```json gate\n' + JSON.stringify(g) + '\n```\n');
  const read = readGate(file);
  assert.equal(read.questions[0].multiSelect, false);
  assert.equal(gateMatches(gateOf('q').questions, read.questions), true);
});

test('gateMatches: non-array input never matches', () => {
  const filed = gateOf('q').questions;
  assert.equal(gateMatches(null, filed), false);
  assert.equal(gateMatches(filed, null), false);
  assert.equal(gateMatches(undefined, undefined), false);
});

// A model reconstructing the AskUserQuestion call from the handoff file
// reproduces every value but is not a byte-for-byte copy — key order inside
// an option or a question can differ from what readGate parsed off the file.
// That is still a correct copy and must match.
test('gateMatches: same values, different key order inside an option, still matches', () => {
  const filed = gateOf('q').questions;
  const asked = JSON.parse(JSON.stringify(filed));
  asked[0].options[0] = { description: asked[0].options[0].description, label: asked[0].options[0].label };
  assert.equal(gateMatches(asked, filed), true);
});

// §2 of the 2026-09-24 design: a single-select option may carry a `preview`,
// a multiSelect one may not, and a preview is a non-empty string.
const previewGate = (multiSelect, preview) => {
  const g = gateOf('p');
  g.questions[0].multiSelect = multiSelect;
  g.questions[0].options[0].preview = preview;
  return g;
};

test('readGate: a single-select option may carry a preview', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  const g = previewGate(false, '<b>layout A</b>');
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file), g);
});

test('readGate refuses a preview on a multiSelect question, naming the option', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  fs.writeFileSync(file, block(previewGate(true, '<b>layout A</b>')));
  const got = readGate(file);
  assert.equal(got.invalid, 'questions[0].options[0].preview');
  assert.match(got.detail, /multiSelect/);
});

test('readGate refuses a preview that is not a non-empty string', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  for (const bad of [42, '   ', null]) {
    fs.writeFileSync(file, block(previewGate(false, bad)));
    const got = readGate(file);
    assert.equal(got.invalid, 'questions[0].options[0].preview', JSON.stringify(bad));
    assert.match(got.detail, /non-empty string/);
  }
});

test('gateMatches: a copy that drops or rewords a preview does not match', () => {
  const filed = previewGate(false, '<b>layout A</b>').questions;
  const dropped = JSON.parse(JSON.stringify(filed));
  delete dropped[0].options[0].preview;
  assert.equal(gateMatches(dropped, filed), false);
  const reworded = JSON.parse(JSON.stringify(filed));
  reworded[0].options[0].preview = '<b>layout B</b>';
  assert.equal(gateMatches(reworded, filed), false);
  assert.equal(gateMatches(JSON.parse(JSON.stringify(filed)), filed), true);
});

test('answersGate: reworded questions and labels with the same option counts match', () => {
  const filed = [{ question: 'a?', header: 'h', options: [{ label: 'x' }, { label: 'y' }] }];
  const asked = [{ question: 'b?', header: 'other', options: [{ label: 'p' }, { label: 'q' }] }];
  assert.equal(answersGate(asked, filed), true);
});

test('answersGate: a different number of questions does not match', () => {
  const q = { question: 'a?', options: [{ label: 'x' }, { label: 'y' }] };
  assert.equal(answersGate([q], [q, q]), false);
  assert.equal(answersGate([q, q], [q]), false);
});

test('answersGate: one question with a different option count does not match', () => {
  const two = { question: 'a?', options: [{ label: 'x' }, { label: 'y' }] };
  const three = { question: 'a?', options: [{ label: 'x' }, { label: 'y' }, { label: 'z' }] };
  assert.equal(answersGate([two, two], [two, three]), false);
});

test('answersGate: non-arrays and empty lists do not match', () => {
  assert.equal(answersGate(undefined, []), false);
  assert.equal(answersGate([], []), false);
  assert.equal(answersGate('x', 'x'), false);
});

test('readGate: a gate with an empty or missing next has no pause option and is invalid at next', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  for (const next of [undefined, '', '   ']) {
    const g = gateOf('ok');
    if (next === undefined) delete g.next; else g.next = next;
    fs.writeFileSync(file, block(g));
    const got = readGate(file);
    assert.equal(got.invalid, 'next', JSON.stringify(next));
    assert.equal(got.detail, 'no pause option');
  }
  fs.writeFileSync(file, block(gateOf('ok')));
  assert.equal(readGate(file).invalid, undefined);
});

// docs/90-agent/plans/2026-09-30-init-design.md §6 (gate-2): the survey gate
// that offered no pause, and "改走 bounded" on a task started architectural.
test('with rules, a gate with no pause is refused, and one naming a class below the floor is refused', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  const g = gateOf('s');
  g.questions[0].options[0].label = '進 design';
  g.questions[0].options[1].label = '改走 bounded';
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, 'design'), g, 'without rules nothing new is asked');
  const paused = readGate(file, 'design', null, { pause: true });
  assert.equal(paused.invalid, 'questions');
  assert.match(paused.detail, /pause/);

  g.questions[0].options.push({ label: '暫停', description: 'c' });
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, 'design', null, { pause: true }), g);
  const low = readGate(file, 'design', null, { pause: true, floor: 'architectural' });
  assert.equal(low.invalid, 'questions[0].options[1].label');
  assert.match(low.detail, /bounded.*architectural/);
  assert.deepEqual(readGate(file, 'design', null, { pause: true, floor: 'bounded' }), g, 'the floor itself is not below it');
});

// gate-4: on 2026-10-01 three stage-agent gates with two options (build-2,
// verify-2, land) passed hooks/gate.js; the stage rule is three at least.
// Only the first question: a survey's per-entry questions keep 2 to 4.
test('with rules, a first question with two options is refused, and a later question may keep two', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'build.md');
  const g = gateOf('s');
  g.questions[0].options[0].label = '進 verify';
  g.questions[0].options[1].label = '暫停';
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, 'verify'), g, 'without rules two options still pass');
  const two = readGate(file, 'verify', null, { pause: true });
  assert.equal(two.invalid, 'questions[0].options');
  assert.equal(two.detail, 'the first question has 2 options, 3 at least: the approval, the open decision or none, and the pause');

  g.questions[0].options.splice(1, 0, { label: '回 build', description: 'b' });
  g.questions.push({ question: 'entry?', header: 'entry', multiSelect: false, options: [{ label: 'now', description: 'a' }, { label: 'later', description: 'b' }] });
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, 'verify', null, { pause: true }), g, 'three on the first and two on the second pass');
});

test('liveMarks drops a build group mark once its group handoff landed after it, and keeps the rest', () => {
  const root = tmp('fankeel-livemarks-');
  const data = Object.assign({}, DATA, { stage: 'build', inflight: [
    { stage: 'build', at: 1, group: 2, kind: 'group', agentId: 'g2' },
    { stage: 'build', at: 1, group: 3, kind: 'group', agentId: 'g3' },
    { stage: 'build', at: 1, group: 4, kind: 'close', agentId: 'c' },
  ] });
  const file = handoffPath(root, data, 'build', undefined, 2);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '# group 2\n');
  assert.deepEqual(liveMarks(root, data).map((m) => m.agentId), ['g3', 'c']);
});

test('liveMarks keeps a group mark whose handoff is older than the mark, and reads a single mark', () => {
  const root = tmp('fankeel-livemarks-');
  const mark = { stage: 'build', at: Date.now() + 60000, group: 2, kind: 'group', agentId: 'g2' };
  const data = Object.assign({}, DATA, { stage: 'build', inflight: mark });
  const file = handoffPath(root, data, 'build', undefined, 2);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '# an earlier lap\n');
  assert.deepEqual(liveMarks(root, data), [mark]);
  assert.deepEqual(liveMarks(root, Object.assign({}, DATA)), []);
});
