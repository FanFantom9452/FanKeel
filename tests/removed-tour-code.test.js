'use strict';
// The 導覽 page's code is gone from the station's modules (TODO tour-2 brings it back):
// chart.js has no tourPage, nav.js no tour glyph, i18n.js no tour string.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', f), 'utf8');

test('chart.js, nav.js and i18n.js hold no tour page, glyph or string', () => {
    for (const f of ['chart.js', 'nav.js', 'i18n.js']) assert.doesNotMatch(read(f), /tour/i, f);
});

test('station.css, dash.js and fmt.js no longer name the tour film or its frame', () => {
    for (const f of ['station.css', 'dash.js', 'fmt.js']) assert.doesNotMatch(read(f), /tour/i, f);
});
