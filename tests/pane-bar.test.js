'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const at = (name) => import(pathToFileURL(path.join(__dirname, '..', 'hooks', name)).href);
const load = () => at('pane-bar.ts');
const NOW = Date.parse('2026-10-12T00:00:00.000Z');
const HOUR = 3600000;
const week = (used, hours) => ({ kind: 'seven_day', percentUsed: used, resetsAt: new Date(NOW + hours * HOUR).toISOString() });
// xterm numbers as the hex the module must hand out.
const X = { 46: '#00ff00', 83: '#5fff5f', 120: '#87ff87', 157: '#afffaf', 194: '#d7ffd7', 193: '#d7ffaf', 192: '#d7ff87', 191: '#d7ff5f',
    190: '#d7ff00', 226: '#ffff00', 220: '#ffd700', 214: '#ffaf00', 208: '#ff8700', 202: '#ff5f00', 196: '#ff0000', 197: '#ff005f',
    198: '#ff0087', 199: '#ff00af', 200: '#ff00d7', 201: '#ff00ff' };

test('width counts a CJK or emoji character two cells, and the warning sign one', async () => {
    const m = await load();
    assert.equal(m.width('ab面板'), 6);
    assert.equal(m.width('⚠'), 1);
    assert.equal(m.width('💥'), 2);
    assert.equal(m.width('💀'), 2);
    assert.equal(m.width('▌█▋░│↻⚑●○◉◐✓'), 12);
    assert.equal(m.width('+15% 💀'), 7);
});

test('cut keeps the head that fits and ends it in an ellipsis; str and list refuse other types', async () => {
    const m = await load();
    assert.equal(m.cut('abcdef', 6), 'abcdef');
    assert.equal(m.cut('abcdef', 4), 'abc…');
    assert.equal(m.cut('面板面板', 5), '面板…');
    assert.equal(m.str(7), '');
    assert.equal(m.str('a'), 'a');
    assert.deepEqual(m.list(['a', 1, 'b']), ['a', 'b']);
    assert.deepEqual(m.list('a'), []);
});

test('pane-status.ts hands out the same helpers, not a second copy', async () => {
    const m = await load();
    const s = await at('pane-status.ts');
    for (const name of ['str', 'list', 'width', 'cut', 'WIDE']) assert.equal(s[name], m[name], name);
});

test('bar fills in eighths of a cell, rounded down, and the track takes the rest', async () => {
    const { bar } = await load();
    const drawn = (part, whole, cells) => { const b = bar(part, whole, cells); return b.fill + b.track; };
    for (const [part, whole, cells, want] of [
        [66, 100, 10, '██████▌░░░'],
        [58, 100, 10, '█████▊░░░░'],
        [212000, 450000, 10, '████▋░░░░░'],
        [432000, 450000, 10, '█████████▌'],
        [432000, 450000, 7, '██████▋'],
        [66, 100, 7, '████▌░░'],
        [58, 100, 7, '████░░░'],
        [432000, 450000, 9, '████████▋'],
        [66, 100, 9, '█████▉░░░'],
        [212000, 450000, 18, '████████▍░░░░░░░░░'],
        [135000, 450000, 18, '█████▍' + '░'.repeat(12)],
        [279000, 450000, 18, '███████████▏' + '░'.repeat(6)],
        [351000, 450000, 18, '█'.repeat(14) + '░'.repeat(4)],
        [432000, 450000, 18, '█'.repeat(17) + '▎'],
        [463000, 450000, 18, '█'.repeat(18)],
        [79, 100, 10, '███████▉░░'],
        [72, 100, 10, '███████▏░░'],
        [96, 100, 10, '█████████▌'],
        [30, 100, 10, '███░░░░░░░'],
        [0, 100, 10, '░'.repeat(10)],
        [-5, 100, 10, '░'.repeat(10)],
        [5, 0, 10, '░'.repeat(10)],
    ]) {
        assert.equal(drawn(part, whole, cells), want, part + ' of ' + whole + ' in ' + cells);
        assert.equal([...drawn(part, whole, cells)].length, cells);
    }
    assert.deepEqual(bar(66, 100, 10), { fill: '██████▌', track: '░░░' });
    assert.deepEqual(bar(100, 100, 5), { fill: '█████', track: '' });
    assert.deepEqual(bar(0, 100, 5), { fill: '', track: '░░░░░' });
});

test('ctxPaint steps through TokenBar\'s ramp by percent of the threshold, bold from sixty, marked from eighty', async () => {
    const { ctxPaint } = await load();
    const steps = [[0, 46], [8, 83], [16, 120], [24, 157], [32, 194], [36, 190], [40, 226], [45, 220], [50, 214], [55, 208], [60, 196], [65, 198], [70, 199], [75, 200], [80, 201]];
    steps.forEach(([from, xterm], i) => {
        assert.deepEqual(ctxPaint(from * 1000, 100000), { color: X[xterm], bold: from >= 60, mark: from >= 80 ? '⚠' : '' }, from + ' percent');
        if (i) assert.equal(ctxPaint(from * 1000 - 1, 100000).color, X[steps[i - 1][1]], 'one token under ' + from + ' percent');
    });
    // 55 percent of 450000 is 247500: a threshold that is not a round hundred thousand.
    assert.equal(ctxPaint(247500, 450000).color, X[208]);
    assert.equal(ctxPaint(247499, 450000).color, X[214]);
    assert.deepEqual(ctxPaint(463000, 450000), { color: X[201], bold: true, mark: '⚠' });
    assert.deepEqual(ctxPaint(5, 0), { color: X[46], bold: false, mark: '' });
});

test('fivePaint steps by percent used, bold from eighty, marked from ninety-five', async () => {
    const { fivePaint } = await load();
    const steps = [[0, 46], [10, 83], [20, 120], [30, 157], [40, 194], [45, 193], [50, 192], [55, 190], [60, 226], [65, 220], [70, 214], [75, 208], [80, 196], [85, 197], [90, 199], [95, 201]];
    steps.forEach(([from, xterm], i) => {
        assert.deepEqual(fivePaint(from), { color: X[xterm], bold: from >= 80, mark: from >= 95 ? '⚠' : '' }, from + ' percent');
        if (i) assert.equal(fivePaint(from - 0.5).color, X[steps[i - 1][1]], 'just under ' + from + ' percent');
    });
});

test('weekPaint is coloured by the deviation alone, purple from ninety-five percent used, and by percent used with no deviation', async () => {
    const { weekPaint, fivePaint } = await load();
    const steps = [[-999, 46], [-10, 83], [-7, 120], [-3, 157], [0, 194], [1, 193], [2, 192], [3, 191], [4, 190], [5, 226], [6, 214], [7, 202], [8, 196], [9, 197], [10, 198], [11, 199], [12, 200], [13, 201], [14, 201]];
    const mark = (dev) => (dev >= 14 ? '💀' : dev >= 10 ? '💥' : dev >= 7 ? '⚠' : '');
    for (const [dev, xterm] of steps) {
        assert.deepEqual(weekPaint(50, dev), { color: X[xterm], bold: dev >= 14, mark: mark(dev) }, 'deviation ' + dev);
    }
    assert.equal(weekPaint(5, -11).color, X[46]);
    assert.equal(weekPaint(90, -6).color, X[120], 'ninety percent used and behind the pace is still green');
    assert.deepEqual(weekPaint(95, -6), { color: X[201], bold: true, mark: '' });
    assert.deepEqual(weekPaint(96, 15), { color: X[201], bold: true, mark: '💀' });
    assert.deepEqual(weekPaint(66, null), Object.assign({}, fivePaint(66), { mark: '' }));
    assert.deepEqual(weekPaint(97, null), { color: X[201], bold: true, mark: '' });
});

test('deviation is percent used less the share of the seven days gone by, rounded half away from zero', async () => {
    const { deviation, resetMs } = await load();
    assert.equal(deviation(week(58, 60.5), NOW), -6);
    assert.equal(deviation(week(72, 60.5), NOW), 8);
    assert.equal(deviation(week(79, 60.5), NOW), 15);
    assert.equal(deviation(week(50, 84), NOW), 0);
    assert.ok(Object.is(deviation(week(50, 84), NOW), 0), 'never -0');
    assert.equal(deviation(week(30, 168), NOW), 30);
    assert.equal(deviation(week(30, 400), NOW), 30, 'a reset more than a week out is a window not begun');
    assert.equal(deviation(week(30, -1), NOW), -70, 'a reset already past is a window all gone by');
    assert.equal(deviation({ kind: 'seven_day', percentUsed: 58 }, NOW), null);
    assert.equal(deviation({ kind: 'seven_day', percentUsed: 58, resetsAt: 'soon' }, NOW), null);
    assert.equal(resetMs(week(58, 60.5)), NOW + 60.5 * HOUR);
    assert.equal(resetMs({ kind: 'five_hour', percentUsed: 1 }), null);
});

test('countdown is hours and two-digit minutes, with days in front where asked, and `now` once it is past', async () => {
    const { countdown } = await load();
    assert.equal(countdown(106 * 60000, false), '1h 46m');
    assert.equal(countdown(12 * 60000, false), '0h 12m');
    assert.equal(countdown(208 * 60000, false), '3h 28m');
    assert.equal(countdown(65 * 60000 + 59999, false), '1h 05m');
    assert.equal(countdown(30 * HOUR, false), '30h 00m');
    assert.equal(countdown(60.5 * HOUR, true), '2d 12h 30m');
    assert.equal(countdown(5.5 * HOUR, true), '0d 05h 30m');
    assert.equal(countdown(0, false), 'now');
    assert.equal(countdown(-5000, true), 'now');
});

test('pct, kilo and signed write a number the one way both drawings use', async () => {
    const { pct, kilo, signed } = await load();
    assert.deepEqual([pct(66), pct(4), pct(100), pct(57.6)], [' 66%', '  4%', '100%', ' 58%']);
    assert.deepEqual([kilo(212000), kilo(9000), kilo(449999), kilo(0)], ['212k', '9k', '450k', '0k']);
    assert.deepEqual([signed(-6), signed(8), signed(0), signed(15)], ['-6%', '+8%', '0%', '+15%']);
});

test('limitOf finds a window by its kind, and one with no number is no window', async () => {
    const { limitOf, DIM } = await load();
    const five = { kind: 'five_hour', percentUsed: 66 };
    assert.equal(limitOf([week(58, 60.5), five], 'five_hour'), five);
    assert.equal(limitOf([five], 'seven_day'), null);
    assert.equal(limitOf([], 'five_hour'), null);
    assert.equal(limitOf([{ kind: 'five_hour' }, null, { kind: 'five_hour', percentUsed: NaN }], 'five_hour'), null);
    assert.equal(DIM, '#585858');
});
