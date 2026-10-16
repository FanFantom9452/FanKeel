'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const todo = require('../lib/todo.js');
const { readGate, isPatrol, patrolEntries, patrolProblem } = require('../lib/handoff.js');

const TICKS = '`'.repeat(3);
const GATE = { questions: [{ header: '下一站', question: 'plan?', multiSelect: false, options: [{ label: 'plan', description: 'a' }, { label: 'stay', description: 'b' }, { label: 'pause', description: 'c' }] }], next: 'plan' };
const ROUTE = ['survey', 'plan', 'build', 'verify', 'land'];
const ENTRIES = [{ id: 'docs-1', title: '流程圖' }, { id: 'docs-12', title: '另一頁' }, { id: 'test-8', title: '認可上限' }];
const file = (report) => {
  const f = path.join(tmp('fankeel-patrol-'), 'survey.md');
  fs.writeFileSync(f, report + '\n\n' + TICKS + 'json gate\n' + JSON.stringify(GATE) + '\n' + TICKS + '\n');
  return f;
};

test('a patrol is the patrol route at survey, and nothing else', () => {
  assert.equal(isPatrol({ stage: 'survey', route: ROUTE }), true);
  assert.equal(isPatrol({ stage: 'plan', route: ROUTE }), false);
  assert.equal(isPatrol({ stage: 'survey', route: ['survey', 'design', 'build', 'verify', 'land'] }), false);
  assert.equal(isPatrol(null), false);
});

test('a report naming every open entry with a disposition passes', () => {
  const report = '- docs-1 — waiting on the other project\n- docs-12 — keep\n- 認可上限 — do now';
  assert.equal(patrolProblem(report, ENTRIES), null);
  const gate = readGate(file(report), 'plan', ROUTE, { patrol: ENTRIES });
  assert.ok(gate && !gate.invalid, JSON.stringify(gate));
});

test('a report that skips an entry is refused, naming it', () => {
  const report = '- docs-1 — waiting on the other project\n- test-8 — do now\n22 Blocked and Watch seen by title only';
  const got = patrolProblem(report, ENTRIES);
  assert.equal(got.at, 'report');
  assert.match(got.detail, /docs-12/);
  assert.doesNotMatch(got.detail, /test-8/);
  const gate = readGate(file(report), 'plan', ROUTE, { patrol: ENTRIES });
  assert.equal(gate.invalid, 'report');
});

test('an id inside a longer id does not count, and a line with no disposition does not either', () => {
  const report = '- docs-12 — keep\n- test-8 — looked at it';
  const got = patrolProblem(report, ENTRIES);
  assert.match(got.detail, /docs-1(,|$)/);
  assert.match(got.detail, /test-8/);
});

test('the gate block itself is not the report', () => {
  const f = path.join(tmp('fankeel-patrol-'), 'survey.md');
  const gate = Object.assign({}, GATE, { next: 'docs-1 docs-12 test-8 keep' });
  fs.writeFileSync(f, '# report\n\n' + TICKS + 'json gate\n' + JSON.stringify(gate) + '\n' + TICKS + '\n');
  assert.equal(readGate(f, 'plan', ROUTE, { patrol: ENTRIES }).invalid, 'report');
});

test('patrolEntries lists open entries only, and only for a patrol', () => {
  const dir = tmp('fankeel-patrol-root-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  todo.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  todo.add(dir, { label: 'a', title: 'two', description: 'second', state: 'ready' });
  const all = todo.load(dir).all;
  const doneId = all[1].id;
  const f = path.join(dir, all[1].file);
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/^state: ready$/m, 'state: done'));
  assert.deepEqual(patrolEntries(dir, { stage: 'survey', route: ROUTE }).map((e) => e.id), all.filter((e) => e.id !== doneId).map((e) => e.id));
  assert.equal(patrolEntries(dir, { stage: 'build', route: ROUTE }), null);
});
