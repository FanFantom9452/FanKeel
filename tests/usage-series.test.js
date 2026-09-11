'use strict';
// The per-request series and the transcript readers the station's detail panel
// is built on. The series is `summarise()`'s own `byRequest`, so the curve and
// the request count come from one pass and cannot disagree.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const usage = require('../lib/usage.js');
const tmp = require('./tmp.js');

const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const said = (rid, s, u) => line({ type: 'assistant', requestId: rid, timestamp: T(s),
    message: { model: 'claude-opus-5', usage: u, content: [] } });

function transcript(lines) {
    const file = path.join(tmp('fankeel-series-'), 't.jsonl');
    fs.writeFileSync(file, lines.join(''));
    return file;
}

test('series is one row per request in first-seen order; context is input, cache read and both cache writes', () => {
    const file = transcript([
        said('req_a', 1, { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100,
            cache_creation: { ephemeral_5m_input_tokens: 20, ephemeral_1h_input_tokens: 30 } }),
        said('req_b', 2, { input_tokens: 1, output_tokens: 7, cache_read_input_tokens: 200, cache_creation_input_tokens: 40 }),
        said('req_a', 3, { input_tokens: 10, output_tokens: 9, cache_read_input_tokens: 100,
            cache_creation: { ephemeral_5m_input_tokens: 20, ephemeral_1h_input_tokens: 30 } }),
        line({ type: 'assistant', requestId: 'req_c', message: { model: 'claude-opus-5', usage: { input_tokens: 3 } } }),
    ]);
    const seen = usage.summarise(file, { series: true });
    assert.deepEqual(seen.series.map((r) => [r.id, r.context, r.output]),
        [['req_a', 160, 9], ['req_b', 241, 7], ['req_c', 3, 0]]);
    assert.equal(seen.series[0].at, Date.parse(T(3)), 'the last line of a request wins, its time included');
    assert.ok(Number.isNaN(seen.series[2].at));
    assert.equal(seen.series.length, seen.usage.requests);
    assert.equal(usage.summarise(file).series, undefined, 'no series unless asked');
});

test('turnIndex numbers requests the way the series does, and entriesOf skips a torn line', () => {
    const file = transcript([
        line({ type: 'user', message: { content: 'go' } }),
        said('req_a', 1, { input_tokens: 1 }),
        said('req_a', 2, { input_tokens: 1 }),
        line({ type: 'assistant', message: { model: 'claude-opus-5', usage: { input_tokens: 1 } } }),
        said('req_b', 3, { input_tokens: 1 }),
        '{"torn',
    ]);
    const entries = usage.entriesOf(file);
    assert.equal(entries.length, 5);
    const turnAt = usage.turnIndex(entries);
    assert.deepEqual(entries.map((e, i) => turnAt(i)), [null, 1, 1, 2, 3]);
    assert.deepEqual(usage.summarise(file, { series: true }).series.map((r) => r.id), ['req_a', 'anonymous-0', 'req_b']);
    assert.equal(usage.entriesOf(path.join(tmp('fankeel-series-'), 'none.jsonl')), null);
});

test('textOf reads a string or text blocks, and notificationOf names the tool_use it returns for', () => {
    assert.equal(usage.textOf('abc'), 'abc');
    assert.equal(usage.textOf([{ type: 'text', text: 'ab' }, { type: 'image' }, { type: 'text', text: 'c' }]), 'abc');
    assert.equal(usage.textOf(undefined), '');
    const body = '<task-notification>\n<task-id>x</task-id>\n<tool-use-id>toolu_9</tool-use-id>\n</task-notification>';
    const flagged = { type: 'user', origin: { kind: 'task-notification' }, timestamp: T(5), message: { content: body } };
    assert.deepEqual(usage.notificationOf(flagged), { toolUseId: 'toolu_9', chars: body.length, at: Date.parse(T(5)) });
    assert.equal(usage.notificationOf({ type: 'user', timestamp: T(5), message: { content: body } }).toolUseId, 'toolu_9',
        'an older line carries no origin and is read by its opening tag');
    assert.equal(usage.notificationOf({ type: 'user', message: { content: 'hello' } }), null);
});

test('spanOf, agentFiles and sessionDirOf are exported for the station to use rather than copy', () => {
    const file = transcript([said('r1', 4, { input_tokens: 1 }), line({ type: 'user', timestamp: T(9) }), said('r2', 2, { input_tokens: 1 })]);
    assert.deepEqual(usage.spanOf(file), { first: Date.parse(T(2)), last: Date.parse(T(9)) });
    assert.deepEqual(usage.agentFiles(path.join(path.dirname(file), 'nothing-here')), []);
    assert.equal(usage.sessionDirOf(path.join('x', 'abc.jsonl')), path.join('x', 'abc'));
});
