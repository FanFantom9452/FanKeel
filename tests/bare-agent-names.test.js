'use strict';

// station-6: a generated override is dispatched by its bare name, so the hooks
// that key on agent type must keep answering to it. Both strip `fankeel:`
// today; these pin that the bare spelling is read the same way.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mkTmp = require('./tmp.js');

const GUARD = path.join(__dirname, '..', 'hooks', 'guard.js');
const BRIEF = path.join(__dirname, '..', 'hooks', 'brief.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';

function seed(root, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, SESSION + '.json'), JSON.stringify(Object.assign({
    task: 'pin the bare names',
    stage: 'survey',
    active: true,
    started: '2026-09-29T09:30:12.345Z',
    updated: new Date().toISOString(),
  }, over), null, 2) + '\n');
}

function run(hook, root, payload) {
  return execFileSync(process.execPath, [hook], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-bare-cfg-') }),
  });
}

test('a bare fankeel-reader is still read-only: a shell redirect is denied', () => {
  const root = mkTmp('fankeel-bare-');
  seed(root);
  const out = run(GUARD, root, { session_id: SESSION, cwd: root, agent_id: 'r1', agent_type: 'fankeel-reader',
    tool_name: 'Bash', tool_input: { command: 'echo x > out.txt' } });
  assert.equal(JSON.parse(out).hookSpecificOutput.permissionDecision, 'deny');
});

test('a bare fankeel-brain still gets the brain brief', () => {
  const root = mkTmp('fankeel-bare-');
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['survey'] }) + '\n');
  seed(root);
  const out = run(BRIEF, root, { session_id: SESSION, cwd: root, hook_event_name: 'SubagentStart', agent_id: 'b1', agent_type: 'fankeel-brain' });
  const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
  assert.ok(ctx.includes('(agent type: fankeel-brain)'));
  // The ordinary brief ends with the same tag; this line is the brain brief's alone.
  assert.ok(ctx.includes('Read it, rewrite the report and its gate'));
});
