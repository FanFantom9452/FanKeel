'use strict';
// station-38, station-39, station-52: #/docs and #/settings draw through
// FK_DOCS and FK_SETTINGS, handed the station and modOpts; the 文件 box's
// input listener, the wizard's settingsPage, its 前端 keydown and its click
// branch are gone from assets/station/station.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { SRC } = require('./station-src.js');

const JS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-24T09:00:00.000Z');

// The page booted on `hash` with every document listener kept; `mods` are
// stand-ins whose own `w.FK_X = api` in SRC is ignored (a getter, a no-op setter).
function boot(hash, mods) {
    const els = {};
    const listeners = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el,
        querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash, protocol: 'http:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: true, nonce: 'N0NCE', plugin: 'PLUG',
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    for (const [g, api] of Object.entries(mods || {})) Object.defineProperty(win, g, { get: () => api, set() {}, enumerable: true });
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } });
    return { win, listeners, html: () => els.page.innerHTML };
}
// A stand-in module: records what page() was handed and draws one block.
function stub(block) {
    const told = [];
    return { told, page: (S, o) => { told.push({ S, o }); return '<div data-block="' + block + '">' + block + '</div>'; } };
}

test('#/docs is FK_DOCS.page, handed the station and modOpts with the project keys', () => {
    const d = stub('docs-stub');
    const b = boot('#/docs', { FK_DOCS: d });
    assert.ok(b.html().includes('data-block="docs-stub"'), b.html());
    assert.equal(d.told.length >= 1, true);
    const { S, o } = d.told[0];
    assert.equal(S, b.win.STATION);
    assert.ok(Array.isArray(o.pkeys), 'pkeys');
    assert.equal(typeof o.redraw, 'function');
    assert.equal(o.serve, true);
    assert.equal(typeof o.names, 'object');
});

test('#/settings and #/settings/detail/<step> are FK_SETTINGS.page, handed the hash, nonce, plugin and config dir', () => {
    for (const hash of ['#/settings', '#/settings/detail/remote']) {
        const s = stub('settings-stub');
        const b = boot(hash, { FK_SETTINGS: s });
        assert.ok(b.html().includes('data-block="settings-stub"'), hash);
        const { S, o } = s.told[0];
        assert.equal(S, b.win.STATION, hash);
        assert.equal(o.hash, hash);
        assert.equal(o.nonce, 'N0NCE');
        assert.equal(o.plugin, 'PLUG');
        assert.equal(o.configDir, 'cfg');
        assert.equal(typeof o.redraw, 'function');
    }
});

test('the old docs page, its search listener and the wizard\'s page, keydown and click branch are gone', () => {
    assert.match(JS, /VIEWS\.docs = function \(r\) \{ return w\.FK_DOCS\.page\(S, modOpts\(\{ pkeys: PKEYS \}\)\); \};/);
    assert.match(JS, /VIEWS\.settings = function \(r\) \{ return w\.FK_SETTINGS\.page\(S, modOpts\(\{ hash: String\(w\.location\.hash \|\| ''\), nonce: S\.nonce, plugin: S\.plugin, configDir: S\.configDir \}\)\); \};/);
    for (const gone of [/view\.dsx/, /function docsPage\(/, /dsxTimer/, /function dsxPaint\(/, /var wiz = null/, /function settingsPage\(/,
        /function fePick\(/, /\.wz \.fbar \.fsg/, /\.wz \[data-go\]/, /wiz = wizApply\(/]) {
        assert.doesNotMatch(JS, gone, String(gone));
    }
});

test('no document listener holds the docs box or the wizard, and one click listener holds [data-fbtn]', () => {
    const b = boot('#/');
    const all = Object.values(b.listeners).flat().map(String);
    assert.equal(all.filter((s) => s.includes('dsxTimer') || s.includes("'dq'") || s.includes('.wz ')).length, 0);
    assert.equal((b.listeners.click || []).filter((fn) => String(fn).includes('[data-fbtn]')).length, 1);
});
