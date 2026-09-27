'use strict';
// The tour's engine (assets/station/tour.js): easing endpoints, the beat
// lookup and its independence from visiting order, the timeline check, the
// renderer's one-draw and ten-draw paths, the session numbers as the frames
// print them, and every drawing helper — through tests/tour-ctx.js, a context
// that records instead of drawing. Pixels are out of reach in Node; the calls
// that would make them are not.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/station/tour.js');
const { fakeCtx, fakeCanvas } = require('./tour-ctx.js');
const { FULL_ROUTE } = require('../lib/stages.js');

const FIXTURE = {
    length: 100,
    beats: [{ at: 10, label: 'a' }, { at: 40, label: 'b', stage: 'design' }, { at: 70, label: 'c' }],
    stills: [50],
    draw() {},
};
const kinds = (ctx) => ctx.calls.map((c) => c[0]);

test('the constants the frames and the recorder share', () => {
    assert.equal(T.W, 640);
    assert.equal(T.H, 360);
    assert.equal(T.FPS, 60);
    assert.equal(T.SUBFRAMES, 10);
    assert.deepEqual(T.ROUTE, FULL_ROUTE);
});

test('every easing starts at 0, ends at 1, and clamps outside', () => {
    for (const f of [T.expoOut, T.expoIn, T.backOut, T.bounceOut]) {
        assert.equal(f(0), 0, f.name + '(0)');
        assert.equal(f(1), 1, f.name + '(1)');
        assert.equal(f(-1), 0, f.name + '(-1)');
        assert.equal(f(2), 1, f.name + '(2)');
    }
});

test('backOut overshoots by about ten percent; bounceOut rebounds once', () => {
    const grid = Array.from({ length: 1001 }, (_, i) => i / 1000);
    const peak = Math.max(...grid.map(T.backOut));
    assert.ok(peak > 1.09 && peak < 1.11, 'backOut peak ' + peak);
    const b = grid.map(T.bounceOut);
    let minima = 0;
    for (let i = 1; i < b.length - 1; i++) if (b[i] < b[i - 1] && b[i] <= b[i + 1]) minima++;
    assert.equal(minima, 1);
    assert.ok(Math.min(...b.slice(400)) >= 0.75 - 1e-9);
});

test('math helpers clamp, interpolate and measure progress', () => {
    assert.equal(T.clamp01(-1), 0);
    assert.equal(T.clamp01(2), 1);
    assert.equal(T.lerp(10, 20, 0.5), 15);
    assert.equal(T.prog(15, 10, 10), 0.5);
    assert.equal(T.prog(5, 10, 10), 0);
    assert.equal(T.prog(25, 10, 10), 1);
});

test('beatAt finds the last beat started, -1 before the first', () => {
    assert.deepEqual([0, 9, 10, 39, 40, 69, 70, 99].map((f) => T.beatAt(FIXTURE, f)), [-1, -1, 0, 0, 1, 1, 2, 2]);
    assert.equal(T.beatAt(FIXTURE, 39.9), 0);
});

test('beatAt answers the same however the frames before it were visited', () => {
    const frames = Array.from({ length: 100 }, (_, i) => i);
    const forward = frames.map((f) => T.beatAt(FIXTURE, f));
    const order = frames.slice().reverse()
        .concat(frames.filter((f) => f % 3 === 0), frames.filter((f) => f % 3 !== 0));
    const seen = new Map();
    for (const f of order) {
        const b = T.beatAt(FIXTURE, f);
        if (seen.has(f)) assert.equal(b, seen.get(f), 'frame ' + f);
        seen.set(f, b);
    }
    assert.deepEqual(frames.map((f) => seen.get(f)), forward);
});

test('stepBeat walks beat starts and stops at the ends', () => {
    assert.equal(T.stepBeat(FIXTURE, 45, 1), 70);
    assert.equal(T.stepBeat(FIXTURE, 45, -1), 40);
    assert.equal(T.stepBeat(FIXTURE, 40, -1), 10);
    assert.equal(T.stepBeat(FIXTURE, 80, 1), 99);
    assert.equal(T.stepBeat(FIXTURE, 5, -1), 0);
});

test('clock prints m:ss.cc at 60 fps', () => {
    assert.equal(T.clock(1140), '0:19.00');
    assert.equal(T.clock(1800), '0:30.00');
    assert.equal(T.clock(3600), '1:00.00');
    assert.equal(T.clock(8100), '2:15.00');
    assert.equal(T.clock(1), '0:00.02');
});

test('check names what is wrong with a timeline, and nothing when it is well-formed', () => {
    assert.deepEqual(T.check(FIXTURE), []);
    const bad = { length: 50, beats: [{ at: 20, label: 'x' }, { at: 10, label: 'y' }, { at: 60, label: '' }], stills: [70] };
    const out = T.check(bad);
    const has = (re) => assert.ok(out.some((m) => re.test(m)), re + ' not in:\n' + out.join('\n'));
    has(/no draw function/);
    has(/beat 1 \(y\) does not start after beat 0/);
    has(/beat 2 \(\) at 60 is outside 0\.\.49/);
    has(/beat 2 has no label/);
    has(/still 70 is outside the timeline/);
});

test('register refuses a malformed timeline; get, names and length read the registry', () => {
    assert.throws(() => T.register('broken', { length: 10, beats: [], draw() {} }), /tour: timeline broken: no beats/);
    T.register('fixture', FIXTURE);
    assert.equal(T.get('fixture'), FIXTURE);
    assert.ok(T.names().includes('fixture'));
    assert.equal(T.length('fixture'), 100);
    assert.throws(() => T.get('nope'), /tour: no timeline named nope/);
});

test('render draws once, scaled from 640x360 onto the canvas, over the ground', () => {
    const seen = [];
    T.register('probe', { length: 20, beats: [{ at: 0, label: 'p' }], draw(ctx, f, P) { seen.push([f, P]); } });
    const ctx = fakeCtx(1280, 720);
    assert.equal(T.render(ctx, 'probe', 5), 1);
    assert.deepEqual(seen.map((s) => s[0]), [5]);
    assert.equal(seen[0][1], T.DARK);
    assert.deepEqual(ctx.calls.find((c) => c[0] === 'setTransform'), ['setTransform', 2, 0, 0, 2, 0, 0]);
    assert.deepEqual(ctx.calls.find((c) => c[0] === 'fillRect'), ['fillRect', 0, 0, 640, 360]);
    assert.ok(ctx.calls.some((c) => c[0] === '=fillStyle' && c[1] === T.DARK.ground));
});

test('render with blur averages ten sub-frames: f + i/10, each laid over at 1/(i+1)', () => {
    const seen = [];
    T.register('blurred', { length: 20, beats: [{ at: 0, label: 'p' }], draw(ctx, f) { seen.push(f); } });
    const ctx = fakeCtx(1280, 720);
    let made = 0;
    const n = T.render(ctx, 'blurred', 5, { blur: true, makeCanvas: () => { made++; return fakeCanvas(); } });
    assert.equal(n, T.SUBFRAMES);
    assert.equal(made, 1);
    assert.deepEqual(seen, Array.from({ length: 10 }, (_, i) => 5 + i / 10));
    assert.equal(ctx.calls.filter((c) => c[0] === 'drawImage').length, 10);
    assert.deepEqual(ctx.calls.filter((c) => c[0] === '=globalAlpha').map((c) => c[1]),
        Array.from({ length: 10 }, (_, i) => 1 / (i + 1)).concat([1]));
});

test('palette reads each token and falls back to the dark theme for an empty one', () => {
    const P = T.palette((k) => (k === 'ink' ? '#ffffff' : k === 'st-land' ? '#00ff00' : ''));
    assert.equal(P.ink, '#ffffff');
    assert.equal(P.st.land, '#00ff00');
    assert.equal(P.ground, T.DARK.ground);
    assert.equal(P.st.survey, T.DARK.st.survey);
    assert.equal(P.fMono, T.DARK.fMono);
});

test('the session numbers print as the storyboard shows them', () => {
    const S = T.SESSION;
    assert.equal(T.fmtClock(S.clock.survey), '6m22s');
    assert.equal(T.fmtClock(S.waited.design), '3m21s');
    assert.equal(T.fmtClock(0), '0s');
    assert.equal(T.fmtSpan(S.total), '2h 07m');
    assert.equal(T.fmtSpan(T.ROUTE.reduce((a, s) => a + S.waited[s], 0)), '8m 44s');
    assert.equal(T.fmtSpan(0), '0m 00s');
    assert.equal(T.fmtUsd(S.usd), '$53.87');
    assert.equal(S.agents, 42);
    assert.deepEqual(S.land, { integration: 'merge', push: false });
    assert.deepEqual(T.ROUTE.map((s) => T.fmtMin(S.clock[s])), ['6m', '6m', '1m', '43m', '13m', '11m', '7m']);
});

test('text sets the class font and colour, then fills at the point', () => {
    const ctx = fakeCtx();
    T.text(ctx, T.DARK, 'h', 'survey', 40, 56, { fill: '#123456' });
    assert.ok(ctx.calls.some((c) => c[0] === '=font' && c[1] === '600 28px ' + T.DARK.fUi));
    assert.ok(ctx.calls.some((c) => c[0] === '=fillStyle' && c[1] === '#123456'));
    assert.deepEqual(ctx.calls.at(-1), ['fillText', 'survey', 40, 56]);
    T.text(ctx, T.DARK, 'm', 'x', 1, 2, { align: 'right', size: 19, weight: '600' });
    assert.ok(ctx.calls.some((c) => c[0] === '=font' && c[1] === '600 19px ' + T.DARK.fMono));
    assert.ok(ctx.calls.some((c) => c[0] === '=textAlign' && c[1] === 'right'));
});

test('shapes: rr, box, line and circle', () => {
    let ctx = fakeCtx();
    T.rr(ctx, 0, 0, 10, 10, 3);
    assert.equal(ctx.calls.filter((c) => c[0] === 'arcTo').length, 4);
    ctx = fakeCtx();
    T.box(ctx, 0, 0, 10, 10, 3, '#111111', '#222222', 2);
    assert.ok(kinds(ctx).includes('fill') && kinds(ctx).includes('stroke'));
    ctx = fakeCtx();
    T.box(ctx, 0, 0, 10, 10, 3, null, null);
    assert.ok(!kinds(ctx).includes('fill') && !kinds(ctx).includes('stroke'));
    ctx = fakeCtx();
    T.line(ctx, [[0, 0], [5, 5], [9, 0]], '#333333', 1, [3, 4]);
    assert.equal(ctx.calls.filter((c) => c[0] === 'lineTo').length, 2);
    assert.deepEqual(ctx.calls.filter((c) => c[0] === 'setLineDash').map((c) => c[1]), [[3, 4], []]);
    ctx = fakeCtx();
    T.circle(ctx, 0, 0, 0, '#111111');
    assert.deepEqual(ctx.calls, []);
});

test('tick draws the check to a fraction of its length', () => {
    let ctx = fakeCtx();
    T.tick(ctx, 0, 0, 1, 0, '#00ff00');
    assert.deepEqual(ctx.calls, []);
    ctx = fakeCtx();
    T.tick(ctx, 0, 0, 1, 1, '#00ff00');
    assert.deepEqual(ctx.calls.filter((c) => c[0] === 'lineTo').at(-1), ['lineTo', 15, -5]);
    ctx = fakeCtx();
    T.tick(ctx, 0, 0, 1, 0.2, '#00ff00');
    const end = ctx.calls.filter((c) => c[0] === 'lineTo').at(-1);
    assert.ok(Math.abs(end[1] - 3) < 1e-9 && Math.abs(end[2] - 3) < 1e-9, String(end));
});

test('dots fill, ring and hollow the seven stops; rail puts them on the line', () => {
    const ctx = fakeCtx();
    T.dots(ctx, T.DARK, 110, 70, 330, 6, 2, 1);
    const arcs = ctx.calls.filter((c) => c[0] === 'arc');
    assert.equal(arcs.length, 8);
    assert.deepEqual(arcs[2].slice(1, 4), [250, 330, 7.5]);
    assert.deepEqual(arcs[3].slice(1, 4), [250, 330, 11]);
    const r = fakeCtx();
    T.rail(r, T.DARK, 0, 1);
    assert.deepEqual(r.calls.find((c) => c[0] === 'moveTo'), ['moveTo', 110, 330]);
});

test('bars: seven widths fill the span; labels only on bars wide enough and grown past', () => {
    const R = T.barRects(80, 480);
    assert.equal(R.length, 7);
    assert.ok(Math.abs(R[6][0] + R[6][1] - 560) < 1e-9);
    const full = fakeCtx();
    T.bars(full, T.DARK, 80, 112, 480, 20, 152, 1);
    assert.deepEqual(full.texts(), ['6m', '6m', '43m', '13m', '11m', '7m']);
    const none = fakeCtx();
    T.bars(none, T.DARK, 80, 112, 480, 20, 152, 0);
    assert.deepEqual(none.calls, []);
});

test('fade draws nothing at zero and multiplies alpha inside', () => {
    let ran = false;
    const ctx = fakeCtx();
    T.fade(ctx, 0, () => { ran = true; });
    assert.equal(ran, false);
    assert.deepEqual(ctx.calls, []);
    T.fade(ctx, 0.5, () => { ran = true; assert.equal(ctx.globalAlpha, 0.5); });
    assert.equal(ran, true);
    assert.equal(ctx.globalAlpha, 1);
});
