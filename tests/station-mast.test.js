'use strict';
// The masthead under the 2026-10-01 layout (docs/90-agent/plans/2026-10-01-station-layout.md
// Tasks 5 and 6): the theme button in `.appear`, keel the only look.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ROOT, 'station.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');

// station.js booted with the document's click listeners kept; `press` runs
// them all on a target whose closest() answers only `[data-themecycle]`.
function boot(kept) {
    const listeners = {}, els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', placeholder: '', attrs: {}, style: {}, hidden: false,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const root = el();
    root.attrs['data-style'] = 'keel';
    const doc = { hidden: false, documentElement: root, title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const press = (btn) => {
        const target = { closest: (sel) => (sel.split(',').some((s) => s.trim() === '[data-themecycle]') ? btn : null), getAttribute: () => null, hasAttribute: () => false };
        for (const fn of listeners.click || []) fn({ target, preventDefault() {}, stopPropagation() {} });
    };
    return { els, root, kept, press };
}
const themeBtn = (next) => ({ attrs: { 'data-themecycle': next }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, hasAttribute(k) { return k in this.attrs; } });

test('the masthead holds the theme button in .appear, and the left bar holds none', () => {
    const mast = html.slice(html.indexOf('<header class="mast"'), html.indexOf('</header>'));
    assert.match(mast, /<div class="appear" id="appear" role="group" aria-label="外觀"><\/div>/);
    const p = boot({});
    assert.match(p.els.appear.innerHTML, /^<button type="button" class="themebtn" data-themecycle="light"/);
    assert.doesNotMatch(p.els.nav.innerHTML, /data-themecycle|navfoot/);
});

test('a press on the masthead\'s theme button switches data-theme, stores it, and redraws the button', () => {
    const p = boot({});
    p.press(themeBtn('dark'));
    assert.equal(p.root.attrs['data-theme'], 'dark');
    assert.equal(p.kept['station.theme'], 'dark');
    assert.match(p.els.appear.innerHTML, /data-themecycle="system"/);
});

test('index.html opens in keel and holds no switch, mark or script that could take it off', () => {
    assert.match(html, /<html lang="zh-Hant" data-style="keel">/);
    assert.doesNotMatch(html, /styletog|station\.style|classic-mark/);
});
