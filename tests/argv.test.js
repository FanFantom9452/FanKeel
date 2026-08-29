'use strict';

// `node:util` reads any token with a leading dash as a flag however the shell
// quoted it, so the commands whose positional is the user's own words never saw
// text that began with one. Two copies of a parser this subtle would be two
// answers to one question, so both live here and the table they read travels in.
//
// The two answer it at different depths. `freeText` filters an argv the parser
// has already read, which is enough for a dash the table does not know —
// `scripts/task.js` uses it. It cannot help against a dash the table *does*
// know: by then `parseArgs` has consumed the token and acted on it. `splitAtVerb`
// runs first instead and hands the parser only what precedes the verb, which is
// what `scripts/ledger.js` needs, because both of its flags are paths and a
// redirected write is silent.

const test = require('node:test');
const assert = require('node:assert/strict');

const { freeText, splitAtVerb } = require('../lib/argv.js');

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

// `splitAtVerb`. Everything from the verb on is the user's words, so a word that
// is spelled exactly like a flag stays a word — the case no filter can win,
// because the parser would otherwise have acted on it before the filter ran.

test('the flags before the verb are the head, the rest is text', () => {
  const argv = ['--root', 'w', 'complete', '1', 'what landed'];
  assert.deepEqual(splitAtVerb(argv, FLAGS), {
    head: ['--root', 'w'],
    verb: 'complete',
    text: ['1', 'what landed'],
  });
});

test('--flag=value in the head spends no second argument', () => {
  const argv = ['--root=w', 'complete', '1', 'what landed'];
  assert.deepEqual(splitAtVerb(argv, FLAGS), {
    head: ['--root=w'],
    verb: 'complete',
    text: ['1', 'what landed'],
  });
});

test('a word after the verb that names a known flag is still text', () => {
  const argv = ['--root', 'w', 'complete', '1', '--root=elsewhere', 'matters'];
  assert.deepEqual(splitAtVerb(argv, FLAGS).text, ['1', '--root=elsewhere', 'matters']);
});

test('the verb is the first token that is not a flag or a flag value', () => {
  assert.equal(splitAtVerb(['--session', 'abc', '--root', 'w', 'note', 'hi'], FLAGS).verb, 'note');
});

test('an argv with no verb is all head, and says so', () => {
  assert.deepEqual(splitAtVerb(['--root'], FLAGS), { head: ['--root'], verb: undefined, text: [] });
});

test('a flag the table does not know spends nothing, so the verb is still found', () => {
  // Nothing declares `--force` to take a value, so consuming the next token
  // would swallow the verb and leave the command looking like a bare `show`.
  assert.deepEqual(splitAtVerb(['--force', 'show'], FLAGS), { head: ['--force'], verb: 'show', text: [] });
});

// The verb set. A flag whose value has no shape takes whatever follows it, and
// what followed was the verb: `--plan init complete 1 note` filed `init` as the
// plan and wrote a ledger under it. A verb is never a value, so the flag is left
// in the head with nothing after it, where the caller's own refusal waits.
const VERBS = new Set(['init', 'complete', 'ruling', 'show']);

test('a flag does not spend a token that is a verb', () => {
  assert.deepEqual(splitAtVerb(['--root', 'init', 'complete', '1', 'note'], FLAGS, VERBS), {
    head: ['--root'],
    verb: 'init',
    text: ['complete', '1', 'note'],
  });
});

test('the = form still means a value spelled like a verb', () => {
  // It spends no token to say so, so there is nothing for the verb set to stop.
  assert.deepEqual(splitAtVerb(['--root=init', 'show'], FLAGS, VERBS), {
    head: ['--root=init'],
    verb: 'show',
    text: [],
  });
});

test('a value that merely begins with a verb is still a value', () => {
  assert.deepEqual(splitAtVerb(['--root', 'init.md', 'show'], FLAGS, VERBS).head, ['--root', 'init.md']);
});

test('the verb is matched however it is cased, as the caller matches it', () => {
  assert.equal(splitAtVerb(['--root', 'INIT'], FLAGS, VERBS).verb, 'INIT');
});

test('with no verb set every flag spends its next token, exactly as before', () => {
  assert.deepEqual(splitAtVerb(['--root', 'init', 'complete'], FLAGS), {
    head: ['--root', 'init'],
    verb: 'complete',
    text: [],
  });
});
