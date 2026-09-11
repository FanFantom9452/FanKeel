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
