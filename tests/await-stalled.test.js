'use strict';

// await-16: a brain that dispatched background children and then stopped,
// saying it waits on them, is `stalled`, not `lost`; one that never
// dispatched anything is still `lost`, and one still writing is neither.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { awaitState, awaitHandoff, launched } = require('../lib/handoff.js');
const { main: awaitMain, lineFor } = require('../scripts/await.js');
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

const result = (useId, text) => line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: useId, content: text }] } });
const useOf = (id, name, input) => ({ type: 'tool_use', id, name, input });

test('launched: a foreground Agent result and agentId text read out of code are not launches', () => {
    const fg = asst('m1', [useOf('f1', 'Agent', { prompt: 'x' })])
        + result('f1', 'built it\nagentId: abc123 (use SendMessage to resume)\n<usage>total_tokens: 9</usage>')
        + asst('m2', [useOf('f2', 'Agent', { prompt: 'x', run_in_background: false })])
        + result('f2', 'agentId: def456\n<usage>total_tokens: 9</usage>');
    assert.deepEqual(launched(transcript(fg, T)), [], 'foreground results');
    const code = asst('m1', [useOf('t1', 'Read', { file_path: 'a.js' })]) + result('t1', 'const x = { agentId: o.agentId };');
    assert.deepEqual(launched(transcript(code, T)), [], 'code text yields no id');
    assert.deepEqual(launched(transcript(fg + WAITS, T)), ['ac350022849c5b060'], 'only the background launch among them counts');
});

test('launched: a result counts by its tool_use being a background Agent, or by its Async opening', () => {
    const byUse = asst('m1', [use('t1')]) + result('t1', 'started\nagentId: aa11');
    assert.deepEqual(launched(transcript(byUse, T)), ['aa11'], 'matched by tool_use_id');
    const byText = result('gone', 'Async agent launched successfully.\nagentId: bb22 (internal ID)');
    assert.deepEqual(launched(transcript(byText, T)), ['bb22'], 'its tool_use fell out of the tail');
});

test('awaitHandoff passes the waiting thunk through: stalled with it, lost without', async () => {
    const f = transcript(WAITS, Date.now() - 600000);
    const o = { handoff: path.join(path.dirname(f), 'build.md'), commit: [], since: 0, idleMs: 200, timeoutMs: 5000, activity: () => [f] };
    assert.equal(await awaitHandoff({ ...o, waiting: () => ['ac35'] }), 'stalled');
    assert.equal(await awaitHandoff({ ...o, waiting: () => [] }), 'lost');
    assert.equal(await awaitHandoff(o), 'lost');
});

const SID = 'aaaaaaaa-0000-4000-8000-000000000001';
function brain(body) {
    const root = tmp('fankeel-await-stalled-root-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify({ active: true, stage: 'build', started: '2026-09-23T10:00:00.000Z',
        moves: [['build', 1]], inflight: { stage: 'build', at: 1, agentId: 'a3f9c2' } }));
    const config = tmp('fankeel-await-stalled-config-');
    const session = path.join(config, 'projects', 'F--x');
    fs.mkdirSync(session, { recursive: true });
    fs.writeFileSync(path.join(session, SID + '.jsonl'), 'x\n');
    fs.mkdirSync(path.join(session, SID, 'subagents'), { recursive: true });
    const own = path.join(session, SID, 'subagents', 'agent-a3f9c2.jsonl');
    fs.writeFileSync(own, body);
    fs.utimesSync(own, (Date.now() - 600000) / 1000, (Date.now() - 600000) / 1000);
    return { root, env: { CLAUDE_CONFIG_DIR: config }, task: path.join(root, '.fankeel', 'build', 'task-20260923T100000').replace(/\\/g, '/') };
}

test('await.js prints stalled with the children and their existing worktrees, and writes mode: stalled', async () => {
    const g = brain(WAITS);
    fs.mkdirSync(path.join(g.root, '.claude', 'worktrees', 'agent-ac350022849c5b060'), { recursive: true });
    const out = await awaitMain(['--session', SID, '--root', g.root, '--idle', '0.2'], g.env);
    assert.match(out.text, /^stalled a3f9c2 — it launched ac350022849c5b060 and/, out.text);
    assert.match(out.text, /agent-ac350022849c5b060/, 'the worktree that exists is named');
    assert.match(out.text, /Failure handoff: /);
    const body = fs.readFileSync(g.task + '/build-failed.md', 'utf8');
    assert.match(body, /^mode: stalled$/m);
    assert.match(body, /^next: SendMessage the agent once; stalled again, stop it and dispatch a fresh one$/m);
    const none = brain(WAITS);
    const bare = await awaitMain(['--session', SID, '--root', none.root, '--idle', '0.2'], none.env);
    assert.match(bare.text, /uncommitted worktrees: none\./, 'a worktree that is not on disk is not listed');
});

test('await.js reads a brain that ran only a foreground implementer as lost, not stalled', async () => {
    const fg = asst('m1', [useOf('t1', 'Agent', { prompt: 'x' })]) + result('t1', 'done\nagentId: abc123\n<usage>total_tokens: 9</usage>') + asst('m2', [say('handing back')]);
    const g = brain(fg);
    const out = await awaitMain(['--session', SID, '--root', g.root, '--idle', '0.2'], g.env);
    assert.match(out.text, /^lost a3f9c2 /, out.text);
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

const note = (id) => line({ type: 'user', message: { content: [{ type: 'text', text: '<task-notification>\n<task-id>x</task-id>\n<tool-use-id>' + id + '</tool-use-id>\n<status>completed</status>\n</task-notification>' }] } });
test('launched: a child whose task-notification came back is not waiting; an un-notified one still is', () => {
    const body = asst('m1', [use('t1')]) + launch('t1', 'aa11') + note('t1') + asst('m2', [use('t2')]) + launch('t2', 'bb22');
    assert.deepEqual(launched(transcript(body, T)), ['bb22']);
    assert.deepEqual(launched(transcript(asst('m1', [use('t1')]) + launch('t1', 'aa11') + note('t1'), T)), []);
});

test('launched: a task-notification delivered as an attachment entry also marks the child as returned', () => {
    const attached = line({ attachment: { prompt: '<task-notification>\n<task-id>x</task-id>\n<tool-use-id>t1</tool-use-id>\n<status>completed</status>\n</task-notification>' } });
    assert.deepEqual(launched(transcript(asst('m1', [use('t1')]) + launch('t1', 'aa11') + attached, T)), []);
});

test('await.js reads a brain whose children all reported back as lost, not stalled', async () => {
    const g = brain(asst('m1', [use('t1')]) + launch('t1', 'aa11') + note('t1') + asst('m2', [say('all done')]));
    const out = await awaitMain(['--session', SID, '--root', g.root, '--idle', '0.2'], g.env);
    assert.match(out.text, /^lost a3f9c2 /, out.text);
});

test('await.js: a second stalled in a row says stop it and dispatch a fresh one, not ask the user', async () => {
    const g = brain(WAITS);
    const args = ['--session', SID, '--root', g.root, '--idle', '0.2'];
    await awaitMain(args, g.env);
    assert.match(fs.readFileSync(g.task + '/build-failed.md', 'utf8'), /^next: .*SendMessage/m);
    await awaitMain(args, g.env);
    const body = fs.readFileSync(g.task + '/build-failed.md', 'utf8');
    assert.match(body, /^count: 2$/m);
    assert.doesNotMatch(body, /^next: .*SendMessage/m);
    assert.match(body, /^next: .*stop it and dispatch a fresh one/m);
    assert.doesNotMatch(body, /ask the user/);
});
