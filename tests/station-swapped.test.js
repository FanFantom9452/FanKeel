'use strict';
// Task 6 of docs/90-agent/plans/2026-10-30-spend-quota.md: 最常被換掉 counts
// `verify (Recommended)` and `verify` as one option.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'dddddddd-1111-4111-8111-111111111111';
const parse = (js) => JSON.parse(js.replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
function model(events) {
    const base = tmp('fankeel-swapped-');
    const cfg = path.join(base, 'cfg');
    const r = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r);
    const now = Date.now();
    registry.writeSession(r, SID, { task: 't', project: 'ws', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: new Date(now - 3600e3).toISOString(), updated: new Date(now - 60e3).toISOString(), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: SID, cwd: r, startedAt: new Date(now - 3600e3).toISOString(),
        procStart: 0, version: '2.0.0', kind: 'interactive', entrypoint: 'cli', status: 'idle' }));
    const m = station.gather({ configDir: cfg });
    m.registries[0].sessions[0].detail = { events, days: [], spans: [] };
    return m;
}
const gate = (labels, a) => ({ kind: 'gate', qs: [{ labels, a }] });

test('verify (Recommended) and verify are one swapped entry; picking option one is not a swap', () => {
    const m = model([
        gate(['verify (Recommended)', 'build'], 'verify (Recommended)'),
        gate(['verify', 'build'], 'build'),
        gate(['land（建議）', 'stay'], 'stay'),
        gate(['land (建議)', 'stay'], 'land (建議)'),
    ]);
    assert.deepEqual(parse(station.serialize(m, {})).gates.swapped, [
        { label: 'verify', lost: 1, total: 2 },
        { label: 'land', lost: 1, total: 2 },
    ]);
});

test('with no transcript events the entry\'s own gates count the same way, (Recommended) stripped from option one and the pick', () => {
    const m = model([]);
    m.registries[0].sessions[0].gates = [
        { labels: ['verify (Recommended)', 'build'], picked: 'verify (Recommended)' },
        { labels: ['verify', 'build'], picked: 'build' },
    ];
    assert.deepEqual(parse(station.serialize(m, {})).gates.swapped, [{ label: 'verify', lost: 1, total: 2 }]);
});
