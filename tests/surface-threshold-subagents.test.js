'use strict';

// The reference page and the decision page say the same number as the code:
// a group of three or more tasks is one Workflow, a pair is two Agents.
// `tests/surface-threshold-prose.test.js` holds the three skills to it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const flat = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\s+/g, ' ');

test('subagents.md says two are agents and three or more are one workflow', () => {
  const sub = flat('docs/90-agent/reference/subagents.md');
  assert.doesNotMatch(sub, /two or more are one `workflow`/);
  assert.doesNotMatch(sub, /whose row has two or more/);
  assert.match(sub, /two are `agents` in one response, three or more are one `workflow`/);
  assert.match(sub, /whose row has three or more runs the same command/);
  assert.match(sub, /a require-edge diagnostic is printed beside the group and leaves it where it is/);
});

test('the decision page says three throughout, with no 三個以下 left to read as four', () => {
  const page = flat('docs/03-decisions/2026-10-16-build-workflow-script.md');
  assert.doesNotMatch(page, /三個以下/);
  assert.match(page, /不到三個的分組不產 script/);
  assert.match(page, /分組列三個以上才跑指令/);
});
