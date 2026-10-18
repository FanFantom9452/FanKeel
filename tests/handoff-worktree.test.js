'use strict';

// A session Claude Desktop opened in `<root>/.claude/worktrees/<name>` finds the
// registry at `root`, but its stage agents write their handoffs in the worktree.
// 2026-10-18: hooks/resume.js looked for the gate under the root, found none, and
// the answer never reached the agent.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');
const { checkoutFor, withCheckout, dirFor, answerPath } = require('../lib/handoff.js');
const { brainWriteReason } = require('../lib/guard.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'resume.js');
const INJECT = path.join(__dirname, '..', 'hooks', 'inject.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const STARTED = '2026-10-18T09:30:12.345Z';
const TASK = 'task-20261018T093012';
const GATE = [{ question: 'survey 的結論可以進 design 嗎？', header: 'survey', multiSelect: false, options: [{ label: '進 design', description: 'a' }, { label: '暫停', description: 'b' }] }];

// A registry root with a session record, and a worktree nested under it whose
// stage agent has written survey.md with its gate.
function seed(record) {
  const root = tmp('fankeel-wt-root-');
  const tree = path.join(root, '.claude', 'worktrees', 'quirky-name');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'true' }));
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify(Object.assign({
    task: 'worktree handoffs', stage: 'survey', route: ['survey', 'design'], active: true,
    started: STARTED, updated: STARTED, configDir: tmp('fankeel-cfg-'),
  }, record)));
  const dir = path.join(tree, '.fankeel', 'build', TASK);
  fs.mkdirSync(dir, { recursive: true });
  const ticks = '`'.repeat(3);
  fs.writeFileSync(path.join(dir, 'survey.md'), '# report\n\n' + ticks + 'json gate\n' + JSON.stringify({ questions: GATE, next: 'n' }) + '\n' + ticks + '\n');
  return { root, tree, dir };
}

function env() {
  const e = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-'), FANKEEL_SERVE: 'off' });
  delete e.CLAUDE_PROJECT_DIR;
  return e;
}

function answer(cwd) {
  execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'AskUserQuestion', cwd, session_id: MINE, tool_input: { questions: GATE }, tool_response: { answers: { [GATE[0].question]: '進 design' } } }),
    encoding: 'utf8', env: env(),
  });
}

test('the answer lands beside the gate the brain wrote in the worktree, not under the registry root', () => {
  const { root, tree, dir } = seed({});
  answer(tree);
  assert.ok(fs.existsSync(path.join(dir, 'survey-answer.md')), 'survey-answer.md beside survey.md in the worktree');
  assert.match(fs.readFileSync(path.join(dir, 'survey-answer.md'), 'utf8'), /進 design/);
  assert.equal(fs.existsSync(path.join(root, '.fankeel', 'build', TASK)), false, 'nothing under the root');
});

test('a record carrying `checkout` finds the worktree whatever directory the hook runs from', () => {
  const { root, dir } = seed({ checkout: '.claude/worktrees/quirky-name' });
  answer(root);
  assert.ok(fs.existsSync(path.join(dir, 'survey-answer.md')));
});

test('inject stores the worktree on a record that has none', () => {
  const { root, tree } = seed({});
  execFileSync(process.execPath, [INJECT], { input: JSON.stringify({ cwd: tree, session_id: MINE, prompt: 'go on' }), encoding: 'utf8', env: env() });
  const data = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), 'utf8'));
  assert.equal(data.checkout, '.claude/worktrees/quirky-name');
});

test('checkoutFor names a nested Claude worktree and nothing else', () => {
  const root = path.resolve('/r');
  assert.equal(checkoutFor(root, path.join(root, '.claude', 'worktrees', 'x', 'lib')), '.claude/worktrees/x');
  assert.equal(checkoutFor(root, root), null);
  assert.equal(checkoutFor(root, path.join(root, 'lib')), null);
  assert.equal(checkoutFor(root, path.resolve('/elsewhere/.claude/worktrees/x')), null);
  // A `checkout` that does not have the worktree shape is ignored, not followed.
  assert.equal(dirFor(root, { started: STARTED, checkout: '../out' }), path.join(root, '.fankeel', 'build', TASK).replace(/\\/g, '/'));
  assert.equal(withCheckout(root, { checkout: '.claude/worktrees/y' }, path.join(root, '.claude', 'worktrees', 'x')).checkout, '.claude/worktrees/y');
  assert.equal(answerPath(root, { started: STARTED, stage: 'survey', checkout: '.claude/worktrees/x' }, 'survey'),
    path.join(root, '.claude', 'worktrees', 'x', '.fankeel', 'build', TASK, 'survey-answer.md').replace(/\\/g, '/'));
});

test('a brain may write its own task directory in the worktree and not the root\'s', () => {
  const root = path.resolve('/r');
  const mine = { started: STARTED, checkout: '.claude/worktrees/x' };
  const agentType = 'fankeel:fankeel-brain';
  assert.equal(brainWriteReason({ agentType, root, mine, file: path.join(root, '.claude', 'worktrees', 'x', '.fankeel', 'build', TASK, 'survey.md') }), null);
  assert.match(brainWriteReason({ agentType, root, mine, file: path.join(root, '.fankeel', 'build', TASK, 'survey.md') }), /own session's task directory/);
});
