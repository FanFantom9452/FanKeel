'use strict';
// The days page (近 30 天) as its own module, assets/station/days-page.js
// (FK_DAYS); until station.js is rewired to it, both copies exist.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ASSETS = path.join(__dirname, '..', 'assets', 'station');

test('days-page.js sets FK_DAYS and adds no listener at load', () => {
    const added = [];
    const win = {};
    vm.runInNewContext(fs.readFileSync(path.join(ASSETS, 'days-page.js'), 'utf8'),
        { window: win, document: { addEventListener(type) { added.push(type); } }, module: { exports: {} } });
    assert.deepEqual(added, []);
    for (const k of ['page', 'restore', 'hide', 'focusPin', 'arm', 'toggle', 'panelShut', 'setPanel', 'panelOpen', 'hovering', 'onMove']) assert.equal(typeof win.FK_DAYS[k], 'function', k);
});
