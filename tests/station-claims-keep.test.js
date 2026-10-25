'use strict';
// A height the user dragged on the detail's .claims list lives on the element's inline style, and the
// detail is repainted every few seconds. The dragged height must be on the new element after a repaint.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { SRC } = require('./station-src.js');

function boot(sessions) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, hidden: false, addEventListener() {}, setAttribute() {}, getAttribute() { return null; }, hasAttribute() { return false; }, removeAttribute() {}, appendChild() {} });
    // #det gives back one stub per class="claims" in the html last written, as the browser would give fresh elements.
    const det = el();
    let html = '';
    det.claims = [];
    Object.defineProperty(det, 'innerHTML', { get: () => html, set: (v) => {
        html = v;
        det.claims = [...v.matchAll(/class="claims"/g)].map(() => ({ style: {} }));
    } });
    det.querySelectorAll = (sel) => (sel === '.claims' ? det.claims : []);
    els.det = det;
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null };
    const win = { location: { hash: '#/list' }, addEventListener() {}, scrollTo() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, STATION_DETAIL: {},
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\ws\a', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions } };
    const ctx = vm.createContext({ window: win, document: doc, URLSearchParams, fetch() { return Promise.resolve({ ok: true, text: () => Promise.resolve('') }); }, module: { exports: {} } });
    vm.runInContext(SRC, ctx);
    return { det, x: ctx.module.exports };
}
const SES = { id: 'a', root: 'F:\ws\a', project: null, pkey: 'F:\ws\a', task: 'task a', stage: 'build', route: ['build'], state: 'live',
    started: new Date().toISOString(), updated: Date.now() - 60000, usd: 0, agentUsd: 0, estimated: [], unpriced: [], hasDetail: false,
    stages: [], notes: [], claims: ['a.js', 'b.js'], conflicts: [], burn: 0, backtracks: 0, days: [], spans: [] };
const draw = (p) => { try { p.x.drawList(); } catch (e) { /* the detail is drawn after the list */ } };

test('a dragged .claims height is on the new element after the detail repaints', () => {
    const p = boot([SES]);
    draw(p);
    assert.ok(p.det.claims.length >= 1, 'the detail draws a .claims list');
    p.det.claims[0].style.height = '120px';
    draw(p);
    assert.equal(p.det.claims[0].style.height, '120px');
});

test('a .claims list nobody dragged gets no inline height', () => {
    const p = boot([SES]);
    draw(p);
    draw(p);
    assert.equal(p.det.claims[0].style.height, undefined);
});

test('A dragged, switch to B → B has default height', () => {
    const a = { ...SES, id: 'a' }, b = { ...SES, id: 'b', task: 'task b', updated: Date.now() - 120000 };
    const list = [a, b];
    const p = boot(list);
    draw(p);
    p.det.claims[0].style.height = '120px';
    // a leaves the list, so the selection falls to b while #det still holds a's drawn dragged element
    list.splice(0, 1);
    draw(p);
    assert.ok(/task b/.test(p.det.innerHTML), 'the detail now shows b');
    assert.equal(p.det.claims[0].style.height, undefined);
});

test('A dragged, B, back to A → A keeps its own height', () => {
    const a = { ...SES, id: 'a' }, b = { ...SES, id: 'b', task: 'task b', updated: Date.now() - 120000 };
    const list = [a, b];
    const p = boot(list);
    draw(p);
    p.det.claims[0].style.height = '520px';
    list.splice(0, 1, b); // the selection falls to b
    list.length = 1;
    draw(p);
    assert.ok(/task b/.test(p.det.innerHTML), 'the detail shows b');
    assert.equal(p.det.claims[0].style.height, undefined);
    list.length = 0; list.push(a); // b leaves, the selection falls back to a
    draw(p);
    assert.ok(/task a/.test(p.det.innerHTML), 'the detail shows a again');
    assert.equal(p.det.claims[0].style.height, '520px');
});

test('A 520px, selection empty, back to A → A keeps 520px', () => {
    const list = [{ ...SES, id: 'a' }];
    const p = boot(list);
    draw(p);
    p.det.claims[0].style.height = '520px';
    const a = list[0];
    list.length = 0; // nothing selected: #det holds the pick-a-row state
    draw(p);
    assert.equal(p.det.claims.length, 0);
    list.push(a);
    draw(p);
    assert.equal(p.det.claims[0].style.height, '520px');
});

test('a paint with no .claims element in the DOM does not forget the saved height', () => {
    const p = boot([{ ...SES, id: 'a' }]);
    draw(p);
    p.det.claims[0].style.height = '520px';
    draw(p); // saved as 520px
    p.det.claims = []; // the DOM holds no .claims for one paint
    draw(p);
    assert.equal(p.det.claims[0].style.height, '520px');
});

test('A 520px, B 300px, A again, B again → each keeps its own height', () => {
    const a = { ...SES, id: 'a' }, b = { ...SES, id: 'b', task: 'task b', updated: Date.now() - 120000 };
    const list = [a, b];
    const p = boot(list);
    const show = (s) => { list.length = 0; list.push(s); draw(p); };
    draw(p);
    p.det.claims[0].style.height = '520px';
    show(b);
    p.det.claims[0].style.height = '300px';
    show(a);
    assert.equal(p.det.claims[0].style.height, '520px');
    show(b);
    assert.equal(p.det.claims[0].style.height, '300px');
});
