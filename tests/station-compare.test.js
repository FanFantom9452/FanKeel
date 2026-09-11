'use strict';
// 比較: two sessions' context lines on one y axis and one x length, and their
// figures side by side, each taken from the field their own panel prints.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');

const count = (s, re) => (s.match(re) || []).length;
const detail = (t0, peak, cents, back) => ({
    points: [{ n: 1, t: t0, y: 1000 }, { n: 2, t: t0 + 600000, y: peak }], noTime: 0, requests: 2, peak, peakN: 2,
    rows: cents.map((c) => ({ c })), agentsTotal: { cents: cents.reduce((a, b) => a + b, 0) }, backtracks: back,
    backs: back ? [{ i: 1, from: 'verify', to: 'build', at: t0 + 1, since: t0 }] : [],
    seq: [{ stage: 'verify', at: t0, source: 'cmd' }, { stage: 'build', at: t0 + 1, source: 'cmd' }], marks: [],
});
const a = { id: 'aaaaaaaa-1', task: 'before', route: ['survey', 'build', 'verify'], stage: 'verify', state: 'down' };
const b = { id: 'bbbbbbbb-2', task: 'after', route: ['survey', 'build', 'verify'], stage: 'verify', state: 'down' };

test('figures take the dispatch dollars from the rows and the backtracks from the stage order', () => {
    const f = V.figures(detail(0, 50000, [120, 30], 1));
    assert.deepEqual([f.peak, f.requests, f.cents, f.agentCents, f.back, f.t0, f.t1], [50000, 2, 150, 150, 1, 0, 600000]);
});

test('two charts, one line each, on one y axis and one x length; the table and both sequences follow', () => {
    const xa = detail(0, 50000, [120, 30], 1);
    const xb = Object.assign(detail(5e9, 180000, [10], 0), { points: [{ n: 1, t: 5e9, y: 1000 }, { n: 2, t: 5e9 + 1200000, y: 180000 }] });
    const html = V.compareHtml(a, xa, b, xb);
    assert.equal(count(html, /class="ln"/g), 2, 'two charts, each one series');
    assert.match(html, /共用 y 軸（0 到 200k）與 x 軸的長度（20m）/);
    assert.equal(count(html, /<text class="axis" x="[\d.]+" y="\d+" text-anchor="end">20m<\/text>/g), 2, 'both x axes end at the longer span');
    assert.match(html, /\$1\.50<span class="s2">＝ agentsOf\(\) \$1\.50/);
    assert.equal(count(html, /class="ar bk"/g), 1, 'the backward step shows in its own sequence');
});
