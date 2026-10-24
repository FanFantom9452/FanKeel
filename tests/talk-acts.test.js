'use strict';
// The station's 對話 tab, read side: each run of tool calls between Claude's
// words as one `act` turn with every tool's one-line brief and every Agent
// dispatch with its state, and a subagent's own transcript as a view with its
// final report (lib/talkacts.js, lib/conversation.js `turnsOf`).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { turnsOf, countsOf } = require('../lib/conversation.js');
const talkacts = require('../lib/talkacts.js');
const tmp = require('./tmp.js');

const T = (s) => '2026-10-24T01:00:' + String(s).padStart(2, '0') + '.000Z';
const user = (content, s, extra) => Object.assign({ type: 'user', timestamp: T(s), message: { role: 'user', content } }, extra);
const said = (id, content, s) => ({ type: 'assistant', timestamp: T(s), message: { id, model: 'claude-opus-5-5', content } });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const back = (id, s, meta, error) => user([{ type: 'tool_result', tool_use_id: id, content: 'ok', is_error: error === true }], s, meta ? { toolUseResult: meta } : {});

const ENTRIES = [
    user('fix it', 1),
    said('m1', [{ type: 'text', text: 'Looking.' }, use('tu_b', 'Bash', { command: 'npm test\nsecond line' })], 2),
    back('tu_b', 3),
    said('m2', [
        use('tu_r', 'Read', { file_path: 'lib/a.js' }),
        use('tu_a', 'Agent', { description: 'review the diff', subagent_type: 'fankeel:fankeel-reviewer', model: 'opus', prompt: 'p' }),
        use('tu_bg', 'Agent', { description: 'scan', subagent_type: 'general-purpose', run_in_background: true, prompt: 'p' }),
        use('tu_x', 'Agent', { description: 'read the map', subagent_type: 'Explore', prompt: 'p' }),
        use('tu_f', 'Agent', { description: 'broken', subagent_type: 'Explore', prompt: 'p' }),
    ], 4),
    back('tu_r', 5),
    back('tu_a', 6, { agentId: 'a1', status: 'completed' }),
    back('tu_bg', 6, { agentId: 'a2', status: 'async_launched' }),
    back('tu_f', 6, null, true),
    said('m3', [{ type: 'text', text: 'Done.' }], 7),
];
const NOTE = user('<task-notification>\n<tool-use-id>tu_bg</tool-use-id>\n<status>completed</status>\n</task-notification>', 8, { origin: { kind: 'task-notification' } });

test('acts: one act turn per run of tool calls, the Agent calls apart from the tools', () => {
    const read = turnsOf(ENTRIES.concat([NOTE]), { acts: true });
    assert.deepEqual(read.turns.map((t) => t.kind), ['user', 'claude', 'act', 'claude']);
    const act = read.turns[2];
    assert.equal(act.at, T(2));
    assert.deepEqual(act.tools.map((t) => [t.name, t.brief, t.id]), [['Bash', 'npm test', 'tu_b'], ['Read', 'lib/a.js', 'tu_r']]);
    assert.deepEqual(act.agents.map((a) => [a.id, a.description, a.agentType, a.model, a.background, a.state, a.agentId]), [
        ['tu_a', 'review the diff', 'fankeel:fankeel-reviewer', 'opus', false, 'finished', 'a1'],
        ['tu_bg', 'scan', 'general-purpose', null, true, 'finished', 'a2'],
        ['tu_x', 'read the map', 'Explore', null, false, 'running', null],
        ['tu_f', 'broken', 'Explore', null, false, 'failed', null],
    ]);
    assert.deepEqual(countsOf(read.turns), { compact: 0, user: 1, claude: 2 }, 'an act is not a Claude turn');
    assert.equal(read.skipped.notification, 1, 'the notification is still skipped');
});

test('a background agent is running until its task-notification arrives, as a user line or a queued attachment', () => {
    const none = turnsOf(ENTRIES, { acts: true }).turns[2].agents[1];
    assert.deepEqual([none.state, none.background], ['running', true]);
    const queued = { type: 'attachment', timestamp: T(8), attachment: { type: 'queued_command', commandMode: 'task-notification',
        prompt: '<task-notification><tool-use-id>tu_bg</tool-use-id></task-notification>' } };
    assert.equal(turnsOf(ENTRIES.concat([queued]), { acts: true }).turns[2].agents[1].state, 'finished');
});

test('without acts the turns are what they were; with tools, acts is ignored', () => {
    assert.deepEqual(turnsOf(ENTRIES).turns.map((t) => t.kind), ['user', 'claude', 'claude']);
    const both = turnsOf(ENTRIES, { tools: true, acts: true }).turns.map((t) => t.kind);
    assert.ok(both.includes('tool') && !both.includes('act'));
});

test('sidechain lines are skipped unless asked for', () => {
    const side = [user('Review this.', 1, { isSidechain: true }), Object.assign(said('s1', [{ type: 'text', text: 'Fine.' }], 2), { isSidechain: true })];
    assert.deepEqual(turnsOf(side).turns, []);
    assert.equal(turnsOf(side).skipped.sidechain, 2);
    assert.deepEqual(turnsOf(side, { sidechain: true }).turns.map((t) => t.kind), ['user', 'claude']);
});

test('briefOf says what a call did in one line of at most 80 characters', () => {
    assert.equal(talkacts.briefOf('Bash', { command: 'npm test\nmore' }), 'npm test');
    assert.equal(talkacts.briefOf('Edit', { file_path: 'C:\\w\\lib\\a.js' }), 'C:/w/lib/a.js');
    assert.equal(talkacts.briefOf('Grep', { pattern: 'turnsOf' }), 'turnsOf');
    assert.equal(talkacts.briefOf('mcp__ccd_turn__wrap_up', {}), 'ccd_turn · wrap_up');
    assert.equal(talkacts.briefOf('WebFetch', { url: 'https://example.com/a' }), 'https://example.com/a');
    assert.equal(talkacts.briefOf('TodoWrite', {}), '');
    const long = talkacts.briefOf('Bash', { command: 'x'.repeat(200) });
    assert.equal(long.length, 80);
    assert.ok(long.endsWith('…'));
});

test('noteIdOf reads the tool-use id of a task-notification and nothing else', () => {
    assert.equal(talkacts.noteIdOf('<task-notification>\n<tool-use-id> tu_9 </tool-use-id>'), 'tu_9');
    assert.equal(talkacts.noteIdOf('<tool-use-id>tu_9</tool-use-id>'), null);
    assert.equal(talkacts.noteIdOf(null), null);
});

test('linkAgents finds a running agent by its meta.json toolUseId, and a linked agent not running any more is finished', () => {
    const dir = path.join(tmp('fankeel-talkacts-'), 'sess');
    fs.mkdirSync(path.join(dir, 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'subagents', 'agent-a3.meta.json'), JSON.stringify({ toolUseId: 'tu_x', agentType: 'Explore' }));
    const fresh = () => turnsOf(ENTRIES, { acts: true }).turns;
    const on = talkacts.linkAgents(fresh(), dir, [{ id: 'a3' }])[2].agents[2];
    assert.deepEqual([on.agentId, on.state], ['a3', 'running']);
    const off = talkacts.linkAgents(fresh(), dir, [])[2].agents[2];
    assert.deepEqual([off.agentId, off.state], ['a3', 'finished']);
    const failed = talkacts.linkAgents(fresh(), dir, [])[2].agents[3];
    assert.equal(failed.state, 'failed', 'only running is moved');
    assert.doesNotThrow(() => talkacts.linkAgents(fresh(), path.join(dir, 'none'), []));
});

test('agentView: tool calls carry a brief, results are cut at 2000, the report is the last thing said once finished', () => {
    const lines = [
        user('Review this diff.', 1, { isSidechain: true }),
        Object.assign(said('s1', [use('r1', 'Read', { file_path: 'lib/x.js' })], 2), { isSidechain: true }),
        user([{ type: 'tool_result', tool_use_id: 'r1', content: 'y'.repeat(3000) }], 3, { isSidechain: true }),
        Object.assign(said('s2', [{ type: 'text', text: 'All good: no findings.' }], 4), { isSidechain: true }),
    ];
    const read = turnsOf(lines, { tools: true, sidechain: true });
    const v = talkacts.agentView(read, { id: 'a1', agentType: 'fankeel:fankeel-reviewer', description: 'review the diff', model: 'opus', running: false });
    assert.deepEqual(v.turns.map((t) => t.kind), ['user', 'tool', 'result', 'claude']);
    assert.deepEqual([v.turns[1].name, v.turns[1].brief, v.turns[1].id], ['Read', 'lib/x.js', 'r1']);
    assert.deepEqual([v.turns[2].text.length, v.turns[2].cut], [talkacts.RESULT_CAP, true]);
    assert.deepEqual([v.state, v.report, v.model], ['finished', 'All good: no findings.', 'opus']);
    const run = talkacts.agentView(read, { id: 'a1', running: true });
    assert.deepEqual([run.state, run.report, run.agentType, run.description], ['running', null, null, '']);
});
