'use strict';

// Text that said a Workflow wants three tasks, or that any diagnostic keeps a
// group off `workflow`, was true until Task 4 of the 2026-10-19 speed plan.
// `tests/skills.test.js` pins the start of the build skill's surface paragraph,
// which stays.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const flat = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\s+/g, ' ');

test('the build skill sends two or more as a workflow and no longer says three', () => {
  const text = flat('skills/fankeel-build/SKILL.md');
  assert.doesNotMatch(text, /three or more listed at once/);
  assert.doesNotMatch(text, /`groups` row has three or more/);
  assert.doesNotMatch(text, /prints `agents` for a group of three or more/);
  assert.match(text, /two or more listed at once/);
  assert.match(text, /`groups` row has two or more/);
  assert.match(text, /A require-edge line under the table does not change the row/);
});

test('the fankeel skill and subagents.md say two or more are one workflow', () => {
  for (const rel of ['skills/fankeel/SKILL.md', 'docs/90-agent/reference/subagents.md']) {
    const text = flat(rel);
    assert.doesNotMatch(text, /two are `agents` in one response, three or more are/, rel);
    assert.match(text, /two or more are one `workflow`/, rel);
  }
  const sub = flat('docs/90-agent/reference/subagents.md');
  assert.doesNotMatch(sub, /A group carrying a diagnostic never reaches `workflow`/);
  assert.doesNotMatch(sub, /whose row has three or more/);
  assert.match(sub, /a require-edge diagnostic is printed beside the group and leaves it where it is/);
});

test('the plan skill says two or more tasks are one workflow', () => {
  const text = flat('skills/fankeel-plan/SKILL.md');
  assert.doesNotMatch(text, /two are `agents` in one response, three or more are one `workflow`/);
  assert.match(text, /two or more are one `workflow`/);
});
