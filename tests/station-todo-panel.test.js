'use strict';
// The #/p/<pkey>/todo/<id> scroll target: the entry or state group the hash names
// is scrolled into view once the page draws it, and any other hash goes to the top.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

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
