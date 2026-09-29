'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');
const { relayPath } = require('../lib/handoff.js');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks', 'budget.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const AGENT = 'agent0001';

const ago = (ms) => new Date(Date.now() - ms).toISOString();

function seed(root, sessionId, over) {
    const dir = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(dir, { recursive: true });
    const data = Object.assign({ task: 'x', stage: 'build', active: true, started: ago(3600e3), updated: ago(60e3) }, over);
    fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
    return data;
}

function transcript(root, tokens) {
    const file = path.join(root, 'transcript.jsonl');
    fs.writeFileSync(file, JSON.stringify({ message: { usage: {
        input_tokens: tokens, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    } } }) + '\n');
    return file;
}

// Seeds both the parent transcript (`root/transcript.jsonl`) and, when
// `subagentTokens` is given, the subagent's own file under
// `root/transcript/subagents/agent-<AGENT>.jsonl` — the layout `sessionDirOf`
// expects (it strips `.jsonl` off the transcript path to get the session dir).
// Parent and subagent token counts are independent so a test can put the
// overage on either file.
function withSubagent(root, parentTokens, subagentTokens) {
    const t = transcript(root, parentTokens);
    if (subagentTokens !== undefined) {
        const dir = path.join(root, 'transcript', 'subagents');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'agent-' + AGENT + '.jsonl'), JSON.stringify({ message: { usage: {
            input_tokens: subagentTokens, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
        } } }) + '\n');
    }
    return t;
}

function run(payload) {
    return execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
    });
}

test('no agent_id: nothing, regardless of context size', () => {
    const root = tmp('fankeel-budget-');
    seed(root, MINE);
    const t = transcript(root, 460000);
    const out = run({ session_id: MINE, cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Read', transcript_path: t });
    assert.equal(out, '');
});

test('310k on PostToolUse: nudged to write the relay and report it', () => {
    const root = tmp('fankeel-budget-');
    seed(root, MINE);
    const t = withSubagent(root, 1000, 310000);
    const out = run({ session_id: MINE, cwd: root, agent_id: AGENT, hook_event_name: 'PostToolUse', tool_name: 'Read', transcript_path: t });
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(ctx, /300000/);
    assert.match(ctx, new RegExp('relay-' + AGENT + '\\.md'));
});

test('under SOFT on PostToolUse: nothing', () => {
    const root = tmp('fankeel-budget-');
    seed(root, MINE);
    const t = withSubagent(root, 1000, 50000);
    const out = run({ session_id: MINE, cwd: root, agent_id: AGENT, hook_event_name: 'PostToolUse', tool_name: 'Read', transcript_path: t });
    assert.equal(out, '');
});

test('460k on PreToolUse: a Read is denied, the reason names the relay path', () => {
    const root = tmp('fankeel-budget-');
    seed(root, MINE);
    const t = withSubagent(root, 1000, 460000);
    const out = run({ session_id: MINE, cwd: root, agent_id: AGENT, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'lib/x.js' }, transcript_path: t });
    const o = JSON.parse(out).hookSpecificOutput;
    assert.equal(o.permissionDecision, 'deny');
    assert.match(o.permissionDecisionReason, /450000/);
    assert.match(o.permissionDecisionReason, new RegExp('relay-' + AGENT + '\\.md'));
});

test('460k on PreToolUse: a Write under .fankeel/build/ is let through', () => {
    const root = tmp('fankeel-budget-');
    const data = seed(root, MINE);
    const t = withSubagent(root, 1000, 460000);
    const relay = relayPath(root, data, AGENT);
    const out = run({ session_id: MINE, cwd: root, agent_id: AGENT, hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: relay }, transcript_path: t });
    assert.equal(out, '');
});

test('460k in a workflow agent\'s transcript, present only under subagents/workflows/: a Read is denied', () => {
    const root = tmp('fankeel-budget-');
    seed(root, MINE);
    const t = transcript(root, 1000);
    const dir = path.join(root, 'transcript', 'subagents', 'workflows', 'wf_x');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'agent-a0b1c2.jsonl'), JSON.stringify({ message: { usage: {
        input_tokens: 460000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    } } }) + '\n');
    const out = run({ session_id: MINE, cwd: root, agent_id: 'a0b1c2', hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'lib/x.js' }, transcript_path: t });
    const o = JSON.parse(out).hookSpecificOutput;
    assert.equal(o.permissionDecision, 'deny');
    assert.match(o.permissionDecisionReason, /relay-a0b1c2\.md/);
});

test('parent at 460k, subagent at 50k: PreToolUse and PostToolUse both print nothing', () => {
    const root = tmp('fankeel-budget-');
    seed(root, MINE);
    const t = withSubagent(root, 460000, 50000);
    const pre = run({ session_id: MINE, cwd: root, agent_id: AGENT, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'lib/x.js' }, transcript_path: t });
    assert.equal(pre, '');
    const post = run({ session_id: MINE, cwd: root, agent_id: AGENT, hook_event_name: 'PostToolUse', tool_name: 'Read', transcript_path: t });
    assert.equal(post, '');
});

test('parent at 460k, no subagent file written: nothing', () => {
    const root = tmp('fankeel-budget-');
    seed(root, MINE);
    const t = transcript(root, 460000);
    const out = run({ session_id: MINE, cwd: root, agent_id: AGENT, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'lib/x.js' }, transcript_path: t });
    assert.equal(out, '');
});
