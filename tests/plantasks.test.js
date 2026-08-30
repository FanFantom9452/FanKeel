'use strict';

// Two implementers in one checkout is the failure this file's subject prevents,
// and only half of it is about filenames. The shared-cause row below is the one
// a partition by path gets wrong.

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseTasks, conflict, groups } = require('../lib/plantasks.js');

const task = (n, modify, tests, consumes, produces) => [
  '## Task ' + n + ': name',
  '',
  '**Files:**',
  ...modify.map((p) => '- Modify: `' + p + '`'),
  ...tests.map((p) => '- Test: `' + p + '`'),
  '',
  '**Interfaces:**',
  '- Consumes: ' + (consumes.length ? consumes.map((s) => '`' + s + '`').join(', ') : 'nothing from an earlier task.'),
  '- Produces: ' + (produces.length ? produces.map((s) => '`' + s + '`').join(', ') : 'nothing.'),
  '',
].join('\n');

test('a task declares its files and its interfaces', () => {
  const [t] = parseTasks(task(1, ['lib/a.js'], ['tests/a.test.js'], [], ['makeA']));
  assert.equal(t.n, 1);
  assert.deepEqual(t.modify, ['lib/a.js']);
  assert.deepEqual(t.test, ['tests/a.test.js']);
  assert.deepEqual(t.produces, ['makeA']);
});

test('prose after the block is not a declaration', () => {
  const text = task(1, ['lib/a.js'], [], [], []) + '\nSome prose.\n- Modify: `lib/b.js`\n';
  const [t] = parseTasks(text);
  assert.deepEqual(t.modify, ['lib/a.js']);
});

test('disjoint files and no edge may run at once', () => {
  const [a, b] = parseTasks(task(1, ['lib/a.js'], [], [], []) + task(2, ['lib/b.js'], [], [], []));
  assert.equal(conflict(a, b), null);
});

test('a shared file serialises them', () => {
  const [a, b] = parseTasks(task(1, ['lib/a.js'], [], [], []) + task(2, ['lib/a.js'], [], [], []));
  assert.equal(conflict(a, b), 'files');
});

test('a shared test file serialises them', () => {
  const [a, b] = parseTasks(task(1, ['lib/a.js'], ['tests/x.test.js'], [], []) + task(2, ['lib/b.js'], ['tests/x.test.js'], [], []));
  assert.equal(conflict(a, b), 'files');
});

// The row a filename-only design gets wrong: disjoint files, shared cause.
test('a producer/consumer edge serialises them even with disjoint files', () => {
  const [a, b] = parseTasks(task(1, ['lib/a.js'], [], [], ['makeA']) + task(2, ['lib/b.js'], [], ['makeA'], []));
  assert.equal(conflict(a, b), 'interface');
});

test('a task that declared nothing conflicts with everything', () => {
  const [a] = parseTasks(task(1, ['lib/a.js'], [], [], []));
  const bare = { n: 2, name: 'x', modify: [], test: [], consumes: [], produces: [] };
  assert.equal(conflict(a, bare), 'undeclared');
});

test('groups keep the plan order and split on the first conflict', () => {
  const text = task(1, ['lib/a.js'], [], [], ['makeA'])
    + task(2, ['lib/b.js'], [], ['makeA'], [])
    + task(3, ['lib/c.js'], [], [], [])
    + task(4, ['docs/d.md'], [], [], []);
  assert.deepEqual(groups(text), [[1], [2, 3, 4]]);
});

// A description after the em dash can itself hold backticked words; only the
// first backtick on the line is the declared path, or the description leaks
// into the file list.
test('only the first backticked token on an entry line is taken', () => {
  const text = [
    '## Task 1: name',
    '',
    '**Files:**',
    '- Modify: `lib/stages.js` — the `plan` stage\'s `**Dispatch:**` rule',
    '',
  ].join('\n');
  const [t] = parseTasks(text);
  assert.deepEqual(t.modify, ['lib/stages.js']);
});

// A fenced code block documenting the block's own format must not thereby
// declare files.
test('a fenced code block is not read as a declaration', () => {
  const text = [
    '## Task 1: name',
    '',
    '**Files:**',
    '- Modify: `lib/a.js`',
    '',
    '```markdown',
    '**Files:**',
    '- Modify: `path`',
    '- Test: `path`',
    '```',
    '',
  ].join('\n');
  const [t] = parseTasks(text);
  assert.deepEqual(t.modify, ['lib/a.js']);
  assert.deepEqual(t.test, []);
});

// A four-backtick fence nests a three-backtick example inside it; the inner
// backticks are content, not a closer, so nothing inside either is declared.
test('a shorter fence nested inside a longer one is not a closer', () => {
  const text = [
    '## Task 1: name',
    '',
    '**Files:**',
    '- Modify: `lib/a.js`',
    '',
    '````markdown',
    '**Files:**',
    '- Modify: `path`',
    '',
    '```markdown',
    '**Files:**',
    '- Modify: `path`',
    '- Test: `path`',
    '```',
    '',
    '````',
    '',
  ].join('\n');
  const [t] = parseTasks(text);
  assert.deepEqual(t.modify, ['lib/a.js']);
  assert.deepEqual(t.test, []);
});

// Document order, not task number — the build loop reads the file in this
// order, and that is a choice, not an accident of falling out of the loop.
test('groups follow document order, not task number', () => {
  const text = task(2, ['lib/b.js'], [], [], []) + task(1, ['lib/a.js'], [], [], []);
  assert.deepEqual(groups(text), [[2, 1]]);
});

// The fail-closed path exercised through the real parser, not a hand-built
// object: a **Files:** block with a Test entry and no Modify entry.
test('a parsed task with a Test entry but no Modify entry fails closed', () => {
  const text = [
    '## Task 1: name',
    '',
    '**Files:**',
    '- Test: `tests/a.test.js`',
    '',
  ].join('\n');
  const [a] = parseTasks(text);
  const [b] = parseTasks(task(2, ['lib/b.js'], [], [], []));
  assert.equal(conflict(a, b), 'undeclared');
});

// `groups` says which tasks may run at once, never how many to send at once.
// The ceiling of four dispatches in one response belongs to the loop, and a
// group of five sliced into four and one is still safe because the five
// conflict with none of each other. A cap added here would look like the same
// rule and quietly serialise the fifth task forever.
test('a group is not capped at the dispatch ceiling', () => {
  const text = [1, 2, 3, 4, 5].map((n) => task(n, ['lib/f' + n + '.js'], [], [], [])).join('');
  assert.deepEqual(groups(text), [[1, 2, 3, 4, 5]]);
});
