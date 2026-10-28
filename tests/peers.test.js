'use strict';
// lib/peers.js (Task 2 of docs/90-agent/plans/2026-10-29-mobile-sources.md): this station pairs
// with another one through that one's own pairing route, keeps the token in the config dir, and
// polls it; a refused or silent computer is 'off' with its last rows kept.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const peers = require('../lib/peers.js');
const tmp = require('./tmp.js');

const LAB = 'lab.t.ts.net';
const TOKEN = 'T'.repeat(43);
const T = Date.UTC(2026, 9, 29, 12, 0);
const store = (cfg) => path.join(cfg, 'fankeel', 'peers.json');
const until = async (fn) => { for (let i = 0; i < 80; i++) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 10)); } return null; };

test('pairWith: posts the code with that computer\'s Origin and keeps the token it sets', async () => {
    const cfg = tmp('fankeel-peers-');
    const calls = [];
    const send = async (o) => { calls.push(o); return { status: 201, headers: { 'set-cookie': ['fk_device=' + TOKEN + '; Path=/; HttpOnly; Secure; SameSite=Strict'] }, body: Buffer.from('{}') }; };
    assert.deepEqual(await peers.pairWith(cfg, 'LAB.t.ts.net', 'abcd2345', 'office', send, T), { ok: true, name: 'lab' });
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].url, 'https://' + LAB + '/station/remote/pair');
    assert.equal(calls[0].headers.origin, 'https://' + LAB);
    const form = new URLSearchParams(String(calls[0].body));
    assert.equal(form.get('code'), 'abcd2345');
    assert.equal(form.get('name'), '電腦 office');
    assert.deepEqual(JSON.parse(fs.readFileSync(store(cfg), 'utf8')).peers, [{ dnsName: LAB, name: 'lab', token: TOKEN, paired: T, seen: null, last: null }]);
});

test('pairWith: a refusal, a missing cookie, a bad name or no answer keeps nothing', async () => {
    const cfg = tmp('fankeel-peers-');
    const refused = await peers.pairWith(cfg, LAB, 'X', 'office', async () => ({ status: 403, headers: {}, body: Buffer.from('wrong pairing code\n') }), T);
    assert.deepEqual(refused, { ok: false, status: 403, reason: 'wrong pairing code' });
    assert.equal((await peers.pairWith(cfg, LAB, 'X', 'office', async () => ({ status: 201, headers: {}, body: Buffer.from('') }), T)).ok, false);
    assert.equal((await peers.pairWith(cfg, 'not a name', 'X', 'office', async () => { throw new Error('never sent'); }, T)).ok, false);
    assert.equal((await peers.pairWith(cfg, LAB, 'X', 'office', async () => { throw new Error('ECONNREFUSED'); }, T)).ok, false);
    assert.equal(fs.existsSync(store(cfg)), false);
});

test('poller: a paired computer read with its own token is on; the tailnet\'s others without a token are unpaired', async () => {
    const cfg = tmp('fankeel-peers-');
    fs.mkdirSync(path.dirname(store(cfg)), { recursive: true });
    fs.writeFileSync(store(cfg), JSON.stringify({ peers: [{ dnsName: LAB, name: 'lab', token: TOKEN, paired: T, seen: null, last: null }] }));
    const calls = [];
    const body = { host: 'lab', tasks: [{ id: 'x' }] };
    const poll = peers.poller(cfg, async (o) => { calls.push(o); return { status: 200, headers: {}, body: Buffer.from(JSON.stringify(body)) }; });
    const first = poll.machines([{ name: 'ws1', url: 'https://ws1.t.ts.net/m' }, { name: 'lab', url: 'https://' + LAB + '/m' }], T);
    assert.deepEqual(first.map((x) => [x.name, x.state]), [['lab', 'wait'], ['ws1', 'unpaired']]);
    const on = await until(() => { const m = poll.machines([], T + 10e3); return m[0].state === 'on' ? m : null; });
    assert.ok(on, 'lab answers');
    assert.deepEqual(on[0].body, body);
    assert.equal(on[0].url, 'https://' + LAB + '/m');
    assert.equal(calls[0].url, 'https://' + LAB + '/station/mobile.json?own=1');
    assert.equal(calls[0].headers.cookie, 'fk_device=' + TOKEN);
});

test('poller: a refused token is off and refused; a silent computer is off with its last rows and seen kept', async () => {
    const cfg = tmp('fankeel-peers-');
    fs.mkdirSync(path.dirname(store(cfg)), { recursive: true });
    const last = { host: 'lab', tasks: [{ id: 'old' }] };
    fs.writeFileSync(store(cfg), JSON.stringify({ peers: [
        { dnsName: LAB, name: 'lab', token: TOKEN, paired: T, seen: T - 3600e3, last },
        { dnsName: 'ws2.t.ts.net', name: 'ws2', token: TOKEN, paired: T, seen: null, last: null },
    ] }));
    const poll = peers.poller(cfg, async (o) => {
        if (o.url.includes('ws2')) return { status: 401, headers: {}, body: Buffer.from('pair this phone first') };
        throw new Error('timed out');
    });
    assert.equal(poll.machines([], T)[0].state, 'off', 'a stored last answer starts off, not wait');
    const m = await until(() => { const x = poll.machines([], T + 10e3); return x[1].state === 'off' ? x : null; });
    assert.ok(m, 'both answered');
    assert.deepEqual([m[0].state, m[0].refused, m[0].seen, m[0].body], ['off', false, T - 3600e3, last]);
    assert.deepEqual([m[1].state, m[1].refused], ['off', true]);
});

test('poller: a 200 with no JSON is off and named on stderr apart from no answer, once per reason', async () => {
    const cfg = tmp('fankeel-peers-');
    fs.mkdirSync(path.dirname(store(cfg)), { recursive: true });
    fs.writeFileSync(store(cfg), JSON.stringify({ peers: [
        { dnsName: LAB, name: 'lab', token: TOKEN, paired: T, seen: null, last: null },
        { dnsName: 'ws2.t.ts.net', name: 'ws2', token: TOKEN, paired: T, seen: null, last: null },
    ] }));
    const lines = [];
    const write = process.stderr.write;
    process.stderr.write = (s) => { lines.push(String(s)); return true; };
    try {
        let n = 0;
        const poll = peers.poller(cfg, async (o) => {
            n++;
            if (o.url.includes('ws2')) throw new Error('ECONNRESET');
            return { status: 200, headers: {}, body: Buffer.from('<html>captive portal</html>') };
        });
        poll.machines([], T);
        assert.ok(await until(() => n >= 2 && poll.machines([], T).every((x) => x.state === 'off')), 'first round');
        poll.machines([], T + 10e3);
        assert.ok(await until(() => n >= 4 && poll.machines([], T + 10e3).every((x) => x.state === 'off')), 'second round');
        await new Promise((r) => setTimeout(r, 20));
    } finally {
        process.stderr.write = write;
    }
    assert.equal(lines.filter((l) => l.includes(LAB)).length, 1);
    assert.match(lines.find((l) => l.includes(LAB)), /lab\.t\.ts\.net is off — answered 200 with no JSON/);
    assert.match(lines.find((l) => l.includes('ws2')), /ws2\.t\.ts\.net is off — no answer: ECONNRESET/);
});

test('poller: kick(dnsName) after a re-pair forgets that computer\'s refusal at once', async () => {
    const cfg = tmp('fankeel-peers-');
    fs.mkdirSync(path.dirname(store(cfg)), { recursive: true });
    const last = { host: 'lab', tasks: [{ id: 'old' }] };
    fs.writeFileSync(store(cfg), JSON.stringify({ peers: [{ dnsName: LAB, name: 'lab', token: TOKEN, paired: T, seen: T - 60e3, last }] }));
    let answer = 'refuse';
    let release = null;
    const poll = peers.poller(cfg, async () => {
        if (answer === 'ok') return { status: 200, headers: {}, body: Buffer.from(JSON.stringify(last)) };
        if (answer === 'hold') await new Promise((r) => { release = r; });
        return { status: 401, headers: {}, body: Buffer.from('pair this phone first') };
    });
    poll.machines([], T);
    assert.ok(await until(() => poll.machines([], T)[0].refused), 'refused first');
    answer = 'hold';
    poll.machines([], T + 10e3);
    assert.ok(await until(() => release), 'a read with the old token is in flight');
    poll.kick(LAB);
    const now = poll.machines([], T + 10e3)[0];
    assert.deepEqual([now.state, now.refused, now.body], ['wait', false, null]);
    answer = 'ok';
    release();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(poll.machines([], T + 10e3)[0].refused, false, 'the old token\'s 401 is dropped');
});
