'use strict';
// promo30v4: v3 at one minute with the stage readable. v2 (promo30) and v3
// (promo30v3) must draw byte for byte what they drew before v4 existed.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const T = require('../assets/station/tour.js');
require('../assets/station/tour-keel.js');
const { TOUR_PROMO30V4 } = require('../assets/station/tour-ring.js');
const { fakeCtx } = require('./tour-ctx.js');

const STARTS = [0, 300, 540, 900, 1260, 1620, 1980, 2340, 2700, 3060];
const PINNED = {
    promo30: {
        zh: '9dc4d0076b7264470c9c24c4a0ecb4e26bbff8a53fd2345f7d339305df18c66b',
        en: '62677bc0db454c62f857fdd9b82570d15852045c69108a68cd0cd876ec6ef590',
    },
    promo30v3: {
        zh: '37d5b27a6c460fc83cb39793ab02118c699509096409a4da9611f42158eb86fe',
        en: '8c9b4cd260441660441f7075f1e18a8ca99c80e0f922bef8475e7bd059cb1538',
    },
};

// red when: V4_LENGTH, a shot's len or a stage's V4_STAGE changes (length or a shot start moves), or any frame 0..3599 throws
test('promo30v4 is 3600 frames, its ten shots start where pinned, every frame draws', () => {
    assert.equal(T.length('promo30v4'), 3600);
    assert.deepEqual(TOUR_PROMO30V4.cues.cuts, STARTS);
    for (const lang of ['zh', 'en']) {
        const P = T.palette(() => '', lang);
        for (let f = 0; f < 3600; f++) T.render(fakeCtx(), 'promo30v4', f, { palette: P });
    }
});

for (const name of ['promo30', 'promo30v3']) {
    // red when: any draw call of `name` in any of frames 0..1799 differs (a draw constant in v2/v3 or a shared helper changes), in zh or en
    test(name + ' draw calls are byte-identical to the pinned hashes', () => {
        for (const lang of ['zh', 'en']) {
            const P = T.palette(() => '', lang);
            const h = crypto.createHash('sha256');
            for (let f = 0; f < 1800; f++) {
                const ctx = fakeCtx();
                T.render(ctx, name, f, { palette: P });
                h.update(JSON.stringify(ctx.calls) + '\n');
            }
            assert.equal(h.digest('hex'), PINNED[name][lang], name + ' ' + lang);
        }
    });
}
