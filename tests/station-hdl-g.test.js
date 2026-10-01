'use strict';
// Five branches of the page's click listener in assets/station/station.js
// (the one holding `.wz [data-go]`), pressed through the page's own listener
// list with fake targets: the 篩選 panel's single checkbox and its 全選 /
// 全不選 buttons, the floating bell, one note's close button and 清掉通知.
// Each test is red under a different set of single-branch mutations.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const CLICK_PAGE = 6;
const MARK = '.wz [data-go]';

// station.js booted on `hash` with every document listener kept, the `#page`
// and `#fk` elements counting their redraws, and (with `serve`) the poll's
// own refresh kept so a settled tune request can seed the notes list.
function boot(hash, serve) {
    const listeners = {}, els = {}, intervals = [], scripts = [], asked = { n: 0 };
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    const counted = (id) => {
        const o = el('div');
        let html = '';
        o.draws = 0;
        Object.defineProperty(o, 'innerHTML', { get: () => html, set: (v) => { html = v; o.draws++; } });
        els[id] = o;
        return o;
    };
    const page = counted('page'), fk = counted('fk');
    const day = '2026-10-01';
    const sessions = (items) => [{ id: 'sid0', pkey: 'F:\\ws\\alpha', task: 'alpha one', state: 'live', updated: NOW - 1000, started: NOW - 60000, stage: 'build',
        tune: { done: 0, items },
        days: [{ day, model: 'claude-opus-4-1', usd: 3, tokens: { input: 10 } }, { day, model: 'claude-sonnet-4-5', usd: 2, tokens: { input: 5 } }] }];
    const station = (items) => ({ generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: Boolean(serve),
        projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
        profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: sessions(items) });
    const win = { location: { hash, protocol: serve ? 'http:' : 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: (fn) => { intervals.push(fn); return 1; }, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        Notification: { permission: 'denied', requestPermission() { asked.n++; return { then() {} }; } },
        STATION: station([{ id: 'n1', block: 'blk-one', status: 'taken' }, { id: 'n2', block: 'blk-two', status: 'taken' }]) };
    const named = {};
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        createElement: (t) => { const o = el(t); if (t === 'script') scripts.push(o); return o; }, querySelectorAll: () => [],
        querySelector(sel) { return sel in named ? named[sel] : null; }, head: { appendChild() {} } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } });
    const fn = listeners.click[CLICK_PAGE];
    assert.equal(typeof fn, 'function', 'the click listener number ' + CLICK_PAGE + ' exists');
    assert.ok(String(fn).includes(MARK), 'the click listener number ' + CLICK_PAGE + ' is the one holding ' + MARK);
    // Both notes settle: tune finishes n1 and turns n2 down, the poll files two notes.
    const settle = () => {
        intervals[0]();
        win.STATION = station([{ id: 'n1', block: 'blk-one', status: 'done' }, { id: 'n2', block: 'blk-two', status: 'rejected' }]);
        scripts[scripts.length - 1].onload();
    };
    return { fn, asked, page, fk, named, win, settle, el: () => el(), draws: () => page.draws, fkDraws: () => fk.draws, html: () => page.innerHTML, fkHtml: () => fk.innerHTML,
        reset() { page.draws = 0; fk.draws = 0; } };
}

function ev(props) {
    const e = Object.assign({}, props);
    e.prevented = 0;
    e.preventDefault = () => { e.prevented++; };
    return e;
}
// A target whose closest() answers the selectors it was given and nothing else.
function tgt(answers) { return { tagName: 'DIV', closest: (sel) => (sel in answers ? answers[sel] : null) }; }
const spy = () => ({ focused: 0, focus() { this.focused++; } });
const fkBox = (key, checked) => ({ checked, getAttribute: (k) => (k === 'data-fk' ? key : null) });
const fallBtn = (v) => ({ getAttribute: (k) => (k === 'data-fall' ? v : null) });
const noteX = (id) => ({ closest: (s) => (s === '.nt' ? { getAttribute: (k) => (k === 'data-note' ? id : null) } : null) });

const OPUS = 'opus-4-1', SONNET = 'sonnet-4-5';
const FK = '.fpanel [data-fk]', FALL = '.fpanel [data-fall]';
// What the page marks off: the legend entries rebuilt with data-off.
function offOf(p) {
    const out = [];
    p.html().replace(/<span data-key="([^"]*)"[^>]*data-off/g, (m, k) => { out.push(k); return m; });
    return out.sort().join(',');
}
const panelShown = (p) => p.html().includes('data-fk="');
// The days page with its 篩選 panel opened by the button's own click.
function panel() {
    const p = boot('#/days');
    p.fn({ target: tgt({ '[data-fbtn]': {} }) });
    assert.ok(panelShown(p), 'the panel is open');
    p.reset();
    return p;
}
const press = (p, answers) => { const e = ev({ target: tgt(answers) }); p.fn(e); return e; };
const noteIds = (p) => (p.fkHtml().match(/data-note="[^"]*"/g) || []).map((x) => x.slice(11, -1)).join(',');
// Two notes filed by the poll: n1 done, n2 turned down.
function notes() {
    const p = boot('#/days', true);
    p.settle();
    assert.equal(noteIds(p), 'n1,n2', 'both notes are filed');
    p.reset();
    return p;
}
const bell = (p) => p.fn({ target: tgt({ '[data-fkb]': {} }) });
// The notes the float panel shows after one more redraw, pressed through the bell.
const listed = (p) => { bell(p); return noteIds(p); };

// ---- .fpanel [data-fk] ---------------------------------------------------
test('unchecking one 篩選 checkbox takes that key off the chart and no other', () => {
    const p = panel();
    press(p, { [FK]: fkBox(OPUS, false) });
    assert.equal(offOf(p), OPUS);
});

test('a second key unchecked is its own key, the first stays off', () => {
    const p = panel();
    press(p, { [FK]: fkBox(OPUS, false) });
    press(p, { [FK]: fkBox(SONNET, false) });
    assert.equal(offOf(p), OPUS + ',' + SONNET);
});

test('checking a key puts it back and leaves the others off', () => {
    const p = panel();
    press(p, { [FALL]: fallBtn('off') });
    press(p, { [FK]: fkBox(SONNET, true) });
    assert.equal(offOf(p), OPUS);
});

test('a checkbox press redraws the page once and keeps the panel open', () => {
    const p = panel();
    press(p, { [FK]: fkBox(OPUS, false) });
    assert.equal(p.draws(), 1);
    assert.ok(panelShown(p));
});

test('a checkbox press puts focus on that checkbox in the new DOM, found by its key', () => {
    const p = panel();
    const box = spy(), other = spy();
    p.named['.fpanel [data-fk="' + OPUS + '"]'] = box;
    p.named['.fpanel [data-fk="' + SONNET + '"]'] = other;
    press(p, { [FK]: fkBox(OPUS, false) });
    assert.equal(box.focused, 1);
    assert.equal(other.focused, 0);
});

test('a checkbox press does not look for focus under a selector that names no key', () => {
    const p = panel();
    const anyBox = spy();
    p.named['.fpanel [data-fk]'] = anyBox;
    press(p, { [FK]: fkBox(OPUS, false) });
    assert.equal(anyBox.focused, 0);
});

test('unchecking a key that is already off leaves it off', () => {
    const p = panel();
    press(p, { [FALL]: fallBtn('off') });
    press(p, { [FK]: fkBox(OPUS, false) });
    assert.equal(offOf(p), OPUS + ',' + SONNET);
});

test('a checkbox press stops there: a target that is also a 全選 button is read as the checkbox only', () => {
    const p = panel();
    press(p, { [FK]: fkBox(OPUS, false), [FALL]: fallBtn('on') });
    assert.equal(offOf(p), OPUS);
});

test('a checkbox press that is also a 全選 button redraws once', () => {
    const p = panel();
    press(p, { [FK]: fkBox(OPUS, false), [FALL]: fallBtn('on') });
    assert.equal(p.draws(), 1);
});

test('a checkbox press does not go on to the later branches', () => {
    const p = panel();
    press(p, { [FK]: fkBox(OPUS, false), '[data-tune-notify]': {} });
    assert.equal(p.asked.n, 0);
});

test('off the days page a checkbox press does nothing', () => {
    const p = boot('#/projects');
    p.reset();
    press(p, { [FK]: fkBox(OPUS, false) });
    assert.equal(p.draws(), 0);
});

// ---- .fpanel [data-fall] -------------------------------------------------
test('全不選 takes every key off the chart', () => {
    const p = panel();
    press(p, { [FALL]: fallBtn('off') });
    assert.equal(offOf(p), OPUS + ',' + SONNET);
});

test('全選 puts every key back', () => {
    const p = panel();
    press(p, { [FALL]: fallBtn('off') });
    press(p, { [FALL]: fallBtn('on') });
    assert.equal(offOf(p), '');
});

test('全選 puts back a key a checkbox took off', () => {
    const p = panel();
    press(p, { [FK]: fkBox(OPUS, false) });
    press(p, { [FALL]: fallBtn('on') });
    assert.equal(offOf(p), '');
});

test('a 全不選 press redraws once and keeps the panel open', () => {
    const p = panel();
    press(p, { [FALL]: fallBtn('off') });
    assert.equal(p.draws(), 1);
    assert.ok(panelShown(p));
});

test('a 全選 press keeps the panel open', () => {
    const p = panel();
    press(p, { [FALL]: fallBtn('on') });
    assert.ok(panelShown(p));
});

test('a 全不選 press puts focus on that button, found by its value, and 全選 on its own', () => {
    const p = panel();
    const off = spy(), on = spy();
    p.named['.fpanel [data-fall="off"]'] = off;
    p.named['.fpanel [data-fall="on"]'] = on;
    press(p, { [FALL]: fallBtn('off') });
    assert.equal(off.focused, 1);
    assert.equal(on.focused, 0);
    press(p, { [FALL]: fallBtn('on') });
    assert.equal(off.focused, 1);
    assert.equal(on.focused, 1);
});

test('a 全不選 press does not look for focus under a selector that names no button', () => {
    const p = panel();
    const anyBtn = spy();
    p.named['.fpanel [data-fall]'] = anyBtn;
    press(p, { [FALL]: fallBtn('off') });
    assert.equal(anyBtn.focused, 0);
});

test('a 全選 press does not go on to the later branches', () => {
    const p = panel();
    press(p, { [FALL]: fallBtn('on'), '[data-tune-notify]': {} });
    assert.equal(p.asked.n, 0);
});

test('off the days page a 全不選 press does nothing', () => {
    const p = boot('#/projects');
    p.reset();
    assert.doesNotThrow(() => press(p, { [FALL]: fallBtn('off') }));
    assert.equal(p.draws(), 0);
});

// ---- [data-fkb] ----------------------------------------------------------
test('the bell opens the floating panel and the next press shuts it', () => {
    const p = notes();
    assert.match(p.fkHtml(), /data-fkb aria-expanded="false"/);
    assert.match(p.fkHtml(), /id="fkp"[^>]* hidden>/);
    bell(p);
    assert.match(p.fkHtml(), /data-fkb aria-expanded="true"/);
    assert.doesNotMatch(p.fkHtml(), /id="fkp"[^>]* hidden>/);
    bell(p);
    assert.match(p.fkHtml(), /data-fkb aria-expanded="false"/);
});

test('the bell redraws the floating panel once and not the page', () => {
    const p = notes();
    bell(p);
    assert.equal(p.fkDraws(), 1);
    assert.equal(p.draws(), 0);
});

test('the bell stops there: a target that is also a close button closes nothing', () => {
    const p = notes();
    press(p, { '[data-fkb]': {}, '[data-note-x]': noteX('n1') });
    assert.equal(noteIds(p), 'n1,n2');
    assert.match(p.fkHtml(), /data-fkb aria-expanded="true"/);
});

test('the bell does not go on to the later branches', () => {
    const p = notes();
    press(p, { '[data-fkb]': {}, '[data-tune-notify]': {} });
    assert.equal(p.asked.n, 0);
});

test('the bell also toggles on a page that is not the days page', () => {
    const p = boot('#/projects');
    p.fk.draws = 0;
    bell(p);
    assert.equal(p.fkDraws(), 1);
    assert.match(p.fkHtml(), /data-fkb aria-expanded="true"/);
});

// ---- [data-note-x] -------------------------------------------------------
test('a note close button redraws the floating panel once', () => {
    const p = notes();
    press(p, { '[data-note-x]': noteX('n1') });
    assert.equal(p.fkDraws(), 1);
    assert.equal(p.draws(), 0);
});

test('the closed note is gone from the list', () => {
    const p = notes();
    press(p, { '[data-note-x]': noteX('n1') });
    assert.doesNotMatch(listed(p), /n1/);
});

test('the other note stays after one is closed', () => {
    const p = notes();
    press(p, { '[data-note-x]': noteX('n1') });
    assert.match(listed(p), /n2/);
});

test('the second note closes by its own id', () => {
    const p = notes();
    press(p, { '[data-note-x]': noteX('n2') });
    assert.equal(listed(p), 'n1');
});

test('a close button stops there: a target that is also 清掉通知 keeps the other note', () => {
    const p = notes();
    press(p, { '[data-note-x]': noteX('n1'), '[data-note-clear]': {} });
    assert.equal(listed(p), 'n2');
});

test('a close button does not go on to the later branches', () => {
    const p = notes();
    press(p, { '[data-note-x]': noteX('n1'), '[data-tune-notify]': {} });
    assert.equal(p.asked.n, 0);
});

// ---- [data-note-clear] ---------------------------------------------------
test('清掉通知 redraws the floating panel once', () => {
    const p = notes();
    press(p, { '[data-note-clear]': {} });
    assert.equal(p.fkDraws(), 1);
    assert.equal(p.draws(), 0);
});

test('清掉通知 empties the list', () => {
    const p = notes();
    press(p, { '[data-note-clear]': {} });
    assert.equal(listed(p), '');
});

test('清掉通知 shows no notes in the panel it redraws', () => {
    const p = notes();
    press(p, { '[data-note-clear]': {} });
    assert.equal(noteIds(p), '');
    assert.match(p.fkHtml(), /fkempty/);
});

test('清掉通知 after one note was closed empties the rest', () => {
    const p = notes();
    press(p, { '[data-note-x]': noteX('n1') });
    press(p, { '[data-note-clear]': {} });
    assert.equal(listed(p), '');
});

test('the bell is read before 清掉通知: a target that is both keeps every note', () => {
    const p = notes();
    press(p, { '[data-fkb]': {}, '[data-note-clear]': {} });
    assert.equal(noteIds(p), 'n1,n2');
});

test('a click on nothing redraws nothing and keeps every note', () => {
    const p = notes();
    press(p, {});
    assert.equal(p.draws(), 0);
    assert.equal(p.fkDraws(), 0);
    assert.equal(listed(p), 'n1,n2');
    assert.match(p.fkHtml(), /data-fkb aria-expanded="true"/);
});

test('清掉通知 does not go on to the later branches', () => {
    const p = notes();
    press(p, { '[data-note-clear]': {}, '[data-tune-notify]': {} });
    assert.equal(p.asked.n, 0);
});

