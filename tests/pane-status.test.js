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
const HOUR = 3600000;
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
const apart = { id: 'bbbbbbbb-0000-4000-8000-000000000002', entry: { task: 'x', stage: 'plan', active: true, claims: ['lib/x.js'] } };
const RAIL = { clash: '#ff5f5f', tasks: '#87af5f', context: '#d787af', quota: '#8787d7', session: '#5fafaf', notes: '#87afd7', foot: '#585858' };
const SECOND = '#8a8a8a';
// A row as the Pane shows it: its segments touch.
const line = (row) => row.segs.map((seg) => seg.text).join('');
const drawn = (rows, block) => rows.filter((r) => r.block === block && r.segs.length);
const text = (rows, block) => drawn(rows, block).map(line);
// A block's rows without the rail segment each one opens with.
const body = (rows, block) => drawn(rows, block).map((r) => r.segs.slice(1));
const status = (m, over) => m.statusRows(Object.assign({ id: ID, entry, others: [], context: null, limits: [], plan: null, cols: 41, room: 60, now: NOW }, over));
const blocksOf = (rows) => [...new Set(rows.map((r) => r.block))];

test('the frame is task, clash, session, notes, foot, and every drawn row opens with its block\'s rail', async () => {
    const m = await load();
    const rows = status(m, { others: [other] });
    assert.deepEqual(blocksOf(rows), ['task', 'clash', 'session', 'notes', 'foot']);
    for (const row of rows.filter((r) => r.segs.length)) {
        const want = row.block === 'task' ? { text: '▌' } : { text: '▌', color: RAIL[row.block] };
        assert.deepEqual(row.segs[0], want, line(row));
    }
    assert.deepEqual(m.RAILS, Object.assign({ gate: '#d7af5f' }, RAIL));
});

test('one blank row sits above every block but the first, and belongs to the block under it', async () => {
    const m = await load();
    const rows = status(m, { others: [other] });
    assert.ok(rows[0].segs.length && rows[rows.length - 1].segs.length);
    const blanks = rows.map((r, i) => (r.segs.length ? -1 : i)).filter((i) => i >= 0);
    assert.equal(blanks.length, 4);
    for (const i of blanks) {
        assert.equal(rows[i].block, rows[i + 1].block);
        assert.notEqual(rows[i].block, rows[i - 1].block);
    }
});

test('the task block is the title whole and bold, then next: whole, with no route and no minutes', async () => {
    const m = await load();
    assert.deepEqual(body(status(m), 'task'), [
        [{ text: 'fankeel 面板 mod：把任務／階段狀態做成隨', bold: true }],
        [{ text: 'plugin 出貨的 Claude Code mod Pane', bold: true }],
        [{ text: 'next:', color: SECOND }, { text: ' 畫 mockup，等使用者看過再進 plan' }],
    ]);
    assert.deepEqual(text(status(m, { cols: 31 }), 'task'), [
        '▌fankeel 面板 mod：把任務／階段',
        '▌狀態做成隨 plugin 出貨的',
        '▌Claude Code mod Pane',
        '▌next: 畫 mockup，等使用者看過',
        '▌再進 plan',
    ]);
    const seen = text(status(m), 'task').join('\n');
    assert.doesNotMatch(seen, /▸|survey|\[design\]|本站|上站|等你/);
    // Sixty CJK characters and no space: four full rows of thirty cells, nothing cut.
    const long = '把一個很長的任務標題折成好幾行而不是截斷'.repeat(3);
    const rows = text(status(m, { entry: Object.assign({}, entry, { task: long, next: '' }), cols: 31 }), 'task');
    assert.equal(rows.length, 4);
    assert.equal(rows.map((row) => row.slice(1)).join(''), long);
    assert.ok(rows.every((row) => m.width(row) === 31), rows.join(' | '));
    assert.deepEqual(text(status(m, { entry: Object.assign({}, entry, { task: '' }) }), 'task')[0], '▌—');
});

test('the clash block is each file a neighbour holds too, then that neighbour\'s task, stage and how long since it moved', async () => {
    const m = await load();
    const clash = (others, cols) => status(m, { others, cols: cols || 41 });
    assert.deepEqual(drawn(clash([other]), 'clash'), [
        { block: 'clash', segs: [{ text: '▌', color: '#ff5f5f' }, { text: '⚑ hooks/mod.ts', color: '#ff5f5f', bold: true }] },
        { block: 'clash', segs: [{ text: '▌', color: '#ff5f5f' }, { text: '  站頁看得到對話全文' }, { text: ' @ build · 2h', color: SECOND }], who: other.id },
    ]);
    const second = { id: 'cccccccc-0000-4000-8000-000000000003', entry: { task: 'y', stage: 'plan', active: true, claims: ['tests/pane.test.js', 'hooks/mod.ts', 'lib/y.js'], updated: new Date(NOW - 12 * 60000).toISOString() } };
    assert.deepEqual(text(clash([other, second]), 'clash'), [
        '▌⚑ hooks/mod.ts', '▌  站頁看得到對話全文 @ build · 2h', '▌  y @ plan · 12m',
        '▌⚑ tests/pane.test.js', '▌  y @ plan · 12m',
    ]);
    const who = (others) => [...new Set(drawn(clash(others), 'clash').filter((r) => r.who).map((r) => r.who))];
    assert.deepEqual(who([other, second, apart]), [other.id, second.id]);
    assert.deepEqual(text(clash([apart]), 'clash'), []);
    assert.deepEqual(text(clash([]), 'clash'), []);
    const aged = (updated) => line(drawn(clash([{ id: other.id, entry: Object.assign({}, other.entry, { updated }) }]), 'clash')[1]);
    assert.equal(aged(new Date(NOW - 59 * 60000).toISOString()), '▌  站頁看得到對話全文 @ build · 59m');
    assert.equal(aged(new Date(NOW - 60 * 60000).toISOString()), '▌  站頁看得到對話全文 @ build · 1h');
    assert.equal(aged(new Date(NOW + HOUR).toISOString()), '▌  站頁看得到對話全文 @ build · 0m');
    assert.equal(aged('soon'),'▌  站頁看得到對話全文 @ build');
    assert.equal(aged(undefined), '▌  站頁看得到對話全文 @ build');
    const deep = { id: 'dddddddd-0000-4000-8000-000000000004', entry: { task: '一個很長很長的任務標題，'.repeat(4), stage: 'build', active: true, scope: [entry.claims[3]], updated: other.entry.updated } };
    const [file, holder] = text(clash([deep], 31), 'clash');
    assert.ok(file.startsWith('▌⚑ …') && file.endsWith('file.md') && m.width(file) <= 31, file);
    assert.ok(holder.endsWith('… @ build · 2h') && m.width(holder) <= 31, holder);
});

test('the session block says in words what the guard does and how many files the task has claimed', async () => {
    const m = await load();
    const session = (over) => status(m, { entry: Object.assign({}, entry, over) });
    assert.deepEqual(body(session({}), 'session'), [
        [{ text: '這個 session', color: '#5fafaf', bold: true }],
        [{ text: '別的 session 也在改同一個檔時', color: SECOND }],
        [{ text: '  直接擋下，不能改' }, { text: '  guard deny', color: SECOND }],
        [{ text: '這個任務改過的檔', color: SECOND }],
        [{ text: '  4 個' }, { text: '  claims', color: SECOND }],
    ]);
    assert.equal(text(session({ guard: 'ask' }), 'session')[2], '▌  先問你  guard ask');
    assert.equal(text(session({ guard: 'off' }), 'session')[2], '▌  只提醒  guard off');
    assert.equal(text(session({ guard: undefined }), 'session')[2], '▌  先問你  guard ask');
    assert.equal(text(session({ guard: 'constructor' }), 'session')[2], '▌  先問你  guard ask');
    assert.equal(text(session({ claims: undefined, scope: ['a.js'] }), 'session')[4], '▌  1 個  claims');
    assert.equal(text(session({ claims: [] }), 'session')[4], '▌  0 個  claims');
});

test('notes are the newest three, each under the notes heading', async () => {
    const m = await load();
    const many = Object.assign({}, entry, { notes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    assert.deepEqual(text(status(m, { entry: many }), 'notes'), ['▌notes', '▌· e', '▌· f', '▌· g']);
    assert.deepEqual(body(status(m), 'notes'), [
        [{ text: 'notes', color: '#87afd7', bold: true }],
        [{ text: '· Pane 由 /fankeel-panel 開' }],
        [{ text: '· gate 區塊沿用 2026-10-09 核准的設計' }],
    ]);
    assert.deepEqual(text(status(m, { entry: Object.assign({}, entry, { notes: [] }) }), 'notes'), []);
});

test('foot is the session and how to close the pane; a probe is drawn above it, whole, and is never dropped', async () => {
    const m = await load();
    assert.deepEqual(body(status(m), 'foot'), [[{ text: 'f0a58f35 · /fankeel-panel 關閉', color: SECOND }]]);
    const probe = 'surfaces [terminal, desktop] · surface terminal';
    assert.deepEqual(body(status(m, { cols: 61, probe }), 'foot'), [
        [{ text: probe, color: SECOND }],
        [{ text: 'f0a58f35 · /fankeel-panel 關閉', color: SECOND }],
    ]);
    assert.equal(status(m, { cols: 61, probe }).length, status(m, { cols: 61 }).length + 1, 'the probe is its own block, or more than a row');
    assert.deepEqual(text(status(m, { cols: 31, probe }), 'foot'), ['▌surfaces [terminal, desktop] ·', '▌surface terminal', '▌f0a58f35 · /fankeel-panel 關閉']);
    assert.deepEqual(text(status(m, { cols: 61, room: -9, probe }), 'foot'), ['▌' + probe, '▌f0a58f35 · /fankeel-panel 關閉']);
    for (const none of [undefined, null, '']) assert.deepEqual(text(status(m, { probe: none }), 'foot'), ['▌f0a58f35 · /fankeel-panel 關閉']);
});

test('no entry draws only the empty block, with no rail', async () => {
    const m = await load();
    const rows = status(m, { entry: null, others: [other], probe: 'surfaces [terminal]' });
    assert.deepEqual(rows, [
        { block: 'empty', segs: [{ text: '這個 session 沒有進行中的任務' }] },
        { block: 'empty', segs: [{ text: '/fankeel 開一個', color: SECOND }] },
    ]);
});

test('with no room the session block goes first, then notes; task, clash and foot never do', async () => {
    const m = await load();
    const rows = (room) => status(m, { others: [other], room });
    assert.equal(rows(60).length, 18);
    assert.deepEqual(blocksOf(rows(18)), ['task', 'clash', 'session', 'notes', 'foot']);
    assert.deepEqual(blocksOf(rows(17)), ['task', 'clash', 'notes', 'foot']);
    assert.deepEqual(blocksOf(rows(12)), ['task', 'clash', 'notes', 'foot']);
    assert.deepEqual(blocksOf(rows(11)), ['task', 'clash', 'foot']);
    assert.deepEqual(blocksOf(rows(-9)), ['task', 'clash', 'foot']);
    assert.equal(rows(-9).length, 8);
    for (const room of [18, 17, 12, 11, 8]) assert.ok(rows(room).length <= room, room + ' < ' + rows(room).length);
});

test('no row is wider than the pane, and CJK counts two', async () => {
    const m = await load();
    assert.equal(m.width('ab面板'), 6);
    const long = { id: other.id, entry: Object.assign({}, other.entry, { task: '另一個很長的任務標題，'.repeat(6), claims: entry.claims }) };
    for (const cols of [20, 30, 41, 88]) {
        for (const row of status(m, { others: [long], cols, probe: 'surfaces [terminal, desktop] · surface terminal' })) {
            assert.ok(m.width(line(row)) <= cols, cols + ' < ' + m.width(line(row)) + ': ' + line(row));
        }
    }
});

test('what the context block says survives is what the compact instructions keep', async () => {
    const { KEPT } = await load();
    const { instructionsFor } = await compact();
    assert.deepEqual(KEPT, ['task', 'stage', 'plan', 'agent', 'handoff']);
    const kept = instructionsFor(ID, { task: 'demo', stage: 'build', class: 'bounded' }, 'F:/plugin');
    // 'task' is also in the opening sentence, so the line itself is what is looked for.
    for (const word of KEPT) assert.ok(kept.includes(word === 'task' ? '- task:' : word), word + ' is not in the compact instructions');
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
