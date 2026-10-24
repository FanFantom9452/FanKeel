'use strict';
// station-38/39: the routes the 文件 and 設定 modules read — the docs health
// matrix, one page's text, the quick setup's recommendations — the spec the
// detailed page's agents table draws from, and POST /profile taking the
// agent.<name>.model|effort keys that table writes. Fixture and request copied
// from tests/station-post.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const LIVE = 'aaaaaaaa-3333-4333-8333-333333333333';
const DAY = 24 * 3600e3;

function fixture() {
    const base = tmp('fankeel-station-docset-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const now = Date.now();
    const at = (ms) => new Date(ms).toISOString();
    registry.writeSession(r1, LIVE, { task: 'docs', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: at(now - 2 * DAY), updated: at(now - DAY), configDir: cfg });
    fs.mkdirSync(path.join(r1, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(r1, 'docs', 'a.md'), '# a\n\nsee [gone](gone.md)\n');
    fs.writeFileSync(path.join(r1, 'notes.js'), 'x\n');
    // Seeded so the server never runs its once-only auto-scan of this machine's drives.
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: at(now) }, null, 2) + '\n');
    return { cfg, r1 };
}

const request = (url, opts, body) => new Promise((resolve, reject) => {
    const req = http.request(url, opts, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
});

async function served(fn) {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        await fn(f, (p) => request(s.url + p, { method: 'GET' }), (body) => request(s.url + 'profile', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, body));
    } finally {
        s.close();
    }
}
const mine = (f, projects) => projects.find((x) => path.resolve(x.dir) === path.resolve(f.r1));
const form = (o) => new URLSearchParams(o).toString();

test('GET /station/docs-health lists the project with six cells; the memo holds until ?fresh=1', () => served(async (f, get) => {
    const r = await get('station/docs-health');
    assert.equal(r.status, 200);
    assert.match(r.headers['content-type'], /application\/json/);
    const body = JSON.parse(r.text);
    const p = mine(f, body.projects);
    assert.ok(p, 'the registry root is a row');
    assert.deepEqual(Object.keys(p.cells).sort(), ['broken', 'diagram', 'drift', 'index', 'landed', 'unfiled']);
    assert.ok(p.cells.broken && p.cells.broken.items.some((i) => i.tag === 'gone'));
    fs.writeFileSync(path.join(f.r1, 'docs', 'b.md'), '# b\n');
    assert.equal(mine(f, JSON.parse((await get('station/docs-health')).text).projects).files, p.files, 'inside ten minutes the memo answers');
    assert.equal(mine(f, JSON.parse((await get('station/docs-health?fresh=1')).text).projects).files, p.files + 1, '?fresh=1 reads again');
}));

test('GET /station/doc answers a tracked markdown page and 404 for anything else', () => served(async (f, get) => {
    const p = mine(f, JSON.parse((await get('station/docs-health')).text).projects);
    const doc = (pkey, rel) => get('station/doc?pkey=' + encodeURIComponent(pkey) + '&path=' + encodeURIComponent(rel));
    const ok = await doc(p.pkey, 'docs/a.md');
    assert.equal(ok.status, 200);
    assert.match(ok.headers['content-type'], /text\/markdown/);
    assert.equal(ok.text, '# a\n\nsee [gone](gone.md)\n');
    for (const bad of ['../x.md', 'notes.js', 'docs/none.md']) assert.equal((await doc(p.pkey, bad)).status, 404, bad);
    assert.equal((await doc('nobody', 'docs/a.md')).status, 404, 'an unknown pkey');
}));

test('GET /station/suggest answers a project on this page and 404 for any other directory', () => served(async (f, get) => {
    const r = await get('station/suggest?project=' + encodeURIComponent(f.r1));
    assert.equal(r.status, 200);
    const body = JSON.parse(r.text);
    assert.deepEqual(Object.keys(body.recs).sort(), ['ctx', 'floor', 'gates', 'inflight', 'lang', 'main', 'push', 'screen', 'sessions', 'where']);
    assert.equal(body.recs.main.o, 'merge');
    assert.equal((await get('station/suggest?project=' + encodeURIComponent(path.join(f.r1, 'elsewhere')))).status, 404);
}));

test('station-data.js carries profileSpec, and POST /profile writes an agent key and its agent file', () => served(async (f, get, post) => {
    const read = async () => {
        const data = await get('station/station-data.js');
        const ctx = { window: {} };
        vm.runInNewContext(data.text, ctx);
        return { nonce: /"nonce":"([^"]+)"/.exec(data.text)[1], spec: JSON.parse(JSON.stringify(ctx.window.STATION.profileSpec)) };
    };
    const { nonce, spec } = await read();
    assert.deepEqual(spec.agents.find((a) => a.name === 'fankeel-reader'), { name: 'fankeel-reader', model: 'sonnet', effort: 'medium' });
    assert.deepEqual(spec.efforts, ['low', 'medium', 'high', 'xhigh', 'max']);
    assert.ok(spec.keys['dispatch.floor']);
    assert.deepEqual(spec.set.machine, {});

    const r = await post(form({ scope: 'project', project: f.r1, key: 'agent.fankeel-reader.effort', value: 'high', nonce }));
    assert.equal(r.status, 303);
    const file = path.join(f.r1, '.claude', 'agents', 'fankeel-reader.md');
    assert.match(fs.readFileSync(file, 'utf8'), /^effort: high$/m);
    assert.equal((await post(form({ scope: 'project', project: f.r1, key: 'agent.fankeel-reader.effort', value: 'zz', nonce }))).status, 400);
    assert.equal((await post(form({ scope: 'project', project: f.r1, key: 'agent.Nope.effort', value: 'high', nonce }))).status, 400);

    const after = (await read()).spec.set.projects;
    const dir = Object.keys(after).find((k) => path.resolve(k) === path.resolve(f.r1));
    assert.deepEqual(after[dir], { 'agent.fankeel-reader.effort': 'high' });
}));
