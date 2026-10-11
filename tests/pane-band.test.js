'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-band.ts')).href);
const START = Date.parse('2026-10-11T00:00:00.000Z');
const NOW = START + 38 * 60000 + 5000;
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
};
const other = { id: 'aaaaaaaa-0000-4000-8000-000000000001', entry: { task: '別的任務', stage: 'design', active: true, claims: ['hooks/mod.ts'] } };
const apart = { id: 'bbbbbbbb-0000-4000-8000-000000000002', entry: { task: '不相干', stage: 'plan', active: true, claims: ['lib/x.js'] } };
const width = (s) => [...s].length;
const cut = (s, cols) => ([...s].length <= cols ? s : [...s].slice(0, cols - 1).join('') + '…');
const rows = (m, e, others, gate, cols) => m.bandRows(e, others || [], gate === undefined ? null : gate, cols || 90, NOW, width, cut);
const used = (segs) => segs.reduce((n, seg) => n + (seg.gap || 0) + width(seg.text), 0);

test('the first row names the stage and draws the route as dots in its colour', async () => {
    const m = await load();
    const [first] = rows(m, entry);
    assert.deepEqual(first[0], { text: '▌', color: '#5f87d7' });
    assert.deepEqual(first[1], { text: 'FANKEEL BUILD', color: '#5f87d7', bold: true });
    assert.deepEqual(first.filter((seg) => seg.text.includes('●')), [{ text: '●●●●', color: '#5f87d7', gap: 2 }]);
    assert.deepEqual(first.filter((seg) => seg.text.includes('○')), [{ text: '○○○', color: '#585858' }]);
    assert.deepEqual(first.find((seg) => seg.text.startsWith('⚿')), { text: '⚿ deny', color: '#d7af5f', gap: 2 });
    assert.deepEqual(first[first.length - 1], { text: entry.task, color: '#bcbcbc', gap: 2 });
});

test('the dots and N of M come from the same route, at every stage', async () => {
    const m = await load();
    for (const stage of entry.route) {
        const [first, second] = rows(m, Object.assign({}, entry, { stage }));
        const [, n, total] = second.map((seg) => seg.text).join(' ').match(/(\d+) of (\d+)/);
        const dots = first.map((seg) => seg.text).join('');
        assert.equal((dots.match(/●/g) || []).length, Number(n));
        assert.equal((dots.match(/[●○]/g) || []).length, Number(total));
        assert.equal(Number(n), entry.route.indexOf(stage) + 1);
        assert.equal(Number(total), entry.route.length);
        assert.equal(first[1].color, m.RAMP[stage]);
    }
});

test('the colours are the ones the design lists', async () => {
    const m = await load();
    assert.deepEqual(m.RAMP, { survey: '#5f5f87', design: '#5f5fd7', plan: '#5f87af', build: '#5f87d7', verify: '#5fafff', audit: '#5fd787', land: '#5fd7ff' });
    assert.deepEqual([m.HOLLOW, m.GUARD, m.FLAG, m.TITLE, m.WHERE, m.CLASH, m.INK], ['#585858', '#d7af5f', '#ff5f5f', '#bcbcbc', '#8a8a8a', '#ff0000', '#000000']);
    assert.equal(m.stageColor('verify'), '#5fafff');
    assert.equal(m.stageColor('init'), '#8a8a8a');
    assert.equal(m.stageColor('constructor'), '#8a8a8a');
});

test('a neighbour in the same files is a flag with its count, and a red rail on both rows', async () => {
    const m = await load();
    const calm = rows(m, entry, [apart]);
    assert.ok(!calm[0].some((seg) => seg.text.startsWith('⚑')));
    assert.deepEqual(calm.map((row) => row[0].color), ['#5f87d7', '#5f87d7']);
    const hot = rows(m, entry, [other, apart]);
    assert.deepEqual(hot[0].find((seg) => seg.text.startsWith('⚑')), { text: '⚑1', color: '#ff5f5f', gap: 2 });
    assert.deepEqual(hot.map((row) => row[0].color), ['#ff0000', '#ff0000']);
    assert.equal(hot[0][1].color, '#5f87d7');
    assert.equal(m.clashes(entry, [other, apart, other]), 2);
});

test('the second row is next, the files touched, and where the stage stands', async () => {
    const m = await load();
    const [, second] = rows(m, entry);
    assert.deepEqual(second, [
        { text: '▌', color: '#5f87d7' },
        { text: 'next', color: '#8a8a8a' },
        { text: 'Task 5 帶使用者實測', color: '#bcbcbc', gap: 2 },
        { text: '4 檔', color: '#8a8a8a', gap: 2 },
        { text: '4 of 7 · 38 分', color: '#8a8a8a', gap: 2 },
    ]);
});

test('with no moves the minutes fall back to the clock, and with neither there are none', async () => {
    const m = await load();
    const tail = (e) => { const second = rows(m, e)[1]; return second[second.length - 1].text; };
    assert.equal(tail(Object.assign({}, entry, { moves: undefined })), '4 of 7 · 98 分');
    assert.equal(tail(Object.assign({}, entry, { moves: undefined, clock: undefined })), '4 of 7');
});

test('no next is a dash, and no guard reads ask', async () => {
    const m = await load();
    const [first, second] = rows(m, Object.assign({}, entry, { next: undefined, guard: undefined }));
    assert.deepEqual(second[2], { text: '—', color: '#8a8a8a', gap: 2 });
    assert.ok(first.some((seg) => seg.text === '⚿ ask'));
});

test('a waiting gate turns the second row into a yellow badge and the question', async () => {
    const m = await load();
    const [first, second] = rows(m, entry, [], '接受這個方案，進入 plan 嗎？');
    assert.deepEqual(second.slice(0, 3), [
        { text: '▌', color: '#5f87d7' },
        { text: ' gate 在等 ', backgroundColor: '#d7af5f', color: '#000000', bold: true },
        { text: '接受這個方案，進入 plan 嗎？', color: '#d7af5f', gap: 2 },
    ]);
    assert.ok(!second.some((seg) => seg.text === 'next' || seg.text.includes('Task 5')));
    assert.equal(first[1].text, 'FANKEEL BUILD');
});

test('no entry is no band', async () => {
    const m = await load();
    assert.equal(rows(m, null), null);
});

test('neither row is wider than the band, and a long title, next or question is cut', async () => {
    const m = await load();
    const long = Object.assign({}, entry, { task: '標題'.repeat(80), next: '下一步'.repeat(80) });
    for (const cols of [60, 79, 95]) {
        for (const gate of [null, '問題'.repeat(80)]) {
            const band = rows(m, long, [other], gate, cols);
            for (const row of band) assert.ok(used(row) <= cols, cols + ' < ' + used(row));
            assert.ok(band[0][band[0].length - 1].text.endsWith('…'));
            assert.ok(band[1][2].text.endsWith('…'));
        }
    }
});
