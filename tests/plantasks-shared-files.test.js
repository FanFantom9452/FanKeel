'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plantasks = require('../lib/plantasks.js');

const task = (n, { modify = [], test: tests = [], read = [] }) => [
  '## Task ' + n + ': name', '',
  '**Files:**',
  ...modify.map((p) => '- Modify: `' + p + '`'),
  ...read.map((p) => '- Read: `' + p + '` — why'),
  ...tests.map((p) => '- Test: `' + p + '`'),
  '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
].join('\n');

const design = '# A design\n\n## File table\n\n| file | change | dispatch |\n|---|---|---|\n\n';

test('lint names a file four tasks write, once, with the tasks', () => {
  const plan = [1, 2, 3, 4].map((n) => task(n, { modify: ['lib/m' + n + '.js'], test: ['tests/agents.test.js'] })).join('\n');
  const out = plantasks.lint(plan, design);
  assert.equal(out.length, 1, out.join('\n'));
  assert.match(out[0], /^`tests\/agents\.test\.js` is written by Tasks 1, 2, 3, 4 /);
  assert.match(out[0], /give each its own test file/);
});

test('lint is silent for two tasks on one file, an index file, and a file read by two', () => {
  const two = [1, 2].map((n) => task(n, { modify: ['lib/shared.js'] })).join('\n');
  assert.deepEqual(plantasks.lint(two, design), []);
  const index = [1, 2, 3].map((n) => task(n, { modify: ['lib/m' + n + '.js', 'TODO.md'] })).join('\n');
  assert.deepEqual(plantasks.lint(index, design), []);
  const readers = [1, 2, 3].map((n) => task(n, { modify: ['lib/m' + n + '.js'], read: ['lib/common.js'] })).join('\n');
  assert.deepEqual(plantasks.lint(readers, design), []);
});

test('lint counts a ranged entry as its file', () => {
  const plan = [1, 2, 3].map((n) => task(n, { modify: ['lib/big.js:' + n + '-' + (n + 9)] })).join('\n');
  const out = plantasks.lint(plan, design);
  assert.equal(out.length, 1, out.join('\n'));
  assert.match(out[0], /^`lib\/big\.js` is written by Tasks 1, 2, 3 /);
});

test('lint names a Read: of a file a neighbour writes, once per pair', () => {
  const plan = [
    task(1, { modify: ['lib/shots.js'] }),
    task(2, { modify: ['lib/other.js'], read: ['lib/shots.js'] }),
  ].join('\n');
  const out = plantasks.lint(plan, design);
  assert.equal(out.length, 1, out.join('\n'));
  assert.match(out[0], /^Task 2 `Read:` `lib\/shots\.js`, which Task 1 writes /);
});

test('lint is silent for a Read: of a file whose writer groups already separates', () => {
  const plan = [
    task(1, { modify: ['lib/shots.js', 'lib/z.js'] }),
    task(2, { modify: ['lib/z.js'] }),
    task(3, { modify: ['lib/other.js'], read: ['lib/shots.js'] }),
  ].join('\n');
  assert.deepEqual(plantasks.lint(plan, design), []);
});

test('the plan skill says lint reports both', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-plan', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
  assert.match(text, /`ledger\.js lint` reports a file that three or more tasks write/);
});
