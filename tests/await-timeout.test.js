'use strict';

// docs/90-agent/todo/await-11.md: an old await that times out after its agent
// already reported says stale and writes no failure handoff; a stuck agent
// (its mark still standing) still times out with one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const awaitCli = require('../scripts/await.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SID = 'aaaaaaaa-0000-4000-8000-000000000015';

function at(file, ms) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'x\n');
    fs.utimesSync(file, ms / 1000, ms / 1000);
}

// A build group-2 brain, alive (its transcript moved just now), with its mark.
function fixture() {
    const root = tmp('fankeel-await-timeout-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify({
        active: true, stage: 'build', started: '2026-09-23T10:00:00.000Z', moves: [['build', 1]],
        inflight: { stage: 'build', at: 1, agentId: 'a2', group: 2 },
    }));
    const config = tmp('fankeel-await-timeout-config-');
    at(path.join(config, 'projects', 'F--x', SID + '.jsonl'), Date.now());
    at(path.join(config, 'projects', 'F--x', SID, 'subagents', 'agent-a2.jsonl'), Date.now());
    const task = path.join(root, '.fankeel', 'build', 'task-20260923T100000').replace(/\\/g, '/');
    return { root, task, env: { CLAUDE_CONFIG_DIR: config } };
}

test('a timeout after the agent\'s mark was cleared is stale and writes no failure handoff', async () => {
    const f = fixture();
    const pending = awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
    // The await that read build-g2.md cleared the mark while this one still waited.
    registry.clearInflight(f.root, SID, 'a2');
    const out = await pending;
    assert.equal(out.text, 'stale a2 — that agent already reported: nothing to do, end the turn without a reply.');
    assert.equal(fs.existsSync(f.task + '/build-g2-failed.md'), false, 'no failure handoff for an agent that came back');
});

test('a timeout while the agent\'s mark still stands is a timeout with a failure handoff', async () => {
    const f = fixture();
    const out = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
    assert.match(out.text, /^group 2, agent a2: timeout — /);
    assert.ok(out.text.endsWith(' Failure handoff: ' + f.task + '/build-g2-failed.md.'), out.text);
    assert.match(fs.readFileSync(f.task + '/build-g2-failed.md', 'utf8'), /^mode: timeout$/m);
});
