'use strict';
// The project page's TODO panel (mockup blocks todo-head, todo-open,
// todo-done): counts off the data file, a done entry's session linked where
// this machine has it and its sha shown where it does not.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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

const MANY = Array.from({ length: 12 }, (_, i) => ({
    id: 'd-' + i, label: 'd', title: 'Done ' + i, at: '2026-09-' + String(28 - i).padStart(2, '0'),
    sha: 'abcdef' + String(i).padStart(4, '0'), disposition: i === 1 ? 'abandoned' : 'done', session: '',
}));
const LONG = { pkey: 'F:\\ws', mode: 'folder', folder: 'docs/todo', open: [ROW.open[0]], done: MANY };
const doneOf = (html) => html.slice(html.indexOf('data-block="todo-done"'));

// station.js booted on the project page with its document's listeners kept,
// so a test can press 展開全部 / 收起 and read what the page drew.
function projectBoot(todo, hash) {
    todo = todo || LONG;
    const vm = require('node:vm');
    const fs = require('node:fs');
    const path = require('node:path');
    const { SRC } = require('./station-src.js');
    const NOW = Date.parse('2026-10-01T12:00:00.000Z');
    const listeners = {};
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash: hash || '#/p/' + encodeURIComponent(todo.pkey), protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: LONG.pkey, gone: false, unreadable: 0, build: [], mapAt: null, docs: [], todos: [todo] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [{ id: 'k1', pkey: LONG.pkey, root: LONG.pkey, task: 'one', state: 'live', route: ['survey', 'build'], stage: 'build', stages: [], backtracks: 0, updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [] }] } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const press = (v) => {
        const target = { closest: (sel) => (sel === '[data-tdmore]' ? { getAttribute: () => v } : null), getAttribute: () => null, hasAttribute: () => false };
        for (const fn of listeners.click || []) fn({ target, preventDefault() {}, stopPropagation() {} });
    };
    // A click or key on the TODO row `id`; `inLink` puts a link under the pointer.
    const fire = (type, id, key, inLink) => {
        const row = { getAttribute: (k) => (k === 'data-tdbody' ? id : null) };
        const target = { closest: (sel) => (sel === '[data-tdbody]' ? row : (sel === 'a,button' && inLink ? { tag: 'a' } : null)), getAttribute: () => null, hasAttribute: () => false };
        for (const fn of listeners[type] || []) fn({ type, key, target, preventDefault() {}, stopPropagation() {} });
    };
    return { press, fire, page: () => els.page.innerHTML };
}

const WITH_BODY = Object.assign({}, LONG, { open: [Object.assign({}, ROW.open[0], { body: 'why it is open' })] });
const bodyShown = (p) => (p.page().match(/data-block="todo-body"/g) || []).length;

// The page booted whole in a fresh vm context, the way tests/station-docs-tour.test.js
// boots it, on `hash`. Of the ids `todo` and `todo-<id>` only those in `present`
// are on the page; every element records being scrolled to, and the window its scrollTo.
// The elements are of the vm's realm, so what they record is compared as plain strings.
const { SRC } = require('./station-src.js');
function bootAt(hash, present) {
    const els = {};
    const scrolled = [];
    const tops = [];
    const on = {};
    const el = (id) => ({ id, innerHTML: '', textContent: '', className: '', title: '', hidden: false, style: {},
        setAttribute() {}, getAttribute() { return null; }, appendChild() {}, addEventListener() {},
        removeAttribute() {}, scrollIntoView(o) { scrolled.push([id, o && o.block]); } });
    const doc = {
        hidden: false,
        getElementById: (id) => (/^todo(-|$)/.test(id) && !present.includes(id) ? null : els[id] || (els[id] = el(id))),
        addEventListener() {}, createElement: () => el(''), querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }),
        head: { appendChild() {} },
    };
    const win = {
        location: { hash, protocol: 'file:' }, addEventListener: (type, fn) => { (on[type] = on[type] || []).push(fn); }, scrollTo: (x, y) => { tops.push([x, y]); },
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        STATION: {
            generatedAt: new Date(2026, 9, 17, 11, 0).toISOString(), configDir: 'C:\cfg', pricesVerified: '2026-09-04', serve: false,
            projects: [], profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [],
        },
    };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams });
    return { scrolled, tops, go: (to) => { win.location.hash = to; on.hashchange.forEach((fn) => fn()); } };
}
const P = '#/p/' + encodeURIComponent('F:\ws');

test('#/p/<pkey>/todo/<id> scrolls that entry into view once the page draws; one not on the page scrolls the panel', () => {
    const at = bootAt(P + '/todo/b-1', ['todo', 'todo-b-1']);
    assert.deepEqual(at.scrolled, [['todo-b-1', 'start']]);
    assert.deepEqual(bootAt(P + '/todo/gone-1', ['todo']).scrolled, [['todo', 'start']]);
    assert.deepEqual(bootAt(P + '/todo', ['todo', 'todo-b-1']).scrolled, [['todo', 'start']]);
    assert.deepEqual(bootAt(P, ['todo', 'todo-b-1']).scrolled, []);
    // No panel on the page yet: nothing is scrolled, and nothing throws.
    assert.deepEqual(bootAt(P + '/todo/b-1', []).scrolled, []);
});

test('#/p/<pkey>/todo/state%3A<state> scrolls that state\'s group into view; a state with no group scrolls the panel', () => {
    assert.deepEqual(bootAt(P + '/todo/state%3Aready', ['todo', 'todo-state:ready']).scrolled, [['todo-state:ready', 'start']]);
    assert.deepEqual(bootAt(P + '/todo/state%3Awatch', ['todo', 'todo-state:ready']).scrolled, [['todo', 'start']]);
});

test('arriving on a TODO hash scrolls to it and not back to the top; any other hash goes to the top', () => {
    const at = bootAt('#/', ['todo', 'todo-b-1']);
    at.go(P + '/todo/b-1');
    assert.deepEqual(at.scrolled, [['todo-b-1', 'start']]);
    assert.deepEqual(at.tops, []);
    at.go('#/sessions');
    assert.deepEqual(at.tops, [[0, 0]]);
    assert.equal(at.scrolled.length, 1);
});
