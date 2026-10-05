'use strict';

// model-3: the brain A/B's tally reads one run the way ab.sh leaves it — the
// stage json and wall files in the evidence dir, the controller transcript and
// its subagents under raw/<tag>/ — and does not count a run whose brain ran on
// the other arm's model.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const { tallyRun, main } = require('../docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/tally.js');

const U = 'cccccccc-0000-4000-8000-000000000003';
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const use = (id, name, input) => ({ type: 'assistant', requestId: 'req-' + id, message: { content: [{ type: 'tool_use', id, name, input }] } });
const result = (text) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'x', content: text }] } });

function fixture(tag, brainDescription) {
    const evid = tmp('fankeel-ab-evid-');
    const raw = tmp('fankeel-ab-raw-');
    fs.writeFileSync(path.join(evid, tag + '-plan.json'), JSON.stringify({ total_cost_usd: 1 }));
    fs.writeFileSync(path.join(evid, tag + '-verify.json'), JSON.stringify({ total_cost_usd: 3, modelUsage: { 'claude-opus-5-5': { costUSD: 2 }, 'claude-sonnet-5-5': { costUSD: 1 } } }));
    fs.writeFileSync(path.join(evid, tag + '-plan.wall'), '100 160\n');
    fs.writeFileSync(path.join(evid, tag + '-build.wall'), '160 400\n');
    const run = path.join(raw, tag);
    const sub = path.join(run, U, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(run, U + '.jsonl'), jsonl([
        use('t1', 'Agent', { subagent_type: 'fankeel:fankeel-brain', prompt: 'build' }),
        use('t1', 'Agent', { subagent_type: 'fankeel:fankeel-brain', prompt: 'build' }),
        use('t2', 'SendMessage', { to: 'a1' }),
        use('t3', 'Bash', { command: 'node scripts/commit.js --session ' + U }),
        use('t4', 'Bash', { command: 'node scripts/task.js stage build --session ' + U }),
        use('t5', 'Bash', { command: 'node scripts/task.js stage build --session ' + U }),
    ]));
    fs.writeFileSync(path.join(sub, 'agent-a1.meta.json'), JSON.stringify({ agentType: 'fankeel:fankeel-brain', description: brainDescription }));
    fs.writeFileSync(path.join(sub, 'agent-a1.jsonl'), jsonl([result('gate-check.js: invalid at next: empty')]));
    fs.writeFileSync(path.join(sub, 'agent-a2.meta.json'), JSON.stringify({ agentType: 'fankeel:fankeel-reviewer', description: 'sonnet 5.5 · medium: review' }));
    fs.writeFileSync(path.join(sub, 'agent-a2.jsonl'), '');
    fs.writeFileSync(path.join(sub, 'agent-a3.meta.json'), JSON.stringify({ agentType: 'fankeel:fankeel-fixer', description: 'sonnet 5.5 · medium: fix' }));
    fs.writeFileSync(path.join(sub, 'agent-a3.jsonl'), '');
    fs.mkdirSync(path.join(run, 'build', 'task-1'), { recursive: true });
    fs.writeFileSync(path.join(run, 'build', 'task-1', 'relay-a9.md'), 'r');
    return { evid, raw, run };
}

test('a run is tallied from its stage files, its controller transcript and its subagents', () => {
    const { evid, run } = fixture('r1-opus', 'opus 5.5 · medium: build stage agent');
    const t = tallyRun(evid, run, 'r1-opus');
    assert.equal(t.valid, true);
    assert.equal(t.usd, 3);
    assert.deepEqual(t.models, { 'claude-opus-5-5': 2, 'claude-sonnet-5-5': 1 });
    assert.equal(t.wallSeconds, 300);
    assert.deepEqual(t.controller, { brainDispatches: 1, sendMessages: 1, commitRuns: 1, backToBuild: 1 });
    assert.deepEqual(t.agents, { brain: 1, reviewer: 1, fixer: 1, implementer: 0, other: 0 });
    assert.deepEqual(t.brainModels, { opus: 1 });
    assert.equal(t.gateCheckRefusals, 1);
    assert.equal(t.relays, 1);
});

test('a run with no brain transcript, or no verify stage json, is not valid in either arm', () => {
    for (const arm of ['opus', 'sonnet']) {
        const tag = 'r1-' + arm;
        const { evid, run } = fixture(tag, arm + ' 5.5 · medium: build stage agent');
        assert.equal(tallyRun(evid, run, tag).valid, true);
        const empty = tmp('fankeel-ab-empty-');
        assert.equal(tallyRun(evid, path.join(empty, tag), tag).valid, false);
        fs.rmSync(path.join(evid, tag + '-verify.json'));
        assert.equal(tallyRun(evid, run, tag).valid, false);
    }
});

test('an opus run whose brain ran on sonnet is not valid, and main leaves it out of the arm', () => {
    const { evid, raw } = fixture('r1-opus', 'sonnet 5.5 · medium: build stage agent');
    const out = main([evid, raw]);
    assert.equal(out.code, 0);
    const parsed = JSON.parse(out.text);
    assert.equal(parsed.runs[0].valid, false);
    assert.deepEqual([parsed.arms.opus.runs, parsed.arms.opus.valid], [1, 0]);
    assert.equal(parsed.arms.opus.medianUsd, null);
});

test('a sonnet run whose plan brain ran on opus and whose build brain ran on sonnet is valid', () => {
    const { evid, run } = fixture('r1-sonnet', 'sonnet 5.5 · medium: build stage agent');
    const sub = path.join(run, U, 'subagents');
    fs.writeFileSync(path.join(sub, 'agent-a4.meta.json'), JSON.stringify({ agentType: 'fankeel:fankeel-brain', description: 'opus 5.5 · medium: plan stage agent' }));
    fs.writeFileSync(path.join(sub, 'agent-a4.jsonl'), '');
    const t = tallyRun(evid, run, 'r1-sonnet');
    assert.equal(t.valid, true);
    assert.deepEqual(t.brainModels, { sonnet: 1, opus: 1 });
});
