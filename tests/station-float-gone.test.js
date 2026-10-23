'use strict';
// The bell panel as the page drives it (station-50): the × on an Editing row,
// 清掉通知 over editing rows, what is kept in localStorage, and notes turning
// grey once the panel has been open. The harness is that of
// tests/station-hdl-g.test.js, pressed through the page's own click listener.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const KEY = 'station.fkGone';

function boot(kept, two) {
    const listeners = {}, els = {}, intervals = [], scripts = [], saved = Object.assign({}, kept);
    let fetches = 0;
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
    const fk = counted('fk');
    counted('page');
    const day = '2026-10-01';
    const sessions = (items) => [{ id: 'sid0', pkey: 'F:\\ws\\alpha', task: 'alpha one', state: 'live', updated: NOW - 1000, started: NOW - 60000, stage: 'build',
        tune: { done: 0, items },
        days: [{ day, model: 'claude-opus-4-1', usd: 3, tokens: { input: 10 } }, { day, model: 'claude-sonnet-4-5', usd: 2, tokens: { input: 5 } }] }];
    const beta = () => ({ id: 'sid1', pkey: 'F:\\ws\\beta', task: 'beta one', state: 'live', updated: NOW - 1000, started: NOW - 60000, stage: 'build',
        tune: { done: 0, items: [{ id: 'r-0001', block: 'blk-beta', status: 'taken' }] }, days: [] });
    const station = (items) => ({ generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: true,
        projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
        profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: two ? [sessions([{ id: 'r-0001', block: 'blk-alpha', status: 'taken' }])[0], beta()] : sessions(items) });
    const win = { location: { hash: '#/days', protocol: 'http:' }, addEventListener() {}, scrollTo() {},
        setInterval: (fn) => { intervals.push(fn); return 1; }, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (k in saved ? saved[k] : null), setItem: (k, v) => { saved[k] = String(v); }, removeItem: (k) => { delete saved[k]; } },
        Notification: { permission: 'denied', requestPermission() { return { then() {} }; } },
        STATION: station([{ id: 'n1', block: 'blk-one', status: 'taken' }, { id: 'n2', block: 'blk-two', status: 'taken' }]) };
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        createElement: (t) => { const o = el(t); if (t === 'script') scripts.push(o); return o; }, querySelectorAll: () => [],
        querySelector: () => null, head: { appendChild() {} } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => { fetches++; return new Promise(() => {}); }, module: { exports: {} } });
    const fn = (listeners.click || []).filter((f) => String(f).includes('data-note-x'))[0];
    assert.equal(typeof fn, 'function', 'a click listener holds the note close branch');
    const settle = () => {
        intervals[0]();
        win.STATION = station([{ id: 'n1', block: 'blk-one', status: 'done' }, { id: 'n2', block: 'blk-two', status: 'rejected' }]);
        scripts[scripts.length - 1].onload();
    };
    return { fn, saved, settle, fetches: () => fetches, fkHtml: () => fk.innerHTML };
}

const tgt = (answers) => ({ tagName: 'DIV', closest: (sel) => (sel in answers ? answers[sel] : null) });
const noteX = (id) => ({ closest: (s) => (s === '.nt' ? { getAttribute: (k) => (k === 'data-note' ? id : null) } : null) });
const press = (p, answers) => p.fn({ target: tgt(answers), preventDefault() {} });
const bell = (p) => press(p, { '[data-fkb]': {} });
const A = 'F:\\ws\\alpha|', B = 'F:\\ws\\beta|';
const noteIds = (p) => (p.fkHtml().match(/data-note="[^"]*"/g) || []).map((x) => x.slice(11, -1)).join(',');

test('× on an Editing row takes it off the panel, keeps the other, and remembers the id', () => {
    const p = boot();
    bell(p);
    assert.equal(noteIds(p), A + 'n1,' + A + 'n2');
    press(p, { '[data-note-x]': noteX(A + 'n1') });
    assert.equal(noteIds(p), A + 'n2');
    assert.deepEqual(JSON.parse(p.saved[KEY]), [A + 'n1']);
});

test('a dismissed Editing row stays dismissed after a reload', () => {
    const p = boot({ [KEY]: JSON.stringify([A + 'n1']) });
    bell(p);
    assert.equal(noteIds(p), A + 'n2');
});

test('清掉通知 clears Editing rows as well and remembers every id', () => {
    const p = boot();
    bell(p);
    press(p, { '[data-note-clear]': {} });
    assert.equal(noteIds(p), '');
    assert.deepEqual(JSON.parse(p.saved[KEY]).sort(), [A + 'n1', A + 'n2']);
});

test('notes turn grey once the panel has been open, and stop counting on the bell', () => {
    const p = boot();
    p.settle();
    bell(p);
    assert.match(p.fkHtml(), /<span class="fkn">2<\/span>/);
    assert.doesNotMatch(p.fkHtml(), /class="nt (done|rej) read"/);
    bell(p);
    assert.match(p.fkHtml(), /<span class="fkn"><\/span>/);
    assert.match(p.fkHtml(), /class="nt done read"/);
    assert.equal(noteIds(p), 'n1,n2');
});

test('the same queue id in two projects: dismissing one keeps the other, also after a reload', () => {
    const p = boot(undefined, true);
    bell(p);
    assert.equal(noteIds(p), A + 'r-0001,' + B + 'r-0001');
    press(p, { '[data-note-x]': noteX(A + 'r-0001') });
    assert.equal(noteIds(p), B + 'r-0001');
    const q = boot({ [KEY]: p.saved[KEY] }, true);
    bell(q);
    assert.equal(noteIds(q), B + 'r-0001');
});

test('× on an Editing row and 清掉通知 make no fetch', () => {
    const p = boot();
    bell(p);
    const before = p.fetches();
    press(p, { '[data-note-x]': noteX(A + 'n1') });
    assert.equal(p.fetches(), before);
    press(p, { '[data-note-clear]': {} });
    assert.equal(p.fetches(), before);
});
