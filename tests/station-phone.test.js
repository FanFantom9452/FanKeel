'use strict';
// The phone's routes on the station (docs/99-archive/2026-10-22-mobile-session-design.md
// §4): one session's conversation at /station/phone.json and the phone's three
// actions, /phone/attach, /phone/detach and /phone/say, behind a paired device's
// cookie like /answer. `tailscaleRun` is faked: no test runs the real tailscale.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const remote = require('../lib/remote.js');
const phone = require('../lib/phone.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const NAME = 'station.example.invalid';
const SID = 'ffffffff-9999-4999-8999-000000000001';
const TAILNET = { host: NAME, origin: 'https://' + NAME };

function fixture() {
    const base = tmp('fankeel-station-phone-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    registry.writeSession(r1, SID, { task: 't', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: '2026-10-22T08:00:00.000Z', updated: new Date().toISOString(), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({ pid: process.pid, sessionId: SID, cwd: r1, startedAt: Date.now() }));
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-10-22T08:00:00.000Z' }) + '\n');
    fs.writeFileSync(profile.machineFile(cfg), JSON.stringify({ 'station.remote': true }) + '\n');
    const now = Date.now();
    const paired = remote.pair(cfg, remote.newCode(cfg, now).value, 'S24', now);
    return { cfg, r1, cookie: 'fk_device=' + paired.token };
}

// tailscale's CLI as lib/tailscale.js calls it: this machine's MagicDNS name
// in `status`, no serve config until `serve --bg <port>`.
function fakeTailscale() {
    let config = {};
    const run = (args) => {
        if (args[0] === 'status') return { status: 0, stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: NAME + '.' } }), stderr: '' };
        if (args[0] === 'serve' && args[1] === 'status') return { status: 0, stdout: JSON.stringify(config), stderr: '' };
        if (args[0] === 'serve' && args[1] === '--bg') {
            config = { TCP: { 443: { HTTPS: true } }, Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:' + args[2] } } } } };
            return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + args.join(' ') };
    };
    return { run };
}

const request = (url, o) => new Promise((resolve, reject) => {
    const opts = o || {};
    const post = opts.body !== undefined;
    const headers = Object.assign(post ? { 'content-type': 'application/x-www-form-urlencoded' } : {}, opts.headers);
    const req = http.request(url, { method: post ? 'POST' : 'GET', headers }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text, headers: res.headers }));
    });
    req.on('error', reject);
    if (post) req.write(opts.body);
    req.end();
});
const form = (o) => new URLSearchParams(o).toString();
const start = (f, ts) => serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false, tailscaleRun: ts.run });

test('a paired phone attaches, says, is refused a second message, and detaches', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    const as = (cookie) => Object.assign({ cookie }, TAILNET);
    const body = (o) => form(Object.assign({ root: f.r1, id: SID }, o));
    try {
        assert.equal((await request(s.url + 'phone/say', { headers: TAILNET, body: body({ text: 'x' }) })).status, 401);
        assert.equal((await request(s.url + 'phone/say', { headers: as(f.cookie), body: body({ text: 'x' }) })).status, 409);
        assert.equal((await request(s.url + 'phone/attach', { headers: as(f.cookie), body: body({}) })).status, 201);
        assert.equal(phone.dirOf(f.r1, SID) && fs.existsSync(path.join(phone.dirOf(f.r1, SID), 'attach.json')), true);
        assert.equal((await request(s.url + 'phone/say', { headers: as(f.cookie), body: body({ text: '跑吧' }) })).status, 201);
        assert.equal(JSON.parse(fs.readFileSync(path.join(phone.dirOf(f.r1, SID), 'inbox.json'), 'utf8')).text, '跑吧');
        assert.equal((await request(s.url + 'phone/say', { headers: as(f.cookie), body: body({ text: 'more' }) })).status, 409);
        const got = JSON.parse((await request(s.url + 'station/phone.json?id=' + SID, { headers: as(f.cookie) })).text);
        assert.equal(got.attached, true);
        assert.equal(got.waiting.text, '跑吧');
        phone.append(f.r1, SID, { role: 'assistant', text: 'started', at: Date.now() });
        phone.writeBackground(f.r1, SID, [{ id: 'b1', type: 'shell', status: 'running', description: 'build', command: 'npm run build' }], Date.now());
        const m = JSON.parse((await request(s.url + 'station/mobile.json', { headers: as(f.cookie) })).text);
        assert.equal(m.tasks[0].state, 'background');
        assert.equal(m.tasks[0].background.length, 1);
        assert.equal((await request(s.url + 'station/phone.json?id=eeeeeeee-0000-4000-8000-000000000000', { headers: as(f.cookie) })).status, 404);
        assert.equal((await request(s.url + 'phone/detach', { headers: as(f.cookie), body: body({}) })).status, 200);
        assert.equal(phone.isAttached(f.r1, SID), false);
    } finally {
        s.close();
    }
});

test('attach refuses a session that is not running', async () => {
    const f = fixture();
    // A registry row with no Claude Code process behind it: on the station, not live.
    const idle = 'ffffffff-9999-4999-8999-000000000002';
    registry.writeSession(f.r1, idle, { task: 't2', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: '2026-10-22T08:00:00.000Z', updated: new Date().toISOString(), configDir: f.cfg });
    const s = await start(f, fakeTailscale());
    try {
        const r = await request(s.url + 'phone/attach', { headers: Object.assign({ cookie: f.cookie }, TAILNET), body: form({ root: f.r1, id: idle }) });
        assert.equal(r.status, 409);
        assert.equal(phone.isAttached(f.r1, idle), false);
    } finally {
        s.close();
    }
});

test('say refuses empty text and text over SAY_MAX with 400', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    const headers = Object.assign({ cookie: f.cookie }, TAILNET);
    const say = (text) => request(s.url + 'phone/say', { headers, body: form({ root: f.r1, id: SID, text }) });
    try {
        assert.equal((await request(s.url + 'phone/attach', { headers, body: form({ root: f.r1, id: SID }) })).status, 201);
        assert.equal((await say('   ')).status, 400);
        assert.equal((await say('x'.repeat(phone.SAY_MAX + 1))).status, 400);
        assert.equal(fs.existsSync(path.join(phone.dirOf(f.r1, SID), 'inbox.json')), false);
        assert.equal((await say('x'.repeat(phone.SAY_MAX))).status, 201);
    } finally {
        s.close();
    }
});

test('POST /phone/upload saves an image under the session and answers its path', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    const as = (cookie) => Object.assign({ cookie }, TAILNET);
    try {
        const q = '?root=' + encodeURIComponent(f.r1) + '&id=' + SID + '&ext=png';
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
        assert.equal((await request(s.url + 'phone/upload' + q, { headers: Object.assign({ 'content-type': 'image/png' }, TAILNET), body: png })).status, 401);
        const r = await request(s.url + 'phone/upload' + q, { headers: Object.assign({ 'content-type': 'image/png' }, as(f.cookie)), body: png });
        assert.equal(r.status, 201);
        const saved = r.text.trim();
        assert.ok(path.isAbsolute(saved) && saved.endsWith('.png'), saved);
        assert.deepEqual(fs.readFileSync(saved), png);
        assert.equal((await request(s.url + 'phone/upload' + q, { headers: Object.assign({ 'content-type': 'text/plain' }, as(f.cookie)), body: Buffer.from('x') })).status, 415);
        assert.equal((await request(s.url + 'phone/upload?root=' + encodeURIComponent(f.r1) + '&id=nope&ext=png', { headers: Object.assign({ 'content-type': 'image/png' }, as(f.cookie)), body: png })).status, 404);
    } finally {
        s.close();
    }
});

test('upload refuses a loopback caller with a missing or wrong nonce, takes the right one', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    try {
        const q = '?root=' + encodeURIComponent(f.r1) + '&id=' + SID + '&ext=png';
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
        const headers = { 'content-type': 'image/png' };
        assert.equal((await request(s.url + 'phone/upload' + q, { headers, body: png })).status, 403);
        assert.equal((await request(s.url + 'phone/upload' + q + '&nonce=wrong', { headers, body: png })).status, 403);
        const data = await (await fetch(s.url + 'station/station-data.js')).text();
        const nonce = JSON.parse(data.replace(/^window\.STATION = /, '').replace(/;\n$/, '')).nonce;
        assert.equal((await request(s.url + 'phone/upload' + q + '&nonce=' + nonce, { headers, body: png })).status, 201);
    } finally {
        s.close();
    }
});

test('upload answers 413 for a body over 10 MB', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    try {
        const q = '?root=' + encodeURIComponent(f.r1) + '&id=' + SID + '&ext=png';
        const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(11 * 1024 * 1024)]);
        const r = await request(s.url + 'phone/upload' + q, { headers: Object.assign({ 'content-type': 'image/png', cookie: f.cookie }, TAILNET), body: big });
        assert.equal(r.status, 413);
    } finally {
        s.close();
    }
});

test('upload cuts off a body over 64 MB and the station keeps answering', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    try {
        const q = '?root=' + encodeURIComponent(f.r1) + '&id=' + SID + '&ext=png';
        const u = new URL(s.url + 'phone/upload' + q);
        await new Promise((resolve) => {
            const req = http.request(u, { method: 'POST', headers: Object.assign({ 'content-type': 'image/png', cookie: f.cookie }, TAILNET) });
            req.on('response', (res) => res.resume());
            req.on('error', resolve);
            req.on('close', resolve);
            const piece = Buffer.alloc(1024 * 1024);
            let sent = 0;
            const pump = () => {
                while (sent < 80 && !req.destroyed) {
                    sent++;
                    if (!req.write(piece)) return req.once('drain', pump);
                }
                req.end();
            };
            pump();
        });
        assert.equal((await fetch(s.url + 'station/station-data.js')).status, 200);
    } finally {
        s.close();
    }
});

test('upload takes only png, jpeg, webp, gif whose first bytes match, and never overwrites', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    const headers = Object.assign({ 'content-type': 'image/png', cookie: f.cookie }, TAILNET);
    const up = (ext, body) => request(s.url + 'phone/upload?root=' + encodeURIComponent(f.r1) + '&id=' + SID + '&ext=' + ext, { headers, body });
    try {
        assert.equal((await up('html', Buffer.from('<script>alert(1)</script>'))).status, 415);
        assert.equal((await up('png', Buffer.from('<script>alert(1)</script>'))).status, 415);
        assert.equal((await up('gif', Buffer.from([0x89, 0x50, 0x4e, 0x47, 1]))).status, 415);
        const jpg = await up('jpg', Buffer.from([0xff, 0xd8, 0xff, 1]));
        assert.equal(jpg.status, 201);
        assert.ok(jpg.text.trim().endsWith('.jpeg'));
        const webp = await up('webp', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]));
        assert.equal(webp.status, 201);
        const paths = new Set();
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1]);
        for (let i = 0; i < 5; i++) paths.add((await up('png', png)).text.trim());
        assert.equal(paths.size, 5);
    } finally {
        s.close();
    }
});

test('the phone routes are device routes, and the reference names them', () => {
    assert.equal(remote.policy('POST', '/phone/say'), 'device');
    assert.equal(remote.policy('POST', '/phone/attach'), 'device');
    assert.equal(remote.policy('GET', '/station/phone.json'), 'device');
    const ref = fs.readFileSync(path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    for (const route of ['/station/phone.json', '/phone/attach', '/phone/detach', '/phone/say', '/phone/upload']) assert.ok(ref.includes(route), route);
});
