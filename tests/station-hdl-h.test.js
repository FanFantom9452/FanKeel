'use strict';
// Three branches of the page's big click listener in assets/station/station.js,
// pressed through the listener itself with fake targets whose closest() answers
// only the selector a test names: `[data-goto]` (a backtrack's link into the
// replay), `[data-cmpclear]` (清除 on the selection bar) and `[data-pickclr]`
// (the × of a facet trigger on 清單). One effect per test, so that two
// single-branch mutations of one branch never redden the same set of tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';

const session = (id) => ({ id, pkey: PK, root: PK, task: 't-' + id, state: 'live', route: ['survey', 'build'], stage: 'build',
    stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [] });

// station.js booted on `hash`; the document listeners are kept by type. `ids`
// overrides getElementById (null: the element is absent); `named` answers
// querySelector (every call is logged); #page counts its redraws and the
// elements in `counted` count their innerHTML writes.
function boot(hash) {
    const listeners = {}, els = {}, ids = {}, named = {}, asked = [], writes = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    const count = (name) => {
        const e = el('div');
        let html = '';
        writes[name] = 0;
        Object.defineProperty(e, 'innerHTML', { get: () => html, set: (v) => { html = v; writes[name]++; } });
        els[name] = e;
        return e;
    };
    const page = count('page');
    count('selbar'); count('lb'); count('side');
    const win = { location: { hash }, addEventListener() {}, scrollTo() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [session('s1'), session('s2')] } };
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', head: { appendChild() {} },
        getElementById: (id) => (id in ids ? ids[id] : els[id] || (els[id] = el())),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector(sel) { asked.push(sel); return sel in named ? named[sel] : null; } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const fns = (listeners.click || []).filter((fn) => String(fn).includes('[data-pickclr]'));
    assert.equal(fns.length, 1, 'one click listener holds [data-pickclr]');
    assert.ok(String(fns[0]).includes('[data-goto]') && String(fns[0]).includes('[data-cmpclear]'), 'and the same one holds [data-goto] and [data-cmpclear]');
    const click = fns[0];
    const p = { ids, named, asked, els, writes, html: () => page.innerHTML,
        press(answers) { click({ target: { closest: (sel) => (sel in answers ? answers[sel] : null) } }); },
        reset() { for (const k of Object.keys(writes)) writes[k] = 0; asked.length = 0; } };
    return p;
}

// ---- [data-goto] ----------------------------------------------------------
// A replay row: its data-t, the classes it holds, the scrolls it got, and what
// closest('details.rpseg') answers.
function li(t, seg) {
    const classes = new Set();
    return { classes, scrolls: [], closestAsked: [],
        getAttribute: (k) => (k === 'data-t' ? t : null),
        classList: { toggle(c, force) { if (force === undefined) { if (classes.has(c)) classes.delete(c); else classes.add(c); } else if (force) classes.add(c); else classes.delete(c); } },
        closest(sel) { this.closestAsked.push(sel); return seg || null; },
        scrollIntoView(o) { this.scrolls.push(o); } };
}
function replay(lis) {
    const rp = { open: false, asked: [], querySelectorAll(sel) { this.asked.push(sel); return lis; } };
    return rp;
}
function jumpTo(p, lis, from, until) {
    const rp = replay(lis);
    p.ids['s-rp'] = rp;
    const attrs = { 'data-goto': from, 'data-until': until };
    p.press({ '[data-goto]': { getAttribute: (k) => (k in attrs ? attrs[k] : null) } });
    return rp;
}
const hl = (l) => l.classes.has('hl');

test('goto: the replay opens, and its rows are read as .rp > li[data-t]', () => {
    const p = boot('#/');
    const rp = jumpTo(p, [], '1', '2');
    assert.equal(rp.open, true);
    assert.deepEqual(rp.asked, ['.rp > li[data-t]']);
});

test('goto: a row at data-goto is lit (the range starts there)', () => {
    const p = boot('#/');
    const a = li('5');
    jumpTo(p, [a], '5', '9');
    assert.equal(hl(a), true);
});

test('goto: a row at data-until is lit (the range ends there)', () => {
    const p = boot('#/');
    const a = li('9');
    jumpTo(p, [a], '5', '9');
    assert.equal(hl(a), true);
});

test('goto: a row between the two is lit', () => {
    const p = boot('#/');
    const a = li('7');
    jumpTo(p, [a], '5', '9');
    assert.equal(hl(a), true);
});

test('goto: a row before data-goto is not lit', () => {
    const p = boot('#/');
    const a = li('4');
    jumpTo(p, [a], '5', '9');
    assert.equal(hl(a), false);
});

test('goto: a row after data-until is not lit', () => {
    const p = boot('#/');
    const a = li('10');
    jumpTo(p, [a], '5', '9');
    assert.equal(hl(a), false);
});

test('goto: a row with an empty data-t is not lit even when the range holds 0', () => {
    const p = boot('#/');
    const a = li('');
    jumpTo(p, [a], '0', '5');
    assert.equal(hl(a), false);
});

test('goto: a row lit by an earlier jump and outside this one is put out', () => {
    const p = boot('#/');
    const a = li('4');
    a.classes.add('hl');
    jumpTo(p, [a], '5', '9');
    assert.equal(hl(a), false);
});

test('goto: a row lit by an earlier jump and inside this one stays lit', () => {
    const p = boot('#/');
    const a = li('6');
    a.classes.add('hl');
    jumpTo(p, [a], '5', '9');
    assert.equal(hl(a), true);
});

test('goto: the class put on a hit is hl', () => {
    const p = boot('#/');
    const a = li('6');
    jumpTo(p, [a], '5', '9');
    assert.deepEqual([...a.classes], ['hl']);
});

test('goto: no class but hl is put on any row', () => {
    const p = boot('#/');
    const a = li('6'), b = li('1');
    jumpTo(p, [a, b], '5', '9');
    assert.deepEqual([...a.classes, ...b.classes].filter((c) => c !== 'hl'), []);
});

test('goto: with two hits only the first is scrolled to', () => {
    const p = boot('#/');
    const a = li('5'), b = li('6');
    jumpTo(p, [a, b], '5', '9');
    assert.equal(b.scrolls.length, 0);
});

test('goto: the first hit is scrolled to the centre of the view', () => {
    const p = boot('#/');
    const a = li('5'), b = li('6');
    jumpTo(p, [a, b], '5', '9');
    assert.equal(a.scrolls.length, 1);
    assert.equal(a.scrolls[0].block, 'center');
});

test('goto: one hit is scrolled to exactly once', () => {
    const p = boot('#/');
    const a = li('5');
    jumpTo(p, [a], '5', '9');
    assert.equal(a.scrolls.length, 1);
});

test('goto: the segment holding the first hit is opened', () => {
    const p = boot('#/');
    const seg = { open: false };
    const a = li('5', seg);
    jumpTo(p, [a], '5', '9');
    assert.equal(seg.open, true);
    assert.deepEqual(a.closestAsked, ['details.rpseg']);
});

test('goto: a hit outside any segment is scrolled to without a throw', () => {
    const p = boot('#/');
    const a = li('5');
    assert.doesNotThrow(() => jumpTo(p, [a], '5', '9'));
    assert.equal(a.scrolls.length, 1);
});

test('goto: no hit means no scroll and no throw', () => {
    const p = boot('#/');
    const a = li('1');
    assert.doesNotThrow(() => jumpTo(p, [a], '5', '9'));
    assert.equal(a.scrolls.length, 0);
});

test('goto: without #s-rp the click does nothing and does not throw', () => {
    const p = boot('#/');
    p.ids['s-rp'] = null;
    assert.doesNotThrow(() => p.press({ '[data-goto]': { getAttribute: () => '1' } }));
});

test('goto: a missing data-until reads as 0, so no row after it is lit', () => {
    const p = boot('#/');
    const a = li('3');
    const rp = replay([a]);
    p.ids['s-rp'] = rp;
    p.press({ '[data-goto]': { getAttribute: (k) => (k === 'data-goto' ? '1' : null) } });
    assert.equal(hl(a), false);
});

test('goto: a goto click returns before the 清除 branch: the selection bar is not redrawn', () => {
    const p = boot('#/');
    p.ids['s-rp'] = replay([]);
    p.reset();
    p.press({ '[data-goto]': { getAttribute: () => '1' }, '[data-cmpclear]': {} });
    assert.equal(p.writes.selbar, 0);
});

// ---- [data-cmpclear] ------------------------------------------------------
// The state a clear needs: s1 ticked through the checkbox branch, writes reset.
function ticked(hash) {
    const p = boot(hash);
    p.press({ 'input[data-cmp]': { getAttribute: () => 's1', checked: true } });
    p.reset();
    return p;
}
const shown = (p) => (/<b id="ncmp">(\d+)<\/b>/.exec(p.els.selbar.innerHTML) || [])[1];

test('clear: the ticked count on the selection bar goes to 0', () => {
    const p = ticked('#/list');
    p.press({ '[data-cmpclear]': {} });
    assert.equal(shown(p), '0');
});

test('clear: the selection bar is written once', () => {
    const p = boot('#/list');
    p.reset();
    p.press({ '[data-cmpclear]': {} });
    assert.equal(p.writes.selbar, 1);
});

test('clear: the table is redrawn, once', () => {
    const p = boot('#/list');
    p.reset();
    p.press({ '[data-cmpclear]': {} });
    assert.equal(p.writes.lb, 1);
});

test('clear: no row of the redrawn table is left ticked', () => {
    const p = ticked('#/list');
    assert.match(p.els.lb.innerHTML, /data-cmp="s1"/);
    p.press({ '[data-cmpclear]': {} });
    assert.match(p.els.lb.innerHTML, /data-cmp="s1"/);
    assert.doesNotMatch(p.els.lb.innerHTML, / checked/);
});

test('clear: the breadcrumb side is redrawn, once', () => {
    const p = boot('#/list');
    p.reset();
    p.press({ '[data-cmpclear]': {} });
    assert.equal(p.writes.side, 1);
});

test('clear: on a project page the page itself is redrawn once', () => {
    const p = boot('#/p/' + encodeURIComponent(PK));
    p.reset();
    p.press({ '[data-cmpclear]': {} });
    assert.equal(p.writes.page, 1);
});

test('clear: on a project page the in-place redraws are not run', () => {
    const p = boot('#/p/' + encodeURIComponent(PK));
    p.reset();
    p.press({ '[data-cmpclear]': {} });
    assert.deepEqual([p.writes.selbar, p.writes.lb], [0, 0]);
});

test('clear: the branch returns before the checkbox branch', () => {
    const p = ticked('#/list');
    p.press({ '[data-cmpclear]': {}, 'input[data-cmp]': { getAttribute: () => 's2', checked: true } });
    assert.equal(shown(p), '0');
});

// ---- [data-pickclr] -------------------------------------------------------
// 清單 with 狀態 set to live and the 專案 popover open (pickLast is project).
function picked() {
    const p = boot('#/list');
    p.press({ '[data-facet] button': { parentNode: { getAttribute: () => 'state' }, getAttribute: () => 'live' } });
    p.press({ '[data-pick]': { getAttribute: () => 'project' } });
    assert.match(p.html(), /data-pickclr="state"/);
    assert.match(p.html(), /class="rpop"/);
    p.reset();
    return p;
}
const clr = (key) => ({ '[data-pickclr]': { getAttribute: (k) => (k === 'data-pickclr' ? key : null) } });

test('pickclr: the facet is back to 全部 (its × is gone from the redrawn page)', () => {
    const p = picked();
    p.press(clr('state'));
    assert.doesNotMatch(p.html(), /data-pickclr="state"/);
});

test('pickclr: the page is redrawn once', () => {
    const p = picked();
    p.press(clr('state'));
    assert.equal(p.writes.page, 1);
});

test('pickclr: the open popover is shut', () => {
    const p = picked();
    p.press(clr('state'));
    assert.doesNotMatch(p.html(), /class="rpop"/);
});

test('pickclr: focus goes to the trigger of the facet just cleared', () => {
    const p = picked();
    const btn = { focused: 0, focus() { this.focused++; } };
    p.named['[data-pick="state"]'] = btn;
    p.press(clr('state'));
    assert.equal(btn.focused, 1);
});

test('pickclr: no popover row or search box is looked up (focus goes to the trigger, not into a popover)', () => {
    const p = picked();
    p.press(clr('state'));
    assert.deepEqual(p.asked.filter((q) => q.includes('.rpop')), []);
});

test('pickclr: the key it was given is read from data-pickclr, so no trigger of a missing key is looked up', () => {
    const p = picked();
    p.press(clr('state'));
    assert.equal(p.asked.some((q) => q.includes('"null"')), false);
});

test('pickclr: the trigger of the facet last opened is not the one looked up', () => {
    const p = picked();
    p.press(clr('state'));
    assert.equal(p.asked.includes('[data-pick="project"]'), false);
});

test('pickclr: it returns before the facet-button branch', () => {
    const p = picked();
    p.press({ '[data-pickclr]': { getAttribute: (k) => (k === 'data-pickclr' ? 'state' : null) }, '[data-facet] button': { parentNode: { getAttribute: () => 'state' }, getAttribute: () => 'live' } });
    assert.doesNotMatch(p.html(), /data-pickclr="state"/);
    assert.equal(p.writes.page, 1);
});

test('pickclr: off 清單 the click clears nothing and redraws nothing', () => {
    const p = boot('#/');
    p.reset();
    p.press(clr('state'));
    assert.equal(p.writes.page, 0);
    assert.deepEqual(p.asked, []);
});
