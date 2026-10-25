'use strict';
// assets/station/diagram.js (FK_DIAGRAM): a ```mermaid fence drawn by the vendored
// pele as a pan/zoom diagram, with node marks for the gate page; and how the
// station serves and lists the vendored assets/station/vendor/pele.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const station = require('../lib/station.js');
const { serve } = require('../scripts/station.js');
const { page, stringsLeft } = require('./station-module.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const CODE = 'flowchart TD\n  A["Start<br/>first step"] --> B(Done)\n  A --> C{x < y}';

function loaded() {
    const { win } = page(['diagram.js'], {});
    return win.FK_DIAGRAM;
}

// Just enough DOM for draw(): one figure, its pan box, two nodes, and the
// listeners it adds, which a test calls with a fake event.
function fake(opts) {
    const handlers = {};
    const node = (id, text) => {
        const cls = new Set(), attrs = { 'data-id': id };
        const n = { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) },
            getAttribute: (k) => (k in attrs ? attrs[k] : null), setAttribute(k, v) { attrs[k] = String(v); },
            querySelector: (s) => (s === 'text' ? { textContent: text } : null), closest: (s) => (s === '.pele-node[data-id]' ? n : null) };
        return n;
    };
    const nodes = [node('A', 'Start'), node('B', 'Done')];
    const pan = { innerHTML: '', querySelectorAll: () => nodes, querySelector: () => null, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
    const out = { textContent: '' }, count = { textContent: '' };
    const attrs = {};
    const fig = {
        querySelector: (s) => (s === 'code' ? { textContent: CODE } : s === '[data-dg-pan]' ? pan : s === '[data-dg-scale]' ? out : s === '[data-dg-count]' ? count : s === '[data-dg-err]' ? err : null),
        querySelectorAll: () => [], setAttribute(k, v) { attrs[k] = String(v); }, getAttribute: (k) => attrs[k], addEventListener(t, f) { handlers[t] = f; } };
    const err = { textContent: '', hidden: true };
    const root = { querySelectorAll: () => [fig] };
    const ctl = { scale: 1, fit: 1, zoomTo() {}, zoomBy() {}, reset() {} };
    const pele = { render: () => { if (opts && opts.throws) throw Object.assign(new Error('bad token'), { line: 3 }); return { svg: '<svg></svg>' }; }, enableZoom: () => ctl };
    return { fig, pan, root, pele, handlers, err, attrs, count, nodes };
}

test('fence keeps the source html-escaped inside a data-mermaid block that carries its line', () => {
    const h = loaded().fence(CODE, 7);
    assert.match(h, /data-mermaid/);
    assert.match(h, /data-l="7"/);
    assert.ok(h.includes('<pre class="dg-src"><code>flowchart TD\n  A[&quot;Start&lt;br/&gt;first step&quot;]'), h);
    assert.ok(h.includes('{x &lt; y}'), h);
    assert.ok(!h.includes('x < y'), 'the source is escaped');
});

test('draw renders the block, applies enableZoom, and a node click marks it, calls onMark, and a second click unmarks', async () => {
    const D = loaded(), f = fake(), got = [];
    D.draw(f.root, { mark: true, onMark: (m) => got.push(JSON.parse(JSON.stringify(m))), pele: f.pele });
    assert.equal(f.pan.innerHTML, '<svg></svg>');
    assert.equal(f.attrs['data-drawn'], '1');
    f.handlers.click({ target: f.nodes[0] });
    assert.ok(f.nodes[0].classList.contains('is-marked'));
    assert.deepEqual(got.at(-1), [{ id: 'A', label: 'Start' }]);
    f.handlers.click({ target: f.nodes[1] });
    assert.deepEqual(got.at(-1), [{ id: 'A', label: 'Start' }, { id: 'B', label: 'Done' }]);
    f.handlers.click({ target: f.nodes[0] });
    assert.ok(!f.nodes[0].classList.contains('is-marked'));
    assert.deepEqual(got.at(-1), [{ id: 'B', label: 'Done' }]);
});

test('without mark, a node click marks nothing', () => {
    const D = loaded(), f = fake();
    D.draw(f.root, { pele: f.pele, onMark() { throw new Error('called'); } });
    f.handlers.click({ target: f.nodes[0] });
    assert.ok(!f.nodes[0].classList.contains('is-marked'));
});

test('a pele that throws leaves the source and one grey line with its line and message', () => {
    const D = loaded(), f = fake({ throws: true });
    D.draw(f.root, { pele: f.pele });
    assert.equal(f.attrs['data-view'], 'source');
    assert.equal(f.attrs['data-drawn'], undefined);
    assert.equal(f.err.hidden, false);
    assert.match(f.err.textContent, /3/);
    assert.match(f.err.textContent, /bad token/);
});

test('diagram.js has English for every Chinese string it shows', () => {
    assert.deepEqual(stringsLeft('diagram.js', loaded().EN), []);
});

test('the vendored pele is the pinned build, and the station serves it', async () => {
    const bytes = fs.readFileSync(path.join(ASSETS, 'vendor', 'pele.js'));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), 'dd70e44152f7d70d62fedc622f588db3f5855859b444f4d8cf274925c12f2651');
    const cfg = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'fk-dg-'));
    const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'fk-dgr-'));
    const s = await serve({ configDir: cfg, roots: [root], port: 0, idleMs: 60e3, open: false });
    try {
        const get = (p) => fetch(s.url.replace(/\/$/, '') + p);
        const r = await get('/station/vendor/pele.js');
        assert.equal(r.status, 200);
        assert.match(r.headers.get('content-type'), /javascript/);
        assert.equal(Buffer.from(await r.arrayBuffer()).toString('utf8'), bytes.toString('utf8'));
        for (const p of ['/station/vendor/PELE-LICENSE', '/station/vendor/%2e%2e%2fstation.css','/station/vendor/nope.js']) {
            const x = await get(p);
            assert.notEqual(x.status, 200, p);
            await x.arrayBuffer();
        }
    } finally {
        s.close();
    }
});

test('MODULES and EMITTED list diagram.js, diagram.css and vendor/pele.js; the focus page loads the diagram before the gate frame', () => {
    for (const n of ['diagram.js', 'diagram.css', 'vendor/pele.js']) {
        assert.ok(station.MODULES.includes(n), n);
        assert.ok(station.EMITTED.includes('station/' + n), n);
    }
    const html = station.focusShell('abc123', 'gate');
    assert.ok(html.includes('<script src="/station/diagram.js"></script>'));
    assert.ok(html.indexOf('diagram.js') < html.indexOf('gate-frame.js'));
    assert.ok(html.includes('<link rel="stylesheet" href="/station/diagram.css">'));
});
