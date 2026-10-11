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
    waited: { survey: 600000, design: 125000 },
    moves: [['survey', NOW - 49 * 60000, 1], ['design', NOW - 38 * 60000 - 5000, 2]],
};
const other = { id: 'aaaaaaaa-0000-4000-8000-000000000001', entry: { task: '站頁看得到對話全文', stage: 'build', active: true, claims: ['hooks/mod.ts'], updated: '2026-10-10T22:00:00.000Z' } };
const context = { tokens: 312400, at: 450000 };
const plan = { name: '2026-10-11-fankeel-pane', done: 4, total: 5 };
// The same entry with a subagent out on its stage.
const busy = Object.assign({}, entry, { inflight: { stage: 'design', at: NOW - 12 * 60000 - 30000, group: 2 } });
const line = (row) => row.segs.map((seg) => seg.text).join(' ');
const drawn = (rows, block) => rows.filter((r) => r.block === block && r.segs.length);
const text = (rows, block) => drawn(rows, block).map(line);
const all = (m, cols, room) => m.statusRows(ID, entry, [other], context, plan, cols, room, NOW);
const alone = (m, mine, cols) => m.statusRows(ID, mine, [], null, null, cols || 44, 60, NOW);

test('the blocks are task, neighbours, agent, context, plan, notes, foot, and touched and the neighbours\' names are gone', async () => {
    const m = await load();
    const rows = m.statusRows(ID, busy, [other], context, plan, 44, 60, NOW);
    assert.deepEqual([...new Set(rows.map((r) => r.block))], ['task', 'neighbours', 'agent', 'context', 'plan', 'notes', 'foot']);
    const seen = rows.map(line).join('\n');
    for (const gone of ['touched', '其他 session', '共用', '站頁看得到對話全文', '@ build', 'architectural', 'guard', 'deny']) {
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

test('the task block opens with the title whole, the route with this stage in brackets, and next whole', async () => {
    const m = await load();
    assert.deepEqual(drawn(all(m, 44, 60), 'task').slice(0, 5).map((r) => r.segs), [
        [{ text: 'fankeel 面板 mod：把任務／階段狀態做成隨', tone: 'plain', bold: true }],
        [{ text: 'plugin 出貨的 Claude Code mod Pane', tone: 'plain', bold: true }],
        [{ text: 'survey ▸ [design] ▸ plan ▸ build ▸ verify ▸', tone: 'text' }],
        [{ text: 'audit ▸ land', tone: 'text' }],
        [{ text: 'next: 畫 mockup，等使用者看過再進 plan', tone: 'text' }],
    ]);
    assert.deepEqual(text(all(m, 30, 60), 'task').slice(0, 7), [
        'fankeel 面板 mod：把任務／階段',
        '狀態做成隨 plugin 出貨的',
        'Claude Code mod Pane',
        'survey ▸ [design] ▸ plan ▸',
        'build ▸ verify ▸ audit ▸ land',
        'next: 畫 mockup，等使用者看過',
        '再進 plan',
    ]);
    // Sixty CJK characters and no space: four full rows of thirty cells, nothing cut.
    const long = '把一個很長的任務標題折成好幾行而不是截斷'.repeat(3);
    const rows = text(alone(m, Object.assign({}, entry, { task: long, next: '' }), 30), 'task');
    const title = rows.slice(0, rows.indexOf('survey ▸ [design] ▸ plan ▸'));
    assert.equal(title.length, 4);
    assert.equal(title.join(''), long);
    assert.ok(title.every((row) => m.width(row) === 30), title.join(' | '));
    assert.ok(!rows.some((row) => row.startsWith('next')), 'a next row is drawn with no next');
    const off = text(alone(m, Object.assign({}, entry, { stage: 'init' })), 'task').join('\n');
    assert.ok(!off.includes('[') && off.includes('survey ▸ design ▸ plan'), off);
    assert.ok(!text(alone(m, Object.assign({}, entry, { route: [] })), 'task').join('\n').includes('▸'));
});

test('the task block ends with this stage\'s minutes and the wait in it, then the stage before; the first stage has none before', async () => {
    const m = await load();
    const ends = (over) => text(alone(m, Object.assign({}, entry, over)), 'task').filter((row) => /^[本上]站 /.test(row));
    assert.deepEqual(drawn(all(m, 44, 60), 'task').slice(-2).map((r) => r.segs), [
        [{ text: '本站 design 38 分 · 等你 2 分', tone: 'dim' }],
        [{ text: '上站 survey 11 分 · 等你 10 分', tone: 'dim' }],
    ]);
    assert.deepEqual(ends({ stage: 'survey', moves: [['survey', NOW - 5 * 60000, 1]] }), ['本站 survey 5 分 · 等你 10 分']);
    assert.deepEqual(ends({ stage: 'init' }).length, 1, 'a stage off the route has no stage before it');
    assert.deepEqual(ends({ waited: undefined }), ['本站 design 38 分 · 等你 0 分', '上站 survey 11 分 · 等你 0 分']);
    // The stage before is read off `clock`, both marks of it; this one off `moves`, else `clock`.
    assert.deepEqual(ends({ clock: { survey: [1000, null] } })[1], '上站 survey ? 分 · 等你 10 分');
    assert.deepEqual(ends({ moves: undefined, clock: { design: [NOW - 7 * 60000, null] } }), ['本站 design 7 分 · 等你 2 分', '上站 survey ? 分 · 等你 10 分']);
    assert.deepEqual(ends({ moves: undefined, clock: undefined })[0], '本站 design ? 分 · 等你 2 分');
});

test('context is the tokens against the compact threshold, and what survives only from four fifths of it', async () => {
    const m = await load();
    const rows = drawn(all(m, 44, 60), 'context');
    assert.deepEqual(rows.map((r) => r.segs), [
        [{ text: 'context', tone: 'head', bold: true }],
        [{ text: '312k', tone: 'heat65', bold: true }, { text: '· 到 450k 自動 compact', tone: 'dim' }],
    ]);
    const at = (tokens, limit) => drawn(m.statusRows(ID, entry, [], { tokens, at: limit }, null, 44, 60, NOW), 'context');
    assert.deepEqual(at(450000, 450000)[1].segs, [{ text: '450k', tone: 'heat75', bold: true }, { text: '· 到 450k 自動 compact', tone: 'amber', bold: true }]);
    assert.deepEqual(at(449999, 450000)[1].segs[1], { text: '· 到 450k 自動 compact', tone: 'dim' });
    assert.deepEqual(at(9000, 123456)[1].segs, [{ text: '9k', tone: 'plain' }, { text: '· 到 123k 自動 compact', tone: 'dim' }]);
    assert.deepEqual(at(79999, 100000).map(line), ['context', '80k · 到 100k 自動 compact']);
    assert.deepEqual(at(80000, 100000).map(line), ['context', '80k · 到 100k 自動 compact', '留 task · stage · plan · agent · handoff']);
    assert.deepEqual(at(80000, 100000)[2].segs, [{ text: '留 task · stage · plan · agent · handoff', tone: 'dim' }]);
    assert.equal(at(359999, 450000).length, 2);
    assert.equal(at(360000, 450000).length, 3);
    assert.deepEqual(text(m.statusRows(ID, entry, [], null, null, 44, 60, NOW), 'context'), []);
});

test('the context count takes a tone at each of TokenBar\'s nine steps, bold from sixty percent, and none under thirty-six', async () => {
    const m = await load();
    const count = (tokens, limit) => drawn(m.statusRows(ID, entry, [], { tokens, at: limit || 100000 }, null, 44, 60, NOW), 'context')[1].segs[0];
    const steps = [36, 40, 45, 50, 55, 60, 65, 70, 75];
    assert.deepEqual(count(35999), { text: '36k', tone: 'plain' });
    steps.forEach((step, i) => {
        const want = { text: step + 'k', tone: 'heat' + step };
        if (step >= 60) want.bold = true;
        assert.deepEqual(count(step * 1000), want);
        assert.equal(count(step * 1000 - 1).tone, i ? 'heat' + steps[i - 1] : 'plain', 'one token under ' + step + ' percent');
    });
    assert.equal(count(59999).bold, undefined);
    assert.deepEqual(count(250000), { text: '250k', tone: 'heat75', bold: true });
    // 55 percent of 450000 is 247500: a threshold that is not a round hundred thousand.
    assert.equal(count(247500, 450000).tone, 'heat55');
    assert.equal(count(247499, 450000).tone, 'heat50');
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

test('notes are the newest three, each under the notes heading', async () => {
    const m = await load();
    const many = Object.assign({}, entry, { notes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    assert.deepEqual(text(alone(m, many), 'notes'), ['notes', '· e', '· f', '· g']);
    assert.deepEqual(drawn(all(m, 44, 60), 'notes')[1].segs, [{ text: '· Pane 由 /fankeel-panel 開', tone: 'text' }]);
    assert.deepEqual(text(alone(m, Object.assign({}, entry, { notes: [] })), 'notes'), []);
});

test('neighbours are one flagged row for each file another session holds too, and a session that shares none draws nothing', async () => {
    const m = await load();
    const flags = (others, cols) => text(m.statusRows(ID, entry, others, null, null, cols || 44, 60, NOW), 'neighbours');
    assert.deepEqual(drawn(all(m, 44, 60), 'neighbours').map((r) => r.segs), [[{ text: '⚑ hooks/mod.ts', tone: 'clash', bold: true }]]);
    const second = { id: 'cccccccc-0000-4000-8000-000000000003', entry: { task: 'y', stage: 'plan', active: true, claims: ['tests/pane.test.js', 'hooks/mod.ts', 'lib/y.js'] } };
    assert.deepEqual(flags([other, second]), ['⚑ hooks/mod.ts', '⚑ tests/pane.test.js']);
    const apart = { id: 'bbbbbbbb-0000-4000-8000-000000000002', entry: { task: 'x', stage: 'plan', active: true, claims: ['lib/x.js'] } };
    assert.deepEqual(flags([apart]), []);
    assert.deepEqual(flags([apart, other]), ['⚑ hooks/mod.ts']);
    assert.deepEqual(flags([]), []);
    const deep = { id: 'dddddddd-0000-4000-8000-000000000004', entry: { task: 'z', stage: 'build', active: true, scope: [entry.claims[3]] } };
    const [row] = flags([deep], 30);
    assert.ok(row.startsWith('⚑ …') && row.endsWith('file.md') && m.width(row) <= 30, row);
});

test('an agent out on this stage is one row with its group, amber from twenty minutes; a mark for another stage is not drawn', async () => {
    const m = await load();
    const out = (inflight) => drawn(alone(m, Object.assign({}, entry, { inflight })), 'agent').map((r) => r.segs);
    assert.deepEqual(drawn(alone(m, busy), 'agent').map((r) => r.segs), [[{ text: 'agent 出去 12 分 · 第 2 組', tone: 'text' }]]);
    assert.deepEqual(out({ stage: 'design', at: NOW - 20 * 60000 + 1000 }), [[{ text: 'agent 出去 19 分', tone: 'text' }]]);
    assert.deepEqual(out({ stage: 'design', at: NOW - 20 * 60000 }), [[{ text: 'agent 出去 20 分', tone: 'amber' }]]);
    assert.deepEqual(out({ stage: 'design', at: NOW - 95 * 60000, group: 3 }), [[{ text: 'agent 出去 95 分 · 第 3 組', tone: 'amber' }]]);
    assert.deepEqual(out({ stage: 'survey', at: NOW - 60000 }), []);
    assert.deepEqual(out([{ stage: 'survey', at: NOW - 60000 }, { stage: 'design', at: NOW - 3 * 60000, group: 1 }]), [[{ text: 'agent 出去 3 分 · 第 1 組', tone: 'text' }]]);
    assert.deepEqual(out(undefined), []);
});

test('foot is one row: the session and how to close the pane', async () => {
    const m = await load();
    assert.deepEqual(drawn(all(m, 44, 60), 'foot').map((r) => r.segs), [[{ text: 'f0a58f35 · /fankeel-panel 關閉', tone: 'dim' }]]);
});

test('a probe is drawn above the foot, whole, and is never dropped; with none the foot is one row', async () => {
    const m = await load();
    const probe = 'surfaces [terminal, desktop] · surface terminal';
    const rows = (cols, room, said) => m.statusRows(ID, busy, [other], context, plan, cols, room, NOW, said);
    assert.deepEqual(drawn(rows(60, 60, probe), 'foot').map((r) => r.segs), [
        [{ text: probe, tone: 'dim' }],
        [{ text: 'f0a58f35 · /fankeel-panel 關閉', tone: 'dim' }],
    ]);
    assert.equal(rows(60, 60, probe).length, rows(60, 60).length + 1, 'the probe is its own block, or more than a row');
    assert.deepEqual(text(rows(30, 60, probe), 'foot'), ['surfaces [terminal, desktop] ·', 'surface terminal', 'f0a58f35 · /fankeel-panel 關閉']);
    assert.deepEqual(text(rows(60, -9, probe), 'foot'), [probe, 'f0a58f35 · /fankeel-panel 關閉']);
    for (const none of [undefined, null, '']) assert.deepEqual(text(rows(60, 60, none), 'foot'), ['f0a58f35 · /fankeel-panel 關閉']);
    assert.deepEqual(m.statusRows(ID, null, [], null, null, 44, 44, NOW, probe).map((r) => r.block), ['empty', 'empty']);
});

test('blocks drop in the order notes, plan, agent, context, and task, neighbours and foot never do', async () => {
    const m = await load();
    const rows = (room) => m.statusRows(ID, busy, [other], context, plan, 44, room, NOW);
    const kept = (room) => [...new Set(rows(room).map((r) => r.block))];
    assert.equal(rows(60).length, 24);
    assert.deepEqual(kept(24), ['task', 'neighbours', 'agent', 'context', 'plan', 'notes', 'foot']);
    assert.deepEqual(kept(23), ['task', 'neighbours', 'agent', 'context', 'plan', 'foot']);
    assert.deepEqual(kept(20), ['task', 'neighbours', 'agent', 'context', 'plan', 'foot']);
    assert.deepEqual(kept(19), ['task', 'neighbours', 'agent', 'context', 'foot']);
    assert.deepEqual(kept(16), ['task', 'neighbours', 'agent', 'context', 'foot']);
    assert.deepEqual(kept(15), ['task', 'neighbours', 'context', 'foot']);
    assert.deepEqual(kept(14), ['task', 'neighbours', 'context', 'foot']);
    assert.deepEqual(kept(13), ['task', 'neighbours', 'foot']);
    assert.deepEqual(kept(-9), ['task', 'neighbours', 'foot']);
    assert.equal(rows(-9).length, 11);
    for (const room of [24, 23, 20, 19, 16, 15, 14, 13, 11]) assert.ok(rows(room).length <= room, room + ' < ' + rows(room).length);
});

test('no row is wider than the pane, and CJK counts two', async () => {
    const m = await load();
    assert.equal(m.width('ab面板'), 6);
    const cells = (row) => row.segs.reduce((n, seg) => n + m.width(seg.text), Math.max(0, row.segs.length - 1));
    for (const cols of [30, 41, 88]) {
        for (const row of m.statusRows(ID, busy, [other], context, plan, cols, 60, NOW)) assert.ok(cells(row) <= cols, cols + ' < ' + cells(row) + ': ' + line(row));
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
