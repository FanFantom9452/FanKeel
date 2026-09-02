'use strict';

// PreToolUse on AskUserQuestion, and the PostToolUse hook that closes what it
// opened. Run as processes, because a hook that works when required and wedges
// when spawned is a hook that works nowhere.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(ROOT, 'hooks', 'gate.js');
const RESUME = path.join(ROOT, 'hooks', 'resume.js');

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';

const ago = (ms) => new Date(Date.now() - ms).toISOString();

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'rework the colour ramp',
    stage: 'design',
    active: true,
    started: ago(2 * 3600e3),
    updated: ago(3600e3),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

function readEntry(root, sessionId) {
  const file = path.join(root, '.fankeel', 'sessions', sessionId + '.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function run(hook, root, payload) {
  return execFileSync(process.execPath, [hook], {
    input: JSON.stringify(Object.assign({
      session_id: MINE,
      cwd: root,
      tool_name: 'AskUserQuestion',
    }, payload)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  });
}

test('the gate hook stamps gateAt on a session in the mode', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE);
  run(GATE, root, {});
  assert.equal(Number.isFinite(readEntry(root, MINE).gateAt), true);
});

// A PreToolUse hook that answers on a tool it has no opinion about overrides the
// user's own permission rules. This one has an opinion about none of them.
test('the gate hook writes nothing to stdout', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE);
  assert.equal(run(GATE, root, {}).trim(), '');
});

test('a session not in the mode is left alone', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { active: false });
  run(GATE, root, {});
  assert.equal(readEntry(root, MINE).gateAt, undefined);
});

test('no entry at all is not an error', () => {
  const root = tmp('fankeel-gate-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  assert.equal(run(GATE, root, {}).trim(), '');
});

test('malformed stdin is not an error', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE);
  const out = execFileSync(process.execPath, [GATE], {
    input: 'not json',
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  });
  assert.equal(out.trim(), '');
});

const context = (out) => JSON.parse(out).hookSpecificOutput.additionalContext;

// The pair, in the order Claude Code runs it.
test('the gate opened then answered accumulates into the stage', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'design' });
  run(GATE, root, {});
  const out = run(RESUME, root, {});
  const after = readEntry(root, MINE);
  assert.equal(after.gateAt, undefined);
  assert.equal(Number.isFinite(after.waited.design), true);
  assert.doesNotMatch(context(out), /^gate: /m);
});

// The second half on its own is what a process registered before `gate.js`
// existed looks like: Claude Code reads its hook list at process start, so a
// session opened later in that process — `/clear` included — runs `resume.js`
// and never `gate.js`. `waited` then stays empty for as long as the process
// lives, and `resume.js` is the only place that can see it. It says so in the
// one block it already sends.
test('an answer with no stamp says the gate hook did not run', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'design' });
  const out = run(RESUME, root, {});
  assert.match(context(out), /^gate: .*hooks\/gate\.js did not run/m);
  assert.equal(readEntry(root, MINE).waited, undefined);
});
