'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'aaaaaaaa-1111-4111-8111-111111111111';
const FIELDS = { ask: '留一份紀錄。', did: ['寫六欄紀錄'], why: '原本沒有。', checked: '測試全過。', cost: '$1.00，5 分，0 個 agent。', left: '沒有。' };

function page(extra) {
    const base = tmp('fankeel-record-data-');
    const cfg = path.join(base, 'cfg');
    const r = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r);
    const now = Date.now();
    registry.writeSession(r, SID, Object.assign({ task: 't', project: 'ws', stage: 'land', route: ['build', 'land'],
        active: true, claims: [], started: new Date(now - 3600e3).toISOString(), updated: new Date(now - 60e3).toISOString(),
        configDir: cfg }, extra));
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: SID, cwd: r, startedAt: new Date(now - 3600e3).toISOString(),
        procStart: 0, version: '2.0.0', kind: 'interactive', entrypoint: 'cli', status: 'idle' }));
    const m = station.gather({ configDir: cfg });
    return JSON.parse(station.serialize(m, {}).replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
}

test('a session with a record carries it to the page whole', () => {
    const rec = { at: '2026-10-19T10:00:00.000Z', file: 'docs/90-agent/records/2026-10.md', anchor: 'r-2026-10-19-aaaaaaaa', fields: FIELDS };
    assert.deepEqual(page({ record: rec }).sessions[0].record, rec);
});

test('a session without one, or with a broken one, carries null', () => {
    assert.equal(page({}).sessions[0].record, null);
    assert.equal(page({ record: 'x' }).sessions[0].record, null);
    assert.equal(page({ record: { at: 'x' } }).sessions[0].record, null);
});
