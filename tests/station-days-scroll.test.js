'use strict';
// Task 8 of docs/90-agent/plans/2026-10-30-spend-quota.md: 花費 drops the `(x%)` after an
// amount, its tabs keep the scroll, and its new helpers reach FK_DAYS.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { SRC } = require('./station-src.js');

function boot(hash) {
    const winListeners = {};
    let scrolls = 0;
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    const els = {};
    const win = { location: { hash }, addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); }, scrollTo() { scrolls++; },
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false, projects: [],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const fallback = Object.assign(el(), { parentNode: { insertBefore() {} }, nextSibling: null, click() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: (sel) => (sel === 'dialog[open]' ? null : fallback), head: { appendChild() {} } };
    const box = { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return { V: box.module.exports, scrolls: () => scrolls, goto(to) { win.location.hash = to; (winListeners.hashchange || []).forEach((fn) => fn({})); } };
}

test('an amount is plain dollars everywhere, 花費 included', () => {
    const b = boot('#/');
    assert.equal(b.V.usd(50), '$50.00');
    b.goto('#/days');
    assert.equal(b.V.usd(50), '$50.00');
});

test('moving between 花費\'s tabs keeps the scroll; leaving 花費 goes back to the top', () => {
    const b = boot('#/days');
    const at = b.scrolls();
    b.goto('#/days/quota7');
    b.goto('#/days/quota5h?acc=4%2004%3A00');
    b.goto('#/days/detail');
    b.goto('#/days');
    assert.equal(b.scrolls(), at);
    b.goto('#/sessions');
    assert.ok(b.scrolls() > at);
});

test('daysCtx hands FK_DAYS the quota and overview drawings, usd and esc', () => {
    const H = boot('#/days').V.daysCtx().H;
    for (const k of ['quotaSvg', 'ovBarsSvg', 'usd', 'esc']) assert.equal(typeof H[k], 'function', k);
});
