'use strict';
// The project card's architecture-board link
// (docs/90-agent/plans/2026-10-08-station-chartroom-design.md §4, §6): the
// pure function, and its href fetched back from a served station with a
// fake Chartroom, so the link and the route agree on the same root.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const profile = require('../lib/profile.js');
const { serve } = require('../scripts/station.js');
const V = require('../assets/station/station.js');
const tmp = require('./tmp.js');

const M = { 'station.chartroom': 'F:/Chartroom' };

test('a served page links a project with a board to /chartroom/<folder name>/ in a new tab', () => {
    const html = V.boardLinkHtml({ root: 'F:\\ws\\proj', board: true }, true, M);
    assert.match(html, /href="\/chartroom\/proj\/"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /架構白板/);
    assert.match(V.boardLinkHtml({ root: '/home/u/my proj', board: true }, true, M), /href="\/chartroom\/my%20proj\/"/);
});

test('no link without a board, without station.chartroom, or from a static copy', () => {
    const p = { root: 'F:\\ws\\proj', board: true };
    assert.equal(V.boardLinkHtml({ root: p.root, board: false }, true, M), '');
    assert.equal(V.boardLinkHtml(p, true, {}), '');
    assert.equal(V.boardLinkHtml(p, true, null), '');
    assert.equal(V.boardLinkHtml(p, false, M), '');
});

test('the link on the served data answers 200 with the Chartroom page', async () => {
    const base = tmp('fankeel-station-board-link-');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    const root = path.resolve(path.join(base, 'proj'));
    registry.ensureLayout(root);
    fs.writeFileSync(station.boardPath(root), '');
    const chart = path.join(base, 'chartroom');
    fs.mkdirSync(path.join(chart, 'src', 'server'), { recursive: true });
    fs.writeFileSync(path.join(chart, 'package.json'), '{ "type": "module" }\n');
    fs.writeFileSync(path.join(chart, 'src', 'server', 'handler.js'), `export function createHandler(file, opts) {
    const handler = (req, res) => {
        req.resume();
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<div id="app"></div>');
    };
    handler.close = () => {};
    return handler;
}
`);
    assert.equal(profile.write(profile.machineFile(cfg), 'station.chartroom', chart).ok, true);
    const s = await serve({ configDir: cfg, roots: [root], port: 0, idleMs: 0, open: false });
    try {
        const data = await (await fetch(s.url + 'station/station-data.js')).text();
        const S = JSON.parse(data.replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
        const p = S.projects.find((x) => x.root === root);
        assert.ok(p && p.board, 'the served data says the project has a board');
        const html = V.boardLinkHtml(p, S.serve, S.profiles.machine.values);
        const href = (/href="([^"]+)"/.exec(html) || [])[1];
        assert.ok(href && href.endsWith('/'), html);
        const r = await fetch(new URL(href, s.url));
        assert.equal(r.status, 200);
        assert.match(await r.text(), /<div id="app"/);
    } finally {
        s.close();
    }
});
