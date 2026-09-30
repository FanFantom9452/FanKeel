'use strict';

// await-4: a stage agent whose transcript stood still because a tool call was
// still out (a full-suite Bash, a child's long run) was reported lost about
// eight times on 2026-09-30 while ListAgents showed it running. An unanswered
// tool_use at the tail of any activity file now holds `lost` off until busyMs.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { awaitState, awaitHandoff, pendingTool } = require('../lib/handoff.js');
const tmp = require('./tmp.js');

const T = 1800000000000;
const line = (o) => JSON.stringify(o) + '\n';
const asst = (id, blocks) => line({ type: 'assistant', message: { id, content: blocks } });
const result = (useId) => line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: useId, content: 'ok' }] } });
const use = (id) => ({ type: 'tool_use', id, name: 'Bash', input: { command: 'node --test' } });
const say = (text) => ({ type: 'text', text });

function transcript(body, ms) {
    const file = path.join(tmp('fankeel-await-pending-'), 'agent-a1.jsonl');
    fs.writeFileSync(file, body);
    if (ms) fs.utimesSync(file, ms / 1000, ms / 1000);
    return file;
}

// Claude Code writes one line per content block: the text, then the call.
const WAITING = asst('m1', [say('running the suite')]) + asst('m1', [use('t1')]);
const DONE = WAITING + result('t1') + asst('m2', [say('all green, handing back')]);

test('pendingTool: an unanswered tool_use is pending; answered, or a text reply, is not', () => {
    assert.equal(pendingTool(transcript(WAITING)), true);
    assert.equal(pendingTool(transcript(WAITING + result('t1'))), false, 'answered: the model is thinking, idle rules as before');
    assert.equal(pendingTool(transcript(DONE)), false);
    assert.equal(pendingTool(transcript('')), false);
    assert.equal(pendingTool(path.join(tmp('fankeel-await-pending-'), 'none.jsonl')), false, 'no file');
    assert.equal(pendingTool(transcript('{"cut in half\n' + WAITING)), true, 'a line that does not parse is skipped');
});

test('pendingTool: parallel calls in one message are pending until every one is answered', () => {
    const two = asst('m1', [use('t1')]) + asst('m1', [use('t2')]);
    assert.equal(pendingTool(transcript(two + result('t2'))), true, 't1 is still out');
    assert.equal(pendingTool(transcript(two + result('t2') + result('t1'))), false);
});

test('awaitState: past idleMs with a tool call out is not lost until busyMs', () => {
    const dir = tmp('fankeel-await-pending-');
    const base = { handoff: path.join(dir, 'build.md'), commit: path.join(dir, 'build-commit.md'), since: T, idleMs: 180000, busyMs: 660000, started: T - 900000 };
    const waiting = transcript(WAITING, T - 200000);
    assert.equal(awaitState({ ...base, activity: [waiting], now: T }), null, '200 s into a tool call is busy, not lost');
    assert.equal(awaitState({ ...base, busyMs: undefined, activity: [waiting], now: T }), null, 'the default busyMs holds it too');
    assert.equal(awaitState({ ...base, activity: [waiting], now: T + 470000 }), 'lost', '670 s is past busyMs');
    const done = transcript(DONE, T - 200000);
    assert.equal(awaitState({ ...base, activity: [done], now: T }), 'lost', 'a finished transcript idle 200 s is lost, as before');
    assert.equal(awaitState({ ...base, activity: [done, waiting], now: T }), null, 'a child still in a tool call holds its parent too');
});

test('awaitHandoff keeps waiting through a tool call, and says lost once busyMs has passed', async () => {
    const dir = tmp('fankeel-await-pending-');
    const handoff = path.join(dir, 'build.md');
    const commit = path.join(dir, 'build-commit.md');
    const waiting = transcript(WAITING);
    const held = await awaitHandoff({ handoff, commit, since: 0, activity: () => [waiting], idleMs: 50, busyMs: 60000, timeoutMs: 400 });
    assert.equal(held, 'timeout');
    const t0 = Date.now();
    const gone = await awaitHandoff({ handoff, commit, since: 0, activity: () => [waiting], idleMs: 50, busyMs: 300, timeoutMs: 5000 });
    assert.equal(gone, 'lost');
    assert.ok(Date.now() - t0 >= 250, 'lost came before busyMs');
});
