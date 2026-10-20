'use strict';

// docs/90-agent/todo/guard-2.md: writesFiles reads the command words on the
// whole line, quotes included, except on a fankeel note-style call — node
// scripts/task.js note, ledger.js complete|ruling|fix, todo.js new|done — whose
// line holds nothing a shell runs; there a note quoting `git commit` is not a
// write. The second test drives the real hook at a controlled stage, the way
// the controller chains a note.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const guard = require('../lib/guard.js');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'guard.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000016';

test('writesFiles blanks quoted text only on a recognised fankeel note call', () => {
  for (const cmd of [
    'node scripts/task.js note "ran git commit after the suite" --session x',
    "node scripts/task.js note 'git add, then git commit; rm the scratch' --session x",
    'node scripts/task.js note "git commit later" --session x && node scripts/todo.js list',
    'node scripts/task.js note "ran git commit -m x" --session x',
    'node F:\\ymlab\\fankeel\\scripts\\ledger.js --range a..b fix "rm the stale git add" --task 3',
    'node scripts/ledger.js ruling "keep tee" "git commit is the land\'s" "a redo"',
    "node scripts/todo.js new --title 'git stash leak' --body 'rm, mv and git reset were run'",
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
    // The cost of the allowlist: quoted text outside a recognised call is read.
    'grep -n "tee" lib/guard.js',
    "# check that it's clean\ngit add -A && git commit -m 'x'",
    "echo ok # don't\nrm -rf x; echo 'y'",
    'bash <(echo "rm x")',
    '. <(echo "rm x")',
    'timeout 5 "rm" x',
    'stdbuf -o0 "rm" x',
    'su root "rm x"',
    'FOO=1 "rm" x',
    "awk 'BEGIN{system(\"rm x\")}'",
    "git config alias.x '!rm' && git x",
    'node scripts/task.js note "$(git commit -m x)" --session x',
    'node scripts/task.js note "`rm x`" --session x',
    'node scripts/task.js note "x" --session x; sh -c "rm y"',
    'node scripts/task.js note "x" --session x | sh -c "rm y"',
    'node scripts/task.js note "x" --session x && sh -c "rm y"',
    'node scripts/task.js note "a\\" b" ; rm x ; "c\\" d" --session x',
    // unquoted() ends the span at \" where bash does not, and pairs the rest
    // so that `; rm x ;` is masked: the escaped-quote refusal is what holds.
    'node scripts/task.js note "\'\\"" ; rm x ; \\"',
    'node scripts/task.js show "git commit" --session x',
    'node scripts/other.js note "git commit" --session x',
    'node scripts/task.js note "x" --session x\nsh -c "rm y"',
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
