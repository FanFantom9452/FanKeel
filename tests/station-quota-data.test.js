'use strict';
// Task 5 of docs/90-agent/plans/2026-10-30-spend-quota.md: serialize carries the quota
// series per account, and each session's account, task segments and spend bins.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const quota = require('../lib/quota.js');
const tmp = require('./tmp.js');

const SID = 'cccccccc-1111-4111-8111-111111111111';
const parse = (js) => JSON.parse(js.replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
function setup() {
    const base = tmp('fankeel-quota-data-');
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
    const resets = new Date(now + 3 * 864e5).toISOString();
    const rows = [20, 24].map((seven, i) => JSON.stringify({ at: new Date(now - (2 - i) * 600e3).toISOString(), task: 't', stage: 'build',
        five: 5 + i, fiveResets: new Date(now + 3600e3).toISOString(), seven, sevenResets: resets, account: 'uuid-1' }));
    fs.mkdirSync(path.join(r, '.fankeel', 'build', 'limits'), { recursive: true });
    fs.writeFileSync(path.join(r, '.fankeel', 'build', 'limits', SID + '.jsonl'), rows.join('\n') + '\n');
    return { m: station.gather({ configDir: cfg }), now, resets };
}

test('the page carries each account\'s series and each session\'s account', () => {
    const { m, resets } = setup();
    const page = parse(station.serialize(m, {}));
    const key = quota.resetKey(Date.parse(resets));
    assert.deepEqual(page.quota.accounts.map((a) => [a.key, a.steps7.length, a.windows.length]), [[key, 2, 1]]);
    assert.equal(page.sessions[0].account, key);
});

test('a root hidden by station.hide leaves its limits readings out of the account series', () => {
    const { m } = setup();
    const r = m.registries[0];
    r.profiles = Object.assign({}, r.profiles, { [r.root]: { values: { 'station.hide': true }, sources: {}, unreadable: [] } });
    assert.deepEqual(parse(station.serialize(m, {})).quota.accounts, []);
});

test('a session\'s segments and bins come from its detail, and a question still out is a gate up to now', () => {
    const { m, now } = setup();
    const s = m.registries[0].sessions[0];
    s.detail = { segments: [{ task: 't', start: now - 3000e3, end: now - 600e3, stages: [{ stage: 'build', start: now - 3000e3, end: now - 600e3 }], gates: [] }],
        bins: [[now - 3000e3, 1.5]], days: [], spans: [], events: [] };
    s.gateAt = now - 300e3;
    const page = parse(station.serialize(m, {}));
    const at = Date.parse(m.generatedAt);
    assert.deepEqual(page.sessions[0].bins, [[now - 3000e3, 1.5]]);
    assert.deepEqual(page.sessions[0].segments[0].gates, [{ start: now - 300e3, end: at }]);
    assert.equal(page.sessions[0].segments[0].end, at);
    assert.deepEqual(s.detail.segments[0].gates, [], 'the detail itself is not changed');
});

test('a session that died at a gate keeps its segments as they were', () => {
    const { m, now } = setup();
    const s = m.registries[0].sessions[0];
    const seg = { task: 't', start: now - 3000e3, end: now - 600e3, stages: [{ stage: 'build', start: now - 3000e3, end: now - 600e3 }], gates: [] };
    s.detail = { segments: [seg], bins: [], days: [], spans: [], events: [] };
    s.gateAt = now - 300e3;
    s.state = 'down';
    delete s.ended;
    const page = parse(station.serialize(m, {}));
    assert.deepEqual(page.sessions[0].segments, [seg]);
});

test('a session with no detail has no segments and no bins', () => {
    const { m } = setup();
    m.registries[0].sessions[0].detail = null;
    const page = parse(station.serialize(m, {}));
    assert.deepEqual([page.sessions[0].segments, page.sessions[0].bins], [null, null]);
});
