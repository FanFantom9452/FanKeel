'use strict';
// The station's per-session detail: read by lib/detail.js inside gather(),
// written by write() as one script per session beside the data file, and
// served by `serve` at the same path. The data file itself carries only the
// few numbers the list and the overview read.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const detail = require('../lib/detail.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'dddddddd-4444-4444-8444-444444444444';
const BARE = 'eeeeeeee-5555-4555-8555-555555555555';
const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';

// One ended session with a transcript and a verify-to-build step in its moves,
// and one with no transcript on this machine at all.
function fixture() {
    const base = tmp('fankeel-station-detail-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'projects', 'ws-slug'), { recursive: true });
    registry.ensureLayout(r1);
    const common = { stage: 'build', route: ['survey', 'build', 'verify'], active: false, claims: [],
        started: T(0), updated: T(9), configDir: cfg, ended: { at: T(9), reason: 'exit' },
        moves: [['survey', 1], ['build', 2], ['verify', 3], ['build', 4]] };
    registry.writeSession(r1, SID, Object.assign({ task: 'with a transcript' }, common));
    registry.writeSession(r1, BARE, Object.assign({ task: 'without one' }, common));
    fs.writeFileSync(path.join(cfg, 'projects', 'ws-slug', SID + '.jsonl'),
        line({ type: 'assistant', requestId: 'r1', timestamp: T(1), message: { model: 'claude-sonnet-5', usage: { input_tokens: 900 }, content: [] } })
        + line({ type: 'assistant', requestId: 'r2', timestamp: T(2), message: { model: 'claude-sonnet-5', usage: { input_tokens: 2000 }, content: [] } }));
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: T(0) }) + '\n');
    return { cfg, r1 };
}

const run = (js) => {
    const window = {};
    vm.runInNewContext(js, { window });
    return window;
};

test('write leaves a detail script for a session with a transcript, beside both copies, and keeps it out of the data file', () => {
    const f = fixture();
    station.write({ configDir: f.cfg, root: f.r1 });
    for (const into of [path.join(f.cfg, 'fankeel'), path.join(f.r1, '.fankeel')]) {
        const js = fs.readFileSync(path.join(into, 'station', 'detail', SID + '.js'), 'utf8');
        const d = run(js).STATION_DETAIL[SID];
        assert.deepEqual([d.requests, d.peak, d.backtracks, d.seqSource], [2, 2000, 1, 'moves']);
        assert.equal(JSON.stringify(d.tasks), '[]', 'no plan claimed, no task list');
        assert.ok(!fs.existsSync(path.join(into, 'station', 'detail', BARE + '.js')), 'no transcript, no script');
    }
    const data = fs.readFileSync(path.join(f.cfg, 'fankeel', 'station', 'station-data.js'), 'utf8');
    const rows = run(data).STATION.sessions;
    const has = rows.find((s) => s.id === SID);
    const bare = rows.find((s) => s.id === BARE);
    assert.deepEqual([has.hasDetail, has.backtracks, has.peak], [true, 1, 2000]);
    assert.deepEqual([bare.hasDetail, bare.backtracks, bare.peak], [false, 1, null], 'moves count the same step without a transcript');
    assert.ok(!data.includes('"points"'), 'the detail stays out of station-data.js');
});

test('details: false reads no transcript, and a spent budget reuses the cache rather than reading', () => {
    const f = fixture();
    const find = (m, id) => m.registries[0].sessions.find((s) => s.sessionId === id);
    assert.equal(find(station.gather({ configDir: f.cfg, details: false }), SID).detail, null);
    assert.equal(find(station.gather({ configDir: f.cfg, detailBudgetMs: -1 }), SID).detail, null, 'nothing cached yet, nothing read');
    assert.equal(find(station.gather({ configDir: f.cfg }), SID).detail.requests, 2);
    assert.equal(find(station.gather({ configDir: f.cfg, detailBudgetMs: -1 }), SID).detail.requests, 2, 'the cache is reused');
});

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
    }).on('error', reject);
});

test('serve answers a session\'s detail script, and 404 for a session with none', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const ok = await get(s.url + 'station/detail/' + SID + '.js');
        assert.equal(ok.status, 200);
        assert.equal(run(ok.text).STATION_DETAIL[SID].requests, 2);
        assert.equal((await get(s.url + 'station/detail/' + BARE + '.js')).status, 404);
    } finally {
        s.close();
    }
});

// The overview and the project page add up `days` from station-data.js alone.
// A session whose transcript is gone keeps an older cache with no `days`, and
// its usd is spent whole on the local day it started.
const KEPT = 'aaaaaaaa-6666-4666-8666-666666666666';
const OTHER = 'bbbbbbbb-7777-4777-8777-777777777777';
// What `run()` builds belongs to another realm, and a strict deepEqual compares
// prototypes too; through JSON both sides are plain.
const plain = (v) => JSON.parse(JSON.stringify(v));

test('station-data.js carries each session days and spans, a kept cache usd on its own day, and a key per project', () => {
    const f = fixture();
    const common = { stage: 'build', route: ['survey', 'build'], active: false, claims: [],
        started: T(0), updated: T(9), configDir: f.cfg, ended: { at: T(9), reason: 'exit' } };
    // Local noon, so `started` falls on 2026-08-15 in every time zone; the
    // cache's own `day` is a day off, so the row shows which of the two it read.
    const noon = new Date(2026, 7, 15, 12, 0, 0).toISOString();
    registry.writeSession(f.r1, KEPT, Object.assign({}, common, { task: 'transcript gone', project: 'app-a', started: noon }));
    registry.writeSession(f.r1, OTHER, Object.assign({}, common, { task: 'another project', project: 'app-b' }));
    const old = { v: 1, sessionId: KEPT, day: '2026-08-14', model: 'claude-sonnet-5', usd: 1.25, rows: [], backtracks: 0, peak: 0, key: 'gone', at: 0 };
    const cache = detail.cachePath(f.cfg, KEPT);
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, JSON.stringify(old));
    station.write({ configDir: f.cfg });
    const into = path.join(f.cfg, 'fankeel', 'station');
    const by = Object.fromEntries(run(fs.readFileSync(path.join(into, 'station-data.js'), 'utf8')).STATION.sessions.map((s) => [s.id, s]));
    const d = run(fs.readFileSync(path.join(into, 'detail', SID + '.js'), 'utf8')).STATION_DETAIL[SID];
    assert.ok(d.days.length > 0, 'the session with a transcript has days of its own');
    assert.deepEqual(plain([by[SID].days, by[SID].spans]), plain([d.days, d.spans]));
    assert.deepEqual(plain([by[KEPT].days, by[KEPT].spans]),
        [[{ day: '2026-08-15', stage: null, model: 'claude-sonnet-5', who: 'main', tokens: null, cost: null, usd: 1.25 }], null]);
    assert.deepEqual([by[BARE].days, by[BARE].spans], [null, null]);
    const root = path.resolve(f.r1);
    assert.deepEqual([by[SID].pkey, by[KEPT].pkey, by[OTHER].pkey], [root, root + '/app-a', root + '/app-b']);
});
