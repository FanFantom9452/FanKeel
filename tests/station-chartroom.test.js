'use strict';
// The station's /chartroom/<project>/ route: a project's architecture board,
// handed to Chartroom's own handler before the nonce
// (docs/90-agent/plans/2026-10-08-station-chartroom-design.md §1-§3, §6).
// Chartroom here is a fake package in a scratch directory: an ESM
// src/server/handler.js whose createHandler records every url it is handed
// and every close(), in globalThis.__chartroom.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const profile = require('../lib/profile.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

function fakeChartroom(base) {
    const dir = path.join(base, 'chartroom');
    fs.mkdirSync(path.join(dir, 'src', 'server'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{ "type": "module" }\n');
    fs.writeFileSync(path.join(dir, 'src', 'server', 'handler.js'), `export function createHandler(file, opts) {
    const rec = { file, opts, urls: [], closed: 0 };
    (globalThis.__chartroom ||= []).push(rec);
    const handler = (req, res) => {
        rec.urls.push(req.method + ' ' + req.url);
        req.resume();
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<div id="app"></div>');
    };
    handler.close = () => { rec.closed += 1; };
    return handler;
}
`);
    return dir;
}

// One registry root per name, each under the scratch directory; a name with
// a slash puts two roots of the same folder name in different parents.
// `boards` names the roots that get `.fankeel/architecture.board`.
function fixture(names, boards) {
    globalThis.__chartroom = [];
    const base = tmp('fankeel-station-chartroom-');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    const roots = {};
    for (const n of names) {
        const r = path.join(base, ...n.split('/'));
        registry.ensureLayout(r);
        if (boards.includes(n)) fs.writeFileSync(station.boardPath(r), '');
        roots[n] = path.resolve(r);
    }
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'),
        JSON.stringify(Object.fromEntries(Object.values(roots).map((r) => [r, new Date().toISOString()])), null, 2) + '\n');
    return { base, cfg, roots };
}

const setChartroom = (cfg, dir) => assert.equal(profile.write(profile.machineFile(cfg), 'station.chartroom', dir).ok, true);
const start = (f) => serve({ configDir: f.cfg, roots: Object.values(f.roots), port: 0, idleMs: 0, open: false });

test('boardPath is the root\'s .fankeel/architecture.board, and gather and serialize carry board', () => {
    const f = fixture(['proj', 'other'], ['proj']);
    assert.equal(station.boardPath(f.roots.proj), path.join(f.roots.proj, '.fankeel', 'architecture.board'));
    const model = station.gather({ configDir: f.cfg, roots: Object.values(f.roots), details: false });
    const byRoot = Object.fromEntries(model.registries.map((r) => [r.root, r]));
    assert.equal(byRoot[f.roots.proj].board, true);
    assert.equal(byRoot[f.roots.other].board, false);
    const S = JSON.parse(station.serialize(model).replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    const projects = Object.fromEntries(S.projects.map((p) => [p.root, p]));
    assert.equal(projects[f.roots.proj].board, true);
    assert.equal(projects[f.roots.other].board, false);
});

test('the prefix is stripped before Chartroom sees the url, and its handler is built once on the board file', async () => {
    const f = fixture(['proj'], ['proj']);
    setChartroom(f.cfg, fakeChartroom(f.base));
    const s = await start(f);
    try {
        for (const p of ['chartroom/proj/', 'chartroom/proj/assets/app.js?v=1', 'chartroom/proj']) {
            const r = await fetch(s.url + p);
            assert.equal(r.status, 200, p);
            assert.match(await r.text(), /<div id="app"/);
        }
        assert.equal(globalThis.__chartroom.length, 1, 'one handler for the project, built on its first request');
        const rec = globalThis.__chartroom[0];
        assert.deepEqual(rec.urls, ['GET /', 'GET /assets/app.js?v=1', 'GET /']);
        assert.equal(rec.file, station.boardPath(f.roots.proj));
        assert.equal(rec.opts.staticDir, 'dist/app');
    } finally {
        s.close();
    }
});

test('a POST under /chartroom/ reaches Chartroom without the nonce, while the station\'s own POST still needs it', async () => {
    const f = fixture(['proj'], ['proj']);
    setChartroom(f.cfg, fakeChartroom(f.base));
    const s = await start(f);
    try {
        const r = await fetch(s.url + 'chartroom/proj/api/ops', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"ops":[]}',
        });
        assert.equal(r.status, 200);
        assert.deepEqual(globalThis.__chartroom[0].urls, ['POST /api/ops']);
        const own = await fetch(s.url + 'todo', {
            method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'text=x',
        });
        assert.equal(own.status, 403, 'every other POST still carries the nonce');
    } finally {
        s.close();
    }
});

test('unset station.chartroom, an unknown project and a root with no board are all 404', async () => {
    const f = fixture(['proj', 'bare'], ['proj']);
    let s = await start(f);
    try {
        const r = await fetch(s.url + 'chartroom/proj/');
        assert.equal(r.status, 404, 'unset: the station\'s own 404');
        assert.equal(await r.text(), 'not here\n');
    } finally {
        s.close();
    }
    setChartroom(f.cfg, fakeChartroom(f.base));
    s = await start(f);
    try {
        assert.equal((await fetch(s.url + 'chartroom/nope/')).status, 404);
        const bare = await fetch(s.url + 'chartroom/bare/');
        assert.equal(bare.status, 404);
        assert.ok((await bare.text()).includes(station.boardPath(f.roots.bare)), 'says where the board belongs');
        assert.equal(globalThis.__chartroom.length, 0, 'no handler built for either');
    } finally {
        s.close();
    }
});

test('two registered roots with the same folder name are a 409 naming both', async () => {
    const f = fixture(['a/twin', 'b/twin'], ['a/twin', 'b/twin']);
    setChartroom(f.cfg, fakeChartroom(f.base));
    const s = await start(f);
    try {
        const r = await fetch(s.url + 'chartroom/twin/');
        assert.equal(r.status, 409);
        const text = await r.text();
        assert.ok(text.includes(f.roots['a/twin']) && text.includes(f.roots['b/twin']), text);
    } finally {
        s.close();
    }
});

test('a Chartroom path with no handler.js is a 500 naming it, and the station keeps serving', async () => {
    const f = fixture(['proj'], ['proj']);
    const empty = path.join(f.base, 'not-chartroom');
    fs.mkdirSync(empty);
    setChartroom(f.cfg, empty);
    const s = await start(f);
    try {
        const r = await fetch(s.url + 'chartroom/proj/');
        assert.equal(r.status, 500);
        assert.ok((await r.text()).includes(path.join(empty, 'src', 'server', 'handler.js')));
        assert.equal((await fetch(s.url + 'station/health')).status, 200);
    } finally {
        s.close();
    }
});

test('close() closes every handler it built, once each', async () => {
    const f = fixture(['proj', 'other'], ['proj', 'other']);
    setChartroom(f.cfg, fakeChartroom(f.base));
    const s = await start(f);
    assert.equal((await fetch(s.url + 'chartroom/proj/')).status, 200);
    assert.equal((await fetch(s.url + 'chartroom/other/')).status, 200);
    s.close();
    assert.deepEqual(globalThis.__chartroom.map((r) => r.closed), [1, 1]);
});
