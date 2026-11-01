'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-plan', 'SKILL.md'), 'utf8');

test('the plan skill tells an author to range a file over READ_CAP rather than skip the cap', () => {
  assert.match(SKILL, /`path:a-b`/);
  assert.match(SKILL, /READ_CAP/);
  assert.match(SKILL, /FILE_CAP/);
  assert.match(SKILL, /has to be split/);
});

test('the plan skill names the implementer, haiku Dispatch form and its two conditions', () => {
  assert.match(SKILL, /\*\*Dispatch:\*\* implementer, haiku/);
  assert.match(SKILL, /READ_CAP \/ 2/);
  assert.match(SKILL, /begins `Write`/);
});

test('the plan skill says when a plan splits, the index shape, and who writes each group', () => {
  const at = SKILL.indexOf('## Splitting a plan that will not fit');
  assert.ok(at >= 0, 'no split section');
  assert.ok(at > SKILL.indexOf('## Where it goes') && at < SKILL.indexOf('## The header'),
    'the split section is not between Where it goes and The header');
  const section = SKILL.slice(at, SKILL.indexOf('## The header'));
  assert.match(section, /more than 8 tasks/);
  assert.match(section, /`context:` line/);
  assert.match(section, /`<plan bucket>\/<stem>-index\.md`/);
  assert.match(section, /\| group \| plan file \| spec sections \| files \| interface it exposes \| depends on \|/);
  assert.match(section, /`build order:`/);
  assert.match(section, /`ledger\.js --plan <group file>` reads it unchanged/);
  assert.match(section, /one fresh agent per group/);
  assert.match(section, /except through the interface column/);
  assert.match(section, /`task\.js intends` once, on the design/);
});
