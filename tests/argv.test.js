'use strict';

// `node:util` reads any token with a leading dash as a flag however the shell
// quoted it, so the commands whose positional is the user's own words never saw
// text that began with one. Two copies of a parser this subtle would be two
// answers to one question, so both live here and the table they read travels in.
//
// The two answer it at different depths. A filter run after the parser is enough
// for a dash the table does not know, and useless against one it *does* know: by
// then `parseArgs` has consumed the token and acted on it. `splitAtVerb` runs
// first instead and hands the parser only what precedes the verb, which is what
// `scripts/ledger.js` needs, because both of its flags are paths and a redirected
// write is silent. `splitAroundVerb` does it from both ends, because
// `scripts/task.js` puts its flags after the verb and after the words.

const test = require('node:test');
const assert = require('node:assert/strict');

const { splitAtVerb, splitAroundVerb } = require('../lib/argv.js');

// The caller's own table: the flag as typed against the key it lands on. Only
// the names are ever read, never the keys, but the table is passed whole so
// there is no second list anywhere to keep in step.
const FLAGS = { session: 'session', root: 'root', task: 'task' };

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

// The third depth, and the one `scripts/task.js` needs. Its shape is not
// ledger's: flags come *after* the verb and after the words, in every documented
// call, in both commands printed for a person to copy, and in 103 test calls. So
// the user's words are not "everything after the verb" — they are what sits
// between the flags at either end.
const CMDS = new Set(['start', 'note', 'next', 'down', 'stage', 'clear']);

test('the flags after the words are the head, and what sits between is the text', () => {
  assert.deepEqual(splitAroundVerb(['note', 'a note', '--session', 'S'], FLAGS, CMDS), {
    head: ['--session', 'S'],
    verb: 'note',
    text: ['a note'],
  });
});

test('a word in the text spelled exactly like a known flag is kept', () => {
  // The whole point. `parseArgs` would have consumed it and redirected the
  // lookup; peeling from the right never offers it the token at all.
  assert.deepEqual(splitAroundVerb(['note', '--root=x', 'rest', '--session', 'S'], FLAGS, CMDS), {
    head: ['--session', 'S'],
    verb: 'note',
    text: ['--root=x', 'rest'],
  });
});

test('a flag left without a value stays last in the head, so the refusal still fires', () => {
  // node:util hands a string flag whatever token follows it, `--session`
  // included. The trailing flags go in front for that reason alone.
  assert.deepEqual(splitAroundVerb(['--root', 'down', '--session', 'S'], FLAGS, CMDS), {
    head: ['--session', 'S', '--root'],
    verb: 'down',
    text: [],
  });
});

test('a flag the table does not know is peeled on its own, spending nothing', () => {
  // `clear <id> --force --session <id>` is printed by lib/guard.js for a person
  // to copy. `--force` is boolean and not in the table; the id is still the text.
  assert.deepEqual(splitAroundVerb(['clear', 'bbbb', '--force', '--session', 'S'], FLAGS, CMDS), {
    head: ['--force', '--session', 'S'],
    verb: 'clear',
    text: ['bbbb'],
  });
});

test('the same unknown flag is a word when it sits where the words begin', () => {
  // tests/task.test.js records `--force` as a note. It and the `clear` call above
  // are one argv shape apart from this: nothing about the token tells them
  // apart, only where it sits.
  assert.deepEqual(splitAroundVerb(['note', '--force', '--session', 'S'], FLAGS, CMDS), {
    head: ['--session', 'S'],
    verb: 'note',
    text: ['--force'],
  });
});

test('a known flag in the = form is peeled alone, even at the very end', () => {
  assert.deepEqual(splitAroundVerb(['note', 'a note', '--root=w', '--session', 'S'], FLAGS, CMDS), {
    head: ['--root=w', '--session', 'S'],
    verb: 'note',
    text: ['a note'],
  });
});

test('a verb with no words at all has empty text', () => {
  // `next --session <id>` clears next. Read as text the flag would set it.
  assert.deepEqual(splitAroundVerb(['next', '--session', 'S'], FLAGS, CMDS), {
    head: ['--session', 'S'],
    verb: 'next',
    text: [],
  });
});

test('flags on both sides at once, and the words still come out whole', () => {
  assert.deepEqual(splitAroundVerb(['--root', 'w', 'stage', 'build', '--session', 'S'], FLAGS, CMDS), {
    head: ['--session', 'S', '--root', 'w'],
    verb: 'stage',
    text: ['build'],
  });
});

test('no flag spends a verb from the left either', () => {
  assert.deepEqual(splitAroundVerb(['--root', 'stage', 'build', '--session', 'S'], FLAGS, CMDS).head,
    ['--session', 'S', '--root']);
});

test('an argv that is all flags has no verb, and says so', () => {
  assert.deepEqual(splitAroundVerb(['--session', 'S'], FLAGS, CMDS), {
    head: ['--session', 'S'],
    verb: undefined,
    text: [],
  });
});

test('a known flag left with nothing after it is peeled, so the parser can refuse it', () => {
  // `runRaw` in tests/task.test.js passes exactly this shape three times over.
  // Stopping in front of the dangling flag would hand every earlier flag to the
  // text, and the refusal would name --session instead of the flag at fault.
  assert.deepEqual(splitAroundVerb(['start', '--session', 'S', '--root', 'w', '--task'], FLAGS, CMDS), {
    head: ['--session', 'S', '--root', 'w', '--task'],
    verb: 'start',
    text: [],
  });
});

test('a flag left without a value goes last however early it sat', () => {
  // Peeling `--session S` as a pair leaves `--task` stranded in the middle,
  // where node:util hands it `--session` as its value and nothing is refused.
  // The old whole-argv parser had the same hole; this is where it closes.
  assert.deepEqual(splitAroundVerb(['start', '--task', '--session', 'S'], FLAGS, CMDS), {
    head: ['--session', 'S', '--task'],
    verb: 'start',
    text: [],
  });
});
