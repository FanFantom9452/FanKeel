'use strict';

// `node:util` reads any token with a leading dash as a flag however the shell
// quoted it, so the commands whose positional is the user's own words never saw
// text that began with one. `scripts/task.js` grew the filter first and
// `scripts/ledger.js` has the same hole under `complete` and `ruling` — two
// copies of a parser this subtle would be two answers to one question, so it
// lives here and the table it reads travels in.

const test = require('node:test');
const assert = require('node:assert/strict');

const { freeText } = require('../lib/argv.js');

// The caller's own table: the flag as typed against the key it lands on.
// `freeText` reads the names and never the keys, but it is passed whole so
// there is no second list anywhere to keep in step.
const FLAGS = { session: 'session', root: 'root', task: 'task' };

test('a sentence beginning with a dash is text, not a flag', () => {
  const argv = ['note', '--force is not the flag it looks like'];
  assert.deepEqual(freeText(argv, 'note', FLAGS), ['--force is not the flag it looks like']);
});

test('a flag the table knows is removed with the argument it spends', () => {
  const argv = ['note', 'the note', '--session', 'abc'];
  assert.deepEqual(freeText(argv, 'note', FLAGS), ['the note']);
});

test('--flag=value spends no second argument', () => {
  const argv = ['note', 'before', '--session=abc', 'after'];
  assert.deepEqual(freeText(argv, 'note', FLAGS), ['before', 'after']);
});

test('a flag the table does not know stays text', () => {
  const argv = ['note', '--force', 'and the rest'];
  assert.deepEqual(freeText(argv, 'note', FLAGS), ['--force', 'and the rest']);
});

test('a short flag is text, because the table holds only long ones', () => {
  const argv = ['note', '-x', 'short flags too'];
  assert.deepEqual(freeText(argv, 'note', FLAGS), ['-x', 'short flags too']);
});

test('what came before the command name is not the text', () => {
  const argv = ['--root', 'w', 'note', 'the note'];
  assert.deepEqual(freeText(argv, 'note', FLAGS), ['the note']);
});

test('a command that is not there has no text', () => {
  assert.deepEqual(freeText(['show'], 'note', FLAGS), []);
});
