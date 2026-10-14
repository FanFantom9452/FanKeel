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

test('the Pane\'s route is a column a station: the minutes from clock, the wait from waited, ahead with no bar', async () => {
    const { routeSvg } = await load('pane-svg');
    const source = routeSvg(entry, NOW, 41);
    assert.match(source, /^<svg [^>]*width="328" height="78"/);
    // The names, then each visited station's minutes and the minutes its gate waited.
    assert.deepEqual(words(source), ['survey', 'design', 'plan', 'build', 'verify', 'land', '11分', '37分', '等6', '20分', '等2', '47分', '等4']);
    // Three done dots, the ring and its dot, two hollow.
    assert.equal((source.match(/r="4" fill="#87af5f"/g) || []).length, 3);
    assert.equal((source.match(/r="3\.75" fill="none"/g) || []).length, 2);
    // Each gate's wait is amber at its bar's end.
    assert.equal((source.match(/y="38" width="[\d.]+" height="4" rx="1" fill="#d7af5f"/g) || []).length, 3);
    assert.equal(routeSvg(Object.assign({}, entry, { stage: 'init' }), NOW, 41), '');
});

test('the clash is the shared files on the left, who holds them on the right, one red line a hold', async () => {
    const { clashSvg } = await load('pane-svg');
    const { RAMP } = await load('pane-band');
    const source = clashSvg(entry, others, NOW, 41);
    assert.deepEqual(words(source), ['⚑', 'hooks/pane.ts', '⚑', 'hooks/pane-status.ts', 'band 倒數改秒數', 'build · 12m', 'TODO 歸檔', 'verify · 3m']);
    // pane.ts is held by one neighbour, pane-status.ts by both.
    assert.equal((source.match(/<path /g) || []).length, 3);
    assert.ok(source.includes(`r="3.5" fill="${RAMP.build}"`) && source.includes(`r="3.5" fill="${RAMP.verify}"`));
    assert.equal(clashSvg(entry, [], NOW, 41), '');
});

// A plan of `total` tasks, the first `done` complete, the numbers in `user` the user's.
const planOf = (total, done, user = []) => ({
    name: 'demo',
    done: Array.from({ length: done }, (_, i) => i + 1),
    tasks: Array.from({ length: total }, (_, i) => ({ n: i + 1, name: 'task ' + (i + 1), user: user.includes(i + 1) })),
});
const titles = (source) => [...source.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);

test('nine tasks or fewer are one row of cells, each with a title, the agent on the first open task that is not the user\'s', async () => {
    const { tasksSvg } = await load('pane-svg');
    const source = tasksSvg(entry, planOf(9, 4, [6]), NOW, 41);
    assert.deepEqual(words(source).slice(0, 2), ['tasks', '4 of 9']);
    assert.deepEqual(titles(source), [
        '1 · task 1 · 完成', '2 · task 2 · 完成', '3 · task 3 · 完成', '4 · task 4 · 完成',
        '5 · task 5 · agent 出去 12 分', '6 · task 6 · 你的', '7 · task 7 · 還沒做', '8 · task 8 · 還沒做', '9 · task 9 · 還沒做',
    ]);
    // One row: every cell at y 24, 30px wide.
    assert.equal((source.match(/class="c" x="[\d.]+" y="24" width="30"/g) || []).length, 5);
    // Under the cells: the running task and the user's.
    assert.ok(words(source).includes('5 task 5 · 出去 12 分'));
    assert.ok(words(source).includes('6 task 6 · 你的'));
    assert.match(source, /class="fk-t"/);
});

test('ten to thirty tasks are rows of ten cells; more than thirty are one bar of four counts', async () => {
    const { tasksSvg } = await load('pane-svg');
    const grid = tasksSvg(entry, planOf(24, 11, [16, 20]), NOW, 41);
    assert.equal(titles(grid).length, 24);
    // Task 11 opens the second row and task 21 the third.
    assert.match(grid, /<title>11 · task 11 · 完成<\/title><rect class="c" x="1" y="53" width="24"/);
    assert.match(grid, /<title>21 · task 21 · 還沒做<\/title><rect class="c" x="1.5" y="82.5" width="23"/);
    const bar = tasksSvg(entry, planOf(60, 37, [39, 44, 50, 51]), NOW, 41);
    assert.deepEqual(titles(bar), ['完成 37', '在跑 1', '你的 4', '還沒做 18']);
    assert.ok(words(bar).includes('還有 1 個是你的'));
    assert.equal(words(bar).filter((w) => w.endsWith(' · 你的')).length, 3);
});

test('with no agent out nothing breathes and nothing is named as running', async () => {
    const { tasksSvg } = await load('pane-svg');
    const idle = Object.assign({}, entry, { inflight: null });
    const source = tasksSvg(idle, planOf(9, 4), NOW, 41);
    assert.ok(!source.includes('class="live"'));
    assert.ok(!words(source).some((w) => w.includes('出去')));
});

test('the heading counts the tasks the plan completed, not every number in the ledger', async () => {
    const { tasksSvg } = await load('pane-svg');
    const plan = planOf(9, 4);
    plan.done.push(99);
    assert.deepEqual(words(tasksSvg(entry, plan, NOW, 41)).slice(0, 2), ['tasks', '4 of 9']);
});

test('nine tasks are one row and ten are rows of ten; thirty are rows and thirty-one a bar', async () => {
    const { tasksSvg } = await load('pane-svg');
    const rowsAt = (n) => (tasksSvg(entry, planOf(n, n), NOW, 41).match(/class="c" x="[\d.]+" y="24" width="(\d+)"/g) || []);
    assert.ok(rowsAt(9).every((m) => m.endsWith('width="30"')) && rowsAt(9).length === 9);
    assert.ok(rowsAt(10).every((m) => m.endsWith('width="24"')) && rowsAt(10).length === 10);
    assert.equal(titles(tasksSvg(entry, planOf(30, 0), NOW, 41)).length, 30);
    assert.deepEqual(titles(tasksSvg(entry, planOf(31, 0), NOW, 41)), ['在跑 1', '還沒做 30']);
});

test('an agent out on another stage draws no running task', async () => {
    const { tasksSvg } = await load('pane-svg');
    const other = Object.assign({}, entry, { inflight: { stage: 'verify', at: NOW - 12 * M } });
    const source = tasksSvg(other, planOf(9, 4), NOW, 41);
    assert.ok(!source.includes('class="live"') && !source.includes('出去'));
    assert.ok(titles(source).every((t) => !t.includes('agent')));
});

test('in a bar the running part breathes; the style carries the hover ring and the reduced-motion rule', async () => {
    const { tasksSvg } = await load('pane-svg');
    const source = tasksSvg(entry, planOf(40, 10), NOW, 41);
    assert.match(source, /<rect class="c live"/);
    assert.ok(source.includes('g.k:hover rect.c{stroke:#8a8a8a'));
    assert.ok(source.includes('@media (prefers-reduced-motion:reduce){.fk-t .live{animation:none}}'));
});

test('a long task name under the cells is cut with an ellipsis', async () => {
    const { tasksSvg } = await load('pane-svg');
    const plan = planOf(9, 4);
    plan.tasks[4].name = 'x'.repeat(80);
    const w = words(tasksSvg(entry, plan, NOW, 41));
    const line = w.find((t) => t.startsWith('5 xxx'));
    assert.ok(line && line.includes('…') && line.endsWith(' · 出去 12 分'));
});
