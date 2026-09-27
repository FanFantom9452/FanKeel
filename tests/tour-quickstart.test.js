'use strict';
// Video 1 (assets/station/tour-quickstart.js): its beats are the storyboard's,
// every frame is a pure function of its number, and the numbers it prints are
// the real session's as tourEngine.SESSION carries them.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/station/tour.js');
const { QUICKSTART } = require('../assets/station/tour-quickstart.js');
const { fakeCtx } = require('./tour-ctx.js');

function shot(f) {
    const ctx = fakeCtx();
    T.render(ctx, 'quickstart', f);
    return ctx;
}

test('quickstart is registered: 1800 frames, four beats where the storyboard puts them', () => {
    assert.equal(T.get('quickstart'), QUICKSTART);
    assert.equal(T.length('quickstart'), 1800);
    assert.deepEqual(T.check(QUICKSTART), []);
    assert.deepEqual(QUICKSTART.beats.map((b) => [b.at, b.label, b.stage || null]),
        [[240, 'pick', null], [600, 'survey', 'survey'], [1020, 'gate', 'design'], [1500, 'land', 'land']]);
    assert.deepEqual(QUICKSTART.stills, [330, 720, 1140, 1620]);
});

test('a frame draws the same calls whichever frames were drawn before it', () => {
    for (const f of QUICKSTART.stills) {
        const cold = JSON.stringify(shot(f).calls);
        shot(1799);
        shot(0);
        shot(f + 37);
        assert.equal(JSON.stringify(shot(f).calls), cold, 'frame ' + f);
    }
});

test('no frame or half frame draws with a number that is not finite', () => {
    for (let f = 0; f < 1800; f += 7) {
        for (const g of [f, f + 0.5]) {
            const bad = shot(g).calls.flat().filter((x) => typeof x === 'number' && !Number.isFinite(x));
            assert.deepEqual(bad, [], 'frame ' + g);
        }
    }
});

test('the command types one character every six frames from frame 30', () => {
    assert.ok(shot(29).texts().includes('> '));
    assert.ok(shot(30).texts().includes('> /'));
    assert.ok(shot(77).texts().includes('> /fankeel'));
});

test('the stills print the session\'s numbers', () => {
    assert.ok(shot(720).texts().includes('6m22s'));
    assert.ok(shot(1140).texts().includes('waited 3m21s'));
    const end = shot(1620).texts();
    for (const s of ['Route complete', '2h 07m', '$53.87', '42', '8m 44s', 'merged locally · not pushed', '[FANKEEL:LAND]', '7/7']) {
        assert.ok(end.includes(s), s + ' missing from frame 1620: ' + end.join(' | '));
    }
    assert.deepEqual(['6m', '6m', '43m', '13m', '11m', '7m'].filter((s) => !end.includes(s)), []);
});

test('the counters start from zero', () => {
    const t = shot(1575).texts();
    assert.ok(t.includes('$0.00') && t.includes('0m 00s') && t.includes('0'), t.join(' | '));
});
