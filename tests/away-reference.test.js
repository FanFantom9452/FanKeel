'use strict';

// gate-14 in the pages an agent reads: who writes leavingAt and awayAt, and
// when they are cleared.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('the answer row says resume.js sets leavingAt and gate.js holds the next question', () => {
  const page = read('docs/90-agent/reference/subagents.md');
  assert.match(page, /sets `leavingAt` on the record when it was answered 要離開/);
  assert.match(page, /`hooks\/gate\.js` holds the next question that needs the user/);
  assert.doesNotMatch(page, /sets `awayAt` on the record when it was answered 要離開/);
});

test('the registry page names both writers and the task-notification exception', () => {
  const page = read('docs/90-agent/reference/registry.md');
  assert.match(page, /`resume\.js` for `leavingAt` \(`setLeaving`/);
  assert.match(page, /`gate\.js` for `awayAt` \(`setAway`/);
  assert.match(page, /never on a task notification/);
});
