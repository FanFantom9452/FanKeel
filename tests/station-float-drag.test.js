'use strict';
// Resizing the gate panel (docs/90-agent/plans/2026-10-15-todo-patrol-gate-drive-design.md §1),
// driven through the page's own pointer listeners in a vm, the way
// tests/station-gate-send.test.js drives its click listener. Only the
// listeners this feature added are fired: the page has other pointerdown and
// resize listeners that a fake DOM would not survive. The panel is no longer
// dragged: it hangs under the bell in the masthead.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { SRC } = require('./station-src.js');
const NOW = Date.parse('2026-10-15T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';
const RECT = { left: 600, top: 300, width: 376, height: 400 };

function boot(saved) {
    const docL = {}, winL = {}, els = {}, kept = new Map(saved ? [['station.fkBox', saved]] : []);
    const el = () => ({ innerHTML: '', textContent: '', className: '', attrs: {}, style: {},
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {},
        getBoundingClientRect: () => RECT });
    const on = (map) => (type, fn) => { (map[type] = map[type] || []).push(fn); };
    const win = { location: { hash: '#/' }, addEventListener: on(winL), scrollTo() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        innerWidth: 1200, innerHeight: 800, navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); } },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: true, nonce: 'N0NCE',
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [] } };
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener: on(docL),
        createElement: el, querySelectorAll: () => [], querySelector: () => null };
    class FakeAbort { constructor() { this.signal = {}; } abort() {} }
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), AbortController: FakeAbort, module: { exports: {} } });
    const fire = (map, type, needle, e) => (map[type] || []).filter((fn) => String(fn).includes(needle)).forEach((fn) => fn(e));
    const at = (hits) => ({ closest: (sel) => (sel in hits ? hits[sel] : null) });
    return {
        win, kept, panel: () => doc.getElementById('fkp'),
        down: (hits, x, y, button = 0) => fire(docL, 'pointerdown', 'fkDrag', { button, target: at(hits), clientX: x, clientY: y, preventDefault() {} }),
        move: (x, y) => fire(winL, 'pointermove', 'fkDrag', { clientX: x, clientY: y }),
        up: () => fire(winL, 'pointerup', 'fkDrop', {}),
        cancel: () => fire(winL, 'pointercancel', 'fkDrop', {}),
        resize: () => fire(winL, 'resize', 'fkBox', {}),
    };
}

const GRIP = { '#fk [data-fk-resize]': {} };
const TITLE = { '#fk .fkh': {} };

test('dragging the corner grip resizes the panel', () => {
    const p = boot();
    p.down(GRIP, 976, 700);
    p.move(1026, 760);
    assert.equal(p.panel().style.width, '326px');
    assert.equal(p.panel().style.height, '460px');
});

test('the title bar is not a drag handle: a drag on it does not move or resize the panel', () => {
    const p = boot();
    p.down(TITLE, 700, 310);
    p.move(600, 260);
    assert.equal(p.panel().style.width, undefined);
    assert.equal(p.panel().style.left, undefined);
    assert.equal(p.kept.has('station.fkBox'), false);
});

test('a right-button press on the grip starts no resize', () => {
    const p = boot();
    p.down(GRIP, 976, 700, 2);
    p.move(1026, 760);
    assert.equal(p.panel().style.width, undefined);
});

test('a resize past the window edge stops at it', () => {
    const p = boot();
    p.down(GRIP, 976, 700);
    p.move(-1000, 2700);
    assert.equal(p.panel().style.width, '1136px');
    assert.equal(p.panel().style.height, '718px');
});

test('a saved size comes back on reload, pulled inside a smaller window', () => {
    const p = boot(JSON.stringify({ w: 1100, h: 700 }));
    p.win.innerWidth = 1000;
    p.win.innerHeight = 600;
    p.resize();
    assert.equal(p.panel().style.width, '936px');
    assert.equal(p.panel().style.height, '518px');
});

test('a saved place from before the bell moved is read as its size only', () => {
    const p = boot(JSON.stringify({ x: 900, y: 500, w: 376, h: 400 }));
    p.win.innerWidth = 1000;
    p.win.innerHeight = 700;
    p.resize();
    assert.equal(p.panel().style.left, undefined);
    assert.equal(p.panel().style.width, '376px');
    assert.equal(p.panel().style.height, '400px');
});

test('a cancelled resize still keeps the size the panel got to', () => {
    const p = boot();
    p.down(GRIP, 976, 700);
    p.move(1026, 760);
    p.cancel();
    assert.deepEqual(JSON.parse(p.kept.get('station.fkBox')), { w: 326, h: 460 });
});

test('a finished resize is kept', () => {
    const p = boot();
    p.down(GRIP, 976, 700);
    p.move(1026, 760);
    p.up();
    assert.deepEqual(JSON.parse(p.kept.get('station.fkBox')), { w: 326, h: 460 });
});
