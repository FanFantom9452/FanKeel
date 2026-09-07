'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'leave.js');
const SID = 'aaaaaaaa-1111-4111-8111-111111111111';

function run(payload, claudeDir) {
    return execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir },
        encoding: 'utf8',
    });
}

function fixture() {
    const base = tmp('fankeel-leave-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(root);
    registry.writeSession(root, SID, { task: 'the ramp', stage: 'build', route: ['survey', 'build'], active: true,
        claims: ['a.js'], started: new Date().toISOString(), updated: new Date().toISOString(), configDir: cfg });
    const transcript = path.join(base, 't.jsonl');
    const a = (requestId, model, usage) => JSON.stringify({ type: 'assistant', requestId, message: { model, usage } }) + '\n';
    fs.writeFileSync(transcript, [
        a('r1', 'claude-sonnet-5', { input_tokens: 10, output_tokens: 20 }),
        a('r1', 'claude-sonnet-5', { input_tokens: 10, output_tokens: 20 }),
        a('r2', 'claude-sonnet-5', { input_tokens: 1, output_tokens: 2 }),
    ].join(''));
    const agentDir = path.join(base, 't', 'subagents');
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, 'agent-dddd.jsonl'), JSON.stringify({
        type: 'assistant', isSidechain: true, requestId: 'd1', timestamp: '2026-09-04T02:00:00.000Z',
        message: { model: 'claude-sonnet-5', usage: { input_tokens: 4, output_tokens: 8 } },
    }) + '\n');
    return { cfg, root, transcript };
}

// Task 3: a fixture with a `clock` on the entry and timestamped transcript
// lines, so `windowsFrom(clock)` has something to bucket the requests into.
function fixtureWithClock(clock) {
    const base = tmp('fankeel-leave-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(root);
    registry.writeSession(root, SID, { task: 'the ramp', stage: 'build', route: ['survey', 'build'], active: true,
        claims: ['a.js'], started: new Date().toISOString(), updated: new Date().toISOString(), configDir: cfg, clock });
    const transcript = path.join(base, 't.jsonl');
    const a = (requestId, at, model, usage) => JSON.stringify({
        type: 'assistant', requestId, timestamp: new Date(at).toISOString(), message: { model, usage },
    }) + '\n';
    fs.writeFileSync(transcript, [
        a('r1', 1500, 'claude-sonnet-5', { input_tokens: 10, output_tokens: 20 }),
        a('r2', 3500, 'claude-sonnet-5', { input_tokens: 1, output_tokens: 2 }),
        a('r3', 3500, 'claude-sonnet-5', { input_tokens: 1, output_tokens: 2 }),
    ].join(''));
    // Two agents, one landing in each window, so `spend` has both a stage the
    // parent shares with an agent and — with the clock this fixture is given —
    // nothing that would hide a bucket the parent happened to fill anyway.
    const agentDir = path.join(base, 't', 'subagents');
    fs.mkdirSync(agentDir, { recursive: true });
    const agent = (requestId, at, usage) => JSON.stringify({
        type: 'assistant', isSidechain: true, requestId, timestamp: new Date(at).toISOString(),
        message: { model: 'claude-opus-5', usage },
    }) + '\n';
    fs.writeFileSync(path.join(agentDir, 'agent-eeee.jsonl'), agent('e1', 1600, { input_tokens: 100, output_tokens: 200 }));
    fs.writeFileSync(path.join(agentDir, 'agent-ffff.jsonl'), [
        agent('f1', 3600, { input_tokens: 5, output_tokens: 6 }),
        agent('f2', 3700, { input_tokens: 7, output_tokens: 8 }),
    ].join(''));
    return { cfg, root, transcript };
}

// B1: a fixture with a `clock` on the entry, so `windows.length` is nonzero and
// `opts.stages` reaches `summarise`, but every transcript line lacks a
// `timestamp` field — so `summarise` can place none of them into a window and
// `usage.stages` comes back `{}`: present and truthy, not absent.
function fixtureWithClockNoTimestamps(clock) {
    const base = tmp('fankeel-leave-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(root);
    registry.writeSession(root, SID, { task: 'the ramp', stage: 'build', route: ['survey', 'build'], active: true,
        claims: ['a.js'], started: new Date().toISOString(), updated: new Date().toISOString(), configDir: cfg, clock });
    const transcript = path.join(base, 't.jsonl');
    const a = (requestId, model, usage) => JSON.stringify({ type: 'assistant', requestId, message: { model, usage } }) + '\n';
    fs.writeFileSync(transcript, [
        a('r1', 'claude-sonnet-5', { input_tokens: 10, output_tokens: 20 }),
    ].join(''));
    return { cfg, root, transcript };
}

test('records ended, model and usage on its own entry; active stays true; the page is regenerated; stdout is empty', () => {
    const f = fixture();
    const out = run({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, f.cfg);
    assert.equal(out, '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.active, true);
    assert.deepEqual(d.claims, ['a.js']);
    assert.equal(d.ended.reason, 'clear');
    assert.match(d.ended.at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(d.model, 'claude-sonnet-5');
    assert.deepEqual(d.usage.models, { 'claude-sonnet-5': { input: 11, output: 22, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });
    assert.equal(d.usage.requests, 2);
    assert.deepEqual(d.usage.subagents, { agents: 1, requests: 1, wallMs: 0,
        models: { 'claude-sonnet-5': { input: 4, output: 8, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } });
    const data = fs.readFileSync(path.join(f.cfg, 'fankeel', 'station-data.js'), 'utf8');
    assert.ok(data.includes('the ramp'), 'the task line is not in the data');
    assert.equal(fs.readFileSync(path.join(f.root, '.fankeel', 'station.html'), 'utf8'),
        fs.readFileSync(path.join(f.cfg, 'fankeel', 'station.html'), 'utf8'), 'the copy lands beside the ending session');
    assert.ok(!data.includes('<plugin>'), 'the plugin path did not resolve');
});

test('a session with no entry still regenerates the page, and an unreadable transcript leaves usage absent', () => {
    const f = fixture();
    const other = 'bbbbbbbb-2222-4222-8222-222222222222';
    assert.equal(run({ session_id: other, transcript_path: path.join(f.root, 'missing.jsonl'), cwd: f.root, reason: 'other' }, f.cfg), '');
    assert.equal(registry.readSession(f.root, other), null);
    assert.ok(fs.existsSync(path.join(f.cfg, 'fankeel', 'station.html')));
    assert.equal(run({ session_id: SID, transcript_path: path.join(f.root, 'missing.jsonl'), cwd: f.root, reason: 'logout' }, f.cfg), '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.ended.reason, 'logout');
    assert.equal('usage' in d, false);
});

test('garbage on stdin exits 0 and writes nothing', () => {
    const f = fixture();
    assert.equal(execFileSync(process.execPath, [HOOK], { input: 'not json', env: { ...process.env, CLAUDE_CONFIG_DIR: f.cfg }, encoding: 'utf8' }), '');
    assert.equal(fs.existsSync(path.join(f.cfg, 'fankeel')), false);
});

test('leave writes spend per stage from the clock windows', () => {
    const f = fixtureWithClock({ survey: [1000, 2000], build: [3000, 4000] });
    const out = run({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, f.cfg);
    assert.equal(out, '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.spend.survey.requests, 1);
    assert.equal(d.spend.build.requests, 2);
    assert.deepEqual(d.spend.survey.models, { 'claude-sonnet-5': { input: 10, output: 20, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });
    assert.deepEqual(d.spend.build.models, { 'claude-sonnet-5': { input: 2, output: 4, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });
});

// The same rule end to end, through the hook that depends on it. This clock
// leaves 3000ms untouched between survey's last sighting and build's first —
// a gate, where the session sat waiting for an answer — and two of the three
// parent requests land inside it. They are survey's: the stage that opened the
// gate wears what was spent at it. Closing each window at its own `to` instead
// drops both requests off the record entirely, since no window would hold them.
test('a request landing in the gap between two stages is spent by the stage that opened it', () => {
    const f = fixtureWithClock({ survey: [1000, 2000], build: [5000, 6000] });
    assert.equal(run({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, f.cfg), '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.spend.survey.requests, 3, 'r1 at 1500 and both requests at 3500, which is in the gap');
    assert.deepEqual(d.spend.survey.models,
        { 'claude-sonnet-5': { input: 12, output: 24, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } },
        'the gap requests are added to survey, not silently lost');
    assert.equal(d.spend.build, undefined, 'nothing was timestamped after build opened');
    assert.equal(d.usage.requests, 3, 'and the whole-session total still holds every one of them');
    assert.equal(d.spend.survey.subagents.requests, 3, 'the agents in the gap are attributed by the same windows');
});

test('leave writes no spend when the entry has no clock', () => {
    const f = fixture();
    const out = run({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, f.cfg);
    assert.equal(out, '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.spend, undefined);
    assert.equal(d.usage.requests, 2);
});

// B1: unlike the test above, this entry has a clock and `windows.length` is
// nonzero, so `opts.stages` does reach `summarise` — but no transcript line has
// a parseable timestamp, so nothing lands in a window and `usage.stages` comes
// back `{}` rather than absent. `spend` must still be absent, not `{}`.
test('leave writes no spend when the clock windows catch no timestamped request', () => {
    const f = fixtureWithClockNoTimestamps({ survey: [1000, 2000], build: [3000, 4000] });
    const out = run({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, f.cfg);
    assert.equal(out, '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.spend, undefined);
    assert.equal(d.usage.requests, 1);
});

// The station's curve is drawn from `spend`, and a curve that leaves the agents
// out is a fraction of a session that fanned out — $0.83 against $2.22 on the
// run that found this. So each stage carries the agents' own bucket beside the
// parent's, in the shape `usage.subagents` already uses.
test('spend carries the agents of each stage beside the parent, in the same shape', () => {
    const f = fixtureWithClock({ survey: [1000, 2000], build: [3000, 4000] });
    assert.equal(run({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, f.cfg), '');
    const d = registry.readSession(f.root, SID);

    assert.equal(d.spend.survey.requests, 1, 'the parent half is untouched by the agents');
    assert.deepEqual(d.spend.survey.models, { 'claude-sonnet-5': { input: 10, output: 20, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });
    assert.equal(d.spend.survey.subagents.requests, 1);
    assert.deepEqual(d.spend.survey.subagents.models,
        { 'claude-opus-5': { input: 100, output: 200, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } },
        'the agent that ran in survey, and only that one');
    assert.equal(d.spend.build.subagents.requests, 2);
    assert.deepEqual(d.spend.build.subagents.models,
        { 'claude-opus-5': { input: 12, output: 14, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });

    // Nothing is counted twice: the parent's own bucket is the same figure the
    // hook wrote before agents were bucketed at all, and the whole-session
    // `usage.models` still has no trace of the agents' model in it.
    assert.equal('claude-opus-5' in d.usage.models, false, 'the parent transcript is read without the sidechain lines');
    assert.deepEqual(d.usage.subagents.models,
        { 'claude-opus-5': { input: 112, output: 214, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } },
        'the two stage buckets sum to exactly the whole-session agent total');
});

test('a stage where only the agents ran still carries their cost', () => {
    // `land` opens after every transcript line the parent wrote, so the parent
    // fills no bucket there. Without an entry of its own that stage would drop
    // out of `spend` entirely and the curve would step over money that was
    // really spent.
    const f = fixtureWithClock({ survey: [1000, 2000], land: [3650, 4000] });
    assert.equal(run({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, f.cfg), '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.spend.land.requests, 0, 'a zero parent, so the stage still exists');
    assert.deepEqual(d.spend.land.models, {});
    assert.deepEqual(d.spend.land.subagents.models,
        { 'claude-opus-5': { input: 7, output: 8, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } },
        'the one agent request after 3650');
});

test('usage keeps the shape it always had', () => {
    const f = fixtureWithClock({ survey: [1000, 2000], build: [3000, 4000] });
    const out = run({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, f.cfg);
    assert.equal(out, '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.usage.stages, undefined);
    assert.equal(d.usage.subagents.stages, undefined, 'the agents\' buckets are cleared from usage too, not only the parent\'s');
    assert.equal(d.usage.requests, 3);
    assert.equal(d.spend.survey.requests, 1, 'deleting usage.stages must not have carried away spend, which holds its own reference');
    assert.equal(d.spend.build.requests, 2, 'deleting usage.stages must not have carried away spend, which holds its own reference');
});
