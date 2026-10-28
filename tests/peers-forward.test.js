'use strict';
// lib/peers.js forward (Task 3 of docs/90-agent/plans/2026-10-29-mobile-sources.md): a phone's
// request for a session on another computer, passed on with this station's token for it —
// only the phone's own session routes, never anything else.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const peers = require('../lib/peers.js');
const tmp = require('./tmp.js');

const LAB = 'lab.t.ts.net';
const TOKEN = 'T'.repeat(43);
function cfg() {
    const dir = tmp('fankeel-peers-forward-');
    fs.mkdirSync(path.join(dir, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'fankeel', 'peers.json'), JSON.stringify({ peers: [{ dnsName: LAB, name: 'lab', token: TOKEN, paired: 1, seen: null, last: null }] }));
    return dir;
}

test('forward: a GET goes with the token, a POST also with that computer\'s Origin and the body', async () => {
    const calls = [];
    const send = async (o) => { calls.push(o); return { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"ok":1}') }; };
    const got = await peers.forward(cfg(), 'lab', 'GET', '/station/phone.json?id=abc', {}, null, send);
    assert.deepEqual([got.status, got.type, String(got.body)], [200, 'application/json', '{"ok":1}']);
    assert.equal(calls[0].url, 'https://' + LAB + '/station/phone.json?id=abc');
    assert.equal(calls[0].headers.cookie, 'fk_device=' + TOKEN);
    const body = Buffer.from('root=%2Fr&id=abc&text=hi');
    await peers.forward(cfg(), 'lab', 'POST', '/phone/say', { 'content-type': 'application/x-www-form-urlencoded', cookie: 'fk_device=PHONE' }, body, send);
    assert.equal(calls[1].method, 'POST');
    assert.equal(calls[1].headers.origin, 'https://' + LAB);
    assert.equal(calls[1].headers.cookie, 'fk_device=' + TOKEN, 'never the phone\'s own cookie');
    assert.equal(calls[1].headers['content-type'], 'application/x-www-form-urlencoded');
    assert.equal(String(calls[1].body), String(body));
});

test('forward: an unlisted path or an unpaired name is 404 and nothing is sent', async () => {
    let sent = 0;
    const send = async () => { sent++; return { status: 200, headers: {}, body: Buffer.from('') }; };
    for (const [m, p] of [['GET', '/station/station-data.js'], ['POST', '/station/remote/revoke'], ['GET', '/station/mobile.json'], ['POST', '/station/phone.json']]) {
        assert.equal((await peers.forward(cfg(), 'lab', m, p, {}, null, send)).status, 404, m + ' ' + p);
    }
    assert.equal((await peers.forward(cfg(), 'ws9', 'GET', '/station/phone.json?id=x', {}, null, send)).status, 404);
    assert.equal(sent, 0);
});

test('forward: that computer refusing this station\'s token, or not answering, is 502 — never a 401 the phone would read as its own', async () => {
    const refused = await peers.forward(cfg(), 'lab', 'GET', '/station/phone.json?id=x', {}, null, async () => ({ status: 401, headers: {}, body: Buffer.from('pair this phone first') }));
    assert.equal(refused.status, 502);
    assert.match(String(refused.body), /lab/);
    const silent = await peers.forward(cfg(), 'lab', 'GET', '/station/phone.json?id=x', {}, null, async () => { throw new Error('timed out'); });
    assert.equal(silent.status, 502);
});
