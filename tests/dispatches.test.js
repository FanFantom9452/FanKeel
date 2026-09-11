'use strict';
// dispatchesOf: every dispatch the parent made and every agent it ran, from the
// parent's tool calls, the agents' own transcripts and the workflow run files.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const usage = require('../lib/usage.js');
const tmp = require('./tmp.js');

const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const said = (rid, s, content) => line({ type: 'assistant', requestId: rid, timestamp: T(s),
    message: { model: 'claude-opus-5', usage: { input_tokens: 1, output_tokens: 1 }, content } });
const result = (s, id, text, meta) => line({ type: 'user', timestamp: T(s), toolUseResult: meta,
    message: { content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }] }] } });
const NOTE = (id) => '<task-notification>\n<tool-use-id>' + id + '</tool-use-id>\n<result>done</result>\n</task-notification>';
const notify = (s, id) => line({ type: 'user', timestamp: T(s), origin: { kind: 'task-notification' }, message: { content: NOTE(id) } });
const agentLine = (rid, s, model, u) => line({ type: 'assistant', isSidechain: true, requestId: rid, timestamp: T(s),
    message: { model, usage: u, content: [] } });

// Two Agent calls in one request (one in the background, one not), then a
// Workflow; an agent file whose tool_use is not in the transcript; a run file
// naming two agents, one of which left no transcript. With `second`, a second
// Workflow with its own run file and its own agent — the only shape that walks
// `runsOf`'s readdir and `agentFiles`' per-run walk past their first pass.
function session(opts) {
    const two = !!(opts && opts.second);
    const base = tmp('fankeel-dispatch-');
    const t = path.join(base, 'sess.jsonl');
    const dir = path.join(base, 'sess');
    fs.writeFileSync(t, [
        line({ type: 'user', timestamp: T(0), message: { content: 'go' } }),
        said('req_1', 1, [
            use('toolu_a', 'Agent', { description: 'A', subagent_type: 'fankeel-reader', model: 'sonnet', prompt: 'p' }),
            use('toolu_b', 'Agent', { description: 'B', subagent_type: 'general-purpose', prompt: 'p' })]),
        result(2, 'toolu_a', 'launched', { status: 'async_launched', isAsync: true, agentId: 'aaa1' }),
        result(3, 'toolu_b', 'the answer', { status: 'completed', agentId: 'bbb2' }),
        said('req_2', 4, [use('toolu_w', 'Workflow', { script: 'export const meta = {}' })]),
        result(5, 'toolu_w', 'started', { status: 'async_launched', runId: 'wf_1', workflowName: 'flow' }),
        ...(two ? [
            said('req_3', 6, [use('toolu_w2', 'Workflow', { script: 'export const meta = {}' })]),
            result(7, 'toolu_w2', 'started', { status: 'async_launched', runId: 'wf_2', workflowName: 'flow2' }),
        ] : []),
        notify(20, 'toolu_a'),
        notify(30, 'toolu_w'),
        ...(two ? [notify(31, 'toolu_w2')] : []),
    ].join(''));
    const sub = path.join(dir, 'subagents');
    fs.mkdirSync(path.join(sub, 'workflows', 'wf_1'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(sub, 'agent-aaa1.jsonl'),
        agentLine('r1', 10, 'claude-sonnet-5', { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 1000 })
        + agentLine('r2', 40, 'claude-sonnet-5', { input_tokens: 5, output_tokens: 5 }));
    fs.writeFileSync(path.join(sub, 'agent-aaa1.meta.json'),
        JSON.stringify({ agentType: 'fankeel-reader', description: 'A', toolUseId: 'toolu_a', model: 'sonnet' }));
    fs.writeFileSync(path.join(sub, 'agent-bbb2.jsonl'), agentLine('r3', 3, 'claude-opus-5', { input_tokens: 7 }));
    fs.writeFileSync(path.join(sub, 'agent-ccc3.jsonl'), agentLine('r4', 6, 'claude-haiku-4-5-20251001', { input_tokens: 2 }));
    fs.writeFileSync(path.join(sub, 'agent-ccc3.meta.json'),
        JSON.stringify({ agentType: 'general-purpose', description: 'orphan', toolUseId: 'toolu_gone' }));
    fs.writeFileSync(path.join(sub, 'workflows', 'wf_1', 'agent-ddd4.jsonl'),
        agentLine('r5', 8, 'claude-sonnet-5', { input_tokens: 50, output_tokens: 50 }));
    fs.writeFileSync(path.join(dir, 'workflows', 'wf_1.json'), JSON.stringify({
        runId: 'wf_1', workflowName: 'flow', workflowProgress: [
            { type: 'workflow_phase', index: 1, title: 'Read' },
            { type: 'workflow_agent', agentId: 'ddd4', label: 'read:x', phaseTitle: 'Read', agentType: 'fankeel:fankeel-reader', model: 'claude-sonnet-5', tokens: 999 },
            { type: 'workflow_agent', agentId: 'eee5', label: 'check:y', phaseTitle: 'Check', agentType: 'fankeel:fankeel-reviewer', model: 'claude-sonnet-5' },
        ],
    }));
    if (two) {
        fs.mkdirSync(path.join(sub, 'workflows', 'wf_2'), { recursive: true });
        fs.writeFileSync(path.join(sub, 'workflows', 'wf_2', 'agent-fff6.jsonl'),
            agentLine('r6', 9, 'claude-sonnet-5', { input_tokens: 20, output_tokens: 20 }));
        fs.writeFileSync(path.join(dir, 'workflows', 'wf_2.json'), JSON.stringify({
            runId: 'wf_2', workflowName: 'flow2', workflowProgress: [
                { type: 'workflow_phase', index: 1, title: 'Land' },
                { type: 'workflow_agent', agentId: 'fff6', label: 'land:z', phaseTitle: 'Land', agentType: 'fankeel:fankeel-fixer', model: 'claude-sonnet-5', tokens: 777 },
            ],
        }));
    }
    return t;
}

test('two Agent calls in one request are agents, a Workflow is workflow, each on the turn it went out on', () => {
    const out = usage.dispatchesOf(session());
    assert.deepEqual(out.dispatches.map((d) => [d.surface, d.turn, d.text, d.agentType, d.alias]), [
        ['agents', 1, 'A', 'fankeel-reader', 'sonnet'],
        ['agents', 1, 'B', 'general-purpose', null],
        ['workflow', 2, 'flow', null, null],
    ]);
});

test('a background dispatch returns through its notification, a foreground one through its tool result', () => {
    const [a, b, w] = usage.dispatchesOf(session()).dispatches;
    assert.deepEqual([a.launch, a.ret, a.back], ['launched'.length, NOTE('toolu_a').length, Date.parse(T(20))]);
    assert.deepEqual([b.launch, b.ret, b.back], [0, 'the answer'.length, Date.parse(T(3))]);
    assert.deepEqual([w.run, w.launch, w.ret, w.back], ['wf_1', 'started'.length, NOTE('toolu_w').length, Date.parse(T(30))]);
});

test('one row per agent file and a zero row for a run agent with no transcript, each on its dispatch', () => {
    const out = usage.dispatchesOf(session());
    const by = Object.fromEntries(out.rows.map((r) => [r.id, r]));
    assert.deepEqual(Object.keys(by).sort(), ['aaa1', 'bbb2', 'ccc3', 'ddd4', 'eee5']);
    assert.deepEqual([by.aaa1.disp, by.aaa1.turn, by.aaa1.label, by.aaa1.surface, by.aaa1.tokens, by.aaa1.durMs, by.aaa1.requests],
        [0, 1, 'A', 'agents', 1120, 30000, 2]);
    assert.deepEqual(by.aaa1.split, { input: 105, output: 15, cacheRead: 1000, cacheWrite5m: 0, cacheWrite1h: 0 });
    assert.equal(by.bbb2.disp, 1);
    assert.deepEqual([by.ccc3.disp, by.ccc3.surface, by.ccc3.label, by.ccc3.agentType], [null, 'agent', 'orphan', 'general-purpose']);
    assert.deepEqual([by.ddd4.surface, by.ddd4.disp, by.ddd4.label, by.ddd4.phase, by.ddd4.tokens], ['workflow', 2, 'read:x', 'Read', 100]);
    assert.deepEqual([by.eee5.tokens, by.eee5.requests, by.eee5.disp, by.eee5.phase], [0, 0, 2, 'Check']);
    assert.deepEqual(out.dispatches[2].ids.slice().sort(), ['ddd4', 'eee5']);
    assert.deepEqual(out.dispatches[2].phases, ['Read', 'Check']);
    assert.deepEqual(out.runs, [{ run: 'wf_1', name: 'flow', agents: 2 }]);
});

test('the rows add up to what agentsOf sums over the same files, and a missing transcript is null', () => {
    const t = session();
    const rows = usage.dispatchesOf(t).rows;
    const five = (m) => m.input + m.output + m.cacheRead + m.cacheWrite5m + m.cacheWrite1h;
    const theirs = Object.values(usage.agentsOf(t).models).reduce((n, m) => n + five(m), 0);
    assert.equal(rows.reduce((n, r) => n + r.tokens, 0), theirs);
    assert.equal(usage.dispatchesOf(path.join(path.dirname(t), 'none.jsonl')), null);
});

// `runsOf` reads the whole `workflows/` directory and `agentFiles` walks every
// run under `subagents/workflows/`, but one run file never takes either loop
// past its first pass. `05de9a54` is a real session with two.
test('a second run file is its own dispatch: both runs counted, each agent placed on its own Workflow', () => {
    const out = usage.dispatchesOf(session({ second: true }));
    assert.deepEqual(out.runs, [
        { run: 'wf_1', name: 'flow', agents: 2 },
        { run: 'wf_2', name: 'flow2', agents: 1 },
    ]);
    const by = Object.fromEntries(out.rows.map((r) => [r.id, r]));
    assert.deepEqual(Object.keys(by).sort(), ['aaa1', 'bbb2', 'ccc3', 'ddd4', 'eee5', 'fff6']);
    const flows = out.dispatches.filter((d) => d.surface === 'workflow');
    assert.deepEqual(flows.map((d) => d.run), ['wf_1', 'wf_2']);
    assert.deepEqual(flows[0].ids.slice().sort(), ['ddd4', 'eee5']);
    assert.deepEqual(flows[1].ids, ['fff6']);
    assert.equal(by.fff6.disp, out.dispatches.indexOf(flows[1]));
    assert.deepEqual([by.fff6.surface, by.fff6.label, by.fff6.phase, by.fff6.tokens],
        ['workflow', 'land:z', 'Land', 40]);
});
