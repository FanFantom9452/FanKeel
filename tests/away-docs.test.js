'use strict';

// gate-14 and spend-6, as the user reads them: the profile key's own words and
// the hook rows in docs/02-architecture/layout.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { KEYS } = require('../lib/profile.js');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('gate.away says the work goes on to the next decision and compacts there', () => {
  const desc = KEYS['gate.away'].desc;
  assert.match(desc, /答要離開就繼續做到下一個要你決定的地方/);
  assert.doesNotMatch(desc, /在這輪結束時自動壓縮/);
});

test('layout.md rows describe the hold, the compaction point and both caps', () => {
  const readme = read('docs/02-architecture/layout.md');
  assert.match(readme, /Eight are not rowed below/);
  assert.match(readme, /wrap-up\.js \(PreToolUse on mcp__ccd_turn__wrap_up/);
  assert.match(readme, /relay-cap\.js \(PreToolUse on SendMessage/);
  assert.match(readme, /past 3000 characters is refused once/);
  assert.match(readme, /the next question that needs the user is held back instead of asked/);
  assert.match(readme, /in which hooks\/gate\.js held a question back/);
  assert.doesNotMatch(readme, /or at once when `gate\.away` marked the user away/);
});
