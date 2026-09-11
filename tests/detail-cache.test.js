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
