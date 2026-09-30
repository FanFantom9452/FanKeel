'use strict';
// The keel look's live parts (docs/90-agent/plans/2026-10-01-todo-sweep.md
// Task 7): a live row drawn as the promo film's glyph, the recent row's stage
// word, the all-clear check, and the 經典樣式 switch.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const I = require('../assets/station/i18n.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const ROUTE7 = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

// station.js booted the way tests/station-i18n.test.js boots it, with the
// document's listeners kept so a test can press the switch.
function boot(opts) {
    const o = opts || {};
    const kept = Object.assign({}, o.kept);
    const listeners = {};
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const root = el('html');
    if (o.style) root.attrs['data-style'] = o.style;
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const doc = { hidden: false, documentElement: root, title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }), head: { appendChild() {} } };
    if (o.lang) { kept['station.lang'] = o.lang; win.FK_I18N = I.make(win); }
    const box = { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return { V: box.module.exports, els, root, kept, listeners };
}
const live = (route, stage) => ({ id: 'k1', pkey: 'F:\\ws\\alpha', task: 'keel one', state: 'live', updated: NOW - 1000, started: NOW - 120000, route, stage });
const count = (s, re) => (s.match(re) || []).length;

test('a live row carries the glyph filled to its stage and the film\'s 0N / 0M count; the route dots stay for classic', () => {
    const html = boot().V.dashLive([live(ROUTE7, 'build')]);
    assert.equal(count(html, /class="gseg done"/g), 3);
    assert.equal(count(html, /class="gseg now"/g), 1);
    assert.equal(count(html, /class="gseg todo"/g), 2);
    assert.equal(count(html, /class="gedge todo"/g), 1);
    assert.match(html, /<svg class="glyph k-only prog" viewBox="0 0 120 120" aria-hidden="true" style="--c:var\(--st-build\)">/);
    assert.match(html, /d="M56\.50 107\.98L20\.20 87\.02L36\.65 77\.52L56\.50 88\.98Z"/, 'segment 0 is the film glyph\'s own path');
    assert.match(html, /<span class="kst k-only" style="--c:var\(--st-build\)"><b>04<\/b><i>&nbsp;\/&nbsp;07<\/i><u>build<\/u><\/span>/);
    assert.match(html, /<span class="route c-only"/);
});

test('a stage the route skips is left out of the glyph, and a route with no land has no edge', () => {
    const html = boot().V.dashLive([live(['survey', 'build', 'verify'], 'verify')]);
    assert.equal(count(html, /class="gseg /g), 3);
    assert.equal(count(html, /class="gedge /g), 0);
    assert.match(html, /<b>03<\/b><i>&nbsp;\/&nbsp;03<\/i><u>verify<\/u>/);
});

test('the recent row names its stage for the underline, and the empty gate card shows the check', () => {
    const { V } = boot();
    const recent = V.dashRecent([{ id: 'r1', pkey: 'F:\\ws\\alpha', task: 'recent', state: 'live', stage: 'plan', updated: NOW - 1000, started: NOW - 7200e3, days: [] }]);
    assert.match(recent, /<span class="ds mono" data-st="plan" style="--c:var\(--st-plan\)">plan<\/span>/);
    assert.match(V.dashGate([]), /<p class="dnone"><span class="okdot k-only" aria-hidden="true"><svg class="ico"/);
    assert.match(V.dashGate([]), /沒有在等你的 gate/);
});

test('the switch reads pressed in classic; a press swaps the attribute and stores station.style, a second press undoes both', () => {
    const p = boot({ style: 'keel', lang: 'zh' });
    assert.equal(p.els.styletog.attrs['aria-pressed'], 'false');
    const target = { closest: (sel) => (sel === '#styletog' ? p.els.styletog : null), getAttribute: () => null, hasAttribute: () => false };
    const press = () => { for (const fn of p.listeners.click || []) fn({ target, preventDefault() {}, stopPropagation() {} }); };
    press();
    assert.equal(p.root.getAttribute('data-style'), null);
    assert.equal(p.kept['station.style'], 'classic');
    assert.equal(p.els.styletog.attrs['aria-pressed'], 'true');
    press();
    assert.equal(p.root.getAttribute('data-style'), 'keel');
    assert.equal('station.style' in p.kept, false);
    assert.equal(p.els.styletog.attrs['aria-pressed'], 'false');
});

test('a pointerdown on an action button opens the click ring, restarting it each time, and one on anything else does not', () => {
    const p = boot();
    const fire = (target) => { for (const fn of p.listeners.pointerdown || []) fn({ target }); };
    const cls = new Set();
    const ring = { classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c) }, offsetWidth: 1 };
    const target = (hit) => ({ closest: (sel) => (hit && sel.split(',').some((s) => s.trim() === hit) ? ring : null) });
    for (const hit of ['.btn.go', '#dchtog', '.td-mb']) {
        cls.clear();
        fire(target(hit));
        assert.equal(cls.has('rip'), true, hit + ' gets the ring');
    }
    cls.clear();
    fire(target('.btn'));
    fire(target(null));
    fire({});
    assert.equal(cls.has('rip'), false, 'a plain button or a bare target gets none');
    cls.add('rip');
    const log = [];
    ring.classList = { add: (c) => log.push('add ' + c), remove: (c) => log.push('remove ' + c) };
    Object.defineProperty(ring, 'offsetWidth', { get() { log.push('read'); return 1; } });
    fire(target('.btn.go'));
    assert.deepEqual(log, ['remove rip', 'read', 'add rip'], 'an old ring is taken off, the layout is read to restart it, then the new one is put on');
});

test('the switch speaks the page\'s language', () => {
    assert.equal(boot({ style: 'keel', lang: 'en' }).els.styletog.innerHTML, '<span class="sw2" aria-hidden="true"></span>Classic style');
    assert.equal(boot({ style: 'keel', lang: 'zh' }).els.styletog.innerHTML, '<span class="sw2" aria-hidden="true"></span>經典樣式');
});
