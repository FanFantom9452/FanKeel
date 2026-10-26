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

// entry-2: the 409 test failed once in a full-suite run with only `fetch
// failed` — undici keeps the code (ECONNRESET, UND_ERR_SOCKET, ECONNREFUSED)
// and the socket's ports on `cause`, which the TAP never showed. `get` puts the
// whole chain, the port, whether an earlier test in this file was served on
// that same port, and how long it took into the error. `connection: close`
// keeps every request on a socket of its own, so none can ride a keep-alive
// socket undici pooled for an earlier server that has since closed on a port
// the operating system handed out again.
const ports = new Set();
function served(s) {
    const port = new URL(s.url).port;
    ports.add(port);
    return s;
}
async function get(url, init) {
    const at = Date.now();
    try {
        return await fetch(url, Object.assign({}, init, { headers: Object.assign({ connection: 'close' }, init && init.headers) }));
    } catch (e) {
        const chain = [];
        for (let c = e; c && chain.length < 6; c = c.cause) {
            chain.push([c.name, c.code, c.message, c.socket && JSON.stringify(c.socket)].filter(Boolean).join(' '));
        }
        const port = new URL(url).port;
        throw new Error('fetch ' + url + ' failed after ' + (Date.now() - at) + ' ms; port ' + port
            + (ports.has(port) ? ' (served earlier in this file)' : '') + ': ' + chain.join(' <- '), { cause: e });
    }
}

// Root cause of the entry-2 red (reproduced under load, 4045): `port: 0` hands
// out whatever port the operating system likes, and fetch refuses the WHATWG
// "bad ports" (4045, 5060, 6000, 6665-6669, 10080 ...) before it connects, with
// only `fetch failed <- bad port`. A server that landed on one is closed and
// another is asked for.
async function refused(url) {
    try {
        await fetch(url, { headers: { connection: 'close' } });
    } catch (e) {
        return Boolean(e.cause) && e.cause.message === 'bad port';
    }
    return false;
}
async function start(f, open = serve) {
    for (let tries = 0; ; tries++) {
        const s = await open({ configDir: f.cfg, roots: Object.values(f.roots), port: 0, idleMs: 0, open: false });
        if (tries < 50 && await refused(s.url)) {
            s.close();
            continue;
        }
        return served(s);
    }
}

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
        const page = await get(s.url + 'chartroom/proj/');
        assert.equal(page.status, 200);
        assert.match(await page.text(), /<img src="board\.svg"/);
        const svg = await get(s.url + 'chartroom/proj/board.svg');
        assert.equal(svg.status, 200);
        assert.match(svg.headers.get('content-type'), /^image\/svg\+xml/);
        assert.match(await svg.text(), /<svg[\s>]/);
        const bare = await get(s.url + 'chartroom/proj');
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
        assert.equal((await get(s.url + 'chartroom/proj/board.svg')).status, 200);
    } finally {
        s.close();
    }
});

test('a POST under /chartroom/ is the board\'s 405, while the station\'s own POST still needs the nonce', async () => {
    const f = fixture(['proj'], ['proj']);
    const s = await start(f);
    try {
        const r = await get(s.url + 'chartroom/proj/api/ops', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"ops":[]}',
        });
        assert.equal(r.status, 405);
        const own = await get(s.url + 'todo', {
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
        assert.equal((await get(s.url + 'chartroom/nope/')).status, 404);
        const bare = await get(s.url + 'chartroom/bare/');
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
        const r = await get(s.url + 'chartroom/twin/');
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
        assert.equal((await get(s.url + 'chartroom/proj/board.svg')).status, 422);
        assert.equal((await get(s.url + 'station/health')).status, 200);
    } finally {
        s.close();
    }
});

test('/chartroom/<name>?x=1 is sent on to /chartroom/<name>/?x=1', async () => {
    const f = fixture(['proj'], ['proj']);
    const s = await start(f);
    try {
        const r = await get(s.url + 'chartroom/proj?x=1', { redirect: 'manual' });
        assert.equal(r.status, 303);
        const to = new URL(r.headers.get('location'), s.url);
        assert.equal(to.pathname + to.search, '/chartroom/proj/?x=1');
    } finally {
        s.close();
    }
});

test('fetch refuses some ports outright, and start never hands one back', async () => {
    await assert.rejects(fetch('http://127.0.0.1:4045/'), (e) => e.cause && e.cause.message === 'bad port');
    const f = fixture(['proj'], ['proj']);
    const closed = [];
    const offered = [];
    const make = async (opts) => {
        const s = await serve(opts);
        if (offered.length) return s;
        offered.push(s.url);
        return { url: 'http://127.0.0.1:4045/', close: () => { closed.push(s.url); s.close(); } };
    };
    const s = await start(f, make);
    try {
        assert.equal(closed.length, 1, 'the server on the refused port is closed');
        assert.notEqual(new URL(s.url).port, '4045');
        assert.equal((await get(s.url + 'station/health')).status, 200);
    } finally {
        s.close();
    }
});

test('a failed get names the port, the cause chain, and whether the port was served earlier in this file', async () => {
    const f = fixture(['proj'], ['proj']);
    const s = await start(f);
    const url = s.url;
    s.close();
    await assert.rejects(get(url + 'station/health'), (e) => {
        const port = new URL(url).port;
        assert.match(e.message, new RegExp('port ' + port + ' \\(served earlier in this file\\)'), e.message);
        assert.match(e.message, /ECONNREFUSED/, e.message);
        assert.match(e.message, / ms; /, e.message);
        assert.ok(e.cause, 'the original error rides on cause');
        return true;
    });
    await assert.rejects(get('http://127.0.0.1:1/'), (e) => !/served earlier/.test(e.message));
});
