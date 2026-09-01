'use strict';

// Conversation memory does not survive compaction and a controller that lost its
// place re-dispatches work that is already committed. The ledger is the recovery
// map: its first line names its own plan, so a ledger belonging to a different
// plan is left alone rather than resumed from.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ledger = require('../lib/ledger.js');

const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-ledger-'));

// `scripts/ledger.js` carries the same refusal as `scripts/task.js` -- a flag
// declared to take a value, given none, is named rather than defaulted. Only
// task.js's copy was ever exercised, so the mechanism was covered in one of the
// two files that rely on it and this is the other.
const SCRIPT = path.join(__dirname, '..', 'scripts', 'ledger.js');

for (const flag of ['--root', '--plan']) {
  // The flag stands alone rather than after a verb: flags precede the verb here,
  // so a token after one is the user's words and no longer reaches the parser.
  // The branch is the same one either way — this is where it is still reachable.
  test('scripts/ledger.js refuses ' + flag + ' with no value by name', () => {
    let out = '';
    let code = 0;
    try {
      execFileSync(process.execPath, [SCRIPT, flag], { encoding: 'utf8' });
    } catch (e) {
      out = String(e.stdout || '');
      code = e.status;
    }
    assert.equal(code, 1, flag + ' with no value should exit 1');
    assert.match(out, new RegExp(flag + ' needs a value\\.'));
  });
}

test('a ledger lives beside the plan it belongs to, named for it', () => {
  const p = ledger.ledgerPath('/w', 'docs/plans/2026-08-22-thing.md');
  assert.match(p.replace(/\\/g, '/'), /\.fankeel\/build\/2026-08-22-thing\/progress\.md$/);
});

test('a ledger naming another plan is not yours to resume from', () => {
  const mine = ledger.header('docs/plans/a.md');
  assert.equal(ledger.owns(mine, 'docs/plans/a.md'), true);
  assert.equal(ledger.owns(mine, 'docs/plans/b.md'), false);
  assert.equal(ledger.owns('', 'docs/plans/a.md'), false);
});

test('completed tasks are read back so none is dispatched twice', () => {
  const text = [
    ledger.header('docs/plans/a.md'),
    ledger.completionLine(1, 'lib/map.js, 7 tests'),
    ledger.completionLine(3, 'skills'),
  ].join('\n');
  assert.deepEqual(ledger.completed(text), [1, 3]);
});

test('a task mid-loop is not counted as complete', () => {
  const text = [ledger.header('docs/plans/a.md'), 'Task 2: fix round 1'].join('\n');
  assert.deepEqual(ledger.completed(text), []);
});

test('a ruling records what it costs if it is wrong, or it is not a ruling', () => {
  const line = ledger.rulingLine('use the existing helper', 'two extractors would be two answers', 'a second rewrite');
  assert.match(line, /^Ruling: /);
  assert.match(line, /costs if wrong: a second rewrite/);
});

test('init writes the header once and never truncates an existing ledger', () => {
  const dir = root();
  const p = ledger.init(dir, 'docs/plans/a.md');
  fs.appendFileSync(p, ledger.completionLine(1, 'done') + '\n');
  ledger.init(dir, 'docs/plans/a.md');
  assert.deepEqual(ledger.completed(fs.readFileSync(p, 'utf8')), [1]);
});

test('a ledger left behind by another plan is replaced, not merged', () => {
  const dir = root();
  const p = ledger.ledgerPath(dir, 'docs/plans/a.md');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  // Same basename, different plan — the one case where reusing the file would
  // silently skip tasks that were never run.
  fs.writeFileSync(p, ledger.header('elsewhere/a.md') + '\n' + ledger.completionLine(9, 'not ours') + '\n');
  ledger.init(dir, 'docs/plans/a.md');
  assert.deepEqual(ledger.completed(fs.readFileSync(p, 'utf8')), []);
});

// The two verbs whose positional is the user's own words. A token with a leading
// dash was filed under a flag named for itself, so what reached the ledger was
// the sentence with a piece missing — and with three parts still standing, no
// refusal to say so. `--plan` here is deliberately where every documented call
// puts it: ahead of the verb.
for (const [name, argv, expected] of [
  [
    'complete keeps a dashed word in the middle of its note',
    ['complete', '1', 'fixed', '--force', 'handling'],
    /^Task 1: complete — fixed --force handling$/m,
  ],
  [
    'ruling keeps a dashed word among its three parts',
    ['ruling', 'a', 'b', '--c', 'd'],
    /^Ruling: a — b — costs if wrong: --c d$/m,
  ],
  // The dashed word is now a flag this script's own table knows, which is the
  // case the filter could never reach: `parseArgs` had consumed it first.
  [
    'complete keeps a word that begins with a flag the table knows',
    ['complete', '1', '--plan=elsewhere.md', 'is not the flag it looks like'],
    /^Task 1: complete — --plan=elsewhere\.md is not the flag it looks like$/m,
  ],
  [
    'ruling keeps a part that begins with a flag the table knows',
    ['ruling', 'we ruled', '--plan=x.md', 'because', 'it costs a rewrite'],
    /^Ruling: we ruled — --plan=x\.md — costs if wrong: because it costs a rewrite$/m,
  ],
]) {
  test(name, () => {
    const dir = root();
    execFileSync(process.execPath, [SCRIPT, '--plan', 'plan.md', ...argv], { cwd: dir, encoding: 'utf8' });
    assert.match(fs.readFileSync(ledger.ledgerPath(dir, 'plan.md'), 'utf8'), expected);
  });
}

// Keeping the word and writing to the right ledger are two failures, and the
// second is the silent one: a redirected write reports success, so the build
// loop is told a task is complete that its own ledger will not list.
test('a note beginning --plan= writes no second ledger', () => {
  const dir = root();
  execFileSync(
    process.execPath,
    [SCRIPT, '--plan', 'plan.md', 'complete', '1', '--plan=elsewhere.md', 'is not the flag it looks like'],
    { cwd: dir, encoding: 'utf8' },
  );
  assert.deepEqual(fs.readdirSync(path.join(dir, '.fankeel', 'build')), ['plan']);
});

test('a note beginning --root= does not move the tree', () => {
  const dir = root();
  execFileSync(
    process.execPath,
    [SCRIPT, '--plan', 'plan.md', 'complete', '2', '--root=elsewhere', 'matters too'],
    { cwd: dir, encoding: 'utf8' },
  );
  assert.equal(fs.existsSync(path.join(dir, 'elsewhere')), false, 'the write escaped the root it was given');
  assert.match(
    fs.readFileSync(ledger.ledgerPath(dir, 'plan.md'), 'utf8'),
    /^Task 2: complete — --root=elsewhere matters too$/m,
  );
});

// The same shapelessness one token earlier. `--plan` is required, so `ledger.js
// init` alone is refused -- and the shortest way to answer that refusal is
// `--plan init`, which handed the verb to the flag: a ledger at
// `.fankeel/build/init/`, and `Task 1 complete.` on a ledger the build loop
// would never read again. Both halves are asserted, because the refusal without
// the empty tree would pass on a script that refused after writing.
for (const verb of ['init', 'complete', 'ruling', 'show']) {
  test('--plan ' + verb + ' is refused rather than filed as a plan named ' + verb, () => {
    const dir = root();
    let out = '';
    let code = 0;
    try {
      execFileSync(process.execPath, [SCRIPT, '--plan', verb, 'complete', '1', 'note'], { cwd: dir, encoding: 'utf8' });
    } catch (e) {
      out = String(e.stdout || '');
      code = e.status;
    }
    assert.equal(code, 1, '--plan ' + verb + ' should exit 1');
    assert.match(out, /--plan needs a value\./);
    assert.equal(fs.existsSync(path.join(dir, '.fankeel', 'build', verb)), false, 'a ledger was written under the verb');
  });
}

// The escape hatch, and the reason the refusal above can be this blunt: `=`
// spends no token, so there is nothing for the verb set to withhold.
test('--plan=init still means a plan called init', () => {
  const dir = root();
  execFileSync(process.execPath, [SCRIPT, '--plan=init', 'init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(fs.existsSync(ledger.ledgerPath(dir, 'init')), true, 'the = form no longer reaches the plan');
});

// A plan file may legitimately be named for a verb; only the bare word is one.
test('--plan init.md is a path, not the verb it begins with', () => {
  const dir = root();
  execFileSync(process.execPath, [SCRIPT, '--plan', 'init.md', 'init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(fs.existsSync(ledger.ledgerPath(dir, 'init.md')), true);
});

// The verb exists so the loop does not have to hold the predicates in its head.
// Exercised through the script rather than the library because the printed
// shape is what the loop reads.
test('groups reports the parallelisable sets of a plan', () => {
  const dir = root();
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, [
    '## Task 1: one', '', '**Files:**', '- Modify: `lib/a.js`', '',
    '## Task 2: two', '', '**Files:**', '- Modify: `lib/b.js`', '',
  ].join('\n'));
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'groups'], { encoding: 'utf8' });
  assert.match(out, /1 groups over 2 tasks/);
  assert.match(out, /1: 1, 2/);
  // The control for the two tests below. They assert this sentence is gone when
  // no group holds a pair, which says nothing unless it is still here when one
  // does — a deleted sentence passes those assertions just as well.
  assert.match(out, /files are disjoint/);
  assert.doesNotMatch(out, /builds serially/);
});

// A task with no Files block conflicts with everything, so it lands alone and
// the grouping reads as merely unlucky rather than as a plan that never said
// what the task owns. Naming it is what makes the difference visible before the
// dispatch rather than after it.
test('groups names the tasks that declared no files', () => {
  const dir = root();
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, [
    '## Task 1: one', '', '**Files:**', '- Modify: `lib/a.js`', '',
    '## Task 2: two', '', '**Files:**', '- Test: `tests/b.test.js`', '',
  ].join('\n'));
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'groups'], { encoding: 'utf8' });
  assert.match(out, /No Files block, so serialised against everything: 2/);
});

// The rows said three singletons, the paragraph under them said the files were
// disjoint and nothing consumed anything, and the paragraph won: a plan whose
// tasks all appended to one index file built serially with nothing saying so.
// The sentence is about a pair, so it goes when there is no pair.
test('groups warns when nothing can run beside anything, and names the shared file', () => {
  const dir = root();
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, [
    '## Task 1: one', '', '**Files:**', '- Modify: `TODO.md`', '',
    '## Task 2: two', '', '**Files:**', '- Modify: `TODO.md`', '',
    '## Task 3: three', '', '**Files:**', '- Modify: `TODO.md`', '',
  ].join('\n'));
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'groups'], { encoding: 'utf8' });
  assert.match(out, /3 groups over 3 tasks/);
  assert.match(out, /nothing runs beside anything/);
  assert.match(out, /Shared by consecutive tasks: TODO\.md/);
  assert.doesNotMatch(out, /files are disjoint/);
});

// Every `Modify` list here is disjoint and the plan still serialises, so there
// is no shared file to name. This is the row that counting the file the most
// tasks share would get wrong — it would report no cause at all, or send the
// reader to rewrite a `**Files:**` block that was already correct.
test('groups names a Consumes/Produces chain as the cause when no file is shared', () => {
  const dir = root();
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, [
    '## Task 1: one', '', '**Files:**', '- Modify: `lib/a.js`', '',
    '**Interfaces:**', '- Produces: `parseThing`', '',
    '## Task 2: two', '', '**Files:**', '- Modify: `lib/b.js`', '',
    '**Interfaces:**', '- Consumes: `parseThing`', '',
  ].join('\n'));
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'groups'], { encoding: 'utf8' });
  assert.match(out, /2 groups over 2 tasks/);
  assert.match(out, /Consumes\/Produces edge joins each pair/);
  assert.doesNotMatch(out, /Shared by consecutive tasks/);
});

// One task is one group, which satisfies the condition arithmetically and is
// not the finding — a plan with nothing to parallelise against is not a plan
// that failed to parallelise. Warning here is how the warning becomes noise.
test('groups does not warn about a one-task plan', () => {
  const dir = root();
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, ['## Task 1: one', '', '**Files:**', '- Modify: `lib/a.js`', ''].join('\n'));
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'groups'], { encoding: 'utf8' });
  assert.match(out, /1 groups over 1 tasks/);
  assert.doesNotMatch(out, /builds serially/);
});

// The range is what lets `verify` send one verifier per task, each pinned at
// both ends. It sits between `complete` and the em dash because the note is
// free text and may hold an em dash of its own -- a suffix would need the last
// occurrence of a delimiter the note can also produce.
test('a completion line carries its review range and parses back', () => {
  const line = ledger.completionLine(3, 'the verb landed', 'a1b2c3d..e4f5a6b');
  assert.equal(line, 'Task 3: complete [a1b2c3d..e4f5a6b] — the verb landed');
  assert.deepEqual(ledger.completions(line), [{ n: 3, range: 'a1b2c3d..e4f5a6b' }]);
});

// The control, and it sits inside the change rather than beside it: eleven
// ledgers under .fankeel/build/ were written before this field existed, and a
// parser that only reads the new shape silently loses every one of them.
test('a completion line written before ranges existed still parses', () => {
  const old = 'Task 2: complete — landed before this field existed';
  assert.deepEqual(ledger.completions(old), [{ n: 2, range: null }]);
  assert.deepEqual(ledger.completed(old), [2]);
});

test('the range is absent from the line when none is given', () => {
  assert.equal(ledger.completionLine(1, 'no range'), 'Task 1: complete — no range');
});
