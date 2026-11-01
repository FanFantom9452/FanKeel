'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-build', 'SKILL.md'), 'utf8');

test('build runs a split plan one group plan at a time, in the index build order', () => {
  const step = /\n### 2\. Open the ledger\n[\s\S]*?\n### /.exec(SKILL);
  assert.ok(step, 'step 2 is not where this test looks for it');
  const text = step[0].replace(/\s+/g, ' ');
  assert.match(text, /`<stem>-index\.md`/);
  assert.match(text, /`build order:` line/);
  assert.match(text, /one group plan at a time/);
  assert.match(text, /`ledger\.js --plan <group file>`/);
  assert.match(text, /only through the index's `interface it exposes` cell/);
  assert.match(text, /## Splitting a plan that will not fit/);
});
