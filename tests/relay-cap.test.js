'use strict';

// spend-6: a message to another session or agent sits in the receiver's
// context for the rest of its session. hooks/relay-cap.js refuses one past
// RELAY_CAP characters and asks for a file path instead.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks', 'relay-cap.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-0000000000d4';

function project(active) {
  const root = tmp('fankeel-relay-cap-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
    task: 't', claims: [], stage: 'build', active, started: '2026-10-20T00:00:00.000Z', updated: new Date().toISOString(),
  }));
  return root;
}

function send(root, toolName, input) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: SESSION, cwd: root, hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: input }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
  });
}

test('a SendMessage over 2000 characters is denied with its length and a path asked for', () => {
  const out = JSON.parse(send(project(true), 'SendMessage', { to: 'brain', message: 'x'.repeat(2001) }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /^fankeel: this message is 2001 characters/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /send its path/);
});

test('the body is measured whatever the field is called, one level deep', () => {
  const out = JSON.parse(send(project(true), 'mcp__ccd_session_mgmt__send_message', { target: { sessionId: 's' }, payload: { text: 'y'.repeat(2500) } }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
});

test('2000 characters, and a session with no active task, pass', () => {
  assert.equal(send(project(true), 'SendMessage', { to: 'brain', message: 'x'.repeat(2000) }), '');
  assert.equal(send(project(false), 'SendMessage', { to: 'brain', message: 'x'.repeat(5000) }), '');
});

test('the manifest runs relay-cap.js on PreToolUse for both send tools', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const group = manifest.hooks.PreToolUse.find((g) => g.hooks.some((h) => h.command.includes('hooks/relay-cap.js')));
  assert.ok(group, 'relay-cap.js is not registered on PreToolUse');
  assert.equal(group.matcher, 'SendMessage|mcp__ccd_session_mgmt__send_message');
});
