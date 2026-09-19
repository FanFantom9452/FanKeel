'use strict';
// Every agent row carries a state — running, done or lost — read off the
// agent's own transcript and its session's liveness, and nothing else: no hook
// writes it (docs/plans/2026-09-19-station-live-design.md §3). Read here the
// way the page reads it: through the serializers the server and the static
// write use.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'cccccccc-3333-4333-8333-333333333333';
const AGENT = 'a1b2c3';      // agentFiles() takes hex ids only
const FLOW = 'b4d5e6';
const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const said = (s, content, stop) => ({ type: 'assistant', isSidechain: true, requestId: 'q' + s, timestamp: T(s),
    message: { model: 'claude-sonnet-5', usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: stop, content } });
const result = (s, id, text) => ({ type: 'user', isSidechain: true, timestamp: T(s),
    message: { content: [{ type: 'tool_result', tool_use_id: id, content: text }] } });

// The fixture the design names: an agent transcript that stops on a tool_use
// with no tool_result.
const OPEN = [
    { type: 'user', isSidechain: true, timestamp: T(2), message: { content: 'Build Task 3 of the plan.' } },
    { type: 'user', isSidechain: true, isMeta: true, timestamp: T(2), message: { content: '<system-reminder>x</system-reminder>' } },
    said(3, [{ type: 'tool_use', id: 'u1', name: 'Read', input: { file_path: 'F:/ws/lib/detail.js' } }], 'tool_use'),
    result(4, 'u1', 'the file'),
    said(5, [{ type: 'tool_use', id: 'u2', name: 'Bash', input: { command: 'node --test tests/detail.test.js' } }], 'tool_use'),
];
// The same fixture with its tool_result and its closing text.
const DONE = OPEN.concat([result(6, 'u2', 'ℹ pass 4'), said(7, [{ type: 'text', text: 'Task 3 is done.' }], 'end_turn')]);

// One session with one Agent dispatch and one Workflow agent, both running the
// lines given. `live` puts this process in Claude Code's sessions/ under the
// session's id, its process started at `startedAt`; without it the session has
// no running process.
function fixture(agentLines, opts) {
    const o = opts || {};
    const base = tmp('fankeel-agent-state-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    const sub = path.join(proj, SID, 'subagents');
    fs.mkdirSync(path.join(sub, 'workflows', 'wf_1'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(ws);
    registry.writeSession(ws, SID, { task: 'station live', stage: 'build', route: ['survey', 'build'], active: true,
        claims: [], started: T(0), updated: T(9), configDir: cfg });
    fs.writeFileSync(path.join(proj, SID + '.jsonl'),
        line({ type: 'user', timestamp: T(0), message: { content: 'go' } })
        + line({ type: 'assistant', requestId: 'm1', timestamp: T(1), message: { model: 'claude-opus-5', usage: { input_tokens: 100 },
            content: [{ type: 'tool_use', id: 'toolu_1', name: 'Agent', input: { description: 'Task 3', subagent_type: 'general-purpose', prompt: 'Build Task 3 of the plan.' } }] } }));
    fs.writeFileSync(path.join(sub, 'agent-' + AGENT + '.jsonl'), agentLines.map(line).join(''));
    fs.writeFileSync(path.join(sub, 'agent-' + AGENT + '.meta.json'),
        JSON.stringify({ agentType: 'general-purpose', description: 'Task 3', toolUseId: 'toolu_1', model: 'sonnet' }));
    fs.writeFileSync(path.join(sub, 'workflows', 'wf_1', 'agent-' + FLOW + '.jsonl'), agentLines.map(line).join(''));
    if (o.live) {
        fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
            JSON.stringify({ pid: process.pid, sessionId: SID, cwd: ws, startedAt: o.startedAt }));
    }
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: T(0) }) + '\n');
    return { cfg, ws, sub };
}

// What the page reads: the list row out of station-data.js and the detail out
// of the session's detail script, through the serializers the server uses.
function read(f) {
    const model = station.gather({ configDir: f.cfg });
    const s = model.registries[0].sessions.find((x) => x.sessionId === SID);
    const win = {};
    vm.runInNewContext(station.serialize(model, {}) + station.serializeDetail(s), { window: win });
    return { row: win.STATION.sessions.find((x) => x.id === SID), x: win.STATION_DETAIL[SID] };
}

test('an agent whose transcript stops on a tool_use with no result is running, and names that tool', () => {
    const { row, x } = read(fixture(OPEN, { live: true, startedAt: Date.parse(T(0)) }));
    assert.equal(row.state, 'live');
    assert.equal(x.states[AGENT], 'running');
    // `cur` comes back through `vm.runInNewContext`, a different realm from
    // this file's own object literals: `assert.deepEqual` (strict) treats two
    // otherwise-identical plain objects from two realms as unequal, since
    // their `Object.prototype` differ — the same reason every other assertion
    // here reads fields into a host-side array rather than comparing a nested
    // object straight off `x`.
    const cur = x.steps[AGENT].cur;
    assert.deepEqual([cur.n, cur.t, cur.k, cur.c], ['Bash', Date.parse(T(5)), 'cmd', 'node --test tests/detail.test.js']);
    assert.equal(x.steps[AGENT].prompt, 'Build Task 3 of the plan.', 'the first user line, not the system reminder after it');
    assert.equal(row.running, 2, 'the Agent and the Workflow agent are both running');
});

test('the same transcript with its tool_result and closing text is done', () => {
    const { row, x } = read(fixture(DONE, { live: true, startedAt: Date.parse(T(0)) }));
    assert.equal(x.states[AGENT], 'done');
    assert.equal(x.steps[AGENT].cur, null);
    assert.equal(row.running, 0);
});

test('an agent that had not finished when its session stopped running is lost', () => {
    const { row, x } = read(fixture(OPEN, { live: false }));
    assert.equal(row.state, 'stale');
    assert.equal(x.states[AGENT], 'lost');
    assert.equal(row.running, null, 'a row that is not live counts no running agents');
});

// A session resumed under the same id is live again in a new process. An agent
// the old process left open is not that process's, so it is lost too.
test('an agent left open by an earlier process of a session that is live again is lost', () => {
    const { row, x } = read(fixture(OPEN, { live: true, startedAt: Date.parse(T(30)) }));
    assert.equal(row.state, 'live');
    assert.equal(x.states[AGENT], 'lost');
    assert.equal(x.since, Date.parse(T(30)));
    assert.equal(row.running, 0);
});

test('a Workflow agent is judged by the same reading', () => {
    const open = read(fixture(OPEN, { live: true, startedAt: Date.parse(T(0)) })).x;
    const done = read(fixture(DONE, { live: true, startedAt: Date.parse(T(0)) })).x;
    const lost = read(fixture(OPEN, { live: false })).x;
    assert.equal(open.rows.find((r) => r.id === FLOW).surface, 'workflow');
    assert.deepEqual([open.states[FLOW], done.states[FLOW], lost.states[FLOW]], ['running', 'done', 'lost']);
});
