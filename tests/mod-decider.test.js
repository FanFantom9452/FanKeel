'use strict';
// gate-21: past dispatch.inflight the dispatch gate's ask goes to the person —
// CC 2.1.304 tool.check decider "person" — never to the auto-mode classifier;
// with nobody to ask the engine refuses it with the hook's reason.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'mod.ts')).href);

async function checkHook() {
    const { register } = await load();
    let found = null;
    register((name, matcher, fn) => { if (name === 'tool.check') found = { matcher, fn }; });
    return found;
}

const REASON = 'fankeel: this is Agent call 9 in one response, past dispatch.inflight (8). No figure: no stage has recorded spend and no bench ran reader.';

test('mod registers one tool.check, matched on the Agent tool', async () => {
    const found = await checkHook();
    assert.ok(found, 'no tool.check registered');
    assert.deepEqual(found.matcher, { tool: 'Agent' });
});

test('a dispatch-gate ask leaves with decider person, its decision and reason kept', async () => {
    const { fn } = await checkHook();
    const core = { decision: 'ask', reason: REASON, hook: 'PreToolUse' };
    const out = await fn({}, { tool: 'Agent', input: {} }, async () => core);
    assert.deepEqual(out, { decision: 'ask', reason: REASON, hook: 'PreToolUse', decider: 'person' });
});

test('nobody present: the answer is one only a person can approve, so the engine refuses it with the reason', async () => {
    const { personDecides } = await load();
    const out = personDecides({ decision: 'ask', reason: REASON });
    assert.equal(out.decider, 'person');
    assert.notEqual(out.decision, 'allow');
    assert.equal(out.reason, REASON, 'the reason is what the refused model reads');
});

test('every other verdict passes untouched', async () => {
    const { fn } = await checkHook();
    for (const core of [
        { decision: 'allow' },
        { decision: 'deny', reason: REASON },
        { decision: 'ask', reason: 'Bash(git push:*)', rule: 'Bash(git push:*)' },
        { decision: 'ask' },
    ]) {
        const out = await fn({}, { tool: 'Agent', input: {} }, async () => core);
        assert.equal(out, core, JSON.stringify(core));
        assert.equal(out.decider, undefined);
    }
});

test('the prefix is the one hooks/dispatch-gate.js opens every ask with', async () => {
    const { GATE_PREFIX } = await load();
    const src = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'dispatch-gate.js'), 'utf8');
    assert.ok(src.includes("'" + GATE_PREFIX), 'hooks/dispatch-gate.js no longer opens its reason with ' + JSON.stringify(GATE_PREFIX));
});
