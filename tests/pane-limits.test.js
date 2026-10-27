'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-limits.ts')).href);
const NOW = Date.parse('2026-10-27T01:00:00.000Z');
const L = (five, seven) => [
    { kind: 'five_hour', percentUsed: five, resetsAt: '2026-10-27T05:00:00.000Z' },
    { kind: 'seven_day', percentUsed: seven, resetsAt: '2026-10-31T00:00:00.000Z' },
];
const E = { task: 'TODO 全表盤點', stage: 'build' };

test('a first reading is a row carrying both windows, the task and the stage', async () => {
    const { limitRow } = await load();
    const r = limitRow(L(12, 40), E, NOW, '');
    assert.deepEqual(r.row, { at: '2026-10-27T01:00:00.000Z', task: 'TODO 全表盤點', stage: 'build', five: 12, fiveResets: '2026-10-27T05:00:00.000Z', seven: 40, sevenResets: '2026-10-31T00:00:00.000Z' });
});

test('the same percentages and stage again are no row; a moved percentage or stage is', async () => {
    const { limitRow } = await load();
    const first = limitRow(L(12, 40), E, NOW, '');
    assert.equal(limitRow(L(12, 40), E, NOW + 60000, first.key), null);
    assert.ok(limitRow(L(13, 40), E, NOW + 60000, first.key));
    assert.ok(limitRow(L(12, 40), { task: E.task, stage: 'verify' }, NOW + 60000, first.key));
});

test('no five_hour and no seven_day reading is no row', async () => {
    const { limitRow } = await load();
    assert.equal(limitRow([], E, NOW, ''), null);
    assert.equal(limitRow([{ kind: 'seven_day_opus', percentUsed: 5 }], E, NOW, ''), null);
});

test('appendRow keeps the newest LIMITS_MAX rows', async () => {
    const { appendRow, LIMITS_MAX } = await load();
    let text = '';
    for (let i = 0; i < LIMITS_MAX + 3; i++) text = appendRow(text, { at: String(i) });
    const lines = text.trim().split('\n');
    assert.equal(lines.length, LIMITS_MAX);
    assert.equal(JSON.parse(lines[0]).at, '3');
});

test('recordLimits gives each session its own opening row for identical readings, and none to an ended task', async () => {
    globalThis.h = globalThis.h || ((tag, props, ...children) => ({ tag, props: props || {}, children: children.flat() }));
    const { recordLimits } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane.ts')).href);
    const store = {};
    const logs = [];
    const $ = {
        clock: { now: async () => NOW },
        fs: { exists: async (p) => p in store, read: async (p) => store[p], write: async (p, t) => { store[p] = t; } },
        ui: { log: (m) => logs.push(m) },
    };
    const logged = {};
    const live = { task: 'T', stage: 'build', active: true };
    await recordLimits($, 'R', 'sess-a', live, L(12, 40), logged);
    await recordLimits($, 'R', 'sess-a', live, L(12, 40), logged);
    await recordLimits($, 'R', 'sess-b', live, L(12, 40), logged);
    await recordLimits($, 'R', 'sess-c', { task: 'T', stage: 'build', active: false }, L(12, 40), logged);
    assert.equal(store['R/.fankeel/build/limits/sess-a.jsonl'].trim().split('\n').length, 1);
    assert.equal(store['R/.fankeel/build/limits/sess-b.jsonl'].trim().split('\n').length, 1);
    assert.equal('R/.fankeel/build/limits/sess-c.jsonl' in store, false);
    $.fs.write = async () => { throw new Error('disk'); };
    await recordLimits($, 'R', 'sess-d', live, L(1, 2), logged);
    await recordLimits($, 'R', 'sess-d', live, L(1, 2), logged);
    assert.equal(logs.filter((m) => /limits row not written/.test(m)).length, 1);
});
