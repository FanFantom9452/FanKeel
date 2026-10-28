'use strict';
// Task 5 of docs/90-agent/plans/2026-10-29-mobile-sources.md: a session on another computer is read
// through /station/peer/<name>/…; when that computer cannot be read, the screen keeps the app and the
// session's head and says which computer and why, never "cannot reach this station". The 測站 sheet's
// code box pairs this station with another computer.
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, target, settle } = require('./mobile-dom.js');

const NOW = Date.now();
const M = {
    host: 'office', at: NOW, device: { name: 'iPhone', paired: NOW - 864e5 }, gates: [], stopped: [], done: [], others: [],
    tasks: [{ id: 't2', root: '/r', task: 'train', project: 'lab', stage: 'build', route: ['build'], gate: false, updated: NOW - 6e4, state: 'running', attached: false, background: [], last: null, holdUntil: null, machine: 'lab' }],
    unregistered: [{ id: 'u2', cwd: 'D:\\lab\\x', entrypoint: 'cli', name: 'lab job', status: 'busy', bridge: false, started: NOW - 6e5, machine: 'lab' }],
    rc: { live: [], ended: [] },
    machines: [
        { name: 'office', url: null, state: 'on', me: true, seen: NOW, paired: null, refused: false, n: 1 },
        { name: 'ws1', url: 'https://ws1.t.ts.net/m', state: 'unpaired', me: false, seen: null, paired: null, refused: false, n: 0 },
    ],
};
const res = (status, text) => Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(M), text: () => Promise.resolve(text) });

// The boot, with every /station/peer/ read answered by `peer` and this station's own reads by `own`.
async function page(hash, peer, own) {
    const b = boot('#/', { home: M, one: null });
    await settle();
    b.win.fetch = (url) => (url === '/station/mobile.json' ? res(200, '') : url.startsWith('/station/peer/') ? peer() : own());
    b.goto(hash);
    await settle();
    return b.app.innerHTML;
}

test('a computer that cannot be read keeps the session head and names it with the reason, for 502, 404, 403 and no answer', async () => {
    const cases = [
        ['#/u/lab/u2', () => res(502, 'cannot reach lab: connect ETIMEDOUT'), /cannot reach lab: connect ETIMEDOUT/],
        ['#/u/lab/u2', () => res(502, 'lab refused this station: pair it again from the 測站 sheet'), /pair it again from the 測站 sheet/],
        ['#/u/lab/u2', () => res(404, 'no paired computer named lab'), /no paired computer named lab/],
        ['#/m/lab/t2', () => res(403, 'no paired phone'), /no paired phone/],
        ['#/m/lab/t2', () => Promise.reject(new Error('net')), /這台測站沒回話，等一下會再讀/],
    ];
    for (const [hash, peer, why] of cases) {
        const h = await page(hash, peer, () => res(500, ''));
        assert.doesNotMatch(h, /data-block="pair-error"/, hash + ' ' + why);
        assert.doesNotMatch(h, /這個 session 不在了/, hash + ' ' + why);
        assert.match(h, hash.startsWith('#/u/') ? /data-block="session-head-unregistered"/ : /<p class="ch-t">train<\/p>/);
        const note = /<p class="note" role="status">([^<]*)<\/p>/.exec(h);
        assert.ok(note, hash + ' ' + why + ' has no note');
        assert.match(note[1], /讀不到 lab/);
        assert.match(note[1], why);
    }
    const esc = await page('#/u/lab/u2', () => res(502, '<b>x</b>'), () => res(500, ''));
    assert.match(esc, /&lt;b&gt;x&lt;\/b&gt;/);
});

// The session on lab read through the peer path: `reply.peer` answers each read, so a test swaps it between polls.
async function chat(reply) {
    const b = boot('#/', { home: M, one: null });
    await settle();
    b.win.fetch = (url) => (url === '/station/mobile.json' ? res(200, '') : reply.peer());
    b.goto('#/u/lab/u2');
    await settle();
    return b;
}
const PU = { id: 'u2', machine: 'lab', name: 'lab job', task: '', cwd: 'D:\\lab\\x', entrypoint: 'cli', bridge: false, status: 'busy', state: 'running',
    chat: [{ role: 'assistant', text: 'back again', at: NOW - 3e4 }], at: NOW, context: null, limits: null };
const NOTE = /<p class="note" role="status">讀不到 lab/;

test('a computer read again after a 502 drops the note and draws the session', async () => {
    const reply = { peer: () => res(502, 'cannot reach lab: connect ETIMEDOUT') };
    const b = await chat(reply);
    assert.match(b.app.innerHTML, NOTE);
    reply.peer = () => Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve(PU), text: () => Promise.resolve('') });
    await b.poll();
    assert.doesNotMatch(b.app.innerHTML, NOTE);
    assert.match(b.app.innerHTML, /back again/);
});

test('the same 502 read twice draws once, so a poll does not take the composer\'s focus', async () => {
    const reply = { peer: () => res(502, 'cannot reach lab: connect ETIMEDOUT') };
    const b = await chat(reply);
    assert.match(b.app.innerHTML, NOTE);
    let draws = 0;
    const html = Object.getOwnPropertyDescriptor(b.app, 'innerHTML');
    Object.defineProperty(b.app, 'innerHTML', { get: html.get, set(v) { draws++; html.set.call(this, v); } });
    await b.poll();
    assert.equal(draws, 0);
    reply.peer = () => res(502, 'lab refused this station: pair it again from the 測站 sheet');
    await b.poll();
    assert.equal(draws, 1, 'a new reason is drawn');
});

test('this station\'s own failures keep their screens: 404 is gone, no answer is pair-error, 401 is unpaired', async () => {
    assert.match(await page('#/u/office/u1', () => res(200, ''), () => res(404, 'gone')), /這個 session 不在了/);
    assert.match(await page('#/u/office/u1', () => res(200, ''), () => Promise.reject(new Error('net'))), /data-block="pair-error"/);
    assert.doesNotMatch(await page('#/u/lab/u2', () => res(401, ''), () => res(200, '')), /data-block="session-head-unregistered"/);
});

test('the sheet\'s code box posts dnsName and code to /station/peers/pair, redraws on 201 and notes a refusal', async () => {
    for (const [status, text, says] of [[201, '', /配對好了，下一輪就會讀到它/], [400, 'bad code', /配對沒成功（400）：bad code/]]) {
        const b = boot('#/', { home: M, one: null });
        await settle();
        const posts = [];
        let reads = 0;
        b.win.fetch = (url, o) => {
            if (url === '/station/mobile.json') { reads++; return res(200, ''); }
            posts.push({ url, body: o && o.body });
            return res(status, text);
        };
        b.fire('click', { target: target({ 'data-act': 'sheet' }), preventDefault() {} });
        const f = target({ 'data-peer-form': 'ws1.t.ts.net' });
        f.querySelector = () => ({ value: 'abcd2345' });
        b.fire('submit', { target: f, preventDefault() {} });
        await settle();
        assert.equal(posts.length, 1);
        assert.equal(posts[0].url, '/station/peers/pair');
        const sent = new URLSearchParams(posts[0].body);
        assert.equal(sent.get('dnsName'), 'ws1.t.ts.net');
        assert.equal(sent.get('code'), 'ABCD2345');
        assert.equal(reads, 1, 'the list is read again');
        assert.match(b.app.innerHTML, /data-block="m-remote-sheet"/);
        assert.match(/<p class="note" role="status">([^<]*)<\/p>/.exec(b.app.innerHTML)[1], says);
    }
});
