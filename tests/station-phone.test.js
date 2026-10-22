'use strict';
// The phone's routes on the station (docs/90-agent/plans/2026-10-22-mobile-session-design.md
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

test('the phone routes are device routes, and the reference names them', () => {
    assert.equal(remote.policy('POST', '/phone/say'), 'device');
    assert.equal(remote.policy('POST', '/phone/attach'), 'device');
    assert.equal(remote.policy('GET', '/station/phone.json'), 'device');
    const ref = fs.readFileSync(path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    for (const route of ['/station/phone.json', '/phone/attach', '/phone/detach', '/phone/say']) assert.ok(ref.includes(route), route);
});
