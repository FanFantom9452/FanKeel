'use strict';
// The days page (近 30 天) as its own module, assets/station/days-page.js
// (FK_DAYS); station.js routes to it and keeps no copy.
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
    for (const k of ['page', 'restore', 'hide', 'focusPin', 'arm', 'toggle', 'panelShut', 'set', 'setAll', 'setPanel', 'panelOpen', 'hovering', 'onMove']) assert.equal(typeof win.FK_DAYS[k], 'function', k);
});

// A ctx with every helper stubbed: what the page hands visibleBars as `o.off`
// is the 篩選 state FK_DAYS keeps.
function daysWith() {
    const win = {};
    const doc = { addEventListener() {}, getElementById: () => ({ removeAttribute() {} }), querySelector: () => null, querySelectorAll: () => [] };
    vm.runInNewContext(fs.readFileSync(path.join(ASSETS, 'days-page.js'), 'utf8'), { window: win, document: doc, module: { exports: {} } });
    const seen = [];
    let draws = 0;
    const stub = () => '';
    const H = new Proxy({ homeRows: () => [], homeOpts: () => ({}), dayBars: () => ({ keys: ['a', 'b', 'c'] }),
        visibleBars: (all, o) => { seen.push(Object.keys(o.off).sort()); return all; } }, { get: (t, k) => t[k] || stub });
    const ctx = { S: {}, view: { dim: 'model', metric: 'tokens' }, route: { view: 'days' }, DAYS: ['2026-10-27'], PREV: [], TODAY: '2026-10-27',
        frozenAt: null, draw() { draws++; }, H };
    win.FK_DAYS.page({ view: 'days' }, ctx);
    return { D: win.FK_DAYS, ctx, seen, draws: () => draws };
}

test('FK_DAYS.setAll takes every key off the chart or puts all back, set does the ones named', () => {
    const { D, ctx, seen, draws } = daysWith();
    D.setAll(false, null);
    assert.equal(draws(), 1);
    D.page({ view: 'days' }, ctx);
    assert.deepEqual(seen.at(-1), ['a', 'b', 'c']);
    D.set(['b'], true, null);
    D.page({ view: 'days' }, ctx);
    assert.deepEqual(seen.at(-1), ['a', 'c']);
    D.setAll(true, null);
    D.page({ view: 'days' }, ctx);
    assert.deepEqual(seen.at(-1), []);
});

test('station.js routes 近 30 天 to FK_DAYS and holds none of its chart state', () => {
    const src = fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8');
    for (const name of ['var chartBars', 'function chartRestore', 'function daysPage', 'function legendToggle']) assert.ok(!src.includes(name), name);
    assert.match(src, /VIEWS\.days = function \(r\) \{ return w\.FK_DAYS\.page\(r, daysCtx\(\)\); \};/);
});
