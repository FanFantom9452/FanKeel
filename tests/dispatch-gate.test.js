'use strict';
// dispatch-1: four Agent calls in one response is the default; the fifth and
// later in the same assistant message are asked of the user, with a figure.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { costOf } = require('../lib/prices.js');
const { positionOf, benchPerDispatch, spentSoFar, decide } = require('../hooks/dispatch-gate.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'dispatch-gate.js');
const SID = 'aaaaaaaa-0000-4000-8000-000000000001';

// One transcript line per content block: five Agent calls in one response
// are five assistant lines sharing message.id.
const agentLine = (i, mid) => ({ type: 'assistant', message: { id: mid || 'msg_01', model: 'claude-opus-5-5',
    content: [{ type: 'tool_use', id: 'toolu_' + i, name: 'Agent', input: { subagent_type: 'fankeel:fankeel-reader', description: 'read ' + i, prompt: 'p' } }] } });
const resultLine = (i) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_' + i, content: 'ok' }] } });
const five = [1, 2, 3, 4, 5].map((i) => agentLine(i));

function transcript(dir, entries) {
    const file = path.join(dir, SID + '.jsonl');
    fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
    return file;
}

function evidence(dir, roleUsd, runs) {
    const batch = path.join(dir, 'evidence', '2026-10-09-haiku-bank-drift', 'role-reader-20261009T033513');
    fs.mkdirSync(batch, { recursive: true });
    fs.writeFileSync(path.join(batch, 'summary.json'), JSON.stringify({ arms: [{ role: 'reader', arm: 'haiku', runs, valid: runs, passed: runs, roleUsd, relayUsd: 0 }] }));
    return path.join(dir, 'evidence');
}

const payload = (file, id) => ({ hook_event_name: 'PreToolUse', session_id: SID, transcript_path: file, tool_name: 'Agent', tool_use_id: id,
    tool_input: { subagent_type: 'fankeel:fankeel-reader', model: 'haiku', description: 'read', prompt: 'p' } });

test('positionOf counts the Agent calls sharing message.id, found by the call\'s own id', () => {
    assert.equal(positionOf(five, 'toolu_5'), 5);
    assert.equal(positionOf(five, 'toolu_4'), 4);
    assert.equal(positionOf([agentLine(9, 'msg_00'), resultLine(9)].concat(five), 'toolu_2'), 2);
});

test('positionOf, with the call not on disk yet, is the next block of an open message or the first of a new one', () => {
    assert.equal(positionOf(five.slice(0, 4), 'toolu_new'), 5);
    assert.equal(positionOf(five.slice(0, 4), undefined), 5);
    assert.equal(positionOf(five.slice(0, 4).concat([resultLine(1)]), 'toolu_new'), 1);
    assert.equal(positionOf([], 'toolu_new'), 1);
});

test('the fifth Agent call in one message is asked, with the bench figure when no spend is recorded', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const root = evidence(dir, 0.05, 5);
    assert.deepEqual(benchPerDispatch(root, 'reader', 'haiku'), { usd: 0.01, batch: 'role-reader-20261009T033513' });
    const out = decide(payload(transcript(dir, five), 'toolu_5'), { data: null, evidenceRoot: root });
    assert.match(out.reason, /Agent call 5 in one response/);
    assert.match(out.reason, /\$0\.050 for these 5 dispatches/);
});

test('four Agent calls in one message produce nothing', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const file = transcript(dir, five.slice(0, 4));
    for (const id of ['toolu_1', 'toolu_4']) assert.equal(decide(payload(file, id), { data: null, evidenceRoot: evidence(dir, 0.05, 5) }), null);
});

test('with spend recorded the figure is the registry spend priced by lib/prices.js', () => {
    const models = { 'claude-sonnet-5-5': { input: 1000000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } };
    const data = { spend: { build: { requests: 0, models: {}, subagents: { requests: 3, models } } } };
    const usd = costOf(models).usd;
    assert.equal(spentSoFar(data), usd);
    assert.equal(spentSoFar({}), null);
    const dir = tmp('fankeel-dispatch-gate-');
    const out = decide(payload(transcript(dir, five), 'toolu_5'), { data, evidenceRoot: evidence(dir, 0.05, 5) });
    assert.ok(out.reason.includes('$' + usd.toFixed(2) + ' so far'), out.reason);
});

test('as a hook: the fifth call prints ask with its reason, the fourth prints nothing, both exit 0', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const fire = (entries, id) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload(transcript(dir, entries), id)), encoding: 'utf8',
        env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
    const asked = fire(five, 'toolu_5');
    assert.equal(asked.status, 0);
    const h = JSON.parse(asked.stdout).hookSpecificOutput;
    assert.equal(h.hookEventName, 'PreToolUse');
    assert.equal(h.permissionDecision, 'ask');
    assert.match(h.permissionDecisionReason, /Agent call 5/);
    const quiet = fire(five.slice(0, 4), 'toolu_4');
    assert.equal(quiet.status, 0);
    assert.equal(quiet.stdout, '');
});
