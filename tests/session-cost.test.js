'use strict';
// lib/session-cost.js: what one session spent, read the way scripts/record.js
// costLine always read it (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §4).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const prices = require('../lib/prices.js');
const { sessionCost } = require('../lib/session-cost.js');
const tmp = require('./tmp.js');

const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const line = (model, input, extra) => JSON.stringify(Object.assign({ type: 'assistant', requestId: 'r-' + model, timestamp: new Date().toISOString(),
    message: { role: 'assistant', model, usage: { input_tokens: input, output_tokens: 0 }, content: [] } }, extra)) + '\n';

function seed(withAgent) {
    const cfg = tmp('fankeel-session-cost-');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(dir, { recursive: true });
    const transcript = path.join(dir, A + '.jsonl');
    fs.writeFileSync(transcript, line('claude-sonnet-5-5', 1000000));
    if (withAgent) {
        const sub = path.join(transcript.slice(0, -'.jsonl'.length), 'subagents');
        fs.mkdirSync(sub, { recursive: true });
        fs.writeFileSync(path.join(sub, 'agent-abc123.jsonl'), line('claude-haiku-4-5', 1000, { isSidechain: true }));
    }
    return { cfg, transcript };
}

test('sessionCost prices the session and its agents together, one row per model', () => {
    const s = seed(true);
    const c = sessionCost(s.cfg, A);
    assert.equal(c.file, s.transcript);
    assert.ok(Math.abs(c.usd - 2.001) < 1e-9, String(c.usd));
    assert.equal(c.model, 'claude-sonnet-5-5');
    assert.deepEqual([c.agents, c.agentModels, c.requests], [1, ['claude-haiku-4-5'], 2]);
    assert.deepEqual(c.models.map((m) => m.id).sort(), ['claude-haiku-4-5', 'claude-sonnet-5-5']);
    const sonnet = c.models.find((m) => m.id === 'claude-sonnet-5-5');
    assert.deepEqual([sonnet.input, sonnet.output, sonnet.usd], [1000000, 0, 2]);
    assert.deepEqual(c.unpriced, []);
    assert.equal(c.verified, prices.verified);
});

test('a session with no agents has none, and one with no transcript is null', () => {
    const s = seed(false);
    const c = sessionCost(s.cfg, A);
    assert.deepEqual([c.usd, c.agents, c.agentModels, c.requests], [2, 0, [], 1]);
    assert.equal(sessionCost(s.cfg, 'bbbbbbbb-1111-2222-3333-444444444444'), null);
});

test('a model with no price is named, costs nothing, and shows null on its row', () => {
    const s = seed(false);
    fs.writeFileSync(s.transcript, line('gpt-unknown', 500));
    const c = sessionCost(s.cfg, A);
    assert.deepEqual([c.usd, c.unpriced, c.models[0].usd], [0, ['gpt-unknown'], null]);
});
