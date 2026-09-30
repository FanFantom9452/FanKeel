'use strict';
// promo30v5: the 74-second guided tour. What the frames say (caption per
// beat, the header glyph's locks), what they no longer draw (rail, pills,
// statusline), the header divider's place, the v2/v3/v4 films left as they
// were, and the player waiting for the timeline's own `ready`.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../assets/station/tour.js');
require('../assets/station/tour-keel.js');
const { TOUR_PROMO30V5: V5 } = require('../assets/station/tour-ring.js');
const K = require('../assets/station/tour-reel-kit.js');
const { fakeCtx, sweep } = require('./tour-ctx.js');

const STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
// Every beat's caption key, written out here and not derived from the
// timeline, so a swap inside the timeline shows.
const CAPTION = {
    'hook-1': 'cap.bigger', 'hook-2': 'cap.grow', 'hook-3': 'cap.docs', 'hook-4': 'cap.orphan', 'hook-5': 'cap.grep', 'hook-6': 'cap.readall',
    'intro': 'logo.tag', 'intro-dock': 'logo.tag',
    'survey-problem': 'prob.survey', 'survey-action': 'what.survey', 'survey-map': 'what.survey', 'survey-result': 'pr.survey',
    'design-problem': 'prob.design', 'design-define': 'what.design.scope', 'design-direction': 'what.design', 'design-result': 'pr.design',
    'plan-problem': 'prob.plan', 'plan-action': 'what.plan', 'plan-cards': 'what.plan.short', 'plan-result': 'pr.plan',
    'build-problem': 'prob.build', 'build-action': 'what.build.deal', 'build-run': 'what.build', 'build-review': 'build.review', 'build-pass': 'build.pass', 'build-result': 'pr.build',
    'verify-problem': 'prob.verify', 'verify-evidence': 'what.verify', 'verify-mutation': 'verify.break', 'verify-result': 'pr.verify',
    'audit-problem': 'prob.audit', 'audit-scan': 'audit.scan', 'audit-read': 'audit.read', 'audit-adversary': 'what.audit', 'audit-fix': 'audit.fix', 'audit-result': 'pr.audit',
    'land-problem': 'prob.land', 'land-action': 'land.merge', 'land-tidy': 'what.land', 'land-result': 'pr.land',
    'outro-grow': null, 'outro-b1': null, 'outro-final': 'outro.tag',
};

test.before(async () => { await V5.ready; });

// red when: LENGTH5 (74 * FPS) changes, a beat is dropped or added, or any frame 0..4439 throws or draws a non-finite number, in zh or en
test('promo30v5 is 4440 frames and every frame draws, zh and en', async () => {
    assert.equal(T.length('promo30v5'), 4440);
    assert.equal(V5.length, 4440);
    assert.deepEqual(V5.beats.map((b) => b.label), Object.keys(CAPTION));
    for (const lang of ['zh', 'en']) {
        const P = T.palette(() => '', lang);
        const frames = Array.from({ length: 4440 }, (_, f) => f);
        const r = sweep(T, frames, (ctx, f) => T.render(ctx, 'promo30v5', f, { palette: P }));
        assert.deepEqual(r.nonFinite, [], lang + ': frames that drew a non-finite number');
    }
});

// red when: lockedOf stops counting a finished stage, the result beat stops adding its own segment, or a beat is filed under the wrong stage
test('the header locks segment i+1 at stage i\'s result beat, and one fewer before it', () => {
    STAGES.forEach((s, i) => {
        for (let f = 0; f < 4440; f++) {
            const st = V5.state(f);
            if (st.stage !== s) continue;
            assert.equal(st.locked, Math.min(6, i + (st.phase === 'result' ? 1 : 0)), s + ' ' + st.phase + ' f' + f);
        }
        const result = V5.beats.findIndex((b) => b.label === s + '-result');
        assert.equal(V5.state(V5.stills[result]).locked, Math.min(6, i + 1), s + ' result at its styleframe');
    });
});

// red when: land's result stops sealing the edge (landGlyph's LAND_SEAL), it seals before land's result, or the outro un-seals it
test('the edge is open until land\'s result, sealed by its last frame and through the outro', () => {
    for (let f = 0; f < 4440; f++) {
        const st = V5.state(f), landResult = st.stage === 'land' && st.phase === 'result';
        if (!landResult && !/^outro/.test(st.label)) assert.equal(st.edge, 0, 'f' + f + ' ' + st.label);
    }
    const first = V5.beats.find((b) => b.label === 'land-result').at;
    assert.ok(V5.state(first).edge < 1);
    assert.ok(V5.state(first + 47).edge < 1);
    assert.equal(V5.state(first + 48).edge, 1);
    for (let f = first + 48; f < 4440; f++) assert.equal(V5.state(f).edge, 1, 'f' + f);
});

// red when: two captions swap inside the timeline (the HOOKCAP order, a CAPK entry, or the prob./pr. keys), or a beat draws another line than its caption key names
test('each beat carries its caption key, and the frame prints that line, zh and en', () => {
    V5.beats.forEach((b, k) => {
        const f = V5.stills[k];
        assert.equal(V5.state(f).caption, CAPTION[b.label], b.label);
        if (!CAPTION[b.label]) return;
        for (const lang of ['zh', 'en']) {
            const want = K.V5[CAPTION[b.label]] ? K.V5[CAPTION[b.label]][lang] : K.S[CAPTION[b.label]][lang];
            const ctx = fakeCtx();
            T.render(ctx, 'promo30v5', f, { palette: T.palette(() => '', lang) });
            assert.ok(ctx.texts().includes(want), b.label + ' ' + lang + ' prints ' + JSON.stringify(want));
        }
    });
});

// The rail is the stage strip v4 drew down the left of a stage, pills are its
// step chips (a 600-weight 8px name) and the statusline is `[FANKEEL:STAGE]`.
function furniture(ctx) {
    const hits = [];
    let font = '';
    for (const c of ctx.calls) {
        if (c[0] === '=font') font = String(c[1]);
        if (c[0] !== 'fillText') continue;
        if (/^\[FANKEEL:/.test(c[1])) hits.push('status ' + c[1]);
        if (/(^|\s)600\s+8px\b/.test(font) || /^600 8px/.test(font)) hits.push('pill ' + c[1]);
    }
    return hits;
}

// red when: tour-keel's pills() or status() is called from a v5 frame, in any beat, in zh or en
test('no frame draws the step pills or the [FANKEEL:...] statusline', () => {
    // control: the same reader finds them in v4, where they are drawn
    let seen = 0;
    const P0 = T.palette(() => '', 'zh');
    for (let f = 300; f < 3600 && !seen; f += 30) {
        const ctx = fakeCtx();
        T.render(ctx, 'promo30v4', f, { palette: P0 });
        seen += furniture(ctx).length;
    }
    assert.ok(seen > 0, 'control: furniture() finds nothing in promo30v4, so a clean v5 would prove nothing');
    for (const lang of ['zh', 'en']) {
        const P = T.palette(() => '', lang);
        for (let f = 0; f < 4440; f += 3) {
            const ctx = fakeCtx();
            T.render(ctx, 'promo30v5', f, { palette: P });
            assert.deepEqual(furniture(ctx), [], lang + ' f' + f);
        }
    }
});

// red when: the header's layout moves the divider off x 163 (HC, HP, HW.size or the 12 unit gap after the word), at a survey frame
test('the header divider sits at x 163', () => {
    // The word's width comes from the font; fakeCtx guesses it, so pin the
    // word at 98 (what the face measures at the header's 32 px).
    const base = fakeCtx();
    const ctx = new Proxy(base, {
        get: (t, k) => (k === 'measureText'
            ? (s) => (s === 'fankeel' ? { width: 98, actualBoundingBoxAscent: 23, actualBoundingBoxDescent: 6 } : t.measureText(s))
            : t[k]),
        set: (t, k, v) => { t[k] = v; return true; },
    });
    const f = V5.stills[V5.beats.findIndex((b) => b.label === 'survey-problem')];
    T.render(ctx, 'promo30v5', f, { palette: T.palette(() => '', 'zh') });
    const c = base.calls;
    const at = c.findIndex((x, i) => x[0] === 'moveTo' && x[2] === 18 && c[i + 1] && c[i + 1][0] === 'lineTo' && c[i + 1][1] === x[1] && c[i + 1][2] === 46 && x[1] > 100);
    assert.ok(at >= 0, 'no vertical 18..46 divider line');
    assert.equal(c[at][1], 163);
});

// A mutation of a draw constant reaches these only if v2/v3 are still pinned
// in tests/tour-promo30v4.test.js (PINNED, "draw calls are byte-identical").
// v4 had no pin of its own; it is pinned here, at the hash it drew before v5.
const V4_PIN = {
    zh: 'ffae30f75d93783765491ae5017528afe5e57d3ea57ec1c7a51c0282ef7c841c',
    en: '6f7bf819bd05b666e93c8579eabd3252e5cf19a91fa0a1c85ba26e7dad4d0659',
};
// red when: any draw call of promo30v4 in any of frames 0..3599 differs (a draw constant in v4 or a helper it shares with v5 changes), in zh or en
test('promo30v4 draw calls are byte-identical to the hashes it drew before v5', () => {
    for (const lang of ['zh', 'en']) {
        const P = T.palette(() => '', lang);
        const h = crypto.createHash('sha256');
        for (let f = 0; f < 3600; f++) {
            const ctx = fakeCtx();
            T.render(ctx, 'promo30v4', f, { palette: P });
            h.update(JSON.stringify(ctx.calls) + '\n');
        }
        assert.equal(h.digest('hex'), V4_PIN[lang], 'promo30v4 ' + lang);
    }
});

// ---- the player waits for the timeline's `ready` -------------------------
// tour-player.js run against a stub page: the elements are inert, the engine
// is tour.js with promo30v5's `ready` swapped for a promise the test settles.
function player(ready) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'tour-player.js'), 'utf8');
    const painted = [];
    const el = () => new Proxy({ dataset: {}, style: { setProperty() {} }, classList: { add() {} } }, {
        get(t, k) {
            if (k in t) return t[k];
            if (k === 'getContext') return () => fakeCtx();
            if (k === 'querySelectorAll') return () => [];
            return () => el();
        },
        set(t, k, v) { t[k] = v; return true; },
    });
    const els = {};
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), createElement: () => el(), addEventListener() {}, body: el(), documentElement: {}, fonts: { ready: Promise.resolve() } };
    const engine = Object.assign(Object.create(T), {
        get: (n) => Object.assign({}, T.get(n), { ready: n === 'promo30v5' ? ready : undefined }),
        render: (ctx, n, f) => { painted.push(f); },
    });
    const win = { tourEngine: engine, tourMusic: null };
    new Function('window', 'document', 'location', 'getComputedStyle', 'requestAnimationFrame', 'performance', src)(
        win, doc, { search: '', hash: '#promo30v5@0' }, () => ({ getPropertyValue: () => '' }), () => {}, { now: () => 0 });
    return { win, els, painted };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

// red when: tour-player.js drops the timeline's `ready` from the Promise.all before tour.ready and the first paint (they come before the icons settle)
test('the player paints and sets tour.ready only after the timeline\'s ready settles', async () => {
    let release;
    const { win, painted } = player(new Promise((r) => { release = r; }));
    await tick();
    assert.equal(win.tour.ready, false, 'tour.ready before the timeline was ready');
    assert.deepEqual(painted, [], 'painted before the timeline was ready');
    release();
    await tick();
    assert.equal(win.tour.ready, true);
    assert.ok(painted.length > 0);
});

// red when: tour-player.js sets tour.ready or paints after a rejected `ready`, or leaves the icon's name off the canvas (data-error)
test('a rejected timeline ready leaves tour.ready false and names the failure on the canvas', async () => {
    const was = console.error;
    console.error = () => {};
    try {
        const { win, els, painted } = player(Promise.reject(new Error('tour: promo30v5 icon x failed to decode')));
        await tick();
        assert.equal(win.tour.ready, false);
        assert.deepEqual(painted, []);
        assert.match(els.trCanvas.dataset.error, /icon x failed to decode/);
    } finally {
        console.error = was;
    }
});
