'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseLog } = require('../docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/hook.js');

test('parseLog finds each nonce by its prefix, and the subagent-side transcript_path', () => {
    const lines = [
        JSON.stringify({ event: 'SubagentStart', tool: null, agent_id: 'a1', transcript_path: '/x/agent-a1.jsonl', emitted: 'PROBE-SUBAGENTSTART-lifetime-2026-09-28' }),
        JSON.stringify({ event: 'PreToolUse', tool: 'Glob', agent_id: 'a1', transcript_path: '/x/agent-a1.jsonl', emitted: 'PROBE-PRETOOLUSE-DENY-lifetime-2026-09-28' }),
        JSON.stringify({ event: 'PostToolUse', tool: 'Read', agent_id: 'a1', transcript_path: '/x/agent-a1.jsonl', emitted: 'PROBE-POSTTOOLUSE-lifetime-2026-09-28' }),
        JSON.stringify({ event: 'PostToolUse', tool: 'Bash', agent_id: null, transcript_path: '/x/main.jsonl', emitted: null }),
    ].join('\n');
    const r = parseLog(lines);
    assert.equal(r.subagentStartEmitted, true);
    assert.equal(r.postToolUseEmitted, true);
    assert.equal(r.preToolUseDenyEmitted, true);
    assert.deepEqual(r.subagentTranscriptPaths, ['/x/agent-a1.jsonl']);
});

test('parseLog reports false for a nonce that never fired, and no subagent transcript', () => {
    const lines = [JSON.stringify({ event: 'PostToolUse', tool: 'Bash', agent_id: null, transcript_path: '/x/main.jsonl', emitted: null })].join('\n');
    const r = parseLog(lines);
    assert.equal(r.subagentStartEmitted, false);
    assert.equal(r.postToolUseEmitted, false);
    assert.equal(r.preToolUseDenyEmitted, false);
    assert.deepEqual(r.subagentTranscriptPaths, []);
});

test('parseLog does not throw on a blank log', () => {
    const r = parseLog('');
    assert.deepEqual(r.rows, []);
});
