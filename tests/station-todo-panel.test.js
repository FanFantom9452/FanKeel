'use strict';
// The project page's TODO panel (mockup blocks todo-head, todo-open,
// todo-done): counts off the data file, a done entry's session linked where
// this machine has it and its sha shown where it does not.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');

const ROW = { pkey: 'F:\\ws', mode: 'folder', folder: 'docs/todo', open: [
    { id: 'a-1', label: 'a', title: 'Ready one', description: 'do `x`', state: 'ready', condition: '', stamp: '' },
    { id: 'b-1', label: 'b', title: 'Blocked one', description: 'wait', state: 'blocked', condition: 'after: y', stamp: '2026-09-20' },
    { id: 'b-2', label: 'b', title: 'Blocked two', description: 'wait more', state: 'blocked', condition: 'after: y', stamp: '2026-09-20' },
], done: [
    { id: 'c-1', label: 'c', title: 'Here', at: '2026-09-29', sha: 'abcdef1234', disposition: 'done', session: 'ssss1111-0000' },
    { id: 'c-2', label: '', title: 'Elsewhere', at: '2026-09-28', sha: '1234567abc', disposition: 'abandoned', session: 'gone0000-0000' },
] };

test('the panel counts open and done entries and carries the three mockup blocks', () => {
    const html = V.todoPanelHtml(ROW, [{ id: 'ssss1111-0000' }]);
    for (const b of ['todo-head', 'todo-open', 'todo-done']) assert.match(html, new RegExp('data-block="' + b + '"'));
    assert.match(html, /未完成 3/);
    assert.match(html, /已完成 2/);
    assert.equal((html.match(/<li class="td-row">/g) || []).length, 5);
    assert.match(html, /<code>x<\/code>/);
    assert.match(html, /class="td-tm rep"/, 'a second entry under the same timing is muted');
    assert.match(html, /href="#\/s\/ssss1111-0000"/);
    assert.match(html, /sha 1234567/);
    assert.doesNotMatch(html, /#\/s\/gone0000/);
});

test('a TODO.md-mode project shows its open entries only, and nothing makes no panel', () => {
    const html = V.todoPanelHtml({ pkey: 'p', mode: 'file', folder: null, open: [ROW.open[0]], done: [] }, []);
    assert.match(html, /未完成 1/);
    assert.doesNotMatch(html, /已完成|data-block="todo-done"/);
    assert.match(html, /td-src[^>]*>TODO\.md</);
    assert.equal(V.todoPanelHtml({ pkey: 'p', mode: 'file', folder: null, open: [], done: [] }, []), '');
    assert.equal(V.todoPanelHtml(null, []), '');
});

const MANY = Array.from({ length: 12 }, (_, i) => ({
    id: 'd-' + i, label: 'd', title: 'Done ' + i, at: '2026-09-' + String(28 - i).padStart(2, '0'),
    sha: 'abcdef' + String(i).padStart(4, '0'), disposition: i === 1 ? 'abandoned' : 'done', session: '',
}));
const LONG = { pkey: 'F:\\ws', mode: 'folder', folder: 'docs/todo', open: [ROW.open[0]], done: MANY };
const doneOf = (html) => html.slice(html.indexOf('data-block="todo-done"'));

test('the done list shows its newest ten and a button for the rest', () => {
    const done = doneOf(V.todoPanelHtml(LONG, []));
    assert.equal((done.match(/<li class="td-row">/g) || []).length, 10);
    assert.match(done, /Done 9</);
    assert.doesNotMatch(done, /Done 10</);
    assert.match(done, /data-tdmore="1" aria-expanded="false" aria-controls="donel">/);
    assert.match(done, /展開全部（12）/);
    assert.match(done, /還有 2 筆，2026-09-18 到 2026-09-17/);
    assert.match(done, /12 筆，最新在上 · 顯示最新 10 筆/);
    assert.match(done, /<li class="td-row td-hd k-only" aria-hidden="true">/);
    assert.match(done, /data-dp="abandoned"/);
});

test('expanded, the list shows every entry with a cut before the eleventh, and a button back', () => {
    const done = doneOf(V.todoPanelHtml(LONG, [], true));
    assert.equal((done.match(/<li class="td-row">/g) || []).length, 11);
    assert.equal((done.match(/<li class="td-row td-fold">/g) || []).length, 1);
    assert.match(done, /<li class="td-cut k-only" aria-hidden="true"><span>第 11 筆起，展開後才出現<\/span><\/li><li class="td-row td-fold">/);
    assert.match(done, /Done 11</);
    assert.match(done, /data-tdmore="0" aria-expanded="true"/);
    assert.match(done, /收起，只留最新 10 筆/);
});

test('ten or fewer done entries carry no button, and each state group names its state', () => {
    const html = V.todoPanelHtml(ROW, []);
    assert.doesNotMatch(html, /data-tdmore/);
    assert.match(html, /<div class="rgh td-grp" data-st="ready"><b class="mono">Ready<\/b>/);
    assert.match(html, /<div class="rgh td-grp" data-st="blocked"><b class="mono">Blocked<\/b>/);
});

// station.js booted on the project page with its document's listeners kept,
// so a test can press 展開全部 / 收起 and read what the page drew.
function projectBoot() {
    const vm = require('node:vm');
    const fs = require('node:fs');
    const path = require('node:path');
    const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    const NOW = Date.parse('2026-10-01T12:00:00.000Z');
    const listeners = {};
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash: '#/p/' + encodeURIComponent(LONG.pkey), protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: LONG.pkey, gone: false, unreadable: 0, build: [], mapAt: null, docs: [], todos: [LONG] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [{ id: 'k1', pkey: LONG.pkey, root: LONG.pkey, task: 'one', state: 'live', route: ['survey', 'build'], stage: 'build', stages: [], backtracks: 0, updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [] }] } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const press = (v) => {
        const target = { closest: (sel) => (sel === '[data-tdmore]' ? { getAttribute: () => v } : null), getAttribute: () => null, hasAttribute: () => false };
        for (const fn of listeners.click || []) fn({ target, preventDefault() {}, stopPropagation() {} });
    };
    return { press, page: () => els.page.innerHTML };
}

test('pressing 展開全部 opens the whole done list and 收起 folds it back to ten rows', () => {
    const p = projectBoot();
    const rows = () => (doneOf(p.page()).match(/<li class="td-row[^"]*">/g) || []).filter((r) => !/td-hd/.test(r)).length;
    assert.match(p.page(), /data-block="todo-done"/, 'the project page drew the panel');
    assert.equal(rows(), 10);
    p.press('1');
    assert.equal(rows(), 12);
    assert.match(doneOf(p.page()), /data-tdmore="0"/);
    p.press('0');
    assert.equal(rows(), 10);
    assert.match(doneOf(p.page()), /data-tdmore="1"/);
});
