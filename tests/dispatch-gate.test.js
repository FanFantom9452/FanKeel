'use strict';
// dispatch-1: eight Agent calls in one response is the default (four until
// 2026-10-19); the ninth and later in the same assistant message are asked of
// the user, with a figure.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { costOf } = require('../lib/prices.js');
const { positionOf, benchPerDispatch, spentSoFar, decide: decideAt } = require('../hooks/dispatch-gate.js');
// Most tests below are about the fifth call of five, so they pin the limit at 4;
// the default itself is pinned by the tests at the end of the file.
const decide = (p, o) => decideAt(p, { limit: 4, ...o });

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

test('a -high or -xhigh variant is priced as its base role', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const root = evidence(dir, 0.05, 5);
    const file = transcript(dir, five);
    for (const type of ['fankeel:fankeel-reader-high', 'fankeel:fankeel-reader-xhigh']) {
        const p = payload(file, 'toolu_5');
        p.tool_input.subagent_type = type;
        const out = decide(p, { data: null, evidenceRoot: root });
        assert.match(out.reason, /\$0\.0100 each for reader in role-reader-20261009T033513/);
        assert.doesNotMatch(out.reason, /No figure/);
    }
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
    fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'dispatch.inflight': 4 }));
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

const withArms = (dir, arms) => {
    const batch = path.join(dir, 'evidence', '2026-10-09-arms', 'role-reader-20261009T033513');
    fs.mkdirSync(batch, { recursive: true });
    fs.writeFileSync(path.join(batch, 'summary.json'), JSON.stringify({ arms }));
    return path.join(dir, 'evidence');
};

test('the bench figure comes from the arm of the dispatch\'s own model, all arms when none matches', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const root = withArms(dir, [
        { role: 'reader', arm: 'haiku', runs: 5, roleUsd: 0.05 },
        { role: 'reader', arm: 'sonnet', runs: 5, roleUsd: 0.5 },
    ]);
    assert.equal(benchPerDispatch(root, 'reader', 'haiku').usd, 0.01);
    assert.equal(benchPerDispatch(root, 'reader', 'sonnet').usd, 0.1);
    assert.ok(Math.abs(benchPerDispatch(root, 'reader', 'opus').usd - 0.055) < 1e-9);
});

test('a subagent\'s dispatches are counted in its own transcript, not the session\'s', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const main = transcript(dir, []);
    const own = path.join(dir, SID, 'subagents');
    fs.mkdirSync(own, { recursive: true });
    fs.writeFileSync(path.join(own, 'agent-abc123.jsonl'), five.map((e) => JSON.stringify(e)).join('\n') + '\n');
    const out = decide({ ...payload(main, 'toolu_5'), agent_id: 'abc123' }, { data: null, evidenceRoot: evidence(dir, 0.05, 5) });
    assert.match(out.reason, /Agent call 5/);
    assert.equal(decide(payload(main, 'toolu_5'), { data: null, evidenceRoot: evidence(dir, 0.05, 5) }), null);
});

test('a workflow agent\'s transcript under subagents/workflows/<run>/ is found', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const main = transcript(dir, []);
    const wf = path.join(dir, SID, 'subagents', 'workflows', 'run1');
    fs.mkdirSync(wf, { recursive: true });
    fs.writeFileSync(path.join(wf, 'agent-def456.jsonl'), five.map((e) => JSON.stringify(e)).join('\n') + '\n');
    const out = decide({ ...payload(main, 'toolu_5'), agent_id: 'def456' }, { data: null, evidenceRoot: evidence(dir, 0.05, 5) });
    assert.match(out.reason, /Agent call 5/);
});

test('a Task call is gated like an Agent call', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const out = decide({ ...payload(transcript(dir, five), 'toolu_5'), tool_name: 'Task' }, { data: null, evidenceRoot: evidence(dir, 0.05, 5) });
    assert.match(out.reason, /Agent call 5/);
});

test('an unreadable transcript fails open: nothing is asked', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const file = transcript(dir, five);
    // A file that is there and cannot be opened (locked, no permission): the
    // reader answers null for it, where a missing file answers [].
    const open = fs.openSync;
    fs.openSync = (p, ...rest) => {
        if (p === file) throw Object.assign(new Error('locked'), { code: 'EACCES' });
        return open(p, ...rest);
    };
    try {
        assert.equal(decide(payload(file, 'toolu_5'), { data: null, evidenceRoot: evidence(dir, 0.05, 5) }), null);
    } finally {
        fs.openSync = open;
    }
});

test('as a hook, a transcript that is not there prints nothing and exits 0', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload(path.join(dir, 'missing.jsonl'), 'toolu_5')), encoding: 'utf8',
        env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
});

test('opts.limit moves the line: with 6 the sixth call is quiet and the seventh names dispatch.inflight (6)', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const seven = [1, 2, 3, 4, 5, 6, 7].map((i) => agentLine(i));
    const file = transcript(dir, seven);
    const opts = { data: null, evidenceRoot: path.join(dir, 'none'), limit: 6 };
    assert.equal(decide(payload(file, 'toolu_6'), opts), null);
    assert.match(decide(payload(file, 'toolu_7'), opts).reason, /dispatch\.inflight \(6\)/);
});

test('as a hook, the limit is the project profile dispatch.inflight; a bad value falls back to 8', () => {
    const run = (value, count, id) => {
        const dir = tmp('fankeel-dispatch-gate-');
        fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
        fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'dispatch.inflight': value }));
        const entries = Array.from({ length: count }, (_, i) => agentLine(i + 1));
        const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload(transcript(dir, entries), 'toolu_' + id)), encoding: 'utf8',
            env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
        assert.equal(r.status, 0);
        return r.stdout;
    };
    assert.equal(run('6', 6, 6), '');
    assert.match(run('6', 7, 7), /dispatch\.inflight \(6\)/);
    assert.equal(run(6, 6, 6), '');
    assert.match(run(6, 7, 7), /dispatch\.inflight \(6\)/);
    assert.equal(run('x', 8, 8), '');
    assert.match(run('x', 9, 9), /dispatch\.inflight \(8\)/);
});

test('with dispatch.inflight unlimited no call is asked, however many are in the response', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'dispatch.inflight': 'unlimited' }));
    const entries = Array.from({ length: 25 }, (_, i) => agentLine(i + 1));
    const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload(transcript(dir, entries), 'toolu_25')), encoding: 'utf8',
        env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    assert.equal(decideAt(payload(transcript(dir, entries), 'toolu_25'), { data: null, evidenceRoot: path.join(dir, 'none'), limit: Infinity }), null);
});

test('with neither spend nor a bench report the reason says there is no figure', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const out = decide(payload(transcript(dir, five), 'toolu_5'), { data: null, evidenceRoot: path.join(dir, 'none') });
    assert.match(out.reason, /No figure: no stage has recorded spend and no bench ran reader/);
});

test('with no limit given the line is dispatch.inflight 8: the eighth call is quiet, the ninth is asked', () => {
    const dir = tmp('fankeel-dispatch-gate-');
    const nine = Array.from({ length: 9 }, (_, i) => agentLine(i + 1));
    const file = transcript(dir, nine);
    const opts = { data: null, evidenceRoot: path.join(dir, 'none') };
    assert.equal(decideAt(payload(file, 'toolu_8'), opts), null);
    assert.match(decideAt(payload(file, 'toolu_9'), opts).reason, /Agent call 9 in one response, past dispatch\.inflight \(8\)/);
});
