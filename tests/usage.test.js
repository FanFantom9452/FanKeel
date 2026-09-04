'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const usage = require('../lib/usage.js');

const line = (o) => JSON.stringify(o) + '\n';
const assistant = (requestId, model, u, extra) => line(Object.assign({
    type: 'assistant', requestId, message: { model, usage: u },
}, extra || {}));

function transcript(lines) {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-usage-')), 't.jsonl');
    fs.writeFileSync(file, lines.join(''));
    return file;
}

test('one request written three times counts once; the model with more output is the model', () => {
    const file = transcript([
        line({ type: 'user', message: { role: 'user', content: 'hi' } }),
        assistant('req_1', 'claude-fable-5-1', { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000,
            cache_creation_input_tokens: 40, cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 30 } }),
        assistant('req_1', 'claude-fable-5-1', { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000,
            cache_creation_input_tokens: 40, cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 30 } }),
        assistant('req_1', 'claude-fable-5-1', { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000,
            cache_creation_input_tokens: 40, cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 30 } }),
        assistant('req_2', 'claude-sonnet-5', { input_tokens: 5, output_tokens: 7, cache_read_input_tokens: 0, cache_creation_input_tokens: 12 }),
        'not json\n',
    ]);
    assert.deepEqual(usage.summarise(file), {
        model: 'claude-fable-5-1',
        usage: {
            requests: 2,
            models: {
                'claude-fable-5-1': { input: 10, output: 100, cacheRead: 1000, cacheWrite5m: 10, cacheWrite1h: 30 },
                'claude-sonnet-5': { input: 5, output: 7, cacheRead: 0, cacheWrite5m: 12, cacheWrite1h: 0 },
            },
        },
    });
});

test('sidechain lines and lines without usage are skipped; a line with no requestId counts on its own', () => {
    const file = transcript([
        assistant('req_9', 'claude-opus-5', { input_tokens: 1, output_tokens: 1 }, { isSidechain: true }),
        line({ type: 'assistant', message: { model: 'claude-opus-5' } }),
        line({ type: 'assistant', message: { model: 'claude-opus-5', usage: { input_tokens: 2, output_tokens: 3 } } }),
        line({ type: 'assistant', message: { model: 'claude-opus-5', usage: { input_tokens: 2, output_tokens: 3 } } }),
    ]);
    const seen = usage.summarise(file);
    assert.equal(seen.usage.requests, 2);
    assert.deepEqual(seen.usage.models['claude-opus-5'], { input: 4, output: 6, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
});

test('null for a missing file and for a transcript with nothing to sum', () => {
    assert.equal(usage.summarise(path.join(os.tmpdir(), 'fankeel-no-such-transcript.jsonl')), null);
    assert.equal(usage.summarise(transcript([line({ type: 'user' })])), null);
});

test('sidechain lines count only when asked', () => {
    const file = transcript([
        assistant('r1', 'claude-sonnet-5', { input_tokens: 1, output_tokens: 2 }, { isSidechain: true }),
    ]);
    assert.equal(usage.summarise(file), null);
    assert.deepEqual(usage.summarise(file, { sidechain: true }).usage, {
        requests: 1, models: { 'claude-sonnet-5': { input: 1, output: 2, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } },
    });
});

// A session directory beside the transcript: `<base>/t.jsonl` and `<base>/t/subagents/...`.
function session(agentFiles) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-usage-tree-'));
    const file = path.join(base, 't.jsonl');
    fs.writeFileSync(file, assistant('own1', 'claude-fable-5-1', { input_tokens: 5, output_tokens: 50 }));
    for (const [rel, lines] of Object.entries(agentFiles)) {
        const p = path.join(base, 't', rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, lines.join(''));
    }
    return file;
}
const agentLine = (requestId, out, ts) => line({ type: 'assistant', isSidechain: true, requestId, timestamp: ts,
    message: { model: 'claude-sonnet-5', usage: { input_tokens: 10, output_tokens: out } } });

test('agentsOf walks subagents/ and subagents/workflows/*/, counts sidechain lines once per request, sums wall-clock', () => {
    const file = session({
        'subagents/agent-aaaa.jsonl': [
            agentLine('a1', 100, '2026-09-04T02:00:00.000Z'),
            agentLine('a1', 100, '2026-09-04T02:00:05.000Z'),
            agentLine('a2', 1, '2026-09-04T02:00:10.000Z'),
        ],
        'subagents/agent-aaaa.meta.json': ['{"model":"sonnet"}'],
        'subagents/notes.txt': ['not a transcript\n'],
        'subagents/workflows/wf_x/agent-bbbb.jsonl': [agentLine('b1', 7, '2026-09-04T03:00:00.000Z')],
    });
    assert.deepEqual(usage.agentsOf(file), {
        agents: 2, requests: 3, wallMs: 10000,
        models: { 'claude-sonnet-5': { input: 30, output: 108, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } },
    });
});

test('agentsOf is null with no agents, and summariseTree nests it under usage only when present', () => {
    const alone = session({});
    assert.equal(usage.agentsOf(alone), null);
    const tree = usage.summariseTree(alone);
    assert.equal(tree.model, 'claude-fable-5-1');
    assert.equal('subagents' in tree.usage, false);
    const withAgents = session({ 'subagents/agent-cccc.jsonl': [agentLine('c1', 3, '2026-09-04T02:00:00.000Z')] });
    const t2 = usage.summariseTree(withAgents);
    assert.equal(t2.usage.requests, 1);
    assert.equal(t2.usage.subagents.agents, 1);
    assert.equal(t2.usage.subagents.requests, 1);
    assert.equal(usage.summariseTree(path.join(os.tmpdir(), 'fankeel-no-such.jsonl')), null);
    assert.equal(usage.agentsOf('not-a-jsonl-path'), null);
});
