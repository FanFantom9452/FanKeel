'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const mkTmp = require('./tmp.js');
const HOOK = path.join(__dirname, '..', 'hooks', 'size.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000002';

const tmp = () => mkTmp('fankeel-size-');

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'read the log', stage: 'build', active: true,
    started: new Date(Date.now() - 3600e3).toISOString(),
    updated: new Date().toISOString(),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

function run(root, cfg, payload) {
  const env = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: cfg });
  return execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), env, encoding: 'utf8' });
}

test('a tool result over 20,000 chars speaks once', () => {
  const root = tmp();
  const cfg = path.join(root, 'cfg');
  seed(root, MINE);
  const payload = { session_id: MINE, cwd: root, tool_name: 'Bash', tool_response: 'x'.repeat(30000) };
  const parsed = JSON.parse(run(root, cfg, payload));
  assert.match(parsed.hookSpecificOutput.additionalContext, /Bash returned 30000 chars into this context/);
});

test('1,000 chars says nothing', () => {
  const root = tmp();
  const cfg = path.join(root, 'cfg');
  seed(root, MINE);
  const payload = { session_id: MINE, cwd: root, tool_name: 'Bash', tool_response: 'x'.repeat(1000) };
  assert.equal(run(root, cfg, payload), '');
});

test('a second large result in the same prompt says nothing more', () => {
  const root = tmp();
  const cfg = path.join(root, 'cfg');
  seed(root, MINE);
  const payload = { session_id: MINE, cwd: root, tool_name: 'Bash', tool_response: 'x'.repeat(30000) };
  run(root, cfg, payload);
  assert.equal(run(root, cfg, payload), '', 'the marker is keyed to `updated`, which has not moved');
});

test('a large result inside a subagent says nothing', () => {
  const root = tmp();
  const cfg = path.join(root, 'cfg');
  seed(root, MINE);
  const payload = { session_id: MINE, cwd: root, tool_name: 'Bash', tool_response: 'x'.repeat(30000), agent_id: 'sub-1' };
  assert.equal(run(root, cfg, payload), '');
});
