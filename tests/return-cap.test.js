'use strict';

// spend-6: what a subagent returns stays in the parent's context for the rest
// of the session. hooks/agent-end.js refuses a return past RETURN_CAP once.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { RETURN_CAP, RETURN_RULES } = require('../lib/render.js');
const { readEnds } = require('../lib/agentends.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'agent-end.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-0000000000c3';

function project(active) {
  const root = tmp('fankeel-return-cap-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
    task: 't', claims: [], stage: 'build', active, started: '2026-10-20T00:00:00.000Z', updated: new Date().toISOString(),
  }));
  return root;
}

function stop(root, over) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(Object.assign({ session_id: SESSION, cwd: root, hook_event_name: 'SubagentStop',
      agent_id: 'a1', agent_type: 'fankeel:fankeel-reader', stop_hook_active: false }, over)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
  });
}

test('the cap is 3000 characters and the first return rule names it', () => {
  assert.equal(RETURN_CAP, 3000);
  assert.ok(RETURN_RULES[0].includes('under 3000 characters'), RETURN_RULES[0]);
});

test('a return over the cap is refused with its length, and no stop is recorded', () => {
  const root = project(true);
  const out = JSON.parse(stop(root, { last_assistant_message: 'x'.repeat(RETURN_CAP + 1) }));
  assert.equal(out.decision, 'block');
  assert.match(out.reason, new RegExp('is ' + (RETURN_CAP + 1) + ' characters'));
  assert.deepEqual(Object.keys(readEnds(root, SESSION)), []);
});

test('a return at the cap, a second stop, the judge and a missing message all pass', () => {
  const root = project(true);
  assert.equal(stop(root, { last_assistant_message: 'x'.repeat(RETURN_CAP) }), '');
  assert.equal(stop(root, { last_assistant_message: 'x'.repeat(RETURN_CAP + 1), stop_hook_active: true }), '');
  assert.equal(stop(root, { last_assistant_message: 'x'.repeat(RETURN_CAP + 1), agent_type: 'fankeel:fankeel-judge' }), '');
  assert.equal(stop(root, {}), '');
  assert.deepEqual(Object.keys(readEnds(root, SESSION)), ['a1']);
});

test('a session with no active task is never refused', () => {
  const root = project(false);
  assert.equal(stop(root, { last_assistant_message: 'x'.repeat(RETURN_CAP + 1) }), '');
});
