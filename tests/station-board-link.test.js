'use strict';
// The project card's architecture-board link
// (docs/90-agent/plans/2026-10-08-station-chartroom-design.md §4, §6): the
// pure function, and its href fetched back from a served station, so the
// link and the route agree on the same root.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const { serve } = require('../scripts/station.js');
const V = require('../assets/station/station.js');
const tmp = require('./tmp.js');

test('a served page links a project with a board to /chartroom/<folder name>/ in a new tab', () => {
    const html = V.boardLinkHtml({ root: 'F:\\ws\\proj', board: true }, true);
    assert.match(html, /href="\/chartroom\/proj\/"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /架構白板/);
    assert.match(V.boardLinkHtml({ root: '/home/u/my proj', board: true }, true), /href="\/chartroom\/my%20proj\/"/);
});

test('no link without a board, or from a static copy', () => {
    const p = { root: 'F:\\ws\\proj', board: true };
    assert.equal(V.boardLinkHtml({ root: p.root, board: false }, true), '');
    assert.equal(V.boardLinkHtml(p, false), '');
});

test('the link on the served data answers 200 with the board page', async () => {
    const base = tmp('fankeel-station-board-link-');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    const root = path.resolve(path.join(base, 'proj'));
    registry.ensureLayout(root);
    fs.writeFileSync(station.boardPath(root), '{"chartroom":1,"title":"F","root":"main"}\n{"view":"main"}\n');
    const s = await serve({ configDir: cfg, roots: [root], port: 0, idleMs: 0, open: false });
    try {
        const data = await (await fetch(s.url + 'station/station-data.js')).text();
        const S = JSON.parse(data.replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
        const p = S.projects.find((x) => x.root === root);
        assert.ok(p && p.board, 'the served data says the project has a board');
        const html = V.boardLinkHtml(p, S.serve);
        const href = (/href="([^"]+)"/.exec(html) || [])[1];
        assert.ok(href && href.endsWith('/'), html);
        const r = await fetch(new URL(href, s.url));
        assert.equal(r.status, 200);
        assert.match(await r.text(), /<img src="board\.svg"/);
    } finally {
        s.close();
    }
});
