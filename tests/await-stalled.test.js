'use strict';

// await-16: a brain that dispatched background children and then stopped,
// saying it waits on them, is `stalled`, not `lost`; one that never
// dispatched anything is still `lost`, and one still writing is neither.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { awaitState, launched } = require('../lib/handoff.js');
const { lineFor } = require('../scripts/await.js');
const tmp = require('./tmp.js');

const T = 1800000000000;
const line = (o) => JSON.stringify(o) + '\n';
const asst = (id, blocks) => line({ type: 'assistant', message: { id, content: blocks } });
const use = (id) => ({ type: 'tool_use', id, name: 'Agent', input: { prompt: 'x', run_in_background: true } });
const launch = (useId, agentId) => line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: useId,
    content: [{ type: 'text', text: 'Async agent launched successfully.\nagentId: ' + agentId + ' (internal ID)' }] }] } });
const say = (text) => ({ type: 'text', text });

function transcript(body, ms) {
    const file = path.join(tmp('fankeel-await-stalled-'), 'agent-brain.jsonl');
    fs.writeFileSync(file, body);
    fs.utimesSync(file, ms / 1000, ms / 1000);
    return file;
}

const WAITS = asst('m1', [use('t1')]) + launch('t1', 'ac350022849c5b060') + asst('m2', [say('等 implementer 回來')]);
const base = { handoff: '/nowhere/build.md', commit: [], since: 0, idleMs: 180000, started: T - 3600000 };

test('launched: the background children a transcript dispatched, in order, once each', () => {
    assert.deepEqual(launched(transcript(WAITS + launch('t1', 'ac350022849c5b060'), T)), ['ac350022849c5b060']);
    assert.deepEqual(launched(transcript(asst('m1', [say('hi')]), T)), []);
    assert.deepEqual(launched(path.join(tmp('fankeel-await-stalled-'), 'none.jsonl')), []);
});

test('awaitState: idle past idleMs with children launched is stalled', () => {
    const f = transcript(WAITS, T - 600000);
    assert.equal(awaitState({ ...base, activity: [f], waiting: ['ac350022849c5b060'], now: T }), 'stalled');
});

test('awaitState: idle with nothing launched is still lost', () => {
    const f = transcript(asst('m1', [say('done')]), T - 600000);
    assert.equal(awaitState({ ...base, activity: [f], waiting: [], now: T }), 'lost');
});

test('awaitState: a brain still writing is neither', () => {
    const f = transcript(WAITS, T - 10000);
    assert.equal(awaitState({ ...base, activity: [f], waiting: ['ac350022849c5b060'], now: T }), null);
});

test('lineFor: stalled names the agent, its children and their worktrees, and the fixed response', () => {
    const text = lineFor('stalled', { agentId: 'abrain', waiting: ['ac35'], worktrees: ['F:/r/.claude/worktrees/agent-ac35'], idleMs: 180000 });
    assert.match(text, /^stalled abrain/);
    assert.match(text, /ac35/);
    assert.match(text, /\.claude\/worktrees\/agent-ac35/);
    assert.match(text, /SendMessage/);
    assert.match(text, /stop it/);
});
