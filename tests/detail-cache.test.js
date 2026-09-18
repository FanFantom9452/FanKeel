'use strict';
// detailOf: one session's detail, cached under <configDir>/fankeel/station/cache/
// and keyed on the size and mtime of the transcript and its agents' files.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const SID = '11111111-2222-4333-8444-555555555555';
const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const said = (rid, s, context, content) => line({ type: 'assistant', requestId: rid, timestamp: T(s),
    message: { model: 'claude-sonnet-5', usage: { input_tokens: context, output_tokens: 10 }, content: content || [] } });

function setup() {
    const cfg = tmp('fankeel-detail-cache-');
    const dir = path.join(cfg, 'projects', 'F--some-project');
    fs.mkdirSync(dir, { recursive: true });
    const t = path.join(dir, SID + '.jsonl');
    fs.writeFileSync(t, said('r1', 1, 1000, [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'node scripts/task.js start --task x' } }])
        + line({ type: 'user', timestamp: T(2), message: { content: [{ type: 'tool_result', tool_use_id: 'b1', content: 'fankeel — started' }] } })
        + said('r2', 3, 5000));
    const data = { route: ['survey', 'build'], stage: 'survey', started: '2026-09-11T10:00:00.000Z', project: 'p', claims: [] };
    return { cfg, t, data };
}

test('transcriptOf finds the session under any project directory, and nothing is null', () => {
    const f = setup();
    assert.equal(detail.transcriptOf(f.cfg, SID), f.t);
    assert.equal(detail.transcriptOf(f.cfg, 'nobody'), null);
    assert.equal(detail.detailOf(f.cfg, 'nobody', {}), null);
});

test('the first read is fresh and cached; an unchanged set of files is not read again; a grown transcript is', () => {
    const f = setup();
    const first = detail.detailOf(f.cfg, SID, f.data, { now: 1000 });
    assert.equal(first.fresh, true);
    assert.ok(fs.existsSync(detail.cachePath(f.cfg, SID)));
    const d = first.detail;
    assert.deepEqual([d.requests, d.points.length + d.noTime, d.peak, d.peakN], [2, 2, 5000, 2]);
    assert.deepEqual([d.project, d.day, d.class, d.backtracks, d.seqSource], ['p', '2026-09-11', 'spike', 0, 'task.js']);
    assert.deepEqual(d.marks.map((m) => [m.kind, m.stage]), [['start', 'survey']]);
    assert.equal(d.usd, d.ownUsd + d.agentUsd);
    assert.equal(detail.detailOf(f.cfg, SID, f.data).fresh, false);
    const key = detail.keyOf(f.t);
    fs.appendFileSync(f.t, said('r3', 4, 6000));
    assert.notEqual(detail.keyOf(f.t), key, 'the key moves when the transcript grows');
    const grown = detail.detailOf(f.cfg, SID, f.data);
    assert.deepEqual([grown.fresh, grown.detail.requests], [true, 3]);
});

test('an ended session cached after it ended is not stat-ed again; reuse returns the cache without reading', () => {
    const f = setup();
    detail.detailOf(f.cfg, SID, f.data, { now: Date.parse(T(30)) });
    fs.appendFileSync(f.t, said('r3', 4, 6000));
    const ended = Object.assign({}, f.data, { ended: { at: T(20), reason: 'exit' } });
    const kept = detail.detailOf(f.cfg, SID, ended);
    assert.deepEqual([kept.fresh, kept.detail.requests], [false, 2]);
    assert.deepEqual([detail.detailOf(f.cfg, SID, f.data, { reuse: true }).fresh, detail.detailOf(f.cfg, 'nobody', {}, { reuse: true })], [false, null]);
    const later = Object.assign({}, f.data, { ended: { at: T(40), reason: 'exit' } });
    assert.equal(detail.detailOf(f.cfg, SID, later).fresh, true, 'a session that ended after its cache was written is read once more');
});

// Claude Code deletes a transcript after about thirty days, and a VERSION bump
// used to drop every cache on the spot: a session older than its transcript
// then left the page altogether.
function oldCache(f, fields) {
    const old = Object.assign({ v: 1, sessionId: SID, day: '2026-08-15', model: 'claude-sonnet-5', usd: 1.25, rows: [], backtracks: 0, peak: 0 }, fields);
    const file = detail.cachePath(f.cfg, SID);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(old));
    return { old, file };
}

test('a cache from an older VERSION is read again while the transcript is there, even for a session that ended before it was written', () => {
    const f = setup();
    const { file } = oldCache(f, { key: detail.keyOf(f.t), at: Date.parse(T(30)) });
    const ended = Object.assign({}, f.data, { ended: { at: T(20), reason: 'exit' } });
    const got = detail.detailOf(f.cfg, SID, ended);
    assert.deepEqual([got.fresh, got.detail.v, Array.isArray(got.detail.days)], [true, 3, true]);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).v, 3, 'the cache is rewritten at the new version');
});

test('a cache from an older VERSION is kept as it stands once the transcript is gone, and a spent budget returns it too', () => {
    const f = setup();
    const { old, file } = oldCache(f, { key: 'gone', at: 0 });
    fs.rmSync(f.t);
    assert.equal(detail.transcriptOf(f.cfg, SID), null);
    assert.deepEqual(detail.detailOf(f.cfg, SID, f.data), { detail: old, fresh: false });
    assert.deepEqual(detail.detailOf(f.cfg, SID, f.data, { reuse: true }), { detail: old, fresh: false });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), old, 'nothing rewrote it');
});

test('a VERSION 2 cache, written before gate questions carried their labels, is read again even when its key still matches', () => {
    const f = setup();
    oldCache(f, { v: 2, key: detail.keyOf(f.t), at: Date.parse(T(30)) });
    const got = detail.detailOf(f.cfg, SID, f.data);
    assert.deepEqual([got.fresh, got.detail.v], [true, 3]);
});

test('wakes counts the task notifications that reached the main transcript', () => {
    const f = setup();
    assert.equal(detail.detailOf(f.cfg, SID, f.data).detail.wakes, 0);
    fs.appendFileSync(f.t, line({ type: 'user', timestamp: T(4),
        message: { content: '<task-notification><tool-use-id>b9</tool-use-id><status>completed</status></task-notification>' } }));
    assert.equal(detail.detailOf(f.cfg, SID, f.data).detail.wakes, 1, 'the grown transcript is read again');
});
