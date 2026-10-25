'use strict';
// await-14: the 10-20 incidents (84774b47 turns 28-47, b7a7d8d4 turn 27)
// were waiters for group brains that had already reported, timing out while a
// later brain — the build close — still held its own mark. abb16b4e fixed it a
// few hours later; this pins the shape the incidents had: two marks, the
// waiter named by --agent, only its own mark cleared.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const awaitCli = require('../scripts/await.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SID = 'aaaaaaaa-0000-4000-8000-000000000016';

function at(file, ms) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'x\n');
    fs.utimesSync(file, ms / 1000, ms / 1000);
}

// A group-2 brain and the build-close brain after it, both alive, both marked.
function fixture() {
    const root = tmp('fankeel-await-stale-group-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify({
        active: true, stage: 'build', started: '2026-09-23T10:00:00.000Z', moves: [['build', 1]],
        inflight: [{ stage: 'build', at: 1, agentId: 'a2', group: 2 }, { stage: 'build', at: 2, agentId: 'a9', group: 5, kind: 'close' }],
    }));
    const config = tmp('fankeel-await-stale-group-config-');
    at(path.join(config, 'projects', 'F--x', SID + '.jsonl'), Date.now());
    at(path.join(config, 'projects', 'F--x', SID, 'subagents', 'agent-a2.jsonl'), Date.now());
    at(path.join(config, 'projects', 'F--x', SID, 'subagents', 'agent-a9.jsonl'), Date.now());
    const task = path.join(root, '.fankeel', 'build', 'task-20260923T100000').replace(/\\/g, '/');
    return { root, task, env: { CLAUDE_CONFIG_DIR: config } };
}

test('a group brain that reported while the close brain runs times out stale, and the close mark stays', async () => {
    const f = fixture();
    const pending = awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'a2', '--timeout', '0.5'], f.env);
    registry.clearInflight(f.root, SID, 'a2');
    const out = await pending;
    assert.equal(out.text, 'stale a2 — that agent already reported: nothing to do, end the turn without a reply.');
    assert.equal(fs.existsSync(f.task + '/build-g2-failed.md'), false, 'no failure handoff for an agent that came back');
    assert.deepEqual(registry.inflights(registry.readSession(f.root, SID)).map((m) => m.agentId), ['a9']);
});

test('the same waiter with its own mark still standing times out with a failure handoff', async () => {
    const f = fixture();
    const out = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'a2', '--timeout', '0.5'], f.env);
    assert.match(out.text, /^group 2, agent a2: timeout — /);
    assert.ok(out.text.endsWith(' Failure handoff: ' + f.task + '/build-g2-failed.md.'), out.text);
});
