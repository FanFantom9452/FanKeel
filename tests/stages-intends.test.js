'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { byName } = require('../lib/stages.js');

test('the plan gate and the start of build both run task.js intends', () => {
  assert.match(byName('plan').rules.join('\n'), /^Before the gate: `task\.js intends <f>`, `ledger\.js --plan <f> lint` clean/m);
  assert.match(byName('build').rules.join('\n'), /--plan <f> show` and `task\.js intends <f>` first;/);
});

test('both skills give the whole command, session flag included', () => {
  for (const name of ['fankeel-plan', 'fankeel-build']) {
    const text = fs.readFileSync(path.join(__dirname, '..', 'skills', name, 'SKILL.md'), 'utf8');
    assert.match(text, /task\.js intends <plan bucket>\/<file>\.md --session <id>/, name);
  }
});
