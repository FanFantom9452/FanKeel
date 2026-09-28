'use strict';
// lib/usage.js dispatchesOf(): a row already carries `requests` (design §7's
// first bullet, half done); this adds `peak`, the largest single request's
// context — the same measure lib/detail.js's extract() already takes across
// a session's own requests (`points`/`peak`, lib/detail.js:639-640) — taken
// here across one agent's own series instead. The third test checks the
// field survives lib/station.js's serializeDetail(), a projection that can
// drop a field gather() has: test what serialize() outputs, not what the raw
// row carries.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const usage = require('../lib/usage.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-28T09:00:' + String(s).padStart(2, '0') + '.000Z';
const agentLine = (rid, s, model, u) => line({
    type: 'assistant', isSidechain: true, requestId: rid, timestamp: T(s),
    message: { model, usage: u, content: [] },
});

function session() {
    const base = tmp('fankeel-usage-peak-');
    const t = path.join(base, 'sess.jsonl');
    const dir = path.join(base, 'sess');
    fs.writeFileSync(t, line({ type: 'user', timestamp: T(0), message: { content: 'go' } }));
    const sub = path.join(dir, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    // Two requests: the first carries the larger context (heavy cache read,
    // as a subagent's later turns do), the second is smaller. `peak` must be
    // the first (1100), not the sum (1105) and not the last (5).
    fs.writeFileSync(path.join(sub, 'agent-aaa1.jsonl'),
        agentLine('r1', 10, 'claude-sonnet-5', { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 1000 })
        + agentLine('r2', 20, 'claude-sonnet-5', { input_tokens: 5, output_tokens: 5 }));
    return t;
}

test('dispatchesOf(): a row carries requests (already there) and peak, the largest single request\'s context, not a sum', () => {
    const out = usage.dispatchesOf(session());
    const row = out.rows.find((r) => r.id === 'aaa1');
    assert.equal(row.requests, 2);
    assert.equal(row.peak, 1100);
});

test('a workflow_agent left with no transcript file gets peak 0, not undefined', () => {
    const base = tmp('fankeel-usage-peak-orphan-');
    const t = path.join(base, 'sess.jsonl');
    const dir = path.join(base, 'sess');
    fs.writeFileSync(t, line({ type: 'user', timestamp: T(0), message: { content: 'go' } }));
    fs.mkdirSync(path.join(dir, 'subagents', 'workflows', 'wf_1'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'workflows', 'wf_1.json'), JSON.stringify({
        runId: 'wf_1', workflowName: 'flow', workflowProgress: [
            { type: 'workflow_agent', agentId: 'ddd4', label: 'read:x', phaseTitle: 'Read', agentType: 'fankeel:fankeel-reader', model: 'claude-sonnet-5' },
        ],
    }));
    const out = usage.dispatchesOf(t);
    const row = out.rows.find((r) => r.id === 'ddd4');
    assert.equal(row.peak, 0);
});

test("lib/station.js serializeDetail() passes a row's peak and requests through unchanged, since it is a full projection of s.detail and not a recomputation", () => {
    const fixture = { sessionId: 'sess-1', detail: { rows: [{ id: 'a1', requests: 4, peak: 160000 }] } };
    const script = station.serializeDetail(fixture);
    assert.match(script, /"requests":4/);
    assert.match(script, /"peak":160000/);
});
