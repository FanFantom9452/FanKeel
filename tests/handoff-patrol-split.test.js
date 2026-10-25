'use strict';
// gate-18: on 2026-10-21 (739fa960 turns 3-4) a patrol report wrote
// `- flaky-1、flaky-3、flaky-4、flaky-5 … 各 keep`, one line for four entries,
// and was refused only at the controller's question with a list of ids and
// no word on why. A line counts for one entry; the refusal now says so.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const { readGate, patrolProblem } = require('../lib/handoff.js');
const gateCheck = require('../scripts/gate-check.js');

const TICKS = '`'.repeat(3);
const ROUTE = ['survey', 'plan', 'build', 'verify', 'land'];
const GATE = { questions: [{ header: '下一站', question: 'plan?', multiSelect: false, options: [{ label: 'plan', description: 'a' }, { label: 'stay', description: 'b' }, { label: 'pause', description: 'c' }] }], next: 'plan' };
const ENTRIES = [{ id: 'flaky-3', title: '偶發三' }, { id: 'flaky-4', title: '偶發四' }, { id: 'flaky-5', title: '偶發五' }, { id: 'test-8', title: '認可上限' }];
const SPLIT = /flaky-4, flaky-5 only share a line with another entry: one line counts for one entry, so split it, one line per entry \(一行只算一條，請拆開\)/;

test('entries named only on a line another entry holds are told to split it', () => {
    const got = patrolProblem('- flaky-3、flaky-4、flaky-5 三條：各 keep\n- test-8 — keep', ENTRIES);
    assert.equal(got.at, 'report');
    assert.match(got.detail, /^2 of 4 open TODO entries have no line naming them with a disposition \(do now, needs the user, waiting on, keep\): flaky-4, flaky-5 — /);
    assert.match(got.detail, SPLIT);
    assert.match(got.detail, / — a patrol checks Blocked and Watch too, one line each$/);
});

test('an entry no line names gets no split hint', () => {
    const got = patrolProblem('- flaky-3 — keep\n- flaky-4 — keep\n- test-8 — keep', ENTRIES);
    assert.match(got.detail, /: flaky-5 — a patrol checks Blocked and Watch too, one line each$/);
    assert.doesNotMatch(got.detail, /only share a line/);
});

test('the same report split one line per entry passes', () => {
    assert.equal(patrolProblem('- flaky-3 — keep\n- flaky-4 — keep\n- flaky-5 — keep\n- test-8 — keep', ENTRIES), null);
});

test('the gate check a brain runs carries the hint', () => {
    const f = path.join(tmp('fankeel-patrol-split-'), 'survey.md');
    fs.writeFileSync(f, '- flaky-3、flaky-4、flaky-5 三條：各 keep\n- test-8 — keep\n\n' + TICKS + 'json gate\n' + JSON.stringify(GATE) + '\n' + TICKS + '\n');
    const gate = readGate(f, 'plan', ROUTE, { patrol: ENTRIES });
    assert.equal(gate.invalid, 'report');
    assert.match(gate.detail, SPLIT);
});

// The other incident (9f451488 turns 2 and 80): a patrol gate whose option
// label was the bare id `pane-17`. gate-check, which the brain runs before it
// returns, refuses it there; the title passes.
test('a patrol gate naming an entry by its bare id is refused by the gate check the brain runs', () => {
    const SESSION = 'aaaaaaaa-0000-4000-8000-000000000018';
    const root = tmp('fankeel-patrol-bare-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
        task: 'patrol', claims: [], stage: 'survey', active: true, route: ROUTE,
        started: '2026-10-20T18:30:37.000Z', updated: new Date().toISOString() }));
    fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({ preset: 'flat', index: 'docs/README.md', buckets: [{ path: 'docs/todo', role: 'todo' }] }));
    fs.mkdirSync(path.join(root, 'docs', 'todo'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'todo', 'pane-17.md'), '---\nlabel: pane\ntitle: 窗格待辦\ndescription: d\nstate: ready\n---\n\nbody\n');
    const write = (label) => {
        const file = path.join(root, 'survey.md');
        const questions = [{ header: '下一站', question: '要進 plan 嗎？', multiSelect: false,
            options: [{ label: 'plan (Recommended)', description: 'd' }, { label, description: 'd' }, { label: '暫停', description: 'd' }] }];
        fs.writeFileSync(file, '- 窗格待辦 — do now\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions, next: 'plan' }) + '\n' + TICKS + '\n');
        return file;
    };
    const bad = gateCheck.main(['--session', SESSION, '--root', root, write('pane-17')]);
    assert.equal(bad.code, 1);
    assert.match(bad.text, /"pane-17" stands where its name should be/);
    assert.deepEqual(gateCheck.main(['--session', SESSION, '--root', root, write('只做窗格待辦')]), { text: 'gate ok', code: 0 });
});

test('the brain is told a line naming several entries counts for one', () => {
    const text = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
    assert.match(text, /one report line per open\s+entry with its disposition, a line naming several\s+entries counting for one/);
});
