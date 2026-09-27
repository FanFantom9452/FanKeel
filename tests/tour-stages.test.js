'use strict';
// Video 2 (assets/station/tour-stages.js): one beat per stage of lib/stages.js
// in route order, each stage's line its STAGES[].produces word for word, every
// frame a pure function of its number, and the outro the quick start's session.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/station/tour.js');
const { TOUR_STAGES, PRODUCES } = require('../assets/station/tour-stages.js');
const { STAGES } = require('../lib/stages.js');
const { fakeCtx } = require('./tour-ctx.js');

function shot(f) {
    const ctx = fakeCtx();
    T.render(ctx, 'stages', f);
    return ctx;
}

test('stages is registered: 8100 frames, a beat per stage of lib/stages.js and one for the end', () => {
    assert.equal(T.get('stages'), TOUR_STAGES);
    assert.equal(T.length('stages'), 8100);
    assert.deepEqual(T.check(TOUR_STAGES), []);
    assert.deepEqual(TOUR_STAGES.beats.map((b) => b.label), STAGES.map((s) => s.name).concat(['end']));
    assert.deepEqual(TOUR_STAGES.beats.map((b) => b.at), [300, 1260, 2220, 3180, 4140, 5100, 6060, 7020]);
    TOUR_STAGES.beats.slice(0, 7).forEach((b) => assert.equal(b.stage, b.label));
    assert.deepEqual(TOUR_STAGES.stills, [700, 1650, 2600, 3560, 4520, 5480, 6440, 7560]);
});

test('each stage\'s line is its STAGES[].produces, word for word, drawn in its scene', () => {
    assert.deepEqual(PRODUCES, STAGES.map((s) => s.produces));
    STAGES.forEach((s, i) => {
        const t = shot(300 + 960 * i + 800).texts();
        assert.ok(t.includes(s.name), s.name);
        assert.ok(t.includes('→ ' + s.produces), s.name + ': ' + t.join(' | '));
    });
});

test('a frame draws the same calls whichever frames were drawn before it', () => {
    for (const f of TOUR_STAGES.stills) {
        const cold = JSON.stringify(shot(f).calls);
        shot(8099);
        shot(0);
        shot(f + 481);
        assert.equal(JSON.stringify(shot(f).calls), cold, 'frame ' + f);
    }
});

test('no frame or half frame draws with a number that is not finite', () => {
    for (let f = 0; f < 8100; f += 7) {
        for (const g of [f, f + 0.5]) {
            const bad = shot(g).calls.flat().filter((x) => typeof x === 'number' && !Number.isFinite(x));
            assert.deepEqual(bad, [], 'frame ' + g);
        }
    }
});

test('the outro prints the same session as the quick start', () => {
    const t = shot(7560).texts();
    for (const s of ['One real task, start to land', '2h 07m', '$53.87', '42', '6m', '43m', '13m', '11m', '7m']) {
        assert.ok(t.includes(s), s + ' missing from frame 7560: ' + t.join(' | '));
    }
});
