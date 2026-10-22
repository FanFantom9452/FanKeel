'use strict';
// The phone's routes (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §4): /m with its manifest, icon and service worker, /station/mobile.json,
// the phone page's files and the 手機遠端 card's module served from
// assets/station/, and `/` through the tailnet sent to /m. The tailnet is
// faked: a fake `tailscale` run, a Host of the tailnet name, and a phone
// paired straight through lib/remote.js against the station's configDir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const remote = require('../lib/remote.js');
const mobile = require('../lib/mobile.js');
const { pendingPath } = require('../lib/handoff.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const NAME = 'ymlab-pc.tail1234.ts.net';
const ONE = 'ffffffff-8888-4888-8888-888888888881';
const TWO = 'ffffffff-8888-4888-8888-888888888882';
const Q = [{ question: '核准這份 design？', header: 'design', multiSelect: false,
    options: [{ label: '核准，進 plan (Recommended)', description: 'a' }, { label: '暫停', description: 'b' }] }];

// Two live sessions in one registry, each with a gate hooks/gate.js is
// holding for the station, and `station.remote` on in the machine profile
// when `on`.
function fixture(on) {
    const base = tmp('fankeel-station-mobile-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const held = (id, stage, started, at) => {
        const data = { task: '手機版測站 ' + stage, stage, route: ['survey', 'design', 'plan'], active: true, claims: [],
            started, updated: new Date().toISOString(), configDir: cfg };
        registry.writeSession(r1, id, data);
        const file = pendingPath(r1, data, stage);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ questions: Q, at, until: Date.now() + 300e3 }));
    };
    held(ONE, 'design', '2026-10-21T08:00:00.000Z', Date.now() - 60e3);
    held(TWO, 'survey', '2026-10-21T08:30:00.000Z', Date.now() - 30e3);
    // Both run as this test's process, so each is a live task row as well as a held gate.
    for (const id of [ONE, TWO]) fs.writeFileSync(path.join(cfg, 'sessions', id + '.json'), JSON.stringify({ pid: process.pid, sessionId: id, cwd: r1, startedAt: Date.now() }));
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-10-21T08:00:00.000Z' }) + '\n');
    if (on) assert.equal(profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok, true);
    return { cfg, r1 };
}

// A fake tailscale CLI: Running with this machine's MagicDNS name, no serve
// config until `serve --bg <port>` makes one.
function fakeTailscale() {
    let proxy = null;
    return (args) => {
        const a = args.join(' ');
        if (a === 'status --json') return { status: 0, stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: NAME + '.' } }), stderr: '' };
        if (a === 'serve status --json') return { status: 0, stdout: proxy ? JSON.stringify({ Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: proxy } } } } }) : '{}', stderr: '' };
        const bg = /^serve --bg (\d+)$/.exec(a);
        if (bg) {
            proxy = 'http://127.0.0.1:' + bg[1];
            return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + a };
    };
}

// A GET to the station with the headers given; with none, node's own Host
// (127.0.0.1:<port>) is this machine's.
const get = (port, pathname, headers) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method: 'GET', headers: headers || {} }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    req.end();
});

async function served(on, f) {
    const fx = fixture(on);
    const s = await serve({ configDir: fx.cfg, port: 0, idleMs: 60e3, open: false, tailscaleRun: fakeTailscale() });
    try {
        await f(Object.assign({ port: Number(new URL(s.url).port) }, fx));
    } finally {
        s.close();
    }
}
const TAILNET = { host: NAME };
// A phone paired the way POST /station/remote/pair pairs one, as its cookie.
function phone(cfg) {
    const now = Date.now();
    const got = remote.pair(cfg, remote.newCode(cfg, now).value, 'S24', now);
    assert.equal(got.ok, true);
    return { host: NAME, cookie: 'fk_device=' + got.token };
}
const file = (name) => fs.readFileSync(path.join(ASSETS, name), 'utf8');

test('through the tailnet `/` goes to /m; from this machine it is still the desktop page', () => served(true, async (s) => {
    const away = await get(s.port, '/', TAILNET);
    assert.equal(away.status, 303);
    assert.equal(away.headers.location, '/m');
    const home = await get(s.port, '/');
    assert.equal(home.status, 200);
    assert.ok(home.text.includes('station/station.js'));
}));

test('/m is lib/mobile.js\'s shell, open through the tailnet without a phone paired', () => served(true, async (s) => {
    const page = await get(s.port, '/m', TAILNET);
    assert.equal(page.status, 200);
    assert.match(page.headers['content-type'], /^text\/html/);
    assert.equal(page.text, mobile.shell());
    assert.ok(page.text.includes('/station/mobile.js'));
}));

test('the manifest, the icon and the service worker that make it installable', () => served(true, async (s) => {
    const man = await get(s.port, '/m/manifest.webmanifest', TAILNET);
    assert.equal(man.status, 200);
    assert.equal(man.headers['content-type'], 'application/manifest+json');
    assert.equal(man.text, mobile.manifest());
    assert.equal(JSON.parse(man.text).start_url, '/m');
    const icon = await get(s.port, '/m/icon.svg', TAILNET);
    assert.equal(icon.status, 200);
    assert.equal(icon.headers['content-type'], 'image/svg+xml');
    assert.equal(icon.text, mobile.icon());
    const sw = await get(s.port, '/sw.js', TAILNET);
    assert.equal(sw.status, 200);
    assert.match(sw.headers['content-type'], /^text\/javascript/);
    assert.equal(sw.headers['service-worker-allowed'], '/');
    assert.equal(sw.text, file('sw.js'));
}));

test('the phone page\'s files and the card\'s module are served byte for byte; the card\'s needs a phone through the tailnet', () => served(true, async (s) => {
    for (const [name, type] of [['mobile.js', /^text\/javascript/], ['mobile.css', /^text\/css/]]) {
        const res = await get(s.port, '/station/' + name, TAILNET);
        assert.equal(res.status, 200, name);
        assert.match(res.headers['content-type'], type, name);
        assert.equal(res.text, file(name), name);
    }
    const card = await get(s.port, '/station/remote-card.js');
    assert.equal(card.status, 200);
    assert.equal(card.text, file('remote-card.js'));
    assert.equal((await get(s.port, '/station/remote-card.js', TAILNET)).status, 401);
    assert.equal((await get(s.port, '/station/not-a-module.js')).status, 404, 'STATIC is still a list');
}));

test('/station/mobile.json needs a paired phone through the tailnet, and names the machine by its tailnet name', () => served(true, async (s) => {
    assert.equal((await get(s.port, '/station/mobile.json', TAILNET)).status, 401);
    const res = await get(s.port, '/station/mobile.json', phone(s.cfg));
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/json');
    assert.equal(res.headers['cache-control'], 'no-store');
    const body = JSON.parse(res.text);
    assert.equal(body.host, 'ymlab-pc');
    assert.deepEqual(body.gates.map((g) => g.id), [ONE, TWO], 'oldest first');
    assert.deepEqual(body.gates[0].questions, Q);
}));

test('with remote off, /station/mobile.json from this machine names it by its hostname', () => served(false, async (s) => {
    const res = await get(s.port, '/station/mobile.json');
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.text).host, os.hostname());
}));

test('the phone home draws one 等你答 chip for each gate /station/mobile.json holds', () => served(true, async (s) => {
    const json = JSON.parse((await get(s.port, '/station/mobile.json', phone(s.cfg))).text);
    assert.deepEqual(json.gates.map((g) => g.id), [ONE, TWO]);
    const P = require('../assets/station/mobile.js');
    const html = P.screen(json, P.parseRoute('#/'), json.at, { mode: 'app' });
    assert.equal((html.match(/<span class="st ask">/g) || []).length, json.gates.length);
}));
