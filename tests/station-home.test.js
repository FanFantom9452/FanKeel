'use strict';
// focusHref: the focus page link a session row points at (docs/90-agent/plans/
// 2026-10-21-station-focus-design.md §3). The 現在 cards that used it were the
// OLD.* dashboard's and are gone (station-52).
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { SRC } = require('./station-src.js');

function boot() {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', value: '', hidden: false, attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [], profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} },
            profileKeys: {}, classes: {}, sessions: [] } };
    const box = { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}

test('focusHref is /f/<id>/<stage> under serve and the session hash off it', () => {
    const V = boot();
    assert.equal(V.focusHref('x y', 'plan', true), '/f/x%20y/plan');
    assert.equal(V.focusHref('x', '', true), '/f/x/timeline');
    assert.equal(V.focusHref('x', '', false), '#/s/x');
});
