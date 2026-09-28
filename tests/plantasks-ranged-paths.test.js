'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plantasks = require('../lib/plantasks.js');
const { parseTasks, conflict, groups } = plantasks;
const tmp = require('./tmp.js');

const task = (n, modify) => [
  '## Task ' + n + ': name', '',
  '**Files:**',
  ...modify.map((p) => '- Modify: `' + p + '`'),
  '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
].join('\n');

const readTask = (n, modify, body) => [
  '## Task ' + n + ': name', '',
  '**Files:**',
  ...modify.map((p) => '- Modify: `' + p + '`'),
  '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  ...(body || []), '',
].join('\n');

const design = (files) => [
  '# A design', '', '## File table', '', '| file | change | dispatch |', '|---|---|---|',
  ...(files || []).map((f) => '| `' + f + '` | something | implementer, sonnet |'),
  '',
].join('\n');

test('two tasks ranging the same file, even disjoint ranges, still conflict as one file', () => {
  const [a, b] = parseTasks(task(1, ['lib/big.js:1-100']) + task(2, ['lib/big.js:200-300']));
  assert.equal(conflict(a, b), 'files');
  assert.deepEqual(groups([a, b]), [[1], [2]]);
});

test('a ranged Modify: entry satisfies a design file table naming the bare path', () => {
  const plan = task(1, ['lib/big.js:1-100']);
  assert.deepEqual(plantasks.lint(plan, design(['lib/big.js'])), []);
});

test('a ranged Modify: entry is recognised as its bare file by lint\'s fence-ownership check, either way round', () => {
  const rangedFile = readTask(1, ['lib/big.js:1-100'], ['In `lib/big.js`, add:', '', '```js', 'x', '```']);
  assert.deepEqual(plantasks.lint(rangedFile, design([])), []);
  const rangedFence = readTask(1, ['lib/big.js'], ['In `lib/big.js:1-10`, add:', '', '```js', 'x', '```']);
  assert.deepEqual(plantasks.lint(rangedFence, design([])), []);
});

test('requireConflicts keys a ranged Modify: entry by its bare file', () => {
  const dir = tmp('fankeel-plantasks-ranged-');
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib', 'a.js'), "'use strict';\nconst b = require('./b.js');\n");
  fs.writeFileSync(path.join(dir, 'lib', 'b.js'), "'use strict';\nmodule.exports = {};\n");
  const planText = task(1, ['lib/a.js:1-2']) + '\n' + task(2, ['lib/b.js']);
  const tasks = plantasks.parseTasks(planText);
  const found = plantasks.requireConflicts(tasks, dir);
  assert.deepEqual(found, [{ a: 1, b: 2, group: 1, from: 'lib/a.js', to: 'lib/b.js', line: 2 }]);
});
