'use strict';
// station-chartroom-vendored-1: lib/board.js `boardPage`, the read-only page
// the station's /chartroom/<name>/ route hands a project's architecture board
// to — the vendored render code, no Chartroom install.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const board = require('../lib/board.js');
const tmp = require('./tmp.js');

const BOARD = '{"chartroom":1,"title":"Flow","root":"main"}\n{"view":"main","title":"Flow","dir":"LR"}\n{"node":"a","in":"main","label":"Input"}\n';

async function serving(text, name) {
    const file = path.join(tmp('fankeel-board-page-'), 'architecture.board');
    fs.writeFileSync(file, text);
    const handler = board.boardPage(file, name);
    const server = http.createServer(handler);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    return { url: 'http://127.0.0.1:' + server.address().port, handler, close: () => server.close() };
}

test('the page escapes the project name and points at board.svg', async () => {
    const s = await serving(BOARD, 'a<b>&"c');
    try {
        const r = await fetch(s.url + '/');
        assert.equal(r.status, 200);
        const html = await r.text();
        assert.match(html, /<img src="board\.svg"/);
        assert.ok(html.includes('a&lt;b&gt;&amp;&quot;c'), html);
        assert.ok(!html.includes('a<b>'), 'the name is not markup');
    } finally { s.close(); }
});

test('board.svg is the vendored drawing, sandboxed by its content-security-policy', async () => {
    const s = await serving(BOARD, 'proj');
    try {
        const r = await fetch(s.url + '/board.svg');
        assert.equal(r.status, 200);
        assert.match(r.headers.get('content-type'), /^image\/svg\+xml/);
        assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
        assert.match(await r.text(), /<svg[\s>]/);
    } finally { s.close(); }
});

test('a board that does not parse is a 422 with Chartroom\'s message', async () => {
    const s = await serving('not json\n', 'proj');
    try {
        assert.equal((await fetch(s.url + '/board.svg')).status, 422);
    } finally { s.close(); }
});

test('any other path is 404, any write is 405, and close() is there to call', async () => {
    const s = await serving(BOARD, 'proj');
    try {
        assert.equal((await fetch(s.url + '/assets/app.js')).status, 404);
        const post = await fetch(s.url + '/api/ops', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        assert.equal(post.status, 405);
        assert.equal(post.headers.get('allow'), 'GET');
        assert.equal(typeof s.handler.close, 'function');
        s.handler.close();
    } finally { s.close(); }
});
