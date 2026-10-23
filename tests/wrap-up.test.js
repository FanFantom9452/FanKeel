'use strict';

// station-48: the desktop app's next-step box (mcp__ccd_turn__wrap_up with
// ask/actions) puts a decision to the user that the station gate never sees.
// hooks/wrap-up.js refuses such a call while a fankeel task is active and
// points at AskUserQuestion; a recap alone passes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks', 'wrap-up.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-0000000000e5';
const TOOL = 'mcp__ccd_turn__wrap_up';

function project(active) {
  const root = tmp('fankeel-wrap-up-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
    task: 't', claims: [], stage: 'design', active, started: '2026-10-23T00:00:00.000Z', updated: new Date().toISOString(),
  }));
  return root;
}

function call(root, input) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: SESSION, cwd: root, hook_event_name: 'PreToolUse', tool_name: TOOL, tool_input: input }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
  });
}

test('a wrap_up carrying an ask is denied, and the reason names AskUserQuestion', () => {
  const out = JSON.parse(call(project(true), { recap: 'done', ask: 'Which fix first?', actions: [{ label: 'Fix 1' }] }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /^fankeel: the next-step box/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /AskUserQuestion/);
});

test('buttons without an ask are a decision too', () => {
  const out = JSON.parse(call(project(true), { recap: 'done', actions: [{ action: 'commit' }] }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
});

test('a recap alone, an empty ask, and an empty actions list pass', () => {
  assert.equal(call(project(true), { recap: 'done, nothing pending' }), '');
  assert.equal(call(project(true), { recap: 'done', ask: '   ', actions: [] }), '');
});

test('a session with no active task is left alone', () => {
  assert.equal(call(project(false), { recap: 'done', ask: 'Which fix first?', actions: [{ label: 'Fix 1' }] }), '');
});

test('the manifest runs wrap-up.js on PreToolUse for mcp__ccd_turn__wrap_up', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const group = manifest.hooks.PreToolUse.find((g) => g.hooks.some((h) => h.command.includes('hooks/wrap-up.js')));
  assert.ok(group, 'wrap-up.js is not registered on PreToolUse');
  assert.equal(group.matcher, 'mcp__ccd_turn__wrap_up');
});
