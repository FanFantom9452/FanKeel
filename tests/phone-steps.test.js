'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const phone = require('../lib/phone.js');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'budget.js');
const SID = 'cccccccc-2222-4222-8222-000000000001';

function project(withEntry) {
    const root = tmp('fankeel-phone-steps-');
    registry.ensureLayout(root);
    if (withEntry) registry.writeSession(root, SID, { task: 't', stage: 'build', active: true, claims: [], started: '2026-10-22T00:00:00.000Z', updated: new Date().toISOString() });
    return root;
}
const fire = (root, payload) => execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(Object.assign({ session_id: SID, cwd: root }, payload)), encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
});
const pre = (root, tool, input, id) => fire(root, { hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input, tool_use_id: id });
const post = (root, tool, response, id) => fire(root, { hook_event_name: 'PostToolUse', tool_name: tool, tool_input: {}, tool_response: response, tool_use_id: id });

test('each main-thread tool call is a step, closed by its tool-end', () => {
    const root = project(true);
    pre(root, 'Bash', { command: 'npm test', description: 'Run the tests' }, 't1');
    post(root, 'Bash', { stdout: 'ok' }, 't1');
    pre(root, 'Read', { file_path: path.join(root, 'lib', 'a.js') }, 't2');
    post(root, 'Read', { is_error: true }, 't2');
    pre(root, 'Agent', { description: 'Plan it', run_in_background: true }, 't3');
    pre(root, 'mcp__Claude_Browser__navigate', { url: 'x' }, 't4');
    pre(root, 'AskUserQuestion', { questions: [] }, 't5');
    const lines = phone.chat(root, SID, 0).map((x) => [x.role, x.id, x.label, x.ok, x.background]);
    assert.deepEqual(lines, [
        ['tool', 't1', 'Run the tests', undefined, undefined],
        ['tool-end', 't1', undefined, true, undefined],
        ['tool', 't2', 'lib/a.js', undefined, undefined],
        ['tool-end', 't2', undefined, false, undefined],
        ['tool', 't3', 'Plan it', undefined, true],
        ['tool', 't4', 'Claude_Browser · navigate', undefined, undefined],
    ]);
});

test('a session with no entry, and a subagent\'s call, write no step', () => {
    const none = project(false);
    pre(none, 'Bash', { command: 'ls' }, 't1');
    assert.equal(fs.existsSync(path.join(phone.dirOf(none, SID), 'chat.jsonl')), false);
    const root = project(true);
    fire(root, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' }, tool_use_id: 't9', agent_id: 'a1' });
    assert.deepEqual(phone.chat(root, SID, 0), []);
});
