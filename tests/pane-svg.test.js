'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = (name) => import(pathToFileURL(path.join(__dirname, '..', 'hooks', name + '.ts')).href);
const NOW = Date.parse('2026-10-14T06:00:00.000Z');
const M = 60000;
const entry = {
    task: 'Pane 視覺化改版', next: 'task 5 的 agent 回來後跑 pane 測試', stage: 'build', active: true,
    route: ['survey', 'design', 'plan', 'build', 'verify', 'land'],
    clock: { survey: [NOW - 118 * M, NOW - 107 * M], design: [NOW - 106 * M, NOW - 69 * M], plan: [NOW - 68 * M, NOW - 48 * M], build: [NOW - 47 * M, null] },
    moves: [['survey', NOW - 118 * M], ['design', NOW - 106 * M], ['plan', NOW - 68 * M], ['build', NOW - 47 * M]],
    waited: { design: 6 * M, plan: 2 * M, build: 4 * M },
    claims: ['hooks/pane.ts', 'hooks/pane-status.ts'],
    inflight: { stage: 'build', at: NOW - 12 * M, group: 2 },
    notes: ['終端維持文字'],
    updated: new Date(NOW - M).toISOString(),
};
const others = [
    { id: 'b41e07d2-0000-4000-8000-000000000001', entry: { task: 'band 倒數改秒數', stage: 'build', active: true, claims: ['hooks/pane.ts', 'hooks/pane-status.ts'], updated: new Date(NOW - 12 * M).toISOString() } },
    { id: 'c9a2f310-0000-4000-8000-000000000002', entry: { task: 'TODO 歸檔', stage: 'verify', active: true, claims: ['hooks/pane-status.ts'], updated: new Date(NOW - 3 * M).toISOString() } },
];
const context = { tokens: 372000, at: 450000, window: 1000000 };
const limits = [
    { kind: 'five_hour', percentUsed: 46, resetsAt: new Date(NOW + 2.4 * 3600e3).toISOString() },
    { kind: 'seven_day', percentUsed: 64, resetsAt: new Date(NOW + 2.8 * 86400e3).toISOString() },
];
const bandInput = (over) => Object.assign({ entry, others, gateUntil: null, gateAt: null, context, limits, tasks: { done: 4, total: 9 }, cols: 80, now: NOW }, over);
// The route's dots in order, each with its state and its colour: a ring of r 6 and the dot in it are one station.
function dots(source) {
    const circles = [...source.matchAll(/<circle cx="[\d.]+" cy="11" r="([\d.]+)" fill="(#[0-9a-f]{6}|none)"(?: stroke="(#[0-9a-f]{6})")?/g)]
        .map((m) => ({ r: m[1], fill: m[2], stroke: m[3] })).filter((c) => c.r !== '6.5');
    const out = [];
    for (let i = 0; i < circles.length; i++) {
        const c = circles[i];
        if (c.r === '6') {
            out.push({ state: 'here', colour: c.stroke });
            i += 1;
        } else out.push(c.fill === 'none' ? { state: 'ahead', colour: c.stroke } : { state: 'done', colour: c.fill });
    }
    return out;
}
// The text of every <text> element, in order.
const words = (source) => [...source.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

test('altOf is the rows as the terminal draws them, without the rail, one line a row', async () => {
    const { altOf } = await load('pane-svg');
    assert.equal(altOf([[{ text: '▌' }, { text: 'FANKEEL PLAN' }, { text: '●●', gap: 2 }], [{ text: ' ' }, { text: 'ctx ' }, { text: '212k' }]]), 'FANKEEL PLAN  ●●\nctx 212k');
});

test('each dot of the band\'s route is its own station\'s colour, and the state is the shape', async () => {
    const { bandRow1Svg } = await load('pane-svg');
    const { RAMP } = await load('pane-band');
    const short = Object.assign({}, entry, { stage: 'plan', route: ['survey', 'plan', 'build', 'verify', 'land'] });
    const seen = dots(bandRow1Svg(bandInput({ entry: short, tasks: null })));
    assert.deepEqual(seen, [
        { state: 'done', colour: RAMP.survey },
        { state: 'here', colour: RAMP.plan },
        { state: 'ahead', colour: RAMP.build },
        { state: 'ahead', colour: RAMP.verify },
        { state: 'ahead', colour: RAMP.land },
    ]);
    assert.notEqual(seen[1].colour, RAMP.design);
    // A stage off the route draws every station hollow.
    assert.ok(dots(bandRow1Svg(bandInput({ entry: Object.assign({}, entry, { stage: 'init' }) }))).every((d) => d.state === 'ahead'));
});

test('the band\'s tasks are one cell a task with the count beside them, the same count the text row has', async () => {
    const { bandRow1Svg } = await load('pane-svg');
    const { bandRows } = await load('pane-band');
    const source = bandRow1Svg(bandInput());
    const cells = [...source.matchAll(/<rect x="[\d.]+" y="7" width="[\d.]+" height="8" rx="1" fill="(#[0-9a-f]{6})"\/>/g)].map((m) => m[1]);
    assert.deepEqual(cells, [...Array(4).fill('#87af5f'), ...Array(5).fill('#585858')]);
    assert.ok(words(source).includes('4/9'));
    assert.ok(bandRows(bandInput())[0].some((seg) => seg.text === '4/9'));
    assert.ok(!bandRow1Svg(bandInput({ tasks: null })).includes('y="7"'), 'cells drawn with no ledger');
});

test('a waiting gate is a badge and a ring full at the whole wait, with the seconds left beside it', async () => {
    const { bandRow1Svg } = await load('pane-svg');
    const source = bandRow1Svg(bandInput({ gateAt: NOW - 18000, gateUntil: NOW + 42000 }));
    assert.ok(words(source).includes('gate 在等'));
    assert.ok(words(source).includes('42 秒'));
    // 42 of 60 seconds left: seven tenths of a circle of r 6.5.
    assert.match(source, /stroke-dasharray="28\.6 40\.8"/);
    // With no `at` the ring is full.
    assert.match(bandRow1Svg(bandInput({ gateAt: null, gateUntil: NOW + 42000 })), /stroke-dasharray="40\.8 40\.8"/);
    assert.ok(!bandRow1Svg(bandInput()).includes('stroke-dasharray'));
});

test('the band\'s second row draws ctx, 5h and 7d as meters, the compact point in ctx, the pace in 7d and ⚑N last', async () => {
    const { bandRow2Svg } = await load('pane-svg');
    const { bandRows } = await load('pane-band');
    const source = bandRow2Svg(bandInput());
    assert.deepEqual(words(source), ['ctx', '372k', '/1M', '⚠', '5h', '46%', '7d', '64%', '+4%', '⚑2']);
    // The text row carries the same count.
    assert.ok(bandRows(bandInput())[1].some((seg) => seg.text === '372k'));
    // The compact point: a grey line taller than the well, at 450k of 1M.
    assert.match(source, /<rect x="[\d.]+" y="2" width="2" height="18" rx="1" fill="#8a8a8a"\/>/);
    assert.match(source, /<rect x="[\d.]+" y="3" width="1\.5" height="16" fill="#8a8a8a"\/>/);
});

test('compact.at off leaves no compact point; with no window it is the count alone; with nothing to draw there is no row', async () => {
    const { bandRow2Svg } = await load('pane-svg');
    const off = bandRow2Svg(bandInput({ context: { tokens: 212000, at: Infinity, window: 1000000 }, limits: [], others: [] }));
    assert.deepEqual(words(off), ['ctx', '212k', '/1M']);
    assert.ok(!off.includes('height="18" rx="1"'), 'a compact point drawn while compact is off');
    const bare = bandRow2Svg(bandInput({ context: { tokens: 212000, at: Infinity }, limits: [], others: [] }));
    assert.deepEqual(words(bare), ['ctx', '212k']);
    assert.ok(!bare.includes('height="10"'), 'a well drawn with nothing to measure against');
    assert.equal(bandRow2Svg(bandInput({ context: null, limits: [], others: [] })), '');
});
