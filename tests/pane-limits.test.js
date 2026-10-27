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
