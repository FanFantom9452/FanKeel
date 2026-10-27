'use strict';
// #/weekly mounted (docs/90-agent/plans/2026-10-27-weekly-skill-design.md,
// 監控站整合): the shell draws FK_WEEKLY's page under the title 週報 with its
// bar entry lit, and index.html shows the list skeleton while it loads.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { SRC } = require('./station-src.js');
const NOW = Date.parse('2026-01-09T09:00:00.000Z');

function draw(hash) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash, protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [], profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    return { page: els.page.innerHTML, side: els.side.innerHTML, nav: els.nav.innerHTML };
}

test('#/weekly draws the weekly page under the title 週報, its bar entry lit', () => {
    const { page, side, nav } = draw('#/weekly');
    for (const b of ['weekly-page', 'weekly-copy', 'weekly-list']) assert.ok(page.includes('data-block="' + b + '"'), b);
    assert.ok(side.includes('<h1 class="ptitle">週報</h1>'), side);
    assert.match(nav, /<a href="#\/weekly" aria-current="page"/);
});

test('the shell shows the list skeleton while #/weekly loads', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'index.html'), 'utf8');
    assert.ok(html.includes('/^#\\/?(sessions|projects|docs|weekly|days|d|list|cmp)(\\/|$)/'));
});
