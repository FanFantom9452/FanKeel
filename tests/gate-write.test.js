'use strict';

// PostToolUse on Write. hooks/gate.js already validates a stage agent's
// `json gate` block, but only once the controller is already asking it to
// the user; this hook's job is the earlier half, catching the same shape
// problem the moment the stage agent's own Write lands the handoff file.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');
const { handoffPath } = require('../lib/handoff.js');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks', 'gate-write.js');

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';

const ago = (ms) => new Date(Date.now() - ms).toISOString();

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'rework the colour ramp',
    stage: 'survey',
    active: true,
    started: '2026-09-19T09:30:12.345Z',
    updated: ago(3600e3),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

function run(root, payload) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(Object.assign({
      session_id: MINE,
      cwd: root,
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
    }, payload)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  });
}

const TICKS = '`'.repeat(3);
const QUESTIONS = [{
  question: 'survey 的結論可以進 design 嗎？',
  header: 'survey',
  multiSelect: false,
  options: [{ label: '進 design', description: 'a' }, { label: '暫停', description: 'b' }, { label: '再讀一輪', description: 'c' }],
}];

// Option one's label must name the next stage on the route (`design`, here),
// or `down`/`收工` to stand the task down — `lib/handoff.js`'s `gateProblem`.
function gateBlock(optionOneLabel) {
  const questions = JSON.parse(JSON.stringify(QUESTIONS));
  questions[0].options[0].label = optionOneLabel;
  return '# report\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions, next: 'design' }) + '\n' + TICKS + '\n';
}

const AGENT = 'a3f9c2';
const MARK = { stage: 'survey', at: 1758000000000, agentId: AGENT };

test('a valid gate written to the session\'s own current-stage handoff produces nothing', () => {
  const root = tmp('fankeel-gate-write-');
  const data = seed(root, MINE, { inflight: MARK });
  const file = handoffPath(root, data, 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, gateBlock('進 design'));

  const out = run(root, { agent_id: AGENT, tool_input: { file_path: file } });
  assert.equal(out.trim(), '');
});

test('an invalid gate written to that same path hands the agent additionalContext naming the field', () => {
  const root = tmp('fankeel-gate-write-');
  const data = seed(root, MINE, { inflight: MARK });
  const file = handoffPath(root, data, 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, gateBlock('什麼都不是'));

  const out = JSON.parse(run(root, { agent_id: AGENT, tool_input: { file_path: file } }));
  assert.equal(out.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.match(out.hookSpecificOutput.additionalContext, /questions\[0\]\.options\[0\]\.label/);
  assert.match(out.hookSpecificOutput.additionalContext, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('the same invalid content written to an unrelated file produces nothing', () => {
  const root = tmp('fankeel-gate-write-');
  const data = seed(root, MINE, { inflight: MARK });
  const file = handoffPath(root, data, 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, gateBlock('什麼都不是'));

  const elsewhere = path.join(path.dirname(file), 'notes.md');
  fs.writeFileSync(elsewhere, gateBlock('什麼都不是'));

  const out = run(root, { agent_id: AGENT, tool_input: { file_path: elsewhere } });
  assert.equal(out.trim(), '');
});

test('the same invalid content written by a session not at that stage produces nothing', () => {
  const root = tmp('fankeel-gate-write-');
  // The mark on record belongs to `build`, not this session's current stage
  // (`survey`) — the same file, written by an agent this hook does not
  // recognise as this stage's own.
  const data = seed(root, MINE, { inflight: { stage: 'build', at: 1758000000000, agentId: AGENT } });
  const file = handoffPath(root, data, 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, gateBlock('什麼都不是'));

  const out = run(root, { agent_id: AGENT, tool_input: { file_path: file } });
  assert.equal(out.trim(), '');
});

test('a session not in the mode is left alone', () => {
  const root = tmp('fankeel-gate-write-');
  const data = seed(root, MINE, { active: false, inflight: MARK });
  const file = handoffPath(root, data, 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, gateBlock('什麼都不是'));

  const out = run(root, { agent_id: AGENT, tool_input: { file_path: file } });
  assert.equal(out.trim(), '');
});

test('malformed stdin is not an error', () => {
  const root = tmp('fankeel-gate-write-');
  seed(root, MINE, { inflight: MARK });
  const out = execFileSync(process.execPath, [HOOK], {
    input: 'not json',
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  });
  assert.equal(out.trim(), '');
});

// docs/90-agent/plans/2026-09-30-init-design.md §6: the task's floor is
// checked the moment the stage agent writes its gate, not only when it is asked.
test('a gate naming a class below the task\'s floor is flagged when it is written', () => {
  const root = tmp('fankeel-gate-write-');
  const data = seed(root, MINE, { inflight: MARK, floor: 'architectural' });
  const file = handoffPath(root, data, 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const questions = JSON.parse(JSON.stringify(QUESTIONS));
  questions[0].options.splice(1, 0, { label: '改走 bounded', description: 'c' });
  fs.writeFileSync(file, '# report\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions, next: 'design' }) + '\n' + TICKS + '\n');
  const out = JSON.parse(run(root, { agent_id: AGENT, tool_input: { file_path: file } }));
  assert.match(out.hookSpecificOutput.additionalContext, /questions\[0\]\.options\[1\]\.label/);
});
