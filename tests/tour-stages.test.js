'use strict';
// Video: assets/station/tour-stages.js — the 3600-frame promo, 30 bars at
// 120 BPM. Eleven cuts of document blocks end to end, every one starting on
// a bar line; no terminal cut is left in the source. Every frame a pure
// function of its number, in either language, every string inside its box.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../assets/station/tour.js');
const D = require('../assets/station/tour-doc.js');
const { TOUR_STAGES } = require('../assets/station/tour-stages.js');
const { fakeCtx, sweep } = require('./tour-ctx.js');

const STARTS = [0, 240, 480, 840, 1200, 1560, 1920, 2280, 2640, 3000, 3240];
const NAMES = ['hook', 'route', 'survey', 'design', 'plan', 'build', 'verify', 'audit', 'land', 'clash', 'outro'];

function shot(f, P) {
    const ctx = fakeCtx();
    T.render(ctx, 'stages', f, P ? { palette: P } : undefined);
    return ctx;
}

// Criterion: eleven cuts, each starting on a multiple of 120, and no
// termCut in the source. Red when: the old 240 + 408i blocks or any of the
// terminal code are still there.
test('stages is registered: 3600 frames, eleven cuts each starting on a bar line', () => {
    assert.equal(T.get('stages'), TOUR_STAGES);
    assert.equal(T.length('stages'), 3600);
    assert.deepEqual(T.check(TOUR_STAGES), []);
    assert.deepEqual(TOUR_STAGES.beats.map((b) => b.at), STARTS);
    assert.deepEqual(TOUR_STAGES.beats.map((b) => b.label), NAMES);
    TOUR_STAGES.beats.forEach((b) => assert.equal(b.at % 120, 0, b.label));
    TOUR_STAGES.beats.filter((b) => T.ROUTE.includes(b.label)).forEach((b) => assert.equal(b.stage, b.label));
    assert.equal(TOUR_STAGES.beats.filter((b) => b.stage).length, 7);
});

test('the source keeps no terminal cut', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'tour-stages.js'), 'utf8');
    assert.doesNotMatch(src, /termCut/);
    assert.doesNotMatch(src, /landCloseup|vsCode|TERM\b|lead\(/);
});

// The score's cues: a hit on every cut, a pluck on every block, each block
// on a beat.
test('the cues are the cut starts and every block\'s beat, in order', () => {
    assert.deepEqual(TOUR_STAGES.cues.cuts, STARTS);
    const b = TOUR_STAGES.cues.blocks;
    assert.ok(b.length >= 50, b.length + ' blocks');
    b.forEach((f, i) => {
        assert.equal(f % 30, 0, 'block at ' + f);
        assert.ok(f >= 0 && f < 3600 && (i === 0 || f > b[i - 1]), 'block at ' + f);
    });
    STARTS.forEach((s) => assert.ok(b.includes(s), 'no block at the cut ' + s));
});

test('each cut draws its own page: the stage header in each stage\'s cut', () => {
    const P = T.palette(() => '', 'zh');
    T.ROUTE.forEach((s, i) => {
        const t = shot(STARTS[i + 2] + 100, P).texts();
        assert.ok(t.includes(s), s + ': ' + t.join(' | '));
        assert.ok(t.includes(D.S['pr.' + s].zh), s);
    });
});

test('a frame draws the same calls whichever frames were drawn before it', () => {
    for (const f of TOUR_STAGES.stills) {
        const cold = JSON.stringify(shot(f).calls);
        shot(3599);
        shot(0);
        shot(f + 233);
        assert.equal(JSON.stringify(shot(f).calls), cold, 'frame ' + f);
    }
});

test('no frame or half frame draws with a number that is not finite', () => {
    for (let f = 0; f < 3600; f += 7) {
        for (const g of [f, f + 0.5]) {
            const bad = shot(g).calls.flat().filter((x) => typeof x === 'number' && !Number.isFinite(x));
            assert.deepEqual(bad, [], 'frame ' + g);
        }
    }
});

// Criterion (design, What proves it done): every string of the table, in
// zh and in en, is measured with measureText and no wider than its box.
// Red when: a string is never drawn through fit, or one overflows.
test('every string, in both languages, is drawn through fit and keeps to its box', () => {
    for (const lang of ['zh', 'en']) {
        const P = T.palette(() => '', lang);
        const frames = [];
        for (let f = 0; f < 3600; f += 5) frames.push(f);
        const r = sweep(T, frames, (ctx, f) => T.render(ctx, 'stages', f, { palette: P }));
        const over = [...new Set(r.log.filter((e) => e.over).map((e) => e.s))];
        assert.deepEqual(over, [], lang + ' overflows');
        assert.deepEqual(r.monoWide, [], lang + ' mono face');
        const drawn = r.log.map((e) => e.s).join('\n');
        const missing = Object.keys(D.S).filter((k) => !drawn.includes(D.S[k][lang].trim()));
        assert.deepEqual(missing, [], lang + ' never drawn through fit');
    }
});

test('the outro ends on the install lines and the tagline, in either language', () => {
    const zh = shot(3590).texts();
    assert.ok(zh.includes('claude plugin install fankeel@fankeel'), zh.join(' | '));
    assert.ok(zh.includes('跟 AI 開發得再久，也不堆過時的引用和死程式。'), zh.join(' | '));
    const en = shot(3590, T.palette(() => '', 'en')).texts();
    assert.ok(en.join(' ').includes('without piling up stale references and dead code.'), en.join(' | '));
});
