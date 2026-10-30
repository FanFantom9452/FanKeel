'use strict';
// Task 3 of docs/90-agent/plans/2026-10-30-spend-quota.md: a session's transcript cut
// into task segments, each request carrying its task, and the spend in 5-minute bins.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const SID = '22222222-3333-4444-8555-666666666666';
// Local wall-clock times, so the day and the 5-minute bin are the same in every zone.
const L = (h, m) => new Date(2026, 9, 30, h, m, 0).toISOString();
const at = (h, m) => Date.parse(L(h, m));
const U = { input_tokens: 1000, output_tokens: 100 };
const line = (o) => JSON.stringify(o) + '\n';
const said = (rid, t, content) => line({ type: 'assistant', requestId: rid, timestamp: t, message: { model: 'claude-opus-5', usage: U, content: content || [] } });
const bash = (id, command) => ({ type: 'tool_use', id, name: 'Bash', input: { command } });
const back = (t, id) => line({ type: 'user', timestamp: t, message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });

function onDisk(lines) {
    const cfg = tmp('fankeel-detail-segments-');
    const dir = path.join(cfg, 'projects', 'F--seg-project');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, SID + '.jsonl'), lines.join(''));
    return cfg;
}

test('taskCalls reads task names only when asked, and its default output is what it was', () => {
    assert.deepEqual(detail.taskCalls('node scripts/task.js start --session s --task "x y" --route build', true), [{ verb: 'start', stage: 'build', task: 'x y' }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js task --session s "new name"', true), [{ verb: 'task', stage: null, task: 'new name' }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js down --session s', true), [{ verb: 'down', stage: null, task: null }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js stage build', true), [{ verb: 'stage', stage: 'build', task: null }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js task --session s "new name"'), []);
    assert.deepEqual(detail.taskCalls('node scripts/task.js start --task t'), [{ verb: 'start', stage: 'survey' }]);
});

test('a rename mid-transcript cuts two task segments, each with its own stages, and every request carries its task', () => {
    const cfg = onDisk([
        said('m1', L(10, 0), [bash('b1', 'node scripts/task.js start --session s --task alpha --route build,verify')]),
        back(L(10, 0), 'b1'),
        said('m2', L(10, 30)),
        said('m3', L(11, 0), [bash('b3', 'node scripts/task.js task --session s beta')]),
        back(L(11, 0), 'b3'),
        said('m4', L(11, 30)),
        said('m5', L(12, 0), [bash('b5', 'node scripts/task.js stage verify --session s')]),
        back(L(12, 0), 'b5'),
        said('m6', L(12, 30)),
    ]);
    const d = detail.detailOf(cfg, SID, { route: ['build', 'verify'], stage: 'verify', task: 'beta' }).detail;
    assert.equal(d.v, 11);
    assert.deepEqual(d.segments, [
        { task: 'alpha', start: at(10, 0), end: at(11, 0), stages: [{ stage: 'build', start: at(10, 0), end: at(11, 0) }], gates: [] },
        { task: 'beta', start: at(11, 0), end: at(12, 30),
            stages: [{ stage: 'build', start: at(11, 0), end: at(12, 0) }, { stage: 'verify', start: at(12, 0), end: at(12, 30) }], gates: [] },
    ]);
    assert.deepEqual(d.days.map((r) => [r.stage, r.task]), [['build', 'alpha'], ['build', 'beta'], ['verify', 'beta']]);
    assert.equal(d.bins.length, 6);
    assert.equal(d.bins[0][0], at(10, 0));
    const binned = d.bins.reduce((n, b) => n + b[1], 0);
    assert.ok(Math.abs(binned - d.usd) < 1e-4, binned + ' vs ' + d.usd);
});

test('down closes the task; a transcript opening without start is one task under the entry\'s name from its first request', () => {
    const seq = [{ stage: 'build', at: 100, source: 'moves' }];
    assert.deepEqual(detail.segmentsOf([{ verb: 'down', at: 500, task: null }], seq, [{ askedAt: 200, answeredAt: 300 }], 50, 900, 'kept'),
        [{ task: 'kept', start: 50, end: 500, stages: [{ stage: 'build', start: 100, end: 500 }], gates: [{ start: 200, end: 300 }] }]);
    assert.deepEqual(detail.segmentsOf([], [], [], null, null, 'x'), []);
    assert.deepEqual(detail.segmentsOf([], seq, [], 50, 900, ''), []);
});
