'use strict';
// Video: assets/station/tour-reel.js — the kinetic promo, 3600 frames, 30
// bars at 120 BPM: hook, logo, route, the seven stages two bars each, clash,
// numbers, outro, every shot starting on a bar line. Every frame a pure
// function of its number, in either language, every string of its own
// table inside its box.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/station/tour.js');
const { TOUR_REEL, S } = require('../assets/station/tour-reel.js');
const K = require('../assets/station/tour-reel-kit.js');
const ST = require('../assets/station/tour-reel-stages.js');
const { fakeCtx, sweep } = require('./tour-ctx.js');

const STARTS = [0, 240, 480, 720, 960, 1200, 1440, 1680, 1920, 2160, 2400, 2760, 3120];
const NAMES = ['hook', 'logo', 'route', 'survey', 'design', 'plan', 'build', 'verify', 'audit', 'land', 'clash', 'numbers', 'outro'];

function shot(f, P) {
    const ctx = fakeCtx();
    T.render(ctx, 'reel', f, P ? { palette: P } : undefined);
    return ctx;
}

test('reel is registered: 3600 frames, thirteen shots each starting on a bar line', () => {
    assert.equal(T.get('reel'), TOUR_REEL);
    assert.equal(T.length('reel'), 3600);
    assert.deepEqual(T.check(TOUR_REEL), []);
    assert.deepEqual(TOUR_REEL.beats.map((b) => b.at), STARTS);
    assert.deepEqual(TOUR_REEL.beats.map((b) => b.label), NAMES);
    TOUR_REEL.beats.forEach((b) => assert.equal(b.at % 120, 0, b.label));
    assert.equal(TOUR_REEL.beats.filter((b) => b.stage).length, 7);
    assert.equal(TOUR_REEL.strings, S);
});

test('tour-reel-kit and tour-reel-stages export the pieces the shots share', () => {
    assert.equal(K.S, S);
    assert.equal(typeof K.t, 'function');
    assert.equal(typeof K.rnd, 'function');
    assert.equal(typeof K.inOut, 'function');
    assert.equal(typeof K.decay, 'function');
    assert.equal(typeof K.hex, 'function');
    assert.equal(typeof K.field, 'function');
    assert.equal(typeof K.shake, 'function');
    assert.equal(typeof K.word, 'function');
    assert.equal(typeof K.wipeText, 'function');
    assert.equal(typeof K.popText, 'function');
    assert.equal(typeof K.ring, 'function');
    assert.equal(typeof K.burst, 'function');
    assert.equal(typeof K.flood, 'function');
    assert.equal(typeof K.stageFrame, 'function');
    assert.equal(typeof K.PX, 'number');
    assert.equal(typeof K.PY, 'number');
    assert.equal(ST.SHOTS.length, 7);
});

test('the cues: a hit on every shot, a pluck on beats only, in order', () => {
    assert.deepEqual(TOUR_REEL.cues.cuts, STARTS);
    const b = TOUR_REEL.cues.blocks;
    assert.ok(b.length >= 60, b.length + ' blocks');
    b.forEach((f, i) => {
        assert.equal(f % 30, 0, 'block at ' + f);
        assert.ok(f >= 0 && f < 3600 && (i === 0 || f > b[i - 1]), 'block at ' + f);
    });
});

test('each stage shot names its stage and says what it produces', () => {
    for (const lang of ['zh', 'en']) {
        const P = T.palette(() => '', lang);
        T.ROUTE.forEach((s, i) => {
            // Joined with the spaces taken out: a wrapped line drops the one
            // it broke at.
            const bare = (x) => x.replace(/\s+/g, '');
            const t = bare(shot(STARTS[i + 3] + 120, P).texts().join(''));
            assert.ok(t.includes(s), lang + ' ' + s + ': ' + t);
            assert.ok(t.includes(bare(S['what.' + s][lang])), lang + ' ' + s);
            assert.ok(t.includes(bare(S['pr.' + s][lang])), lang + ' ' + s);
        });
    }
});

test('the picture moves: no two frames half a beat apart draw the same calls', () => {
    for (let f = 0; f + 15 < 3600; f += 15) {
        assert.notEqual(JSON.stringify(shot(f).calls), JSON.stringify(shot(f + 15).calls), 'frames ' + f + ' and ' + (f + 15));
    }
});

test('a frame draws the same calls whichever frames were drawn before it', () => {
    for (const f of TOUR_REEL.stills) {
        const cold = JSON.stringify(shot(f).calls);
        shot(3599);
        shot(0);
        shot(f + 233);
        assert.equal(JSON.stringify(shot(f).calls), cold, 'frame ' + f);
    }
});

test('every string, in both languages, is drawn through fit and keeps to its box; no frame draws a number that is not finite', () => {
    for (const lang of ['zh', 'en']) {
        const P = T.palette(() => '', lang);
        const frames = [];
        for (let f = 0; f < 3600; f += 3) frames.push(f, f + 0.5);
        const r = sweep(T, frames, (ctx, f) => T.render(ctx, 'reel', f, { palette: P }));
        const over = [...new Set(r.log.filter((e) => e.over).map((e) => e.s))];
        assert.deepEqual(over, [], lang + ' overflows');
        assert.deepEqual(r.monoWide, [], lang + ' mono face');
        assert.deepEqual(r.nonFinite, [], lang + ' not finite');
        const drawn = r.log.map((e) => e.s).join('\n');
        const missing = Object.keys(S).filter((k) => !drawn.includes(S[k][lang].trim()));
        assert.deepEqual(missing, [], lang + ' never drawn through fit');
    }
});

test('the outro ends on the install line, the tagline and the name', () => {
    const zh = shot(3590).texts().join('\n');
    assert.ok(zh.includes('claude plugin install fankeel@fankeel'), zh);
    assert.ok(zh.includes(S['outro.tag'].zh), zh);
    assert.ok(zh.includes('fankeel'), zh);
});
