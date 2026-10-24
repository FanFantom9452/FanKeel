'use strict';
// station-52: the station reference and gate-frame.js's header say the focus
// page is drawn by assets/station/focus-page.js (FK_FOCUS), not station.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('station.md names focus-page.js and FK_FOCUS, and no station.js line for the gate frame', () => {
    const md = read('docs/90-agent/reference/station.md');
    assert.match(md, /`i18n\.js`, `tip\.js`, `gate-frame\.js`, `focus-page\.js` and `station\.js`/);
    assert.match(md, /`FK_FOCUS` \(`assets\/station\/focus-page\.js`\)/);
    assert.doesNotMatch(md, /assets\/station\/station\.js:2217/);
});

test('gate-frame.js says the focus module draws the report and calls frame()', () => {
    const src = read('assets/station/gate-frame.js');
    assert.doesNotMatch(src, /whose focusPageHtml calls frame/);
    assert.doesNotMatch(src, /station\.js drew \(`focusReportHtml`\)/);
    assert.match(src, /focus-page\.js/);
});
