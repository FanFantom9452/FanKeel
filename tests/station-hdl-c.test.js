'use strict';
// Two document listeners of assets/station/station.js, each pressed through
// the page's own listener list with fake targets: the page's big keydown
// listener (Esc on the 篩選 panel, the facet popover, legend keys, inputs, `/`)
// and the 1-4 keys that answer a held gate; the page's click listener opens the
// panel they close. Each test is red under a different set of single-branch
// mutations of the handler it presses: no two mutations of one handler redden
// the same tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const profile = require('../lib/profile.js');

const { SRC } = require('./station-src.js');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
// The listeners this file presses, numbered as station.js registered them
// when it ran alone; the numbers now only key MARKERS, since tip.js and the
// page modules register theirs first.
const KEY_BIG = 6, KEY_GATE = 7, CLICK_PAGE = 9;
// A literal unique to each pressed document listener, so the one holding it is found wherever it sits.
const MARKERS = { 'keydown:6': '.rpop, .rwrap', 'keydown:7': 'data-gop', 'click:9': '[data-fbtn]' };

// station.js booted on `hash`, with every document listener kept by type, the
// `#page` element counting its redraws, and `doc.querySelector` answering only
// the selectors a test names (every call is logged).
function boot(hash, profiles) {
    const named = {};
    const listeners = {};
    const winListeners = {};
    const els = {};
    const asked = [];
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    const page = el('div');
    let html = '', draws = 0;
    Object.defineProperty(page, 'innerHTML', { get: () => html, set: (v) => { html = v; draws++; } });
    els.page = page;
    const win = { location: { hash }, addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); }, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: profiles || { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: profile.WIZARD_KEYS,
            classes: {}, sessions: [] } };
    const fallback = Object.assign(el(), { parentNode: { insertBefore() {} }, nextSibling: null, click() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) });
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector(sel) { asked.push(sel); return sel in named ? named[sel] : sel === 'dialog[open]' ? null : fallback; }, head: { appendChild() {} } };
    const box = { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    asked.length = 0;
    const find = (type, n) => {
        const mark = MARKERS[type + ':' + n];
        assert.ok(mark, 'the ' + type + ' listener number ' + n + ' has a marker');
        const hits = (listeners[type] || []).filter((fn) => String(fn).includes(mark));
        assert.equal(hits.length, 1, 'one ' + type + ' listener holds ' + mark);
        return hits[0];
    };
    return { doc, els, win, asked, page, draws: () => draws, html: () => html, find, named,
        // A link followed: the hash moves and the page's own hashchange listener runs.
        goto(to) { win.location.hash = to; (winListeners.hashchange || []).forEach((fn) => fn({})); },
        reset() { draws = 0; asked.length = 0; } };
}

// A fake event: preventDefault is counted, the target is whatever is given.
function ev(props) {
    const e = Object.assign({ key: '', altKey: false, ctrlKey: false, metaKey: false }, props);
    e.prevented = 0;
    e.preventDefault = () => { e.prevented++; };
    return e;
}
// A target whose closest() answers the selectors it was given and nothing else.
function tgt(answers, extra) {
    return Object.assign({ tagName: 'DIV', closest: (sel) => (sel in answers ? answers[sel] : null) }, extra);
}
// A target whose closest() answers the way the DOM does: it is found when one
// clause of the selector list is one of `clauses`.
function within(clauses, extra) {
    return Object.assign({ tagName: 'DIV', closest: (sel) => (sel.split(',').some((c) => clauses.indexOf(c.trim()) >= 0) ? {} : null) }, extra);
}
const spy = () => ({ focused: 0, clicked: 0, focus() { this.focused++; }, click() { this.clicked++; } });

// ---- 3. the big keydown listener -------------------------------------------
const BIG = KEY_BIG;
// The days page with its 篩選 panel opened by the button's own click.
function panelOpen() {
    const p = boot('#/days');
    const btn = spy();
    p.named['[data-fbtn]'] = btn;
    p.find('click', CLICK_PAGE)({ target: tgt({ '[data-fbtn]': {} }) });
    p.reset();
    btn.focused = 0;
    return { p, btn, key: p.find('keydown', BIG) };
}

test('Escape on the days page with the panel open is prevented', () => {
    const { key } = panelOpen();
    const e = ev({ key: 'Escape', target: tgt({}) });
    key(e);
    assert.equal(e.prevented, 1);
});

test('Escape on the days page with the panel open redraws once', () => {
    const { p, key } = panelOpen();
    key(ev({ key: 'Escape', target: tgt({}) }));
    assert.equal(p.draws(), 1);
});

test('Escape that shuts the panel puts focus back on the 篩選 button', () => {
    const { btn, key } = panelOpen();
    key(ev({ key: 'Escape', target: tgt({}) }));
    assert.equal(btn.focused, 1);
});

test('a second Escape finds the panel already shut', () => {
    const { p, key } = panelOpen();
    key(ev({ key: 'Escape', target: tgt({}) }));
    p.reset();
    key(ev({ key: 'Escape', target: tgt({}) }));
    assert.equal(p.draws(), 0);
});

test('Escape with the panel shut does not redraw or prevent', () => {
    const p = boot('#/days');
    const key = p.find('keydown', BIG);
    const e = ev({ key: 'Escape', target: tgt({}) });
    p.reset();
    key(e);
    assert.equal(e.prevented, 0);
    assert.equal(p.draws(), 0);
});

test('a key other than Escape leaves the open panel open', () => {
    const { p, key } = panelOpen();
    const e = ev({ key: 'a', target: tgt({}) });
    key(e);
    assert.equal(p.draws(), 0);
    assert.equal(e.prevented, 0);
    p.reset();
    key(ev({ key: 'Escape', target: tgt({}) }));
    assert.equal(p.draws(), 1, 'it was still open');
});

test('Escape leaves an open panel alone once the page is no longer the days page', () => {
    const { p, key } = panelOpen();
    p.goto('#/list');
    p.reset();
    const e = ev({ key: 'Escape', target: tgt({}) });
    key(e);
    assert.equal(e.prevented, 0);
    assert.equal(p.draws(), 0);
});

test('Escape that shuts the panel stops there: an input under it is not blurred', () => {
    const { key } = panelOpen();
    const input = tgt({}, { tagName: 'INPUT', blurred: 0, blur() { this.blurred++; } });
    key(ev({ key: 'Escape', target: input }));
    assert.equal(input.blurred, 0);
});

// The facet popover on 清單: opened by its trigger's own click.
function popover() {
    const p = boot('#/list');
    const rows = [0, 1, 2].map((i) => Object.assign(spy(), { i, hidden: false }));
    const q = Object.assign(spy(), { hasAttribute: (k) => k === 'data-pickq' });
    const btn = spy();
    p.doc.querySelectorAll = (sel) => (sel === '.rpop [data-v]' ? rows : []);
    p.named['.rpop [data-pickq]'] = q;
    p.named['[data-pick="status"]'] = btn;
    p.find('click', CLICK_PAGE)({ target: tgt({ '[data-pick]': { getAttribute: () => 'status' } }) });
    p.reset();
    [q, btn, ...rows].forEach((x) => { x.focused = 0; });
    const inPop = () => within(['.rpop', '.rwrap']);
    // A row under the popover, as a key target.
    const row = (r) => Object.assign(r, { tagName: 'BUTTON', closest: (sel) => (sel.split(',').some((c) => ['.rpop', '.rwrap'].indexOf(c.trim()) >= 0) ? {} : null) });
    const focusedTotal = () => q.focused + btn.focused + rows.reduce((n, r) => n + r.focused, 0);
    return { p, rows, q, btn, key: p.find('keydown', BIG), inPop, row, focusedTotal };
}

test('Escape in an open facet popover is prevented', () => {
    const { key, inPop } = popover();
    const e = ev({ key: 'Escape', target: inPop() });
    key(e);
    assert.equal(e.prevented, 1);
});

test('Escape in an open facet popover redraws once', () => {
    const { p, key, inPop } = popover();
    key(ev({ key: 'Escape', target: inPop() }));
    assert.equal(p.draws(), 1);
});

test('Escape in an open facet popover puts focus back on its trigger', () => {
    const { btn, key, inPop } = popover();
    key(ev({ key: 'Escape', target: inPop() }));
    assert.equal(btn.focused, 1);
});

test('Escape shuts the popover: a second Escape finds it shut', () => {
    const { p, key, inPop } = popover();
    key(ev({ key: 'Escape', target: inPop() }));
    p.reset();
    key(ev({ key: 'Escape', target: inPop() }));
    assert.equal(p.draws(), 0);
});

test('Escape is taken from a target under .rpop alone', () => {
    const { p, key } = popover();
    key(ev({ key: 'Escape', target: within(['.rpop']) }));
    assert.equal(p.draws(), 1);
});

test('Escape is taken from a target under .rwrap alone', () => {
    const { p, key } = popover();
    key(ev({ key: 'Escape', target: within(['.rwrap']) }));
    assert.equal(p.draws(), 1);
});

test('Escape in the popover\'s search box shuts it and does not also blur the box', () => {
    const { key, inPop } = popover();
    const box = inPop();
    Object.assign(box, { tagName: 'INPUT', blurred: 0, blur() { this.blurred++; } });
    key(ev({ key: 'Escape', target: box }));
    assert.equal(box.blurred, 0);
});

test('a key outside an open popover does not reach it', () => {
    const { p, key } = popover();
    const e = ev({ key: 'Escape', target: tgt({}) });
    key(e);
    assert.equal(e.prevented, 0);
    assert.equal(p.draws(), 0);
});

test('an open popover is left alone once the page is no longer the list', () => {
    const { p, key, inPop } = popover();
    p.goto('#/days');
    p.reset();
    const e = ev({ key: 'Escape', target: inPop() });
    key(e);
    assert.equal(e.prevented, 0);
    assert.equal(p.draws(), 0);
});

test('a popover target with no closest does not throw', () => {
    const { key } = popover();
    assert.doesNotThrow(() => key(ev({ key: 'Escape', target: {} })));
});

test('the popover is reached only while it is open', () => {
    const p = boot('#/list');
    const key = p.find('keydown', BIG);
    const e = ev({ key: 'Escape', target: within(['.rpop', '.rwrap']) });
    key(e);
    assert.equal(e.prevented, 0);
});

test('ArrowDown from the search box lands on the first row', () => {
    const { rows, key, inPop } = popover();
    key(ev({ key: 'ArrowDown', target: inPop() }));
    assert.deepEqual(rows.map((r) => r.focused), [1, 0, 0]);
});

test('ArrowDown between rows steps one', () => {
    const { rows, key, row } = popover();
    key(ev({ key: 'ArrowDown', target: row(rows[0]) }));
    assert.deepEqual(rows.map((r) => r.focused), [0, 1, 0]);
});

test('ArrowDown on the last row keeps focus there', () => {
    const { rows, key, row } = popover();
    key(ev({ key: 'ArrowDown', target: row(rows[2]) }));
    assert.deepEqual(rows.map((r) => r.focused), [0, 0, 1]);
});

test('ArrowUp between rows steps one up', () => {
    const { rows, key, row } = popover();
    key(ev({ key: 'ArrowUp', target: row(rows[2]) }));
    assert.deepEqual(rows.map((r) => r.focused), [0, 1, 0]);
});

test('ArrowUp from the first row goes to the search box', () => {
    const { rows, q, key, row } = popover();
    key(ev({ key: 'ArrowUp', target: row(rows[0]) }));
    assert.equal(q.focused, 1);
    assert.equal(rows[0].focused, 0);
});

test('ArrowUp from the search box stays on it', () => {
    const { rows, q, key, inPop } = popover();
    key(ev({ key: 'ArrowUp', target: inPop() }));
    assert.equal(q.focused, 1);
    assert.equal(rows[0].focused, 0);
});

test('ArrowUp to the top focuses the first row when the popover has no search box', () => {
    const { rows, p, key, row } = popover();
    p.named['.rpop [data-pickq]'] = null;
    key(ev({ key: 'ArrowUp', target: row(rows[0]) }));
    assert.equal(rows[0].focused, 1);
});

test('ArrowDown is prevented', () => {
    const { key, inPop } = popover();
    const e = ev({ key: 'ArrowDown', target: inPop() });
    key(e);
    assert.equal(e.prevented, 1);
});

test('ArrowUp is prevented', () => {
    const { key, inPop } = popover();
    const e = ev({ key: 'ArrowUp', target: inPop() });
    key(e);
    assert.equal(e.prevented, 1);
});

test('an arrow moves focus to exactly one element and redraws nothing', () => {
    const { p, key, row, rows, focusedTotal } = popover();
    key(ev({ key: 'ArrowDown', target: row(rows[0]) }));
    assert.equal(focusedTotal(), 1);
    assert.equal(p.draws(), 0);
});

test('the popover\'s arrows walk only the rows shown, not the hidden ones', () => {
    const { rows, key, row } = popover();
    rows[1].hidden = true;
    key(ev({ key: 'ArrowDown', target: row(rows[0]) }));
    assert.deepEqual(rows.map((r) => r.focused), [0, 0, 1]);
});

test('an arrow with no rows and no box focuses nothing and does not throw', () => {
    const { p, key, inPop } = popover();
    p.doc.querySelectorAll = () => [];
    p.named['.rpop [data-pickq]'] = null;
    assert.doesNotThrow(() => key(ev({ key: 'ArrowDown', target: inPop() })));
});

function searchBox(inPop) { return Object.assign(inPop(), { tagName: 'INPUT', hasAttribute: (k) => k === 'data-pickq' }); }

test('Enter in the search box clicks the first shown row', () => {
    const { rows, key, inPop } = popover();
    rows[0].hidden = true;
    key(ev({ key: 'Enter', target: searchBox(inPop) }));
    assert.deepEqual(rows.map((r) => r.clicked), [0, 1, 0]);
});

test('Enter in the search box is prevented', () => {
    const { key, inPop } = popover();
    const e = ev({ key: 'Enter', target: searchBox(inPop) });
    key(e);
    assert.equal(e.prevented, 1);
});

test('another key in the search box clicks no row', () => {
    const { rows, key, inPop } = popover();
    key(ev({ key: 'a', target: searchBox(inPop) }));
    assert.deepEqual(rows.map((r) => r.clicked), [0, 0, 0]);
});

test('Enter somewhere under the popover other than the search box clicks no row', () => {
    const { rows, key, inPop } = popover();
    key(ev({ key: 'Enter', target: Object.assign(inPop(), { hasAttribute: () => false }) }));
    assert.deepEqual(rows.map((r) => r.clicked), [0, 0, 0]);
});

test('Enter in the search box with no row shown neither throws nor prevents', () => {
    const { p, key, inPop } = popover();
    p.doc.querySelectorAll = () => [];
    const e = ev({ key: 'Enter', target: searchBox(inPop) });
    assert.doesNotThrow(() => key(e));
    assert.equal(e.prevented, 0);
});

// Legend keys on the days page.
function legend(key, entryAttrs) {
    const p = boot('#/days');
    const press = p.find('keydown', BIG);
    const entry = { getAttribute: (a) => entryAttrs[a] || null, hasAttribute: (a) => a in entryAttrs };
    const back = spy();
    p.named['.legend [data-key="opus"]'] = back;
    p.named['.legend [data-rest]'] = back;
    const attr = 'data-key' in entryAttrs ? 'data-key' : 'data-rest';
    const e = ev({ key, target: { tagName: 'DIV', closest: (sel) => (sel.split(',').some((c) => c.trim().endsWith('[' + attr + ']')) ? entry : null) } });
    p.reset();
    press(e);
    return { e, p, back };
}
for (const k of ['Enter', ' ']) {
    test('key ' + JSON.stringify(k) + ' on a legend entry toggles it: redrawn, focus on the entry', () => {
        const { p, back } = legend(k, { 'data-key': 'opus' });
        assert.equal(p.draws(), 1);
        assert.equal(back.focused, 1);
    });
}
test('Enter on the legend\'s 其他 entry toggles it the same way', () => {
    const { p, back } = legend('Enter', { 'data-rest': '' });
    assert.equal(p.draws(), 1);
    assert.equal(back.focused, 1);
});
test('a key that toggles a legend entry is prevented', () => {
    const { e } = legend('Enter', { 'data-key': 'opus' });
    assert.equal(e.prevented, 1);
});
test('another key on a legend entry does not toggle it', () => {
    const { e, p } = legend('a', { 'data-key': 'opus' });
    assert.equal(p.draws(), 0);
    assert.equal(e.prevented, 0);
});
test('Enter on a legend entry off the days page does not toggle it', () => {
    const o = boot('#/list');
    const k2 = o.find('keydown', BIG);
    const b = ev({ key: 'Enter', target: { tagName: 'DIV', closest: () => ({ getAttribute: () => 'opus', hasAttribute: () => false }) } });
    o.reset();
    k2(b);
    assert.equal(o.draws(), 0);
    assert.equal(b.prevented, 0);
});
test('a key on a target with no closest does not throw on the days page', () => {
    const p = boot('#/days');
    const key = p.find('keydown', BIG);
    assert.doesNotThrow(() => key(ev({ key: 'Enter', target: { tagName: 'DIV' } })));
});

// Inputs and the `/` key.
const inputBox = () => tgt({}, { tagName: 'INPUT', blurred: 0, blur() { this.blurred++; } });
test('Escape in an input blurs it', () => {
    const key = boot('#/').find('keydown', BIG);
    const box = inputBox();
    key(ev({ key: 'Escape', target: box }));
    assert.equal(box.blurred, 1);
});
test('another key in an input does not blur it', () => {
    const key = boot('#/').find('keydown', BIG);
    const box = inputBox();
    key(ev({ key: 'a', target: box }));
    assert.equal(box.blurred, 0);
});
test('`/` in an input is typed, not taken: no prevent and the search box is not focused', () => {
    const p = boot('#/');
    const key = p.find('keydown', BIG);
    const q = spy();
    p.els.q = q;
    const e = ev({ key: '/', target: inputBox() });
    key(e);
    assert.equal(e.prevented, 0);
    assert.equal(q.focused, 0);
});
test('`/` outside an input is prevented', () => {
    const key = boot('#/').find('keydown', BIG);
    const e = ev({ key: '/', target: tgt({}) });
    key(e);
    assert.equal(e.prevented, 1);
});
test('`/` outside an input focuses the search box', () => {
    const p = boot('#/');
    const key = p.find('keydown', BIG);
    const q = spy();
    p.els.q = q;
    key(ev({ key: '/', target: tgt({}) }));
    assert.equal(q.focused, 1);
});
test('another key outside an input is neither prevented nor sent to the search box', () => {
    const p = boot('#/');
    const key = p.find('keydown', BIG);
    const q = spy();
    p.els.q = q;
    const e = ev({ key: 'x', target: tgt({}) });
    key(e);
    assert.equal(e.prevented, 0);
    assert.equal(q.focused, 0);
});

// ---- 4. the 1-4 keys --------------------------------------------------------
// Option buttons of the held gate: `held` lists the data-gop indexes that exist.
function gate(held) {
    const p = boot('#/');
    const key = p.find('keydown', KEY_GATE);
    const btn = [0, 1, 2, 3].map(() => spy());
    btn.forEach((b, i) => { p.named['#fk .gc [data-gop="' + i + '"]'] = (held || [0, 1, 2, 3]).indexOf(i) >= 0 ? b : null; });
    p.reset();
    return { p, key, btn };
}
const gopAsked = (p) => p.asked.filter((q) => q.includes('data-gop'));

for (const n of [1, 2, 3, 4]) {
    test('key ' + n + ' clicks option ' + (n - 1) + ' of the first held gate', () => {
        const { key, btn } = gate();
        key(ev({ key: String(n), target: tgt({}) }));
        assert.deepEqual(btn.map((b) => b.clicked), btn.map((b, i) => (i === n - 1 ? 1 : 0)));
    });
}

test('a key that picks an option is prevented', () => {
    const { key } = gate();
    const e = ev({ key: '1', target: tgt({}) });
    key(e);
    assert.equal(e.prevented, 1);
});

test('key 1 asks the page for the first option of the held gate card, by that selector', () => {
    const { p, key } = gate();
    key(ev({ key: '1', target: tgt({}) }));
    assert.deepEqual(gopAsked(p), ['#fk .gc [data-gop="0"]']);
});

test('key 1 does not reach for option 1 when only option 1 is held', () => {
    const { key, btn } = gate([1]);
    const e = ev({ key: '1', target: tgt({}) });
    key(e);
    assert.equal(btn[1].clicked, 0);
    assert.equal(e.prevented, 0);
});

test('key 1 does not reach for option 2 when only option 2 is held', () => {
    const { key, btn } = gate([2]);
    key(ev({ key: '1', target: tgt({}) }));
    assert.equal(btn[2].clicked, 0);
});

const NEAR = { '0': 'below the range', '5': 'above the range', 'F1': 'ends in a digit', '12': 'starts with a digit', '': 'empty' };
for (const k of Object.keys(NEAR)) {
    test('key ' + JSON.stringify(k) + ' (' + NEAR[k] + ') asks for no button', () => {
        const { key, p } = gate();
        const e = ev({ key: k, target: tgt({}) });
        key(e);
        assert.equal(e.prevented, 0);
        assert.deepEqual(gopAsked(p), []);
    });
}
for (const mod of ['altKey', 'ctrlKey', 'metaKey']) {
    test('key 1 with ' + mod + ' held is left to the browser', () => {
        const { key, btn, p } = gate();
        const e = ev({ key: '1', target: tgt({}), [mod]: true });
        key(e);
        assert.equal(e.prevented, 0);
        assert.equal(btn[0].clicked, 0);
        assert.deepEqual(gopAsked(p), []);
    });
}
for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
    test('typing 2 in a ' + tag + ' picks nothing', () => {
        const { key, btn, p } = gate();
        const e = ev({ key: '2', target: tgt({}, { tagName: tag }) });
        key(e);
        assert.equal(e.prevented, 0);
        assert.equal(btn[1].clicked, 0);
        assert.deepEqual(gopAsked(p), []);
    });
}

test('an event with no target still picks', () => {
    const { key, btn } = gate();
    assert.doesNotThrow(() => key(ev({ key: '3' })));
    assert.equal(btn[2].clicked, 1);
});

test('with no held gate a key neither throws nor prevents', () => {
    const { key } = gate([]);
    const e = ev({ key: '1', target: tgt({}) });
    assert.doesNotThrow(() => key(e));
    assert.equal(e.prevented, 0);
});

test('a document with no querySelector picks nothing and does not throw', () => {
    const { key, p } = gate();
    p.doc.querySelector = undefined;
    const e = ev({ key: '1', target: tgt({}) });
    assert.doesNotThrow(() => key(e));
    assert.equal(e.prevented, 0);
});
