'use strict';
// 最近 sessions and one session under the 2026-10-01 layout
// (docs/90-agent/plans/2026-10-01-station-layout.md Task 3): the film's page
// head, a row's stage as the glyph and its count, the tabs named.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const PK = 'F:\\ws';
const ROUTE7 = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
const row = (id, state, stage, task) => ({ id, pkey: PK, root: PK, task, state, route: ROUTE7, stage, stages: [], backtracks: 0,
    updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [{ day: '2026-10-01', stage, who: 'main', usd: 1 }] });
const ROWS = [row('aaaa1111-0000', 'live', 'build', 'a long task name that runs on'), row('bbbb2222-0000', 'down', 'land', 'done one')];

// station.js booted on `hash`; what it drew into #page.
function draw(hash) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash, protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: ROWS } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    return els.page.innerHTML;
}

test('最近 sessions opens with the film\'s head — the counts, the tabs — and a row draws its stage as the glyph and count', () => {
    const html = draw('#/sessions');
    const head = html.slice(0, html.indexOf('data-block="sessions"'));
    assert.match(head, /<div class="phead khead" data-block="sessions-head"><h1>/);
    assert.match(head, /<span><b>2<\/b>個 session<\/span><span><b>1<\/b>個 live<\/span>/);
    assert.match(head, /data-block="subtabs"/);
    assert.match(html, /<section class="panel ksess" data-block="sessions">/);
    assert.match(html, /<td class="task"><a href="#\/s\/aaaa1111-0000" title="a long task name that runs on">/);
    assert.match(html, /<span class="kstage"><svg class="glyph k-only prog"[^>]*>[\s\S]*?<\/svg><span class="kst k-only" style="--c:var\(--st-build\)"><b>04<\/b>/);
    assert.doesNotMatch(html, /class="h2"/, 'the old panel heading is gone');
});

test('one session opens with the film\'s head: the glyph, 0N / 0M over the title, and tabs named session-tabs', () => {
    const html = draw('#/s/aaaa1111-0000');
    assert.match(html, /<section class="panel kshead" data-block="session-head"><div class="eyebrow">/);
    assert.match(html, /<div class="ks-top"><svg class="glyph k-only prog"[^>]*>[\s\S]*?<\/svg><div class="ks-t"><span class="kst k-only" style="--c:var\(--st-build\)"><b>04<\/b><i>&nbsp;\/&nbsp;07<\/i><u>build<\/u><\/span><h1 class="s-title">a long task name that runs on<\/h1><\/div><div class="s-meta">/);
    assert.match(html, /<nav class="tabs" data-block="session-tabs" aria-label="session 檢視">/);
});
