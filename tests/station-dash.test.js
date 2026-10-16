'use strict';
// The dashboard's TODO card (docs/90-agent/plans/2026-10-01-todo-sweep.md
// Task 5) and its in-grid edit mode (2026-10-16-station-dashboard Task 4).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
// The library's kinds (Task 5): off by default, so a stored key carries them off at its tail.
const REST = ['dash-clash', 'dash-byproj', 'dash-tokens7', 'dash-models', 'dash-gatewait', 'dash-landed', 'dash-blocked', 'dash-agents'];

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

test('the dashboard has no chooser and no head row; editing lives in the grid', () => {
    const V2 = page({});
    const html = V2.dashPage({ view: 'now' });
    assert.doesNotMatch(html, /data-block="dash-chooser"/);
    assert.doesNotMatch(html, /data-block="dash-head"/);
    assert.doesNotMatch(html, /class="kcap"/);
    assert.match(html, /<div class="dash kdash" data-block="dashboard">[\s\S]*id="dchtog"/);
});

test('every card kind has a builder and the default five are on', () => {
    const V2 = page({});
    const kinds = V2.dashKinds();
    for (const id of ['dash-live', 'waiting-card', 'dash-todo', 'dash-spend', 'dash-recent']) {
        assert.equal(typeof kinds[id].render, 'function', id);
        assert.equal(V2.dashOrder(null).find((c) => c.id === id).on, true, id);
    }
});

test('a hidden card is still stored as off in station.dash', () => {
    const kept = { 'station.dash': JSON.stringify({ order: ['dash-live', 'waiting-card', 'dash-todo', 'dash-spend', 'dash-recent'], off: ['dash-recent'] }) };
    assert.doesNotMatch(page(kept).dashPage({ view: 'now' }), /data-block="dash-recent"/);
});

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

test('dash-todo rows show entry titles and labels without markdown bold asterisks', () => {
    const list = { pkey: 'F:\\ws\\bold', mode: 'folder', folder: 'docs/todo', done: [], open: [e('x-1', '**Bold** title', 'ready', '**lab**')] };
    const html = V.dashTodo([{ todos: [list] }]);
    assert.match(html, /Bold title/);
    assert.doesNotMatch(html, /\*/);
});

test('no Ready anywhere says so', () => {
    assert.match(V.dashTodo([{ todos: [GAMMA] }]), /<div class="dbig">0<small>/);
    assert.match(V.dashTodo([]), /沒有 Ready 的條目/);
});

test('dashOrder keeps a stored order, drops unknown ids, appends missing ones, and reads bad JSON as the default', () => {
    const DEF = ['dash-live', 'waiting-card', 'dash-todo', 'dash-spend', 'dash-recent'];
    assert.deepEqual(V.dashOrder(null).map((c) => c.id), DEF.concat(REST));
    assert.ok(V.dashOrder(null).filter((c) => DEF.includes(c.id)).every((c) => c.on));
    assert.deepEqual(V.dashOrder('not json').map((c) => c.id), DEF.concat(REST));
    const got = V.dashOrder(JSON.stringify({ order: ['dash-todo', 'nope', 'dash-live', 'dash-todo'], off: ['dash-spend'] }));
    assert.deepEqual(got.map((c) => c.id), ['dash-todo', 'dash-live', 'waiting-card', 'dash-spend', 'dash-recent'].concat(REST));
    assert.deepEqual(got.filter((c) => !c.on).map((c) => c.id), ['dash-spend'].concat(REST));
});

test('dashPage draws the cards in the stored order, leaves a switched-off card out, and offers 編輯版面', () => {
    const X = page({ 'station.dash': JSON.stringify({ order: ['dash-todo', 'dash-recent'], off: ['dash-spend'] }) });
    const html = X.dashPage();
    assert.match(html, /id="dchtog"/);
    assert.doesNotMatch(html, /data-block="dash-edit"/, 'edit mode opens on a press');
    assert.doesNotMatch(html, /data-dhide=|data-dmv=/);
    assert.doesNotMatch(html, /data-block="dash-spend"/);
    const at = (k) => html.indexOf('data-block="' + k + '"');
    assert.ok(at('dash-recent') < at('dash-live'), 'the wide column keeps the stored order');
    assert.ok(at('dash-todo') < at('waiting-card'), 'and so does the narrow one');
    assert.match(html, /<div class="dbig">5<small>/, 'the TODO card reads S.projects');
});

test('the cards sit in two columns, and 編輯版面 is the narrow one\'s last slot', () => {
    const html = page({}).dashPage();
    assert.match(html, /<div class="dash kdash" data-block="dashboard"><div class="dcol" data-col="main">/);
    const side = html.slice(html.indexOf('data-col="side"'));
    assert.ok(side.includes('data-block="waiting-card"') && side.includes('data-block="dash-todo"'), 'the narrow column holds what waits');
    assert.ok(!side.includes('data-block="dash-live"') && !side.includes('data-block="dash-spend"'), 'and only that');
    assert.match(side, /<button type="button" class="btn dslot" id="dchtog" data-dchtog="1"[^>]*>[\s\S]*編輯版面[\s\S]*<\/button><\/div><\/div>$/);
});

test('dashOrder appends a kind the stored order lacks: on if it is a default card, off if not', () => {
    const kinds = page({}).dashKinds();
    assert.ok(Object.values(kinds).every((k) => typeof k.name === 'string' && typeof k.hint === 'string' && typeof k.side === 'boolean'));
    assert.deepEqual(Object.keys(kinds).filter((id) => kinds[id].side && kinds[id].def), ['waiting-card', 'dash-todo']);
    const got = page({}).dashOrder(JSON.stringify({ order: ['dash-recent'], off: [] }));
    assert.ok(got.filter((c) => kinds[c.id].def).every((c) => c.on), 'the default five come back on');
});

// station.js booted as page() does, but with the document's listeners kept,
// so a test can press the edit mode's buttons and read what the page then
// draws and what it stored.
function editor(kept) {
    const listeners = {};
    const els = {};
    let writes = 0, dialogOpen = false;
    const winListeners = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    // The page element counts its innerHTML writes: one write is one repaint.
    const mk = (id) => {
        const o = el();
        if (id !== 'page') return o;
        let html = '';
        Object.defineProperty(o, 'innerHTML', { get: () => html, set: (v) => { writes++; html = v; } });
        return o;
    };
    const doc = { hidden: false, documentElement: el(), title: '', getElementById: (id) => els[id] || (els[id] = mk(id)),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: (sel) => (sel === 'dialog[open]' && dialogOpen ? {} : null), head: { appendChild() {} } };
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); }, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-04', serve: false,
            projects: PROJECTS.map((p) => Object.assign({ gone: false, unreadable: 0, build: [], mapAt: null }, p)),
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const fire = (type, target, more) => { for (const fn of listeners[type] || []) fn(Object.assign({ target, preventDefault() {}, stopPropagation() {} }, more)); };
    // A pressed button: `closest` answers only for a selector that names one of its attributes.
    const press = (attrs) => fire('click', { getAttribute: (k) => (k in attrs ? attrs[k] : null), hasAttribute: (k) => k in attrs,
        closest(sel) { return Object.keys(attrs).some((k) => sel.includes('[' + k + ']')) ? this : null; } });
    // Something inside the card `id`, 100px tall from y 0: a key pressed on it, or a drag over it.
    const inCard = (id) => ({ closest: (sel) => (sel === '[data-dcard]' ? { getAttribute: () => id, getBoundingClientRect: () => ({ top: 0, height: 100 }), classList: { add() {}, remove() {} } }
        : sel.includes('dashboard') ? {} : null) });
    const key = (k, id, alt) => fire('keydown', inCard(id), { key: k, altKey: !!alt });
    const drag = (from, onto, y) => { fire('dragstart', inCard(from)); fire('drop', inCard(onto), { clientY: y }); };
    // A modal open over the page (the TODO quick look, the card library), and a move to another page.
    const modal = (v) => { dialogOpen = v; };
    const go = (hash) => { win.location.hash = hash; for (const fn of winListeners.hashchange || []) fn({}); };
    return { press, key, drag, fire, modal, go, page: () => els.page.innerHTML, draws: () => writes };
}
const DEF = ['dash-live', 'waiting-card', 'dash-todo', 'dash-spend', 'dash-recent'];
const dashKey = (order, off) => { const tail = REST.filter((id) => !order.includes(id)); return JSON.stringify({ order: order.concat(tail), off: off.concat(tail) }); };
const EDITING = /<div class="dash kdash editing" data-block="dashboard">/;

test('pressing 編輯版面 enters edit mode, and pressing it again, 完成 or Esc leaves it', () => {
    const c = editor({});
    assert.doesNotMatch(c.page(), EDITING);
    c.press({ 'data-dchtog': '1' });
    assert.match(c.page(), EDITING);
    assert.match(c.page(), /<div class="dedit" data-block="dash-edit"/);
    assert.doesNotMatch(c.page(), /id="dchtog"/, '編輯版面 gives way while editing');
    c.press({ 'data-dchtog': '1' });
    assert.doesNotMatch(c.page(), EDITING);
    c.press({ 'data-dchtog': '1' });
    c.press({ 'data-dchdone': '1' });
    assert.doesNotMatch(c.page(), EDITING);
    assert.doesNotMatch(c.page(), /data-block="dash-edit"/);
    c.press({ 'data-dchtog': '1' });
    c.key('Escape', 'dash-live');
    assert.doesNotMatch(c.page(), EDITING, 'Esc leaves it');
});

test('Esc with a dialog open closes the dialog, not edit mode', () => {
    const c = editor({});
    c.press({ 'data-dchtog': '1' });
    c.modal(true);
    c.key('Escape', 'dash-live');
    assert.match(c.page(), EDITING, 'the dialog takes Esc');
    c.modal(false);
    c.key('Escape', 'dash-live');
    assert.doesNotMatch(c.page(), EDITING);
});

test('leaving the dashboard ends edit mode, so coming back is not still editing', () => {
    const c = editor({});
    c.press({ 'data-dchtog': '1' });
    assert.match(c.page(), EDITING);
    c.go('#/sessions');
    c.go('#/');
    assert.doesNotMatch(c.page(), EDITING);
});

test('完成 and Esc while not editing draw nothing', () => {
    const c = editor({});
    const d = c.draws();
    c.press({ 'data-dchdone': '1' });
    c.key('Escape', 'dash-live');
    assert.equal(c.draws(), d);
    assert.doesNotMatch(c.page(), EDITING);
});

test('edit mode arms every card with a grip, ↑ ↓ and 隱藏, and offers 還原預設 only off the default', () => {
    const c = editor({});
    c.press({ 'data-dchtog': '1' });
    const html = c.page();
    for (const id of DEF) {
        assert.match(html, new RegExp('<section draggable="true" data-dcard="' + id + '" class="dcard"'), id);
        assert.match(html, new RegExp('data-dmv="-1" data-card="' + id + '"'), id);
        assert.match(html, new RegExp('data-dmv="1" data-card="' + id + '"'), id);
        assert.match(html, new RegExp('data-dhide="' + id + '"[^>]*aria-label="隱藏「'), id);
    }
    assert.equal(count(html, /class="dgrip"/g), 5);
    assert.match(html, /data-dchreset="1" data-key="dchreset" disabled/);
    assert.match(html, /<span class="dch-st" role="status">目前是預設<\/span>/);
    c.press({ 'data-dmv': '1', 'data-card': 'dash-live' });
    assert.doesNotMatch(c.page(), /data-dchreset="1" data-key="dchreset" disabled/);
    assert.match(c.page(), /已調整/);
});

test('↑ ↓ pass the next card in the card\'s own column, and moving it back stores no key', () => {
    const kept = {};
    const c = editor(kept);
    c.press({ 'data-dmv': '1', 'data-card': 'dash-live' });
    assert.equal(kept['station.dash'], dashKey(['dash-spend', 'waiting-card', 'dash-todo', 'dash-live', 'dash-recent'], []), 'dash-live passes dash-spend, not waiting-card');
    c.press({ 'data-dmv': '-1', 'data-card': 'dash-live' });
    assert.equal('station.dash' in kept, false, 'the default order is stored as no key');
    c.press({ 'data-dmv': '1', 'data-card': 'waiting-card' });
    assert.equal(kept['station.dash'], dashKey(['dash-live', 'dash-todo', 'waiting-card', 'dash-spend', 'dash-recent'], []));
    c.press({ 'data-dchreset': '1' });
    assert.equal('station.dash' in kept, false, '還原預設 clears it');
});

test('a move off either end of its column, or naming no card, repaints nothing and stores nothing', () => {
    const kept = {};
    const c = editor(kept);
    const d = c.draws();
    c.press({ 'data-dmv': '-1', 'data-card': 'dash-live' });
    c.press({ 'data-dmv': '1', 'data-card': 'dash-recent' });
    c.press({ 'data-dmv': '-1', 'data-card': 'waiting-card' });
    c.press({ 'data-dmv': '1', 'data-card': 'dash-todo' });
    c.press({ 'data-dmv': '1', 'data-card': 'nope' });
    c.press({ 'data-dmv': '2', 'data-card': 'dash-live' });
    assert.equal(c.draws(), d, 'no repaint');
    assert.equal('station.dash' in kept, false, 'no key');
});

test('Alt + ↓ on a card moves it as ↓ does; a bare ↓ does nothing', () => {
    const kept = {};
    const c = editor(kept);
    c.key('ArrowDown', 'dash-live', true);
    assert.equal('station.dash' in kept, false, 'not editing: nothing');
    c.press({ 'data-dchtog': '1' });
    c.key('ArrowDown', 'dash-live', false);
    assert.equal('station.dash' in kept, false, 'no Alt: nothing');
    c.key('ArrowDown', 'dash-live', true);
    assert.equal(kept['station.dash'], dashKey(['dash-spend', 'waiting-card', 'dash-todo', 'dash-live', 'dash-recent'], []));
    c.key('ArrowUp', 'dash-live', true);
    assert.equal('station.dash' in kept, false);
});

test('a dragged card dropped on the top half of another goes before it, on the bottom half after, and never across columns', () => {
    const kept = {};
    const c = editor(kept);
    c.press({ 'data-dchtog': '1' });
    c.drag('dash-recent', 'dash-live', 10);
    assert.equal(kept['station.dash'], dashKey(['dash-recent', 'dash-live', 'waiting-card', 'dash-todo', 'dash-spend'], []));
    c.drag('dash-recent', 'dash-spend', 90);
    assert.equal('station.dash' in kept, false, 'back to the default order: no key');
    const d = c.draws();
    c.drag('dash-live', 'waiting-card', 10);
    assert.equal(c.draws(), d, 'across columns: no repaint');
    assert.equal('station.dash' in kept, false, 'and no key');
});

test('隱藏 stores the card in off; outside edit mode the page leaves it out, inside it keeps its header marked 已隱藏', () => {
    const kept = {};
    const c = editor(kept);
    c.press({ 'data-dhide': 'dash-spend' });
    assert.equal(kept['station.dash'], dashKey(DEF, ['dash-spend']));
    assert.doesNotMatch(c.page(), /data-block="dash-spend"/);
    c.press({ 'data-dchtog': '1' });
    assert.match(c.page(), /<section draggable="true" data-dcard="dash-spend" class="dcard off"/);
    assert.match(c.page(), /<span class="doff">已隱藏<\/span>/);
    assert.match(c.page(), /data-dhide="dash-spend"[^>]*aria-label="顯示「/);
    for (const id of ['dash-live', 'waiting-card', 'dash-todo', 'dash-recent']) assert.match(c.page(), new RegExp('data-dcard="' + id + '" class="dcard"'), id);
    c.press({ 'data-dhide': 'dash-spend' });
    assert.equal('station.dash' in kept, false, '顯示 again: no key');
});

test('隱藏 reads the stored list: a card already off stays off, and a stale key is filled in whole', () => {
    const kept = { 'station.dash': JSON.stringify({ order: ['dash-recent', 'dash-spend'], off: ['dash-todo'] }) };
    editor(kept).press({ 'data-dhide': 'dash-spend' });
    assert.equal(kept['station.dash'], dashKey(['dash-recent', 'dash-spend', 'dash-live', 'waiting-card', 'dash-todo'], ['dash-spend', 'dash-todo']));
});

test('加入 puts an off card last and on; on a card already on, or an unknown one, it does nothing', () => {
    const kept = { 'station.dash': dashKey(DEF, ['dash-live']) };
    const c = editor(kept);
    const d = c.draws();
    c.press({ 'data-dadd': 'dash-spend' });
    c.press({ 'data-dadd': 'nope' });
    c.press({ 'data-dhide': 'nope' });
    assert.equal(c.draws(), d, 'no repaint');
    assert.equal(kept['station.dash'], dashKey(DEF, ['dash-live']), 'no store');
    c.press({ 'data-dadd': 'dash-live' });
    assert.equal(kept['station.dash'], JSON.stringify({ order: ['waiting-card', 'dash-todo', 'dash-spend', 'dash-recent'].concat(REST, ['dash-live']), off: REST }));
    assert.equal(c.draws(), d + 1, 'one repaint');
});

test('each press that changes something repaints exactly once', () => {
    const c = editor({});
    let d = c.draws();
    c.press({ 'data-dchtog': '1' });
    assert.equal(c.draws(), d + 1, '編輯版面');
    d = c.draws();
    c.press({ 'data-dmv': '1', 'data-card': 'dash-live' });
    assert.equal(c.draws(), d + 1, '↓');
    d = c.draws();
    c.press({ 'data-dhide': 'dash-todo' });
    assert.equal(c.draws(), d + 1, '隱藏');
    d = c.draws();
    c.press({ 'data-dchreset': '1' });
    assert.equal(c.draws(), d + 1, '還原預設');
    d = c.draws();
    c.press({ 'data-dchdone': '1' });
    assert.equal(c.draws(), d + 1, '完成');
});

test('a click on nothing the edit mode owns is ignored', () => {
    const c = editor({});
    const d = c.draws();
    assert.doesNotThrow(() => c.fire('click', { closest: () => null }));
    assert.equal(c.draws(), d);
});
