'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

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
    box.module.exports.els = els;
    return box.module.exports;
}

test('the header names the page from NAV_TREE, top level and kids alike', () => {
    const V = page();
    assert.equal(V.pageTitle({ view: 'now' }), '現在');
    assert.equal(V.pageTitle({ view: 'days' }), '花費');
    assert.equal(V.pageTitle({ view: 'live' }), '進行中');
    assert.equal(V.pageTitle({ view: 'project' }), '依專案');
    assert.equal(V.pageTitle({ view: 'settings' }), '設定', 'a page with one filter titles by the page');
});

test('the serve state is an icon with its words only in title and aria-label', () => {
    const V = page();
    const up = V.serveIconHtml(true);
    const down = V.serveIconHtml(false);
    assert.match(up, /id="serveup"/);
    assert.match(up, /title="[^"]+"/);
    assert.match(up, /aria-label="[^"]+"/);
    assert.doesNotMatch(up.replace(/<[^>]*>/g, ''), /\S/);
    assert.match(down, /id="servedown"/);
});

test('the drawn page puts its title in the header, not the crumbs', () => {
    const V = page();
    assert.equal(V.els.side.innerHTML, '<h1 class="ptitle">現在</h1>');});
