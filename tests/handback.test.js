'use strict';

// brain-1: on 2026-10-19 a verify stage agent handed back while the adversary
// and the render review it had dispatched were still out. hooks/budget.js now
// refuses a subagent's SubagentHandback while an agent it dispatched has not
// stopped. Run as a process, the way Claude Code runs it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');
const { markEnded } = require('../lib/agentends.js');
const { outstanding, heldReason } = require('../lib/children.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'budget.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const BRAIN = 'abrain0001';
const ago = (ms) => new Date(Date.now() - ms).toISOString();

function project() {
    const root = tmp('fankeel-handback-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify({
        task: 'x', stage: 'verify', active: true, started: ago(3600e3), updated: ago(60e3),
    }));
    fs.mkdirSync(path.join(root, '.fankeel', 'build', 'spawn'), { recursive: true });
    return root;
}

function spawned(root, child, parent, ageMs) {
    fs.writeFileSync(path.join(root, '.fankeel', 'build', 'spawn', child + '.json'), JSON.stringify({
        prompt: 'p', subagentType: 'fankeel:fankeel-reviewer', parentAgentId: parent, at: ago(ageMs || 0),
    }));
}

function call(root, tool) {
    return execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify({
            session_id: MINE, cwd: root, agent_id: BRAIN, hook_event_name: 'PreToolUse',
            tool_name: tool || 'SubagentHandback', tool_input: { message: 'path' },
            transcript_path: path.join(root, 'transcript.jsonl'),
        }),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
    });
}

test('a hand-back while a dispatched agent has not stopped is refused, naming it', () => {
    const root = project();
    spawned(root, 'c1', BRAIN);
    const out = JSON.parse(call(root));
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /`c1` \(fankeel:fankeel-reviewer\)/);
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /single word `waiting`/);
});

test('once that agent stopped, the hand-back goes through', () => {
    const root = project();
    spawned(root, 'c1', BRAIN);
    markEnded(root, MINE, 'c1', Date.now());
    assert.equal(call(root), '');
});

test('an agent silent for longer than eleven minutes is taken as gone', () => {
    const root = project();
    spawned(root, 'c2', BRAIN, 20 * 60e3);
    const file = path.join(root, 'transcript', 'subagents', 'agent-c2.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{}\n');
    const old = (Date.now() - 20 * 60e3) / 1000;
    fs.utimesSync(file, old, old);
    assert.equal(call(root), '');
});

test('another agent\'s child, another tool, or no spawn records: nothing is refused', () => {
    const root = project();
    spawned(root, 'c3', 'someoneelse');
    assert.equal(call(root), '');
    spawned(root, 'c4', BRAIN);
    assert.equal(call(root, 'Bash'), '');
    const bare = project();
    fs.rmSync(path.join(bare, '.fankeel', 'build', 'spawn'), { recursive: true, force: true });
    assert.equal(call(bare), '');
});

test('outstanding lists the children with their type, and heldReason counts them', () => {
    const root = project();
    spawned(root, 'c5', BRAIN);
    spawned(root, 'c6', BRAIN);
    const list = outstanding(root, MINE, BRAIN, path.join(root, 'transcript.jsonl'));
    assert.deepEqual(list.map((c) => c.agentId).sort(), ['c5', 'c6']);
    assert.equal(list[0].subagentType, 'fankeel:fankeel-reviewer');
    assert.match(heldReason(list), /^fankeel: not yet — 2 agents you dispatched have not returned: /);
    assert.deepEqual(outstanding(root, MINE, '../x', null), []);
});
