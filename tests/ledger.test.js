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
