'use strict';
// serve()'s shared gather and its file list (design §5): station-data.js
// requests inside two seconds share one gather(), a POST drops it, and the
// static files are a fixed list that now includes the tour and i18n.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SID = 'dddddddd-4444-4444-8444-444444444444';

function fixture() {
    const base = tmp('fankeel-memo-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(ws);
    const now = Date.now();
    registry.writeSession(ws, SID, { task: 'memo', stage: 'build', route: ['survey', 'build'], active: false, claims: [],
        started: new Date(now - 60000).toISOString(), updated: new Date(now - 30000).toISOString(), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: new Date(now).toISOString() }) + '\n');
    return { cfg };
}

const get = (url, opts) => new Promise((resolve, reject) => {
    const req = http.request(url, opts || { method: 'GET' }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    req.end();
});
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

// Counts gather() calls from the moment serve() has bound.
async function counted(t, extra) {
    const f = fixture();
    const real = station.gather;
    let calls = 0;
    t.mock.method(station, 'gather', function (o) { calls++; return real.call(this, o); });
    const s = await serve(Object.assign({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false }, extra));
    calls = 0;
    return { s, calls: () => calls };
}

test('two station-data.js requests inside the default window share one gather()', async (t) => {
    const { s, calls } = await counted(t);
    try {
        const [a, b] = await Promise.all([get(s.url + 'station/station-data.js'), get(s.url + 'station/station-data.js')]);
        assert.equal(a.status, 200);
        assert.equal(b.status, 200);
        assert.match(a.text, /^window\.STATION = /);
        await get(s.url + 'station/station-data.js');
        assert.equal(calls(), 1);
    } finally {
        s.close();
    }
});

test('past the window the next request gathers again', async (t) => {
    const { s, calls } = await counted(t, { memoMs: 30 });
    try {
        await get(s.url + 'station/station-data.js');
        await wait(80);
        await get(s.url + 'station/station-data.js');
        assert.equal(calls(), 2);
    } finally {
        s.close();
    }
});

test('a POST drops the shared model, even one the nonce refuses', async (t) => {
    const { s, calls } = await counted(t, { memoMs: 60e3 });
    try {
        await get(s.url + 'station/station-data.js');
        const refused = await get(s.url + 'clear', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
        assert.equal(refused.status, 403);
        await get(s.url + 'station/station-data.js');
        assert.equal(calls(), 2);
    } finally {
        s.close();
    }
});

test('the tour files and i18n.js are on the list, byte for byte, with their content types', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        for (const [name, type] of [['tour.js', /text\/javascript/], ['tour.html', /text\/html/], ['tour.css', /text\/css/],
            ['tour-player.js', /text\/javascript/], ['station.js', /text\/javascript/], ['station.css', /text\/css/]]) {
            const res = await get(s.url + 'station/' + name);
            assert.equal(res.status, 200, name);
            assert.match(res.headers['content-type'], type, name);
            assert.equal(res.headers['cache-control'], 'no-store', name);
            assert.equal(res.text, fs.readFileSync(path.join(ASSETS, name), 'utf8'), name);
        }
    } finally {
        s.close();
    }
});

test('every script tour.html loads, including the multi-hyphen reel files, is served', async () => {
    const html = fs.readFileSync(path.join(ASSETS, 'tour.html'), 'utf8');
    const names = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
    assert.ok(names.includes('tour-reel-kit.js'), names.join(', '));
    const f = fixture();
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        for (const name of names) {
            const res = await get(s.url + 'station/' + name);
            assert.equal(res.status, 200, name);
        }
    } finally {
        s.close();
    }
});

test('a name off the list is a 404, whatever sits in the assets directory', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        for (const name of ['index.html', 'tour.json', 'Tour.js', 'tour_x.js', '..%2F..%2Fpackage.json', 'station-x.js']) {
            assert.equal((await get(s.url + 'station/' + name)).status, 404, name);
        }
    } finally {
        s.close();
    }
});
