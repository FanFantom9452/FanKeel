'use strict';
// The station's two POST /answer paths say they are sending: the floating
// gate's option and hand-off buttons, and the 懸著的 gate's 送出答案. Each
// press disables the box's buttons and writes 送出中…; a reply ok leaves
// them disabled; a refusal, a network error or no reply in 10 seconds gives
// them back with a line saying it may be pressed again. Driven through the
// page's own click listener in a vm, the way tests/station-hdl-j.test.js is.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';
const PENDING = { questions: [{ question: 'Q?', options: [{ label: 'A' }, { label: 'B' }] }] };

// Boot with a fetch the test settles by hand and a setTimeout it fires by hand.
function boot() {
    const listeners = {}, els = {}, timers = [], fetches = [], aborted = [];
    const el = () => ({ innerHTML: '', textContent: '', className: '', attrs: {}, style: {},
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {}, setInterval: () => 1,
        setTimeout: (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length; },
        clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: true, nonce: 'N0NCE',
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [{ id: 's1', pkey: PK, root: PK, task: 't', state: 'live', route: ['build'], stage: 'build', stages: [], notes: [],
                claims: [], conflicts: [], burn: 0, backtracks: 0, updated: NOW, started: new Date(NOW).toISOString(), days: [], pending: PENDING }] } };
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        createElement: el, querySelectorAll: () => [], querySelector: () => null };
    class FakeAbort { constructor() { this.signal = {}; } abort() { aborted.push(true); } }
    const fetchImpl = (url, init) => new Promise((resolve, reject) => { fetches.push({ url, init, resolve, reject }); });
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: fetchImpl, AbortController: FakeAbort, module: { exports: {} } });
    const click = (listeners.click || []).filter((fn) => String(fn).includes('[data-tune-notify]'))[0];
    const press = (answers) => click({ target: { closest: (sel) => (sel in answers ? answers[sel] : null) } });
    return { press, timers, fetches, aborted };
}

const btn = (attrs) => ({ disabled: false, attrs, getAttribute: (k) => (k in attrs ? attrs[k] : null) });
// A floating .gc holding two options and the hand-off.
function gc() {
    const gend = { className: 'gend', textContent: '' };
    const btns = [btn({ 'data-gop': '0' }), btn({ 'data-gop': '1' }), btn({ 'data-gho': '' })];
    const attrs = { 'data-pg-id': 's1', 'data-pg-root': PK };
    return { gend, btns, getAttribute: (k) => (k in attrs ? attrs[k] : null),
        querySelector: (sel) => (sel === '.gend' ? gend : null), querySelectorAll: () => btns };
}
const gop = (box) => ({ '[data-gop]': { getAttribute: () => '0', closest: (sel) => (sel === '.gc' ? box : null) } });
// A 懸著的 gate's .pg with its one question ticked A.
function pg() {
    const pgr = { className: 'pgr', textContent: '' };
    const send = btn({ 'data-answer': '' });
    const attrs = { 'data-pg-id': 's1', 'data-pg-root': PK };
    const ticked = { value: 'A', checked: true };
    return { pgr, btns: [send], getAttribute: (k) => (k in attrs ? attrs[k] : null),
        querySelector: (sel) => (sel === '.pgr' ? pgr : null),
        querySelectorAll: (sel) => (sel.indexOf('input[name="pg-') === 0 ? [ticked] : [send]) };
}
const answer = (box) => ({ '[data-answer]': { closest: (sel) => (sel === '.pg' ? box : null) } });
const settle = () => new Promise((r) => setImmediate(r));
const live = (t) => t.filter((x) => !x.cleared && x.ms === 10000);

test('gop: the press disables every button of the gate and writes 送出中…', () => {
    const b = boot(), box = gc();
    b.press(gop(box));
    assert.deepEqual(box.btns.map((x) => x.disabled), [true, true, true]);
    assert.equal(box.gend.textContent, '送出中…');
    assert.equal(box.gend.className, 'gend wait');
});

test('gop: the fetch carries an abort signal and a 10-second timer is set', () => {
    const b = boot(), box = gc();
    b.press(gop(box));
    assert.ok(b.fetches[0].init.signal);
    assert.equal(live(b.timers).length, 1);
});

test('gop: a reply ok leaves the buttons disabled and clears the timer', async () => {
    const b = boot(), box = gc();
    b.press(gop(box));
    b.fetches[0].resolve({ ok: true, status: 200, text: () => Promise.resolve('answered 1 question(s)') });
    await settle();
    assert.deepEqual(box.btns.map((x) => x.disabled), [true, true, true]);
    assert.equal(box.gend.textContent, '已送出：answered 1 question(s)');
    assert.equal(live(b.timers).length, 0);
});

test('gop: a network error gives the buttons back', async () => {
    const b = boot(), box = gc();
    b.press(gop(box));
    b.fetches[0].reject(new Error('down'));
    await settle();
    assert.deepEqual(box.btns.map((x) => x.disabled), [false, false, false]);
    assert.equal(box.gend.className, 'gend bad');
    assert.equal(box.gend.textContent, '送不出去：serve 還在跑嗎？可以再按一次');
});

test('gop: a refusal gives the buttons back and keeps the status line', async () => {
    const b = boot(), box = gc();
    b.press(gop(box));
    b.fetches[0].resolve({ ok: false, status: 409, text: () => Promise.resolve('no gate') });
    await settle();
    assert.deepEqual(box.btns.map((x) => x.disabled), [false, false, false]);
    assert.equal(box.gend.textContent, '409 — no gate');
});

test('gop: no reply in 10 seconds aborts the fetch and gives the buttons back', async () => {
    const b = boot(), box = gc();
    b.press(gop(box));
    live(b.timers)[0].fn();
    assert.equal(b.aborted.length, 1);
    assert.deepEqual(box.btns.map((x) => x.disabled), [false, false, false]);
    assert.equal(box.gend.textContent, '還沒確認送到：可以再按一次');
    b.fetches[0].reject(new Error('aborted'));
    await settle();
    assert.equal(box.gend.textContent, '還沒確認送到：可以再按一次', 'the abort\'s own rejection writes nothing over it');
});

test('answer: the press disables 送出答案 and writes 送出中…', () => {
    const b = boot(), box = pg();
    b.press(answer(box));
    assert.equal(box.btns[0].disabled, true);
    assert.equal(box.pgr.textContent, '送出中…');
});

test('answer: no reply in 10 seconds gives 送出答案 back', () => {
    const b = boot(), box = pg();
    b.press(answer(box));
    live(b.timers)[0].fn();
    assert.equal(box.btns[0].disabled, false);
    assert.equal(box.pgr.className, 'pgr bad');
});

test('answer: a network error gives 送出答案 back', async () => {
    const b = boot(), box = pg();
    b.press(answer(box));
    b.fetches[0].reject(new Error('down'));
    await settle();
    assert.equal(box.btns[0].disabled, false);
    assert.equal(box.pgr.textContent, '送不出去：serve 還在跑嗎？可以再按一次');
});

const gho = (box) => ({ '[data-gho]': {}, '.gc': box });

test('gho: the hand-off press disables the gate and a network error gives it back', async () => {
    const b = boot(), box = gc();
    b.press(gho(box));
    assert.deepEqual(box.btns.map((x) => x.disabled), [true, true, true]);
    assert.equal(box.gend.textContent, '送出中…');
    b.fetches[0].reject(new Error('down'));
    await settle();
    assert.deepEqual(box.btns.map((x) => x.disabled), [false, false, false]);
    assert.equal(box.gend.textContent, '送不出去：serve 還在跑嗎？可以再按一次');
});
