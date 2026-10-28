'use strict';
// Task 2 of docs/90-agent/plans/2026-10-29-mobile-sources.md, through the server: this station
// pairs with another one the way a phone does, reads its rows with that token, and a refused
// token marks that computer off rather than failing the page. `tailscaleRun`, `probeGet` and
// `peerSend` are fakes: no test reaches the real tailscale or the network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const profile = require('../lib/profile.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SELF = 'me.t.ts.net';
const LAB = 'lab.t.ts.net';
const TOKEN = 'T'.repeat(43);
const STATUS = { BackendState: 'Running', Self: { DNSName: SELF + '.' }, Peer: { a: { DNSName: LAB + '.', Online: true } } };
function fake() {
    let proxy = null;
    return (args) => {
        const a = args.join(' ');
        if (a === 'status --json') return { status: 0, stdout: JSON.stringify(STATUS), stderr: '' };
        if (a === 'serve status --json') return { status: 0, stdout: proxy ? JSON.stringify({ Web: { [SELF + ':443']: { Handlers: { '/': { Proxy: proxy } } } } }) : '{}', stderr: '' };
        const bg = /^serve --bg (\d+)$/.exec(a);
        if (bg) { proxy = 'http://127.0.0.1:' + bg[1]; return { status: 0, stdout: '', stderr: '' }; }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + a };
    };
}
const probeGet = async (url) => (url.includes(LAB) ? { status: 401 } : { status: 200 });
const LAB_BODY = { host: 'lab', at: 1, gates: [], stopped: [], done: [], tasks: [], rc: { live: [], ended: [] },
    unregistered: [{ id: 'dddd', cwd: 'D:/lab', entrypoint: 'cli', name: 'lab job', status: 'idle', bridge: false, started: 1, machine: 'lab' }] };
const SEED = [{ dnsName: LAB, name: 'lab', token: TOKEN, paired: 1, seen: null, last: null }];

const get = (port, p) => new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: p }, (res) => {
        let t = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { t += c; });
        res.on('end', () => resolve({ status: res.statusCode, text: t }));
    }).on('error', reject);
});
const post = (port, p, body) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: p, method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, (res) => {
        let t = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { t += c; });
        res.on('end', () => resolve({ status: res.statusCode, text: t }));
    });
    req.on('error', reject);
    req.end(body);
});
const mobileJson = async (port, q) => JSON.parse((await get(port, '/station/mobile.json' + (q || ''))).text);
const until = async (fn) => { for (let i = 0; i < 160; i++) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 25)); } return null; };
const was = process.cwd();
test.after(() => process.chdir(was));

async function booted(peerSend, f, seed) {
    const base = tmp('fankeel-station-peers-');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    assert.equal(profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok, true);
    if (seed) fs.writeFileSync(path.join(cfg, 'fankeel', 'peers.json'), JSON.stringify({ peers: seed }) + '\n');
    process.chdir(base);
    const s = await serve({ configDir: cfg, port: 0, idleMs: 60e3, open: false, tailscaleRun: fake(), probeGet, peerSend });
    try { await f(Number(new URL(s.url).port), cfg); } finally { s.close(); }
}
const nonceOf = async (port) => JSON.parse((await get(port, '/station/station-data.js')).text.replace(/^window\.STATION = /, '').replace(/;\n$/, '')).nonce;

test('pairing: the code goes to that computer\'s own pairing route with its Origin, its token is kept and read with', async () => {
    const calls = [];
    const peerSend = async (o) => {
        calls.push(o);
        if (o.url === 'https://' + LAB + '/station/remote/pair') return { status: 201, headers: { 'set-cookie': ['fk_device=' + TOKEN + '; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict'] }, body: Buffer.from('{}') };
        return { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify(LAB_BODY)) };
    };
    await booted(peerSend, async (port, cfg) => {
        assert.ok(await until(async () => (await mobileJson(port)).machines.some((x) => x.name === 'lab' && x.state === 'unpaired')), 'lab is listed unpaired');
        const r = await post(port, '/station/peers/pair', new URLSearchParams({ nonce: await nonceOf(port), dnsName: LAB, code: 'ABCD2345' }).toString());
        assert.equal(r.status, 201, r.text);
        const pairCall = calls.find((c) => c.url.endsWith('/station/remote/pair'));
        assert.equal(pairCall.method, 'POST');
        assert.equal(pairCall.headers.origin, 'https://' + LAB);
        assert.equal(new URLSearchParams(String(pairCall.body)).get('name'), '電腦 me');
        const kept = JSON.parse(fs.readFileSync(path.join(cfg, 'fankeel', 'peers.json'), 'utf8')).peers;
        assert.deepEqual(kept.map((p) => [p.dnsName, p.name, p.token]), [[LAB, 'lab', TOKEN]]);
        const m = await until(async () => { const j = await mobileJson(port); return j.unregistered.some((x) => x.machine === 'lab') ? j : null; });
        assert.ok(m, 'lab\'s rows arrive');
        assert.deepEqual(m.machines.map((x) => [x.name, x.state]), [['me', 'on'], ['lab', 'on']]);
        assert.equal(calls.find((c) => c.url === 'https://' + LAB + '/station/mobile.json?own=1').headers.cookie, 'fk_device=' + TOKEN);
    });
});

test('pairing refuses a name the tailnet does not list as a station', () => booted(async () => { throw new Error('never sent'); }, async (port) => {
    await mobileJson(port);
    const r = await post(port, '/station/peers/pair', new URLSearchParams({ nonce: await nonceOf(port), dnsName: 'evil.example.com', code: 'ABCD2345' }).toString());
    assert.equal(r.status, 404);
}));

test('a refused token marks that computer off and refused, and the page still answers', () => booted(async () => ({ status: 401, headers: {}, body: Buffer.from('pair this phone first') }), async (port) => {
    const m = await until(async () => {
        const r = await get(port, '/station/mobile.json');
        assert.equal(r.status, 200);
        const j = JSON.parse(r.text);
        const lab = j.machines.find((x) => x.name === 'lab');
        return lab && lab.state === 'off' ? j : null;
    });
    assert.ok(m, 'lab goes off');
    assert.equal(m.machines.find((x) => x.name === 'lab').refused, true);
    assert.deepEqual(m.unregistered.filter((x) => x.machine === 'lab'), []);
}, SEED));

test('mobile.json?own=1 is this machine alone: no other computer is read for it', async () => {
    let n = 0;
    await booted(async () => { n++; return { status: 200, headers: {}, body: Buffer.from(JSON.stringify(LAB_BODY)) }; }, async (port) => {
        const j = await mobileJson(port, '?own=1');
        await new Promise((r) => setTimeout(r, 150));
        assert.deepEqual(j.machines.map((x) => x.name), ['me']);
        assert.deepEqual(j.others, []);
        assert.equal(n, 0);
    }, SEED);
});
