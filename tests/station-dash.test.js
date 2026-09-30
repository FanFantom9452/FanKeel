'use strict';
// The dashboard's TODO card and card chooser (mockup blocks dash-todo and
// dash-chooser, docs/90-agent/plans/2026-10-01-todo-sweep.md Task 5).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');

const e = (id, title, state, label) => ({ id, label: label || '', title, description: '', state, condition: '', stamp: '' });
const ALPHA = { pkey: 'F:\\ws\\alpha', mode: 'folder', folder: 'docs/todo', done: [], open: [
    e('a-1', 'A one', 'ready', 'a'), e('a-2', 'A two', 'ready', 'a'), e('a-3', 'A three', 'ready', 'a'), e('a-4', 'A four', 'ready', 'a'),
    e('a-5', 'A blocked', 'blocked', 'a'), e('a-6', 'A decide', 'decision', 'a')] };
const BETA = { pkey: 'F:\\ws\\beta', mode: 'folder', folder: 'docs/todo', done: [], open: [e('b-1', 'B one', 'ready', 'b'), e('b-2', 'B watch', 'watch', 'b')] };
const GAMMA = { pkey: 'F:\\ws\\gamma', mode: 'folder', folder: 'docs/todo', done: [], open: [e('g-1', 'G blocked', 'blocked', 'g')] };
const PLAIN = { pkey: 'F:\\ws\\plain', mode: 'file', folder: null, done: [], open: [{ id: 'p-1', label: '', title: 'P one', description: '' }] };
const PROJECTS = [{ root: 'F:\\ws\\alpha', todos: [ALPHA] }, { root: 'F:\\ws\\beta', todos: [BETA] }, { root: 'F:\\ws\\gamma', todos: [GAMMA, PLAIN] }];
const count = (s, re) => (s.match(re) || []).length;

// station.js booted with a document, so dashPage can read `S`, `view` and
// `localStorage` the way the page does.
function page(kept) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = {
        location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: {
            generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false,
            projects: PROJECTS.map((p) => Object.assign({ gone: false, unreadable: 0, build: [], mapAt: null }, p)),
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [],
        },
    };
    const box = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}

test('dash-todo counts every ready entry across the projects, one row per project with any, most first', () => {
    const html = V.dashTodo([PROJECTS[1], PROJECTS[0], PROJECTS[2]]);
    const ready = PROJECTS.reduce((n, p) => n + p.todos.reduce((m, t) => m + t.open.filter((x) => x.state === 'ready').length, 0), 0);
    assert.equal(ready, 5);
    assert.match(html, /data-block="dash-todo"/);
    assert.match(html, new RegExp('<div class="dbig">' + ready + '<small>筆 Ready，分在 2 個專案</small></div>'));
    assert.equal(count(html, /class="drow trow"/g), 2);
    assert.ok(html.indexOf('>alpha<') < html.indexOf('>beta<'), 'the project with more Ready comes first');
    assert.match(html, /href="#\/p\/F%3A%5Cws%5Calpha"/);
    assert.match(html, /<li class="tmore">還有 1 筆<\/li>/);
    assert.doesNotMatch(html, /A four/, 'three titles shown, the fourth counted');
    assert.match(html, /<span class="tq" data-st="decision">decision <b>1<\/b><\/span><span class="tq" data-st="blocked">blocked <b>1<\/b><\/span>/);
    assert.match(html, /gamma 沒有 Ready（blocked 1）；另有 1 份 TODO 沒標狀態，不列/);
});

test('the card and the project page agree on how many entries are Ready', () => {
    const dash = V.dashTodo([{ todos: [ALPHA] }]);
    const panel = V.todoPanelHtml(ALPHA, []);
    const onDash = Number(/<span class="tn">(\d+)<\/span>/.exec(dash)[1]);
    const onPanel = Number(/<b class="mono">Ready<\/b><span class="mute">(\d+) 筆/.exec(panel)[1]);
    assert.equal(onDash, 4);
    assert.equal(onDash, onPanel);
});

test('no Ready anywhere says so', () => {
    assert.match(V.dashTodo([{ todos: [GAMMA] }]), /<div class="dbig">0<small>/);
    assert.match(V.dashTodo([]), /沒有 Ready 的條目/);
});

test('dashOrder keeps a stored order, drops unknown ids, appends missing ones, and reads bad JSON as the default', () => {
    const DEF = ['dash-live', 'waiting-card', 'dash-todo', 'dash-spend', 'dash-recent'];
    assert.deepEqual(V.dashOrder(null).map((c) => c.id), DEF);
    assert.ok(V.dashOrder(null).every((c) => c.on));
    assert.deepEqual(V.dashOrder('not json').map((c) => c.id), DEF);
    const got = V.dashOrder(JSON.stringify({ order: ['dash-todo', 'nope', 'dash-live', 'dash-todo'], off: ['dash-spend'] }));
    assert.deepEqual(got.map((c) => c.id), ['dash-todo', 'dash-live', 'waiting-card', 'dash-spend', 'dash-recent']);
    assert.deepEqual(got.filter((c) => !c.on).map((c) => c.id), ['dash-spend']);
});

test('the chooser lists the five cards, disables the ends, and offers 還原預設 only off the default', () => {
    const def = V.dashChooserHtml(V.dashOrder(null));
    assert.match(def, /data-block="dash-chooser"/);
    assert.equal(count(def, /class="dch-row"/g), 5);
    assert.match(def, /data-dchmv="-1" data-card="dash-live"[^>]*disabled/);
    assert.match(def, /data-dchmv="1" data-card="dash-recent"[^>]*disabled/);
    assert.match(def, /data-dchreset="1" disabled/);
    assert.match(def, /目前是預設/);
    const moved = V.dashChooserHtml(V.dashOrder(JSON.stringify({ order: ['dash-todo'], off: ['dash-recent'] })));
    assert.doesNotMatch(moved, /data-dchreset="1" disabled/);
    assert.match(moved, /跟預設不同/);
    assert.match(moved, /<input type="checkbox" data-dchshow="dash-recent"/);
    assert.match(moved, /<input type="checkbox" checked data-dchshow="dash-todo"/);
});

test('dashPage draws the cards in the stored order, leaves a switched-off card out, and offers 調整卡片', () => {
    const X = page({ 'station.dash': JSON.stringify({ order: ['dash-todo', 'dash-recent'], off: ['dash-spend'] }) });
    const html = X.dashPage();
    assert.match(html, /id="dchtog"/);
    assert.doesNotMatch(html, /data-block="dash-chooser"/, 'the chooser opens on a press');
    assert.doesNotMatch(html, /data-block="dash-spend"/);
    const at = (k) => html.indexOf('data-block="' + k + '"');
    assert.ok(at('dash-todo') < at('dash-recent') && at('dash-recent') < at('dash-live') && at('dash-live') < at('waiting-card'), html);
    assert.match(html, /<div class="dbig">5<small>/, 'the TODO card reads S.projects');
});
