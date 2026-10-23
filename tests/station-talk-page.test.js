'use strict';
// The session page's 對話 tab, wired: `#/s/<id>/talk` is a tab of its own, its
// first visit fetches the first page from `station/talk/<id>?from=0`, the
// button fetches the next from where the held turns end, a redraw is drawn
// from what is held and fetches nothing, and a transcript the server does not
// have, or a page with no server at all, says so. station.js is booted as the
// browser runs it, with a fetch that answers from a list of turns.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { SRC } = require('./station-src.js');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';
const at = (m) => new Date(2026, 9, 1, 10, m).toISOString();
const ALL = [
    { kind: 'user', at: at(1), text: '第一個問題' },
    { kind: 'claude', at: at(2), text: '第一個回答' },
    { kind: 'compact', at: at(3), text: '', trigger: 'manual', preTokens: 349064 },
    { kind: 'summary', at: at(3), text: 'Summary: 前情' },
];
const pageAt = (from, size) => ({ total: ALL.length, from, counts: { compact: 1, user: 1, claude: 1 }, skipped: { tool: 2 }, turns: ALL.slice(from, from + size) });

// station.js booted on `hash`. `answer(url)` is what fetch gives back: a status
// and a body, or a rejection. p.fetched lists every url asked for.
function boot(hash, serve, answer) {
    const winL = {}, docL = {}, els = {}, fetched = [];
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    els.page = el('div');
    const win = { location: { hash }, addEventListener(type, fn) { (winL[type] = winL[type] || []).push(fn); }, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve, nonce: 'N0NCE',
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [{ id: 's1', pkey: PK, root: PK, task: 't-s1', state: 'live', route: ['survey', 'build'], stage: 'build',
                stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [] }] } };
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (docL[type] = docL[type] || []).push(fn); }, createElement: el,
        querySelectorAll: () => [], querySelector: () => null };
    const fetch = (url) => { fetched.push(url); return answer(url); };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch, module: { exports: {} } });
    const p = { win, els, fetched };
    p.html = () => els.page.innerHTML;
    p.click = (id) => {
        const fns = (docL.click || []).filter((f) => String(f).includes("'[data-talk]'"));
        assert.equal(fns.length, 1, 'one click listener holds [data-talk]');
        fns[0]({ target: { closest: (sel) => (sel === '[data-talk]' ? { getAttribute: () => id } : null) } });
    };
    p.redraw = () => winL.hashchange.filter((f) => !f.toString().includes('function qClose')).forEach((f) => f());
    return p;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
const ok = (url) => {
    const from = Number(/from=(\d+)/.exec(url)[1]);
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(pageAt(from, 3)) });
};

test('the button fetches from where the held turns end, and goes once all are in', async () => {
    const p = boot('#/s/s1/talk', true, ok);
    await flush();
    p.click('s1');
    assert.match(p.html(), /<span>讀取中…<\/span>/, 'the press redraws at once');
    await flush();
    assert.deepEqual(p.fetched, ['station/talk/s1?from=0', 'station/talk/s1?from=3']);
    const html = p.html();
    assert.doesNotMatch(html, /<button type="button" class="ctl" data-talk/);
    assert.match(html, /第一個回答/, 'the first page is still there');
});

test('a redraw is drawn from the held turns and fetches nothing', async () => {
    const p = boot('#/s/s1/talk', true, ok);
    await flush();
    p.redraw();
    assert.deepEqual(p.fetched, ['station/talk/s1?from=0']);
    assert.match(p.html(), /第一個問題/);
});

test('the other tabs fetch nothing', () => {
    for (const tab of ['', '/events', '/dispatch']) {
        const p = boot('#/s/s1' + tab, true, ok);
        assert.deepEqual(p.fetched, [], tab || 'overview');
    }
});

test('a 404 says the transcript is not on this machine, a failure offers a retry, and a retry fetches again', async () => {
    const gone = boot('#/s/s1/talk', true, () => Promise.resolve({ ok: false, status: 404 }));
    await flush();
    assert.match(gone.html(), /這台機器上已經沒有這個 session 的 transcript/);
    assert.doesNotMatch(gone.html(), /對話<small>/);
    let down = true;
    const p = boot('#/s/s1/talk', true, (url) => (down ? Promise.reject(new Error('down')) : ok(url)));
    await flush();
    assert.match(p.html(), /讀不到對話<\/span><button type="button" class="ctl" data-talk="s1">重試<\/button>/);
    down = false;
    p.click('s1');
    await flush();
    assert.deepEqual(p.fetched, ['station/talk/s1?from=0', 'station/talk/s1?from=0']);
    assert.match(p.html(), /第一個問題/);
});

test('a page written to a file has no server to ask: it says so and fetches nothing', async () => {
    const p = boot('#/s/s1/talk', false, ok);
    await flush();
    assert.deepEqual(p.fetched, []);
    assert.match(p.html(), /要從 serve 開的頁面才讀得到對話/);
});
