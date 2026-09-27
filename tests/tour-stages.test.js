'use strict';
// Video: assets/station/tour-stages.js — the 3600-frame promo. A 240-frame
// hook, the seven stages 408 frames each (illustrated scene sped up, then a
// terminal cut), and a 504-frame outro. Every frame a pure function of its
// number.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/station/tour.js');
const { TOUR_STAGES, PRODUCES } = require('../assets/station/tour-stages.js');
const { STAGES } = require('../lib/stages.js');
const { fakeCtx } = require('./tour-ctx.js');

const INTRO = 240, PER = 408, OUTRO = INTRO + PER * T.ROUTE.length; // 3096

function shot(f) {
    const ctx = fakeCtx();
    T.render(ctx, 'stages', f);
    return ctx;
}

test('stages is registered: 3600 frames, a beat per stage of lib/stages.js and one for the end', () => {
    assert.equal(T.get('stages'), TOUR_STAGES);
    assert.equal(T.length('stages'), 3600);
    assert.deepEqual(T.check(TOUR_STAGES), []);
    assert.deepEqual(TOUR_STAGES.beats.map((b) => b.label), STAGES.map((s) => s.name).concat(['end']));
    assert.deepEqual(TOUR_STAGES.beats.map((b) => b.at), [240, 648, 1056, 1464, 1872, 2280, 2688, 3096]);
    TOUR_STAGES.beats.slice(0, 7).forEach((b) => assert.equal(b.stage, b.label));
});

test('each stage\'s line is its STAGES[].produces, word for word, drawn in its illustrated scene', () => {
    assert.deepEqual(PRODUCES, STAGES.map((s) => s.produces));
    STAGES.forEach((s, i) => {
        // local 280 of the 300-frame illustrated portion: scaled 3x, that is
        // old-local 840 — past the 720 the produces line fades in at.
        const t = shot(INTRO + PER * i + 280).texts();
        assert.ok(t.includes(s.name), s.name);
        assert.ok(t.includes('→ ' + s.produces), s.name + ': ' + t.join(' | '));
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

// Criterion: each stage's terminal-cut frame draws `▌FANKEEL <STAGE>` with
// that stage's own name in the lead line. Red when: `lead()`'s stage word is
// hardcoded (e.g. always 'SURVEY') instead of taking the block's own `i`.
test('each stage\'s terminal cut draws its own stage in the lead line, after the crossing', () => {
    T.ROUTE.forEach((s, i) => {
        // local 350 of the 408-frame block = terminal-cut local 50, well past
        // the 6-frame crossing.
        const t = shot(INTRO + PER * i + 350).texts();
        assert.ok(t.some((x) => x.includes('▌FANKEEL ' + s.toUpperCase())), s + ': ' + t.join(' | '));
    });
});

// Criterion: the land stage's terminal cut draws seven filled route dots.
// Red when: the close-up's `step` is anything less than the full route
// length (e.g. left at 6, one behind).
test('the land stage\'s terminal-cut close-up shows all seven route dots filled', () => {
    // land's block starts at INTRO + PER*6; its close-up runs from local 372.
    const t = shot(INTRO + PER * 6 + 380).texts();
    assert.ok(t.some((x) => x.includes('●●●●●●●')), t.join(' | '));
});

// Criterion: the outro draws the install line and the tagline. Red when:
// either string is dropped or split across draws so no single fillText
// carries it whole.
test('the outro draws the install command and the tagline', () => {
    const install = shot(OUTRO + 130).texts();
    assert.ok(install.includes('claude plugin install fankeel@fankeel'), install.join(' | '));

    const tag = shot(OUTRO + 250).texts();
    assert.ok(tag.includes('claude plugin install fankeel@fankeel'), tag.join(' | '));
    assert.ok(tag.includes('跟 AI 開發得再久，也不堆過時的引用和死程式。'), tag.join(' | '));
});

// Artefact/consistency check: in each stage block, the stage name drawn in
// the terminal cut's lead line equals the stage whose illustrated scene
// immediately precedes it in that same block — one route, drawn in two
// places, never disagreeing. Red when: the terminal cut is wired to a
// different index than the illustrated scene beside it (e.g. `ROUTE[i]` in
// one place and `ROUTE[i - 1]` or a fixed index in the other).
test('the terminal cut\'s stage matches the illustrated scene\'s stage in the same block', () => {
    T.ROUTE.forEach((s, i) => {
        const start = INTRO + PER * i;
        const illustrated = shot(start + 280).texts();
        assert.ok(illustrated.includes(s), 'scene missing its own stage name: ' + s);
        const terminal = shot(start + 350).texts();
        assert.ok(terminal.some((x) => x.includes('▌FANKEEL ' + s.toUpperCase())),
            'terminal cut disagrees with its own block\'s scene (' + s + '): ' + terminal.join(' | '));
    });
});
