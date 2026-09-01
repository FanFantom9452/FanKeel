'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const todo = require('../scripts/todo-check.js');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'todo-check.js');

function fixture(body, extra) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-'));
  fs.writeFileSync(path.join(root, 'TODO.md'), body);
  for (const [name, text] of Object.entries(extra || {})) {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return path.join(root, 'TODO.md');
}

// The script exits non-zero on a problem, so a failing run has to be caught to be
// read. Its own output is what is being asserted, not the exit path.
function run(file) {
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, file], { encoding: 'utf8' }), code: 0 };
  } catch (e) {
    return { out: e.stdout, code: e.status };
  }
}

const kinds = (file, now) => todo.check(file, now).problems.map((p) => p.kind);

// Every `## Waiting` fixture below ends with this, because an entry there with
// no stamp is now a problem in its own right and would be reported by each of
// these tests instead of the one thing it is checking. Today's date rather than
// a literal, so none of them is ever also reported as due for a re-read.
const TODAY = (() => {
  const t = new Date();
  return String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
})();

// Every fixture below carries a heading, because an entry under none of the three
// is now a problem in its own right and would otherwise be reported by each of
// these tests instead of the one thing it is checking.
test('an index whose links all resolve passes', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- Publishing — see [the record](docs/why.md).\n', { 'docs/why.md': '# why\n' });
  const { out, code } = run(file);
  assert.equal(code, 0);
  assert.match(out, /1 entries — 1 ready, 0 needs a decision, 0 waiting/);
  assert.match(out, /All links resolve, no stale citations, none over the cap/);
});

test('a link to a file that no longer exists is a dead entry', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- Publishing — see [the plan](docs/plans/gone.md).\n');
  const { out, code } = run(file);
  assert.equal(code, 1);
  assert.match(out, /dead link/);
  assert.match(out, /docs\/plans\/gone\.md does not exist/);
});

test('the line number points at the entry, not at the file', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- fine\n- [gone](nope.md)\n');
  assert.equal(todo.check(file).problems[0].line, 6);
});

test('an entry longer than the cap is detail, not an index entry', () => {
  const long = 'x'.repeat(todo.MAX_ENTRY_CHARS + 1);
  const file = fixture('# TODO\n\n## Ready\n\n- ' + long + '\n');
  const { out, code } = run(file);
  assert.equal(code, 1);
  assert.match(out, /too long/);
  assert.match(out, new RegExp(todo.MAX_ENTRY_CHARS + 1 + ' characters'));
});

test('an entry exactly at the cap passes', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- ' + 'x'.repeat(todo.MAX_ENTRY_CHARS) + '\n');
  assert.deepEqual(kinds(file), []);
});

test('an indented continuation counts toward the entry it belongs to', () => {
  const half = 'x'.repeat(Math.ceil(todo.MAX_ENTRY_CHARS * 0.6));
  const file = fixture('# TODO\n\n## Ready\n\n- ' + half + '\n  ' + half + '\n');
  assert.deepEqual(kinds(file), ['too long']);
  assert.equal(todo.check(file).count, 1, 'the continuation is not a second entry');
});

test('an external link is not something this can check', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- see [upstream](https://example.com/x) and [mail](mailto:a@b.c)\n');
  assert.deepEqual(kinds(file), []);
});

test('a bare in-page anchor is not a file', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- see [below](#deferred)\n');
  assert.deepEqual(kinds(file), []);
});

test('a fragment on a real path is stripped before the file is checked', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- see [there](docs/why.md#the-heading)\n', { 'docs/why.md': '# why\n' });
  assert.deepEqual(kinds(file), []);
});

test('an entry with no link at all is allowed', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- a one-line thing with nowhere to point\n');
  assert.deepEqual(kinds(file), []);
});

test('headings and prose are not entries', () => {
  const file = fixture('# TODO\n\nAn index. Entries point at where the detail lives.\n\n## Ready\n\n- one\n');
  assert.equal(todo.check(file).count, 1);
});

test('no TODO.md is not a failure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-'));
  const { out, code } = run(path.join(root, 'TODO.md'));
  assert.equal(code, 0);
  assert.match(out, /Nothing to check/);
});

test('every problem in a file is reported, not just the first', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- [a](one.md)\n- [b](two.md)\n- ' + 'x'.repeat(todo.MAX_ENTRY_CHARS + 1) + '\n');
  assert.deepEqual(kinds(file), ['dead link', 'dead link', 'too long']);
});

test('linksIn keeps only in-repository targets', () => {
  assert.deepEqual(todo.linksIn('[a](docs/a.md) [b](https://x/y) [c](#z) [d](../up.md)'), ['docs/a.md', '../up.md']);
});

// The classification is by decision state, and the heading carries it. An entry
// filed nowhere is one nobody said the state of, which is exactly the entry
// `/fankeel` cannot decide whether to offer as a task.
test('an entry under a heading that is not one of the three is unclassified', () => {
  const file = fixture('# TODO\n\n## Someday\n\n- a thing\n');
  const { out, code } = run(file);
  assert.equal(code, 1);
  assert.match(out, /unclassified/);
  assert.match(out, /under "Someday"/);
});

test('an entry under no heading at all is unclassified', () => {
  const file = fixture('- a thing with no heading above it\n');
  assert.deepEqual(kinds(file), ['unclassified']);
  assert.match(todo.check(file).problems[0].detail, /under no heading/);
});

test('the entry names the three headings it could have sat under', () => {
  const file = fixture('# TODO\n\n## Someday\n\n- a thing\n');
  const detail = todo.check(file).problems[0].detail;
  for (const name of todo.SECTIONS) assert.match(detail, new RegExp('## ' + name));
});

test('all three headings are accepted', () => {
  const body = todo.SECTIONS.map((s) => '## ' + s + '\n\n- one under ' + s + ' ' + TODAY + '.\n').join('\n');
  const file = fixture('# TODO\n\n' + body);
  assert.deepEqual(kinds(file), []);
  assert.deepEqual(todo.check(file).counts, { Ready: 1, 'Needs a decision': 1, Waiting: 1 });
});

// The split is the reason to run this on a file with nothing wrong with it: a
// backlog of thirty is unreadable as one list, and the ready count is the number
// that says whether there is a task to start.
test('a clean run reports the count under each heading', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- a\n- b\n\n## Needs a decision\n\n- c\n\n## Waiting\n\n- d ' + TODAY + '.\n');
  const { out, code } = run(file);
  assert.equal(code, 0);
  assert.match(out, /4 entries — 2 ready, 1 needs a decision, 1 waiting/);
});

test('this project’s own TODO.md is an index', () => {
  const { out, code } = run(path.join(__dirname, '..', 'TODO.md'));
  assert.equal(code, 0, out);
});

const TREE = JSON.stringify({
  index: 'docs/README.md',
  buckets: [
    { path: 'docs', role: 'reference', depth: 1 },
    { path: 'docs/decisions', role: 'decision' },
    { path: 'docs/plans', role: 'plan' },
    { path: 'docs/reports', role: 'report' },
    { path: 'docs/archive', role: 'archive' },
  ],
});

// Two of the three entries this check was written for, in the words they drifted
// in. Both cited `## What is still a guess`, and the heading was still there — so
// verifying that a cited section exists would have reported neither. What had
// changed was the section's subject, and the role is the standing declaration
// that the page is an account of a decision and not a place an open question is
// tracked.
//
// The second bullet is the control and it is the third of those three entries.
// It cites a reference page, which is where a live question may live, and it has
// to come back clean: a rule that reports every citation is measuring "has a
// link", not the role.
test('an entry citing a decision record is a stale citation, one citing a reference page is not', () => {
  const file = fixture(
    '# TODO\n\n## Waiting\n\n'
      + '- Whether `audit` earns a place — [why](docs/decisions/shell.md), "What is still a guess". ' + TODAY + '.\n'
      + '- A per-`agent_type` subagent brief — [subagents](docs/subagents.md). ' + TODAY + '.\n',
    {
      '.fankeel/docs.json': TREE,
      'docs/decisions/shell.md': '# why\n\n## What is still a guess\n\nWhether `survey` earns its place.\n',
      'docs/subagents.md': '# subagents\n\n`agent_type` is the trap.\n',
    });
  const found = todo.check(file).problems;
  assert.deepEqual(found.map((p) => p.kind), ['stale citation'], 'the reference citation is clean');
  assert.equal(found[0].line, 5);
  assert.match(found[0].detail, /filed as decision/);
});

// The live one. A plan is archived or deleted at `land`, so an entry whose detail
// lives in one is a dead link with a date on it.
test('an entry citing a plan is a stale citation', () => {
  const file = fixture('# TODO\n\n## Waiting\n\n- Still silent — [design](docs/plans/session-id.md). ' + TODAY + '.\n',
    { '.fankeel/docs.json': TREE, 'docs/plans/session-id.md': '# plan\n' });
  const { out, code } = run(file);
  assert.equal(code, 1);
  assert.match(out, /stale citation/);
  assert.match(out, /filed as plan/);
});

// The reading this check deliberately does NOT do, pinned so it cannot drift
// back in. `roleOf` reads the bucket a path falls under and never the page's own
// frontmatter, so a decision record marked `status: current` with this morning's
// date is still reported — as this repository's own
// `docs/decisions/fankeel-shell.md` is. That is the check working. A
// scrupulously current account of a decision is still an account of a decision,
// and an entry whose detail lives in one points at history however fresh the
// history is.
test('a decision record marked current is still a stale citation', () => {
  const file = fixture('# TODO\n\n## Waiting\n\n- Whether it earns a place — [why](docs/decisions/shell.md). ' + TODAY + '.\n',
    {
      '.fankeel/docs.json': TREE,
      'docs/decisions/shell.md': '---\nstatus: current\nlast_verified: 2026-09-01\n---\n\n# why\n',
    });
  const found = todo.check(file).problems;
  assert.deepEqual(found.map((p) => p.kind), ['stale citation']);
  assert.match(found[0].detail, /records a moment rather than the present/);
});

// `STALE_ROLES` has four entries and two of them had no test at all: deleting
// `report` or `archive` from that list left the whole suite green. The `#anchor`
// is the third case here because it is the form the entries that motivated this
// check actually used — `fankeel-shell.md`, "What is still a guess" — and
// `linksIn` throws away everything after the `#`, so the role lookup has to
// survive that. The fourth bullet is the control: a reference page in the same
// run, which has to stay clean or the other three prove nothing.
test('archive and report are stale citations too, and an #anchor does not hide the role', () => {
  const file = fixture(
    '# TODO\n\n## Waiting\n\n'
      + '- retired — [a](docs/archive/old.md). ' + TODAY + '.\n'
      + '- a benchmark — [b](docs/reports/bench.md). ' + TODAY + '.\n'
      + '- anchored — [c](docs/decisions/shell.md#what-is-still-a-guess). ' + TODAY + '.\n'
      + '- a reference page — [d](docs/pipeline.md). ' + TODAY + '.\n',
    {
      '.fankeel/docs.json': TREE,
      'docs/archive/old.md': '# old\n',
      'docs/reports/bench.md': '# bench\n',
      'docs/decisions/shell.md': '# why\n\n## What is still a guess\n',
      'docs/pipeline.md': '# pipeline\n',
    });
  const found = todo.check(file).problems;
  assert.deepEqual(found.map((p) => p.line), [5, 6, 7], 'the reference page on line 8 stays clean');
  assert.match(found[0].detail, /filed as archive/);
  assert.match(found[1].detail, /filed as report/);
  assert.match(found[2].detail, /filed as decision/);
});

test('a link to code is never a stale citation', () => {
  const file = fixture('# TODO\n\n## Waiting\n\n- The gap — [lib](lib/registry.js), `readSession`. ' + TODAY + '.\n',
    { '.fankeel/docs.json': TREE, 'lib/registry.js': '// code\n' });
  assert.deepEqual(todo.check(file).problems, []);
});

// The role check is the only thing here that reads a docs tree, and this script
// had no dependency on one before it. A repository that never declared a tree
// gets the three checks it always had — not a crash, and not a finding on every
// link because the role came back null.
test('with no docs.json nothing is a stale citation', () => {
  const file = fixture('# TODO\n\n## Waiting\n\n- Still silent — [design](docs/plans/session-id.md). ' + TODAY + '.\n',
    { 'docs/plans/session-id.md': '# plan\n' });
  const { out, code } = run(file);
  assert.equal(code, 0, out);
});

// Every other script here takes `--root <dir>`, so this is the form a person
// reaches for and the form a gate gets written with. It used to take the flag's
// value as the file to read: `--root .` handed a directory to `check`, reading
// it threw EISDIR, `check` reported it missing, and missing counted as success.
// A green run that examined nothing.
test('--root names the directory holding TODO.md', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-root-'));
  fs.writeFileSync(path.join(dir, 'TODO.md'), '# TODO\n\n## Ready\n\n- [a](one.md)\n');
  const out = todo.main(['--root', dir]);
  assert.equal(out.ok, false, 'the dead link in that file is a problem');
  assert.match(out.text, /one\.md does not exist/);
});

test('--root=<dir> is the same flag', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-eq-'));
  fs.writeFileSync(path.join(dir, 'TODO.md'), '# TODO\n\n## Ready\n\n- [a](one.md)\n');
  assert.equal(todo.main(['--root=' + dir]).ok, false);
});

test('--root on a directory with no TODO.md names the file it looked for', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-bare-'));
  const out = todo.main(['--root', dir]);
  assert.match(out.text, /TODO\.md/, 'named the directory rather than the file');
  assert.equal(out.ok, true);
});

// A path is still a path. The flag's value is not one.
test('a positional argument is still the file to check', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-pos-'));
  const file = path.join(dir, 'OTHER.md');
  fs.writeFileSync(file, '# TODO\n\n## Ready\n\n- [a](one.md)\n');
  assert.equal(todo.main([file]).ok, false);
});

// The stamp, and the one thing it is for.
//
// `## Waiting` shrank four times in this repository's history — c50a5d5,
// a62863e, 811219c and 3fadc08 — and every one of the four was somebody
// re-reading the section and finding an entry misfiled. Not one entry ever left
// because the external thing it named had happened. So the number worth
// surfacing is not how old an entry is, it is how long since anyone last looked
// at it and agreed it is still waiting, and the stamp is that date.

const DAY = 24 * 60 * 60 * 1000;
// Local midday, so a stamp built from it cannot cross a day boundary under any
// timezone the suite runs in.
const NOW = new Date(2026, 8, 1, 12, 0, 0).getTime();
const stampFor = (daysAgo, from) => {
  const t = new Date((from === undefined ? NOW : from) - daysAgo * DAY);
  return String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
};
const waiting = (entry) => fixture('# TODO\n\n## Waiting\n\n- ' + entry + '\n');

test('a Waiting entry with no stamp is one nobody can age', () => {
  const file = waiting('Whether the pool ever overflows. None observed.');
  assert.deepEqual(kinds(file, NOW), ['undated']);
  assert.equal(todo.main([file]).ok, false);
});

test('a Ready or Needs a decision entry needs no stamp', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- a\n\n## Needs a decision\n\n- b\n');
  assert.deepEqual(kinds(file, NOW), []);
});

test('a Waiting entry nobody has confirmed for three weeks is due for a re-read', () => {
  const file = waiting('Whether the pool ever overflows. ' + stampFor(20) + '.');
  const result = todo.check(file, NOW);
  assert.deepEqual(result.problems, [], 'an old entry is not a defect');
  assert.equal(result.overdue.length, 1);
  assert.equal(result.overdue[0].days, 20);
});

// The control. Without it the test above passes just as well against a rule that
// reports every Waiting entry there is, which measures "has a stamp" rather than
// how long it has been since anyone read it.
test('a Waiting entry confirmed two days ago is not due', () => {
  const file = waiting('Whether the pool ever overflows. ' + stampFor(2) + '.');
  const result = todo.check(file, NOW);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.overdue, []);
});

test('an entry exactly at the threshold is due, one day under it is not', () => {
  const due = todo.check(waiting('a. ' + stampFor(todo.REREAD_DAYS) + '.'), NOW);
  const under = todo.check(waiting('a. ' + stampFor(todo.REREAD_DAYS - 1) + '.'), NOW);
  assert.equal(due.overdue.length, 1);
  assert.deepEqual(under.overdue, []);
});

// The stamp carries no year, because a year is noise 364 days out of 365 in a
// file written by hand. So the year is inferred, and the only inference that is
// ever wrong is the one that puts the stamp in the future: read on 5 January, a
// `12-15` is three weeks ago and not eleven months away.
test('a stamp from last December is read as last December, not as next', () => {
  const jan = new Date(2027, 0, 5, 12, 0, 0).getTime();
  const result = todo.check(waiting('a. 12-15.'), jan);
  assert.equal(result.overdue.length, 1);
  assert.equal(result.overdue[0].days, 21);
});

// The guard that decides a stamp is not a date at all, and the one case where
// those two things are not the same. `02-29` is not a date in 2025 and is the
// right answer in 2024 — the year the entry was actually stamped — so a guard
// that gives up on the first candidate reads a real stamp as a missing one and
// fails the run on it.
test('a leap day is a date in the year it was a date in', () => {
  const jan = new Date(2025, 0, 5, 12, 0, 0).getTime();
  const result = todo.check(waiting('a. 02-29.'), jan);
  assert.deepEqual(result.problems, [], 'a valid leap-day stamp is not a missing stamp');
  assert.equal(result.overdue.length, 1);
});

test('a day no month ever had is not a date in any year', () => {
  const jan = new Date(2025, 0, 5, 12, 0, 0).getTime();
  assert.deepEqual(kinds(waiting('a. 02-31.'), jan), ['undated']);
});

test('a month or day out of range is not a stamp', () => {
  assert.deepEqual(kinds(waiting('a. 13-05.'), NOW), ['undated']);
  assert.deepEqual(kinds(waiting('a. 00-05.'), NOW), ['undated']);
  assert.deepEqual(kinds(waiting('a. 06-00.'), NOW), ['undated']);
});

test('the re-read list is reported and does not fail the run', () => {
  const file = waiting('Whether the pool ever overflows. ' + stampFor(20) + '.');
  const { text, ok } = todo.main([file], NOW);
  assert.equal(ok, true, 'an entry due for a re-read is not a problem');
  assert.match(text, /due for a re-read/);
  assert.match(text, /20 days/);
});
