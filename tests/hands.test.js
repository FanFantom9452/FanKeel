'use strict';

// A task only the user can do — a slash command, a browser, an interactive
// probe — used to surface when a stage agent found itself blocked on it. It is
// declared now, `**Dispatch:** user — <what>`, never sent out, and said the
// moment build opens to the session that holds AskUserQuestion.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const LEDGER = path.join(__dirname, '..', 'scripts', 'ledger.js');
const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const SID = 'aaaaaaaa-1111-2222-3333-444444444444';

const PLAN = [
  '## Task 1: code', '', '**Files:**', '- Modify: `lib/a.js`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** implementer, sonnet — transcription.', '',
  '## Task 2: doctor', '', '**Files:**', '- Modify: `notes.md`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** user — 跑 /doctor', '',
].join('\n');
const WITHOUT_HANDS = PLAN.split('## Task 2')[0];

const ledgerCli = (dir, plan, ...args) => execFileSync(process.execPath, [LEDGER, '--root', dir, '--plan', plan, ...args], { encoding: 'utf8' });

// The same shape tests/task.test.js's `run` uses: --claude-dir and
// CLAUDE_CONFIG_DIR both point at a directory of this test's own, so no badge
// or liveness check reaches the machine's real config.
function taskCli(dir, args) {
  const cfg = path.join(dir, 'cfg');
  return execFileSync(process.execPath, [TASK, ...args, '--root', dir, '--claude-dir', cfg],
    { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

test('ledger.js hands lists each user task with what the user does, and none when there are none', () => {
  const dir = tmp('fankeel-hands-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN);
  assert.equal(ledgerCli(dir, plan, 'hands'), '2 — 跑 /doctor\n');
  fs.writeFileSync(plan, WITHOUT_HANDS);
  assert.equal(ledgerCli(dir, plan, 'hands'), 'none\n');
});

test('ledger.js ready never lists a user task, even once nothing holds it back', () => {
  const dir = tmp('fankeel-hands-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN);
  ledgerCli(dir, plan, 'init');
  assert.equal(ledgerCli(dir, plan, 'ready'), '1\n');
  ledgerCli(dir, plan, 'complete', '1', 'a.js');
  assert.equal(ledgerCli(dir, plan, 'ready'), 'none\n');
});

test('entering build names the plan\'s user tasks and says to ask now; a plan with none adds nothing', () => {
  const dir = tmp('fankeel-hands-');
  taskCli(dir, ['start', '--session', SID, '--task', 'hands']);
  const plans = path.join(dir, 'docs', 'plans');
  fs.mkdirSync(plans, { recursive: true });
  fs.writeFileSync(path.join(plans, '2026-09-24-x.md'), PLAN);
  const out = taskCli(dir, ['stage', 'build', '--session', SID]);
  assert.match(out, /^hands — docs\/plans\/2026-09-24-x\.md:$/m);
  assert.match(out, /^  Task 2 — 跑 \/doctor$/m);
  assert.match(out, /Ask the user now, before the first dispatch/);
  assert.doesNotMatch(out, /Task 1 — /);
  fs.writeFileSync(path.join(plans, '2026-09-24-x.md'), WITHOUT_HANDS);
  assert.doesNotMatch(taskCli(dir, ['stage', 'build', '--session', SID]), /^hands/m);
});
