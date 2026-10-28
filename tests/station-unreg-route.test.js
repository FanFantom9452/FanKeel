'use strict';
// Task 3 of docs/90-agent/plans/2026-10-29-mobile-sources.md, through the server: an unregistered
// session's screen read from its own transcript, found by session id (decision (b)); and a paired
// phone reading a session on another computer through this station. `tailscaleRun` and `peerSend`
// are fakes: no test reaches the real tailscale or the network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const profile = require('../lib/profile.js');
const remote = require('../lib/remote.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const NAME = 'me.t.ts.net';
const LAB = 'lab.t.ts.net';
const TOKEN = 'T'.repeat(43);
const U = 'bbbbbbbb-0000-4000-8000-000000000002';
const GONE = 'cccccccc-0000-4000-8000-000000000003';
function fakeTailscale() {
    let config = {};
    return (args) => {
        if (args[0] === 'status') return { status: 0, stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: NAME + '.' } }), stderr: '' };
        if (args[0] === 'serve' && args[1] === 'status') return { status: 0, stdout: JSON.stringify(config), stderr: '' };
        if (args[0] === 'serve' && args[1] === '--bg') {
            config = { TCP: { 443: { HTTPS: true } }, Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:' + args[2] } } } } };
            return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + args.join(' ') };
    };
}
const line = (o) => JSON.stringify(o) + '\n';
function fixture() {
    const base = tmp('fankeel-station-unreg-');
    const cfg = path.join(base, 'cfg');
    const side = path.join(base, 'side');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(side, { recursive: true });
    fs.writeFileSync(path.join(cfg, 'sessions', 'u.json'), JSON.stringify({ pid: process.pid, sessionId: U, cwd: side, entrypoint: 'cli', name: 'side job', status: 'busy', bridgeSessionId: 'b1', startedAt: Date.now() }));
    const proj = path.join(cfg, 'projects', 'side');
    fs.mkdirSync(proj, { recursive: true });
    fs.writeFileSync(path.join(proj, U + '.jsonl'), line({ type: 'user', timestamp: '2026-10-29T11:00:00.000Z', message: { role: 'user', content: 'fix the table' } })
        + line({ type: 'assistant', timestamp: '2026-10-29T11:00:05.000Z', message: { content: [{ type: 'text', text: 'Reading it.' }] } }));
    fs.writeFileSync(path.join(proj, GONE + '.jsonl'), line({ type: 'user', timestamp: '2026-10-28T11:00:00.000Z', message: { role: 'user', content: 'earlier' } }));
    assert.equal(profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok, true);
    fs.writeFileSync(path.join(cfg, 'fankeel', 'rc-seen.json'), JSON.stringify({ sessions: [{ id: GONE, kind: 'unreg', name: 'old rc', cwd: side, entrypoint: 'cli', task: '', last: Date.now() - 3600e3 }] }));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'peers.json'), JSON.stringify({ peers: [{ dnsName: LAB, name: 'lab', token: TOKEN, paired: 1, seen: null, last: null }] }));
    const now = Date.now();
    const phone = remote.pair(cfg, remote.newCode(cfg, now).value, 'S24', now);
    return { base, cfg, cookie: 'fk_device=' + phone.token };
}
const request = (port, p, o) => new Promise((resolve, reject) => {
    const opts = o || {};
    const req = http.request({ hostname: '127.0.0.1', port, path: p, method: opts.method || 'GET', headers: opts.headers || {} }, (res) => {
        let t = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { t += c; });
        res.on('end', () => resolve({ status: res.statusCode, text: t }));
    });
    req.on('error', reject);
    req.end(opts.body);
});
const tailnet = (f, post) => Object.assign({ host: NAME, cookie: f.cookie }, post ? { origin: 'https://' + NAME, 'content-type': 'application/x-www-form-urlencoded' } : {});
const was = process.cwd();
test.after(() => process.chdir(was));
async function booted(peerSend, fn) {
    const f = fixture();
    process.chdir(f.base);
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false, tailscaleRun: fakeTailscale(), probeGet: async () => ({ status: 404 }), peerSend });
    try { await fn(Number(new URL(s.url).port), f); } finally { s.close(); }
}

test('unreg.json: a running unregistered session\'s chat from its transcript; an RC one that ended still reads; anything else 404', () => booted(null, async (port) => {
    const r = await request(port, '/station/unreg.json?id=' + U);
    assert.equal(r.status, 200, r.text);
    const p = JSON.parse(r.text);
    assert.deepEqual(p.chat.map((x) => [x.role, x.text]), [['desktop', 'fix the table'], ['assistant', 'Reading it.']]);
    assert.deepEqual([p.state, p.bridge, p.entrypoint, p.machine], ['running', true, 'cli', 'me']);
    const gone = JSON.parse((await request(port, '/station/unreg.json?id=' + GONE)).text);
    assert.deepEqual([gone.state, gone.chat.length], ['ended', 1]);
    assert.equal((await request(port, '/station/unreg.json?id=nope')).status, 404);
}));

test('peer route: a paired phone reads and acts on lab\'s session through this station, with this station\'s token', async () => {
    const calls = [];
    await booted(async (o) => { calls.push(o); return { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"id":"x"}') }; }, async (port, f) => {
        const r = await request(port, '/station/peer/lab/station/phone.json?id=x', { headers: tailnet(f) });
        assert.deepEqual([r.status, r.text], [200, '{"id":"x"}']);
        assert.equal(calls[0].url, 'https://' + LAB + '/station/phone.json?id=x');
        assert.equal(calls[0].headers.cookie, 'fk_device=' + TOKEN);
        const say = await request(port, '/station/peer/lab/phone/say', { method: 'POST', headers: tailnet(f, true), body: 'root=%2Fr&id=x&text=hi' });
        assert.equal(say.status, 200);
        assert.equal(calls[1].headers.origin, 'https://' + LAB);
        assert.equal(String(calls[1].body), 'root=%2Fr&id=x&text=hi');
        assert.equal((await request(port, '/station/peer/lab/station/station-data.js', { headers: tailnet(f) })).status, 404);
        assert.equal(calls.length, 2);
    });
});

test('peer route: refused from this machine without a phone, and 502 when lab refuses this station\'s token', () => booted(async () => ({ status: 401, headers: {}, body: Buffer.from('pair this phone first') }), async (port, f) => {
    assert.equal((await request(port, '/station/peer/lab/station/phone.json?id=x')).status, 403);
    assert.equal((await request(port, '/station/peer/lab/station/phone.json?id=x', { headers: tailnet(f) })).status, 502);
}));

test('peer route: from the tailnet without a paired phone\'s cookie it is 401 and never passed on', async () => {
    const calls = [];
    await booted(async (o) => { calls.push(o); return { status: 200, headers: {}, body: Buffer.from('{}') }; }, async (port) => {
        assert.equal((await request(port, '/station/peer/lab/station/phone.json?id=x', { headers: { host: NAME } })).status, 401);
        assert.equal(calls.length, 0);
    });
});

test('peer route: a body over 11 MB is answered 413 with connection close and never passed on', async () => {
    const calls = [];
    await booted(async (o) => { calls.push(o); return { status: 201, headers: {}, body: Buffer.from('ok') }; }, async (port, f) => {
        const r = await new Promise((resolve, reject) => {
            const req = http.request({ hostname: '127.0.0.1', port, path: '/station/peer/lab/phone/upload?ext=png', method: 'POST', headers: Object.assign(tailnet(f, true), { 'content-type': 'image/png' }) }, (res) => {
                res.resume();
                res.on('end', () => resolve({ status: res.statusCode, connection: res.headers.connection }));
            });
            req.on('error', reject);
            req.end(Buffer.alloc(11 * 1024 * 1024 + 1));
        });
        assert.deepEqual([r.status, r.connection], [413, 'close']);
        assert.equal(calls.length, 0);
    });
});

test('peer route: a name this station has not paired is 404 and never passed on', async () => {
    const calls = [];
    await booted(async (o) => { calls.push(o); return { status: 200, headers: {}, body: Buffer.from('{}') }; }, async (port, f) => {
        assert.equal((await request(port, '/station/peer/nope/station/phone.json?id=x', { headers: tailnet(f) })).status, 404);
        assert.equal(calls.length, 0);
    });
});

test('peer route: a POST whose phone drops mid-body leaves the station answering the next request', async () => {
    const dead = [];
    const onDead = (e) => { dead.push(e); };
    process.on('unhandledRejection', onDead);
    try {
        await booted(async () => ({ status: 200, headers: {}, body: Buffer.from('{}') }), async (port, f) => {
            await new Promise((resolve) => {
                const req = http.request({ hostname: '127.0.0.1', port, path: '/station/peer/lab/phone/say', method: 'POST', headers: Object.assign(tailnet(f, true), { 'content-length': 1024 * 1024 }) });
                req.on('error', () => resolve());
                req.write(Buffer.alloc(64 * 1024));
                setTimeout(() => { req.destroy(); setTimeout(resolve, 200); }, 100);
            });
            assert.equal((await request(port, '/station/peer/lab/station/phone.json?id=x', { headers: tailnet(f) })).status, 200);
        });
        assert.deepEqual(dead, []);
    } finally {
        process.off('unhandledRejection', onDead);
    }
});
