'use strict';
// station-52: 清單's shared state — the selected row, the sort, the 比較 ticks
// and which station/detail/<id>.js scripts were asked for — as its own
// module, assets/station/list-state.js (FK_LIST).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ASSETS, 'list-state.js'), 'utf8');

function load(win, doc) {
    vm.runInNewContext(SRC, { window: win, document: doc, module: { exports: {} } });
    return win.FK_LIST;
}
function fakeDoc() {
    const added = [], scripts = [];
    return { added, scripts, addEventListener(t) { added.push(t); }, createElement: () => ({}), head: { appendChild(el) { scripts.push(el); } } };
}

test('list-state.js sets FK_LIST on updated, newest first, nothing picked, and adds no listener at load', () => {
    const doc = fakeDoc();
    const L = load({}, doc);
    assert.deepEqual(doc.added, []);
    assert.equal(L.sel, null);
    assert.equal(L.sortKey, 'updated');
    assert.equal(L.sortDir, -1);
    assert.deepEqual([...L.picked], []);
});

test('sortBy flips the same column; a new one starts ascending for task, descending otherwise', () => {
    const L = load({}, fakeDoc());
    L.sortBy('updated');
    assert.equal(L.sortDir, 1);
    L.sortBy('task');
    assert.deepEqual([L.sortKey, L.sortDir], ['task', 1]);
    L.sortBy('cost');
    assert.deepEqual([L.sortKey, L.sortDir], ['cost', -1]);
});

test('tick keeps the two newest ticks, oldest first, and an untick drops one', () => {
    const L = load({}, fakeDoc());
    L.tick('a', true);
    L.tick('b', true);
    L.tick('c', true);
    assert.deepEqual([...L.picked], ['b', 'c']);
    L.tick('b', false);
    assert.deepEqual([...L.picked], ['c']);
});

test('need loads station/detail/<id>.js once, shares window.STATION_DETAIL, and records how it ended', () => {
    const win = { STATION_DETAIL: { have: { requests: 1 } } };
    const doc = fakeDoc();
    const L = load(win, doc);
    assert.equal(L.details, win.STATION_DETAIL);
    let redraws = 0;
    L.need({ id: 'have', hasDetail: true }, () => redraws++);
    L.need({ id: 'none', hasDetail: false }, () => redraws++);
    assert.equal(doc.scripts.length, 0);
    L.need({ id: 'a b', hasDetail: true }, () => redraws++);
    L.need({ id: 'a b', hasDetail: true }, () => redraws++);
    assert.equal(doc.scripts.length, 1);
    assert.equal(doc.scripts[0].src, 'station/detail/a%20b.js');
    assert.equal(L.status('a b'), 'loading');
    doc.scripts[0].onerror();
    assert.equal(L.status('a b'), 'failed');
    assert.equal(redraws, 1);
    assert.equal(L.status('never'), null);
});

const { SRC: PAGE } = require('./station-src.js');

// tests/station-claims-keep.test.js's boot(): every script index.html loads, in order, on a stub document.
function boot(sessions) {
    const els = {}, heads = [];
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, hidden: false, addEventListener() {}, setAttribute() {}, getAttribute() { return null; }, hasAttribute() { return false; }, removeAttribute() {}, appendChild() {}, querySelectorAll: () => [] });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', head: { appendChild(x) { heads.push(x); } },
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null };
    const win = { location: { hash: '#/list' }, addEventListener() {}, scrollTo() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, STATION_DETAIL: {},
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\ws\a', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions } };
    const ctx = vm.createContext({ window: win, document: doc, URLSearchParams, fetch() { return Promise.resolve({ ok: true, text: () => Promise.resolve('') }); }, module: { exports: {} } });
    vm.runInContext(PAGE, ctx);
    return { els, win, heads, x: ctx.module.exports };
}
const SES = { id: 'a', root: 'F:\ws\a', project: null, pkey: 'F:\ws\a', task: 'b task', stage: 'build', route: ['build'], state: 'live',
    started: new Date().toISOString(), updated: Date.now() - 60000, usd: 0, agentUsd: 0, estimated: [], unpriced: [], hasDetail: false,
    stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, days: [], spans: [] };
const drawList = (p) => { try { p.x.drawList(); } catch (e) { /* the detail panel is drawn after the list */ } };

test('清單 sorts by FK_LIST, selects through FK_LIST.sel, and loads a detail through FK_LIST.need', () => {
    const a = { ...SES, id: 'a', task: 'b task' };
    const b = { ...SES, id: 'b', task: 'a task', updated: Date.now() - 120000, hasDetail: true };
    const p = boot([a, b]);
    // The boot's own draw already selected the newest row; clear it so the sorted list picks its first.
    p.win.FK_LIST.sel = null;
    p.win.FK_LIST.sortBy('task');
    drawList(p);
    const lb = p.els.lb.innerHTML;
    assert.ok(lb.indexOf('data-id="b"') < lb.indexOf('data-id="a"'), 'sorted by task, ascending');
    assert.equal(p.win.FK_LIST.sel, 'b');
    assert.equal(p.win.FK_LIST.status('b'), 'loading');
    assert.equal(p.heads.filter((h) => h.src === 'station/detail/b.js').length, 1);
});

test('station.js keeps none of 清單\'s state itself', () => {
    const src = fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8');
    for (const gone of ['sel = null, sortKey', 'var picked = []', 'var asked = {}', "el.src = 'station/detail/'"]) assert.ok(!src.includes(gone), gone);
    assert.match(src, /var LS = w\.FK_LIST;/);
    assert.match(src, /var DETAIL = LS\.details;/);
});
