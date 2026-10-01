'use strict';
// The header search box's listeners (qPop mousedown/click, qBox input, focus,
// blur, keydown) booted in a vm with listeners and timers kept, so each
// single-branch mutation of one of them reddens a different set of tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const at = (i) => [0, 1, 2, 3].map((k) => String(k === i)).join(',');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');

function boot() {
    const listeners = {}, els = {}, timers = [], cleared = [];
    let tid = 0, writes = 0;
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', value: '', attrs: {}, style: {}, hidden: false, parentNode: null, ls: {},
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {},
        addEventListener(t, fn) { (this.ls[t] = this.ls[t] || []).push(fn); } });
    const box = el('input');
    const holder = el('div');
    holder.appendChild = (c) => { holder.kid = c; };
    box.parentNode = holder;
    els.q = box;
    const createElement = (tag) => {
        const o = el(tag);
        let html = '';
        Object.defineProperty(o, 'innerHTML', { get: () => html, set: (v) => { writes++; html = v; } });
        o.qsa = 0;
        o.reads = [];
        o.querySelectorAll = (sel) => {
            if (sel !== '[data-qi]') return [];
            o.qsa++;
            const rows = [];
            const re = /<a class="[^"]*" id="(qr-\d+)" data-qi="(\d+)" role="option" aria-selected="false" href="([^"]*)"/g;
            let m;
            while ((m = re.exec(html))) {
                rows.push({ attrs: { id: m[1], href: m[3], 'aria-selected': 'false' }, id: m[1], scrolled: 0,
                    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { if (k === 'href') o.reads.push(this.id); return this.attrs[k]; },
                    scrollIntoView() { this.scrolled++; } });
            }
            o.rows = rows;
            return rows;
        };
        return o;
    };
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1,
        setTimeout: (fn, ms) => { const t = { id: ++tid, fn, ms }; timers.push(t); return t.id; },
        clearTimeout: (id) => { cleared.push(id); const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
        navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: ['one', 'two', 'three'].map((n, i) => ({ id: 'sid' + i, pkey: 'F:\\ws\\alpha', task: 'alpha ' + n, state: 'live',
                updated: NOW - 1000 * (i + 1), started: NOW - 60000, stage: 'build' })) } };
    const doc = { hidden: false, documentElement: el('html'), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }), head: { appendChild() {} } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const pop = () => holder.kid;
    const ev = (extra) => { const e = Object.assign({ prevented: 0, preventDefault() { this.prevented++; } }, extra); return e; };
    const fire = (target, type, extra) => { const e = ev(Object.assign({ target }, extra)); for (const fn of target.ls[type] || []) fn(e); return e; };
    const flush = () => { const t = timers.splice(0); t.forEach((x) => x.fn()); };
    const type = (v) => { box.value = v; return fire(box, 'input'); };
    const open = (v) => { type(v || 'alpha'); flush(); };
    const key = (k) => fire(box, 'keydown', { key: k });
    const sel = () => pop().rows.map((r) => r.attrs['aria-selected']).join(',');
    return { box, pop, fire, flush, type, open, key, sel, timers, cleared, win, draws: () => writes,
        row: (i) => ({ closest: (s) => (s === '[data-qi]' ? pop().querySelectorAll(s)[i] : null) }), outside: { closest: () => null } };
}

test('typing arms one 200 ms timer, draws nothing before it runs and opens the popover when it does', () => {
    const b = boot();
    b.type('alpha');
    assert.equal(b.timers.length, 1);
    assert.equal(b.timers[0].ms, 200);
    assert.equal(b.pop(), undefined, 'nothing drawn yet');
    b.flush();
    assert.equal(b.pop().hidden, false);
    assert.equal(b.box.attrs['aria-expanded'], 'true');
    assert.equal(b.pop().querySelectorAll('[data-qi]').length, 4);
});

test('a second keystroke cancels the first timer, so the popover is drawn once', () => {
    const b = boot();
    b.type('alph');
    const first = b.timers[0].id;
    b.type('alpha');
    assert.deepEqual(b.cleared, [first]);
    assert.equal(b.timers.length, 1);
    b.flush();
    assert.equal(b.draws(), 1);
});

test('a timer that has run is forgotten: the next keystroke clears nothing', () => {
    const b = boot();
    b.open('alpha');
    b.type('alpha o');
    assert.deepEqual(b.cleared, []);
    b.flush();
    b.key('Escape');
    assert.deepEqual(b.cleared, [], 'closing after the timer ran clears nothing either');
});

test('focus on a box with text draws at once', () => {
    const b = boot();
    b.box.value = 'alpha';
    b.fire(b.box, 'focus');
    assert.equal(b.pop().hidden, false);
    assert.equal(b.timers.length, 0);
});

test('focus on a box of spaces does not close an open popover', () => {
    const b = boot();
    b.open('alpha');
    b.box.value = '  ';
    b.fire(b.box, 'focus');
    assert.equal(b.pop().hidden, false);
});

test('focus on a box of spaces leaves a pending draw alone', () => {
    const b = boot();
    b.type('  ');
    assert.equal(b.timers.length, 1);
    b.fire(b.box, 'focus');
    assert.equal(b.timers.length, 1);
});

test('focus on an empty box does not close an open popover', () => {
    const b = boot();
    b.open('alpha');
    b.box.value = '';
    b.fire(b.box, 'focus');
    assert.equal(b.pop().hidden, false);
});

test('blur closes an open popover, resets aria-expanded and cancels a pending draw', () => {
    const b = boot();
    b.open('alpha');
    b.key('ArrowDown');
    b.fire(b.box, 'blur');
    assert.equal(b.pop().hidden, true);
    assert.equal(b.box.attrs['aria-expanded'], 'false');
    assert.equal('aria-activedescendant' in b.box.attrs, false);
    b.type('alpha');
    b.fire(b.box, 'blur');
    assert.equal(b.timers.length, 0);
});

test('ArrowDown on a closed popover draws it and selects the first row', () => {
    const b = boot();
    b.box.value = 'alpha';
    b.key('ArrowDown');
    assert.equal(b.pop().hidden, false);
    assert.equal(b.sel(), at(0));
    assert.equal(b.box.attrs['aria-activedescendant'], 'qr-0');
    assert.equal(b.pop().rows[0].scrolled, 1);
});

test('ArrowDown and ArrowUp walk the open rows without redrawing and wrap at both ends', () => {
    const b = boot();
    b.open('alpha');
    const drawn = b.draws();
    b.key('ArrowDown');
    b.key('ArrowDown');
    assert.equal(b.sel(), at(1));
    b.key('ArrowUp');
    assert.equal(b.sel(), at(0));
    b.key('ArrowUp');
    assert.equal(b.sel(), at(3), 'up from the first row wraps to the last');
    b.key('ArrowDown');
    assert.equal(b.sel(), at(0), 'down from the last row wraps to the first');
    assert.equal(b.draws(), drawn, 'walking does not redraw');
});

test('ArrowUp from nothing selected lands on the last row', () => {
    const b = boot();
    b.open('alpha');
    b.key('ArrowUp');
    assert.equal(b.sel(), at(3));
    assert.equal(b.box.attrs['aria-activedescendant'], 'qr-3');
});

test('with one row, ArrowDown and ArrowUp both land on it', () => {
    const b = boot();
    b.open('alpha one');
    assert.equal(b.pop().querySelectorAll('[data-qi]').length, 1);
    b.key('ArrowDown');
    assert.equal(b.sel(), 'true');
    b.key('Escape');
    b.key('ArrowUp');
    assert.equal(b.sel(), 'true');
});

test('ArrowUp from nothing selected does not land on the first row', () => {
    const b = boot();
    b.open('alpha');
    b.key('ArrowUp');
    assert.notEqual(b.sel(), at(0));
});

test('ArrowUp from nothing selected does not land on the row before the last', () => {
    const b = boot();
    b.open('alpha');
    b.key('ArrowUp');
    assert.notEqual(b.sel(), at(2));
});

test('the arrow keys swallow the default, in both directions', () => {
    const b = boot();
    b.open('alpha');
    assert.equal(b.key('ArrowDown').prevented, 1);
    assert.equal(b.key('ArrowUp').prevented, 1);
});

test('Enter with nothing picked closes the popover and leaves the hash', () => {
    const b = boot();
    b.open('alpha');
    b.key('Enter');
    assert.equal(b.pop().hidden, true);
    assert.equal(b.win.location.hash, '#/');
});

test('Enter with nothing picked does not go looking for a row', () => {
    const b = boot();
    b.open('alpha');
    const before = b.pop().qsa;
    b.key('Enter');
    assert.equal(b.pop().qsa, before);
});

test('Enter on an open popover swallows the key', () => {
    const b = boot();
    b.open('alpha');
    assert.equal(b.key('Enter').prevented, 1);
});

test('Enter on a picked row goes to its href and closes the popover', () => {
    const b = boot();
    b.open('alpha');
    b.key('ArrowDown');
    b.key('ArrowDown');
    const href = b.pop().querySelectorAll('[data-qi]')[1].attrs.href;
    b.key('Enter');
    assert.equal(b.win.location.hash, href);
    assert.match(href, /^#\//);
    assert.notEqual(href, '#/');
    assert.equal(b.pop().hidden, true);
    assert.equal(b.box.attrs['aria-expanded'], 'false');
});

test('Enter on a picked row reads the href of that row', () => {
    const b = boot();
    b.open('alpha');
    b.key('ArrowDown');
    b.key('ArrowDown');
    b.pop().reads.length = 0;
    b.key('Enter');
    assert.deepEqual(b.pop().reads, ['qr-1']);
});

test('Enter on the first row, picked with one ArrowDown, goes to its href', () => {
    const b = boot();
    b.open('alpha');
    b.key('ArrowDown');
    const href = b.pop().querySelectorAll('[data-qi]')[0].attrs.href;
    b.key('Enter');
    assert.equal(b.win.location.hash, href);
});

test('Enter on a box that never opened a popover is left alone', () => {
    const b = boot();
    const e = b.key('Enter');
    assert.equal(e.prevented, 0);
    assert.equal(b.win.location.hash, '#/');
});

test('Enter on a popover that was closed is left alone', () => {
    const b = boot();
    b.open('alpha');
    b.key('Escape');
    assert.equal(b.key('Enter').prevented, 0);
    assert.equal(b.win.location.hash, '#/');
});

test('Escape closes an open popover and forgets the selection', () => {
    const b = boot();
    b.open('alpha');
    b.key('ArrowDown');
    b.key('Escape');
    assert.equal(b.pop().hidden, true);
    assert.equal('aria-activedescendant' in b.box.attrs, false);
    b.key('ArrowDown');
    assert.equal(b.sel(), at(0), 'the selection starts over after a close');
});

test('Escape on a closed popover leaves a pending draw to run', () => {
    const b = boot();
    b.type('alpha');
    b.key('Escape');
    assert.equal(b.timers.length, 1);
    b.flush();
    assert.equal(b.pop().hidden, false);
});

test('a key that is not an arrow, Enter or Escape changes nothing on an open popover', () => {
    const b = boot();
    b.open('alpha');
    b.key('ArrowDown');
    const e = b.key('a');
    assert.equal(e.prevented, 0);
    assert.equal(b.pop().hidden, false);
    assert.equal(b.sel(), at(0));
});

test('a press inside the popover keeps the caret in the box', () => {
    const b = boot();
    b.open('alpha');
    assert.equal(b.fire(b.pop(), 'mousedown', { target: b.outside }).prevented, 1);
});

test('a click on a result row closes the popover', () => {
    const b = boot();
    b.open('alpha');
    b.fire(b.pop(), 'click', { target: b.row(0) });
    assert.equal(b.pop().hidden, true);
    assert.equal(b.box.attrs['aria-expanded'], 'false');
});

test('a click in the popover outside any row leaves it open', () => {
    const b = boot();
    b.open('alpha');
    b.key('ArrowDown');
    b.fire(b.pop(), 'click', { target: b.outside });
    assert.equal(b.pop().hidden, false);
    assert.equal(b.sel(), at(0));
});
