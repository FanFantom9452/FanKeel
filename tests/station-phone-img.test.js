'use strict';
// GET /phone/img (docs/90-agent/todo/station-67.md): the photo the phone uploaded, served back to the
// session it belongs to. The name is only ever the saved file's own shape, so nothing outside
// <phone dir>/uploads can be asked for. `tailscaleRun` is faked: no test runs the real tailscale.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const remote = require('../lib/remote.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const NAME = 'station.example.invalid';
const SID = 'ffffffff-9999-4999-8999-000000000001';
const TAILNET = { host: NAME, origin: 'https://' + NAME };

function fixture() {
    const base = tmp('fankeel-station-img-');
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

// Bytes, not text: the body is a picture.
const request = (url, o) => new Promise((resolve, reject) => {
    const opts = o || {};
    const post = opts.body !== undefined;
    const req = http.request(url, { method: post ? 'POST' : 'GET', headers: opts.headers || {} }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on('error', reject);
    if (post) req.write(opts.body);
    req.end();
});
const was = process.cwd();
test.after(() => process.chdir(was));
const start = (f, ts) => (process.chdir(path.dirname(f.cfg)), serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false, tailscaleRun: ts.run }));

test('GET /phone/img answers the uploaded photo to a paired phone, and refuses everything that is not a saved photo of that session', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    const as = Object.assign({ cookie: f.cookie }, TAILNET);
    const q = (name, id) => '?root=' + encodeURIComponent(f.r1) + '&id=' + (id || SID) + '&name=' + encodeURIComponent(name);
    try {
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
        const up = await request(s.url + 'phone/upload?root=' + encodeURIComponent(f.r1) + '&id=' + SID + '&ext=png', { headers: Object.assign({ 'content-type': 'image/png' }, as), body: png });
        assert.equal(up.status, 201);
        const name = path.basename(up.body.toString().trim());
        assert.equal((await request(s.url + 'phone/img' + q(name), { headers: TAILNET })).status, 401, 'an unpaired phone');
        const ok = await request(s.url + 'phone/img' + q(name), { headers: as });
        assert.equal(ok.status, 200);
        assert.equal(ok.headers['content-type'], 'image/png');
        assert.deepEqual(ok.body, png);
        // Real decoys: one file a directory above uploads, one inside uploads under a name the saved shape never has.
        const phoneDir = require('../lib/phone.js').dirOf(f.r1, SID);
        fs.writeFileSync(path.join(phoneDir, 'x.png'), png);
        fs.writeFileSync(path.join(phoneDir, 'uploads', 'evil.png'), png);
        assert.equal((await request(s.url + 'phone/img' + q('../x.png'), { headers: as })).status, 404, 'one directory up');
        assert.equal((await request(s.url + 'phone/img' + q('evil.png'), { headers: as })).status, 404, 'a name the saved shape never has');
        for (const bad of ['../../../registry.json', '..%2Fx.png', 'a.txt', '1-abc123.svg', '123-abc12.png', '123-ABCDEF.png', '999-abcdef.png', '']) {
            assert.equal((await request(s.url + 'phone/img' + q(bad), { headers: as })).status, 404, bad);
        }
        assert.equal((await request(s.url + 'phone/img' + q(name, 'nope'), { headers: as })).status, 404, 'another session');
        assert.equal((await request(s.url + 'phone/img?root=' + encodeURIComponent(path.join(f.r1, '..')) + '&id=' + SID + '&name=' + name, { headers: as })).status, 404, 'another root');
    } finally {
        s.close();
    }
});

test('GET /phone/img answers 500, not 404, when a saved photo cannot be read', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    try {
        const dir = require('../lib/phone.js').dirOf(f.r1, SID);
        fs.mkdirSync(path.join(dir, 'uploads', '123-abcdef.png'), { recursive: true });
        const r = await request(s.url + 'phone/img?root=' + encodeURIComponent(f.r1) + '&id=' + SID + '&name=123-abcdef.png');
        assert.equal(r.status, 500);
    } finally {
        s.close();
    }
});

test('GET /phone/img on this machine needs no nonce, like phone.json', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    try {
        const gif = Buffer.from('GIF89a\u0001\u0002', 'latin1');
        const up = await request(s.url + 'phone/upload?root=' + encodeURIComponent(f.r1) + '&id=' + SID + '&ext=gif', { headers: Object.assign({ 'content-type': 'image/gif' }, { cookie: f.cookie }, TAILNET), body: gif });
        assert.equal(up.status, 201);
        const name = path.basename(up.body.toString().trim());
        const r = await request(s.url + 'phone/img?root=' + encodeURIComponent(f.r1) + '&id=' + SID + '&name=' + name);
        assert.equal(r.status, 200);
        assert.equal(r.headers['content-type'], 'image/gif');
    } finally {
        s.close();
    }
});
