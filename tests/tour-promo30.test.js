'use strict';
// promo30: 1800 frames, ten shots at the storyboard's boundaries, the seven
// stage shots in route order, and a statusline whose lit dots count the
// stage. Red when: a shot moves, a stage is out of order, a frame throws, or
// the chip disagrees with the stage it sits in.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/station/tour.js');
const { TOUR_PROMO30, S, dots, PILLS } = require('../assets/station/tour-promo30.js');
const { fakeCtx } = require('./tour-ctx.js');

const STARTS = [0, 180, 300, 450, 630, 750, 930, 1080, 1260, 1410];

test('promo30 is 1800 frames and its shots start where the storyboard says', () => {
    assert.equal(T.length('promo30'), 1800);
    assert.deepEqual(TOUR_PROMO30.cues.cuts, STARTS);
});

test('shots 3 to 9 are the seven stages in route order', () => {
    const stages = TOUR_PROMO30.beats.filter((b) => b.stage).map((b) => b.stage);
    assert.deepEqual(stages, T.ROUTE);
});

test('the lit dots at each stage shot\'s midpoint are its stage number', () => {
    for (let i = 0; i < 7; i++) {
        const mid = (STARTS[i + 2] + STARTS[i + 3]) / 2;
        assert.equal(dots(mid), i + 1, 'stage ' + T.ROUTE[i]);
    }
    assert.equal(dots(0), 0);
});

test('every fifth frame draws in both languages without throwing', () => {
    for (const lang of ['zh', 'en']) {
        const P = T.palette(() => '', lang);
        for (let f = 0; f < 1800; f += 5) T.render(fakeCtx(), 'promo30', f, { palette: P });
    }
});

test('the step pills are 01 survey to 07 land', () => {
    assert.deepEqual(PILLS, T.ROUTE.map((s, i) => '0' + (i + 1) + ' ' + s));
});

test('every string has zh and en', () => {
    for (const k of Object.keys(S)) assert.ok(S[k].zh && S[k].en, k);
});
