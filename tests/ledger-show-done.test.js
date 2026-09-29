'use strict';

// await-3: nothing printed the task count, so the build's close report counted
// progress.md by hand. `show` prints it now, off the plan file, not the ledger.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'ledger.js');
process.env.CLAUDE_CONFIG_DIR = tmp('fankeel-ledger-done-cfg-');

const planOf = (n) => Array.from({ length: n }, (_, i) => [
  '## Task ' + (i + 1) + ': t' + (i + 1), '', '**Files:**', '- Modify: `lib/f' + (i + 1) + '.js`', '',
].join('\n')).join('\n');

function fixture(n) {
  const dir = tmp('fankeel-ledger-done-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, planOf(n));
  const cli = (...args) => execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, ...args], { encoding: 'utf8', cwd: dir });
  cli('init');
  return { plan, cli };
}

test('show prints done <complete> of <plan tasks> under complete:', () => {
  const { cli } = fixture(5);
  cli('complete', '2', 'two');
  cli('complete', '4', 'four');
  assert.match(cli('show'), /\n {2}complete: 2, 4\n {2}done 2 of 5\n/);
});

test('a task completed twice counts once, and a number the plan does not have counts not at all', () => {
  const { cli } = fixture(5);
  cli('complete', '1', 'one');
  cli('complete', '1', 'one again');
  cli('complete', '9', 'not in the plan');
  assert.match(cli('show'), /\n {2}done 1 of 5\n/);
});

test('with the plan file gone, show says so rather than guessing the denominator', () => {
  const { plan, cli } = fixture(3);
  cli('complete', '1', 'one');
  fs.rmSync(plan);
  assert.match(cli('show'), /\n {2}done 1 of \? — no plan at .*plan\.md\n/);
});

test('the build skill\'s close report takes done from show, not from a hand count', () => {
  const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-build', 'SKILL.md'), 'utf8');
  const output = /\n## Output\r?\n([\s\S]*)$/.exec(skill)[1];
  assert.match(output, /`done <n> of <m>` line that `node <plugin>\/scripts\/ledger\.js --plan <plan> show` prints/);
  assert.match(output, /never a count of `progress\.md` made by hand/);
});
