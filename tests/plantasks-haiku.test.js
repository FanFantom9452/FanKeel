'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const plantasks = require('../lib/plantasks.js');
const { parseTasks } = plantasks;

const body = (dispatchLine) => [
  '## Task 1: name', '',
  '**Files:**', '- Modify: `lib/a.js`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  dispatchLine, '',
].join('\n');

test('parsePlan reads the model off an implementer, <model> Dispatch line', () => {
  const [t] = parseTasks(body('**Dispatch:** implementer, haiku — mechanical rename.'));
  assert.equal(t.dispatch, 'implementer');
  assert.equal(t.model, 'haiku');
});

test('parsePlan leaves model empty for in-session, user, and an implementer with no comma', () => {
  assert.equal(parseTasks(body('**Dispatch:** in-session — the user said so.'))[0].model, '');
  assert.equal(parseTasks(body('**Dispatch:** user — run /doctor.'))[0].model, '');
  assert.equal(parseTasks(body('**Dispatch:** implementer — no model given.'))[0].model, '');
});

const design = () => '# A design\n';

const cleanHaiku = [
  '## Task 1: name', '',
  '**Files:**', '- Modify: `lib/a.js`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** implementer, haiku — mechanical rename.', '',
  '1. Write the failing test. In `lib/a.js`, add:', '', '```js', 'x', '```', '',
  '2. Run it and see it fail: `node --test tests/a.test.js`', '',
  '3. Write the implementation. In `lib/a.js`, add:', '', '```js', 'y', '```', '',
  '4. Run it and see it pass.', '',
  '5. Commit: `git commit -m "x"`', '',
].join('\n');

const missingFence = [
  '## Task 1: name', '',
  '**Files:**', '- Modify: `lib/a.js`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** implementer, haiku — mechanical rename.', '',
  '1. Write the failing test. In `lib/a.js`, add:', '', '```js', 'x', '```', '',
  '2. Run it and see it fail: `node --test tests/a.test.js`', '',
  '3. Write the implementation as described above.', '',
  '4. Run it and see it pass.', '',
  '5. Commit: `git commit -m "x"`', '',
].join('\n');

const overCap = [
  '## Task 1: name', '',
  '**Files:**', '- Modify: `lib/a.js:1-800`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** implementer, haiku — mechanical rename.', '',
  '1. Write the failing test. In `lib/a.js`, add:', '', '```js', 'x', '```', '',
  '3. Write the implementation. In `lib/a.js`, add:', '', '```js', 'y', '```', '',
].join('\n');

test('lint passes an implementer, haiku task under half READ_CAP with a fence for each Write step', () => {
  assert.deepEqual(plantasks.lint(cleanHaiku, design()), []);
});

test('lint flags an implementer, haiku task missing a fence for one of its Write steps', () => {
  const out = plantasks.lint(missingFence, design());
  assert.ok(out.includes('Task 1: `implementer, haiku` has a numbered `Write` step with no fenced code to match it'), out.join('\n'));
});

test('lint flags an implementer, haiku task over half READ_CAP', () => {
  const out = plantasks.lint(overCap, design());
  assert.ok(out.includes('Task 1: `implementer, haiku` reads 800 lines, over READ_CAP / 2 (750)'), out.join('\n'));
});
