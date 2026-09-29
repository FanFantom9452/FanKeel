'use strict';
// promo30v3: the honeycomb-ring left side beside v2's right side. v2 (promo30)
// must draw byte for byte what it drew before v3 existed, and v3 must not
// call the product keel.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const T = require('../assets/station/tour.js');
require('../assets/station/tour-keel.js');
const { TOUR_PROMO30V3 } = require('../assets/station/tour-ring.js');
const { fakeCtx } = require('./tour-ctx.js');

const STARTS = [0, 180, 300, 450, 630, 750, 930, 1080, 1260, 1410];
const PINNED = {
    zh: '9dc4d0076b7264470c9c24c4a0ecb4e26bbff8a53fd2345f7d339305df18c66b',
    en: '62677bc0db454c62f857fdd9b82570d15852045c69108a68cd0cd876ec6ef590',
};

// promo30v3 is 1800 frames and its shots start where promo30's do; every frame
// draws in zh and en. Red when: the length or a shot start changes, or a frame throws.
test('promo30v3 is 1800 frames, shots start as promo30\'s, every frame draws', () => {
    assert.equal(T.length('promo30v3'), 1800);
    assert.deepEqual(TOUR_PROMO30V3.cues.cuts, STARTS);
    for (const lang of ['zh', 'en']) {
        const P = T.palette(() => '', lang);
        for (let f = 0; f < 1800; f++) T.render(fakeCtx(), 'promo30v3', f, { palette: P });
    }
});

// v2 draws the same 1800 frames as before v3. Red when: any promo30 draw call
// in any frame differs, or requiring tour-ring.js changes what promo30 draws.
test('promo30 draw calls are byte-identical to the pinned hashes', () => {
    for (const lang of ['zh', 'en']) {
        const P = T.palette(() => '', lang);
        const h = crypto.createHash('sha256');
        for (let f = 0; f < 1800; f++) {
            const ctx = fakeCtx();
            T.render(ctx, 'promo30', f, { palette: P });
            h.update(JSON.stringify(ctx.calls) + '\n');
        }
        assert.equal(h.digest('hex'), PINNED[lang], lang);
    }
});

// Red when: a promo30v3 caption in shot 1, 2 or 10 says keel / 龍骨 (other than fankeel).
test('no promo30v3 caption in shots 1, 2 and 10 says keel', () => {
    const frames = [];
    for (const s of [0, 1, 9]) {
        const a = STARTS[s], b = s === 9 ? 1800 : STARTS[s + 1];
        for (const k of [0, 0.15, 0.3, 0.5, 0.7, 0.85, 0.99]) frames.push(Math.floor(a + (b - a) * k));
    }
    for (const lang of ['zh', 'en']) {
        const P = T.palette(() => '', lang);
        let seen = 0;
        for (const f of frames) {
            const ctx = fakeCtx();
            T.render(ctx, 'promo30v3', f, { palette: P });
            for (const s of ctx.texts()) {
                seen++;
                assert.ok(!/keel|龍骨/i.test(String(s).replace(/fankeel/gi, '')), lang + ' f' + f + ': ' + s);
            }
        }
        assert.ok(seen > 0, 'drew no text in ' + lang);
    }
});
