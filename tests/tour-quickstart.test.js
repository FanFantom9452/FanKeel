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

test('quickstart is registered: 3480 frames, four beats where the storyboard puts them', () => {
    assert.equal(T.get('quickstart'), QUICKSTART);
    assert.equal(T.length('quickstart'), 3480);
    assert.deepEqual(T.check(QUICKSTART), []);
    assert.deepEqual(QUICKSTART.beats.map((b) => [b.at, b.label, b.stage || null]),
        [[0, 'pick', null], [840, 'survey', 'survey'], [1440, 'gate', 'design'], [3120, 'land', 'land']]);
    assert.deepEqual(QUICKSTART.stills, [450, 800, 1380, 1680, 2580, 2940, 3240, 3460]);
});

test('a frame draws the same calls whichever frames were drawn before it', () => {
    for (const f of QUICKSTART.stills) {
        const cold = JSON.stringify(shot(f).calls);
        shot(3479);
        shot(0);
        shot(f + 37);
        assert.equal(JSON.stringify(shot(f).calls), cold, 'frame ' + f);
    }
});

test('no frame or half frame draws with a number that is not finite', () => {
    for (let f = 0; f < 3480; f += 7) {
        for (const g of [f, f + 0.5]) {
            const bad = shot(g).calls.flat().filter((x) => typeof x === 'number' && !Number.isFinite(x));
            assert.deepEqual(bad, [], 'frame ' + g);
        }
    }
});

test('claude is typed one character every six frames from frame 520', () => {
    assert.ok(!shot(519).texts().some((s) => s.startsWith('c')));
    assert.ok(shot(520).texts().includes('c'));
    assert.ok(shot(550).texts().includes('claude'));
});

// The three criteria the design's row set out: the survey beat draws the
// real lead line (not the old `[FANKEEL:SURVEY]` chip), the clash beat's
// lead carries the collision flag, and the land beat's lead shows all five
// of this session's route dots lit.
test('the survey beat draws the real lead line, not a status chip', () => {
    const t = shot(1380).texts();
    assert.ok(t.some((s) => s.includes('▌FANKEEL')), t.join(' | '));
});

test('the clash beat flags the collision on the lead line', () => {
    const t = shot(2940).texts();
    assert.ok(t.some((s) => s.includes('⚑1')), t.join(' | '));
});

test('the land beat lights all five of this route\'s dots', () => {
    const t = shot(3240).texts();
    assert.ok(t.some((s) => s.includes('●●●●●')), t.join(' | '));
});

test('the land beat\'s ctx percentage is computed from SESSION, not a separate hardcoded figure', () => {
    const t = shot(3240).texts();
    const pct = Math.round(T.SESSION.agents) + '%';
    assert.ok(t.some((s) => s.includes('ctx') && s.includes(pct)), t.join(' | '));
    // the same source number is what the summary row already prints, as "{n} 個 agent"
    assert.ok(t.some((s) => s.includes(Math.round(T.SESSION.agents) + ' 個 agent')), t.join(' | '));
});

test('the stills print the session\'s numbers', () => {
    const build = shot(2580).texts();
    assert.ok(build.some((s) => s.includes(T.fmtMin(T.SESSION.clock.build))), build.join(' | '));
    assert.ok(build.some((s) => s.includes(T.fmtMin(T.SESSION.clock.verify))), build.join(' | '));
    assert.ok(build.some((s) => s.includes('VERIFY')), build.join(' | '));

    const land = shot(3240).texts();
    for (const s of [T.fmtSpan(T.SESSION.total), T.fmtUsd(T.SESSION.usd), String(Math.round(T.SESSION.agents)),
        '在本機合併，沒有 push']) {
        assert.ok(land.some((t) => t.includes(s)), s + ' missing from frame 3240: ' + land.join(' | '));
    }
});

test('the gate beat crosses the lead from SURVEY to DESIGN at frame 1800', () => {
    assert.ok(shot(1799).texts().some((s) => s.includes('▌FANKEEL SURVEY')));
    assert.ok(shot(1800).texts().some((s) => s.includes('▌FANKEEL DESIGN')));
});

// Fix round 2, item 2: each of the gate's three options gets its own
// description line underneath. Red when: the description texts are dropped
// (e.g. reverting GATE back to a flat array of strings).
test('the gate beat prints a description line under each numbered option', () => {
    const t = shot(1680).texts();
    assert.ok(t.some((s) => s.includes('先寫做法') && s.includes('同意了再動手')), t.join(' | '));
    assert.ok(t.some((s) => s.includes('做法已經清楚')), t.join(' | '));
    assert.ok(t.some((s) => s.includes('改動很小')), t.join(' | '));
});

// Fix round 2, item 1: land opens on a short scrollback (rejected edit,
// the other session finishing, the re-applied edit, a green suite) before
// the merge line — never all at once, and never after the merge. Red when:
// the scrollback lines are removed, or shown at/after EV.mergeAt.
test('the land beat shows its scrollback before the merge line, not with or after it', () => {
    const before = shot(3170).texts();
    assert.ok(before.some((s) => s.includes('User rejected update to app/report.js')), before.join(' | '));
    assert.ok(before.some((s) => s.includes('另一個 session 收工了')), before.join(' | '));
    assert.ok(before.some((s) => s.includes('Updated app/report.js with 1 addition')), before.join(' | '));
    assert.ok(before.some((s) => s.includes('tests 52') && s.includes('pass 52')), before.join(' | '));
    assert.ok(!before.some((s) => s.includes('git merge')), before.join(' | '));

    const after = shot(3176).texts();
    assert.ok(after.some((s) => s.includes('git merge')), after.join(' | '));
});

// Fix round 2, item 3: each split pane in the clash beat clips its own
// content so a long lead line (with the ⚑ badge) cannot bleed across the
// split boundary into the other pane. Red when: the clip() calls are
// removed from the split-pane drawing.
test('the clash beat clips both split panes before drawing their lead lines', () => {
    const calls = shot(2940).calls;
    const clips = calls.filter((c) => c[0] === 'clip').length;
    assert.equal(clips, 2, JSON.stringify(calls.filter((c) => c[0] === 'clip' || c[0] === 'save')));
});
