'use strict';
// Three more branches of the page's big click listener in assets/station/station.js,
// pressed through the listener itself with fake targets whose closest() answers
// only the selector a test names: `.fwrap` (a click outside the 篩選 wrapper shuts
// the panel), `.pg input[name^="pg-"]` (a tick on a pending gate re-counts it)
// and `[data-todo]` (記成 TODO posts the line to /todo). One effect per test, so
// that single-branch mutations of one branch redden different sets of tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';

const QS = [{ question: 'Q1', options: [{ label: 'a', description: '' }] }, { question: 'Q2', options: [{ label: 'b', description: '' }] }];
const session = (id) => ({ id, pkey: PK, root: PK, task: 't-' + id, state: 'live', route: ['survey', 'build'], stage: 'build',
    stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [],
    pending: { until: NOW + 60000, questions: QS } });

// station.js booted on `hash`; `fetched` logs every fetch (url, init) and
// `reply` is what the next fetch answers (a function returning a promise).
function boot(hash) {
    const listeners = {}, els = {}, writes = { page: 0 }, fetched = [];
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    const page = el('div');
    let html = '';
    Object.defineProperty(page, 'innerHTML', { get: () => html, set: (v) => { html = v; writes.page++; } });
    els.page = page;
    const p = { reply: () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') }), fetched, writes };
    const win = { location: { hash }, addEventListener() {}, scrollTo() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: true, nonce: 'N0NCE',
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [session('s1')] } };
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: () => null };
    const fetchFn = (url, init) => { fetched.push({ url, init }); return p.reply(); };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: fetchFn, module: { exports: {} } });
    const fns = (listeners.click || []).filter((fn) => String(fn).includes('[data-tune-notify]'));
    assert.equal(fns.length, 1, 'one click listener holds [data-tune-notify]');
    assert.ok(String(fns[0]).includes('[data-fbtn]'), 'and the same one holds [data-fbtn]');
    const click = fns[0];
    p.press = (answers) => click({ target: { closest: (sel) => (sel in answers ? answers[sel] : null) } });
    p.html = () => page.innerHTML;
    p.reset = () => { writes.page = 0; fetched.length = 0; };
    return p;
}
const flush = () => new Promise((r) => setImmediate(r));

// ---- .fwrap ---------------------------------------------------------------
// The days page with its 篩選 panel opened by the button's own click.
function panelOpen() {
    const p = boot('#/days');
    p.press({ '[data-fbtn]': {} });
    p.reset();
    return p;
}

test('fwrap: a click outside the filter wrapper redraws the days page once', () => {
    const p = panelOpen();
    p.press({});
    assert.equal(p.writes.page, 1);
});

test('fwrap: after an outside click the panel is shut (a second outside click redraws nothing)', () => {
    const p = panelOpen();
    p.press({});
    p.reset();
    p.press({});
    assert.equal(p.writes.page, 0);
});

test('fwrap: a click inside the filter wrapper redraws nothing', () => {
    const p = panelOpen();
    p.press({ '.fwrap': {} });
    assert.equal(p.writes.page, 0);
});

test('fwrap: a click inside the filter wrapper leaves the panel open (a later outside click still shuts it)', () => {
    const p = panelOpen();
    p.press({ '.fwrap': {} });
    p.reset();
    p.press({});
    assert.equal(p.writes.page, 1);
});

test('fwrap: with the panel shut an outside click redraws nothing', () => {
    const p = boot('#/days');
    p.reset();
    p.press({});
    assert.equal(p.writes.page, 0);
});

// ---- .pg input[name^="pg-"] -----------------------------------------------
// A pending-gate box for s1 whose ticked inputs are `ticked` (by question
// index); its count and button are the elements pgSync writes.
function gate(ticked) {
    const cnt = { textContent: '' }, btn = { disabled: null }, asked = [];
    const box = { asked, cnt, btn,
        getAttribute: (k) => (k === 'data-pg-id' ? 's1' : null),
        querySelectorAll(sel) {
            const m = /name="pg-(\d)"/.exec(sel);
            return m && ticked.includes(Number(m[1])) ? [{ value: 'v' + m[1] }] : [];
        },
        querySelector(sel) { asked.push(sel); return sel === '[data-answer]' ? btn : sel === '.pgn' ? cnt : null; } };
    return box;
}
const tick = (box) => ({ '.pg input[name^="pg-"]': { closest: (sel) => (sel === '.pg' ? box : null) } });

test('pg input: a tick on one of two questions writes the count 1 / 2', () => {
    const p = boot('#/');
    const box = gate([0]);
    p.press(tick(box));
    assert.equal(box.cnt.textContent, '1 / 2');
});

test('pg input: with every question ticked the answer button is enabled', () => {
    const p = boot('#/');
    const box = gate([0, 1]);
    p.press(tick(box));
    assert.equal(box.btn.disabled, false);
});

test('pg input: with a question still open the answer button is disabled', () => {
    const p = boot('#/');
    const box = gate([0]);
    p.press(tick(box));
    assert.equal(box.btn.disabled, true);
});

test('pg input: the tick returns before the answer branch (no POST, nothing redrawn)', async () => {
    const p = boot('#/');
    p.reset();
    const box = gate([0, 1]);
    const t = tick(box);
    t['[data-answer]'] = { closest: () => box };
    p.press(t);
    await flush();
    assert.deepEqual(p.fetched, []);
    assert.equal(p.writes.page, 0);
});

test('pg input: a click that is not on a pg input counts nothing', () => {
    const p = boot('#/');
    const box = gate([0, 1]);
    p.press({ '.pg': box });
    assert.equal(box.cnt.textContent, '');
    assert.deepEqual(box.asked, []);
});

// ---- [data-todo] ------------------------------------------------------------
function todoBox() {
    const said = { className: 'tdr', textContent: '' };
    const attrs = { 'data-todo-root': 'R:\\proj', 'data-todo-id': 'sid-9' };
    const box = { said,
        getAttribute: (k) => (k in attrs ? attrs[k] : null),
        querySelector(sel) { return sel === '.tdr' ? said : sel === 'textarea' ? { value: 'the line' } : sel === 'input' ? { value: 'docs/x.md#y' } : null; } };
    return { '[data-todo]': { closest: (sel) => (sel === '.tdf' ? box : null) }, box };
}
const todoPress = async (p, answer) => {
    const t = todoBox();
    if (answer) p.reply = answer;
    p.press({ '[data-todo]': t['[data-todo]'] });
    await flush();
    return t.box;
};
const answers = (ok, status, body) => () => Promise.resolve({ ok, status, text: () => Promise.resolve(body) });
const sent = (p, k) => new URLSearchParams(p.fetched[0].init.body).get(k);

test('todo: the line is posted to todo with method POST', async () => {
    const p = boot('#/');
    await todoPress(p);
    assert.equal(p.fetched.length, 1);
    assert.equal(p.fetched[0].url, 'todo');
    assert.equal(p.fetched[0].init.method, 'POST');
});

test('todo: the body carries the nonce', async () => {
    const p = boot('#/');
    await todoPress(p);
    assert.equal(sent(p, 'nonce'), 'N0NCE');
});

test('todo: the body carries the root from data-todo-root', async () => {
    const p = boot('#/');
    await todoPress(p);
    assert.equal(sent(p, 'root'), 'R:\\proj');
});

test('todo: the body carries the id from data-todo-id', async () => {
    const p = boot('#/');
    await todoPress(p);
    assert.equal(sent(p, 'id'), 'sid-9');
});

test('todo: the body carries the textarea value as text', async () => {
    const p = boot('#/');
    await todoPress(p);
    assert.equal(sent(p, 'text'), 'the line');
});

test('todo: the body carries the input value as link', async () => {
    const p = boot('#/');
    await todoPress(p);
    assert.equal(sent(p, 'link'), 'docs/x.md#y');
});

test('todo: an ok answer sets the class tdr ok', async () => {
    const p = boot('#/');
    const box = await todoPress(p, answers(true, 200, 'done'));
    assert.equal(box.said.className, 'tdr ok');
});

test('todo: an ok answer shows 寫進 TODO.md： and the trimmed body', async () => {
    const p = boot('#/');
    const box = await todoPress(p, answers(true, 200, '  - the line \n'));
    assert.equal(box.said.textContent, '寫進 TODO.md：- the line');
});

test('todo: a refused answer sets the class tdr bad', async () => {
    const p = boot('#/');
    const box = await todoPress(p, answers(false, 422, 'too long'));
    assert.equal(box.said.className, 'tdr bad');
});

test('todo: a refused answer shows the status, 沒有寫進去 and the trimmed body', async () => {
    const p = boot('#/');
    const box = await todoPress(p, answers(false, 422, ' too long\n'));
    assert.equal(box.said.textContent, '422 — 沒有寫進去：too long');
});

test('todo: a fetch that rejects sets tdr bad and asks whether serve is running', async () => {
    const p = boot('#/');
    const box = await todoPress(p, () => Promise.reject(new Error('down')));
    assert.equal(box.said.className, 'tdr bad');
    assert.equal(box.said.textContent, '送不出去：serve 還在跑嗎？');
});

test('todo: the click redraws nothing', async () => {
    const p = boot('#/');
    p.reset();
    await todoPress(p);
    assert.equal(p.writes.page, 0);
});
