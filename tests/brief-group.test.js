'use strict';

// build-4: on 2026-10-02 the brain sent for build group 2 was briefed to write
// build-g1.md, and later ones were marked group 3 while they ran groups 4 and 6:
// the brain's own transcript is not on disk when hooks/brief.js runs, so the
// mark was numbered by counting the marks still standing, and await had
// cleared group 1's. hooks/guard.js now notes the case off the controller's
// Agent call, and the brief takes it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const mkTmp = require('./tmp.js');

const BRIEF = path.join(__dirname, '..', 'hooks', 'brief.js');
const GUARD = path.join(__dirname, '..', 'hooks', 'guard.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';

function project() {
  const root = mkTmp('fankeel-brief-group-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
    task: 't', claims: [], stage: 'build', active: true,
    started: '2026-09-19T09:30:12.345Z', updated: new Date().toISOString(),
  }));
  return root;
}

function hook(file, root, payload) {
  return execFileSync(process.execPath, [file], {
    input: JSON.stringify(Object.assign({ session_id: SESSION, cwd: root }, payload)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-cfg-') }),
  });
}

const dispatch = (root, prompt) => hook(GUARD, root, { hook_event_name: 'PreToolUse', tool_name: 'Agent',
  tool_input: { subagent_type: 'fankeel:fankeel-brain', description: 'build', prompt } });
// No agent file under <root>/sess/subagents: a fresh brain, its prompt not readable yet.
const start = (root, id) => JSON.parse(hook(BRIEF, root, { hook_event_name: 'SubagentStart', agent_id: id,
  agent_type: 'fankeel:fankeel-brain', transcript_path: path.join(root, 'sess.jsonl') })).hookSpecificOutput.additionalContext;
const marks = (root) => registry.inflights(registry.readSession(root, SESSION));

test('eight groups sent one after another are each briefed and marked with their own number', () => {
  const root = project();
  for (let n = 1; n <= 8; n++) {
    assert.equal(dispatch(root, 'build group ' + n + ': tasks ' + n + '.'), '', 'the dispatch goes ahead');
    const brief = start(root, 'g' + n);
    assert.match(brief, new RegExp('build-g' + n + '\\.md instead of'), 'group ' + n);
    const mark = marks(root).find((m) => m.agentId === 'g' + n);
    assert.deepEqual([mark.group, mark.kind], [n, 'group']);
    registry.clearInflight(root, SESSION, 'g' + n); // scripts/await.js, once the group's handoff lands
  }
  assert.equal(registry.readSession(root, SESSION).dispatching, undefined, 'every note was taken');
});

test('groups sent together take their numbers in order, and close is close', () => {
  const root = project();
  dispatch(root, 'build group 4');
  dispatch(root, 'build group 6');
  start(root, 'a');
  start(root, 'b');
  assert.deepEqual(marks(root).map((m) => [m.agentId, m.group, m.kind]), [['a', 4, 'group'], ['b', 6, 'group']]);
  dispatch(root, 'build close');
  start(root, 'c');
  assert.equal(marks(root).find((m) => m.agentId === 'c').kind, 'close');
});

test('a brain whose prompt can be read takes its own note, not the oldest', () => {
  const root = project();
  dispatch(root, 'build group 2');
  dispatch(root, 'build group 5');
  const sub = path.join(root, 'sess', 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'agent-r5.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: 'build group 5' } }) + '\n');
  start(root, 'r5');
  start(root, 'f2');
  assert.deepEqual(marks(root).map((m) => [m.agentId, m.group]), [['r5', 5], ['f2', 2]]);
});

test('a brain whose readable prompt names no case takes no note', () => {
  const root = project();
  dispatch(root, 'build group 2');
  const sub = path.join(root, 'sess', 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'agent-rs.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: 'build resume' } }) + '\n');
  start(root, 'rs');
  assert.deepEqual(marks(root).map((m) => [m.agentId, m.group]), [['rs', 1]]);
  start(root, 'f2');
  assert.deepEqual(marks(root).map((m) => [m.agentId, m.group]), [['rs', 1], ['f2', 2]]);
});
