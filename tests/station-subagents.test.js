'use strict';
// The station's live rows (design docs/90-agent/plans/2026-09-27-todo-batch-design.md §5):
// when the gate went out (`gateAt`), which stage agent is in flight (`inflight`),
// and which subagents are running now — read from `subagents/agent-<id>.meta.json`
// beside the session's transcript, running meaning the jsonl's last turn is not
// an answer (text, no tool_use) and the file moved inside the quiet window.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const usage = require('../lib/usage.js');
const tmp = require('./tmp.js');

const SID = 'cccccccc-3333-4333-8333-333333333333';
const line = (o) => JSON.stringify(o) + '\n';
const at = () => new Date().toISOString();
const said = (content, stop) => line({ type: 'assistant', isSidechain: true, timestamp: at(), effort: 'medium',
    message: { model: 'claude-sonnet-5', stop_reason: stop, content } });
const asked = (content) => line({ type: 'user', isSidechain: true, timestamp: at(), message: { content } });
const note = line({ type: 'attachment', isSidechain: true, attachment: { type: 'total_tokens_reminder' } });
const onTool = asked('Build Task 3.') + said([{ type: 'tool_use', id: 'u1', name: 'Bash', input: { command: 'x' } }], 'tool_use');
const back = asked([{ type: 'tool_result', tool_use_id: 'u1', content: 'ok' }]);

function agent(sub, id, meta, body, ageMs) {
    fs.writeFileSync(path.join(sub, 'agent-' + id + '.meta.json'), JSON.stringify(meta));
    const file = path.join(sub, 'agent-' + id + '.jsonl');
    fs.writeFileSync(file, body);
    if (ageMs) {
        const t = (Date.now() - ageMs) / 1000;
        fs.utimesSync(file, t, t);
    }
}

// Five agents: on a tool call, answered, waiting on a tool result behind an
// attachment, stopped three hours ago mid-call, and answered with a null
// stop_reason and an attachment after (the two real "Report delivered." files).
function seed(sessionDir) {
    const sub = path.join(sessionDir, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    agent(sub, 'a0000000000000001', { agentType: 'fankeel:fankeel-reader', description: 'sonnet 5 · inherit: read the map', model: 'sonnet' }, onTool);
    agent(sub, 'a0000000000000002', { agentType: 'general-purpose', description: 'answered' },
        onTool + back + said([{ type: 'text', text: 'done' }], 'end_turn'));
    agent(sub, 'a0000000000000003', { agentType: 'general-purpose', description: 'waiting on a tool result' }, onTool + back + note);
    agent(sub, 'a0000000000000004', { agentType: 'general-purpose', description: 'stopped long ago' }, onTool, 3 * 3600e3);
    agent(sub, 'a0000000000000005', { agentType: 'general-purpose', description: 'handed back' },
        onTool + back + said([{ type: 'text', text: 'Report delivered.' }], null) + note);
    return sub;
}

test('runningAgents lists the agents mid-turn and drops the answered and the long-stopped', () => {
    const dir = path.join(tmp('fankeel-subagents-'), SID);
    seed(dir);
    const got = usage.runningAgents(dir, Date.now());
    assert.deepEqual(got.map((a) => a.id), ['a0000000000000001', 'a0000000000000003']);
    const first = got[0];
    assert.equal(first.agentType, 'fankeel:fankeel-reader');
    assert.equal(first.description, 'sonnet 5 · inherit: read the map');
    assert.equal(first.model, 'sonnet');
    assert.equal(got[1].model, null);
    assert.ok(Number.isFinite(first.startedAt) && Number.isFinite(first.lastAt));
    // The quiet window is the only thing that drops the stopped one.
    assert.deepEqual(usage.runningAgents(dir, Date.now(), { quietMs: 24 * 3600e3 }).map((a) => a.id),
        ['a0000000000000001', 'a0000000000000003', 'a0000000000000004']);
});

test('runningAgents is empty without a subagents directory or a session directory', () => {
    assert.deepEqual(usage.runningAgents(tmp('fankeel-subagents-none-'), Date.now()), []);
    assert.deepEqual(usage.runningAgents(null, Date.now()), []);
});

function machine(active) {
    const base = tmp('fankeel-station-rows-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.mkdirSync(proj, { recursive: true });
    registry.ensureLayout(ws);
    const now = Date.now();
    registry.writeSession(ws, SID, { task: 'rows', stage: 'build', route: ['survey', 'build'], active, claims: [],
        started: new Date(now - 600000).toISOString(), updated: new Date(now - 60000).toISOString(), configDir: cfg,
        gateAt: now - 720000, inflight: { stage: 'build', at: now - 480000, agentId: 'a0000000000000001', lap: 1 } });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
        JSON.stringify({ pid: process.pid, sessionId: SID, cwd: ws, startedAt: now - 900000 }));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: new Date(now).toISOString() }) + '\n');
    fs.writeFileSync(path.join(proj, SID + '.jsonl'), line({ type: 'user', timestamp: new Date(now - 600000).toISOString(), message: { content: 'go' } }));
    seed(path.join(proj, SID));
    return { cfg, now };
}

test('a live row carries gateAt, its inflight mark and its running subagents, and serialize passes them on', () => {
    const m = machine(true);
    const model = station.gather({ configDir: m.cfg, details: false });
    const row = model.registries.flatMap((r) => r.sessions).find((s) => s.sessionId === SID);
    assert.equal(row.state, 'live');
    assert.equal(row.gateAt, m.now - 720000);
    assert.deepEqual(row.inflight, { stage: 'build', at: m.now - 480000, agentId: 'a0000000000000001' });
    assert.deepEqual(row.subagents.map((a) => a.id), ['a0000000000000001', 'a0000000000000003']);
    const out = station.serialize(model);
    const data = JSON.parse(out.slice('window.STATION = '.length, -2));
    const s = data.sessions.find((x) => x.id === SID);
    assert.equal(s.gateAt, m.now - 720000);
    assert.deepEqual(s.inflight, row.inflight);
    assert.deepEqual(s.subagents.map((a) => a.id), ['a0000000000000001', 'a0000000000000003']);
});

test('a row that is not active reads no subagents and no inflight mark', () => {
    const m = machine(false);
    const row = station.gather({ configDir: m.cfg, details: false }).registries.flatMap((r) => r.sessions)
        .find((s) => s.sessionId === SID);
    assert.equal(row.state, 'down');
    assert.deepEqual(row.subagents, []);
    assert.equal(row.inflight, null);
    assert.equal(row.gateAt, m.now - 720000);
});

test('a running agent row carries the model and effort its transcript last ran', () => {
    const dir = tmp('sa-ran-');
    seed(dir);
    const rows = usage.runningAgents(dir, Date.now());
    const reader = rows.find((r) => r.id === 'a0000000000000001');
    assert.equal(reader.ranModel, 'claude-sonnet-5');
    assert.equal(reader.effort, 'medium');
});

test('the row reads the last assistant line, not the first', () => {
    const dir = tmp('sa-ran2-');
    const sub = path.join(dir, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const later = line({ type: 'assistant', isSidechain: true, timestamp: at(), effort: 'high',
        message: { model: 'claude-sonnet-5-5', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'u2', name: 'Bash', input: { command: 'y' } }] } });
    agent(sub, 'a0000000000000009', { agentType: 'general-purpose', description: 'two turns' }, onTool + back + later);
    const row = usage.runningAgents(dir, Date.now()).find((r) => r.id === 'a0000000000000009');
    assert.equal(row.ranModel, 'claude-sonnet-5-5');
    assert.equal(row.effort, 'high');
});
