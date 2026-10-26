'use strict';
// The gate page's board pane (design §3, mockup board-upgrade): the markup
// from a cached state, and the op batch each tool sends.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../assets/station/board-edit.js');
const { page, stringsLeft } = require('./station-module.js');

const S = { id: 'aaaaaaaa-1111-4111-8111-111111111111', boards: [{ name: 'arch', updated: 1 }] };

test('no board: no pane and no changes list', () => {
    assert.equal(B.paneHtml({ id: 'x', boards: [] }), '');
    assert.equal(B.changesHtml({ id: 'x', boards: [] }), '');
});

test('the pane carries its blocks, and the toolbar is off when not editable', () => {
    B._seed(S.id, 'arch', { svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', check: { ok: true, problems: [] }, changes: [], editable: false });
    const html = B.paneHtml(S);
    for (const b of ['board-pane', 'board-toolbar', 'board', 'board-check']) assert.match(html, new RegExp('data-block="' + b + '"'));
    assert.match(html, /data-bd-tool="add-node"[^>]*disabled/);
    assert.match(html, /✓ 0 個問題/);
});

test('the changes list draws each change with a drop button, dropped ones left out', () => {
    B._seed(S.id, 'arch', { svg: '<svg/>', check: { ok: true, problems: [] }, editable: true, changes: [
        { kind: 'edit', text: '改名 a：A → B', dropped: false },
        { kind: 'mark', text: '標記 b：拆？', dropped: true },
    ] });
    const html = B.changesHtml(S);
    assert.match(html, /data-block="board-changes"/);
    assert.match(html, /改名 a：A → B/);
    assert.doesNotMatch(html, /標記 b/);
    assert.match(html, /data-bd-drop="0"/);
});

test('opFor builds the batch each tool sends', () => {
    assert.deepEqual(B.opFor('rename', { id: 'a', label: 'Z' }), { ops: [{ op: 'set', id: 'a', f: { label: 'Z' } }] });
    assert.deepEqual(B.opFor('move', { id: 'a', x: 10, y: 20, w: 160, h: 64 }), { ops: [{ op: 'set', id: 'a', f: { x: 10, y: 20, w: 160, h: 64 } }] });
    assert.deepEqual(B.opFor('delete', { id: 'a' }), { ops: [{ op: 'del', id: 'a' }] });
    assert.deepEqual(B.opFor('add-node', { id: 'n1', view: 'v', cat: 'store', x: 5, y: 6 }),
        { ops: [{ op: 'add', rec: { node: 'n1', in: 'v', label: '新節點', icon: 'fk:store', x: 5, y: 6, w: 160, h: 64 } }] });
    assert.deepEqual(B.opFor('add-edge', { id: 'e1', view: 'v', from: 'a', to: 'b' }),
        { ops: [{ op: 'add', rec: { edge: 'e1', in: 'v', from: 'a', to: 'b', arrow: 'end' } }] });
});

test('every Chinese string goes through loc() with English beside it', () => {
    assert.deepEqual(stringsLeft('board-edit.js', B.EN), []);
});

test('the pane reads in English when the station is in English', () => {
    const { M, win } = page(['board-edit.js']);
    win.FK_I18N = { lang: 'en' }; // i18n.js's shape: lang is a string
    const P = M['board-edit.js'];
    P._seed(S.id, 'arch', { svg: '<svg/>', check: { ok: true, problems: [] }, changes: [], editable: true });
    assert.match(P.paneHtml(S), /✓ 0 problems/);
});

test('the gate frame draws the pane before the report and the changes inside the question card', () => {
    const SS = Object.assign({}, S, { task: 'T', stage: 'design', route: ['survey', 'design'], gateAt: 1 });
    const { M } = page(['board-edit.js', 'gate-frame.js'], { sessions: [SS] });
    M['board-edit.js']._seed(S.id, 'arch', { svg: '<svg/>', check: { ok: true, problems: [] }, editable: true,
        changes: [{ kind: 'edit', text: 'rename a', dropped: false }] });
    const gate = { stage: 'design', gate: { questions: [{ question: 'Go?', options: [{ label: 'yes' }] }] } };
    const html = M['gate-frame.js'].frame({ session: SS, gate, reportHtml: '<section>REPORT</section>', answer: { question: 'Go?', send() {} } });
    assert.ok(html.indexOf('data-block="board-pane"') > html.indexOf('data-block="gate-main"'));
    assert.ok(html.indexOf('data-block="board-pane"') < html.indexOf('REPORT'));
    const q = html.indexOf('data-block="gate-question"'), c = html.indexOf('data-block="board-changes"');
    assert.ok(q > 0 && c > q && c < html.indexOf('data-block="gate-free"'), 'the changes sit in the card, above the free answer');
});

// A board with one node `a` labelled Old, its pane, and the fakes the
// delegated listeners walk: closest() answers the selectors the module asks.
function rig() {
    const { M, win } = page(['board-edit.js']);
    const P = M['board-edit.js'];
    const sent = [];
    win.fetch = (url, opts) => {
        sent.push({ url, form: opts && opts.body });
        const answer = { svg: '<svg viewBox="0 0 400 300"></svg>', check: { ok: true, problems: [] }, changes: [], editable: true, root: 'v' };
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(answer)) });
    };
    P._seed(S.id, 'arch', { svg: '<svg viewBox="0 0 400 300"><g data-id="a" data-type="node"><rect class="cr-shape"/><text>Old</text></g></svg>',
        check: { ok: true, problems: [] }, changes: [], editable: true, root: 'v' });
    const on = {};
    P.listen({ addEventListener: (t, f) => { on[t] = f; } }, 'N1');
    const attrs = {};
    const pane = { getAttribute: (k) => (k === 'data-bd' ? S.id + '/arch' : null) };
    const svg = { querySelectorAll: () => [] };
    const shape = { getBBox: () => ({ x: 10, y: 20, width: 160, height: 64 }) };
    const g = { getAttribute: (k) => ({ 'data-id': 'a', 'data-type': 'node' })[k], setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute() {},
        querySelector: (s) => (s === '.cr-shape' ? shape : s === 'text' ? { textContent: 'Old' } : null), ownerSVGElement: null };
    const inNode = { closest: (s) => (s === '[data-bd]' ? pane : s === '[data-type="node"]' ? g : s === 'svg' ? svg : null) };
    const field = (name, value) => { const f = { value, getAttribute: (k) => (k === 'data-bd-in' ? name : null) };
        f.closest = (s) => (s === '[data-bd]' ? pane : s === '[data-bd-in]' ? f : s === 'foreignObject' ? {} : null); return f; };
    const toolBtn = (name) => { const b = { getAttribute: (k) => (k === 'data-bd-tool' ? name : null) };
        b.closest = (s) => (s === '[data-bd]' ? pane : s === '[data-bd-tool]' ? b : null); return b; };
    const key = (target, k, extra) => on.keydown(Object.assign({ target, key: k, preventDefault() {} }, extra));
    return { P, on, sent, inNode, field, toolBtn, key, attrs };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('a double-click edits the label in place: Esc cancels, Enter sends the rename, an IME Enter does not', async () => {
    const r = rig();
    r.on.dblclick({ target: r.inNode });
    let html = r.P.paneHtml(S);
    assert.match(html, /<foreignObject[^>]*><div[^>]*class="bd-ned"><input data-bd-in="label"[^>]*value="Old"/);
    assert.equal((html.match(/<input/g) || []).length, 2, 'two inputs, as the mockup draws');
    r.key(r.field('label', 'Old'), 'Escape');
    assert.doesNotMatch(r.P.paneHtml(S), /foreignObject/);

    r.on.dblclick({ target: r.inNode });
    const f = r.field('label', 'New');
    r.on.input({ target: f });
    r.key(f, 'Enter', { isComposing: true });
    assert.equal(r.sent.length, 0, 'Enter that ends an IME composition saves nothing');
    r.key(f, 'Enter');
    assert.equal(r.sent.length, 1);
    const form = r.sent[0].form;
    assert.equal(r.sent[0].url, '/station/board/' + S.id + '/arch');
    assert.equal(form.get('nonce'), 'N1');
    assert.equal(form.get('op'), 'edit');
    assert.deepEqual(JSON.parse(form.get('batch')), { ops: [{ op: 'set', id: 'a', f: { label: 'New' } }] });
    await tick(); await tick();
    html = r.P.paneHtml(S);
    assert.doesNotMatch(html, /foreignObject/, 'a saved edit closes the editor');
});

test('mark opens a bubble on the selected node and Enter sends op=mark', () => {
    const r = rig();
    r.on.click({ target: r.inNode });
    assert.ok('data-bd-on' in r.attrs, 'a click selects the node');
    r.on.click({ target: r.toolBtn('mark') });
    const html = r.P.paneHtml(S);
    assert.match(html, /class="bd-bub"/);
    assert.match(html, /<input data-bd-in="note"/);
    r.key(r.field('note', 'split it?'), 'Enter');
    assert.equal(r.sent.length, 1);
    const form = r.sent[0].form;
    assert.deepEqual([form.get('op'), form.get('target'), form.get('note')], ['mark', 'a', 'split it?']);
});

test('a mark answer with svg null keeps the board drawn', async () => {
    const { M, win } = page(['board-edit.js']);
    const P = M['board-edit.js'];
    P._seed(S.id, 'arch', { svg: '<svg><g data-id="a"></g></svg>', check: { ok: true, problems: [] }, changes: [], editable: true });
    win.fetch = () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ svg: null, check: { ok: true, problems: [] }, changes: [{ kind: 'mark', text: 'm', dropped: false }], editable: true })) });
    await P.post(S.id, 'arch', 'N1', { op: 'mark', target: 'a', note: 'x' });
    assert.match(P.paneHtml(S), /data-id="a"/);
    assert.match(P.changesHtml(S), /data-bd-drop="0"/);
});

test('a refused edit says why on the pane', async () => {
    const { M, win } = page(['board-edit.js']);
    const P = M['board-edit.js'];
    P._seed(S.id, 'arch', { svg: '<svg/>', check: { ok: true, problems: [] }, changes: [], editable: true });
    win.fetch = () => Promise.resolve({ ok: false, status: 422, text: () => Promise.resolve(JSON.stringify({ errors: [{ i: 0, code: 'dup', message: 'id a already exists' }] })) });
    const res = await P.post(S.id, 'arch', 'N1', { op: 'edit', batch: '{}', text: 't' });
    assert.equal(res.ok, false);
    assert.match(P.paneHtml(S), /role="alert"[^>]*>[^<]*id a already exists/);
});
