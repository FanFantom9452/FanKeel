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
