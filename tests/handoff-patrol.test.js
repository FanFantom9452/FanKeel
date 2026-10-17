'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const todo = require('../lib/todo.js');
const { readGate, isPatrol, patrolEntries, patrolProblem, reportProblem } = require('../lib/handoff.js');

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

test('a hand-written TODO.md lists its open bullets by title, and a report skipping one is refused', () => {
  const dir = tmp('fankeel-patrol-file-');
  fs.writeFileSync(path.join(dir, 'TODO.md'), '# TODO\n\n## Ready\n\n- 〔ui〕流程圖重畫 — [細節](docs/a.md)\n\n## Blocked\n\n### after: v2\n\n- `gate.js` 的等待計時：上游未修\n\n## Watch\n\n### if: 使用者回報\n\n- 認可上限 — 再觀察\n\n## Notes\n\n- not an entry\n');
  const entries = patrolEntries(dir, { stage: 'survey', route: ROUTE });
  assert.deepEqual(entries.map((e) => e.title), ['流程圖重畫', 'gate.js 的等待計時', '認可上限']);
  assert.equal(patrolProblem('- 流程圖重畫 — do now\n- gate.js 的等待計時 — waiting on v2\n- 認可上限 — keep', entries), null);
  const got = patrolProblem('- 流程圖重畫 — do now\n- 認可上限 — keep', entries);
  assert.equal(got.at, 'report');
  assert.match(got.detail, /gate\.js 的等待計時/);
});

test('a report line copying a hand-written bullet with its markdown still names it', () => {
  const entries = [{ id: null, title: 'gate.js 的等待計時' }, { id: null, title: '流程圖重畫' }];
  assert.equal(patrolProblem('- `gate.js` 的等待計時 — keep\n- [流程圖重畫](docs/a.md) — do now', entries), null);
});

test('two entries with one title need a line each', () => {
  const entries = [{ id: null, title: '重寫說明' }, { id: null, title: '重寫說明' }];
  assert.match(patrolProblem('- 重寫說明 — keep', entries).detail, /1 of 2/);
  assert.equal(patrolProblem('- 重寫說明 — keep\n- 重寫說明（第二條）— waiting on v2', entries), null);
});

test('one line counts for one entry: two named on it, a longer title, a title shared by two ids', () => {
  const both = [{ id: null, title: 'foo' }, { id: null, title: 'bar' }];
  assert.match(patrolProblem('- foo and bar — keep', both).detail, /1 of 2/);
  assert.equal(patrolProblem('- foo and bar — keep\n- bar — waiting on v2', both), null);
  const nested = [{ id: null, title: 'foo' }, { id: null, title: 'foo bar' }];
  assert.match(patrolProblem('- foo bar — keep', nested).detail, /1 of 2/);
  const shared = [{ id: 'a-1', title: '重寫' }, { id: 'a-2', title: '重寫' }];
  assert.match(patrolProblem('- 重寫 — keep', shared).detail, /1 of 2/);
  assert.equal(patrolProblem('- a-1 — keep\n- a-2 — do now', shared), null);
});

test('a title carrying a disposition word does not supply its own disposition', () => {
  const entries = [{ id: null, title: 'Keep docs in sync' }];
  assert.match(patrolProblem('- Keep docs in sync', entries).detail, /1 of 1/);
  assert.equal(patrolProblem('- Keep docs in sync — waiting on v2', entries), null);
});

test('an in-session report is read above its gate block only', () => {
  const f = path.join(tmp('fankeel-patrol-'), 'survey.md');
  fs.writeFileSync(f, '- docs-1 — keep\n\n' + TICKS + 'json gate\n{"next":"docs-12 keep","x":"認可上限 keep"}\n' + TICKS + '\n');
  assert.match(reportProblem(f, ENTRIES).detail, /docs-12/);
  assert.equal(reportProblem(path.join(path.dirname(f), 'none.md'), ENTRIES).at, 'file');
});

test('neither the id nor a repeated title supplies the disposition', () => {
  const entries = [{ id: 'docs-1', title: 'Keep docs in sync' }];
  assert.ok(patrolProblem('- docs-1 — Keep docs in sync', entries));
  assert.ok(patrolProblem('- Keep docs in sync (Keep docs in sync)', [{ id: null, title: 'Keep docs in sync' }]));
  assert.equal(patrolProblem('- docs-1 — Keep docs in sync — do now', entries), null);
});
