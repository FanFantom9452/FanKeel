'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const at = (name) => import(pathToFileURL(path.join(__dirname, '..', 'hooks', name)).href);
const load = () => at('pane-band.ts');
const START = Date.parse('2026-10-11T00:00:00.000Z');
const NOW = START + 38 * 60000 + 5000;
const HOUR = 3600000;
const entry = {
    task: 'fankeel 面板 mod：把任務／階段狀態做成 mod Pane',
    route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'],
    stage: 'build',
    active: true,
    guard: 'deny',
    next: 'Task 5 帶使用者實測',
    claims: ['hooks/mod.ts', 'hooks/pane.ts', 'tests/pane.test.js', 'docs/a.md'],
    clock: { build: [START - 3600000, START] },
    moves: [['plan', START - 7200000, 1], ['build', START - 3600000, 2], ['design', START - 1800000, 3], ['build', START, 4]],
    waited: { build: 125000 },
};
const other = { id: 'aaaaaaaa-0000-4000-8000-000000000001', entry: { task: '別的任務', stage: 'design', active: true, claims: ['hooks/mod.ts'] } };
const second = { id: 'cccccccc-0000-4000-8000-000000000003', entry: { task: '第二個', stage: 'plan', active: true, claims: ['hooks/pane.ts', 'hooks/mod.ts'] } };
const apart = { id: 'bbbbbbbb-0000-4000-8000-000000000002', entry: { task: '不相干', stage: 'plan', active: true, claims: ['lib/x.js'] } };
const context = { tokens: 212000, at: 450000 };
const hot = { tokens: 432000, at: 450000 };
const five = { kind: 'five_hour', percentUsed: 66, resetsAt: new Date(NOW + 106 * 60000).toISOString() };
const week = { kind: 'seven_day', percentUsed: 58, resetsAt: new Date(NOW + 60.5 * HOUR).toISOString() };
const limits = [five, week];
const tasks = { done: 4, total: 5 };
const band = (m, over) => m.bandRows(Object.assign({ entry, others: [], gateUntil: null, context, limits, tasks, cols: 80, now: NOW }, over));
// A row as the terminal shows it: each segment after its gap.
const line = (segs) => segs.map((seg) => ' '.repeat(seg.gap || 0) + seg.text).join('');
const after = (segs, label) => { const i = segs.findIndex((seg) => seg.text === label); return i < 0 ? null : segs[i + 1].text; };

test('the first row is the rail, the badge, the route as dots, tasks N/M and the minutes', async () => {
    const m = await load();
    const [first] = band(m);
    assert.deepEqual(first, [
        { text: '▌', color: '#5f87d7' },
        { text: 'FANKEEL BUILD', color: '#5f87d7', bold: true },
        { text: '●●●●', color: '#5f87d7', gap: 2 },
        { text: '○○○', color: '#767676' },
        { text: 'tasks', color: '#8a8a8a', gap: 2 },
        { text: '4/5', gap: 1 },
        { text: '本站', color: '#8a8a8a', gap: 2 },
        { text: '38', gap: 1 },
        { text: '分', color: '#8a8a8a', gap: 1 },
        { text: '等你', color: '#8a8a8a', gap: 2 },
        { text: '2', gap: 1 },
        { text: '分', color: '#8a8a8a', gap: 1 },
    ]);
    assert.equal(line(first), '▌FANKEEL BUILD  ●●●●○○○  tasks 4/5  本站 38 分  等你 2 分');
});

test('the band draws no task title, no next, no guard, no file count and no N of M', async () => {
    const m = await load();
    for (const over of [{}, { gateUntil: NOW + 44500 }, { others: [other] }, { cols: 200 }]) {
        const seen = band(m, over).map(line).join('\n');
        assert.doesNotMatch(seen, /面板|Task 5|next|⚿|deny|檔| of /);
    }
});

test('the dots come from the route at every stage, and a stage off the route has none filled', async () => {
    const m = await load();
    for (const stage of entry.route) {
        const [first] = band(m, { entry: Object.assign({}, entry, { stage }) });
        const dots = first.map((seg) => seg.text).join('');
        assert.equal((dots.match(/●/g) || []).length, entry.route.indexOf(stage) + 1);
        assert.equal((dots.match(/[●○]/g) || []).length, entry.route.length);
        assert.equal(first[1].color, m.RAMP[stage]);
    }
    const [off] = band(m, { entry: Object.assign({}, entry, { stage: 'init' }) });
    assert.deepEqual(off.slice(0, 3), [{ text: '▌', color: '#8a8a8a' }, { text: 'FANKEEL INIT', color: '#8a8a8a', bold: true }, { text: '○○○○○○○', color: '#767676', gap: 2 }]);
});

test('the colours are the ones the design lists', async () => {
    const m = await load();
    assert.deepEqual(m.RAMP, { survey: '#5f5f87', design: '#5f5fd7', plan: '#5f87af', build: '#5f87d7', verify: '#5fafff', audit: '#5fd787', land: '#5fd7ff' });
    assert.deepEqual([m.HOLLOW, m.TODO, m.GUARD, m.FLAG, m.TITLE, m.WHERE, m.CLASH, m.INK], ['#585858', '#767676', '#d7af5f', '#ff5f5f', '#bcbcbc', '#8a8a8a', '#ff0000', '#000000']);
    assert.equal(m.stageColor('verify'), '#5fafff');
    assert.equal(m.stageColor('init'), '#8a8a8a');
    assert.equal(m.stageColor('constructor'), '#8a8a8a');
});

test('the stage minutes come from the last move, else the clock, else are not drawn; the wait is 0 with none recorded', async () => {
    const m = await load();
    const first = (over) => band(m, { entry: Object.assign({}, entry, over) })[0];
    assert.equal(after(first({}), '本站'), '38');
    assert.equal(after(first({ moves: undefined }), '本站'), '98');
    assert.equal(after(first({ moves: undefined, clock: undefined }), '本站'), null);
    assert.equal(line(first({ moves: undefined, clock: undefined })), '▌FANKEEL BUILD  ●●●●○○○  tasks 4/5  等你 2 分');
    assert.equal(after(first({ waited: undefined }), '等你'), '0');
    assert.equal(after(first({ waited: { design: 600000 } }), '等你'), '0');
});

test('tasks N/M is drawn only for a plan with tasks, and never counts past its total', async () => {
    const m = await load();
    const count = (tasks) => after(band(m, { tasks })[0], 'tasks');
    assert.equal(count({ done: 4, total: 5 }), '4/5');
    assert.equal(count({ done: 9, total: 5 }), '5/5');
    assert.equal(count({ done: 0, total: 13 }), '0/13');
    assert.equal(count({ done: 0, total: 0 }), null);
    assert.equal(count(null), null);
});

test('a waiting gate adds the badge and its countdown after tasks, and moves the stage minutes to the end', async () => {
    const m = await load();
    const [first] = band(m, { gateUntil: NOW + 44500 });
    assert.equal(line(first), '▌FANKEEL BUILD  ●●●●○○○  tasks 4/5   gate 在等   還 45 秒  等你 2 分  本站 38 分');
    assert.deepEqual(first.slice(6, 9), [
        { text: ' gate 在等 ', backgroundColor: '#d7af5f', color: '#000000', bold: true, gap: 2 },
        { text: '還 45 秒', color: '#d7af5f', bold: true, gap: 2 },
        { text: '等你 2 分', color: '#d7af5f', gap: 2 },
    ]);
    const secs = (until) => band(m, { gateUntil: until })[0].find((seg) => seg.text.startsWith('還')).text;
    assert.equal(secs(NOW + 45000), '還 45 秒');
    assert.equal(secs(NOW + 45001), '還 46 秒');
    assert.equal(secs(NOW - 1), '還 0 秒');
    assert.equal(secs(NOW - 5000), '還 0 秒');
    assert.ok(!band(m)[0].some((seg) => seg.backgroundColor), 'a badge with no gate waiting');
});

test('a first row that does not fit drops the stage minutes, then the wait, then tasks, and nothing else', async () => {
    const m = await load();
    const { width } = await at('pane-bar.ts');
    const calm = (cols) => line(band(m, { cols })[0]);
    assert.equal(calm(57), '▌FANKEEL BUILD  ●●●●○○○  tasks 4/5  本站 38 分  等你 2 分');
    assert.equal(calm(56), '▌FANKEEL BUILD  ●●●●○○○  tasks 4/5  等你 2 分');
    assert.equal(calm(44), '▌FANKEEL BUILD  ●●●●○○○  tasks 4/5');
    assert.equal(calm(33), '▌FANKEEL BUILD  ●●●●○○○');
    assert.equal(calm(10), '▌FANKEEL BUILD  ●●●●○○○');
    const gated = (cols) => line(band(m, { cols, gateUntil: NOW + 44500 })[0]);
    assert.equal(width(gated(80)), 80);
    assert.equal(gated(79), '▌FANKEEL BUILD  ●●●●○○○  tasks 4/5   gate 在等   還 45 秒  等你 2 分');
    assert.equal(gated(70), gated(79));
    assert.equal(width(gated(70)), 68);
    assert.equal(gated(67), '▌FANKEEL BUILD  ●●●●○○○  tasks 4/5   gate 在等   還 45 秒');
    assert.equal(gated(50), '▌FANKEEL BUILD  ●●●●○○○   gate 在等   還 45 秒');
    assert.equal(width(gated(50)), 46);
    assert.equal(gated(30), gated(50));
});

test('the second row is ctx, 5h and 7d as bars, parted by a bar of their own', async () => {
    const m = await load();
    const { width } = await at('pane-bar.ts');
    const [, row] = band(m);
    assert.deepEqual(row, [
        { text: '▌', color: '#5f87d7' },
        { text: 'ctx ', color: '#585858' },
        { text: '████▋', color: '#ffd700' },
        { text: '░░░░░', color: '#585858' },
        { text: '212k', color: '#ffd700', gap: 1 },
        { text: '/450k', color: '#8a8a8a' },
        { text: '│', color: '#585858', gap: 2 },
        { text: '5h ', color: '#585858', gap: 2 },
        { text: '██████▌', color: '#ffd700' },
        { text: '░░░', color: '#585858' },
        { text: ' 66%', color: '#ffd700', gap: 1 },
        { text: '│', color: '#585858', gap: 2 },
        { text: '7d ', color: '#585858', gap: 2 },
        { text: '█████▊', color: '#87ff87' },
        { text: '░░░░', color: '#585858' },
        { text: ' 58%', color: '#87ff87', gap: 1 },
        { text: '-6%', color: '#87ff87', gap: 2 },
    ]);
    assert.equal(line(row), '▌ctx ████▋░░░░░ 212k/450k  │  5h ██████▌░░░  66%  │  7d █████▊░░░░  58%  -6%');
    assert.equal(width(line(row)), 76);
});

test('the two countdowns are drawn only where the row has the cells: both at 100, the 5h one at 99, neither at 80', async () => {
    const m = await load();
    const { width } = await at('pane-bar.ts');
    const row = (cols) => line(band(m, { cols })[1]);
    assert.equal(row(100), '▌ctx ████▋░░░░░ 212k/450k  │  5h ██████▌░░░  66%  ↻ 1h 46m  │  7d █████▊░░░░  58%  ↻ 2d 12h 30m  -6%');
    assert.equal(width(row(100)), 100);
    assert.equal(row(99), '▌ctx ████▋░░░░░ 212k/450k  │  5h ██████▌░░░  66%  ↻ 1h 46m  │  7d █████▊░░░░  58%  -6%');
    assert.equal(width(row(99)), 86);
    assert.equal(row(86), row(99));
    assert.equal(row(85), row(80));
    assert.doesNotMatch(row(80), /↻/);
    const reset = band(m, { cols: 100 })[1].filter((seg) => seg.text.startsWith('↻'));
    assert.deepEqual(reset, [{ text: '↻ 1h 46m', color: '#585858', gap: 2 }, { text: '↻ 2d 12h 30m', color: '#585858', gap: 2 }]);
});

test('with no rate limits the second row is ctx alone; with nothing to draw there is one row', async () => {
    const m = await load();
    assert.deepEqual(band(m, { limits: [] }).map(line)[1], '▌ctx ████▋░░░░░ 212k/450k');
    assert.equal(band(m, { limits: [five] }).map(line)[1], '▌ctx ████▋░░░░░ 212k/450k  │  5h ██████▌░░░  66%  ↻ 1h 46m');
    assert.equal(band(m, { context: null }).map(line)[1], '▌5h ██████▌░░░  66%  ↻ 1h 46m  │  7d █████▊░░░░  58%  ↻ 2d 12h 30m  -6%');
    assert.equal(band(m, { context: null, limits: [] }).length, 1);
    assert.deepEqual(band(m, { context: null, limits: [], others: [other] }).map(line)[1], '▌  ⚑1');
});

test('a session in the same files is a count at the end of the second row and a red rail on both', async () => {
    const m = await load();
    const calm = band(m, { others: [apart] });
    assert.ok(!calm.flat().some((seg) => seg.text.startsWith('⚑')));
    assert.deepEqual(calm.map((row) => row[0].color), ['#5f87d7', '#5f87d7']);
    const clash = band(m, { others: [other, apart, second], cols: 120 });
    assert.ok(!clash[0].some((seg) => seg.text.startsWith('⚑')), 'the flag is on the first row');
    assert.deepEqual(clash[1][clash[1].length - 1], { text: '⚑2', color: '#ff5f5f', bold: true, gap: 2 });
    assert.deepEqual(clash.map((row) => row[0].color), ['#ff0000', '#ff0000']);
    assert.equal(clash[0][1].color, '#5f87d7');
    assert.equal(m.clashes(entry, [other, apart, other]), 2);
});

test('a second row that does not fit closes up, shortens its bars, then drops 7d, then 5h; ctx and the flag stay', async () => {
    const m = await load();
    const { width } = await at('pane-bar.ts');
    const row = (cols) => line(band(m, { context: hot, others: [other, second], cols })[1]);
    assert.equal(row(80), '▌ctx █████████▌ 432k/450k ⚠ │ 5h ██████▌░░░  66% │ 7d █████▊░░░░  58%  -6%  ⚑2');
    assert.equal(width(row(80)), 78);
    assert.equal(row(70), '▌ctx ██████▋ 432k/450k ⚠ │ 5h ████▌░░  66% │ 7d ████░░░  58%  -6%  ⚑2');
    assert.equal(width(row(70)), 69);
    assert.equal(row(50), '▌ctx ████████▋ 432k/450k ⚠ │ 5h █████▉░░░  66%  ⚑2');
    assert.equal(width(row(50)), 50);
    assert.equal(row(20), '▌ctx ████▊ 432k/450k ⚠  ⚑2');
    const segs = band(m, { context: hot, cols: 80 })[1];
    assert.deepEqual(segs.slice(1, 6), [
        { text: 'ctx ', color: '#585858' },
        { text: '█████████▌', color: '#ff00ff', bold: true },
        { text: '432k', color: '#ff00ff', bold: true, gap: 1 },
        { text: '/450k', color: '#8a8a8a' },
        { text: '⚠', color: '#ff00ff', bold: true, gap: 1 },
    ]);
});

test('the 7d meter is coloured and marked by its deviation, the 5h one by percent used, and 7d with no reset by percent used', async () => {
    const m = await load();
    const weekOf = (used, resetsAt) => (resetsAt === null ? { kind: 'seven_day', percentUsed: used } : { kind: 'seven_day', percentUsed: used, resetsAt: week.resetsAt });
    const tail = (over, n) => band(m, Object.assign({ cols: 120 }, over))[1].slice(-n);
    assert.deepEqual(tail({ limits: [five, weekOf(72)] }, 2), [{ text: '+8%', color: '#ff0000', gap: 2 }, { text: '⚠', color: '#ff0000', gap: 1 }]);
    assert.deepEqual(tail({ limits: [five, weekOf(79)] }, 2), [{ text: '+15%', color: '#ff00ff', bold: true, gap: 2 }, { text: '💀', color: '#ff00ff', bold: true, gap: 1 }]);
    assert.deepEqual(tail({ limits: [five, weekOf(58, null)] }, 3), [{ text: '█████▊', color: '#d7ff00' }, { text: '░░░░', color: '#585858' }, { text: ' 58%', color: '#d7ff00', gap: 1 }]);
    const full = { kind: 'five_hour', percentUsed: 96, resetsAt: new Date(NOW + 12 * 60000).toISOString() };
    assert.equal(line(band(m, { limits: [full], context: null, cols: 120 })[1]), '▌5h █████████▌  96% ⚠  ↻ 0h 12m');
    assert.deepEqual(tail({ limits: [full], context: null }, 3)[0], { text: ' 96%', color: '#ff00ff', bold: true, gap: 1 });
});

test('neither row is wider than the band at 80, 70 and 50 columns, gate or none, clash or none', async () => {
    const m = await load();
    const { width } = await at('pane-bar.ts');
    for (const cols of [80, 70, 50]) {
        for (const gateUntil of [null, NOW + 44500]) {
            for (const others of [[], [other, second]]) {
                for (const ctx of [context, hot]) {
                    for (const row of band(m, { cols, gateUntil, others, context: ctx })) {
                        assert.ok(width(line(row)) <= cols, cols + ' < ' + width(line(row)) + ': ' + line(row));
                    }
                }
            }
        }
    }
});

test('no entry is no band', async () => {
    const m = await load();
    assert.equal(band(m, { entry: null }), null);
});
