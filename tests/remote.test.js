'use strict';
// lib/remote.js (docs/90-agent/plans/2026-10-21-station-remote-design.md §1,
// §3): which requests are this machine's, which came through the tailnet, what
// the tailnet may reach without a paired phone, and the one-time code that
// becomes a device cookie. The store keeps a token's SHA-256 and never the token.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const remote = require('../lib/remote.js');
const tmp = require('./tmp.js');

const NAME = 'ymlab-pc.tail1234.ts.net';
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const store = (cfg) => path.join(cfg, 'fankeel', 'remote.json');

test('hostKind: loopback only without a proxy header, the tailnet only when a name is given', () => {
    assert.equal(remote.hostKind({ host: '127.0.0.1:28888' }, null), 'loopback');
    assert.equal(remote.hostKind({ host: 'localhost:28888' }, null), 'loopback');
    assert.equal(remote.hostKind({ host: '[::1]:28888' }, NAME), 'loopback');
    assert.equal(remote.hostKind({ host: NAME }, null), null, 'off: the tailnet name is refused');
    assert.equal(remote.hostKind({ host: '127.0.0.1:28888', 'x-forwarded-for': '100.64.0.2' }, null), null, 'a proxied loopback request is not this machine\'s');
    assert.equal(remote.hostKind({ host: 'evil.example' }, NAME), null);
    assert.equal(remote.hostKind({}, null), null);
    assert.equal(remote.hostKind({ host: NAME }, NAME), 'tailnet');
    assert.equal(remote.hostKind({ host: NAME.toUpperCase() + ':443' }, NAME + '.'), 'tailnet', 'case, :443 and the trailing dot do not matter');
    assert.equal(remote.hostKind({ host: NAME + ':8443' }, NAME), null, 'another port is another address');
    assert.equal(remote.hostKind({ host: '127.0.0.1:28888', 'x-forwarded-host': NAME }, NAME), 'tailnet');
    assert.equal(remote.hostKind({ host: '127.0.0.1:28888', 'tailscale-user-login': 'me@example.com' }, NAME), 'tailnet', 'rewritten to loopback by tailscale serve');
});

test('sameOrigin is https and the tailnet name, nothing else', () => {
    assert.equal(remote.sameOrigin({ origin: 'https://' + NAME }, NAME), true);
    assert.equal(remote.sameOrigin({ origin: 'https://' + NAME }, NAME + '.'), true);
    assert.equal(remote.sameOrigin({ origin: 'http://' + NAME }, NAME), false);
    assert.equal(remote.sameOrigin({ origin: 'https://evil.example' }, NAME), false);
    assert.equal(remote.sameOrigin({}, NAME), false);
    assert.equal(remote.sameOrigin({ origin: 'https://' + NAME }, null), false);
});

test('policy: the phone page, its assets and pairing are open; the card, health and Chartroom are local; the rest needs a device', () => {
    for (const p of ['/', '/m', '/m/manifest.webmanifest', '/m/icon.svg', '/sw.js', '/station/station.css', '/station/mobile.js', '/station/mobile.css']) {
        assert.equal(remote.policy('GET', p), 'open', p);
    }
    assert.equal(remote.policy('POST', '/station/remote/pair'), 'open');
    for (const p of ['/station/remote', '/station/remote/qr.svg', '/station/remote/code', '/station/remote/revoke', '/station/health', '/chartroom/fankeel/']) {
        assert.equal(remote.policy('GET', p), 'local', p);
    }
    assert.equal(remote.policy('POST', '/station/remote/code'), 'local');
    assert.equal(remote.policy('POST', '/station/remote/revoke'), 'local');
    for (const p of ['/station/station-data.js', '/station/mobile.json', '/station/talk/abc', '/station/i18n.js', '/station/detail/a.js', '/f/a/plan']) {
        assert.equal(remote.policy('GET', p), 'device', p);
    }
    for (const p of ['/answer', '/clear', '/clear-stale', '/todo', '/profile', '/']) assert.equal(remote.policy('POST', p), 'device', p);
});

test('a code is 8 characters, live for 10 minutes and kept while live; a new one replaces it', () => {
    const cfg = tmp('fankeel-remote-');
    const code = remote.liveCode(cfg, NOW);
    assert.match(code.value, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    assert.equal(code.until, NOW + 600e3);
    assert.deepEqual(remote.liveCode(cfg, NOW + 599e3), code, 'a live code is kept');
    assert.equal(remote.liveCode(cfg, NOW + 600e3).until, NOW + 1200e3, 'an expired one is replaced');
    const fresh = remote.newCode(cfg, NOW + 700e3);
    assert.deepEqual(remote.liveCode(cfg, NOW + 700e3), fresh);
});

test('pair trades a live code once for a token; the store holds its SHA-256 and never the token', () => {
    const cfg = tmp('fankeel-remote-');
    const c = remote.newCode(cfg, NOW);
    const got = remote.pair(cfg, ' ' + c.value.toLowerCase() + ' ', 'Galaxy S24 <script>', NOW + 1000);
    assert.equal(got.ok, true);
    assert.match(got.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(got.device.name, 'Galaxy S24 script');
    assert.match(got.device.id, /^[0-9a-f]{16}$/);
    const text = fs.readFileSync(store(cfg), 'utf8');
    assert.ok(!text.includes(got.token), 'the token reached remote.json');
    assert.ok(text.includes(crypto.createHash('sha256').update(got.token).digest('hex')));
    assert.deepEqual(remote.pair(cfg, c.value, 'again', NOW + 2000), { ok: false, reason: 'no live pairing code — mint one on the station\'s 手機遠端 card' }, 'one-time');
    const late = remote.newCode(cfg, NOW);
    assert.equal(remote.pair(cfg, late.value, 'late', NOW + 600e3).ok, false, 'past ten minutes');
    assert.equal(remote.pair(cfg, remote.newCode(cfg, NOW).value, '', NOW).device.name, 'phone', 'an empty name');
    assert.equal(remote.pair(cfg, remote.newCode(cfg, NOW).value, 'x'.repeat(60), NOW).device.name.length, 40);
});

test('five wrong tries drop the code, the right one included', () => {
    const cfg = tmp('fankeel-remote-');
    const c = remote.newCode(cfg, NOW);
    for (let i = 0; i < 4; i++) assert.equal(remote.pair(cfg, 'WRNG2345', 'x', NOW).reason, 'wrong pairing code');
    assert.match(remote.pair(cfg, 'WRNG2345', 'x', NOW).reason, /five wrong codes/);
    assert.equal(remote.pair(cfg, c.value, 'x', NOW).ok, false);
});

test('deviceFor finds a paired token, marks it seen at most once a minute, and revoke ends it', () => {
    const cfg = tmp('fankeel-remote-');
    const { token, device } = remote.pair(cfg, remote.newCode(cfg, NOW).value, 'S24', NOW);
    assert.equal(remote.deviceFor(cfg, token, NOW + 30e3).seen, NOW);
    assert.equal(remote.deviceFor(cfg, token, NOW + 61e3).seen, NOW + 61e3);
    assert.equal(remote.deviceFor(cfg, token + 'x', NOW), null);
    assert.equal(remote.deviceFor(cfg, null, NOW), null);
    assert.equal(remote.deviceFor(cfg, '', NOW), null);
    assert.deepEqual(remote.devicesOf(cfg), [{ id: device.id, name: 'S24', paired: NOW, seen: NOW + 61e3 }]);
    assert.equal(remote.revoke(cfg, device.id), true);
    assert.equal(remote.revoke(cfg, device.id), false);
    assert.equal(remote.deviceFor(cfg, token, NOW), null);
    assert.deepEqual(remote.devicesOf(cfg), []);
});

test('the cookie lives a year, HttpOnly, Secure, SameSite=Strict, and is read back from a Cookie header', () => {
    const t = 'abc_DEF-0123456789abcdefghij';
    assert.equal(remote.cookieFor(t), 'fk_device=' + t + '; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict');
    assert.equal(remote.tokenOf('x=1; fk_device=' + t + '; y=2'), t);
    assert.equal(remote.tokenOf('fk_device=' + t), t);
    assert.equal(remote.tokenOf('x=1'), null);
    assert.equal(remote.tokenOf(undefined), null);
});

test('a store that does not parse reads as nothing paired', () => {
    const cfg = tmp('fankeel-remote-');
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(store(cfg), 'not json');
    assert.deepEqual(remote.devicesOf(cfg), []);
    assert.equal(remote.deviceFor(cfg, 'abc_DEF-0123456789abcdefghij', NOW), null);
});
