'use strict';
// Branches of the page's big click listener in assets/station/station.js (the one
// holding `[data-tune-notify]`), pressed through the listener itself with fake
// targets whose closest() answers only the selector a test names. Every test
// presses its selector; every test but the `guard:` ones asserts that branch's own
// effect, one effect per test, so single-branch mutations of one branch redden
// different sets of tests. A `guard:` test asserts only that something did NOT
// happen (nothing thrown, nothing drawn, nothing fetched, a value left as it was):
// it stays green when its branch is deleted, so it does not count as a hit for the
// selector table. (Some non-guard tests also stay green on a deletion, e.g. "returns
// before the later branches" and toggle-back ones; each asserts a positive effect that
// a different mutation, the `return` removed or the toggle flipped, reddens.)
//   `[data-tune-notify]`, `[data-answer]` (with its four fetch outcomes) and the
//   `.gend` line gatePost writes after a `[data-gop]` / `[data-gho]` press;
//   then the branches no earlier test pressed: `[data-fbtn]`, the legend's
//   `.legend [data-key]` / `[data-rest]`, `[data-pick]`, the `.rpop` outside
//   click, `[data-facet] button`, `input[data-cmp]`, `tr[data-id]`, and the
//   wizard's `[data-h]` / `[data-st]` / `[data-ask]`.
// STATION_SRC points the suite at a scratch copy of station.js (mutation runs).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const profile = require('../lib/profile.js');

const SRC = fs.readFileSync(process.env.STATION_SRC || path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';

const session = (id, pkey) => ({ id, pkey: pkey || PK, root: pkey || PK, task: 't-' + id, state: 'live', route: ['survey', 'build'], stage: 'build',
    stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [] });

// station.js booted on `hash`. opts: { pending } gives s1 that gate; { notification }
// gives the window a Notification (p.notified counts requestPermission calls);
// { sessions: n } makes s1..sn; { days: n } gives each session a day of usage on
// its own model (n sessions on n projects). p.reply is what the next fetch
// answers; p.fetched logs { url, method, body }. p.named answers querySelector.
function boot(hash, opts) {
    opts = opts || {};
    const listeners = {}, els = {}, writes = { page: 0 };
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    const page = el('div');
    let html = '';
    Object.defineProperty(page, 'innerHTML', { get: () => html, set: (v) => { html = v; writes.page++; } });
    els.page = page;
    for (const id of ['selbar', 'lb']) {
        const e = el('div');
        let h = '';
        writes[id] = 0;
        Object.defineProperty(e, 'innerHTML', { get: () => h, set: (v) => { h = v; writes[id]++; } });
        els[id] = e;
    }
    const p = { writes, byId: {}, named: {}, asked: [], qsa: () => [], els, fetched: [], notified: 0, focused: [],
        reply: () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') }) };
    const sessions = [];
    for (let i = 1; i <= (opts.sessions || (opts.days ? opts.days : 1)); i++) {
        const s = session('s' + i, opts.days ? 'F:\\ws\\p' + i : PK);
        if (opts.days) s.days = [{ day: '2026-10-01', model: 'claude-opus-4-' + i, usd: i, tokens: { input: 10 * i } }];
        sessions.push(s);
    }
    if (opts.pending) sessions[0].pending = opts.pending;
    const win = { location: { hash }, addEventListener() {}, scrollTo() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: true, nonce: 'N0NCE',
            projects: (opts.days ? sessions.map((x) => x.pkey) : [PK]).map((root) => ({ root, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] })),
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: profile.WIZARD_KEYS, classes: {}, sessions } };
    if (opts.notification) win.Notification = { requestPermission() { p.notified++; return Promise.resolve(); } };
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', head: { appendChild() {} },
        getElementById: (id) => (id in p.byId ? p.byId[id] : els[id] || (els[id] = el())),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el,
        querySelectorAll: (sel) => { p.asked.push(sel); return p.qsa(sel); },
        querySelector: (sel) => { p.asked.push(sel); return sel in p.named ? p.named[sel] : null; } };
    const fetchFn = (url, init) => { p.fetched.push({ url, method: init && init.method, body: init && init.body ? init.body.toString() : null }); return p.reply(); };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: fetchFn, module: { exports: {} } });
    const fns = (listeners.click || []).filter((fn) => String(fn).includes('[data-tune-notify]'));
    assert.equal(fns.length, 1, 'one click listener holds [data-tune-notify]');
    const click = fns[0];
    p.press = (answers) => click({ target: { closest: (sel) => (sel in answers ? answers[sel] : null) } });
    p.reset = () => { for (const k of Object.keys(writes)) writes[k] = 0; p.asked.length = 0; p.fetched.length = 0; };
    p.html = () => page.innerHTML;
    p.input = (target) => { for (const fn of listeners.input || []) fn({ target }); };
    return p;
}

const node = (attrs, extra) => Object.assign({ attrs, getAttribute: (k) => (k in attrs ? attrs[k] : null), hasAttribute: (k) => k in attrs,
    setAttribute(k, v) { attrs[k] = String(v); }, focused: 0, focus() { this.focused++; } }, extra);
const flush = () => new Promise((r) => setImmediate(r));
const reply = (ok, status, body) => () => Promise.resolve({ ok, status, text: () => Promise.resolve(body) });
const wfProbe = () => node({ 'data-wf': 'probe' });
const bodyOf = (call) => new URLSearchParams(call.body);

// ---- [data-tune-notify] -----------------------------------------------------
test('tune-notify: a press with a window Notification asks for permission once', () => {
    const p = boot('#/', { notification: true });
    p.press({ '[data-tune-notify]': {} });
    assert.equal(p.notified, 1);
});

test('tune-notify: the page is drawn once the permission promise resolves', async () => {
    const p = boot('#/', { notification: true });
    p.reset();
    p.press({ '[data-tune-notify]': {} });
    await flush();
    assert.equal(p.writes.page, 1);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: tune-notify: the page is not drawn before the promise resolves', () => {
    const p = boot('#/', { notification: true });
    p.reset();
    p.press({ '[data-tune-notify]': {} });
    assert.equal(p.writes.page, 0);
});

test('tune-notify: it returns before the later branches (a [data-wf] answer does not redraw the page)', () => {
    const p = boot('#/', { notification: true });
    p.reset();
    p.press({ '[data-tune-notify]': {}, '[data-wf]': wfProbe() });
    assert.equal(p.writes.page, 0);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: tune-notify: with no window Notification the press throws nothing and asks nobody', () => {
    const p = boot('#/');
    assert.doesNotThrow(() => p.press({ '[data-tune-notify]': {} }));
});

test('tune-notify: with no window Notification the press falls through to the later branches (a [data-wf] answer redraws once)', () => {
    const p = boot('#/');
    p.reset();
    p.press({ '[data-tune-notify]': {}, '[data-wf]': wfProbe() });
    assert.equal(p.writes.page, 1);
});

// ---- [data-answer] ------------------------------------------------------------
const QS = [{ question: 'Q1', options: [{ label: 'a' }] }, { question: 'Q2', options: [{ label: 'b' }] }];
const PENDING = { until: NOW + 60000, questions: QS };
// A .pg box for session `id` with questions answered `ticked` (by index); its .pgr is the result line.
function pgBox(ticked, id, root) {
    const pgr = { className: 'pgr', textContent: '' };
    const attrs = { 'data-pg-id': id === undefined ? 's1' : id, 'data-pg-root': root === undefined ? PK : root };
    return { pgr, getAttribute: (k) => (k in attrs ? attrs[k] : null),
        querySelectorAll(sel) { const m = /name="pg-(\d)"/.exec(sel); return m && ticked.includes(Number(m[1])) ? [{ value: 'v' + m[1] }] : []; },
        querySelector: (sel) => (sel === '.pgr' ? pgr : null) };
}
const answerPress = (box, extra) => Object.assign({ '[data-answer]': { closest: (sel) => (sel === '.pg' ? box : null) } }, extra);
async function answered(p, box) { p.press(answerPress(box)); await flush(); return box; }

test('answer: with one question open the result line reads pgr bad', () => {
    const p = boot('#/', { pending: PENDING });
    const box = pgBox([0]);
    p.press(answerPress(box));
    assert.equal(box.pgr.className, 'pgr bad');
});

test('answer: with one question open the result line counts it: 還有 1 題沒答', () => {
    const p = boot('#/', { pending: PENDING });
    const box = pgBox([0]);
    p.press(answerPress(box));
    assert.equal(box.pgr.textContent, '還有 1 題沒答');
});

test('answer: with both questions open the result line counts 2', () => {
    const p = boot('#/', { pending: PENDING });
    const box = pgBox([]);
    p.press(answerPress(box));
    assert.equal(box.pgr.textContent, '還有 2 題沒答');
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: answer: with a question open nothing is fetched', () => {
    const p = boot('#/', { pending: PENDING });
    p.press(answerPress(pgBox([0])));
    assert.deepEqual(p.fetched, []);
});

test('answer: the missing-answer path returns before the later branches (a [data-wf] answer does not redraw)', () => {
    const p = boot('#/', { pending: PENDING });
    p.reset();
    p.press(answerPress(pgBox([0]), { '[data-wf]': wfProbe() }));
    assert.equal(p.writes.page, 0);
});

test('answer: with every question answered one fetch goes to the url answer', () => {
    const p = boot('#/', { pending: PENDING });
    p.press(answerPress(pgBox([0, 1])));
    assert.deepEqual(p.fetched.map((c) => c.url), ['answer']);
});

test('answer: the fetch uses the method POST', () => {
    const p = boot('#/', { pending: PENDING });
    p.press(answerPress(pgBox([0, 1])));
    assert.equal(p.fetched[0].method, 'POST');
});

test('answer: the body carries the nonce', () => {
    const p = boot('#/', { pending: PENDING });
    p.press(answerPress(pgBox([0, 1])));
    assert.equal(bodyOf(p.fetched[0]).get('nonce'), 'N0NCE');
});

test('answer: the body carries the root from data-pg-root', () => {
    const p = boot('#/', { pending: PENDING });
    p.press(answerPress(pgBox([0, 1], 's1', 'F:\\other')));
    assert.equal(bodyOf(p.fetched[0]).get('root'), 'F:\\other');
});

test('answer: the body carries the id from data-pg-id', () => {
    const p = boot('#/', { pending: PENDING, sessions: 2 });
    p.press(answerPress(pgBox([0, 1], 's1')));
    assert.equal(bodyOf(p.fetched[0]).get('id'), 's1');
});

test('answer: the body carries the answers read off the form, as JSON', () => {
    const p = boot('#/', { pending: PENDING });
    p.press(answerPress(pgBox([0, 1])));
    assert.deepEqual(JSON.parse(bodyOf(p.fetched[0]).get('answers')), { Q1: 'v0', Q2: 'v1' });
});

test('answer: a reply ok writes pgr ok', async () => {
    const p = boot('#/', { pending: PENDING });
    p.reply = reply(true, 200, 'done');
    assert.equal((await answered(p, pgBox([0, 1]))).pgr.className, 'pgr ok');
});

test('answer: a reply ok writes 已送出： and the body', async () => {
    const p = boot('#/', { pending: PENDING });
    p.reply = reply(true, 200, 'done');
    assert.equal((await answered(p, pgBox([0, 1]))).pgr.textContent, '已送出：done');
});

test('answer: a reply ok trims the body', async () => {
    const p = boot('#/', { pending: PENDING });
    p.reply = reply(true, 200, '  done \n');
    assert.equal((await answered(p, pgBox([0, 1]))).pgr.textContent, '已送出：done');
});

test('answer: a reply 500 writes pgr bad', async () => {
    const p = boot('#/', { pending: PENDING });
    p.reply = reply(false, 500, 'boom');
    assert.equal((await answered(p, pgBox([0, 1]))).pgr.className, 'pgr bad');
});

test('answer: a reply 500 writes the status, a dash and the body', async () => {
    const p = boot('#/', { pending: PENDING });
    p.reply = reply(false, 500, 'boom');
    assert.equal((await answered(p, pgBox([0, 1]))).pgr.textContent, '500 — boom');
});

test('answer: a reply 500 trims the body', async () => {
    const p = boot('#/', { pending: PENDING });
    p.reply = reply(false, 500, ' boom\n');
    assert.equal((await answered(p, pgBox([0, 1]))).pgr.textContent, '500 — boom');
});

test('answer: a reply 404 puts its own status in front', async () => {
    const p = boot('#/', { pending: PENDING });
    p.reply = reply(false, 404, 'gone');
    assert.equal((await answered(p, pgBox([0, 1]))).pgr.textContent, '404 — gone');
});

test('answer: a rejected fetch writes pgr bad', async () => {
    const p = boot('#/', { pending: PENDING });
    p.reply = () => Promise.reject(new Error('down'));
    assert.equal((await answered(p, pgBox([0, 1]))).pgr.className, 'pgr bad');
});

test('answer: a rejected fetch writes 送不出去：serve 還在跑嗎？', async () => {
    const p = boot('#/', { pending: PENDING });
    p.reply = () => Promise.reject(new Error('down'));
    assert.equal((await answered(p, pgBox([0, 1]))).pgr.textContent, '送不出去：serve 還在跑嗎？');
});

test('answer: the fetch branch returns before the later branches (a [data-wf] answer does not redraw)', () => {
    const p = boot('#/', { pending: PENDING });
    p.reset();
    p.press(answerPress(pgBox([0, 1]), { '[data-wf]': wfProbe() }));
    assert.equal(p.writes.page, 0);
});

test('answer: a .pg whose id names no session posts an empty answers object', () => {
    const p = boot('#/', { pending: PENDING });
    p.press(answerPress(pgBox([], 'zz')));
    assert.equal(bodyOf(p.fetched[0]).get('answers'), '{}');
});

test('answer: a session with no pending gate posts an empty answers object', () => {
    const p = boot('#/');
    p.press(answerPress(pgBox([])));
    assert.equal(bodyOf(p.fetched[0]).get('answers'), '{}');
});

// ---- .gend in gatePost, via [data-gop] and [data-gho] -------------------------
const GPEND = { until: NOW + 60000, questions: [{ question: 'Q?', options: [{ label: 'A' }, { label: 'B' }] }] };
const gc = () => {
    const gend = { className: '', textContent: '' };
    return node({ 'data-pg-id': 's1', 'data-pg-root': PK }, { querySelector: (sel) => (sel === '.gend' ? gend : null), gend });
};
const viaGop = (g) => ({ '[data-gop]': node({ 'data-gop': '0' }, { closest: (sel) => (sel === '.gc' ? g : null) }) });
const viaGho = (g) => ({ '[data-gho]': node({}), '.gc': g });
const VIAS = [['gop', viaGop, '已送出：'], ['gho', viaGho, '已交給終端：']];
for (const [name, via, said] of VIAS) {
    const run = async (rep) => {
        const p = boot('#/', { pending: GPEND });
        p.reply = rep;
        const g = gc();
        p.press(via(g));
        await flush();
        return g.gend;
    };
    test(name + ' gend: a reply ok writes exactly gend ok', async () => {
        assert.equal((await run(reply(true, 200, 'done'))).className, 'gend ok');
    });
    test(name + ' gend: a reply ok writes ' + said + ' and the body', async () => {
        assert.equal((await run(reply(true, 200, 'done'))).textContent, said + 'done');
    });
    test(name + ' gend: a reply ok trims the body', async () => {
        assert.equal((await run(reply(true, 200, ' done\n'))).textContent, said + 'done');
    });
    test(name + ' gend: a reply 500 writes exactly gend bad', async () => {
        assert.equal((await run(reply(false, 500, 'boom'))).className, 'gend bad');
    });
    test(name + ' gend: a reply 500 writes the status, a dash and the body', async () => {
        assert.equal((await run(reply(false, 500, 'boom'))).textContent, '500 — boom');
    });
    test(name + ' gend: a reply 500 trims the body', async () => {
        assert.equal((await run(reply(false, 500, ' boom\n'))).textContent, '500 — boom');
    });
    test(name + ' gend: a reply 404 puts its own status in front', async () => {
        assert.equal((await run(reply(false, 404, 'gone'))).textContent, '404 — gone');
    });
    test(name + ' gend: a rejected fetch writes exactly gend bad', async () => {
        assert.equal((await run(() => Promise.reject(new Error('down')))).className, 'gend bad');
    });
    test(name + ' gend: a rejected fetch writes 送不出去：serve 還在跑嗎？', async () => {
        assert.equal((await run(() => Promise.reject(new Error('down')))).textContent, '送不出去：serve 還在跑嗎？');
    });
}

// ---- [data-fbtn] ---------------------------------------------------------------
// The button sits inside the .fwrap wrapper, as in the page.
const FB = { '[data-fbtn]': {}, '.fwrap': {} };
const panelShown = (p) => p.html().includes('data-fk="');

test('fbtn: on the days page the press opens the 篩選 panel', () => {
    const p = boot('#/days', { days: 2 });
    assert.equal(panelShown(p), false);
    p.press(FB);
    assert.equal(panelShown(p), true);
});

test('fbtn: a second press shuts the panel again', () => {
    const p = boot('#/days', { days: 2 });
    p.press(FB);
    p.press(FB);
    assert.equal(panelShown(p), false);
});

test('fbtn: the press redraws the page once', () => {
    const p = boot('#/days', { days: 2 });
    p.reset();
    p.press(FB);
    assert.equal(p.writes.page, 1);
});

test('fbtn: focus goes to the button found in the redrawn page', () => {
    const p = boot('#/days', { days: 2 });
    const btn = node({});
    p.named['[data-fbtn]'] = btn;
    p.press(FB);
    assert.equal(btn.focused, 1);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: fbtn: a press with no button in the new DOM does not throw', () => {
    const p = boot('#/days', { days: 2 });
    assert.doesNotThrow(() => p.press({ '[data-fbtn]': {} }));
});

test('fbtn: it returns before the later branches (a [data-wf] answer does not redraw a second time)', () => {
    const p = boot('#/days', { days: 2 });
    p.reset();
    p.press(Object.assign({}, FB, { '[data-wf]': wfProbe() }));
    assert.equal(p.writes.page, 1);
});

// ---- .legend [data-key], .legend [data-rest] --------------------------------------
const LEG = '.legend [data-key], .legend [data-rest]';
const offKeys = (p) => { const out = []; p.html().replace(/<span data-key="([^"]*)"[^>]*data-off/g, (m, k) => { out.push(k); return m; }); return out.sort().join(','); };
const entry = (attrs) => node(attrs);

test('legend: a press on a lit entry takes its key out (the entry is rebuilt dimmed)', () => {
    const p = boot('#/days', { days: 2 });
    p.press({ [LEG]: entry({ 'data-key': 'opus-4-1' }) });
    assert.equal(offKeys(p), 'opus-4-1');
});

test('legend: a press on a dimmed entry puts its key back', () => {
    const p = boot('#/days', { days: 2 });
    p.press({ [LEG]: entry({ 'data-key': 'opus-4-1' }) });
    p.press({ [LEG]: entry({ 'data-key': 'opus-4-1', 'data-off': '' }) });
    assert.equal(offKeys(p), '');
});

test('legend: another entry is its own key and leaves the first alone', () => {
    const p = boot('#/days', { days: 2 });
    p.press({ [LEG]: entry({ 'data-key': 'opus-4-1' }) });
    p.press({ [LEG]: entry({ 'data-key': 'opus-4-2' }) });
    assert.equal(offKeys(p), 'opus-4-1,opus-4-2');
});

test('legend: the press redraws the page once', () => {
    const p = boot('#/days', { days: 2 });
    p.reset();
    p.press({ [LEG]: entry({ 'data-key': 'opus-4-1' }) });
    assert.equal(p.writes.page, 1);
});

test('legend: focus goes back to the entry, found by its key', () => {
    const p = boot('#/days', { days: 2 });
    const back = node({});
    p.named['.legend [data-key="opus-4-1"]'] = back;
    p.press({ [LEG]: entry({ 'data-key': 'opus-4-1' }) });
    assert.equal(back.focused, 1);
});

test('legend: it returns before the later branches (a [data-wf] answer does not redraw a second time)', () => {
    const p = boot('#/days', { days: 2 });
    p.reset();
    p.press({ [LEG]: entry({ 'data-key': 'opus-4-1' }), '[data-wf]': wfProbe() });
    assert.equal(p.writes.page, 1);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: legend: off the days page a press on an entry redraws nothing', () => {
    const p = boot('#/', { days: 2 });
    p.reset();
    p.press({ [LEG]: entry({ 'data-key': 'opus-4-1' }) });
    assert.equal(p.writes.page, 0);
});

// 其他 N 個 exists on the project dimension once there are more than five projects.
const restBoot = () => {
    const p = boot('#/days', { days: 7 });
    p.press({ '[data-seg] button': node({ 'data-v': 'project' }, { parentNode: node({ 'data-seg': 'dim' }) }) });
    p.reset();
    return p;
};
const restTag = (p) => (/<span data-rest[^>]*>/.exec(p.html()) || [''])[0];

test('legend rest: the press on 其他 N 個 dims it (its members go out)', () => {
    const p = restBoot();
    assert.equal(restTag(p), '<span data-rest>');
    p.press({ [LEG]: entry({ 'data-rest': '' }) });
    assert.equal(restTag(p), '<span data-rest data-off>');
});

test('legend rest: the press on a dimmed 其他 N 個 lights it again', () => {
    const p = restBoot();
    p.press({ [LEG]: entry({ 'data-rest': '' }) });
    p.press({ [LEG]: entry({ 'data-rest': '', 'data-off': '' }) });
    assert.equal(restTag(p), '<span data-rest>');
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: legend rest: the entries with their own swatch stay lit', () => {
    const p = restBoot();
    p.press({ [LEG]: entry({ 'data-rest': '' }) });
    assert.equal(offKeys(p), '');
});

test('legend rest: the press redraws the page once', () => {
    const p = restBoot();
    p.press({ [LEG]: entry({ 'data-rest': '' }) });
    assert.equal(p.writes.page, 1);
});

test('legend rest: focus goes back to the 其他 entry', () => {
    const p = restBoot();
    const back = node({});
    p.named['.legend [data-rest]'] = back;
    p.press({ [LEG]: entry({ 'data-rest': '' }) });
    assert.equal(back.focused, 1);
});

// ---- [data-pick] -----------------------------------------------------------------
const pickBtn = (key) => node({ 'data-pick': key });
const rpops = (p) => (p.html().match(/class="rpop"/g) || []).length;

test('pick: a press on a facet trigger opens its popover', () => {
    const p = boot('#/list');
    p.press({ '[data-pick]': pickBtn('state') });
    assert.equal(rpops(p), 1);
});

test('pick: a second press on the same trigger shuts it', () => {
    const p = boot('#/list');
    p.press({ '[data-pick]': pickBtn('state') });
    p.press({ '[data-pick]': pickBtn('state') });
    assert.equal(rpops(p), 0);
});

test('pick: a press on another trigger moves the popover (one open, not two)', () => {
    const p = boot('#/list');
    p.press({ '[data-pick]': pickBtn('state') });
    p.press({ '[data-pick]': pickBtn('project') });
    assert.equal(rpops(p), 1);
});

test('pick: the press redraws the page once', () => {
    const p = boot('#/list');
    p.reset();
    p.press({ '[data-pick]': pickBtn('state') });
    assert.equal(p.writes.page, 1);
});

test('pick: opening puts focus on the popover\'s first way in', () => {
    const p = boot('#/list');
    const q = node({});
    p.named['.rpop [data-pickq]'] = q;
    p.press({ '[data-pick]': pickBtn('state') });
    assert.equal(q.focused, 1);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: pick: opening does not put focus on the trigger', () => {
    const p = boot('#/list');
    const btn = node({});
    p.named['[data-pick="state"]'] = btn;
    p.press({ '[data-pick]': pickBtn('state') });
    assert.equal(btn.focused, 0);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: pick: shutting does not put focus into the popover', () => {
    const p = boot('#/list');
    const q = node({});
    p.named['.rpop [data-pickq]'] = q;
    p.press({ '[data-pick]': pickBtn('state') });
    q.focused = 0;
    p.press({ '[data-pick]': pickBtn('state') });
    assert.equal(q.focused, 0);
});

test('pick: shutting puts focus back on the trigger just pressed, found by its key', () => {
    const p = boot('#/list');
    const btn = node({});
    p.named['[data-pick="state"]'] = btn;
    p.press({ '[data-pick]': pickBtn('state') });
    btn.focused = 0;
    p.press({ '[data-pick]': pickBtn('state') });
    assert.equal(btn.focused, 1);
});

test('pick: opening clears what was typed in the popover\'s search box', () => {
    const p = boot('#/list', { days: 7 });
    p.press({ '[data-pick]': pickBtn('project') });
    assert.match(p.html(), /data-pickq/);
    p.input({ hasAttribute: (k) => k === 'data-pickq', value: 'zzz' });
    p.press({ '[data-pick]': pickBtn('project') });
    p.press({ '[data-pick]': pickBtn('project') });
    assert.doesNotMatch(p.html(), /value="zzz"/);
});

test('pick: it returns before the later branches (a [data-wf] answer does not redraw a second time)', () => {
    const p = boot('#/list');
    p.reset();
    p.press({ '[data-pick]': pickBtn('state'), '[data-wf]': wfProbe() });
    assert.equal(p.writes.page, 1);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: pick: off the list page a press opens nothing', () => {
    const p = boot('#/');
    p.reset();
    p.press({ '[data-pick]': pickBtn('state') });
    assert.equal(p.writes.page, 0);
});

// ---- .rpop (a click outside the open popover) ---------------------------------------
function popOpen() {
    const p = boot('#/list');
    p.press({ '[data-pick]': pickBtn('state') });
    p.reset();
    return p;
}

test('rpop: a click outside the open popover shuts it', () => {
    const p = popOpen();
    p.press({});
    assert.equal(rpops(p), 0);
});

test('rpop: the outside click clears the open state (a later redraw shows no popover)', () => {
    const p = popOpen();
    p.press({});
    p.press({ '[data-wf]': wfProbe() });
    assert.equal(rpops(p), 0);
});

test('rpop: the outside click redraws the page once', () => {
    const p = popOpen();
    p.press({});
    assert.equal(p.writes.page, 1);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: rpop: a click inside the open popover leaves it open', () => {
    const p = popOpen();
    p.press({ '.rpop': {} });
    assert.equal(rpops(p), 1);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: rpop: a click inside the open popover redraws nothing', () => {
    const p = popOpen();
    p.press({ '.rpop': {} });
    assert.equal(p.writes.page, 0);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: rpop: an outside click with no popover open redraws nothing', () => {
    const p = boot('#/list');
    p.reset();
    p.press({});
    assert.equal(p.writes.page, 0);
});

test('rpop: an outside click still does what it was aimed at (a [data-wf] answer redraws a second time)', () => {
    const p = popOpen();
    p.press({ '[data-wf]': wfProbe() });
    assert.equal(p.writes.page, 2);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: rpop: off the list page an outside click redraws nothing', () => {
    const p = boot('#/');
    p.reset();
    p.press({});
    assert.equal(p.writes.page, 0);
});

// ---- [data-facet] button ----------------------------------------------------------------
const facetBtn = (key, v) => node({ 'data-v': v }, { parentNode: node({ 'data-facet': key }) });
const cleared = (p, key) => !new RegExp('data-pickclr="' + key + '"').test(p.html());

test('facet: a press on a value button sets that facet (its × appears)', () => {
    const p = boot('#/list');
    assert.equal(cleared(p, 'state'), true);
    p.press({ '[data-facet] button': facetBtn('state', 'live') });
    assert.equal(cleared(p, 'state'), false);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: facet: the key comes from the parent, not another facet', () => {
    const p = boot('#/list');
    p.press({ '[data-facet] button': facetBtn('state', 'live') });
    assert.equal(cleared(p, 'project'), true);
});

test('facet: the press redraws the page once', () => {
    const p = boot('#/list');
    p.reset();
    p.press({ '[data-facet] button': facetBtn('state', 'live') });
    assert.equal(p.writes.page, 1);
});

test('facet: with a popover open the pick shuts it', () => {
    const p = popOpen();
    p.press({ '[data-facet] button': Object.assign(facetBtn('state', 'live'), {}), '.rpop': {} });
    assert.equal(rpops(p), 0);
});

test('facet: with a popover open focus goes back to its trigger', () => {
    const p = popOpen();
    const btn = node({});
    p.named['[data-pick="state"]'] = btn;
    p.press({ '[data-facet] button': facetBtn('state', 'live'), '.rpop': {} });
    assert.equal(btn.focused, 1);
});

test('facet: with a popover open the pick redraws once and returns (a [data-wf] answer does not add a draw)', () => {
    const p = popOpen();
    p.press({ '[data-facet] button': facetBtn('state', 'live'), '.rpop': {}, '[data-wf]': wfProbe() });
    assert.equal(p.writes.page, 1);
});

test('facet: with no popover open the pick returns before the later branches (a [data-wf] answer does not add a draw)', () => {
    const p = boot('#/list');
    p.reset();
    p.press({ '[data-facet] button': facetBtn('state', 'live'), '[data-wf]': wfProbe() });
    assert.equal(p.writes.page, 1);
});

// ---- input[data-cmp] ------------------------------------------------------------------------
const tick = (id, checked) => ({ 'input[data-cmp]': node({ 'data-cmp': id }, { checked }) });
const ticks = (p) => { const out = []; p.els.lb.innerHTML.replace(/data-cmp="(s\d)"[^>]*? checked/g, (m, id) => { out.push(id); return m; }); return out.join(','); };
const withLb = boot;
const selbarCount = (p) => (/<b id="ncmp">(\d+)<\/b>/.exec(p.els.selbar.innerHTML) || [])[1];

test('cmp: a tick puts the session on the selection bar (count 1)', () => {
    const p = withLb('#/list', { sessions: 3 });
    p.press(tick('s1', true));
    assert.equal(selbarCount(p), '1');
});

test('cmp: a tick redraws the table with that row ticked', () => {
    const p = withLb('#/list', { sessions: 3 });
    p.press(tick('s1', true));
    assert.equal(ticks(p), 's1');
});

test('cmp: an un-tick takes the session off', () => {
    const p = withLb('#/list', { sessions: 3 });
    p.press(tick('s1', true));
    p.press(tick('s1', false));
    assert.equal(ticks(p), '');
});

test('cmp: the same tick twice counts the session once', () => {
    const p = withLb('#/list', { sessions: 3 });
    p.press(tick('s1', true));
    p.press(tick('s1', true));
    assert.equal(selbarCount(p), '1');
});

test('cmp: the id ticked is the one pressed (s2 ticks the row s2)', () => {
    const p = withLb('#/list', { sessions: 3 });
    p.press(tick('s2', true));
    assert.equal(ticks(p), 's2');
});

test('cmp: after a third tick the bar counts 2', () => {
    const p = withLb('#/list', { sessions: 4 });
    for (const id of ['s1', 's2', 's3']) p.press(tick(id, true));
    assert.equal(selbarCount(p), '2');
});

test('cmp: four ticks never leave the bar counting more than 3', () => {
    const p = withLb('#/list', { sessions: 4 });
    for (const id of ['s1', 's2', 's3', 's4']) p.press(tick(id, true));
    assert.ok(Number(selbarCount(p)) <= 3, selbarCount(p));
});

test('cmp: a third tick drops the oldest (two stay: s2 and s3)', () => {
    const p = withLb('#/list', { sessions: 3 });
    p.press(tick('s1', true));
    p.press(tick('s2', true));
    p.press(tick('s3', true));
    assert.equal(ticks(p), 's2,s3');
});

test('cmp: a tick writes the selection bar once', () => {
    const p = withLb('#/list', { sessions: 3 });
    p.reset();
    p.press(tick('s1', true));
    assert.equal(p.writes.selbar, 1);
});

test('cmp: on a project page a tick redraws the page once', () => {
    const p = withLb('#/p/' + encodeURIComponent(PK), { sessions: 3 });
    p.reset();
    p.press(tick('s1', true));
    assert.equal(p.writes.page, 1);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: cmp: on a project page a tick does not run the in-place redraws', () => {
    const p = withLb('#/p/' + encodeURIComponent(PK), { sessions: 3 });
    p.reset();
    p.press(tick('s1', true));
    assert.equal(p.writes.lb + p.writes.selbar, 0);
});

test('cmp: a tick returns before the later branches (a [data-wf] answer does not redraw the page)', () => {
    const p = withLb('#/list', { sessions: 3 });
    p.reset();
    p.press(Object.assign(tick('s1', true), { '[data-wf]': wfProbe() }));
    assert.equal(p.writes.page, 0);
});

// ---- tr[data-id] -------------------------------------------------------------------------------
const rowsFor = (ids, sel) => ids.map((id) => node({ 'data-id': id, 'aria-selected': 'x' }));
function trPress(hash, id) {
    const p = boot(hash, { sessions: 3 });
    const rows = rowsFor(['s1', 's2', 's3']);
    p.qsa = (sel) => (sel === '#lb tr' ? rows : []);
    p.press({ 'tr[data-id]': node({ 'data-id': id }) });
    return { p, rows };
}

test('tr: a press on a row marks it aria-selected true', () => {
    const { rows } = trPress('#/list', 's2');
    assert.equal(rows[1].attrs['aria-selected'], 'true');
});

test('tr: a press on the row already selected still writes its mark', () => {
    const { rows } = trPress('#/list', 's1');
    assert.equal(rows[0].attrs['aria-selected'], 'true');
});

test('tr: the rows marked are those of #lb', () => {
    const { p } = trPress('#/list', 's2');
    assert.ok(p.asked.includes('#lb tr'), p.asked.join(' | '));
});

test('tr: the other rows are marked aria-selected false', () => {
    const { rows } = trPress('#/list', 's2');
    assert.deepEqual([rows[0], rows[2]].map((r) => r.attrs['aria-selected']), ['false', 'false']);
});

test('tr: the detail pane shows the pressed session', () => {
    const { p } = trPress('#/list', 's3');
    assert.match(p.els.det.innerHTML, /t-s3/);
    assert.doesNotMatch(p.els.det.innerHTML, /t-s2/);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: tr: the press does not redraw the whole page', () => {
    const p = boot('#/list', { sessions: 3 });
    p.reset();
    p.qsa = () => [];
    p.press({ 'tr[data-id]': node({ 'data-id': 's2' }) });
    assert.equal(p.writes.page, 0);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: tr: off the list page a press selects no row', () => {
    const { p, rows } = trPress('#/', 's2');
    assert.equal(rows[1].attrs['aria-selected'], 'x');
    assert.equal(p.asked.includes('#lb tr'), false);
});

// ---- the wizard's [data-h], [data-st], [data-ask] ------------------------------------------------
// Each is pressed through the combined selector the listener asks for, on the settings page.
const WZ = '.wz [data-go], .wz [data-h], .wz [data-st], .wz [data-k], .wz [data-ask], .wz [data-scope]';
const wz = (p, dataset) => p.press({ [WZ]: { dataset } });

test('wz: a [data-go] press moves the wizard to that step', () => {
    const p = boot('#/settings');
    wz(p, { go: '3' });
    assert.match(p.html(), /data-step="agents"/);
});

test('wz: a [data-go] press redraws the page once', () => {
    const p = boot('#/settings');
    p.reset();
    wz(p, { go: '3' });
    assert.equal(p.writes.page, 1);
});

test('wz: the wizard branch returns before the later branches (a [data-wf] answer does not redraw a second time)', () => {
    const p = boot('#/settings');
    p.reset();
    p.press({ [WZ]: { dataset: { go: '3' } }, '[data-wf]': wfProbe() });
    assert.equal(p.writes.page, 1);
});

// guard, not a hit for the selector table: it passes if the branch is deleted.
test('guard: wz: off the settings page the wizard selector is not read', () => {
    const p = boot('#/');
    p.reset();
    p.press({ [WZ]: { dataset: { go: '3' } } });
    assert.equal(p.writes.page, 0);
});

const cardOn = (html, j) => new RegExp('data-h="' + j + '" aria-pressed="true"').test(html);

test('wz: a [data-h] press picks that habit card (pressed on card 1, no longer on the preset card 3)', () => {
    const p = boot('#/settings');
    assert.equal(cardOn(p.html(), 3), true, 'card 3 (all unset) is the starting pick');
    wz(p, { h: '1' });
    assert.equal(cardOn(p.html(), 1), true);
    assert.equal(cardOn(p.html(), 3), false);
});

test('wz: a [data-h] press writes the card values into the wizard (the summary has pr pressed for land.integration)', () => {
    const p = boot('#/settings');
    wz(p, { h: '1' });
    wz(p, { go: '8' });
    assert.match(p.html(), /data-k="land\.integration" data-o="pr" aria-pressed="true"/);
});

test('wz: a [data-st] press turns that station on (build pressed, survey not)', () => {
    const p = boot('#/settings');
    wz(p, { go: '3' });
    wz(p, { k: 'stage.agents', st: 'build' });
    assert.match(p.html(), /data-st="build" aria-pressed="true"/);
    assert.match(p.html(), /data-st="survey" aria-pressed="false"/);
});

test('wz: a second [data-st] press on the same station turns it off again', () => {
    const p = boot('#/settings');
    wz(p, { go: '3' });
    wz(p, { k: 'stage.agents', st: 'build' });
    wz(p, { k: 'stage.agents', st: 'build' });
    assert.match(p.html(), /data-st="build" aria-pressed="false"/);
});

test('wz: a [data-st] press on a station already on writes the shorter list (survey,build,verify then build leaves build unpressed)', () => {
    const p = boot('#/settings');
    wz(p, { go: '3' });
    wz(p, { h: '2' });
    assert.match(p.html(), /data-st="build" aria-pressed="true"/);
    wz(p, { k: 'stage.agents', st: 'build' });
    assert.match(p.html(), /data-st="build" aria-pressed="false"/);
    assert.match(p.html(), /data-st="verify" aria-pressed="true"/);
});

test('wz: an [data-ask] press unsets that key (deny no longer pressed, the rail value reads (ask))', () => {
    const p = boot('#/settings');
    wz(p, { k: 'guard', o: 'deny' });
    wz(p, { go: '4' });
    assert.match(p.html(), /data-k="guard" data-o="deny" aria-pressed="true"/);
    wz(p, { ask: 'guard' });
    assert.match(p.html(), /data-k="guard" data-o="deny" aria-pressed="false"/);
    assert.match(p.html(), /撞檔<\/span><span class="rv">\(ask\)<\/span>/);
});
