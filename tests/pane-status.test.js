'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-status.ts')).href);
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
    notes: ['Pane 由 /fankeel-pane 開', 'gate 區塊沿用 2026-10-09 核准的設計'],
    claims: ['hooks/mod.ts', 'hooks/pane.ts', 'tests/pane.test.js', 'docs/a/very/long/path/that/goes/on/and/on/file.md'],
    clock: { survey: [1000, 661000], design: [661000, null] },
    waited: { survey: 600000 },
};
const other = { id: 'aaaaaaaa-0000-4000-8000-000000000001', entry: { task: '站頁看得到對話全文', stage: 'build', active: true, claims: ['hooks/mod.ts'], updated: '2026-10-10T22:00:00.000Z' } };
const text = (rows, block) => rows.filter((r) => r.block === block).map((r) => r.text);

test('statusRows reads the task, the stage and its place on the route', async () => {
    const { statusRows } = await load();
    const rows = statusRows(ID, entry, [], 44, 44, NOW);
    assert.match(text(rows, 'head').join(''), /fankeel 面板 mod/);
    assert.ok(text(rows, 'head').includes('architectural'));
    assert.ok(text(rows, 'route').some((t) => t.includes('2 of 7')));
    assert.ok(text(rows, 'route').some((t) => t.includes('[design]')));
});

test('the dots and N of M come from the same route', async () => {
    const { statusRows } = await load();
    for (const stage of entry.route) {
        const rows = statusRows(ID, Object.assign({}, entry, { stage }), [], 44, 44, NOW);
        const line = text(rows, 'route').find((t) => t.includes(' of '));
        const [, n, m] = line.match(/(\d+) of (\d+)/);
        assert.equal((line.match(/●/g) || []).length, Number(n));
        assert.equal((line.match(/[●○]/g) || []).length, Number(m));
        assert.equal(Number(n), entry.route.indexOf(stage) + 1);
        assert.equal(Number(m), entry.route.length);
    }
});

test('no row is wider than the pane, and CJK counts two', async () => {
    const { statusRows, width } = await load();
    assert.equal(width('ab面板'), 6);
    for (const cols of [30, 44, 88]) {
        for (const r of statusRows(ID, entry, [other], cols, 60, NOW)) {
            assert.ok(width(r.text) <= cols, cols + ' < ' + width(r.text) + ': ' + r.text);
        }
    }
});

test('rows never exceed the room, and head, route and foot survive', async () => {
    const { statusRows } = await load();
    for (const room of [18, 44, 8]) {
        const rows = statusRows(ID, entry, [other], 44, room, NOW);
        assert.ok(rows.length <= room, room + ' < ' + rows.length);
        for (const block of ['head', 'route', 'foot']) assert.ok(text(rows, block).length, block + ' dropped at ' + room);
    }
    const tight = statusRows(ID, entry, [other], 44, 8, NOW).map((r) => r.block);
    assert.ok(!tight.includes('cost') && !tight.includes('touched'));
});

test('cost shows minutes and the wait, touched keeps the tail of a long path', async () => {
    const { statusRows } = await load();
    const rows = statusRows(ID, entry, [], 44, 60, NOW);
    assert.deepEqual(text(rows, 'cost'), ['survey 11m（gate 等 10m）']);
    assert.ok(text(rows, 'touched')[0].startsWith('touched 4'));
    assert.ok(text(rows, 'touched').some((t) => t.startsWith('…') && t.endsWith('file.md')));
    assert.equal(text(rows, 'touched').length, 4);
});

test('a neighbour carries its age, and a shared file is a warning row', async () => {
    const { statusRows } = await load();
    const rows = statusRows(ID, entry, [other], 44, 60, NOW);
    assert.ok(text(rows, 'neighbours').some((t) => t.includes('@ build') && t.includes('2h')));
    const clash = rows.find((r) => r.block === 'neighbours' && r.warn);
    assert.ok(clash && clash.text.includes('hooks/mod.ts'));
});

test('no entry draws only the empty block', async () => {
    const { statusRows } = await load();
    const rows = statusRows(ID, null, [other], 44, 44, NOW);
    assert.deepEqual([...new Set(rows.map((r) => r.block))], ['empty']);
    assert.ok(rows.some((r) => r.text.includes('/fankeel')));
});

test('foot names the session and the guard, ask when none is set', async () => {
    const { statusRows } = await load();
    assert.ok(text(statusRows(ID, entry, [], 44, 44, NOW), 'foot')[0].includes('f0a58f35 · guard deny'));
    const bare = Object.assign({}, entry, { guard: undefined });
    assert.ok(text(statusRows(ID, bare, [], 44, 44, NOW), 'foot')[0].includes('guard ask'));
});
