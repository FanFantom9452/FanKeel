'use strict';
// Four click handlers of station.js, one effect per test, so that two
// single-branch mutations of the same handler never redden the same set of
// tests: the TODO panel's 展開全部 / 收起 ([data-tdmore]), the left bar's
// fold and theme buttons, the 繁中 / EN switch ([data-lang]) and 概覽's stage
// mark ([data-hist], click and Enter / Space). Each handler's listener is
// picked by the selector literal in its own source, so a test reaches that
// handler alone.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const I = require('../assets/station/i18n.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const PK = 'F:\\ws';

const MANY = Array.from({ length: 12 }, (_, i) => ({
    id: 'd-' + i, label: 'd', title: 'Done ' + i, at: '2026-09-' + String(28 - i).padStart(2, '0'),
    sha: 'abcdef' + String(i).padStart(4, '0'), disposition: 'done', session: '',
}));
const TODO = { pkey: PK, mode: 'folder', folder: 'docs/todo', open: [], done: MANY };
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
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [], todos: [TODO] }],
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
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
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

// ---- [data-tdmore] -------------------------------------------------------
const TD = "'[data-tdmore]'";
const tdBoot = () => boot({ hash: '#/p/' + encodeURIComponent(PK), sessions: [session('k1')] });
const tdPress = (p, v) => fire(pick(p, 'click', TD), tgt({ '[data-tdmore]': { getAttribute: () => v } }));
const doneRows = (p) => {
    const h = p.els.page.innerHTML;
    return (h.slice(h.indexOf('data-block="todo-done"')).match(/<li class="td-row[^"]*">/g) || []).filter((r) => !/td-hd/.test(r)).length;
};

test('tdmore: 展開全部 drawn at once — the page shows the whole list right after the press', () => {
    const p = tdBoot();
    assert.equal(doneRows(p), 10);
    tdPress(p, '1');
    assert.equal(doneRows(p), 12);
});

test('tdmore: the open list is kept by a later redraw (the 3 s re-read), not only drawn once', () => {
    const p = tdBoot();
    tdPress(p, '1');
    p.els.page.innerHTML = 'SENTINEL';
    for (const fn of p.winL.hashchange) fn();
    assert.equal(doneRows(p), 12);
});

test('tdmore: a press of 收起 on a list that is already shut leaves it shut', () => {
    const p = tdBoot();
    tdPress(p, '0');
    assert.equal(doneRows(p), 10);
});

test('tdmore: a click off the button draws nothing and does not throw', () => {
    const p = tdBoot();
    p.els.page.innerHTML = 'SENTINEL';
    assert.doesNotThrow(() => fire(pick(p, 'click', TD), tgt({})));
    assert.equal(p.els.page.innerHTML, 'SENTINEL');
});

test('tdmore: a click with no target at all does not throw', () => {
    const p = tdBoot();
    assert.doesNotThrow(() => pick(p, 'click', TD)({}));
});

test('tdmore: a click whose target has no closest does not throw', () => {
    const p = tdBoot();
    assert.doesNotThrow(() => pick(p, 'click', TD)({ target: {} }));
});

// ---- #nav fold and theme -------------------------------------------------
const NAV = "'#nav [data-navfold], #nav [data-themecycle]'";
const SHUT = { 'station.nav.collapsed': '{"sessions":true}' };
const navBtn = (attrs) => ({ attrs, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, hasAttribute(k) { return k in this.attrs; },
    setAttribute(k, v) { this.attrs[k] = String(v); } });
// A fold button inside its row; the row answers the one selector the handler asks.
function foldRig(p, o) {
    o = o || {};
    const btn = navBtn({ 'data-navfold': 'sessions', 'aria-expanded': o.aria || 'true' });
    const li = { shut: !!o.liShut, classList: { toggle(c, f) { li.shut = f === undefined ? !li.shut : !!f; return li.shut; } },
        querySelector: (sel) => (sel === '[data-navfold]' && !o.noBtn ? btn : null) };
    p.qs = (sel) => (sel === '#nav [data-fold="sessions"]' && !o.noLi ? li : null);
    return { btn, li, press: () => fire(pick(p, 'click', NAV), tgt({ '#nav [data-navfold], #nav [data-themecycle]': btn })) };
}
const themePress = (p, v) => fire(pick(p, 'click', NAV), tgt({ '#nav [data-navfold], #nav [data-themecycle]': navBtn({ 'data-themecycle': v }) }));
const COLL = 'station.nav.collapsed';

test('nav fold: shutting a fold stores it in station.nav.collapsed', () => {
    const p = boot();
    foldRig(p).press();
    assert.equal(p.kept[COLL], '{"sessions":true}');
});

test('nav fold: opening a shut fold stores the empty set', () => {
    const p = boot({ kept: SHUT });
    foldRig(p).press();
    assert.equal(p.kept[COLL], '{}');
});

test('nav fold: two presses leave the row open, so the memory behind the toggle follows each press', () => {
    const p = boot();
    const r = foldRig(p);
    r.press();
    r.press();
    assert.equal(r.li.shut, false);
});

test('nav fold: a press on an open row puts the shut class on it', () => {
    const p = boot();
    const r = foldRig(p);
    r.press();
    assert.equal(r.li.shut, true);
});

test('nav fold: a press on a shut row whose class is there takes the class off', () => {
    const p = boot({ kept: SHUT });
    const r = foldRig(p, { liShut: true });
    r.press();
    assert.equal(r.li.shut, false);
});

test('nav fold: a press that opens a fold sets the class to off even when the row did not carry it', () => {
    const p = boot({ kept: SHUT });
    const r = foldRig(p, { liShut: false });
    r.press();
    assert.equal(r.li.shut, false);
});

test('nav fold: shutting sets aria-expanded to false on the chevron button', () => {
    const p = boot();
    const r = foldRig(p, { aria: 'true' });
    r.press();
    assert.equal(r.btn.attrs['aria-expanded'], 'false');
});

test('nav fold: opening sets aria-expanded to true on the chevron button', () => {
    const p = boot({ kept: SHUT });
    const r = foldRig(p, { aria: 'false' });
    r.press();
    assert.equal(r.btn.attrs['aria-expanded'], 'true');
});

test('nav fold: a button that already reads false stays false when the press shuts', () => {
    const p = boot();
    const r = foldRig(p, { aria: 'false' });
    r.press();
    assert.equal(r.btn.attrs['aria-expanded'], 'false');
});

test('nav fold: a button that already reads true stays true when the press opens', () => {
    const p = boot({ kept: SHUT });
    const r = foldRig(p, { aria: 'true' });
    r.press();
    assert.equal(r.btn.attrs['aria-expanded'], 'true');
});

test('nav fold: a row the page does not hold still stores the fold and does not throw', () => {
    const p = boot();
    const r = foldRig(p, { noLi: true });
    assert.doesNotThrow(() => r.press());
    assert.equal(p.kept[COLL], '{"sessions":true}');
});

test('nav fold: a row with no chevron button is still toggled and does not throw', () => {
    const p = boot();
    const r = foldRig(p, { noBtn: true });
    assert.doesNotThrow(() => r.press());
    assert.equal(r.li.shut, true);
});

test('nav fold: a fold press leaves the stored theme alone', () => {
    const p = boot({ kept: { 'station.theme': 'dark' } });
    foldRig(p).press();
    assert.equal(p.kept['station.theme'], 'dark');
});

test('nav fold: a fold press does not redraw the bar, so the row keeps its height transition', () => {
    const p = boot();
    const r = foldRig(p);
    p.els.nav.innerHTML = 'SENTINEL';
    r.press();
    assert.equal(p.els.nav.innerHTML, 'SENTINEL');
});

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

test('nav theme: the bar is redrawn so the button names the next theme', () => {
    const p = boot();
    const before = p.els.nav.innerHTML;
    themePress(p, 'light');
    assert.notEqual(p.els.nav.innerHTML, before);
    assert.match(p.els.nav.innerHTML, /data-themecycle=/);
});

test('nav: a click off the bar, or with no closest, changes nothing and does not throw', () => {
    const p = boot();
    const fn = pick(p, 'click', NAV);
    p.els.nav.innerHTML = 'SENTINEL';
    assert.doesNotThrow(() => fire(fn, tgt({})));
    assert.equal(p.els.nav.innerHTML, 'SENTINEL');
    assert.equal(COLL in p.kept, false);
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
const GO = (p, hash) => { p.win.location.hash = hash; for (const fn of p.winL.hashchange) fn(); };

test('hist: a first press on a stage marks it', () => {
    const p = hBoot();
    assert.equal(marked(p, 'build'), false);
    click(p, histEl('build'));
    assert.equal(marked(p, 'build'), true);
});

test('hist: a second press on the same stage clears the mark', () => {
    const p = hBoot();
    click(p, histEl('build'));
    click(p, histEl('build'));
    assert.equal(marked(p, 'build'), false);
});

test('hist: a press on another stage of the same session moves the mark', () => {
    const p = hBoot();
    click(p, histEl('build'));
    click(p, histEl('verify'));
    assert.equal(marked(p, 'verify'), true);
    assert.equal(marked(p, 'build'), false);
});

test('hist: the same stage pressed on another session marks it there rather than clearing', () => {
    const p = hBoot();
    click(p, histEl('build'));
    GO(p, '#/s/k2');
    assert.equal(marked(p, 'build'), false, 'another session opens unmarked');
    click(p, histEl('build'));
    assert.equal(marked(p, 'build'), true);
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

test('hist: a mark made on a press is still there after the next redraw', () => {
    const p = hBoot();
    click(p, histEl('build'));
    p.els.page.innerHTML = 'SENTINEL';
    for (const fn of p.winL.hashchange) fn();
    assert.equal(marked(p, 'build'), true);
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

test('hist: Enter on a table row marks the stage', () => {
    const p = hBoot();
    key(p, 'Enter', histEl('build', 'csrow', 'TR'));
    assert.equal(marked(p, 'build'), true);
});

test('hist: Space on a table row marks the stage', () => {
    const p = hBoot();
    key(p, ' ', histEl('build', 'csrow', 'TR'));
    assert.equal(marked(p, 'build'), true);
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
