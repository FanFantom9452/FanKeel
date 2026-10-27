'use strict';
// /station/mobile.json's `others`: the tailnet peers that answer like a station, probed in the
// background and cached; [] while remote is off.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const M = require('../assets/station/mobile.js');
const profile = require('../lib/profile.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SELF = 'me.t.ts.net';
const peer = (n, online) => ({ DNSName: n + '.t.ts.net.', Online: online });
const STATUS = { BackendState: 'Running', Self: { DNSName: SELF + '.' },
    Peer: { a: peer('off', false), b: peer('paired-not', true), c: peer('refused', true), e: { DNSName: SELF + '.', Online: true } } };

function fake() {
    let proxy = null;
    return (args) => {
        const a = args.join(' ');
        if (a === 'status --json') return { status: 0, stdout: JSON.stringify(STATUS), stderr: '' };
        if (a === 'serve status --json') return { status: 0, stdout: proxy ? JSON.stringify({ Web: { [SELF + ':443']: { Handlers: { '/': { Proxy: proxy } } } } }) : '{}', stderr: '' };
        const bg = /^serve --bg (\d+)$/.exec(a);
        if (bg) { proxy = 'http://127.0.0.1:' + bg[1]; return { status: 0, stdout: '', stderr: '' }; }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + a };
    };
}
const probeGet = async (url) => {
    if (url.includes('paired-not')) return { status: 401 };
    if (url.includes('me.t.ts.net')) return { status: 200 };
    throw new Error('refused');
};
const getJson = (port) => new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: '/station/mobile.json' }, (res) => {
        let t = '';
        res.on('data', (c) => { t += c; });
        res.on('end', () => resolve(JSON.parse(t)));
    }).on('error', reject);
});

async function booted(on, f, extra) {
    const cfg = path.join(tmp('fankeel-station-others-'), 'cfg');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    if (on) assert.equal(profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok, true);
    const s = await serve(Object.assign({ configDir: cfg, port: 0, idleMs: 60e3, open: false, tailscaleRun: fake(), probeGet }, extra));
    try { await f(Number(new URL(s.url).port)); } finally { s.close(); }
}

test('mobile.json others: [] first, then exactly the peer that answers 401, never this machine', () => booted(true, async (port) => {
    assert.deepEqual((await getJson(port)).others, []);
    let got = [];
    for (let i = 0; i < 40 && !got.length; i++) {
        await new Promise((r) => setTimeout(r, 25));
        got = (await getJson(port)).others;
    }
    assert.deepEqual(got, [{ name: 'paired-not', url: 'https://paired-not.t.ts.net/m' }]);
}));

test('mobile.json others: [] while remote is off', () => booted(false, async (port) => {
    await getJson(port);
    await new Promise((r) => setTimeout(r, 200));
    assert.deepEqual((await getJson(port)).others, []);
}));

// The 60 s cache: count the probe rounds (one status call plus one probeGet per probed peer).
const PROBED = 2;
function counted(hold) {
    const c = { gets: 0, statuses: 0 };
    const run = fake();
    c.opts = {
        idleMs: 0,
        tailscaleRun: (args) => { if (args.join(' ') === 'status --json') c.statuses++; return run(args); },
        probeGet: async (url) => { c.gets++; if (hold) await hold; return probeGet(url); },
    };
    return c;
}
const until = async (fn) => { for (let i = 0; i < 80 && !fn(); i++) await new Promise((r) => setTimeout(r, 10)); };
const settle = () => new Promise((r) => setTimeout(r, 80));

test('others cache: requests inside the minute run one probe round, the next minute runs exactly one more', (t) => {
    const c = counted();
    const real = Date.now.bind(Date);
    let off = 0;
    t.mock.method(Date, 'now', () => real() + off);
    return booted(true, async (port) => {
        const base = c.statuses;
        await getJson(port);
        await until(() => c.gets >= PROBED);
        for (let i = 0; i < 4; i++) await getJson(port);
        await settle();
        assert.equal(c.gets, PROBED);
        assert.equal(c.statuses - base, 1);
        off = 61e3;
        await getJson(port);
        await getJson(port);
        await until(() => c.gets >= 2 * PROBED);
        await settle();
        assert.equal(c.gets, 2 * PROBED);
        assert.equal(c.statuses - base, 2);
    }, c.opts);
});

test('others cache: a request while a round is still busy starts no second round', (t) => {
    let release;
    const c = counted(new Promise((r) => { release = r; }));
    const real = Date.now.bind(Date);
    let off = 0;
    t.mock.method(Date, 'now', () => real() + off);
    return booted(true, async (port) => {
        const base = c.statuses;
        await getJson(port);
        await until(() => c.gets >= PROBED);
        off = 61e3;
        await getJson(port);
        await getJson(port);
        await settle();
        assert.equal(c.gets, PROBED);
        assert.equal(c.statuses - base, 1);
        release();
        await settle();
    }, c.opts);
});

test('others whole path: mobile.json others, fed to the 測站 sheet, give exactly the one https /m link', () => booted(true, async (port) => {
    await getJson(port);
    let others = [];
    for (let i = 0; i < 40 && !others.length; i++) {
        await new Promise((r) => setTimeout(r, 25));
        others = (await getJson(port)).others || [];
    }
    const NOW = Date.UTC(2026, 9, 28, 6, 0);
    const html = M.screen({ host: 'office-pc', at: NOW, device: null, gates: [], tasks: [], done: [], others }, M.parseRoute('#/'), NOW, { mode: 'app', open: {}, sheet: true });
    const blk = /data-block="m-machines"[\s\S]*?<\/section>/.exec(html)[0];
    assert.deepEqual(blk.match(/<a [^>]*href="[^"]*"/g).map((a) => /href="([^"]*)"/.exec(a)[1]), ['https://paired-not.t.ts.net/m']);
}));
