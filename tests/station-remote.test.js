'use strict';
// The station through the tailnet (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §1-§3): off, loopback only and 421 for anything else; on, `tailscale serve`
// made once and never Funnel, every tailnet route but the phone page's behind
// a paired device's cookie, every tailnet POST behind the tailnet Origin.
// `tailscaleRun` is faked throughout: no test runs the real tailscale.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const { pendingPath, answerPath } = require('../lib/handoff.js');
const { readServeRecord } = require('../lib/serve.js');
const profile = require('../lib/profile.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const NAME = 'ymlab-pc.tail1234.ts.net';
const SID = 'ffffffff-8888-4888-8888-888888888888';
const Q = [{ question: '進 verify 嗎？', header: 'build', multiSelect: false, options: [{ label: '進 verify', description: 'a' }, { label: '暫停', description: 'b' }] }];
const GOOD = JSON.stringify({ [Q[0].question]: '暫停' });

function fixture(remoteOn) {
    const base = tmp('fankeel-station-remote-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const data = { task: 't', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: '2026-10-21T08:00:00.000Z', updated: new Date().toISOString(), configDir: cfg };
    registry.writeSession(r1, SID, data);
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-10-21T08:00:00.000Z' }) + '\n');
    if (remoteOn) fs.writeFileSync(profile.machineFile(cfg), JSON.stringify({ 'station.remote': true }) + '\n');
    const file = pendingPath(r1, data, 'build');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ questions: Q, at: Date.now(), until: Date.now() + 600e3 }));
    return { cfg, r1, data };
}

// tailscale's CLI as lib/tailscale.js calls it: this machine's MagicDNS name
// in `state`, no serve config until `serve --bg <port>`, every call recorded.
function fakeTailscale(state) {
    const calls = [];
    let config = {};
    const run = (args) => {
        calls.push(args.join(' '));
        if (args[0] === 'status') return { status: 0, stdout: JSON.stringify({ BackendState: state || 'Running', Self: { DNSName: NAME + '.' } }), stderr: '' };
        if (args[0] === 'serve' && args[1] === 'status') return { status: 0, stdout: JSON.stringify(config), stderr: '' };
        if (args[0] === 'serve' && args[1] === '--bg') {
            config = { TCP: { 443: { HTTPS: true } }, Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:' + args[2] } } } } };
            return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + args.join(' ') };
    };
    return { run, calls };
}

const request = (url, o) => new Promise((resolve, reject) => {
    const opts = o || {};
    const post = opts.body !== undefined;
    const headers = Object.assign(post ? { 'content-type': 'application/x-www-form-urlencoded' } : {}, opts.headers);
    // `path`, when given, goes on the wire as written: a url string has its `..` resolved first.
    const req = http.request(url, Object.assign({ method: post ? 'POST' : 'GET', headers }, opts.path ? { path: opts.path } : {}), (res) => {
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
const TAILNET = { host: NAME, origin: 'https://' + NAME };
const start = (f, ts) => serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false, tailscaleRun: ts.run });
const nonceOf = async (s) => /"nonce":"([^"]+)"/.exec((await request(s.url + 'station/station-data.js')).text)[1];

test('remote off: the tailnet name and a proxied loopback are refused with 421, and tailscale is never asked', async () => {
    const f = fixture(false);
    const ts = fakeTailscale();
    const s = await start(f, ts);
    try {
        const nonce = await nonceOf(s);
        assert.equal((await request(s.url, { headers: { host: NAME } })).status, 421);
        const answered = await request(s.url + 'answer', { headers: TAILNET, body: form({ nonce, root: f.r1, id: SID, answers: GOOD }) });
        assert.equal(answered.status, 421, 'the nonce does not get a tailnet request past the Host check');
        assert.equal(fs.existsSync(answerPath(f.r1, f.data, 'build')), false, 'a refused answer wrote nothing');
        assert.equal((await request(s.url)).status, 200);
        assert.equal((await request(s.url, { headers: { 'x-forwarded-for': '100.64.0.2' } })).status, 421);
        assert.deepEqual(ts.calls, []);
        assert.equal(readServeRecord(f.cfg).remote, undefined);
    } finally {
        s.close();
    }
});

test('remote on: tailscale serve --bg once, never funnel; serve.json keeps the loopback url and adds remote.url', async () => {
    const f = fixture(true);
    const ts = fakeTailscale();
    const s = await start(f, ts);
    try {
        assert.deepEqual(ts.calls.filter((c) => c.startsWith('serve --bg')), ['serve --bg ' + new URL(s.url).port]);
        assert.equal(ts.calls.some((c) => /funnel/.test(c)), false);
        const rec = readServeRecord(f.cfg);
        assert.match(rec.url, /^http:\/\/127\.0\.0\.1:\d+\/?$/, 'hooks/pane.ts accepts only this');
        assert.deepEqual(rec.remote, { url: 'https://' + NAME + '/' });
    } finally {
        s.close();
    }
});

test('through the tailnet without a paired cookie: 401 on reads and answers, 403 on the card, loopback as before', async () => {
    const f = fixture(true);
    const s = await start(f, fakeTailscale());
    try {
        const nonce = await nonceOf(s);
        const tailnetAnswer = await request(s.url + 'answer', { headers: TAILNET, body: form({ nonce, root: f.r1, id: SID, answers: GOOD }) });
        assert.equal(tailnetAnswer.status, 401, 'the nonce is no key from the tailnet');
        assert.equal((await request(s.url + 'station/station-data.js', { headers: { host: NAME } })).status, 401);
        assert.equal((await request(s.url + 'station/talk/' + SID, { headers: { host: NAME } })).status, 401);
        assert.equal((await request(s.url + 'station/station-data.js', { headers: { 'tailscale-user-login': 'me@example.com' } })).status, 401, 'rewritten to loopback by tailscale serve');
        assert.equal((await request(s.url + 'station/remote', { headers: { host: NAME } })).status, 403);
        assert.equal((await request(s.url + 'station/health', { headers: { host: NAME } })).status, 403);
        assert.equal((await request(s.url + 'station/station.css', { headers: { host: NAME } })).status, 200, 'the phone page\'s assets are open');
        assert.equal(fs.existsSync(answerPath(f.r1, f.data, 'build')), false);
        assert.equal((await request(s.url + 'answer', { body: form({ nonce, root: f.r1, id: SID, answers: GOOD }) })).status, 201, 'loopback keeps the nonce');
    } finally {
        s.close();
    }
});

test('pairing: a live code from the tailnet, once, for an HttpOnly Secure SameSite=Strict cookie that answers without the nonce until revoked', async () => {
    const f = fixture(true);
    const s = await start(f, fakeTailscale());
    try {
        const nonce = await nonceOf(s);
        const card = JSON.parse((await request(s.url + 'station/remote')).text);
        assert.equal(card.on, true);
        assert.equal(card.active, true);
        assert.equal(card.url, 'https://' + NAME + '/');
        assert.equal(card.dnsName, NAME);
        assert.equal(card.warning, null);
        assert.match(card.code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
        assert.equal(typeof card.until, 'number');
        assert.equal(card.pairUrl, 'https://' + NAME + '/m#/pair/' + card.code);
        assert.deepEqual(card.devices, []);
        assert.deepEqual(card.notify, { server: 'https://ntfy.sh', topic: null, gate: false, stage: false, end: false });
        const svg = await request(s.url + 'station/remote/qr.svg');
        assert.equal(svg.status, 200);
        assert.equal(svg.headers['content-type'], 'image/svg+xml');
        assert.match(svg.text, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        assert.match(svg.headers['content-security-policy'], /default-src 'none'/);
        const pairBody = form({ code: card.code, name: 'Galaxy S24' });
        assert.equal((await request(s.url + 'station/remote/pair', { body: pairBody })).status, 403, 'pairing is from the phone, not from this machine');
        assert.equal((await request(s.url + 'station/remote/pair', { headers: { host: NAME, origin: 'https://evil.example' }, body: pairBody })).status, 403, 'wrong origin');
        const paired = await request(s.url + 'station/remote/pair', { headers: TAILNET, body: pairBody });
        assert.equal(paired.status, 201, paired.text);
        assert.equal(JSON.parse(paired.text).device.name, 'Galaxy S24');
        const cookie = paired.headers['set-cookie'][0];
        assert.match(cookie, /^fk_device=[A-Za-z0-9_-]{43}; Path=\/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict$/);
        assert.equal((await request(s.url + 'station/remote/pair', { headers: TAILNET, body: pairBody })).status, 403, 'one-time');
        const jar = Object.assign({ cookie: cookie.split(';')[0] }, TAILNET);
        const ok = await request(s.url + 'answer', { headers: jar, body: form({ root: f.r1, id: SID, answers: GOOD }) });
        assert.equal(ok.status, 201, ok.text);
        assert.deepEqual(JSON.parse(fs.readFileSync(answerPath(f.r1, f.data, 'build'), 'utf8')), { answers: { [Q[0].question]: '暫停' } });
        const foreign = await request(s.url + 'answer', { headers: { cookie: jar.cookie, host: NAME, origin: 'https://evil.example' }, body: form({ root: f.r1, id: SID, answers: GOOD }) });
        assert.equal(foreign.status, 403, 'a cookie does not lift the origin check');
        assert.equal((await request(s.url + 'station/station-data.js', { headers: jar })).status, 200, 'a paired phone reads');
        assert.equal((await request(s.url + 'station/remote', { headers: jar })).status, 403, 'a paired phone still cannot reach the card');
        const devices = JSON.parse((await request(s.url + 'station/remote')).text).devices;
        assert.equal(devices.length, 1);
        assert.equal(devices[0].name, 'Galaxy S24');
        assert.equal((await request(s.url + 'station/remote/revoke', { body: form({ id: devices[0].id }) })).status, 403, 'revoke needs the nonce');
        assert.equal((await request(s.url + 'station/remote/revoke', { body: form({ nonce, id: devices[0].id }) })).status, 200);
        assert.equal((await request(s.url + 'station/remote/revoke', { body: form({ nonce, id: devices[0].id }) })).status, 404);
        assert.equal((await request(s.url + 'answer', { headers: jar, body: form({ root: f.r1, id: SID, answers: GOOD }) })).status, 401, 'revoked from the next request');
        const minted = await request(s.url + 'station/remote/code', { body: form({ nonce }) });
        assert.equal(minted.status, 201);
        const code = JSON.parse(minted.text);
        assert.match(code.code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
        assert.equal(JSON.parse((await request(s.url + 'station/remote')).text).code, code.code, 'the card shows the new code');
        assert.equal((await request(s.url + 'station/remote/code', { body: form({ nonce: 'wrong' }) })).status, 403);
    } finally {
        s.close();
    }
});

test('a tailscale that is not running leaves remote off with the reason on the card, and loopback serving', async () => {
    const f = fixture(true);
    const ts = fakeTailscale('Stopped');
    const s = await start(f, ts);
    try {
        const card = JSON.parse((await request(s.url + 'station/remote')).text);
        assert.equal(card.on, true);
        assert.equal(card.active, false);
        assert.match(card.warning, /Stopped/);
        assert.equal(card.code, null);
        assert.equal(card.pairUrl, null);
        assert.equal((await request(s.url + 'station/remote/qr.svg')).status, 409);
        assert.equal((await request(s.url, { headers: { host: NAME } })).status, 421);
        assert.equal((await request(s.url)).status, 200);
        assert.equal(ts.calls.some((c) => c.startsWith('serve')), false);
        assert.equal(readServeRecord(f.cfg).remote, undefined);
    } finally {
        s.close();
    }
});

test('POST /profile: the first trigger turned on writes a topic, and station.remote turns the tailnet on and off live', async () => {
    const f = fixture(false);
    const ts = fakeTailscale();
    const s = await start(f, ts);
    try {
        const nonce = await nonceOf(s);
        const set = (key, value) => request(s.url + 'profile', { body: form({ nonce, scope: 'machine', key, value }) });
        const machine = () => JSON.parse(fs.readFileSync(profile.machineFile(f.cfg), 'utf8'));
        assert.equal((await set('notify.gate', 'true')).status, 303);
        const topic = machine()['notify.topic'];
        assert.match(topic, /^fankeel-[0-9a-f]{20}$/);
        assert.equal(machine()['notify.gate'], true);
        assert.equal((await set('notify.stage', 'true')).status, 303);
        assert.equal(machine()['notify.topic'], topic, 'written once');
        assert.equal((await request(s.url, { headers: { host: NAME } })).status, 421);
        assert.equal((await set('station.remote', 'true')).status, 303);
        const on = (await request(s.url, { headers: { host: NAME } })).status;
        assert.ok(on === 200 || on === 303, 'answered through the tailnet now (the phone routes later redirect it to /m): ' + on);
        assert.deepEqual(ts.calls.filter((c) => c.startsWith('serve --bg')), ['serve --bg ' + new URL(s.url).port]);
        assert.equal(readServeRecord(f.cfg).remote.url, 'https://' + NAME + '/');
        const before = ts.calls.length;
        assert.equal((await set('station.remote', 'false')).status, 303);
        assert.equal((await request(s.url, { headers: { host: NAME } })).status, 421, 'refused from the next request');
        assert.equal(ts.calls.length, before, 'turning it off does not touch tailscale');
        assert.equal(readServeRecord(f.cfg).remote, undefined);
    } finally {
        s.close();
    }
});

// The policy reads the normalised pathname and the Chartroom hand-off the raw
// url, so `/chartroom/ws/../../station/x` is `device` to one and a board to the
// other. Chartroom here is a fake that answers 200 to whatever it is handed.
test('through the tailnet a paired phone never reaches Chartroom, .. or not: 403, and Chartroom is handed nothing', async () => {
    const f = fixture(true);
    const dir = path.join(path.dirname(f.cfg), 'chartroom');
    fs.mkdirSync(path.join(dir, 'src', 'server'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{ "type": "module" }\n');
    fs.writeFileSync(path.join(dir, 'src', 'server', 'handler.js'),
        'export function createHandler() { return Object.assign((req, res) => { (globalThis.__remoteChartroom ||= []).push(req.url); res.end("board"); }, { close() {} }); }\n');
    assert.equal(profile.write(profile.machineFile(f.cfg), 'station.chartroom', dir).ok, true);
    fs.writeFileSync(require('../lib/station.js').boardPath(f.r1), '');
    globalThis.__remoteChartroom = [];
    const s = await start(f, fakeTailscale());
    try {
        assert.equal((await request(s.url + 'chartroom/ws/')).status, 200, 'loopback still reaches the board');
        const code = JSON.parse((await request(s.url + 'station/remote')).text).code;
        const paired = await request(s.url + 'station/remote/pair', { headers: TAILNET, body: form({ code, name: 'phone' }) });
        assert.equal(paired.status, 201, paired.text);
        const jar = Object.assign({ cookie: paired.headers['set-cookie'][0].split(';')[0] }, TAILNET);
        for (const p of ['/chartroom/ws/../../station/x', '/chartroom/p/../../station/x', '/chartroom/ws/x', '/chartroom/p/x']) {
            const got = await request(s.url, { path: p, headers: jar });
            assert.equal(got.status, 403, p + ': ' + got.text);
        }
        assert.deepEqual(globalThis.__remoteChartroom, ['/'], 'only the loopback request was handed on');
    } finally {
        s.close();
    }
});
