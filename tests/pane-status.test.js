'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ledger = require('../lib/ledger.js');
const plantasks = require('../lib/plantasks.js');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-status.ts')).href);
const compact = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'compact.ts')).href);
const ID = 'f0a58f35-ae39-4954-89d6-e0b9129a4082';
const NOW = Date.parse('2026-10-11T00:00:00.000Z');
const entry = {
    task: 'fankeel 面板 mod：把任務／階段狀態做成隨 plugin 出貨的 Claude Code mod Pane',
    class: 'architectural',
    route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'],
    stage: 'design',
    active: true,
    guard: 'deny',
    next: '畫 mockup，等使用者看過再進 plan',
    notes: ['Pane 由 /fankeel-panel 開', 'gate 區塊沿用 2026-10-09 核准的設計'],
    claims: ['hooks/mod.ts', 'hooks/pane.ts', 'tests/pane.test.js', 'docs/a/very/long/path/that/goes/on/and/on/file.md'],
    clock: { survey: [1000, 661000], design: [661000, null] },
    waited: { survey: 600000 },
};
const other = { id: 'aaaaaaaa-0000-4000-8000-000000000001', entry: { task: '站頁看得到對話全文', stage: 'build', active: true, claims: ['hooks/mod.ts'], updated: '2026-10-10T22:00:00.000Z' } };
const context = { tokens: 312400, at: 450000 };
const plan = { name: '2026-10-11-fankeel-pane', done: 4, total: 5 };
const line = (row) => row.segs.map((seg) => seg.text).join(' ');
const drawn = (rows, block) => rows.filter((r) => r.block === block && r.segs.length);
const text = (rows, block) => drawn(rows, block).map(line);
const all = (m, cols, room) => m.statusRows(ID, entry, [other], context, plan, cols, room, NOW);

test('the blocks are context, plan, notes, neighbours, touched, foot, and what the band shows is gone', async () => {
    const m = await load();
    const rows = all(m, 44, 60);
    assert.deepEqual([...new Set(rows.map((r) => r.block))], ['context', 'plan', 'notes', 'neighbours', 'touched', 'foot']);
    const seen = rows.map(line).join('\n');
    for (const gone of ['fankeel 面板', 'architectural', '[design]', '2 of 7', 'next', 'guard', 'deny', 'gate 等']) {
        assert.ok(!seen.includes(gone), gone + ' is still drawn');
    }
});

test('one blank row sits above every block but the first, and belongs to the block under it', async () => {
    const m = await load();
    const rows = all(m, 44, 60);
    assert.ok(rows[0].segs.length && rows[rows.length - 1].segs.length);
    const blanks = rows.map((r, i) => (r.segs.length ? -1 : i)).filter((i) => i >= 0);
    assert.equal(blanks.length, 5);
    for (const i of blanks) {
        assert.equal(rows[i].block, rows[i + 1].block);
        assert.notEqual(rows[i].block, rows[i - 1].block);
    }
});

test('context is the tokens against the compact threshold, bold once they reach it, then what survives', async () => {
    const m = await load();
    const rows = drawn(all(m, 44, 60), 'context');
    assert.deepEqual(rows.map((r) => r.segs), [
        [{ text: 'context', tone: 'head', bold: true }],
        [{ text: '312k', tone: 'amber', bold: true }, { text: '· 到 450k 自動 compact', tone: 'dim' }],
        [{ text: '留 task · stage · plan · agent · handoff', tone: 'dim' }],
    ]);
    const at = (tokens, limit) => drawn(m.statusRows(ID, entry, [], { tokens, at: limit }, null, 44, 60, NOW), 'context')[1].segs;
    assert.deepEqual(at(450000, 450000), [{ text: '450k', tone: 'amber', bold: true }, { text: '· 到 450k 自動 compact', tone: 'amber', bold: true }]);
    assert.deepEqual(at(449999, 450000)[1], { text: '· 到 450k 自動 compact', tone: 'dim' });
    assert.deepEqual(at(9000, 123456).map((seg) => seg.text), ['9k', '· 到 123k 自動 compact']);
    assert.deepEqual(text(m.statusRows(ID, entry, [], null, null, 44, 60, NOW), 'context'), []);
});

test('what the context block says survives is what the compact instructions keep', async () => {
    const { KEPT } = await load();
    const { instructionsFor } = await compact();
    assert.deepEqual(KEPT, ['task', 'stage', 'plan', 'agent', 'handoff']);
    const kept = instructionsFor(ID, { task: 'demo', stage: 'build', class: 'bounded' }, 'F:/plugin');
    // 'task' is also in the opening sentence, so the line itself is what is looked for.
    for (const word of KEPT) assert.ok(kept.includes(word === 'task' ? '- task:' : word), word + ' is not in the compact instructions');
});

test('plan is one dot a task, the count, and the plan\'s name; no ledger is no block', async () => {
    const m = await load();
    const of = (count, cols) => drawn(m.statusRows(ID, entry, [], null, count, cols || 44, 60, NOW), 'plan').map((r) => r.segs);
    assert.deepEqual(of(plan), [
        [{ text: 'plan', tone: 'head', bold: true }],
        [{ text: '●●●●', tone: 'head' }, { text: '○', tone: 'hollow' }, { text: 'tasks 4 of 5', tone: 'plain' }],
        [{ text: '2026-10-11-fankeel-pane', tone: 'dim' }],
    ]);
    assert.deepEqual(of({ name: 'p', done: 0, total: 2 })[1], [{ text: '○○', tone: 'hollow' }, { text: 'tasks 0 of 2', tone: 'plain' }]);
    assert.deepEqual(of({ name: 'p', done: 2, total: 2 })[1], [{ text: '●●', tone: 'head' }, { text: 'tasks 2 of 2', tone: 'plain' }]);
    assert.deepEqual(of({ name: 'p', done: 9, total: 2 })[1], [{ text: '●●', tone: 'head' }, { text: 'tasks 2 of 2', tone: 'plain' }]);
    assert.deepEqual(of({ name: 'p', done: 3, total: 40 })[1], [{ text: 'tasks 3 of 40', tone: 'plain' }]);
    assert.deepEqual(of({ name: 'p', done: 0, total: 0 }), []);
    assert.deepEqual(of(null), []);
});

test('notes are at most five, each under the notes heading', async () => {
    const m = await load();
    const many = Object.assign({}, entry, { notes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    assert.deepEqual(text(m.statusRows(ID, many, [], null, null, 44, 60, NOW), 'notes'), ['notes', '· a', '· b', '· c', '· d', '· e']);
    assert.deepEqual(drawn(all(m, 44, 60), 'notes')[1].segs, [{ text: '· Pane 由 /fankeel-panel 開', tone: 'text' }]);
    assert.deepEqual(text(m.statusRows(ID, Object.assign({}, entry, { notes: [] }), [], null, null, 44, 60, NOW), 'notes'), []);
});

test('a neighbour carries its stage and age, and a shared file is a flagged row', async () => {
    const m = await load();
    const rows = drawn(all(m, 44, 60), 'neighbours');
    assert.deepEqual(rows[0].segs, [{ text: '其他 session', tone: 'head', bold: true }]);
    assert.equal(line(rows[1]), '站頁看得到對話全文 @ build · 2h');
    assert.deepEqual(rows[2].segs, [{ text: '⚑ 共用 hooks/mod.ts', tone: 'clash', bold: true }]);
    const apart = { id: 'bbbbbbbb-0000-4000-8000-000000000002', entry: { task: 'x', stage: 'plan', active: true, claims: ['lib/x.js'] } };
    assert.deepEqual(text(m.statusRows(ID, entry, [apart], null, null, 44, 60, NOW), 'neighbours'), ['其他 session', 'x @ plan · ?']);
    assert.deepEqual(text(m.statusRows(ID, entry, [], null, null, 44, 60, NOW), 'neighbours'), []);
});

test('touched is the count and the last three paths, a long one kept by its tail', async () => {
    const m = await load();
    const rows = text(all(m, 44, 60), 'touched');
    assert.equal(rows.length, 4);
    assert.equal(rows[0], 'touched 4');
    assert.equal(rows[1], 'hooks/pane.ts');
    assert.ok(rows[3].startsWith('…') && rows[3].endsWith('file.md'));
    assert.deepEqual(text(m.statusRows(ID, Object.assign({}, entry, { claims: [] }), [], null, null, 44, 60, NOW), 'touched'), []);
});

test('foot is one row: the session and how to close the pane', async () => {
    const m = await load();
    assert.deepEqual(drawn(all(m, 44, 60), 'foot').map((r) => r.segs), [[{ text: 'f0a58f35 · /fankeel-panel 關閉', tone: 'dim' }]]);
});

test('blocks drop in the order touched, neighbours, notes, plan, context, and foot never does', async () => {
    const m = await load();
    const kept = (room) => [...new Set(all(m, 44, room).map((r) => r.block))];
    assert.equal(all(m, 44, 60).length, 22);
    assert.deepEqual(kept(22), ['context', 'plan', 'notes', 'neighbours', 'touched', 'foot']);
    assert.deepEqual(kept(21), ['context', 'plan', 'notes', 'neighbours', 'foot']);
    assert.deepEqual(kept(17), ['context', 'plan', 'notes', 'neighbours', 'foot']);
    assert.deepEqual(kept(16), ['context', 'plan', 'notes', 'foot']);
    assert.deepEqual(kept(12), ['context', 'plan', 'foot']);
    assert.deepEqual(kept(8), ['context', 'foot']);
    assert.deepEqual(kept(4), ['foot']);
    assert.deepEqual(kept(-9), ['foot']);
    for (const room of [22, 21, 17, 16, 13, 12, 9, 8, 5, 4]) assert.ok(all(m, 44, room).length <= room, room + ' < ' + all(m, 44, room).length);
});

test('no row is wider than the pane, and CJK counts two', async () => {
    const m = await load();
    assert.equal(m.width('ab面板'), 6);
    const cells = (row) => row.segs.reduce((n, seg) => n + m.width(seg.text), Math.max(0, row.segs.length - 1));
    for (const cols of [30, 41, 88]) {
        for (const row of all(m, cols, 60)) assert.ok(cells(row) <= cols, cols + ' < ' + cells(row) + ': ' + line(row));
    }
});

test('no entry draws only the empty block', async () => {
    const m = await load();
    const rows = m.statusRows(ID, null, [other], context, plan, 44, 44, NOW);
    assert.deepEqual(rows.map((r) => r.block), ['empty', 'empty']);
    assert.ok(rows.some((r) => line(r).includes('/fankeel')));
});

test('ledgerDone counts what lib/ledger.js completed() counts, for the plan the ledger names', async () => {
    const { ledgerDone } = await load();
    const claim = 'docs/90-agent/plans/2026-10-11-fankeel-pane.md';
    const body = [
        ledger.header(claim),
        ledger.planLine('585391352af5..9d4da4450a28'),
        '',
        'fankeel ledger — 3 groups over 5 tasks',
        ledger.fixLine('Task 2: a test pins the bounds', '0d4be9c..c743946'),
        ledger.completionLine(2, 'gate rows', '0d4be9c..c743946'),
        ledger.rulingLine('Task 1: complete is not a completion here', 'it is a ruling', 'nothing'),
        ledger.completionLine(1, 'status rows'),
        '  ' + ledger.completionLine(4, 'docs'),
        ledger.completionLine(2, 'gate rows, again'),
        'Task 7: completed later',
    ].join('\n') + '\n';
    assert.ok(ledger.owns(body, claim));
    assert.equal(ledgerDone(body, claim), new Set(ledger.completed(body)).size);
    assert.equal(ledgerDone(body, claim), 3);
    assert.equal(ledgerDone(body.replace(/\n/g, '\r\n'), claim), 3);
    for (const foreign of ['docs/90-agent/plans/other.md', '2026-10-11-fankeel-pane.md']) {
        assert.equal(ledger.owns(body, foreign), false);
        assert.equal(ledgerDone(body, foreign), null);
    }
    assert.equal(ledgerDone('', claim), null);
});

test('planTotal counts the headings lib/plantasks.js parseTasks counts', async () => {
    const { planTotal } = await load();
    const fence = '`'.repeat(3);
    const body = ['# Plan', '', '## Global Constraints', '', '## Task 1: one', 'text', fence + 'md', '## Task 9: an example inside a fence', fence,
        '##  Task 2:  two', '### Task 3: a sub-heading', '## Task three: no number', '   ## Task 4: indented', '## Coverage', ''].join('\n');
    assert.equal(plantasks.parseTasks(body).length, 3);
    assert.equal(planTotal(body), plantasks.parseTasks(body).length);
    assert.equal(planTotal(body.replace(/\n/g, '\r\n')), 3);
    assert.equal(planTotal(''), 0);
});
