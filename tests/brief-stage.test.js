'use strict';

// await-7: on 2026-10-02/03 a build brain that had already handed back its
// report woke about 32 minutes later, after the task had moved to audit, and
// hooks/brief.js marked it as audit's agent: the controller's block then sent
// the user's answer to a build agent. A brain whose own prompt names another
// stage is neither marked nor briefed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const mkTmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'brief.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';

function project(over) {
  const root = mkTmp('fankeel-brief-stage-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build', 'audit'] }));
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify(Object.assign({
    task: 't', claims: [], stage: 'audit', active: true,
    started: '2026-09-19T09:30:12.345Z', updated: new Date().toISOString(),
  }, over)));
  return root;
}

// Line 1 of the agent's own transcript is its dispatch prompt.
function prompt(root, id, text) {
  const sub = path.join(root, 'sess', 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'agent-' + id + '.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: text } }) + '\n');
}

function start(root, id) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: SESSION, cwd: root, hook_event_name: 'SubagentStart', agent_id: id,
      agent_type: 'fankeel:fankeel-brain', transcript_path: path.join(root, 'sess.jsonl') }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-cfg-') }),
  });
}

const inflight = (root) => registry.readSession(root, SESSION).inflight;

test('a build brain waking at audit is neither marked nor briefed, and audit\'s own mark stands', () => {
  const AUDIT = { stage: 'audit', at: 1, agentId: 'au1', group: 1 };
  const root = project({ inflight: AUDIT });
  prompt(root, 'b2', 'build close');
  assert.equal(start(root, 'b2'), '', 'no brief for a brain from an earlier stage');
  assert.deepEqual(inflight(root), AUDIT);
});

test('with no mark standing, a late build brain at audit leaves none behind', () => {
  const root = project();
  prompt(root, 'b2', 'build group 2: tasks 3, 4.');
  assert.equal(start(root, 'b2'), '');
  assert.equal(inflight(root), undefined);
});

test('the control: audit\'s own brain, its prompt read or not, is marked and briefed', () => {
  const root = project();
  prompt(root, 'au1', 'audit');
  assert.notEqual(start(root, 'au1'), '');
  assert.equal(inflight(root).agentId, 'au1');
  assert.notEqual(start(root, 'au2'), '', 'a fresh dispatch, its transcript not written yet');
  assert.deepEqual(registry.inflights(registry.readSession(root, SESSION)).map((m) => m.agentId), ['au1', 'au2']);
});
