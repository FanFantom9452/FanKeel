'use strict';

// Two implementers in one checkout is the failure this file's subject prevents,
// and only half of it is about filenames. The shared-cause row below is the one
// a partition by path gets wrong.

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseTasks, conflict, groups } = require('../lib/plantasks.js');
const plantasks = require('../lib/plantasks.js');

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

// Both tasks here declare empty interfaces, which is what makes this the pin on
// `conflict()` failing open on them. Make interfaces fail closed the way files
// do and this is the test that goes red.
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

// An `Interfaces:` entry has no em-dash prose to guard against — it is a
// plain list — so it takes every backticked token on the line, unlike the
// `Files:` case pinned below.
test('an Interfaces entry takes every backticked token, not just the first', () => {
  const text = [
    '## Task 1: name',
    '',
    '**Interfaces:**',
    '- Consumes: nothing.',
    '- Produces: `makeA`, `makeB`',
    '',
  ].join('\n');
  const [t] = parseTasks(text);
  assert.deepEqual(t.produces, ['makeA', 'makeB']);
});

// The name a first-backtick-only read would have dropped: `makeB` is the
// second token on the `Produces:` line, and only taking every token catches
// the edge it forms with a consumer that names it.
test('a producer/consumer edge on the second name serialises the pair', () => {
  const [a, b] = parseTasks(task(1, ['lib/a.js'], [], [], ['makeA', 'makeB']) + task(2, ['lib/b.js'], [], ['makeB'], []));
  assert.equal(conflict(a, b), 'interface');
});

test('consumesText holds the raw text of each Consumes entry', () => {
  const text = [
    '## Task 1: name',
    '',
    '**Interfaces:**',
    '- Consumes: `makeA`, `makeB`',
    '- Produces: nothing.',
    '',
  ].join('\n');
  const [t] = parseTasks(text);
  assert.deepEqual(t.consumesText, ['`makeA`, `makeB`']);
});

// A description after the em dash can itself hold backticked words; only the
// first backtick on the line is the declared path, or the description leaks
// into the file list. `Interfaces:` entries take every token instead — see
// the case above — because they have no such prose to guard against.
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

// Two questions about one plan should cost one parse. The command line needs
// the tasks for the count and for which of them declared nothing, and handing
// `groups` the text again made it read the same file a second time to answer
// the third.
test('groups takes tasks already parsed as readily as text', () => {
  const text = task(1, ['lib/a.js'], [], [], []) + task(2, ['lib/b.js'], [], [], []);
  assert.deepEqual(groups(parseTasks(text)), groups(text));
});

const plan = (...tasks) => tasks.join('\n\n');
const taskBlock = (n, files, iface) => '## Task ' + n + ': t' + n + '\n\n'
    + '**Files:**\n' + files.map((f) => '- Modify: `' + f + '`').join('\n') + '\n\n'
    + '**Interfaces:**\n' + (iface || '- Consumes: nothing.\n- Produces: nothing.');

test('a lone group is one dispatch', () => {
    const out = plantasks.surfaces(plan(taskBlock(1, ['a.js'])));
    assert.deepStrictEqual(out, [{ tasks: [1], surface: 'agent' }]);
});

test('a pair is two dispatches in one response', () => {
    const out = plantasks.surfaces(plan(taskBlock(1, ['a.js']), taskBlock(2, ['b.js'])));
    assert.deepStrictEqual(out, [{ tasks: [1, 2], surface: 'agents' }]);
});

test('three independent tasks are one workflow', () => {
    const out = plantasks.surfaces(plan(taskBlock(1, ['a.js']), taskBlock(2, ['b.js']), taskBlock(3, ['c.js'])));
    assert.deepStrictEqual(out, [{ tasks: [1, 2, 3], surface: 'workflow' }]);
});

// `conflict()` matches only a backticked identifier, so a dependency written as
// prose leaves the pair looking independent. Two Agents are still safe — the
// parent reads both returns — but a Workflow does not come back between its
// steps, so an unrefuted group is not a group to spend one on.
test('a prose Consumes degrades a workflow group to agents', () => {
    const out = plantasks.surfaces(plan(
        taskBlock(1, ['a.js']),
        taskBlock(2, ['b.js'], '- Consumes: the flag name from Task 1.\n- Produces: nothing.'),
        taskBlock(3, ['c.js'])));
    assert.deepStrictEqual(out, [{ tasks: [1, 2, 3], surface: 'agents' }]);
});

test('a task with no Files block degrades its group', () => {
    const three = plan(taskBlock(1, ['a.js']), taskBlock(2, ['b.js']), taskBlock(3, ['c.js']));
    const parsed = plantasks.parseTasks(three);
    parsed[1].modify = [];
    const out = plantasks.surfaces(parsed);
    assert.strictEqual(out.some((g) => g.surface === 'workflow'), false);
});
