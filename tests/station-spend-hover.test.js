'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');

function page() {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false, projects: [],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const box = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}

test('every day is a focusable bar carrying its amount and day', () => {
    const V = page();
    const day = V.localDay(Date.now());
    const R = [{ id: 'a', pkey: 'p', project: 'p', usd: 12.5, days: [{ day, usd: 12.5, cost: 12.5, tokens: null, model: 'opus', who: 'main', stage: 'build' }] }];
    const html = V.dashSpend(R);
    assert.match(html, /<span class="db[^"]*" tabindex="0"/);
    assert.match(html, new RegExp('data-tip="' + day + ' \\$12\\.50'));
    assert.match(html, /data-tip="[^"]*沒有紀錄"/);
    // An empty day is hoverable but no tab stop.
    assert.match(html, /<span class="db none[^"]*" data-tip="[^"]*沒有紀錄"/);
});

test('the hover lift is CSS and respects reduced motion', () => {
    assert.match(CSS, /\.dspark \.db:hover/);
    assert.match(CSS, /\.dspark \.db:focus-visible/);
    assert.match(CSS, /\.dspark \.db\[data-tip\]::after\{/);
    assert.match(CSS, /@media\(prefers-reduced-motion:reduce\)\{[^}]*\.dspark/);
});
