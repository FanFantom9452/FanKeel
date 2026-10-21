'use strict';
// station-remote-1, design §7: the `tailscale serve` proxy this station made
// comes down with it — when station.remote is written off, when it closes,
// when it exits idle — and one it found already there is left on. A failed
// teardown is one stderr line and never blocks shutdown. tailscale is faked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const NAME = 'ymlab-pc.tail1234.ts.net';
const OFF = 'serve --https=443 off';

function fixture(remoteOn) {
    const base = tmp('fankeel-station-teardown-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-10-21T08:00:00.000Z' }) + '\n');
    if (remoteOn) fs.writeFileSync(profile.machineFile(cfg), JSON.stringify({ 'station.remote': true }) + '\n');
    return { cfg, r1 };
}

// tailscale's CLI as lib/tailscale.js calls it. `pre()` names a port whose
// proxy is in the serve config before the station asks; `offFails` makes the
// teardown fail.
function fakeTailscale(o) {
    const opts = o || {};
    const calls = [];
    const proxy = (port) => ({ TCP: { 443: { HTTPS: true } }, Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:' + port } } } } });
    let config = {};
    const run = (args) => {
        const line = args.join(' ');
        calls.push(line);
        if (args[0] === 'status') return { status: 0, stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: NAME + '.' } }), stderr: '' };
        if (line === 'serve status --json') return { status: 0, stdout: JSON.stringify(opts.pre ? proxy(opts.pre()) : config), stderr: '' };
        if (args[0] === 'serve' && args[1] === '--bg') { config = proxy(args[2]); return { status: 0, stdout: '', stderr: '' }; }
        if (line === OFF) {
            if (opts.offFails) return { status: 1, stdout: '', stderr: 'tailscale: access denied' };
            config = {};
            return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + line };
    };
    return { run, calls, count: (l) => calls.filter((c) => c === l).length };
}

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => { let text = ''; res.setEncoding('utf8'); res.on('data', (c) => { text += c; }); res.on('end', () => resolve(text)); }).on('error', reject);
});
const post = (url, body) => new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, (res) => {
        let text = ''; res.setEncoding('utf8'); res.on('data', (c) => { text += c; }); res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
});
const nonceOf = async (s) => /"nonce":"([^"]+)"/.exec(await get(s.url + 'station/station-data.js'))[1];
const setRemote = async (s, v) => post(s.url + 'profile', new URLSearchParams({ nonce: await nonceOf(s), scope: 'machine', key: 'station.remote', value: v }).toString());
const start = (f, ts, extra) => serve(Object.assign({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 0, open: false, tailscaleRun: ts.run }, extra));

test('station.remote written off takes down the proxy this station made, once', async () => {
    const f = fixture(true);
    const ts = fakeTailscale();
    const s = await start(f, ts);
    try {
        assert.equal(ts.count('serve --bg ' + new URL(s.url).port), 1);
        const r = await setRemote(s, 'false');
        assert.equal(r.status, 303, r.status + ' ' + r.text);
        assert.equal(ts.count(OFF), 1);
    } finally {
        s.close();
    }
    assert.equal(ts.count(OFF), 1, 'closing after off does not take it down twice');
});

test('closing the station takes down the proxy it made', async () => {
    const ts = fakeTailscale();
    const s = await start(fixture(true), ts);
    assert.equal(ts.count(OFF), 0);
    s.close();
    assert.equal(ts.count(OFF), 1);
});

test('the idle exit takes it down too', async () => {
    const ts = fakeTailscale();
    const s = await start(fixture(true), ts, { idleMs: 100 });
    try {
        await new Promise((r) => setTimeout(r, 400));
        assert.equal(ts.count(OFF), 1);
    } finally {
        s.close();
    }
    assert.equal(ts.count(OFF), 1);
});

test('a proxy found already there is not this station\'s, and is left on', async () => {
    let port = null;
    const ts = fakeTailscale({ pre: () => port });
    const s = await start(fixture(false), ts);
    port = new URL(s.url).port;
    try {
        assert.equal((await setRemote(s, 'true')).status, 303);
        assert.equal(ts.calls.filter((c) => c.startsWith('serve --bg')).length, 0);
        assert.equal((await setRemote(s, 'false')).status, 303);
    } finally {
        s.close();
    }
    assert.equal(ts.count(OFF), 0);
});

test('a teardown that fails is one stderr line, and the station still closes', async () => {
    const ts = fakeTailscale({ offFails: true });
    const s = await start(fixture(true), ts);
    const said = [];
    const write = process.stderr.write;
    process.stderr.write = (chunk) => { said.push(String(chunk)); return true; };
    try {
        s.close();
    } finally {
        process.stderr.write = write;
    }
    assert.equal(ts.count(OFF), 1);
    assert.deepEqual(said.filter((l) => l.startsWith('station: tailscale serve left on')),
        ['station: tailscale serve left on — tailscale serve --https=443 off failed: tailscale: access denied\n']);
    await assert.rejects(get(s.url));
});
