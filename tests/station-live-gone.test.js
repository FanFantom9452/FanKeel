'use strict';
// station-63: the old live view's ten builders had no caller once live-page.js
// drew #/live; they are deleted, not kept for their tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GONE = ['liveRail', 'saFamily', 'saShort', 'liveSubsHtml', 'liveLane', 'liveGate', 'liveRun', 'liveMaybe', 'liveIdle', 'nowHtml'];

test('the old live builders are gone from station.js and nav.js', () => {
    for (const f of ['station.js', 'nav.js']) {
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', f), 'utf8');
        for (const n of GONE) assert.ok(!new RegExp('\\b' + n + '\\b').test(src), f + ' still names ' + n);
    }
    const V = require('../assets/station/station.js');
    for (const n of GONE) assert.equal(V[n], undefined, n + ' is still exported');
});
