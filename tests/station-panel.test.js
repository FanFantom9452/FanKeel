'use strict';
// The detail panel's pure builders: which sections start open, the context
// line, its rises, and the stage order. The panel itself is DOM and is checked
// against the served page; every number and string it prints is decided here.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const count = (s, re) => (s.match(re) || []).length;

test('a live session opens on who and where, an ended one on what it cost, and neither opens the replay', () => {
    assert.deepEqual(V.openSections({ state: 'live' }), ['s-sum', 's-claims']);
    assert.deepEqual(V.openSections({ state: 'down' }), ['s-ctx', 's-disp']);
    assert.deepEqual(V.openSections({ state: 'stale' }), ['s-ctx', 's-disp']);
    for (const s of ['live', 'down', 'stale']) assert.ok(!V.openSections({ state: s }).includes('s-rp'));
});

test('downsample keeps at most max points, and the peak is one of them', () => {
    const pts = Array.from({ length: 1000 }, (_, i) => ({ n: i + 1, t: i, y: i === 777 ? 99999 : i % 50 }));
    const out = V.downsample(pts, 240);
    assert.equal(out.length, 240);
    assert.ok(out.some((p) => p.y === 99999));
    assert.equal(V.downsample(pts.slice(0, 10), 240).length, 10);
});

test('lineChart draws one line, a line per stage mark, a dot per dispatch out and back, a number per rise', () => {
    const svg = V.lineChart([{ n: 1, t: 0, y: 10 }, { n: 2, t: 10, y: 50 }, { n: 3, t: 20, y: 30 }], {
        t0: 0, t1: 20, ymax: 100,
        marks: [{ t: 0, kind: 'start', stage: 'survey' }, { t: 10, kind: 'stage', stage: 'build' }],
        dots: [{ t: 5, kind: 'out' }, { t: 15, kind: 'back' }],
        rises: [{ n: 2, t: 10, y1: 50 }],
    });
    assert.equal(count(svg, /class="ln"/g), 1, 'one series');
    assert.equal(count(svg, /class="bd /g), 2);
    assert.equal(count(svg, /class="dout"/g), 1);
    assert.equal(count(svg, /class="dback"/g), 1);
    assert.equal(count(svg, /<g class="rb">/g), 1);
    assert.equal(count(svg, /class="hit"/g), 3, 'every point carries its own reading');
});

const rise = { n: 2, from: 1, t: 10, y0: 10, y1: 5000, dy: 4990, cause: 'in', self: { tok: 3, label: '上一回應的文字' },
    top: [{ k: 'tool', label: 'Read a/b.md', chars: 4321 }], restN: 2, restChars: 15, inChars: 4336 };

test('riseText names an arrival by its characters and the model\'s own output by its tokens', () => {
    assert.equal(V.riseText(rise), 'Read a/b.md 4,321 字元；另 2 項 15 字元');
    assert.equal(V.riseText(Object.assign({}, rise, { cause: 'self', self: { tok: 12000, label: '上一回應寫的 Write x.md' } })),
        '上一回應寫的 Write x.md，輸出 12,000 tokens');
});

test('ctxSection prints the points and the no-time count against the requests, and lists the rises', () => {
    const x = { points: [{ n: 1, t: 0, y: 10 }, { n: 3, t: 10, y: 5000 }], noTime: 1, requests: 3, peak: 5000, peakN: 3,
        marks: [], dispatches: [{ out: 2, back: 8, text: 'Review' }], rises: [rise] };
    const html = V.ctxSection({ id: 'abcdef1234' }, x);
    assert.match(html, /折線 <b>2 點<\/b> ＋ 1 requests with no time ＝ 摘要的 3 requests <span class="eq">一致/);
    assert.match(html, /<ol class="rz"/);
    assert.equal(count(html, /<li>/g), 1);
    assert.match(V.ctxSection({ id: 'x' }, Object.assign({}, x, { requests: 4 })), /class="ne">不一致/);
});

test('seqHtml marks a backward step and dots a stage not taken from a command; orderSection names its source', () => {
    const seq = [{ stage: 'survey', at: 0, source: 'clock' }, { stage: 'build', at: 1, source: 'cmd' },
        { stage: 'verify', at: 2, source: 'cmd' }, { stage: 'build', at: 3, source: 'cmd' }];
    const backs = [{ i: 3, from: 'verify', to: 'build', at: 3, since: 2 }];
    const html = V.seqHtml(seq, backs, ['survey', 'build', 'verify', 'land'], 'build', true);
    assert.equal(count(html, /class="ar bk"/g), 1);
    assert.equal(count(html, /class="s fb"/g), 1);
    assert.equal(count(html, /class="s todo"/g), 2, 'a live session shows the stages still ahead');
    const order = V.orderSection({ id: 'x', route: ['survey', 'build', 'verify', 'land'], stage: 'land', state: 'down' },
        { seq, backs, backtracks: 1, seqSource: 'task.js' });
    assert.match(order, /transcript 裡真正執行的 task\.js 指令；倒退 1 次/);
    assert.equal(count(order, /class="bkl"/g), 1);
});
