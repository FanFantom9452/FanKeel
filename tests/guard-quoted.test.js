'use strict';

// docs/90-agent/todo/guard-2.md: writesFiles reads the command words outside
// quotes, so a note quoting `git commit` is not a write; a git commit outside
// quotes, or on a line where quoted text can run, still is. The second test drives
// the real hook at a controlled stage, the way the controller chains a note.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const guard = require('../lib/guard.js');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'guard.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000016';

test('writesFiles reads the command words outside quotes, unless quoted text on the line can run', () => {
  for (const cmd of [
    'node scripts/task.js note "ran git commit after the suite" --session x',
    "node scripts/task.js note 'git add, then git commit; rm the scratch' --session x",
    'node scripts/task.js note "git commit later" --session x && node scripts/todo.js list',
    'grep -n "tee" lib/guard.js',
    'node scripts/task.js note "ran git commit -m x" --session x',
  ]) {
    assert.equal(guard.writesFiles(cmd), false, cmd);
  }
  for (const cmd of [
    'node scripts/task.js note "suite green" --session x && git commit -m "fix: y"',
    'git commit -m "note"',
    'bash -c "git commit -m x"',
    "sh -c 'rm -rf build'",
    'powershell -Command "Remove-Item x"',
    "echo 'rm -rf x' | sh",
    "node -e \"require('fs').writeFileSync('x', 'y')\"",
    "python -c \"open('x', 'w')\"",
    'eval "git commit -m x"',
    'echo "$(git commit -m x)"',
    "node -e \"require('child_process').execSync('git commit -m x')\"",
    "python -c \"import os; os.system('rm -rf x')\"",
    "'rm' -rf x",
    '"rm" -rf x',
    'ssh h "rm x"',
    "echo don\\'t; git commit -m 'x'",
    'bash -lc "rm x"',
    'bash <<< "rm x"',
  ]) {
    assert.equal(guard.writesFiles(cmd), true, cmd);
  }
});

function controlled() {
  const root = tmp('fankeel-guard-quoted-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify({
    task: 't', claims: [], stage: 'build', active: true,
    started: new Date(Date.now() - 7200e3).toISOString(), updated: new Date().toISOString(),
  }));
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey,build,verify' }));
  return root;
}

function run(root, command) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: MINE, cwd: root, tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-guard-quoted-cfg-') }),
  });
}

test('at a controlled stage a chained note quoting git commit goes through, and a real git commit is denied', () => {
  const root = controlled();
  assert.equal(run(root, 'node scripts/task.js note "ran git commit after the suite" --session x && node scripts/todo.js list'), '');
  const out = JSON.parse(run(root, 'node scripts/task.js note "suite green" --session x && git commit -m "fix: y"'));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /^fankeel: build is a controlled stage/);
});
