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

test('changes already sent to the agent are history: not listed, not counted for undo', () => {
    B._seed(S.id, 'arch', { svg: '<svg/>', check: { ok: true, problems: [] }, editable: true, changes: [
        { kind: 'edit', text: 'OLD', sent: true, dropped: false },
        { kind: 'edit', text: 'NEW', sent: false, dropped: false },
    ] });
    const html = B.changesHtml(S);
    assert.doesNotMatch(html, /OLD/);
    assert.match(html, /<span class="bch-t">NEW<\/span><button[^>]*data-bd-drop="1"/);
    assert.match(B.paneHtml(S), /data-bd-tool="undo"[^>]*>.*?<b class="bd-n">1<\/b>/);
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

// A board with nodes (by default one node `a` labelled Old), its pane, and
// the fakes the delegated listeners walk: closest() answers the selectors the
// module asks, and the SVG maps client to SVG units one to one.
function rig(o = {}) {
    const { M, win, doc } = page(['board-edit.js']);
    const P = M['board-edit.js'];
    const sent = [];
    win.fetch = (url, opts) => {
        sent.push({ url, form: opts && opts.body });
        const answer = { svg: '<svg viewBox="0 0 400 300"></svg>', check: { ok: true, problems: [] }, changes: [], editable: true, root: 'v' };
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(answer)) });
    };
    const nodes = o.nodes || [{ id: 'a', box: { x: 10, y: 20, w: 160, h: 64 }, lines: ['Old'] }];
    const frames = (o.frames || []).map((b) => ({ querySelector: (s) => (/cr-frame/.test(s) ? { getBBox: () => ({ x: b.x, y: b.y, width: b.w, height: b.h }) } : null) }));
    const svgText = o.svg || '<svg viewBox="0 0 400 300">' + nodes.map((n) => '<g data-id="' + n.id + '" data-type="node"><rect class="cr-shape"/>'
        + n.lines.map((l) => '<text class="cr-label">' + l + '</text>').join('') + '</g>').join('') + '</svg>';
    P._seed(S.id, 'arch', { svg: svgText, check: { ok: true, problems: [] }, changes: o.changes || [], editable: true, root: 'v' });
    const on = {};
    P.listen({ addEventListener: (t, f) => { on[t] = f; } }, 'N1');
    const attrs = {};
    const pane = { getAttribute: (k) => (k === 'data-bd' ? S.id + '/arch' : null) };
    // An edge's label is its own group, data-label-for, drawn apart from its
    // line's data-type="edge" group (lib/chartroom/geometry/svg.js).
    const labels = [], inLabel = {}, inEdge = {};
    const svg = { querySelectorAll: (s) => (s === '[data-type="frame"]' ? frames : s === '[data-label-for]' ? labels : []),
        createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }),
        getScreenCTM: () => ({ inverse: () => ({}) }) };
    const g = {}, inNode = {};
    for (const n of nodes) {
        const shape = { getBBox: () => ({ x: n.box.x, y: n.box.y, width: n.box.w, height: n.box.h }) };
        const texts = n.lines.map((l) => ({ textContent: l }));
        g[n.id] = { getAttribute: (k) => ({ 'data-id': n.id, 'data-type': 'node' })[k], setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute() {},
            querySelector: (s) => (/cr-shape/.test(s) ? shape : /text/.test(s) ? texts[0] : null),
            querySelectorAll: (s) => (/text/.test(s) ? texts : []), ownerSVGElement: svg };
        inNode[n.id] = { closest: (s) => (s === '[data-bd]' ? pane : s === '[data-type="node"]' ? g[n.id] : s === 'svg' ? svg : null) };
    }
    for (const ed of o.edges || []) {
        const texts = (ed.lines || []).map((l) => ({ textContent: l }));
        const bbox = (b) => () => ({ x: b.x, y: b.y, width: b.w, height: b.h });
        const lab = { getAttribute: (k) => (k === 'data-label-for' ? ed.id : null), querySelector: () => null,
            querySelectorAll: (s) => (/text/.test(s) ? texts : []), getBBox: bbox(ed.label || { x: 0, y: 0, w: 0, h: 0 }), ownerSVGElement: svg };
        if (texts.length) labels.push(lab);
        const line = { getAttribute: (k) => ({ 'data-id': ed.id, 'data-type': 'edge' })[k], querySelector: () => null,
            querySelectorAll: () => [], getBBox: bbox(ed.line), ownerSVGElement: svg };
        inLabel[ed.id] = { closest: (s) => (s === '[data-bd]' ? pane : s === '[data-label-for]' ? lab : s === 'svg' ? svg : null) };
        inEdge[ed.id] = { closest: (s) => (s === '[data-bd]' ? pane : s === '[data-type="edge"]' ? line : s === 'svg' ? svg : null) };
    }
    const onSvg = { closest: (s) => (s === '[data-bd]' ? pane : s === 'svg' ? svg : null) };
    const field = (name, value) => { const f = { value, getAttribute: (k) => (k === 'data-bd-in' ? name : null) };
        f.closest = (s) => (s === '[data-bd]' ? pane : s === '[data-bd-in]' ? f : s === 'foreignObject' ? {} : null); return f; };
    const toolBtn = (name) => { const b = { getAttribute: (k) => (k === 'data-bd-tool' ? name : null) };
        b.closest = (s) => (s === '[data-bd]' ? pane : s === '[data-bd-tool]' ? b : null); return b; };
    const dropBtn = (at) => { const b = { getAttribute: (k) => (k === 'data-bd-drop' ? at : null) };
        b.closest = (s) => (s === '[data-bd]' ? pane : s === '[data-bd-drop]' ? b : null); return b; };
    const key = (target, k, extra) => on.keydown(Object.assign({ target, key: k, preventDefault() {} }, extra));
    const batch = (i = 0) => JSON.parse(sent[i].form.get('batch'));
    const catSel = (value) => { const c = { value, getAttribute: (k) => (k === 'data-bd-cat' ? '' : null) };
        c.closest = (s) => (s === '[data-bd]' ? pane : s === '[data-bd-cat]' ? c : null); return c; };
    return { P, win, doc, pane, on, sent, inNode: inNode[nodes[0].id], nodeOf: inNode, inLabel, inEdge, onSvg, field, toolBtn, dropBtn, catSel, key, attrs, batch };
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

test('a move of a framed node sends x/y relative to its innermost frame', () => {
    // levelmark.board: api is x40 y90 in f-back (340,40), drawn at 380,130; f-outer holds f-back.
    const r = rig({ nodes: [{ id: 'api', box: { x: 380, y: 130, w: 168, h: 64 }, lines: ['api'] }],
        frames: [{ x: 300, y: 20, w: 700, h: 600 }, { x: 340, y: 40, w: 611.2, h: 520 }, { x: 40, y: 80, w: 240, h: 176 }] });
    r.on.pointerdown({ target: r.inNode, button: 0, pointerId: 1, clientX: 400, clientY: 150 });
    r.on.pointermove({ clientX: 420, clientY: 160 });
    r.on.pointerup({});
    assert.equal(r.sent.length, 1);
    assert.deepEqual(r.batch(), { ops: [{ op: 'set', id: 'api', f: { x: 60, y: 100, w: 168, h: 64 } }] });
});

test('a move of a top-level node sends its SVG position', () => {
    const r = rig({ frames: [{ x: 340, y: 40, w: 611, h: 520 }] });
    r.on.pointerdown({ target: r.inNode, button: 0, pointerId: 1, clientX: 20, clientY: 30 });
    r.on.pointermove({ clientX: 25, clientY: 50 });
    r.on.pointerup({});
    assert.deepEqual(r.batch(), { ops: [{ op: 'set', id: 'a', f: { x: 15, y: 40, w: 160, h: 64 } }] });
});

test('renaming a two-line node changes line one and keeps the subtitle', () => {
    const r = rig({ nodes: [{ id: 'api', box: { x: 380, y: 130, w: 168, h: 64 }, lines: ['api', 'Flask · REST'] }] });
    r.on.dblclick({ target: r.inNode });
    assert.match(r.P.paneHtml(S), /data-bd-in="label"[^>]*value="api"/);
    r.key(r.field('label', 'gateway'), 'Enter');
    assert.deepEqual(r.batch(), { ops: [{ op: 'set', id: 'api', f: { label: 'gateway\nFlask · REST' } }] });
    assert.match(r.sent[0].form.get('text'), /gateway\nFlask · REST$/);
});

test('a board that cannot be read says why on the pane', async () => {
    const r = rig();
    r.win.fetch = () => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('no such board for that session\n') });
    r.P.load(S, 'N1', () => {});
    await tick(); await tick();
    assert.match(r.P.paneHtml(S), /role="alert"[^>]*>[^<]*no such board for that session/);
    const { M, win } = page(['board-edit.js']);
    win.fetch = () => Promise.reject(new Error('offline'));
    M['board-edit.js'].load(S, 'N1', () => {});
    await tick(); await tick();
    assert.match(M['board-edit.js'].paneHtml(S), /role="alert"/);
});

test('a drop button sends op=drop with the index of the change it sits on', () => {
    const r = rig({ changes: [{ kind: 'edit', text: 'A', dropped: false }, { kind: 'edit', text: 'B', dropped: true }, { kind: 'mark', text: 'C', dropped: false }] });
    const at = /<span class="bch-t">C<\/span><button[^>]*data-bd-drop="(\d+)"/.exec(r.P.changesHtml(S))[1];
    r.on.click({ target: r.dropBtn(at) });
    assert.equal(r.sent.length, 1);
    assert.deepEqual([r.sent[0].form.get('op'), r.sent[0].form.get('at')], ['drop', '2']);
});

test('undo drops the last change still live', () => {
    const r = rig({ changes: [{ kind: 'edit', text: 'A', dropped: false }, { kind: 'edit', text: 'B', dropped: false }, { kind: 'mark', text: 'C', dropped: true }] });
    r.on.click({ target: r.toolBtn('undo') });
    assert.equal(r.sent.length, 1);
    assert.deepEqual([r.sent[0].form.get('op'), r.sent[0].form.get('at')], ['drop', '1']);
});

test('undo never drops a change already sent to the agent', () => {
    const r = rig({ changes: [{ kind: 'edit', text: 'A', sent: false, dropped: false }, { kind: 'edit', text: 'B', sent: true, dropped: false }] });
    r.on.click({ target: r.toolBtn('undo') });
    assert.equal(r.sent.length, 1);
    assert.deepEqual([r.sent[0].form.get('op'), r.sent[0].form.get('at')], ['drop', '0']);
});

test('delete removes the selected node', () => {
    const r = rig();
    r.on.click({ target: r.inNode });
    r.on.click({ target: r.toolBtn('delete') });
    assert.equal(r.sent.length, 1);
    assert.deepEqual(r.batch(), { ops: [{ op: 'del', id: 'a' }] });
    assert.equal(r.sent[0].form.get('text'), '刪除 a');
});

test('add node places a new node where the board is clicked', () => {
    const r = rig();
    r.on.click({ target: r.toolBtn('add-node') });
    r.on.click({ target: r.onSvg, clientX: 100.4, clientY: 50.6 });
    assert.equal(r.sent.length, 1);
    const rec = r.batch().ops[0].rec;
    assert.match(rec.node, /^n\d+$/);
    assert.deepEqual([rec.in, rec.x, rec.y], ['v', 100, 51]);
});

test('add node sends the category chosen in the toolbar', () => {
    const r = rig();
    r.P._seed(S.id, 'arch', { svg: '<svg viewBox="0 0 400 300"></svg>', check: { ok: true, problems: [] }, changes: [], editable: true, root: 'v',
        categories: [{ id: 'service', name: '服務' }, { id: 'store', name: '儲存' }] });
    assert.match(r.P.paneHtml(S), /<select data-bd-cat=""[^>]*><option value="service" selected>服務<\/option><option value="store">儲存<\/option><\/select>/);
    r.on.change({ target: r.catSel('store') });
    assert.match(r.P.paneHtml(S), /<option value="store" selected>/, 'a repaint keeps the choice');
    r.on.click({ target: r.toolBtn('add-node') });
    r.on.click({ target: r.onSvg, clientX: 10, clientY: 10 });
    assert.equal(r.batch().ops[0].rec.icon, 'fk:store');
});

test('a double-click on an edge label edits the edge text in place', () => {
    const r = rig({ edges: [{ id: 'e1', lines: ['calls', 'HTTPS'], label: { x: 100, y: 90, w: 50, h: 22 }, line: { x: 80, y: 100, w: 100, h: 2 } }] });
    r.on.dblclick({ target: r.inLabel.e1 });
    const html = r.P.paneHtml(S);
    assert.match(html, /data-bd-in="label" aria-label="連線文字"[^>]*value="calls"/);
    assert.match(html, /aria-label="連線 id" value="e1"/);
    assert.match(html, /<foreignObject x="45" y="75" width="160" height="52">/, 'an editor box wide enough for its two fields, on the label');
    r.key(r.field('label', 'writes'), 'Enter');
    assert.deepEqual(r.batch(), { ops: [{ op: 'set', id: 'e1', f: { label: 'writes\nHTTPS' } }] });
    assert.equal(r.sent[0].form.get('text'), '改連線 e1 文字：calls\nHTTPS → writes\nHTTPS');
});

test('a double-click on an edge line edits its text, an unlabelled edge from empty', () => {
    const r = rig({ edges: [{ id: 'e1', lines: ['calls'], label: { x: 100, y: 90, w: 50, h: 22 }, line: { x: 80, y: 100, w: 100, h: 2 } },
        { id: 'e2', line: { x: 0, y: 200, w: 200, h: 0 } }] });
    r.on.dblclick({ target: r.inEdge.e1 });
    assert.match(r.P.paneHtml(S), /data-bd-in="label"[^>]*value="calls"/, 'the text comes from the edge\'s label group');
    r.key(r.field('label', 'Escape'), 'Escape');
    r.on.dblclick({ target: r.inEdge.e2 });
    assert.match(r.P.paneHtml(S), /<foreignObject x="20" y="174" width="160" height="52">/);
    r.key(r.field('label', 'reads'), 'Enter');
    assert.deepEqual(r.batch(), { ops: [{ op: 'set', id: 'e2', f: { label: 'reads' } }] });
});

test('add edge joins the two nodes clicked in turn', () => {
    const r = rig({ nodes: [{ id: 'a', box: { x: 10, y: 20, w: 160, h: 64 }, lines: ['A'] }, { id: 'b', box: { x: 210, y: 20, w: 160, h: 64 }, lines: ['B'] }] });
    r.on.click({ target: r.toolBtn('add-edge') });
    r.on.click({ target: r.nodeOf.a });
    assert.equal(r.sent.length, 0);
    r.on.click({ target: r.nodeOf.b });
    assert.equal(r.sent.length, 1);
    const rec = r.batch().ops[0].rec;
    assert.deepEqual([rec.from, rec.to, rec.in], ['a', 'b', 'v']);
    assert.match(rec.edge, /^e\d+$/);
});

test("a node id with ' keeps its selection highlight after a repaint", () => {
    const r = rig({ nodes: [{ id: "o'k", box: { x: 10, y: 20, w: 160, h: 64 }, lines: ['OK'] }],
        svg: '<svg viewBox="0 0 400 300"><g data-id="o&apos;k" data-type="node"><rect class="cr-shape"/><text class="cr-label">OK</text></g></svg>' });
    r.on.click({ target: r.inNode });
    assert.match(r.P.paneHtml(S), /data-id="o&apos;k" data-bd-on=""/);
});

test('station-61: every tool is an icon button carrying its name in aria-label and title', () => {
    B._seed(S.id, 'arch', { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"></svg>', check: { ok: true, problems: [] }, changes: [], editable: true });
    const html = B.paneHtml(S);
    for (const [t, name] of [['select', '選取'], ['add-node', '新增節點'], ['add-edge', '新增連線'], ['mark', '標記給 AI'], ['delete', '刪除'], ['undo', '復原']]) {
        const btn = new RegExp('<button[^>]*data-bd-tool="' + t + '"[^>]*>');
        const tag = btn.exec(html);
        assert.ok(tag, t + ' button missing');
        assert.match(tag[0], new RegExp('aria-label="' + name));
        assert.match(tag[0], new RegExp('title="' + name));
        assert.match(html.slice(tag.index, html.indexOf('</button>', tag.index)), /<svg class="bd-ic"/);
    }
    for (const b of ['board-tools-edit', 'board-tools-history', 'board-hint', 'board-zoom']) assert.match(html, new RegExp('data-block="' + b + '"'));
    assert.match(html, /data-bd-zoom="fit"/);
});

test('station-61: zoomAt keeps the point under the pointer, and withView writes the viewBox back', () => {
    const vb = { x: 0, y: 0, w: 400, h: 300, s: 1 };
    const z = B._zoomAt(vb, 2, 100, 50);
    assert.equal(z.s, 2);
    assert.equal(z.w, 200);
    assert.equal(z.h, 150);
    assert.equal(z.x + 100 / 2, 0 + 100 / 1, 'board x under the pointer is unchanged');
    assert.equal(z.y + 50 / 2, 0 + 50 / 1, 'board y under the pointer is unchanged');
    assert.equal(B._zoomAt(vb, 9, 0, 0).s, 3, 'clamped to MAX');
    assert.equal(B._zoomAt(vb, 0.01, 0, 0).s, 0.25, 'clamped to MIN');
    assert.match(B._withView('<svg viewBox="0 0 400 300"><g/></svg>', { x: 10, y: 20, w: 200, h: 150 }), /^<svg viewBox="10 20 200 150"/);
    assert.equal(B._withView('<svg viewBox="0 0 400 300"/>', null), '<svg viewBox="0 0 400 300"/>');
});

// The board's view and what sits in it: a 400x300 svg shown in a 400x300 box, so
// fit is scale 1. `noSvg` is a board still loading, which has no svg to read.
function viewRig(r, o = {}) {
    const svg = { attrs: {}, getAttribute: (k) => (k === 'viewBox' ? '0 0 400 300' : null), setAttribute: (k, v) => { svg.attrs[k] = v; } };
    const pct = { textContent: '' };
    const view = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }), classList: { add() {}, remove() {} },
        querySelector: (s) => (s === 'svg' ? (o.noSvg ? null : svg) : s === '.bd-pct' ? pct : null),
        getAttribute: (k) => (k === 'data-bd-view' ? '' : null), setPointerCapture() {}, focus() {} };
    view.closest = (s) => (s === '[data-bd-view]' ? view : s === '[data-bd]' ? r.pane : null);
    const zoomBtn = (z) => { const b = { getAttribute: (k) => (k === 'data-bd-zoom' ? z : null) };
        b.closest = (s) => (s === '[data-bd-zoom]' ? b : s === '.bd-zoom' ? b : s === '[data-bd-view]' ? view : s === '[data-bd]' ? r.pane : null); return b; };
    const viewBox = () => /<svg viewBox="([^"]*)"/.exec(r.P.paneHtml(S))[1];
    return { view, svg, pct, zoomBtn, viewBox };
}

test('station-61: the zoom buttons step the view about its centre, 100% and fit', () => {
    const r = rig(), v = viewRig(r);
    assert.equal(v.viewBox(), '0 0 400 300');
    r.on.click({ target: v.zoomBtn('in') });
    assert.equal(v.svg.attrs.viewBox, '40 30 320 240');
    assert.equal(v.pct.textContent, '125%');
    assert.equal(v.viewBox(), '40 30 320 240', 'a repaint draws the same view');
    r.on.click({ target: v.zoomBtn('one') });
    assert.equal(v.viewBox(), '0 0 400 300');
    r.on.click({ target: v.zoomBtn('out') });
    assert.equal(v.svg.attrs.viewBox, '-50 -37.5 500 375');
    r.on.click({ target: v.zoomBtn('fit') });
    assert.equal(v.viewBox(), '0 0 400 300', 'fit forgets the view');
});

test('station-61: Ctrl+wheel zooms about the pointer, a plain wheel is left alone', () => {
    const r = rig(), v = viewRig(r);
    let stopped = 0;
    const wheel = (o) => r.on.wheel(Object.assign({ target: v.view, deltaY: -100, clientX: 200, clientY: 150, preventDefault() { stopped++; } }, o));
    wheel({});
    assert.equal(stopped, 0);
    assert.equal(v.viewBox(), '0 0 400 300');
    wheel({ ctrlKey: true });
    assert.equal(stopped, 1);
    const w = Number(v.viewBox().split(' ')[2]);
    assert.ok(w < 400 && w > 300, 'zoomed in: ' + w);
});

test('station-61: the arrow keys pan and + - 0 zoom on the focused board, other targets are not its keys', () => {
    const r = rig(), v = viewRig(r);
    r.key(v.view, 'ArrowRight');
    assert.equal(v.viewBox(), '40 0 400 300');
    r.key(v.view, 'ArrowDown');
    assert.equal(v.viewBox(), '40 40 400 300');
    r.key(v.view, '+');
    assert.equal(v.svg.attrs.viewBox, '80 70 320 240');
    r.key(v.view, '-');
    assert.equal(v.svg.attrs.viewBox, '40 40 400 300');
    r.key(v.view, '0');
    assert.equal(v.viewBox(), '0 0 400 300');
    r.key(v.zoomBtn('in'), 'ArrowLeft');
    assert.equal(v.viewBox(), '0 0 400 300', 'a key on a button inside the board is not the view\'s');
});

test('station-61: a pan moves the view, and the click that ends it is swallowed once', () => {
    const r = rig(), v = viewRig(r);
    r.on.pointerdown({ target: v.view, button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    r.on.pointermove({ pointerId: 1, clientX: 140, clientY: 120 });
    r.on.pointerup({ pointerId: 1 });
    assert.equal(v.viewBox(), '-40 -20 400 300');
    r.on.click({ target: v.zoomBtn('in') });
    assert.equal(v.viewBox(), '-40 -20 400 300', 'the click after a pan does nothing');
    r.on.click({ target: v.zoomBtn('in') });
    assert.notEqual(v.viewBox(), '-40 -20 400 300', 'the next click works');
});

test('station-61: a pan cancelled by the browser does not swallow the next click', () => {
    const r = rig({ changes: [{ kind: 'edit', text: 'A', dropped: false }] }), v = viewRig(r);
    r.on.pointerdown({ target: v.view, button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    r.on.pointermove({ pointerId: 1, clientX: 140, clientY: 120 });
    r.on.pointercancel({ pointerId: 1 });
    r.on.pointerdown({ target: r.toolBtn('undo'), button: 0, pointerId: 2, clientX: 5, clientY: 5 });
    r.on.click({ target: r.toolBtn('undo') });
    assert.equal(r.sent.length, 1, 'no click came for the cancelled pan, so the next press is not its click');
});

test('station-61: lifting one finger of a pinch ends it, the other finger moving throws nothing', () => {
    const r = rig(), v = viewRig(r);
    r.on.pointerdown({ target: v.view, button: 0, pointerId: 1, clientX: 100, clientY: 150 });
    r.on.pointerdown({ target: v.view, button: 0, pointerId: 2, clientX: 300, clientY: 150 });
    r.on.pointermove({ pointerId: 2, clientX: 400, clientY: 150 });
    const pinched = v.viewBox();
    assert.notEqual(pinched, '0 0 400 300', 'two fingers pinch');
    r.on.pointerup({ pointerId: 1 });
    assert.doesNotThrow(() => r.on.pointermove({ pointerId: 2, clientX: 100, clientY: 150 }));
    assert.equal(v.viewBox(), pinched);
});

test('station-61: a board with no svg yet (loading) throws on no key, button, wheel or touch', () => {
    const r = rig(), v = viewRig(r, { noSvg: true });
    assert.doesNotThrow(() => {
        r.key(v.view, '+');
        r.key(v.view, 'ArrowLeft');
        r.on.click({ target: v.zoomBtn('in') });
        r.on.click({ target: v.zoomBtn('one') });
        r.on.wheel({ target: v.view, ctrlKey: true, deltaY: -100, clientX: 1, clientY: 1, preventDefault() {} });
        r.on.pointerdown({ target: v.view, button: 0, pointerId: 1, clientX: 1, clientY: 1 });
        r.on.pointermove({ pointerId: 1, clientX: 50, clientY: 50 });
        r.on.pointerup({ pointerId: 1 });
    });
});

test('station-61: a repaint that drops the focus from the board gives it back, so the next key still lands', async () => {
    const r = rig(), v = viewRig(r), body = {};
    r.doc.activeElement = v.view;
    r.doc.querySelector = (s) => (s === '[data-bd-view]' ? v.view : null);
    v.view.focus = () => { r.doc.activeElement = v.view; };
    r.P.load(S, 'N1', () => { r.doc.activeElement = body; });
    await tick(); await tick();
    assert.equal(r.doc.activeElement, v.view);
    r.key(v.view, 'ArrowRight');
    r.key(v.view, '0');
    assert.equal(r.doc.activeElement, v.view, 'the 0 key repainted, and the board is focused still');
    r.doc.activeElement = body;
    r.P.load(S, 'N1', () => { r.doc.activeElement = body; });
    await tick(); await tick();
    assert.equal(r.doc.activeElement, body, 'a focus that was elsewhere is not taken');
});
