'use strict';
// station-17: a compacted session keeps every line from before the
// compaction (lib/conversation.js:4-6), so the station's detail reads the
// whole transcript. One compact_boundary and one isCompactSummary line: the
// summary is not a prompt the user typed, the context curve drops at the
// boundary, and a dispatch made before it is still listed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const SID = 'cccccccc-0000-4000-8000-000000000017';
const T = (s) => '2026-10-08T10:00:' + String(s).padStart(2, '0') + '.000Z';
const ask = (s, text) => ({ type: 'user', timestamp: T(s), message: { role: 'user', content: text } });
const said = (rid, s, input, content) => ({ type: 'assistant', requestId: rid, timestamp: T(s),
    message: { id: 'msg_' + rid, model: 'claude-opus-5-5', usage: { input_tokens: input, output_tokens: 10 }, content } });

const LINES = [
    ask(1, 'fix the ramp'),
    said('r1', 2, 150000, [{ type: 'tool_use', id: 'toolu_a', name: 'Agent', input: { subagent_type: 'fankeel:fankeel-reader', description: 'read the map', prompt: 'p' } }]),
    { type: 'user', timestamp: T(3), message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_a', content: 'the map says x' }] } },
    said('r2', 4, 180000, [{ type: 'text', text: 'done reading' }]),
    { type: 'system', subtype: 'compact_boundary', timestamp: T(5), content: '', isMeta: false, compactMetadata: { trigger: 'manual', preTokens: 180000 } },
    { type: 'user', timestamp: T(6), isCompactSummary: true, isVisibleInTranscriptOnly: true,
        message: { role: 'user', content: 'This session is being continued from a previous conversation that ran out of context.' } },
    ask(7, 'go on'),
    said('r3', 8, 20000, [{ type: 'text', text: 'going on' }]),
];

function read() {
    const cfg = tmp('fankeel-detail-compact-');
    const dir = path.join(cfg, 'projects', 'F--some-project');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, SID + '.jsonl'), LINES.map((l) => JSON.stringify(l)).join('\n') + '\n');
    return detail.detailOf(cfg, SID, { route: ['build'], stage: 'build' }).detail;
}

test('a compaction summary is not counted as a prompt the user typed', () => {
    const d = read();
    assert.deepEqual(d.events.filter((e) => e.kind === 'prompt').map((e) => e.text), ['fix the ramp', 'go on']);
    assert.equal(d.requests, 3);
});

test('the context curve drops at the compaction boundary', () => {
    const d = read();
    assert.deepEqual(d.points.map((p) => p.y), [150000, 180000, 20000]);
    assert.ok(d.points[2].y < d.points[1].y);
});

test('a dispatch made before the compaction is still listed', () => {
    const d = read();
    assert.equal(d.dispatches.length, 1);
    assert.equal(d.dispatches[0].text, 'read the map');
    assert.equal(d.dispatches[0].turn, 1);
});
