'use strict';
// The masthead's language menu (r-0036, docs/90-agent/plans/2026-10-01-station-layout.md
// Task 8): a globe button opens #langpop; a second press, a click elsewhere or
// Escape shuts it; a click inside it leaves it open.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ROOT, 'station.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');

function boot() {
    const listeners = {}, els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', placeholder: '', attrs: {}, style: {}, hidden: false,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const at = (sel) => ({ closest: (s) => (s === sel ? {} : null), getAttribute: () => null, hasAttribute: () => false });
    const click = (sel) => { for (const fn of listeners.click || []) fn({ target: at(sel), preventDefault() {}, stopPropagation() {} }); };
    const escape = () => { for (const fn of (listeners.keydown || []).filter((f) => f.toString().includes('langMenu'))) fn({ key: 'Escape', target: at('none') }); };
    return { els, click, escape };
}

test('the masthead\'s language control is a globe button over a menu of the two languages', () => {
    const mast = html.slice(html.indexOf('<header class="mast"'), html.indexOf('</header>'));
    assert.match(mast, /<div class="langsw"><button type="button" class="langbtn" id="langbtn" data-langmenu="1" aria-haspopup="menu" aria-expanded="false" aria-controls="langpop"/);
    assert.match(mast, /<div class="langpop" id="langpop" role="menu" aria-label="介面語言 Language" hidden>/);
    assert.match(mast, /<button type="button" role="menuitemradio" aria-checked="true" id="langzh" data-lang="zh"/);
    assert.match(mast, /<button type="button" role="menuitemradio" aria-checked="false" id="langen" data-lang="en"/);
    assert.doesNotMatch(mast, /class="seg lang"/);
});

test('the globe opens the menu, a second press or a click elsewhere shuts it, a click inside leaves it, and Escape shuts it', () => {
    const p = boot();
    p.click('[data-langmenu]');
    assert.equal(p.els.langbtn.attrs['aria-expanded'], 'true');
    assert.equal(p.els.langpop.hidden, false);
    p.click('[data-langmenu]');
    assert.equal(p.els.langbtn.attrs['aria-expanded'], 'false');
    assert.equal(p.els.langpop.hidden, true);
    p.click('[data-langmenu]');
    p.click('#langpop');
    assert.equal(p.els.langpop.hidden, false, 'a click inside the menu leaves it open');
    p.click('none');
    assert.equal(p.els.langpop.hidden, true);
    p.click('[data-langmenu]');
    p.escape();
    assert.equal(p.els.langpop.hidden, true);
    assert.equal(p.els.langbtn.attrs['aria-expanded'], 'false');
});
