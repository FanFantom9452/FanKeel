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

// A plan of `n` tasks named `task 1` on, `done` complete, `users` the user's own.
const planOf = (n, done, users) => ({ name: '2026-10-12-pane-band', done, tasks: Array.from({ length: n }, (_, i) => ({ n: i + 1, name: 'task ' + (i + 1), user: (users || []).includes(i + 1) })) });
// The same entry with a subagent out on its stage.
const busy = Object.assign({}, entry, { inflight: { stage: 'design', at: NOW - 12 * 60000 - 30000, group: 2 } });

test('planTasks reads the headings lib/plantasks.js parseTasks reads, and which of them are the user\'s', async () => {
    const { planTasks, planTotal } = await load();
    const fence = '`'.repeat(3);
    const text = ['# Plan', '', '## Task 1: one', '', '**Dispatch:** implementer, sonnet — the code is in the plan.', '', 'text', '**Dispatch:** user — a later line is prose',
        fence + 'md', '## Task 9: an example inside a fence', '**Dispatch:** user', fence,
        '##  Task 2:  two', '', '**Dispatch:** User — run it by hand', '### Task 3: a sub-heading', '   ## Task 4: indented', 'no dispatch line here',
        '## Coverage', '**Dispatch:** user', ''].join('\n');
    const theirs = plantasks.parseTasks(text);
    assert.deepEqual(planTasks(text).map((t) => [t.n, t.name, t.user]), theirs.map((t) => [t.n, t.name, t.dispatch === 'user']));
    assert.deepEqual(planTasks(text), [{ n: 1, name: 'one', user: false }, { n: 2, name: 'two', user: true }, { n: 4, name: 'indented', user: false }]);
    assert.deepEqual(planTasks(text.replace(/\n/g, '\r\n')), planTasks(text));
    assert.equal(planTotal(text), 3);
    assert.deepEqual(planTasks(''), []);
});

test('ledgerDoneIds names the tasks lib/ledger.js completed() names, ascending, for the plan the ledger is of', async () => {
    const { ledgerDoneIds, ledgerDone } = await load();
    const claim = 'docs/90-agent/plans/2026-10-12-pane-band.md';
    const text = [ledger.header(claim), ledger.completionLine(2, 'b'), ledger.completionLine(1, 'a'), '  ' + ledger.completionLine(4, 'd'),
        ledger.completionLine(2, 'b, again'), 'Task 7: completed later'].join('\n') + '\n';
    assert.deepEqual(ledgerDoneIds(text, claim), [1, 2, 4]);
    assert.deepEqual(ledgerDoneIds(text, claim), [...new Set(ledger.completed(text).map(Number))].sort((a, b) => a - b));
    assert.deepEqual(ledgerDoneIds(text.replace(/\n/g, '\r\n'), claim), [1, 2, 4]);
    assert.equal(ledgerDoneIds(text, 'docs/90-agent/plans/other.md'), null);
    assert.equal(ledgerDoneIds('', claim), null);
    assert.equal(ledgerDone(text, claim), 3);
});

test('six tasks or fewer are listed whole: done, open, and the user\'s own', async () => {
    const m = await load();
    const rows = status(m, { plan: planOf(5, [1, 2], [4]) });
    assert.deepEqual(body(rows, 'tasks'), [
        [{ text: 'tasks', color: '#87af5f', bold: true }, { text: ' 2 of 5' }],
        [{ text: '●', color: '#87af5f' }, { text: ' 1 task 1', color: SECOND }],
        [{ text: '●', color: '#87af5f' }, { text: ' 2 task 2', color: SECOND }],
        [{ text: '○', color: '#767676' }, { text: ' 3 task 3' }],
        [{ text: '◐', color: '#d7af5f' }, { text: ' 4 task 4' }, { text: ' · 你的', color: SECOND }],
        [{ text: '○', color: '#767676' }, { text: ' 5 task 5' }],
    ]);
    assert.equal(drawn(status(m, { plan: planOf(6, []) }), 'tasks').length, 7);
    assert.deepEqual(text(status(m, { plan: planOf(3, [1, 9]) }), 'tasks')[0], '▌tasks 1 of 3');
    assert.deepEqual(blocksOf(status(m, { others: [other], plan: planOf(5, []) })), ['task', 'clash', 'tasks', 'session', 'notes', 'foot']);
    assert.deepEqual(text(status(m, { plan: null }), 'tasks'), []);
});

test('an agent out on this stage is marked on the first open task that is not the user\'s, amber from twenty minutes', async () => {
    const m = await load();
    const out = (inflight, plan) => body(status(m, { entry: Object.assign({}, entry, { inflight }), plan: plan || planOf(5, [1, 2]) }), 'tasks');
    assert.deepEqual(out(busy.inflight)[3], [{ text: '◉', color: '#af87d7' }, { text: ' 3 task 3', bold: true }, { text: ' · 出去 12 分', color: '#af87d7' }]);
    assert.deepEqual(out(busy.inflight)[4], [{ text: '○', color: '#767676' }, { text: ' 4 task 4' }]);
    assert.deepEqual(out({ stage: 'design', at: NOW - 20 * 60000 + 1000 })[3][2], { text: ' · 出去 19 分', color: '#af87d7' });
    assert.deepEqual(out({ stage: 'design', at: NOW - 20 * 60000 })[3][2], { text: ' · 出去 20 分', color: '#d7af5f' });
    assert.deepEqual(out({ stage: 'design' })[3][2], { text: ' · 出去 ? 分', color: '#af87d7' });
    assert.deepEqual(out({ stage: 'survey', at: NOW - 60000 })[3], [{ text: '○', color: '#767676' }, { text: ' 3 task 3' }]);
    assert.deepEqual(out([{ stage: 'survey', at: NOW - 60000 }, { stage: 'design', at: NOW - 3 * 60000 }])[3][2], { text: ' · 出去 3 分', color: '#af87d7' });
    // Task 3 is the user's: the agent is out on the one after it.
    const mixed = out(busy.inflight, planOf(5, [1, 2], [3]));
    assert.deepEqual(mixed[3], [{ text: '◐', color: '#d7af5f' }, { text: ' 3 task 3' }, { text: ' · 你的', color: SECOND }]);
    assert.equal(mixed[4][0].text, '◉');
});

test('more than six tasks fold to the count done, the first open task and the two after it, and how many are left', async () => {
    const m = await load();
    assert.deepEqual(text(status(m, { entry: busy, plan: planOf(13, [1, 2, 3, 4], [13]) }), 'tasks'), [
        '▌tasks 4 of 13',
        '▌✓ 完成 4',
        '▌◉  5 task 5 · 出去 12 分',
        '▌○  6 task 6',
        '▌○  7 task 7',
        '▌○ 還有 6 個，1 個是你的',
    ]);
    assert.deepEqual(body(status(m, { plan: planOf(13, [1, 2, 3, 4]) }), 'tasks').filter((segs) => /完成|還有/.test(segs[1].text)), [
        [{ text: '✓', color: '#87af5f' }, { text: ' 完成 4', color: SECOND }],
        [{ text: '○', color: '#767676' }, { text: ' 還有 6 個', color: SECOND }],
    ]);
    assert.deepEqual(text(status(m, { plan: planOf(7, []) }), 'tasks'), ['▌tasks 0 of 7', '▌○ 1 task 1', '▌○ 2 task 2', '▌○ 3 task 3', '▌○ 還有 4 個']);
    // Complete out of order: the window is still the first three that are open.
    assert.deepEqual(text(status(m, { plan: planOf(8, [1, 3, 8]) }), 'tasks'), ['▌tasks 3 of 8', '▌✓ 完成 3', '▌○ 2 task 2', '▌○ 4 task 4', '▌○ 5 task 5', '▌○ 還有 2 個']);
    assert.deepEqual(text(status(m, { plan: planOf(9, [1, 2, 3, 4, 5, 6, 7, 8]) }), 'tasks'), ['▌tasks 8 of 9', '▌✓ 完成 8', '▌○ 9 task 9']);
    assert.deepEqual(text(status(m, { plan: planOf(7, [1, 2, 3, 4, 5, 6, 7]) }), 'tasks'), ['▌tasks 7 of 7', '▌✓ 完成 7']);
    // Three open is the window exactly; four open leaves one.
    assert.deepEqual(text(status(m, { plan: planOf(7, [1, 2, 3, 4]) }), 'tasks').slice(2), ['▌○ 5 task 5', '▌○ 6 task 6', '▌○ 7 task 7']);
    assert.deepEqual(text(status(m, { plan: planOf(8, [1, 2, 3, 4]) }), 'tasks').slice(-1), ['▌○ 還有 1 個']);
    assert.equal(drawn(status(m, { plan: planOf(7, [1]) }), 'tasks').length, 6);
});

test('thirty tasks never take more than seven rows, however many are done', async () => {
    const m = await load();
    for (let done = 0; done <= 30; done++) {
        const rows = drawn(status(m, { entry: busy, plan: planOf(30, Array.from({ length: done }, (_, i) => i + 1), [29, 30]) }), 'tasks');
        assert.ok(rows.length <= 7, done + ' done: ' + rows.length + ' rows');
        assert.equal(line(rows[0]), '▌tasks ' + done + ' of 30');
    }
});

test('with no ledger an agent out on this stage is one row with its group; with neither there is no tasks block', async () => {
    const m = await load();
    const out = (inflight, plan) => body(status(m, { entry: Object.assign({}, entry, { inflight }), plan: plan || null }), 'tasks');
    assert.deepEqual(out(busy.inflight), [[{ text: 'agent 出去 12 分 · 第 2 組' }]]);
    assert.deepEqual(out({ stage: 'design', at: NOW - 95 * 60000, group: 3 }), [[{ text: 'agent 出去 95 分 · 第 3 組', color: '#d7af5f' }]]);
    assert.deepEqual(out({ stage: 'design' }), [[{ text: 'agent 出去 ? 分' }]]);
    assert.deepEqual(out({ stage: 'design', at: 'soon', group: 2 }), [[{ text: 'agent 出去 ? 分 · 第 2 組' }]]);
    assert.deepEqual(out(busy.inflight, planOf(0, [])), [[{ text: 'agent 出去 12 分 · 第 2 組' }]]);
    assert.deepEqual(out({ stage: 'survey', at: NOW - 60000 }), []);
    assert.deepEqual(out(undefined), []);
});

test('a long task name is cut so its row, tail and all, stays inside the pane', async () => {
    const m = await load();
    const long = planOf(5, [1], [4]);
    for (const t of long.tasks) t.name = '把一個很長的任務名稱寫在這裡 ' + t.n;
    for (const cols of [31, 41]) {
        const rows = drawn(status(m, { entry: busy, plan: long, cols }), 'tasks');
        for (const row of rows) assert.ok(m.width(line(row)) <= cols, cols + ' < ' + m.width(line(row)) + ': ' + line(row));
        assert.ok(line(rows[2]).endsWith('… · 出去 12 分'), line(rows[2]));
        assert.ok(line(rows[4]).endsWith('… · 你的'), line(rows[4]));
    }
});

const context = { tokens: 212000, at: 450000 };
const five = { kind: 'five_hour', percentUsed: 66, resetsAt: new Date(NOW + 106 * 60000).toISOString() };
const week = { kind: 'seven_day', percentUsed: 58, resetsAt: new Date(NOW + 60.5 * HOUR).toISOString() };

test('context is the count and what is left, then a bar to the compact threshold', async () => {
    const m = await load();
    assert.deepEqual(body(status(m, { context }), 'context'), [
        [{ text: 'context', color: '#d787af', bold: true }, { text: '  212k', color: '#ffd700' }, { text: ' · 還 ', color: SECOND }, { text: '238k' }, { text: ' 可用', color: SECOND }],
        [{ text: '████████▍', color: '#ffd700' }, { text: '░░░░░░░░░', color: '#585858' }, { text: ' 到 450k 自動 compact', color: SECOND }],
    ]);
    assert.deepEqual(text(status(m, { context }), 'context'), ['▌context  212k · 還 238k 可用', '▌████████▍░░░░░░░░░ 到 450k 自動 compact']);
    assert.deepEqual(text(status(m, { context: { tokens: 9000, at: 123456 } }), 'context'), ['▌context  9k · 還 114k 可用', '▌█▎░░░░░░░░░░░░░░░░ 到 123k 自動 compact']);
    assert.deepEqual(text(status(m, { context: null }), 'context'), []);
    assert.deepEqual(blocksOf(status(m, { others: [other], context, plan: planOf(5, []) })), ['task', 'clash', 'tasks', 'context', 'session', 'notes', 'foot']);
});

test('the context bar is ten to eighteen cells, as many as the pane leaves beside its label', async () => {
    const m = await load();
    const cells = (cols) => [...body(status(m, { context, cols }), 'context')[1].slice(0, 2).map((seg) => seg.text).join('')].length;
    assert.equal(cells(41), 18);
    assert.equal(cells(88), 18);
    assert.equal(cells(36), 14);
    assert.equal(cells(32), 10);
    assert.equal(cells(24), 10);
});

test('from four fifths of the threshold the count is marked and the block says what a compact keeps; at the threshold it says so', async () => {
    const m = await load();
    const at = (tokens, limit) => status(m, { context: { tokens, at: limit || 450000 } });
    assert.equal(drawn(at(359999), 'context').length, 2);
    assert.deepEqual(text(at(360000), 'context'), ['▌context  360k ⚠ · 還 90k 可用', '▌██████████████▍░░░ 到 450k 自動 compact', '▌留 task · stage · plan · agent · handoff']);
    assert.deepEqual(body(at(360000), 'context')[0].slice(1, 3), [{ text: '  360k', color: '#ff00ff', bold: true }, { text: ' ⚠', color: '#ff00ff', bold: true }]);
    assert.deepEqual(body(at(360000), 'context')[2], [{ text: '留 task · stage · plan · agent · handoff', color: SECOND }]);
    assert.deepEqual(text(at(79999, 100000), 'context').length, 2);
    assert.deepEqual(text(at(80000, 100000), 'context').length, 3);
    assert.deepEqual(text(at(450000), 'context'), ['▌context  450k ⚠ · 還 0k 可用', '▌██████████████████ 已到 450k，compact 中', '▌留 task · stage · plan · agent · handoff']);
    assert.deepEqual(body(at(450000), 'context')[1], [{ text: '█'.repeat(18), color: '#ff00ff', bold: true }, { text: ' 已到 450k，compact 中', color: '#d7af5f', bold: true }]);
    assert.equal(text(at(463000), 'context')[0], '▌context  463k ⚠ · 還 0k 可用');
    // One token short of the threshold: the bar is full to its last eighth, and the label has not changed yet.
    assert.deepEqual(body(at(449999), 'context')[1], [{ text: '█'.repeat(17) + '▉', color: '#ff00ff', bold: true }, { text: ' 到 450k 自動 compact', color: SECOND }]);
});

test('quota is a row a window — bar, percent used, what is left, the reset — and the 7d deviation in a sentence', async () => {
    const m = await load();
    const rows = status(m, { limits: [five, week] });
    assert.deepEqual(text(rows, 'quota'), [
        '▌用量額度',
        '▌5h ██████▌░░░  66%  剩 34%  ↻ 1h 46m',
        '▌7d █████▊░░░░  58%  剩 42%  ↻ 2d 12h 30m',
        '▌   -6%  落後平均進度 6 點',
    ]);
    assert.deepEqual(body(rows, 'quota'), [
        [{ text: '用量額度', color: '#8787d7', bold: true }],
        [{ text: '5h ', color: SECOND }, { text: '██████▌', color: '#ffd700' }, { text: '░░░', color: '#585858' }, { text: '  66%', color: '#ffd700' },
            { text: '  剩', color: SECOND }, { text: ' 34%' }, { text: '  ↻ 1h 46m', color: SECOND }],
        [{ text: '7d ', color: SECOND }, { text: '█████▊', color: '#87ff87' }, { text: '░░░░', color: '#585858' }, { text: '  58%', color: '#87ff87' },
            { text: '  剩', color: SECOND }, { text: ' 42%' }, { text: '  ↻ 2d 12h 30m', color: SECOND }],
        [{ text: '   ' }, { text: '-6%', color: '#87ff87' }, { text: '  落後平均進度', color: SECOND }, { text: ' 6 ' }, { text: '點', color: SECOND }],
    ]);
    assert.equal(m.width(text(rows, 'quota')[2]), 41);
    const full = { kind: 'five_hour', percentUsed: 96, resetsAt: new Date(NOW + 12 * 60000).toISOString() };
    assert.deepEqual(text(status(m, { limits: [full, Object.assign({}, week, { percentUsed: 79 })] }), 'quota'), [
        '▌用量額度',
        '▌5h █████████▌  96% ⚠  剩  4%  ↻ 0h 12m',
        '▌7d ███████▉░░  79%  剩 21%  ↻ 2d 12h 30m',
        '▌   +15% 💀  超前平均進度 15 點',
    ]);
    const even = { kind: 'seven_day', percentUsed: 50, resetsAt: new Date(NOW + 84 * HOUR).toISOString() };
    assert.equal(text(status(m, { limits: [even] }), 'quota')[2], '▌   0%  落後平均進度 0 點');
    const over = text(status(m, { limits: [Object.assign({}, five, { percentUsed: 120 })] }), 'quota')[1];
    assert.ok(over.includes('120%') && over.includes('剩  0%'), over);
    assert.equal(text(status(m, { limits: [Object.assign({}, five, { percentUsed: -5 })] }), 'quota')[1], '▌5h ░░░░░░░░░░  -5%  剩100%  ↻ 1h 46m');
    assert.deepEqual(blocksOf(status(m, { context, limits: [five, week] })), ['task', 'context', 'quota', 'session', 'notes', 'foot']);
});

test('quota draws only the windows the engine gave, and a 7d with no reset has no countdown and no deviation', async () => {
    const m = await load();
    assert.deepEqual(text(status(m, { limits: [] }), 'quota'), []);
    assert.deepEqual(text(status(m, { limits: [{ kind: 'opus_week', percentUsed: 5 }] }), 'quota'), []);
    assert.deepEqual(text(status(m, { limits: [five] }), 'quota'), ['▌用量額度', '▌5h ██████▌░░░  66%  剩 34%  ↻ 1h 46m']);
    const bare = status(m, { limits: [{ kind: 'seven_day', percentUsed: 58 }] });
    assert.deepEqual(text(bare, 'quota'), ['▌用量額度', '▌7d █████▊░░░░  58%  剩 42%']);
    assert.equal(body(bare, 'quota')[1][1].color, '#d7ff00');
});

test('a quota row that does not fit drops its countdown, then what is left', async () => {
    const m = await load();
    const rows = (cols) => text(status(m, { limits: [five, week], cols }), 'quota');
    assert.deepEqual(rows(40).slice(1, 3), ['▌5h ██████▌░░░  66%  剩 34%  ↻ 1h 46m', '▌7d █████▊░░░░  58%  剩 42%']);
    assert.deepEqual(rows(36).slice(1, 3), ['▌5h ██████▌░░░  66%  剩 34%', '▌7d █████▊░░░░  58%  剩 42%']);
    assert.deepEqual(rows(26).slice(1, 3), ['▌5h ██████▌░░░  66%', '▌7d █████▊░░░░  58%']);
});

test('with no room the blocks go in the order session, notes, quota, the tasks window, context — and a context at four fifths stays', async () => {
    const m = await load();
    const rows = (room, ctx) => status(m, { others: [other], plan: planOf(5, [1, 2]), context: ctx || context, limits: [five, week], room });
    const all = ['task', 'clash', 'tasks', 'context', 'quota', 'session', 'notes', 'foot'];
    assert.equal(rows(60).length, 33);
    assert.deepEqual(blocksOf(rows(33)), all);
    assert.deepEqual(blocksOf(rows(32)), ['task', 'clash', 'tasks', 'context', 'quota', 'notes', 'foot']);
    assert.deepEqual(blocksOf(rows(27)), ['task', 'clash', 'tasks', 'context', 'quota', 'notes', 'foot']);
    assert.deepEqual(blocksOf(rows(26)), ['task', 'clash', 'tasks', 'context', 'quota', 'foot']);
    assert.deepEqual(blocksOf(rows(22)), ['task', 'clash', 'tasks', 'context', 'foot']);
    assert.equal(drawn(rows(18), 'tasks').length, 6);
    assert.deepEqual(text(rows(17), 'tasks'), ['▌tasks 2 of 5']);
    assert.deepEqual(blocksOf(rows(13)), ['task', 'clash', 'tasks', 'context', 'foot']);
    assert.deepEqual(blocksOf(rows(12)), ['task', 'clash', 'tasks', 'foot']);
    assert.deepEqual(blocksOf(rows(-9)), ['task', 'clash', 'tasks', 'foot']);
    assert.equal(rows(-9).length, 10);
    for (const room of [33, 32, 27, 26, 22, 18, 17, 13, 12, 10]) assert.ok(rows(room).length <= room, room + ' < ' + rows(room).length);
    const hot = { tokens: 432000, at: 450000 };
    assert.deepEqual(blocksOf(rows(-9, hot)), ['task', 'clash', 'tasks', 'context', 'foot']);
    assert.equal(drawn(rows(-9, hot), 'context').length, 3);
    // Just under four fifths the context is given up like any other block.
    assert.deepEqual(blocksOf(rows(-9, { tokens: 359999, at: 450000 })), ['task', 'clash', 'tasks', 'foot']);
});

test('a block the entry lacks is skipped, not removed in its place: with no notes, tasks or clash in a room too small, the task and the foot stay', async () => {
    const m = await load();
    const bare = Object.assign({}, entry, { notes: [], claims: [] });
    assert.deepEqual(blocksOf(status(m, { entry: bare, room: -9 })), ['task', 'foot']);
    assert.deepEqual(blocksOf(status(m, { entry: bare, context, room: -9 })), ['task', 'foot']);
    assert.ok(text(status(m, { entry: bare, room: -9 }), 'foot').length > 0);
});

test('no row of the whole Pane is wider than it, at any width', async () => {
    const m = await load();
    const long = { id: other.id, entry: Object.assign({}, other.entry, { task: '另一個很長的任務標題，'.repeat(6), claims: entry.claims }) };
    const heavy = [{ kind: 'five_hour', percentUsed: 96, resetsAt: five.resetsAt }, Object.assign({}, week, { percentUsed: 79 })];
    for (const cols of [20, 30, 41, 88]) {
        for (const ctx of [context, { tokens: 463000, at: 450000 }]) {
            for (const row of status(m, { entry: busy, others: [long], plan: planOf(13, [1, 2], [13]), context: ctx, limits: heavy, cols })) {
                assert.ok(m.width(line(row)) <= cols, cols + ' < ' + m.width(line(row)) + ': ' + line(row));
            }
        }
    }
});
