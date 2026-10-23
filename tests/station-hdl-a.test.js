'use strict';
// Click handlers of station.js, one effect per test, so that two
// single-branch mutations of the same handler never redden the same set of
// tests: the left bar's fold and theme buttons, the 繁中 / EN switch
// ([data-lang]) and 概覽's stage
// mark ([data-hist], click and Enter / Space). Each handler's listener is
// picked by the selector literal in its own source, so a test reaches that
// handler alone.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const I = require('../assets/station/i18n.js');

const { SRC } = require('./station-src.js');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const PK = 'F:\\ws';

const session = (id) => ({ id, pkey: PK, root: PK, task: 't-' + id, state: 'live', route: ['survey', 'build', 'verify'], stage: 'build',
    stages: [], backtracks: 0, updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(),
    days: [{ stage: 'build', who: 'main', usd: 1 }, { stage: 'verify', who: 'main', usd: 2 }, { stage: 'survey', who: 'main', usd: 0.5 }] });

// station.js in a vm with the document's and the window's listeners kept.
function boot(o) {
    o = o || {};
    const kept = Object.assign({}, o.kept);
    const listeners = {}, winL = {}, els = {};
    const p = { kept, listeners, winL, els, reloads: 0, setCalls: [], qs: () => null, qsCalls: [] };
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '', placeholder: '',
        attrs: {}, style: {}, children: [], hidden: false, parentNode: null, focused: 0,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {},
        focus() { this.focused++; } });
    const root = el('html');
    p.root = root;
    const win = { location: { hash: o.hash || '#/', protocol: 'file:', reload() { p.reloads++; } },
        addEventListener(type, fn) { (winL[type] = winL[type] || []).push(fn); }, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: Boolean(o.serve), nonce: o.nonce,
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: o.sessions || [] } };
    p.win = win;
    const doc = { hidden: false, documentElement: root, title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: (sel) => { p.qsCalls.push(sel); return p.qs(sel); }, head: { appendChild() {} } };
    p.doc = doc;
    if (o.i18n) {
        const real = I.make(win);
        win.FK_I18N = Object.assign({}, real, { set(l) { p.setCalls.push(l); return o.i18n.ret; } });
    }
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: o.fetch || (() => Promise.resolve({ ok: true })), module: { exports: {} } });
    return p;
}
// The one listener of `type` whose source holds `needle`.
function pick(p, type, needle) {
    const fns = (p.listeners[type] || []).filter((fn) => fn.toString().includes(needle));
    assert.equal(fns.length, 1, 'one ' + type + ' listener holds ' + needle);
    return fns[0];
}
const fire = (fn, target, extra) => { const ev = Object.assign({ target, prevented: 0, preventDefault() { this.prevented++; } }, extra); fn(ev); return ev; };
const tgt = (map) => ({ closest: (sel) => (sel in map ? map[sel] : null), getAttribute: () => null, hasAttribute: () => false });

// ---- theme -------------------------------------------------
const NAV = "'[data-themecycle]'";
const navBtn = (attrs) => ({ attrs, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, hasAttribute(k) { return k in this.attrs; },
    setAttribute(k, v) { this.attrs[k] = String(v); } });
const themePress = (p, v) => fire(pick(p, 'click', NAV), tgt({ '[data-themecycle]': navBtn({ 'data-themecycle': v }) }));

test('nav theme: pressing a theme stores it', () => {
    const p = boot();
    themePress(p, 'dark');
    assert.equal(p.kept['station.theme'], 'dark');
});

test('nav theme: pressing system clears a stored theme', () => {
    const p = boot({ kept: { 'station.theme': 'dark' } });
    themePress(p, 'system');
    assert.equal('station.theme' in p.kept, false);
});

test('nav theme: pressing system with nothing stored stores nothing', () => {
    const p = boot();
    themePress(p, 'system');
    assert.equal('station.theme' in p.kept, false);
});

test('nav theme: the page takes the theme at once, and system takes the attribute off', () => {
    const p = boot({ kept: { 'station.theme': 'light' } });
    themePress(p, 'dark');
    assert.equal(p.root.attrs['data-theme'], 'dark');
    themePress(p, 'system');
    assert.equal('data-theme' in p.root.attrs, false);
});

test('nav theme: the masthead button is redrawn so it names the next theme, and the bar is left alone', () => {
    const p = boot();
    p.els.nav.innerHTML = 'SENTINEL';
    themePress(p, 'light');
    assert.match(p.els.appear.innerHTML, /data-themecycle="dark"/);
    assert.equal(p.els.nav.innerHTML, 'SENTINEL');
});

test('nav: a click off the bar, or with no closest, changes nothing and does not throw', () => {
    const p = boot();
    const fn = pick(p, 'click', NAV);
    p.els.nav.innerHTML = 'SENTINEL';
    assert.doesNotThrow(() => fire(fn, tgt({})));
    assert.equal(p.els.nav.innerHTML, 'SENTINEL');
});

test('nav: a target without closest does not throw', () => {
    const p = boot();
    assert.doesNotThrow(() => pick(p, 'click', NAV)({ target: {} }));
});

// ---- [data-lang] ---------------------------------------------------------
const LANG = "'[data-lang]'";
const langPress = (p, v) => fire(pick(p, 'click', LANG), tgt({ '[data-lang]': { getAttribute: (k) => (k === 'data-lang' ? v : null) } }));

test('lang: the press hands the button\'s language to I18N.set, once', () => {
    const p = boot({ i18n: { ret: true } });
    langPress(p, 'en');
    assert.deepEqual(p.setCalls, ['en']);
});

test('lang: a language that took reloads the page, once', () => {
    const p = boot({ i18n: { ret: true } });
    langPress(p, 'en');
    assert.equal(p.reloads, 1);
});

test('lang: a language that was refused does not reload the page', () => {
    const p = boot({ i18n: { ret: false } });
    langPress(p, 'fr');
    assert.equal(p.reloads, 0);
});

// A fetch that holds the profile write until the test answers it; anything else the page asks is answered at once.
function profileFetch() {
    const f = { posts: [], answer: null };
    f.fn = (url, init) => {
        if (url !== 'profile') return Promise.resolve({ ok: true, text: () => Promise.resolve(''), json: () => Promise.resolve({}) });
        f.posts.push({ url, init });
        return new Promise((r) => { f.answer = r; });
    };
    return f;
}

test('lang: served, the press writes ui.lang to the machine profile and reloads once the write is back', async () => {
    const f = profileFetch();
    const p = boot({ i18n: { ret: true }, serve: true, nonce: 'n0', fetch: f.fn });
    langPress(p, 'en');
    assert.equal(f.posts.length, 1);
    assert.equal(f.posts[0].init.method, 'POST');
    const body = f.posts[0].init.body;
    assert.deepEqual(['nonce', 'scope', 'key', 'value'].map((k) => body.get(k)), ['n0', 'machine', 'ui.lang', 'en']);
    assert.equal(p.reloads, 0, 'not before the write is back');
    f.answer({ ok: true });
    await new Promise((r) => setImmediate(r));
    assert.equal(p.reloads, 1);
});

// A write that failed keeps the old language on the machine profile, which pick() puts ahead of the browser's; a reload would show it silently.
const failedWrite = async (fetchFn) => {
    const p = boot({ i18n: { ret: true }, serve: true, nonce: 'n0', fetch: fetchFn });
    langPress(p, 'en');
    await new Promise((r) => setImmediate(r));
    return p;
};
const noteOf = (p) => p.els.langnote;

test('lang: served, a write answered not-ok does not reload and shows a notice', async () => {
    const p = await failedWrite(() => Promise.resolve({ ok: false }));
    assert.equal(p.reloads, 0);
    assert.match(noteOf(p).textContent, /不|沒/);
});

test('lang: served, a write that is rejected does not reload and shows a notice', async () => {
    const p = await failedWrite(() => Promise.reject(new Error('down')));
    assert.equal(p.reloads, 0);
    assert.match(noteOf(p).textContent, /不|沒/);
});

test('lang: a page not served writes no profile and reloads at once', () => {
    const f = profileFetch();
    const p = boot({ i18n: { ret: true }, fetch: f.fn });
    langPress(p, 'en');
    assert.deepEqual(f.posts, []);
    assert.equal(p.reloads, 1);
});

test('lang: a refused language writes no profile', () => {
    const f = profileFetch();
    const p = boot({ i18n: { ret: false }, serve: true, fetch: f.fn });
    langPress(p, 'fr');
    assert.deepEqual(f.posts, []);
});

test('lang: a click off the switch sets nothing and reloads nothing', () => {
    const p = boot({ i18n: { ret: true } });
    assert.doesNotThrow(() => fire(pick(p, 'click', LANG), tgt({})));
    assert.deepEqual(p.setCalls, []);
    assert.equal(p.reloads, 0);
});

test('lang: without i18n.js a press does nothing and does not throw', () => {
    const p = boot();
    assert.doesNotThrow(() => langPress(p, 'en'));
    assert.equal(p.reloads, 0);
});

test('lang: a click with no target at all does not throw', () => {
    const p = boot({ i18n: { ret: true } });
    assert.doesNotThrow(() => pick(p, 'click', LANG)({}));
});

test('lang: a click whose target has no closest does not throw or reload', () => {
    const p = boot({ i18n: { ret: true } });
    assert.doesNotThrow(() => pick(p, 'click', LANG)({ target: {} }));
    assert.equal(p.reloads, 0);
});

// ---- [data-hist] click and keydown --------------------------------------
const HC = "'[data-hist]'";
const HK = "'tr[data-hist]'";
const hBoot = (hash) => boot({ hash: hash || '#/s/k1', sessions: [session('k1'), session('k2')] });
const histEl = (k, cls, tag) => ({ tagName: tag || 'BUTTON', attrs: { 'data-hist': k, class: cls || 'csseg' }, focused: 0,
    getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }, hasAttribute(n) { return n in this.attrs; }, focus() { this.focused++; } });
const click = (p, el) => fire(pick(p, 'click', HC), tgt({ '[data-hist]': el }));
const key = (p, k, el) => fire(pick(p, 'keydown', HK), tgt({ 'tr[data-hist]': el }), { key: k });
const marked = (p, k) => p.els.page.innerHTML.includes('class="csseg on" data-hist="' + k + '"');

test('hist: a second press on the same stage clears the mark', () => {
    const p = hBoot();
    click(p, histEl('build'));
    click(p, histEl('build'));
    assert.equal(marked(p, 'build'), false);
});

test('hist: a press off the bar on a session page draws nothing and does not throw', () => {
    const p = hBoot();
    p.els.page.innerHTML = 'SENTINEL';
    assert.doesNotThrow(() => fire(pick(p, 'click', HC), tgt({})));
    assert.equal(p.els.page.innerHTML, 'SENTINEL');
});

test('hist: a press on a stage mark outside a session page does nothing', () => {
    const p = hBoot('#/');
    p.els.page.innerHTML = 'SENTINEL';
    click(p, histEl('build'));
    assert.equal(p.els.page.innerHTML, 'SENTINEL');
});

test('hist: a session page press whose target has no closest does not throw', () => {
    const p = hBoot();
    assert.doesNotThrow(() => pick(p, 'click', HC)({ target: {} }));
});

test('hist: the pressed button gets the focus back after the redraw', () => {
    const p = hBoot();
    const el = histEl('build', 'csseg on extra');
    const back = histEl('build');
    p.doc.activeElement = el;
    p.qs = (sel) => (sel === '.csseg[data-hist="build"]' ? back : null);
    click(p, el);
    assert.equal(back.focused, 1);
});

test('hist: whatever button the lookup finds takes the focus', () => {
    const p = hBoot();
    const el = histEl('build');
    const back = histEl('build');
    p.doc.activeElement = el;
    p.qs = () => back;
    click(p, el);
    assert.equal(back.focused, 1);
});

test('hist: a class string of several words is split, so the selector that finds the button again is built from a single word', () => {
    const p = hBoot();
    const el = histEl('build', 'csseg csseg');
    const back = histEl('build');
    p.doc.activeElement = el;
    p.qs = (sel) => (sel === '.csseg[data-hist="build"]' ? back : null);
    click(p, el);
    assert.equal(back.focused, 1);
});

test('hist: a press while another element has the focus gives nothing the focus', () => {
    const p = hBoot();
    const back = histEl('build');
    p.doc.activeElement = histEl('verify');
    p.qs = () => back;
    click(p, histEl('build'));
    assert.equal(back.focused, 0);
    assert.equal(p.qsCalls.some((s) => /data-hist/.test(s)), false);
});

test('hist: a press on a chart bar (rect) does not look for a button to focus', () => {
    const p = hBoot();
    const back = histEl('build');
    const rect = histEl('build', 'seg x', 'rect');
    p.doc.activeElement = rect;
    p.qs = () => back;
    click(p, rect);
    assert.equal(back.focused, 0);
});

test('hist: a stage key with a quote is escaped in the selector that finds the button again', () => {
    const p = hBoot();
    const el = histEl('a"b');
    const back = histEl('a"b');
    p.doc.activeElement = el;
    p.qs = (sel) => (sel === '.csseg[data-hist="a\\"b"]' ? back : null);
    click(p, el);
    assert.equal(back.focused, 1);
});

test('hist: any other key on a table row marks nothing and is not swallowed', () => {
    const p = hBoot();
    p.els.page.innerHTML = 'SENTINEL';
    const ev = key(p, 'a', histEl('build', 'csrow', 'TR'));
    assert.equal(p.els.page.innerHTML, 'SENTINEL');
    assert.equal(ev.prevented, 0);
});

test('hist: Enter on a table row is swallowed so the page does not scroll', () => {
    const p = hBoot();
    const ev = key(p, 'Enter', histEl('build', 'csrow', 'TR'));
    assert.equal(ev.prevented, 1);
});

test('hist: Enter on a row outside a session page does nothing', () => {
    const p = hBoot('#/');
    p.els.page.innerHTML = 'SENTINEL';
    const ev = key(p, 'Enter', histEl('build', 'csrow', 'TR'));
    assert.equal(p.els.page.innerHTML, 'SENTINEL');
    assert.equal(ev.prevented, 0);
});

test('hist: Enter off a table row on a session page marks nothing and does not throw', () => {
    const p = hBoot();
    p.els.page.innerHTML = 'SENTINEL';
    assert.doesNotThrow(() => fire(pick(p, 'keydown', HK), tgt({}), { key: 'Enter' }));
    assert.equal(p.els.page.innerHTML, 'SENTINEL');
});

test('hist: Enter on a session page target without closest does not throw', () => {
    const p = hBoot();
    assert.doesNotThrow(() => pick(p, 'keydown', HK)({ key: 'Enter', target: {}, preventDefault() {} }));
});
