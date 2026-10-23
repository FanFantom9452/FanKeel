'use strict';
// Where the cards that left 現在 went, the strip as a filter, and the old
// hashes (docs/90-agent/plans/2026-10-21-station-focus-design.md §3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { SRC } = require('./station-src.js');
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const ROW = { id: 'aaaa1111-0000', pkey: 'F:\\ws', root: 'F:\\ws', task: 't', state: 'live', route: ['survey', 'build'], stage: 'build', stages: [],
    claims: [], notes: [], updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [] };

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
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [ROW] } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    return { page: els.page.innerHTML, nav: els.nav.innerHTML };
}
const blocks = (html) => [...html.matchAll(/data-block="([^"]+)"/g)].map((m) => m[1]);
const chosen = (html) => (/<nav class="subtabs" data-block="page-filter"[^>]*>[\s\S]*?<a href="([^"]+)" aria-current="page">/.exec(html) || [])[1];
const lit = (nav) => (/<a href="([^"]+)" aria-current="page"/.exec(nav) || [])[1];

test('花費\'s 近 30 天 view carries 依專案花費, 模型用量分布 and 近 7 天 token under the chart', () => {
    const { page } = draw('#/days');
    const row = page.slice(page.indexOf('data-block="spend-cards"'));
    assert.match(page, /<div class="dash kdash pcards" data-block="spend-cards">/);
    for (const b of ['dash-byproj', 'dash-tokens7', 'dash-models']) assert.ok(blocks(row).includes(b), b);
    assert.ok(page.indexOf('data-block="days"') < page.indexOf('data-block="spend-cards"'));
});

test('every old hash lands on the page that replaced it, with its own filter chosen', () => {
    // #/live, #/sessions and #/projects are module pages, which draw their own strip.
    for (const [hash, entry, filter] of [['#/live', '#/sessions'], ['#/sessions', '#/sessions'], ['#/list', '#/sessions', '#/list'],
        ['#/days', '#/days', '#/days'], ['#/projects', '#/days']]) {
        const d = draw(hash);
        assert.equal(lit(d.nav), entry, hash + ' lights ' + entry);
        if (filter) assert.equal(chosen(d.page), filter, hash + ' chooses ' + filter);
    }
});
