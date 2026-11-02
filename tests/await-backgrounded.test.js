'use strict';

// await-17: Claude Code 2.1.311 answers a foreground command that reaches its
// timeout with the output so far and a line saying it still runs in the
// background. The tool call is answered, so pendingTool is false; the agent
// then waits for the shell and writes nothing, and awaitState read it `lost`
// after idleMs while the shell ran. A shell result that says so now holds
// `lost` off until busyMs, like an unanswered tool_use, until the shell's
// <task-notification> arrives.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { awaitState, backgroundedShell } = require('../lib/handoff.js');
const tmp = require('./tmp.js');

const T = 1800000000000;
const line = (o) => JSON.stringify(o) + '\n';
const asst = (id, blocks) => line({ type: 'assistant', message: { id, content: blocks } });
const user = (blocks) => line({ type: 'user', message: { content: blocks } });
const use = (id, name) => ({ type: 'tool_use', id, name: name || 'Bash', input: { command: 'node --test' } });
const result = (id, text) => ({ type: 'tool_result', tool_use_id: id, content: text });
const say = (text) => ({ type: 'text', text });

const MOVED = 'Command timed out after 120000ms. Output so far:\nstart\n\nThe command is still running in the background (shell b1a2c3).';

function transcript(body, ms) {
    const file = path.join(tmp('fankeel-await-backgrounded-'), 'agent-a1.jsonl');
    fs.writeFileSync(file, body);
    if (ms) fs.utimesSync(file, ms / 1000, ms / 1000);
    return file;
}

const WAITING = asst('m1', [use('t1')]) + user([result('t1', MOVED)]) + asst('m2', [say('waiting for the shell')]);
const PLAIN = asst('m1', [use('t1')]) + user([result('t1', 'ok')]) + asst('m2', [say('done')]);
const NOTIFIED = WAITING + user([say('<task-notification><tool-use-id>t1</tool-use-id><status>completed</status></task-notification>')]) + asst('m3', [say('it finished')]);

test('backgroundedShell: a shell result saying it still runs in the background counts', () => {
    assert.equal(backgroundedShell(transcript(WAITING)), true);
    assert.equal(backgroundedShell(transcript(asst('m1', [use('t1', 'PowerShell')]) + user([result('t1', MOVED)]))), true);
    assert.equal(backgroundedShell(transcript(asst('m1', [use('t1')]) + user([result('t1', [{ type: 'text', text: MOVED }])]))), true, 'content as an array of blocks');
});

test('backgroundedShell: an ordinary result, a notified shell, another tool or no file do not', () => {
    assert.equal(backgroundedShell(transcript(PLAIN)), false);
    assert.equal(backgroundedShell(transcript(NOTIFIED)), false, 'its task-notification came back');
    assert.equal(backgroundedShell(transcript(asst('m1', [use('t1', 'Read')]) + user([result('t1', MOVED)]))), false, 'a file read that quotes the phrase');
    assert.equal(backgroundedShell(path.join(tmp('fankeel-await-backgrounded-'), 'none.jsonl')), false);
    assert.equal(backgroundedShell(transcript('')), false);
});

test('awaitState: a backgrounded shell holds lost off until busyMs; an ordinary finish does not', () => {
    const dir = tmp('fankeel-await-backgrounded-');
    const base = { handoff: path.join(dir, 'build.md'), commit: path.join(dir, 'build-commit.md'), since: T, idleMs: 180000, busyMs: 660000, started: T - 900000 };
    const moved = transcript(WAITING, T - 200000);
    assert.equal(awaitState({ ...base, activity: [moved], now: T }), null, '200 s after the result is busy, not lost');
    assert.equal(awaitState({ ...base, activity: [moved], now: T + 470000 }), 'lost', '670 s is past busyMs');
    assert.equal(awaitState({ ...base, activity: [transcript(PLAIN, T - 200000)], now: T }), 'lost', 'an ordinary finish idle 200 s is lost, as before');
    assert.equal(awaitState({ ...base, activity: [transcript(NOTIFIED, T - 200000)], now: T }), 'lost', 'the shell reported back: nothing is out any more');
    assert.equal(awaitState({ ...base, activity: [transcript(WAITING, T - 200000)], waiting: ['c1'], now: T }), null, 'held before stalled is asked');
    assert.equal(awaitState({ ...base, activity: [transcript(WAITING, T - 200000)], waiting: ['c1'], now: T + 470000 }), 'stalled', 'past busyMs a brain with background children is stalled, as before');
});
