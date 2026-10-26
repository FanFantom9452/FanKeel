'use strict';
// The station's /chartroom/<project>/ route (station-chartroom-vendored-1):
// a project's architecture board drawn read-only by the render code vendored
// under lib/chartroom/ (lib/board.js `boardPage`) — no Chartroom install and
// no profile key. The route still answers before the nonce check, so a POST
// under it is the board's own 405, not the station's 403.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const profile = require('../lib/profile.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const BOARD = [
    '{"chartroom":1,"title":"Flow","root":"main"}',
    '{"view":"main","title":"Flow","dir":"LR"}',
    '{"node":"a","in":"main","label":"Input"}',
    '{"node":"b","in":"main","label":"Output"}',
    '{"edge":"e1","in":"main","from":"a","to":"b","label":"data","arrow":"end"}',
].join('\n') + '\n';

// One registry root per name, each under the scratch directory; a name with
// a slash puts two roots of the same folder name in different parents.
// `boards` names the roots that get `.fankeel/architecture.board`.
function fixture(names, boards, text) {
    const base = tmp('fankeel-station-chartroom-');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    const roots = {};
    for (const n of names) {
        const r = path.join(base, ...n.split('/'));
        registry.ensureLayout(r);
        if (boards.includes(n)) fs.writeFileSync(station.boardPath(r), text === undefined ? BOARD : text);
        roots[n] = path.resolve(r);
    }
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'),
        JSON.stringify(Object.fromEntries(Object.values(roots).map((r) => [r, new Date().toISOString()])), null, 2) + '\n');
    return { base, cfg, roots };
}

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

test('the page and its drawing come from the vendored code, with no Chartroom install and no profile key', async () => {
    const f = fixture(['proj'], ['proj']);
    const s = await start(f);
    try {
        const page = await fetch(s.url + 'chartroom/proj/');
        assert.equal(page.status, 200);
        assert.match(await page.text(), /<img src="board\.svg"/);
        const svg = await fetch(s.url + 'chartroom/proj/board.svg');
        assert.equal(svg.status, 200);
        assert.match(svg.headers.get('content-type'), /^image\/svg\+xml/);
        assert.match(await svg.text(), /<svg[\s>]/);
        const bare = await fetch(s.url + 'chartroom/proj');
        assert.equal(bare.status, 200, 'no trailing slash is sent on to the page');
        assert.ok(bare.url.endsWith('/chartroom/proj/'), bare.url);
    } finally {
        s.close();
    }
});

test('a station.chartroom left in an old machine profile changes nothing', async () => {
    const f = fixture(['proj'], ['proj']);
    const file = profile.machineFile(f.cfg);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ 'station.chartroom': path.join(f.base, 'nowhere') }) + '\n');
    const s = await start(f);
    try {
        assert.equal((await fetch(s.url + 'chartroom/proj/board.svg')).status, 200);
    } finally {
        s.close();
    }
});

test('a POST under /chartroom/ is the board\'s 405, while the station\'s own POST still needs the nonce', async () => {
    const f = fixture(['proj'], ['proj']);
    const s = await start(f);
    try {
        const r = await fetch(s.url + 'chartroom/proj/api/ops', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"ops":[]}',
        });
        assert.equal(r.status, 405);
        const own = await fetch(s.url + 'todo', {
            method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'text=x',
        });
        assert.equal(own.status, 403, 'every other POST still carries the nonce');
    } finally {
        s.close();
    }
});

test('an unknown project and a root with no board are 404', async () => {
    const f = fixture(['proj', 'bare'], ['proj']);
    const s = await start(f);
    try {
        assert.equal((await fetch(s.url + 'chartroom/nope/')).status, 404);
        const bare = await fetch(s.url + 'chartroom/bare/');
        assert.equal(bare.status, 404);
        assert.ok((await bare.text()).includes(station.boardPath(f.roots.bare)), 'says where the board belongs');
    } finally {
        s.close();
    }
});

test('two registered roots with the same folder name are a 409 naming both', async () => {
    const f = fixture(['a/twin', 'b/twin'], ['a/twin', 'b/twin']);
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

test('a board that does not parse is a 422, and the station keeps serving', async () => {
    const f = fixture(['proj'], ['proj'], 'not json\n');
    const s = await start(f);
    try {
        assert.equal((await fetch(s.url + 'chartroom/proj/board.svg')).status, 422);
        assert.equal((await fetch(s.url + 'station/health')).status, 200);
    } finally {
        s.close();
    }
});
