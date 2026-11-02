'use strict';

// await-18: a hook matching Bash also runs on a Monitor's shell command since
// Claude Code 2.1.314 (it can block or ask, not approve). hooks/guard.js reads
// Monitor as a shell call for its two refusals.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'guard.js');
const SID = 'aaaaaaaa-0000-4000-8000-000000000018';

function project() {
    const root = tmp('fankeel-guard-monitor-');
    const now = new Date().toISOString();
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify({ task: 'x', claims: [], stage: 'build', active: true, started: now, updated: now }));
    fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey,build,verify' }));
    return root;
}

function run(root, payload) {
    return execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-guard-monitor-config-') }),
    });
}

const monitor = (root, command, extra) => Object.assign({
    session_id: SID, cwd: root, tool_name: 'Monitor',
    tool_input: { command, description: 'watch', timeout_ms: 60000 },
}, extra);
const decisionOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecision;
const reasonOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecisionReason;

test('a Monitor command that writes is denied for the controller while its stage is controlled', () => {
    const root = project();
    const out = run(root, monitor(root, 'sed -i s/a/b/ x.js'));
    assert.equal(decisionOf(out), 'deny');
    assert.match(reasonOf(out), /build is a controlled stage — this command writes to disk/);
});

test('a Monitor command that only reads, or runs await.js, is let through', () => {
    const root = project();
    for (const command of ['tail -f build.log', 'node scripts/await.js --session x', 'until [ -f done.md ]; do sleep 5; done; echo done']) {
        assert.equal(run(root, monitor(root, command)), '', command);
    }
});

test('a Monitor command that writes is denied for a read-only agent', () => {
    const root = project();
    const out = run(root, monitor(root, 'echo hi > x.txt', { agent_id: 'ag1', agent_type: 'fankeel-reader' }));
    assert.equal(decisionOf(out), 'deny');
    assert.match(reasonOf(out), /read-only agent_type fankeel-reader/);
});

test('a Monitor command that writes is let through for a subagent that is not read-only', () => {
    const root = project();
    assert.equal(run(root, monitor(root, 'echo hi > x.txt', { agent_id: 'ag1', agent_type: 'fankeel-implementer' })), '');
});
