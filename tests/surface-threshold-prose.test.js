'use strict';

// Text that said a Workflow wants two tasks was true from Task 4 of the
// 2026-10-19 speed plan until the 2026-10-22 ruling "改回三個":
// docs/03-decisions/2026-10-16-build-workflow-script.md says three or more.
// `tests/skills.test.js` pins the start of the build skill's surface paragraph,
// which stays. `tests/surface-threshold-subagents.test.js` holds subagents.md
// and the decision page to the same number.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const flat = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\s+/g, ' ');

test('the build skill sends three or more as a workflow and no longer says two', () => {
  const text = flat('skills/fankeel-build/SKILL.md');
  assert.doesNotMatch(text, /two or more listed at once/);
  assert.doesNotMatch(text, /`groups` row has two or more/);
  assert.doesNotMatch(text, /from two tasks up/);
  assert.doesNotMatch(text, /prints `agents` for a group of two or more/);
  assert.match(text, /three or more listed at once/);
  assert.match(text, /`groups` row has three or more/);
  assert.match(text, /from three tasks up/);
  assert.match(text, /prints `agents` for a group of three or more/);
  assert.match(text, /A require-edge line under the table does not change the row/);
});

test('the fankeel skill says two are agents and three or more are one workflow', () => {
  const text = flat('skills/fankeel/SKILL.md');
  assert.doesNotMatch(text, /two or more are one `workflow`/);
  assert.match(text, /two are `agents` in one response, three or more are one `workflow`/);
});

test('the plan skill says two are agents and three or more tasks are one workflow', () => {
  const text = flat('skills/fankeel-plan/SKILL.md');
  assert.doesNotMatch(text, /two or more are one `workflow`/);
  assert.match(text, /two are `agents` in one response, three or more are one `workflow`/);
});
