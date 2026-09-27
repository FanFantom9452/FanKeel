'use strict';
// Video 3 (assets/station/tour-wizard.js): the eight steps are the station's
// own WIZ_STEPS (assets/station/station.js), with the same keys and as many
// options; what each step writes is what the station's wizard writes for that
// pick on a fresh machine, read back through lib/profile.js parseValue; and the
// profile the video ends on parses to exactly those keys.
const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../lib/profile.js');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');
const T = require('../assets/station/tour.js');
const { WIZARD, STEPS, profileLines } = require('../assets/station/tour-wizard.js');
const { fakeCtx } = require('./tour-ctx.js');

const EMPTY = { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} };

function shot(f) {
    const ctx = fakeCtx();
    T.render(ctx, 'wizard', f);
    return ctx;
}

// What the station's own wizard writes for the video's picks, step by step:
// the keys each pick adds to wizChanges, as the values the profile holds.
function written() {
    const K = profile.WIZARD_KEYS;
    let W = V.wizLoad(EMPTY, K, 'machine');
    const seen = new Set();
    return STEPS.map((s, i) => {
        W.step = i;
        W = V.wizApply(W, K, EMPTY, { h: String(s.pick) });
        const now = {};
        for (const c of V.wizChanges(K, W, EMPTY)) {
            if (seen.has(c.key)) continue;
            seen.add(c.key);
            now[c.key] = profile.parseValue(c.key, c.value).value;
        }
        return now;
    });
}

test('wizard is registered: 3600 frames, a beat per step and one for the save', () => {
    assert.equal(T.get('wizard'), WIZARD);
    assert.equal(T.length('wizard'), 3600);
    assert.deepEqual(T.check(WIZARD), []);
    assert.deepEqual(WIZARD.beats.map((b) => [b.at, b.label]),
        [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [240 + 390 * (n - 1), String(n)]).concat([[3360, 'saved']]));
    assert.deepEqual(WIZARD.stills, [300, 560, 1500, 2330, 3480]);
});

test('the eight steps are the station\'s WIZ_STEPS, in order, with the same keys and as many options', () => {
    assert.equal(STEPS.length, 8);
    assert.equal(V.WIZ_STEPS.length, 8);
    STEPS.forEach((s, i) => {
        assert.deepEqual(s.keys, V.WIZ_STEPS[i].keys, 'step ' + (i + 1));
        assert.equal(s.opts.length, V.WIZ_STEPS[i].habits.length, 'step ' + (i + 1));
        for (const k of s.keys) assert.ok(k in profile.WIZARD_KEYS, k);
    });
});

test('each step writes what the station\'s wizard writes for that pick on a fresh machine', () => {
    const want = written();
    STEPS.forEach((s, i) => assert.deepEqual(Object.fromEntries(s.writes), want[i], 'step ' + (i + 1)));
});

test('the profile the video ends on parses to exactly those keys', () => {
    const all = Object.assign({}, ...written());
    assert.deepEqual(JSON.parse(profileLines(8).map((l) => l.text).join('\n')), all);
    assert.deepEqual(JSON.parse(profileLines(0).map((l) => l.text).join('\n')), {});
    assert.ok(shot(3480).texts().includes('8 steps · ' + Object.keys(all).length + ' keys'));
});

test('a step that writes nothing says so', () => {
    assert.ok(shot(240 + 390 * 4 + 150).texts().includes('built-in value · not written'));
});

test('the rail counts the steps', () => {
    assert.ok(shot(100).texts().includes('1 / 8'));
    assert.ok(shot(1500).texts().includes('4 / 8'));
    assert.ok(shot(3500).texts().includes('8 / 8'));
});

test('a frame draws the same calls whichever frames were drawn before it', () => {
    for (const f of WIZARD.stills) {
        const cold = JSON.stringify(shot(f).calls);
        shot(3599);
        shot(0);
        shot(f + 131);
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
