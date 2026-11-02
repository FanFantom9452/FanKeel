'use strict';
// The station's 導覽 page was removed on 2026-11-02 (TODO tour-2 brings it back): no hash route,
// no link in the left bar, no tourPage on what station.js exports.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

test('the old hash falls back to the dashboard', () => {
    assert.deepEqual(V.parseHash('#/tour'), { view: 'now' });
});

test('the left bar has no 導覽 link, and station.js exports no tourPage', () => {
    const nav = V.navHtml('now', { waiting: 0 });
    assert.ok(!nav.includes('#/tour'), nav);
    assert.ok(!nav.includes('data-block="tour-nav"'), nav);
    assert.equal('tourPage' in V, false);
});
