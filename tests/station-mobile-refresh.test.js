'use strict';
// Task 4 of docs/90-agent/plans/2026-10-29-mobile-sources.md, refreshing in place: the /m list read
// again every 5 s writes only what changed — a row, the header's counts, the tab bar's badge — and a
// row that did not change keeps its DOM node, so the list's scroll and an opened row stay where they
// were. The document here keeps .ha-body's rows as nodes: a row stays the same object until written.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.js'), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 30));
const reply = (body) => Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('') });

// Just past the </div> closing the <div> whose open tag ends at `from`.
function closeAt(h, from) {
    const re = /<(\/?)div\b/g;
    re.lastIndex = from;
    let depth = 1, x;
    while ((x = re.exec(h))) { depth += x[1] ? -1 : 1; if (!depth) return x.index + 6; }
    throw new Error('unclosed div');
}

function bodyNode() {
    const body = { scrollTop: 0, items: [] };
    function node(key, html, slot) {
        const n = { key, html, slot };
        n.getAttribute = (a) => (a === (slot ? 'data-slot' : 'data-row') ? key : null);
        Object.defineProperty(n, 'outerHTML', { get: () => n.html, set: (v) => { body.items.splice(body.items.indexOf(n), 1, ...parse(v)); } });
        n.replaceWith = (o) => { body.items.splice(body.items.indexOf(n), 1, o); };
        return n;
    }
    function parse(h) {
        const out = [];
        const re = /<div [^>]*data-row="([^"]*)"[^>]*>|<i data-slot="([^"]*)"><\/i>/g;
        let at = 0, m;
        while ((m = re.exec(h))) {
            out.push(h.slice(at, m.index));
            if (m[2] !== undefined) { out.push(node(m[2], m[0], true)); at = re.lastIndex; continue; }
            const end = closeAt(h, re.lastIndex);
            out.push(node(m[1], h.slice(m.index, end), false));
            at = end;
            re.lastIndex = end;
        }
        out.push(h.slice(at));
        return out;
    }
    const nodes = (slot) => body.items.filter((x) => typeof x === 'object' && x.slot === slot);
    Object.defineProperty(body, 'innerHTML', { get: () => body.items.map((x) => (typeof x === 'string' ? x : x.html)).join(''), set: (v) => { body.items = parse(v); body.scrollTop = 0; } });
    // A browser clamps scrollTop to the content's height: the rows written as empty slots lay out at
    // no height, so writing the list's innerHTML can drop the scroll to 0 — the fake always does.
    body.querySelectorAll = (sel) => (sel === '[data-row]' ? nodes(false) : sel === '[data-slot]' ? nodes(true) : []);
    body.querySelector = (sel) => { const m = /^\[data-row="([^"]*)"\]$/.exec(sel); return m ? nodes(false).find((x) => x.key === m[1]) || null : null; };
    return body;
}

// The page as three parts the refresh may write — header, .ha-body, tab bar — and a count of whole redraws.
function boot(hash, state) {
    const on = {};
    const page = { head: null, body: null, tabs: null, draws: 0 };
    const part = (html) => { const p = { html }; Object.defineProperty(p, 'outerHTML', { get: () => p.html, set: (v) => { p.html = v; } }); return p; };
    const app = {
        get innerHTML() { return ''; },
        set innerHTML(v) {
            page.draws++;
            const hd = /<header class="ab[^"]*">[\s\S]*?<\/header>/.exec(v);
            const tb = /<nav class="tabbar"[\s\S]*?<\/nav>/.exec(v);
            const bo = /<div class="ha-body"[^>]*>/.exec(v);
            page.head = hd ? part(hd[0]) : null;
            page.tabs = tb ? part(tb[0]) : null;
            page.body = null;
            if (bo) {
                const from = bo.index + bo[0].length;
                page.body = bodyNode();
                page.body.innerHTML = v.slice(from, closeAt(v, from) - 6);
            }
        },
    };
    const pick = { '.ha-body': () => page.body, 'header.ab': () => page.head, '.tabbar': () => page.tabs };
    const doc = {
        getElementById: (id) => (id === 'app' ? app : null), documentElement: {}, body: { insertAdjacentHTML() {} }, visibilityState: 'visible',
        addEventListener: (type, fn) => { (on[type] = on[type] || []).push(fn); },
        querySelector: (s) => (pick[s] ? pick[s]() : null),
    };
    const win = {
        document: doc, location: { hash }, navigator: { language: 'zh-TW', userAgent: 'Mozilla/5.0 (Linux; Android 10; K) Chrome/141.0 Mobile Safari/537.36' },
        localStorage: { getItem: () => null, setItem() {} }, addEventListener() {}, setInterval() {}, setTimeout, URLSearchParams,
        fetch: (url) => reply(url === '/station/mobile.json' ? state.home : null),
    };
    vm.runInNewContext(SRC, { window: win });
    // mobile.json read again, as the 5 s poll does.
    const poll = () => { (on.visibilitychange || []).forEach((fn) => fn({})); return settle(); };
    return { page, poll };
}

const NOW = Date.now();
const task = (id, o) => Object.assign({ id, root: '/r', task: 'task ' + id, project: 'proj', stage: 'build', route: [], gate: false, updated: NOW - 60e3, state: 'running', attached: false, background: [], last: null, holdUntil: null, machine: 'office' }, o);
const M = { host: 'office', at: NOW, device: null, gates: [], stopped: [], done: [], others: [], tasks: [task('t1'), task('t2')], unregistered: [], rc: { live: [], ended: [] } };

test('a row that changed is written again; the one that did not keeps its node, and the list keeps its scroll', async () => {
    const state = { home: M };
    const b = boot('#/', state);
    await settle();
    const body = b.page.body;
    const t1 = body.querySelector('[data-row="office/t1"]');
    const t2 = body.querySelector('[data-row="office/t2"]');
    assert.ok(t1 && t2, 'each card carries data-row');
    body.scrollTop = 420;
    const draws = b.page.draws;
    state.home = Object.assign({}, M, { tasks: [task('t1'), task('t2', { task: 'task t2 renamed' })] });
    await b.poll();
    assert.equal(b.page.draws, draws, 'no whole redraw');
    assert.equal(b.page.body, body, 'the scrolling list is the same element');
    assert.equal(body.scrollTop, 420);
    assert.equal(body.querySelector('[data-row="office/t1"]'), t1, 'the unchanged row is the same node');
    assert.notEqual(body.querySelector('[data-row="office/t2"]'), t2);
    assert.match(body.querySelector('[data-row="office/t2"]').html, /task t2 renamed/);
});

test('a session moving to 等你 rewrites the counts and the badge; the other row keeps its node and the list its scroll', async () => {
    const state = { home: M };
    const b = boot('#/', state);
    await settle();
    const body = b.page.body;
    const t1 = body.querySelector('[data-row="office/t1"]');
    body.scrollTop = 300;
    const draws = b.page.draws;
    assert.doesNotMatch(b.page.tabs.html, /tab-n/);
    state.home = Object.assign({}, M, { tasks: [task('t1'), task('t2', { state: 'gate' })] });
    await b.poll();
    assert.equal(b.page.draws, draws, 'no whole redraw');
    assert.match(b.page.tabs.html, /<b class="tab-n"[^>]*>1<\/b>/);
    assert.equal(body.querySelector('[data-row="office/t1"]'), t1);
    assert.equal(body.scrollTop, 300);
});

test('the same data read again writes nothing', async () => {
    const state = { home: M };
    const b = boot('#/', state);
    await settle();
    const before = b.page.body.querySelectorAll('[data-row]');
    const draws = b.page.draws;
    await b.poll();
    assert.equal(b.page.draws, draws);
    assert.deepEqual(b.page.body.querySelectorAll('[data-row]'), before);
});

test('a refresh that adds a row writes the list again and puts its scroll back', async () => {
    const state = { home: M };
    const b = boot('#/', state);
    await settle();
    const body = b.page.body;
    const t1 = body.querySelector('[data-row="office/t1"]');
    body.scrollTop = 250;
    const draws = b.page.draws;
    state.home = Object.assign({}, M, { tasks: [task('t1'), task('t2'), task('t3')] });
    await b.poll();
    assert.equal(b.page.draws, draws, 'no whole redraw');
    assert.ok(body.querySelector('[data-row="office/t3"]'), 'the new row is in the list');
    assert.equal(body.querySelector('[data-row="office/t1"]'), t1, 'the unchanged row is the same node');
    assert.equal(body.scrollTop, 250);
});

test('two refreshes in a row compare with the last one: a row unchanged since it keeps its node', async () => {
    const state = { home: Object.assign({}, M, { tasks: [task('t1'), task('t2'), task('t3')] }) };
    const b = boot('#/', state);
    await settle();
    const body = b.page.body;
    const row = (k) => body.querySelector('[data-row="office/' + k + '"]');
    const t1 = row('t1'), t3 = row('t3');
    state.home = Object.assign({}, M, { tasks: [task('t1'), task('t2', { task: 'task t2 renamed' }), task('t3')] });
    await b.poll();
    const t2 = row('t2');
    assert.match(t2.html, /task t2 renamed/);
    state.home = Object.assign({}, M, { tasks: [task('t1', { task: 'task t1 renamed' }), task('t2', { task: 'task t2 renamed' }), task('t3')] });
    await b.poll();
    assert.equal(row('t2'), t2, 'unchanged since the first refresh: same node');
    assert.equal(row('t3'), t3, 'unchanged across both refreshes: same node');
    assert.notEqual(row('t1'), t1);
    assert.match(row('t1').html, /task t1 renamed/);
});
