---
status: current
date: 2026-09-29
task: TODO 改成一筆一檔的任務系統：TODO.md 由單筆檔產生，station 看得到完成條目與其 session
---

# TODO as One File per Entry Implementation Plan

**Goal:** every TODO entry becomes a file under `docs/90-agent/todo/`, `TODO.md` is generated from those files, a closed entry stays as `state: done` with its commit and session, and the station's project page lists a project's open and done entries.
**Architecture:** a new `lib/todo.js` holds the entry-file format, the index renderer, the writers (`add`, `close`, `migrate`) and `load()`, the one two-mode reader — the folder when `.fankeel/docs.json` declares a `todo` bucket that exists, `TODO.md` otherwise — returning the shapes `entries()` and `timings()` already return. The text readers move from `scripts/todo-check.js` into `lib/todo.js` unchanged, because nothing in `lib/` may require `scripts/` and the station needs them; todo-check keeps the rules and adds the frontmatter ones. `scripts/todo.js` is the thin CLI; `task.js start --todo` links a session to entries, and `stage land` prints the `todo.js done` lines.
**Tech Stack:** Node v24.9.0 (this machine), CommonJS, `node --test`, no dependencies; `assets/station/station.js` is ES5 (`var`, `function`) run in the browser.
**Spec:** [2026-09-29-todo-files-design.md](2026-09-29-todo-files-design.md)

Mockup, approved as 方向 on 2026-09-29: `.fankeel/build/2026-09-29-todo-files/mockup.html`, blocks `todo-head`, `todo-open`, `todo-done`, built by `.fankeel/build/2026-09-29-todo-files/build-mockup.js`. Task 7 reproduces those three blocks in `projectPage()`; build's render reviewer holds it to them.

## Global Constraints

From `node scripts/map.js` (`.fankeel/map.md`, regenerated 2026-09-29), `CONTRIBUTING.md`, `package.json`, `.gitattributes` and the test suite:

- There is no `CLAUDE.md` and no `AGENTS.md`; `CONTRIBUTING.md` is where the conventions are written (`CONTRIBUTING.md:3-4`).
- `lib/*.js`: "Pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction." (`CONTRIBUTING.md:15`; map.md: "lib/ the logic, as functions tested directly; nothing here reaches into scripts/ or hooks/").
- `scripts/*.js`: "Thin wrappers over `lib/`." (`CONTRIBUTING.md:16`).
- `package.json`: `"name": "fankeel"`, `"version": "0.82.1"`, `"private": true`, `"test": "node --test"`, no `dependencies` key; CONTRIBUTING's maintenance rule: "no new dependency".
- `.gitattributes`: `* text=auto eol=lf` — every committed text file is LF; compare file text with `\r\n` normalised to `\n`.
- Tests: "`node --test`. Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it." (`CONTRIBUTING.md:19`; the test is `tests/source.test.js:117`, and a test file counts as an importer).
- Every scratch directory comes from `tests/tmp.js` (`tmp(prefix)`); map.md: "tmp.js is where every scratch directory comes from".
- `tests/render.test.js:528`: every stage's injected block `< 2400` characters at a 59-character plugin root; run on 2026-09-29 it prints `land 2396 chars` — 4 left. `tests/render.test.js:553`/`:565`: init `< 1400`; `init+st 1376 chars` today — 24 left.
- `tests/stages.test.js:348`: no stage rule may match `/\bTODO\b(?!\.|-check)|\bTBD\b|placeholder|fill in/i` outside double quotes — case-insensitive, so `todo.js` and `TODO.md` pass and `todo:` or `todo entry` fails.
- `tests/station-i18n.test.js:84`: each `loc('<prefix>.<key>', '<zh>')` key's prefix is the prefix of the `// ---- ` section marker above it (`SECTIONS` at `tests/station-i18n.test.js:22-25`: `the project page` → `proj`, `tune: a block changed` → `tune`), every key has an English entry in `assets/station/i18n.js`, and every English entry is used; `:69`: every CJK string literal in `station.js` is the Chinese of a `loc()` call.
- `assets/station/station.js`: the functions tests import sit above `if (typeof module !== 'undefined' && module.exports)` (`:2343`); `projectPage()` (`:2761`) is in the DOM half, which `node --test` never runs.
- todo-check's caps, copied: `MAX_ENTRY_CHARS = 200` (`scripts/todo-check.js:56`), `MAX_TITLE_WIDTH = 28` with a CJK character counting two through `width()` in `lib/handoff.js:165` (`scripts/todo-check.js:150`), `REREAD_DAYS = 7` (`:124`), `STALE_DAYS = 60` (`:81`), `SECTIONS = ['Ready', 'Needs a decision', 'Blocked', 'Watch']` (`:68`).
- `lib/plantasks.js:215`: `INDEX_FILES = ['TODO.md', 'docs/README.md']`; `READ_CAP = 1500`, `FILE_CAP = 3` (`:346-347`).
- `.fankeel/docs.json` preset `audience`; a new or renamed page gets its `docs/README.md` index row in the same change (`CONTRIBUTING.md:20`).
- Indentation: four spaces in `lib/`, `scripts/` and `assets/`; a test file follows the file it sits beside (`tests/todo-check.test.js` two spaces, `tests/station-todo.test.js` four).
- Commit subjects: `<type>: <subject>` (`feat:`, `docs:`, `chore:`), per `git log`.

## Risks

- `land` sits at 2396 of 2400 — Task 5 — its replacement rule is 118 characters against 117 today, and the task runs `tests/render.test.js` before committing; the cut sentence (`A moved plan is a changed-address link.`) appears nowhere in `skills/`, so the ruling is recorded in the commit body.
- `INIT` has 24 characters left under 1400 — Task 4 — so no `INIT` rule changes: the entry ids `/fankeel` passes to `start --todo` ride `orient`'s `todo:` block, which is script output, not injection.
- The spec lists no field for the `### <title>` a Blocked or Watch timing group carries today — Task 3 — the plan adds `group` (at most 28 columns, the old timing title) beside `timing`; Task 3's round-trip test and Task 9's migrated `TODO.md` check it.
- The spec's "69 records on `todo-completions.md`" is that page's line count; it holds 11 records plus one format example whose `sha` is `<the commit that closed it>` — Task 3 — `migrate` skips a record whose `sha` is not 7–40 hex; Task 9 expects `27 open, 11 done`.
- `lib/` may not require `scripts/`, and the station needs the readers — Task 3 — `entries()`, `timings()` and their helpers move to `lib/todo.js` unchanged and todo-check re-exports them; Task 3 runs `tests/todo-check.test.js`, `tests/orient.test.js` and `tests/station-todo.test.js` after the move.
- The i18n test ties a key's prefix to the section marker above it, and the panel's pure function has to sit above the export guard at `:2343`, inside the `tune` section — Task 7 — two markers bracket it (`the project page, again` and `tune: a block changed, continued`); Task 7 runs `tests/station-i18n.test.js`.
- An entry file's links are written relative to the repository root, as `TODO.md`'s were — Task 1 — `resolveRef()` in `scripts/docs-check.js:261-276` already tries the root-relative candidate second; Task 1's test proves a root-relative link resolves from `docs/todo/`.
- The static page's copy-this-line hint (`todo.staticPageCopyLine`) still says to paste into `TODO.md`; the spec does not list it, and it is left — none of the nine tasks touches it.

## Task 1: The `todo` role

**Files:**
- Modify: `lib/docs.js:18-40` — `ROLES` gains `'todo'`, and the comment above it says what the role is checked for
- Modify: `scripts/docs-check.js:375-395` — a `todo` page's named paths are not reported `gone`, as for `fixture`
- Modify: `lib/map.js:270-290` — a `todo` page with no status is counted `current`, as a fixture is
- Test: `tests/todo-role.test.js`

**Interfaces:**
- Consumes: none
- Produces: `'todo'` — a role `normalise()` keeps and `roleOf()` returns for a file under a `{ "role": "todo" }` bucket

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/todo-role.test.js`:

```js
'use strict';

// Role `todo` (docs/90-agent/plans/2026-09-29-todo-files-design.md §1): an
// entry file's links and cited lines are checked, the paths it names are not
// (a done entry names the files of the day it closed), and the map counts it
// as current rather than as a page nobody declared.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const docs = require('../lib/docs.js');
const { scan } = require('../scripts/docs-check.js');
const map = require('../lib/map.js');
const tmp = require('./tmp.js');

function project() {
  const dir = tmp('fankeel-todorole-');
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  put('lib/here.js', 'module.exports = {};\n');
  put('docs/a.md', '# a\n');
  put('docs/todo/x-1.md', '---\nlabel: x\ntitle: t\ndescription: d\nstate: done\n---\n\n'
    + 'Named `lib/gone.js`, linked [a](docs/a.md) and [b](docs/nope.md).\n');
  docs.write(dir, { preset: 'custom', index: 'docs/README.md', buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] });
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  return dir;
}

test('todo is a role a bucket can declare', () => {
  const tree = docs.normalise({ buckets: [{ path: 'docs/todo', role: 'todo' }] });
  assert.equal(docs.roleOf(tree, 'docs/todo/x-1.md'), 'todo');
});

test('docs-check reads a todo entry\'s links, root-relative included, and not the paths it names', () => {
  const dir = project();
  const mine = scan(dir, []).findings.filter((f) => f.file === 'docs/todo/x-1.md');
  assert.deepEqual(mine.map((f) => [f.tag, f.what]), [['gone', 'links to docs/nope.md']]);
});

test('the map files a todo entry as current, not undeclared', () => {
  const dir = project();
  const by = map.pagesByStatus(dir);
  assert.ok(by.current.includes('docs/todo/x-1.md'), JSON.stringify(by));
  assert.ok(!by.undeclared.includes('docs/todo/x-1.md'));
});
```

2. Run it and watch it fail: `node --test tests/todo-role.test.js` — the first test fails with `null !== 'todo'`, because `normalise()` drops a bucket whose role is not in `ROLES`.

3. In `lib/docs.js`, replace the comment line `// Six roles, by how long a document is meant to stay true.` with `// Seven roles, by how long a document is meant to stay true.`, and replace the `fixture` comment block and `ROLES` (lines 33-36) with:

```js
//   fixture    a test's own input. Describes nothing about the system, so it
//              cannot drift from it — checked only for the two things every
//              role gets: a link that resolves, a line that is still there.
//   todo       one TODO entry, a file under the project's entry folder
//              (lib/todo.js). Current, but a record of work rather than a
//              description of the system: checked like a fixture — links and
//              cited lines — never for symbols or `last_verified`, because its
//              date is its own `stamp` and todo-check reads that.
const ROLES = ['reference', 'decision', 'plan', 'report', 'archive', 'fixture', 'todo'];
```

4. In `scripts/docs-check.js`, in `checkDoc()`, change the `gone` condition at line 391 and add one sentence to the comment above it. The paragraph `// Never for a fixture either: ...` gains, after its last line (`// this tree never has, is exactly that.`):

```js
            //
            // Nor for a todo entry: a done one names the files of the day it
            // closed, which is the record being honest about its date.
            if (role !== 'plan' && role !== 'decision' && role !== 'fixture' && role !== 'todo' && roots.has(ref.split('/')[0])) {
```

   replacing the existing `if (role !== 'plan' && role !== 'decision' && role !== 'fixture' && roots.has(ref.split('/')[0])) {` line; the two lines inside the `if` stay.

5. In `lib/map.js`, in `pagesByStatus()`, replace `if (!contract.declared && docs.roleOf(tree, rel) === 'fixture') {` (line 281) with the condition below; the comment block above it stays:

```js
        if (!contract.declared && ['fixture', 'todo'].includes(docs.roleOf(tree, rel))) {
```

   and add to the comment block above it the line `// A todo entry carries its own frontmatter and no status, for the same reason.`

6. Run it and watch it pass: `node --test tests/todo-role.test.js`.

7. Commit:

```sh
git add tests/todo-role.test.js lib/docs.js scripts/docs-check.js lib/map.js
git commit -m "feat: todo is a docs role, checked like a fixture"
```

## Task 2: The audit leaves todo entries out

**Files:**
- Modify: `scripts/docs-audit.js:415-715` — `batches()` sends no `todo` page to a reader; the index and orphan checks skip `todo` pages
- Modify: `docs/90-agent/reference/documents.md:12-25` — the role table gains its `todo` row
- Test: `tests/docs-audit-todo.test.js`

**Interfaces:**
- Consumes: `'todo'` from Task 1
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/docs-audit-todo.test.js`:

```js
'use strict';

// A todo entry is one file per deferred thing, forty of them in this
// repository: the audit's reading half does not batch them, and the index is
// not asked to list them, as for an archive or a fixture.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const docs = require('../lib/docs.js');
const audit = require('../scripts/docs-audit.js');
const tmp = require('./tmp.js');

test('the audit batches no todo entry and does not ask the index to list one', () => {
  const dir = tmp('fankeel-audittodo-');
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  put('README.md', '# r\n');
  put('docs/README.md', '# index\n\n[a](a.md)\n');
  put('docs/a.md', '# a\n');
  put('docs/todo/x-1.md', '---\nlabel: x\ntitle: t\ndescription: d\nstate: ready\n---\n');
  docs.write(dir, { preset: 'custom', index: 'docs/README.md', buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] });
  const batched = audit.batches(dir).flatMap((b) => b.pages);
  assert.ok(!batched.includes('docs/todo/x-1.md'), JSON.stringify(batched));
  const swept = audit.sweep(dir, 14, Date.now());
  assert.ok(!swept.index.missing.includes('docs/todo/x-1.md'), JSON.stringify(swept.index.missing));
});
```

2. Run it and watch it fail: `node --test tests/docs-audit-todo.test.js` — the page is batched, because `batches()` skips only `archive` and `fixture`.

3. In `scripts/docs-audit.js`, make the three exclusions name `todo` beside `fixture`. In `batches()` (line 424):

```js
        if (!b || ['archive', 'fixture', 'todo'].includes(b.role)) continue;
```

   In `scripts/docs-audit.js`, in `sweep()`'s index check (line 688):

```js
                if (['archive', 'fixture', 'todo'].includes(role)) continue;
```

   In `scripts/docs-audit.js`, in `sweep()`'s orphan list (line 711):

```js
        && !['archive', 'fixture', 'todo'].includes(docs.roleOf(tree, rel)));
```

   and in the comment above the index check, after `// telling documents and data apart.`, add `// A todo entry is left out for the same reason: it is one deferred thing, not a page about the system.`

4. In `docs/90-agent/reference/documents.md`, add a row under the `fixture` row of the role table:

```md
| `todo` | one TODO entry, a file under the project's entry folder. Current, but checked like a fixture: links and line numbers, never symbols or `last_verified` — its date is its own `stamp`. Left out of the index and the audit's reading batches. |
```

5. Run it and watch it pass: `node --test tests/docs-audit-todo.test.js`, then `node scripts/docs-check.js` for the page edit.

6. Commit:

```sh
git add tests/docs-audit-todo.test.js scripts/docs-audit.js docs/90-agent/reference/documents.md
git commit -m "feat: docs-audit leaves todo entries out of batches and the index"
```

## Task 3: Entry files, the index, and `todo.js`

**Files:**
- Modify: `lib/todo.js` — new: the text readers moved from todo-check, the entry-file format, `render()`, `writeIndex()`, `add()`, `close()`, `migrate()` and `load()`
- Modify: `scripts/todo.js` — new: the CLI, `index`, `new`, `done`, `migrate`
- Modify: `scripts/todo-check.js` — the moved declarations are deleted and required from `lib/todo.js`; nothing else changes
- Read: `lib/docs.js` — `read()` and `frontmatter()`
- Read: `lib/handoff.js` — `width()`
- Read: `lib/registry.js` — `resolveRoot()`
- Test: `tests/todo-files.test.js`

**Interfaces:**
- Consumes: `'todo'` from Task 1
- Produces: `load(root, now)` — `{ mode: 'file' | 'folder', folder, text, all, entries, timings, done }` or `null` when there is neither a folder nor a `TODO.md`; `entries` items are `entries()`'s `{ line, end, section, timing, text }` plus, in folder mode, `{ id, file, label, title, state, condition, stamp }`; `done` items are `{ id, file, label, title, description, link, at, sha, disposition, session }`, newest first
- Produces: `folderOf(root)` — the `todo` bucket's path, relative and forward-slashed, when the folder exists; else `null`
- Produces: `parse(text)` / `serialize(entry)` — entry `{ label, title, description, state, link, group, timing, stamp, done: { at, sha, disposition, session } | null, body }`
- Produces: `readFolder(root, folder)` — entries plus `{ id, file }`, sorted by id with numeric collation
- Produces: `render(root, list, folder)` — `{ text, order }`, the generated `TODO.md` and the ids in bullet order
- Produces: `writeIndex(root)` — writes `TODO.md`, returns its text; throws with no folder
- Produces: `fromLine(text, link, state)` — `{ label, title, description, state, link }` from one `TODO.md`-style line
- Produces: `add(root, fields)` — `{ id, file, path }`; `close(root, id, opts)` — `{ id, file }`, `opts` `{ sha, session, disposition, at }`; `migrate(root, now)` — `{ open, done, left }`
- Produces: `isoDay(ms)` — `YYYY-MM-DD` in local time
- Produces: `STATES`, `ID`, `ISO`
- Produces: `main(argv, now)` — `scripts/todo.js`, `{ text, ok }`

**Dispatch:** implementer, sonnet — the plan carries the code, and the move is named line by line; transcription plus tests.

1. Write the failing test. In `tests/todo-files.test.js`:

```js
'use strict';

// TODO entries as files (docs/90-agent/plans/2026-09-29-todo-files-design.md):
// the entry-file format, todo.js as the one writer, and load() giving the
// folder the same shapes a hand-written TODO.md gives.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const lib = require('../lib/todo.js');
const { main } = require('../scripts/todo.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'todo.js');
const NOW = new Date(2026, 8, 25, 12, 0).getTime();

const TODO = [
  '# TODO', '', 'A hand-written index.', '',
  '## Ready', '', '- 〔alpha〕Do the thing — [a.md](docs/a.md).', '',
  '## Needs a decision', '', '- 〔beta〕Decide that — [a.md](docs/a.md).', '',
  '## Blocked', '', '### Waits for release', 'upstream: lib 2.0. 09-20.', '',
  '- 〔gamma〕After release — [a.md](docs/a.md).', '- 〔gamma〕Second one — [a.md](docs/a.md).', '',
  '## Watch', '', '### If it recurs', 'if: it happens again. 09-21.', '',
  '- no label here — [a.md](docs/a.md).', '',
].join('\n');

const COMPLETIONS = [
  '# TODO completions', '', '```',
  '- original: 〔delta〕Closed last week — [a.md](docs/a.md).', '  disposition: done',
  '  sha: 0123456789abcdef0123456789abcdef01234567', '',
  '- original: <the entry\'s text, verbatim>', '  disposition: done | measured-no-change | abandoned',
  '  sha: <the commit that closed it>', '```', '',
].join('\n');

function project(withBucket) {
  const dir = tmp('fankeel-todofiles-');
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  put('TODO.md', TODO);
  put('docs/a.md', '# a\n');
  put(lib.COMPLETIONS_PAGE, COMPLETIONS);
  const buckets = [{ path: 'docs', role: 'reference', depth: 1 }];
  if (withBucket) buckets.push({ path: 'docs/todo', role: 'todo' });
  put('.fankeel/docs.json', JSON.stringify({ buckets }));
  return dir;
}

const shape = (loaded) => ({
  entries: loaded.entries.map((e) => ({ section: e.section, text: e.text })),
  timings: loaded.timings.map((t) => ({ section: t.section, title: t.title, kind: t.kind, event: t.event,
    stamp: t.stamp, items: t.items.length })),
});

test('an entry file round-trips through serialize and parse', () => {
  const e = { label: 'x', title: 'A title', description: 'a line with `code` — [a.md](docs/a.md).', state: 'blocked',
    link: 'docs/a.md', group: 'Waits', timing: 'after: y', stamp: '2026-09-20',
    done: { at: '2026-09-29', sha: 'abcdef1', disposition: 'done', session: 's-1' }, body: 'Background.\n\nTried z.' };
  assert.deepEqual(lib.parse(lib.serialize(e)), e);
  const bare = { label: '', title: 't', description: 'd', state: 'ready', link: '', group: '', timing: '', stamp: '',
    done: null, body: '' };
  assert.deepEqual(lib.parse(lib.serialize(bare)), bare);
  assert.ok(lib.ID.test('stage-agents-12') && !lib.ID.test('Stage_1'));
  assert.ok(lib.ISO.test('2026-09-29') && lib.STATES.includes('done'));
  assert.equal(lib.isoDay(NOW), '2026-09-25');
});

test('migrate turns TODO.md and the completions page into entry files, and load() reads both in one shape', () => {
  const file = project(false);
  const folder = project(true);
  const before = lib.load(file, NOW);
  assert.equal(before.mode, 'file');
  assert.equal(lib.folderOf(file), null);
  const r = lib.migrate(folder, NOW);
  assert.deepEqual([r.open, r.done, r.left.length], [5, 1, 0]);
  const after = lib.load(folder, NOW);
  assert.equal(after.mode, 'folder');
  assert.equal(lib.folderOf(folder), 'docs/todo');
  assert.deepEqual(shape(after), shape(before));
  assert.deepEqual(after.entries.map((e) => e.id), ['alpha-1', 'beta-1', 'gamma-1', 'gamma-2', 'entry-1']);
  assert.deepEqual(after.done.map((d) => [d.id, d.sha, d.disposition]),
    [['delta-1', '0123456789abcdef0123456789abcdef01234567', 'done']]);
  const gamma = lib.readFolder(folder, 'docs/todo').find((e) => e.id === 'gamma-2');
  assert.deepEqual([gamma.group, gamma.timing, gamma.stamp], ['Waits for release', 'upstream: lib 2.0', '2026-09-20']);
  assert.equal(lib.render(folder, lib.readFolder(folder, 'docs/todo'), 'docs/todo').text, after.text);
  assert.throws(() => lib.migrate(folder, NOW), /runs once/);
});

test('todo.js index rewrites TODO.md byte for byte, and new and done move an entry through it', () => {
  const dir = project(true);
  lib.migrate(dir, NOW);
  const index = fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8');
  execFileSync(process.execPath, [SCRIPT, 'index', '--root', dir], { encoding: 'utf8', cwd: dir });
  assert.equal(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), index);
  assert.equal(lib.writeIndex(dir), index);
  assert.match(index, /^Generated by fankeel's `scripts\/todo\.js index` from `docs\/todo\/`/m);

  const made = main(['new', '--root', dir, '--label', 'eps', '--title', 'New one', '--description', 'a new entry',
    '--state', 'ready'], NOW);
  assert.equal(made.ok, true, made.text);
  assert.match(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), /^- 〔eps〕a new entry$/m);

  const shut = main(['done', 'eps-1', '--root', dir, '--sha', 'abcdef1', '--session', 'sess-1'], NOW);
  assert.equal(shut.ok, true, shut.text);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), /a new entry/);
  const done = lib.load(dir, NOW).done.find((d) => d.id === 'eps-1');
  assert.deepEqual([done.sha, done.session, done.disposition, done.at], ['abcdef1', 'sess-1', 'done', '2026-09-25']);
  assert.equal(main(['done', 'eps-1', '--root', dir, '--sha', 'abcdef1'], NOW).ok, false, 'closed once, not twice');
  assert.equal(main(['done', 'alpha-1', '--root', dir], NOW).ok, false, 'no sha, no close');
});

test('fromLine and add make an entry out of one TODO.md-style line', () => {
  const dir = project(true);
  fs.mkdirSync(path.join(dir, 'docs', 'todo'));
  const f = lib.fromLine('  〔station〕a  question：with detail ', 'docs/a.md', 'decision');
  assert.deepEqual(f, { label: 'station', title: 'a question', description: 'a question：with detail',
    state: 'decision', link: 'docs/a.md' });
  const made = lib.add(dir, f);
  assert.deepEqual([made.id, made.file], ['station-1', 'docs/todo/station-1.md']);
  assert.match(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'),
    /^- 〔station〕a question：with detail — \[a\.md\]\(docs\/a\.md\)\.$/m);
  const shut = lib.close(dir, 'station-1', { sha: 'abcdef1', at: '2026-09-29' });
  assert.equal(shut.file, 'docs/todo/station-1.md');
  assert.throws(() => lib.add(dir, Object.assign({}, f, { id: 'station-1' })), /never reused/);
});
```

2. Run it and watch it fail: `node --test tests/todo-files.test.js` — `Cannot find module '../lib/todo.js'`.

3. Create `lib/todo.js` by moving these declarations out of `scripts/todo-check.js`, byte for byte with their comments, in this order, below the header in step 4: lines 53-56 (`MAX_ENTRY_CHARS`), 58-68 (`SECTIONS`), 70-75 (`TIMED` and the comment above it), 77 (`RETIRED`; line 76 `CONDITIONS` stays in todo-check), 79-81 (`STALE_DAYS`), 108-124 (`REREAD_DAYS`), 126-143 (`STAMP`, `CONDITION`, `conditionAt`), 145-150 (`MAX_TITLE_WIDTH`; line 151, the handoff require, stays in todo-check), 153-176 (`mmdd`, `DATE`, `dateAt`), 189-215 (`stampAt`), 217-222 (`COMPLETIONS_PAGE` and its comment; line 223 `COMPLETION_ORIGINAL` stays), 280-283 (`LINK`, `EXTERNAL`), 285-336 (`entries`), 357-367 (`linksIn`), 369-405 (`timings`). Line numbers are today's, before any edit.

4. The top of `lib/todo.js`, above the moved block. In `lib/todo.js`:

```js
'use strict';

// TODO entries, and the one reader every consumer shares.
//
// A project whose `.fankeel/docs.json` declares a bucket with role `todo`, and
// has that folder, keeps one file per entry there and a `TODO.md` generated
// from them. A project that does not keeps a hand-written `TODO.md`. `load`
// reads either and returns the shapes `entries()` and `timings()` give for the
// hand-written file, so orient, todo-check and the station compute what they
// computed before. Design: docs/90-agent/plans/2026-09-29-todo-files-design.md.
//
// The text readers below moved here from `scripts/todo-check.js` unchanged:
// nothing in `lib/` may require `scripts/`, and the station needs them.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const docs = require('./docs.js');
const { width } = require('./handoff.js');
```

5. Below the moved block, the entry files. In `lib/todo.js`:

```js
// ---- entry files -----------------------------------------------------------

// The five states an entry file can carry, and the heading each open one is
// filed under in the generated index.
const STATES = ['ready', 'decision', 'blocked', 'watch', 'done'];
const HEADING = { ready: SECTIONS[0], decision: SECTIONS[1], blocked: SECTIONS[2], watch: SECTIONS[3] };
const STATE_OF = { [SECTIONS[0]]: 'ready', [SECTIONS[1]]: 'decision', [SECTIONS[2]]: 'blocked', [SECTIONS[3]]: 'watch' };
const DISPOSITIONS = ['done', 'measured-no-change', 'abandoned'];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SHA = /^[0-9a-f]{7,40}$/;
const FRONT = /^---\r?\n[\s\S]*?\r?\n---\r?(?:\n|$)/;
// The contract that used to be TODO.md's own preamble; the generated preamble
// links it where the project has it.
const CONTRACT_PAGE = 'docs/90-agent/reference/todo.md';

function isoDay(ms) {
    const d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// The declared bucket, whether or not the folder exists yet: `migrate` makes it.
function bucketPath(root) {
    const { tree } = docs.read(root);
    const b = tree ? tree.buckets.find((x) => x.role === 'todo') : null;
    return b ? b.path : null;
}

// Folder mode is a declared bucket whose folder exists. Either missing is
// TODO.md mode, the rules a project had before this.
function folderOf(root) {
    const rel = bucketPath(root);
    if (!rel) return null;
    try {
        return fs.statSync(path.join(root, rel)).isDirectory() ? rel : null;
    } catch (e) {
        return null;
    }
}

// `docs.frontmatter` reads `done:`'s indented fields as `done.at` and so on.
function parse(text) {
    const fm = docs.frontmatter(text) || {};
    const m = FRONT.exec(text);
    const body = (m ? text.slice(m[0].length) : text).trim();
    const done = fm['done.at'] || fm['done.sha'] || fm['done.disposition']
        ? { at: fm['done.at'] || '', sha: fm['done.sha'] || '', disposition: fm['done.disposition'] || '', session: fm['done.session'] || '' }
        : null;
    return {
        label: fm.label || '', title: fm.title || '', description: fm.description || '', state: fm.state || '',
        link: fm.link || '', group: fm.group || '', timing: fm.timing || '', stamp: fm.stamp || '', done, body,
    };
}

function serialize(e) {
    const lines = ['---'];
    const put = (key, value) => {
        const v = String(value || '').replace(/\s+/g, ' ').trim();
        if (v) lines.push(key + ': ' + v);
    };
    put('label', e.label);
    put('title', e.title);
    put('description', e.description);
    put('state', e.state);
    put('link', e.link);
    put('group', e.group);
    put('timing', e.timing);
    put('stamp', e.stamp);
    if (e.done) {
        lines.push('done:');
        for (const k of ['at', 'sha', 'disposition', 'session']) if (e.done[k]) lines.push('  ' + k + ': ' + e.done[k]);
    }
    lines.push('---');
    const body = String(e.body || '').trim();
    return lines.join('\n') + '\n' + (body ? '\n' + body + '\n' : '');
}

const byId = (a, b) => a.id.localeCompare(b.id, 'en', { numeric: true });

function readFolder(root, folder) {
    let names;
    try {
        names = fs.readdirSync(path.join(root, folder));
    } catch (e) {
        return [];
    }
    return names.filter((n) => n.endsWith('.md')).map((n) => Object.assign(
        { id: n.slice(0, -3), file: folder + '/' + n },
        parse(fs.readFileSync(path.join(root, folder, n), 'utf8')),
    )).sort(byId);
}

function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// `<label>-<n>`, one past the highest `n` that label has in `list`.
function newId(list, label) {
    const base = slug(label) || 'entry';
    const re = new RegExp('^' + base + '-(\\d+)$');
    let n = 0;
    for (const e of list) {
        const m = re.exec(e.id);
        if (m) n = Math.max(n, Number(m[1]));
    }
    return base + '-' + (n + 1);
}

// A title out of a description: its first clause, markdown dropped, cut to
// fit MAX_TITLE_WIDTH with an ellipsis.
function titleOf(text) {
    const plain = String(text || '').replace(/^〔[^〕]*〕/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/`/g, '').replace(/\s+/g, ' ').trim();
    const head = plain.split(/：| — |: /)[0].trim() || plain;
    let out = '';
    for (const c of head) {
        if (width(out + c) > MAX_TITLE_WIDTH - 1) return out.trim() + '…';
        out += c;
    }
    return out;
}

// One line in TODO.md's shape — an optional `〔label〕`, then the text — as the
// fields of an entry. The station's 記成 TODO and `migrate` both come here.
function fromLine(text, link, state) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    const m = /^〔([^〕]+)〕\s*/.exec(t);
    const description = m ? t.slice(m[0].length) : t;
    return { label: m ? m[1] : '', title: titleOf(description), description, state, link: String(link || '').trim() };
}

// The bullet the index prints: the label, the description, and the link
// unless the description already carries it. Never empty — an empty bullet is
// no entry to `entries()`, and `load` pairs bullets with files by position.
function bulletOf(e) {
    const link = e.link && !e.description.includes('](' + e.link)
        ? ' — [' + (e.link.split('#')[0].split('/').pop() || e.link) + '](' + e.link + ').'
        : '';
    return ((e.label ? '〔' + e.label + '〕' : '') + e.description + link).trim() || e.id;
}

function preamble(root, folder) {
    const out = [
        'Generated by fankeel\'s `scripts/todo.js index` from `' + folder + '/`, one file per',
        'entry: change them with `todo.js new` and `todo.js done`, never this file —',
        '`todo-check` refuses a TODO.md that differs from what `index` writes.',
    ];
    if (fs.existsSync(path.join(root, CONTRACT_PAGE))) {
        out.push('', 'What each heading means and what `/fankeel` does with it: [todo.md](' + CONTRACT_PAGE + ').');
    }
    return out;
}

// The generated TODO.md: the four headings always, open entries by id under
// their state's heading, Blocked and Watch entries under one `### <group>` per
// group and timing, whose next line is the timing and the oldest stamp as
// MM-DD. An entry with a state outside the five is not printed; todo-check
// names it. `order` is the ids in bullet order.
function render(root, list, folder) {
    const open = list.filter((e) => e.state !== 'done');
    const out = ['# TODO', '', ...preamble(root, folder), ''];
    const order = [];
    const bullet = (e) => {
        order.push(e.id);
        return '- ' + bulletOf(e);
    };
    for (const state of ['ready', 'decision']) {
        out.push('## ' + HEADING[state], '');
        for (const e of open.filter((x) => x.state === state)) out.push(bullet(e), '');
    }
    for (const state of ['blocked', 'watch']) {
        out.push('## ' + HEADING[state], '');
        const mine = open.filter((x) => x.state === state);
        const loose = mine.filter((e) => !e.group);
        for (const e of loose) out.push(bullet(e));
        if (loose.length) out.push('');
        const groups = [];
        for (const e of mine.filter((x) => x.group)) {
            const key = e.group + '\n' + (e.timing || '');
            let g = groups.find((x) => x.key === key);
            if (!g) {
                g = { key, group: e.group, timing: e.timing || '', items: [] };
                groups.push(g);
            }
            g.items.push(e);
        }
        for (const g of groups) {
            const stamps = g.items.map((e) => e.stamp).filter((s) => ISO.test(s)).sort();
            const cond = [g.timing ? g.timing.replace(/\.$/, '') + '.' : '', stamps.length ? stamps[0].slice(5) + '.' : '']
                .filter(Boolean).join(' ');
            out.push('### ' + g.group);
            if (cond) out.push(cond);
            out.push('');
            for (const e of g.items) out.push(bullet(e));
            out.push('');
        }
    }
    while (out[out.length - 1] === '') out.pop();
    return { text: out.join('\n') + '\n', order };
}

function writeIndex(root) {
    const folder = folderOf(root);
    if (!folder) throw new Error('no todo folder under ' + root + ' — declare a bucket with role "todo" in .fankeel/docs.json');
    const { text } = render(root, readFolder(root, folder), folder);
    fs.writeFileSync(path.join(root, 'TODO.md'), text);
    return text;
}

// The one way an entry file is made. Ids are never reused: an existing file
// is a refusal, and a deleted one is todo-check's.
function add(root, fields) {
    const folder = folderOf(root);
    if (!folder) throw new Error('no todo folder under ' + root);
    const state = fields.state || 'decision';
    if (!STATES.includes(state) || state === 'done') {
        throw new Error('state is one of ready, decision, blocked, watch — not "' + state + '"');
    }
    const description = String(fields.description || '').replace(/\s+/g, ' ').trim();
    if (!description) throw new Error('a description is required: it is the line TODO.md prints');
    const title = String(fields.title || titleOf(description)).trim();
    if (width(title) > MAX_TITLE_WIDTH) {
        throw new Error('title is ' + width(title) + ' columns, cap is ' + MAX_TITLE_WIDTH + ' — a CJK character counts two');
    }
    const id = fields.id || newId(readFolder(root, folder), fields.label);
    if (!ID.test(id)) throw new Error('"' + id + '" is not a lowercase kebab id');
    const file = folder + '/' + id + '.md';
    const full = path.join(root, file);
    if (fs.existsSync(full)) throw new Error(id + ' already exists; ids are never reused');
    fs.writeFileSync(full, serialize({
        label: fields.label || '', title, description, state, link: fields.link || '', group: fields.group || '',
        timing: fields.timing || '', stamp: fields.stamp || '', done: null, body: fields.body || '',
    }));
    writeIndex(root);
    return { id, file, path: full };
}

// Closing is a state, not a deletion: the file stays, with the commit that
// closed it and, where known, the session.
function close(root, id, opts) {
    const folder = folderOf(root);
    if (!folder) throw new Error('no todo folder under ' + root);
    const file = folder + '/' + id + '.md';
    const full = path.join(root, file);
    let text;
    try {
        text = fs.readFileSync(full, 'utf8');
    } catch (e) {
        throw new Error('no entry ' + id + ' in ' + folder);
    }
    const e = parse(text);
    if (e.state === 'done') throw new Error(id + ' is already done');
    const o = opts || {};
    if (!SHA.test(String(o.sha || ''))) throw new Error('--sha <commit> is required: the durable link to the work');
    const disposition = o.disposition || 'done';
    if (!DISPOSITIONS.includes(disposition)) throw new Error('disposition is one of ' + DISPOSITIONS.join(', '));
    e.state = 'done';
    e.done = { at: o.at || isoDay(Date.now()), sha: o.sha, disposition, session: o.session || '' };
    fs.writeFileSync(full, serialize(e));
    writeIndex(root);
    return { id, file };
}

// Both modes, one shape. Folder mode renders the index and reads it with the
// same `entries()` and `timings()` a hand-written file gets, then pairs each
// bullet with its file by position.
function load(root, now) {
    const at = now === undefined ? Date.now() : now;
    const folder = folderOf(root);
    if (!folder) {
        let text;
        try {
            text = fs.readFileSync(path.join(root, 'TODO.md'), 'utf8');
        } catch (e) {
            return null;
        }
        return { mode: 'file', folder: null, text, all: [], entries: entries(text), timings: timings(text, at), done: [] };
    }
    const all = readFolder(root, folder);
    const { text, order } = render(root, all, folder);
    const known = new Map(all.map((e) => [e.id, e]));
    const found = entries(text).map((e, i) => {
        const f = known.get(order[i]) || {};
        return Object.assign(e, { id: f.id, file: f.file, label: f.label, title: f.title, state: f.state,
            condition: f.timing, stamp: f.stamp });
    });
    const done = all.filter((e) => e.state === 'done').map((e) => ({
        id: e.id, file: e.file, label: e.label, title: e.title, description: e.description, link: e.link,
        at: e.done ? e.done.at : '', sha: e.done ? e.done.sha : '', disposition: e.done ? e.done.disposition : '',
        session: e.done ? e.done.session : '',
    })).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id, 'en', { numeric: true }));
    return { mode: 'folder', folder, text, all, entries: found, timings: timings(text, at), done };
}

// ---- migrate ---------------------------------------------------------------

const RECORD = /^- original:\s*(.*)\r?\n\s+disposition:\s*(.*)\r?\n\s+sha:\s*(\S+)/gm;

// The completions page's records, newest first as the page keeps them. A
// record whose sha is not a commit is the page's own format example.
function completions(root) {
    let text;
    try {
        text = fs.readFileSync(path.join(root, COMPLETIONS_PAGE), 'utf8');
    } catch (e) {
        return [];
    }
    const out = [];
    for (const m of text.matchAll(RECORD)) {
        if (!SHA.test(m[3])) continue;
        out.push({ original: m[1].trim(), disposition: m[2].trim(), sha: m[3] });
    }
    return out;
}

function commitDay(root, sha) {
    try {
        return execFileSync('git', ['show', '-s', '--format=%cs', sha], {
            cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() || null;
    } catch (e) {
        return null;
    }
}

// Once: a hand-written TODO.md and its completions page become entry files,
// and the index is regenerated. `left` is every bullet under no known heading,
// which the new index no longer carries — printed for a person to re-add.
function migrate(root, now) {
    const at = now === undefined ? Date.now() : now;
    const folder = bucketPath(root);
    if (!folder) throw new Error('declare a bucket with role "todo" in .fankeel/docs.json first');
    const dir = path.join(root, folder);
    if (fs.existsSync(dir) && fs.readdirSync(dir).some((n) => n.endsWith('.md'))) {
        throw new Error(folder + ' already holds entries; migrate runs once');
    }
    const text = fs.readFileSync(path.join(root, 'TODO.md'), 'utf8');
    fs.mkdirSync(dir, { recursive: true });
    const made = [];
    const write = (entry) => {
        const id = newId(made, entry.label);
        made.push({ id });
        fs.writeFileSync(path.join(dir, id + '.md'), serialize(entry));
    };
    const left = [];
    const found = timings(text, at);
    for (const e of entries(text)) {
        const state = STATE_OF[e.section];
        if (!state) {
            left.push({ line: e.line, text: e.text });
            continue;
        }
        const f = fromLine(e.text, linksIn(e.text)[0] || '', state);
        const t = e.timing === null ? null : found.find((x) => x.line === e.timing);
        write(Object.assign(f, {
            group: t ? t.title : '',
            timing: t && t.kind ? t.kind + ': ' + (t.event || '') : '',
            stamp: t && t.stamp !== null ? isoDay(t.stamp) : '',
            done: null, body: '',
        }));
    }
    const records = completions(root).reverse();
    for (const r of records) {
        const f = fromLine(r.original, linksIn(r.original)[0] || '', 'done');
        write(Object.assign(f, {
            group: '', timing: '', stamp: '', body: '',
            done: { at: commitDay(root, r.sha) || isoDay(at), sha: r.sha, disposition: r.disposition, session: '' },
        }));
    }
    writeIndex(root);
    return { open: made.length - records.length, done: records.length, left };
}

module.exports = {
    MAX_ENTRY_CHARS, SECTIONS, TIMED, RETIRED, STALE_DAYS, REREAD_DAYS, MAX_TITLE_WIDTH, COMPLETIONS_PAGE,
    STATES, ID, ISO, DATE, conditionAt, mmdd, linksIn, entries, timings,
    isoDay, folderOf, parse, serialize, readFolder, render, writeIndex, fromLine, add, close, load, migrate,
};
```

6. In `scripts/todo-check.js`, delete the declarations step 3 moved, and below `const { PATHISH, lineCount } = require('./docs-check.js');` add:

```js
// The text readers and the constants they share live in `lib/todo.js`, where
// the station reaches them too; this file keeps the rules.
const {
    MAX_ENTRY_CHARS, SECTIONS, TIMED, RETIRED, STALE_DAYS, REREAD_DAYS, MAX_TITLE_WIDTH, COMPLETIONS_PAGE,
    DATE, conditionAt, mmdd, linksIn, entries, timings,
} = require('../lib/todo.js');
```

   `module.exports` at the end of todo-check stays exactly as it is.

7. Create `scripts/todo.js`. In `scripts/todo.js`:

```js
#!/usr/bin/env node
'use strict';

// The one writer of TODO entry files, a thin wrapper over lib/todo.js.
//
//   node todo.js index   [--root <dir>]
//   node todo.js new     --label <w> --title <t> --description <d> --state <s>
//                        [--link <path>] [--group <title> --timing <cond> --stamp YYYY-MM-DD] [--id <id>]
//   node todo.js done    <id> --sha <sha> [--session <id>] [--disposition done] [--at YYYY-MM-DD]
//   node todo.js migrate [--root <dir>]

const path = require('node:path');
const { parseArgs } = require('node:util');

const todo = require('../lib/todo.js');
const { resolveRoot } = require('../lib/registry.js');

const USAGE = [
    'usage: todo.js index | new --label --title --description --state [--link --group --timing --stamp --id]',
    '       | done <id> --sha <sha> [--session <id>] [--disposition done] | migrate    [--root <dir>]',
].join('\n');

const FLAGS = ['root', 'label', 'title', 'description', 'state', 'link', 'group', 'timing', 'stamp', 'id',
    'sha', 'session', 'disposition', 'at'];

function main(argv, now) {
    const at = now === undefined ? Date.now() : now;
    const options = {};
    for (const f of FLAGS) options[f] = { type: 'string' };
    const { values, positionals } = parseArgs({ args: argv, strict: false, allowPositionals: true, options });
    const str = (k) => (typeof values[k] === 'string' ? values[k] : '');
    const root = resolveRoot(str('root') || undefined);
    const [cmd, arg] = positionals;
    try {
        if (cmd === 'index') {
            todo.writeIndex(root);
            return { text: 'fankeel todo: wrote ' + path.join(root, 'TODO.md'), ok: true };
        }
        if (cmd === 'new') {
            const state = str('state') || 'decision';
            const made = todo.add(root, {
                id: str('id'), label: str('label'), title: str('title'), description: str('description'), state,
                link: str('link'), group: str('group'), timing: str('timing'),
                stamp: str('stamp') || (state === 'blocked' || state === 'watch' ? todo.isoDay(at) : ''),
            });
            return { text: 'fankeel todo: ' + made.file, ok: true };
        }
        if (cmd === 'done') {
            if (!arg) return { text: USAGE, ok: false };
            const shut = todo.close(root, arg, { sha: str('sha'), session: str('session'),
                disposition: str('disposition'), at: str('at') || todo.isoDay(at) });
            return { text: 'fankeel todo: closed ' + shut.file, ok: true };
        }
        if (cmd === 'migrate') {
            const r = todo.migrate(root, at);
            const lines = ['fankeel todo migrate: ' + r.open + ' open, ' + r.done + ' done, ' + r.left.length
                + ' not migrated' + (r.left.length ? ' — under no known heading; re-add each with todo.js new:' : '')];
            for (const l of r.left) lines.push('  TODO.md:' + l.line + '  ' + l.text);
            return { text: lines.join('\n'), ok: true };
        }
    } catch (e) {
        return { text: 'fankeel todo: ' + e.message, ok: false };
    }
    return { text: USAGE, ok: false };
}

if (require.main === module) {
    const { text, ok } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    process.exit(ok ? 0 : 1);
}

module.exports = { main };
```

8. Run it and watch it pass, with the three suites the move could break:

```sh
node --test tests/todo-files.test.js tests/todo-check.test.js tests/orient.test.js tests/station-todo.test.js
```

9. Stage the new files and run the export check: `git add lib/todo.js scripts/todo.js tests/todo-files.test.js && node --test tests/source.test.js`.

10. Commit:

```sh
git add lib/todo.js scripts/todo.js scripts/todo-check.js tests/todo-files.test.js
git commit -m "feat: TODO entries as files — lib/todo.js and scripts/todo.js"
```

## Task 4: todo-check, blame and orient read the folder

**Files:**
- Modify: `scripts/todo-check.js` — `check()` in folder mode: reads through `load()`, adds the frontmatter rules, the stale index and the deleted entry, maps an entry's problem to its file, and ages `Needs a decision` by file
- Modify: `lib/blame.js` — `fileTime()`; `orderByEdit()` orders entries that carry `file` by that file's last commit
- Modify: `scripts/orient.js:20-570` — `todoBlock()` reads through `load()` and, in folder mode, prints the folder and each offered id
- Read: `lib/todo.js` — `load()`, `folderOf()`, `STATES`, `ID`, `ISO`, `writeIndex()`, `add()`, `serialize()`
- Test: `tests/todo-check-folder.test.js`

**Interfaces:**
- Consumes: `load(root, now)`, `folderOf(root)`, `STATES`, `ID`, `ISO`, `writeIndex(root)`, `add(root, fields)`, `serialize(entry)` from Task 3
- Produces: `check(file, now)` — in folder mode its problems may carry `file` (relative path of the entry file, `line: 1`); new kinds `stale index`, `deleted entry`, `bad id`, `bad state`, `no title`, `no description`, `bad done`
- Produces: `fileTime(dir, rel)` — ms of the file's last commit; `Infinity` for an uncommitted or modified file; `null` outside a repository

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/todo-check-folder.test.js`:

```js
'use strict';

// todo-check, blame and orient in folder mode
// (docs/90-agent/plans/2026-09-29-todo-files-design.md §3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const check = require('../scripts/todo-check.js');
const lib = require('../lib/todo.js');
const blame = require('../lib/blame.js');
const tmp = require('./tmp.js');

const ORIENT = path.join(__dirname, '..', 'scripts', 'orient.js');

function root() {
  const dir = tmp('fankeel-todofolder-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'a.md'), '# a\n');
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  return dir;
}
const git = (dir, args, when) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
  cwd: dir, stdio: 'ignore',
  env: Object.assign({}, process.env, when ? { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } : {}),
});
const problems = (dir) => check.check(path.join(dir, 'TODO.md')).problems;
const kinds = (dir) => problems(dir).map((p) => p.kind);

test('a TODO.md that is what index writes is clean; a hand edit is a stale index', () => {
  const dir = root();
  lib.add(dir, { label: 'a', title: 'one', description: 'first — [a.md](docs/a.md).', state: 'ready' });
  assert.deepEqual(kinds(dir), []);
  fs.appendFileSync(path.join(dir, 'TODO.md'), '- a hand line\n');
  assert.deepEqual(kinds(dir), ['stale index']);
  lib.writeIndex(dir);
  assert.deepEqual(kinds(dir), []);
});

test('frontmatter rules land on the entry file', () => {
  const dir = root();
  const put = (id, fields) => fs.writeFileSync(path.join(dir, 'docs', 'todo', id + '.md'), lib.serialize(Object.assign(
    { label: '', title: 't', description: 'd', state: 'ready', link: '', group: '', timing: '', stamp: '', done: null, body: '' },
    fields)));
  put('wide-1', { title: '這是一個超過二十八欄寬的標題文字啊啊' });
  put('odd-1', { state: 'someday' });
  put('wait-1', { state: 'blocked', group: 'g', timing: 'after: x' });
  put('shut-1', { state: 'done', done: { at: '2026-09-29', sha: 'nope', disposition: 'done', session: '' } });
  put('Bad_Id', {});
  lib.writeIndex(dir);
  const got = problems(dir).map((p) => (p.file || '') + ' ' + p.kind);
  for (const want of ['docs/todo/wide-1.md long title', 'docs/todo/odd-1.md bad state', 'docs/todo/wait-1.md undated',
    'docs/todo/shut-1.md bad done', 'docs/todo/Bad_Id.md bad id']) {
    assert.ok(got.includes(want), want + ' not in ' + JSON.stringify(got));
  }
  const text = check.report(check.check(path.join(dir, 'TODO.md')));
  assert.match(text, /docs\/todo\/wide-1\.md:1 {2}long title/);
});

test('a committed entry file that is gone is a deleted entry', () => {
  const dir = root();
  lib.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'x']);
  fs.unlinkSync(path.join(dir, 'docs', 'todo', 'a-1.md'));
  lib.writeIndex(dir);
  assert.deepEqual(kinds(dir), ['deleted entry']);
});

test('in folder mode Needs a decision is ordered by each file\'s last commit', () => {
  const dir = root();
  lib.add(dir, { label: 'a', title: 'old', description: 'old one', state: 'decision' });
  lib.add(dir, { label: 'a', title: 'new', description: 'new one', state: 'decision' });
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'x'], '2026-01-01T00:00:00Z');
  const f = path.join(dir, 'docs', 'todo', 'a-1.md');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('old one', 'old one, edited'));
  assert.equal(blame.fileTime(dir, 'docs/todo/a-1.md'), Infinity);
  lib.writeIndex(dir);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'y'], '2026-01-05T00:00:00Z');
  const needs = lib.load(dir).entries.filter((e) => e.section === 'Needs a decision');
  assert.deepEqual(blame.orderByEdit(dir, 'TODO.md', needs).map((e) => e.id), ['a-1', 'a-2']);
  assert.equal(blame.fileTime(dir, 'docs/todo/a-2.md'), Date.parse('2026-01-01T00:00:00Z'));
});

test('orient\'s todo: block in folder mode names the folder and every id it offers', () => {
  const dir = root();
  lib.add(dir, { label: 'r', title: 'ready', description: 'ready one', state: 'ready' });
  lib.add(dir, { label: 'q', title: 'question', description: 'a question', state: 'decision' });
  const out = execFileSync(process.execPath, [ORIENT, '--root', dir], { encoding: 'utf8', cwd: dir });
  assert.match(out, /^todo: TODO\.md, from docs\/todo\/$/m);
  assert.match(out, /^ {2}Ready 1 — ids: r-1$/m);
  assert.match(out, /^ {4}\[q-1\] 〔q〕a question$/m);
  assert.match(out, /--todo <id>/);
});
```

2. Run it and watch it fail: `node --test tests/todo-check-folder.test.js` — the first test reports the hand line as an entry rather than `stale index`, and `blame.fileTime` is not a function.

3. In `scripts/todo-check.js`, extend the `lib/todo.js` require from Task 3 to take `STATES, ID, ISO, folderOf, load` as well, and change the blame require to `const { blameTimes, fileTime } = require('../lib/blame.js');`. Then add, above `check()`. In `scripts/todo-check.js`:

```js
// Folder mode's own rules, one `{ line: 1, file }` problem per entry file
// except the index's, which is TODO.md's. The index is generated, so any
// difference from what `render` writes is a hand edit; an entry file is never
// deleted, so one that was committed and is gone lost its record.
const TIMED_STATES = ['blocked', 'watch'];
const SHA = /^[0-9a-f]{7,40}$/;

function trackedIn(base, folder) {
    try {
        return execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', folder], {
            cwd: base, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        }).split('\n').filter((l) => l.endsWith('.md'));
    } catch (e) {
        return [];
    }
}

function folderProblems(base, folder, loaded, disk) {
    const out = [];
    const on = (file, kind, detail) => out.push({ line: 1, file, kind, detail });
    if (disk === null || disk.replace(/\r\n/g, '\n') !== loaded.text) {
        out.push({ line: 1, kind: 'stale index', detail: 'TODO.md is not what `todo.js index` writes from ' + folder
            + '/. It is generated: run `todo.js index`, and change entries through `todo.js new` and `todo.js done`.' });
    }
    for (const e of loaded.all) {
        if (!ID.test(e.id)) on(e.file, 'bad id', '"' + e.id + '" is not a lowercase kebab slug.');
        if (!STATES.includes(e.state)) on(e.file, 'bad state', '"' + e.state + '" — state is one of ' + STATES.join(', ') + '.');
        if (!e.title) on(e.file, 'no title', 'every entry carries a title, at most ' + MAX_TITLE_WIDTH + ' columns.');
        else if (width(e.title) > MAX_TITLE_WIDTH) {
            on(e.file, 'long title', width(e.title) + ' columns, cap is ' + MAX_TITLE_WIDTH + ' — a CJK character counts two.');
        }
        if (!e.description) on(e.file, 'no description', 'the description is the line TODO.md prints.');
        if (TIMED_STATES.includes(e.state) && !ISO.test(e.stamp)) {
            on(e.file, 'undated', 'a ' + e.state + ' entry carries stamp: YYYY-MM-DD, the day somebody last agreed its timing holds.');
        }
        if (e.state === 'done' && !(e.done && SHA.test(e.done.sha))) {
            on(e.file, 'bad done', 'a done entry carries done: with at, sha — the commit that closed it — and disposition.');
        }
    }
    for (const rel of trackedIn(base, folder)) {
        if (!fs.existsSync(path.join(base, rel))) {
            on(rel, 'deleted entry', 'was committed and is gone. An entry file is never deleted: close it with `todo.js done <id> --sha <sha>`.');
        }
    }
    return out;
}
```

4. In `scripts/todo-check.js`, replace the opening of `check()` — from `function check(file, now) {` down to and including `const found = entries(text);`, keeping the `// No docs.json is not a failure.` comment where it is — with:

```js
function check(file, now) {
    const at = now === undefined ? Date.now() : now;
    const base = path.dirname(file);
    // Folder mode: the entries are the files under the project's `todo`
    // bucket and TODO.md is what `todo.js index` writes from them, so the
    // rules below read the index as it should be, and the file on disk is
    // compared with it rather than read.
    const folder = folderOf(base);
    let disk = null;
    try {
        disk = fs.readFileSync(file, 'utf8');
    } catch (e) {
        if (!folder) return { file, missing: true, problems: [], overdue: [], stale: [] };
    }
    const loaded = folder ? load(base, at) : null;
    const text = loaded ? loaded.text : disk;
    // No `docs.json` is not a failure. `read` hands back a null tree, `roleOf`
    // answers null for everything under it, and the role check reports nothing —
    // this degrades to the three checks it had before rather than refusing to
    // run in a repository that never declared a tree.
    const { tree } = docs.read(base);
    let problems = [];
    const overdue = [];
    const stale = [];
    const found = loaded ? loaded.entries : entries(text);
```

5. In `scripts/todo-check.js`, in `check()`, the previous-commit comparison runs in TODO.md mode only, and folder mode adds its own. Replace `const prevText = previousVersion(base, path.basename(file));` with:

```js
    if (loaded) problems.push(...folderProblems(base, folder, loaded, disk));
    const prevText = loaded ? null : previousVersion(base, path.basename(file));
```

6. In `scripts/todo-check.js`, in `check()`, directly after `problems.sort((a, b) => a.line - b.line);`, add:

```js
    // In folder mode a problem on an entry's bullet is that entry file's.
    if (loaded) {
        const fileAt = new Map(loaded.entries.map((e) => [e.line, e.file]));
        for (const p of problems) {
            if (p.file || !fileAt.has(p.line)) continue;
            p.file = fileAt.get(p.line);
            p.line = 1;
        }
    }
```

7. In `scripts/todo-check.js`, in `check()`, the `Needs a decision` re-read list ages a folder entry by its file. Replace `const blame = blameTimes(base, path.basename(file));` with:

```js
    if (loaded) {
        for (const entry of found) {
            if (entry.section !== 'Needs a decision') continue;
            const t = fileTime(base, entry.file);
            if (t === null || t === Infinity) continue;
            const days = Math.floor((at - t) / 86400000);
            if (days >= REREAD_DAYS) needsDecisionDue.push({ line: entry.line, days, text: entry.text });
        }
        needsDecisionDue.sort((a, b) => b.days - a.days);
    }
    const blame = loaded ? null : blameTimes(base, path.basename(file));
```

8. In `scripts/todo-check.js`, in `report()`, a problem names its own file when it has one. Replace `lines.push('  ' + result.file + ':' + p.line + '  ' + p.kind + ' — ' + p.detail);` with:

```js
            lines.push('  ' + (p.file || result.file) + ':' + p.line + '  ' + p.kind + ' — ' + p.detail);
```

9. In `lib/blame.js`, add above `orderByEdit()`. In `lib/blame.js`:

```js
// When a file was last committed, in ms: null where git cannot answer (not a
// repository), Infinity for a file with uncommitted changes or none committed
// yet — the newest thing there is, as blame's all-zero line is.
function fileTime(dir, rel) {
    const status = git(dir, ['status', '--porcelain', '--', rel]);
    if (status === null) return null;
    if (status.trim()) return Infinity;
    const out = (git(dir, ['log', '-1', '--format=%ct', '--', rel]) || '').trim();
    return out ? Number(out) * 1000 : Infinity;
}
```

   In `lib/blame.js`, make the first statement of `orderByEdit()`:

```js
    // Folder mode: an entry is its own file, so its last edit is that file's
    // last commit rather than the blame of lines in a generated index.
    if (list.length && list.every((e) => e.file)) {
        const scored = list.map((entry) => ({ entry, latest: fileTime(dir, entry.file) }));
        if (scored.every((s) => s.latest === null)) return [...list].reverse();
        scored.sort((a, b) => ((b.latest || 0) - (a.latest || 0)) || (b.entry.line - a.entry.line));
        return scored.map((s) => s.entry);
    }
```

   and export it: `module.exports = { blameTimes, fileTime, orderByEdit };`.

10. In `scripts/orient.js`, add `const todoFiles = require('../lib/todo.js');` below `const todoCheck = require('./todo-check.js');`, and replace the head of `todoBlock()` — from `function todoBlock(dir, now) {` down to and including `const lines = ['todo: TODO.md', '  Ready ' + readyCount];` — with:

```js
function todoBlock(dir, now) {
    let loaded;
    try {
        loaded = todoFiles.load(dir, now);
    } catch (e) {
        return null;
    }
    if (!loaded) return null;
    // Folder mode prints each offered entry's id, which is what
    // `task.js start --todo <id>` takes.
    const folder = loaded.mode === 'folder';
    const all = loaded.entries;
    const needs = all.filter((e) => e.section === 'Needs a decision');
    const ordered = orderByEdit(dir, 'TODO.md', needs);
    const timings = loaded.timings;

    const blocked = timings.filter((t) => t.section === 'Blocked');
    const watch = timings.filter((t) => t.section === 'Watch');
    const ready = all.filter((e) => e.section === 'Ready');
    const readyCount = ready.length;
    const blockedCount = all.filter((e) => e.section === 'Blocked').length;
    const watchCount = all.filter((e) => e.section === 'Watch').length;
    const dueCount = blocked.filter((t) => t.due).length;
    const staleCount = watch.filter((t) => t.stale).length;
    // The patrol is the standing last option, `TODO 全表盤點`: it walks every
    // entry, so it is offered whenever there is one, due or stale or neither.
    const patrol = all.length > 0;
    const needsCount = needs.length;
    // AskUserQuestion takes four. Ready's section is one option when it has
    // entries, and the patrol is always the last one while TODO.md has any.
    const limit = 4 - (readyCount > 0 ? 1 : 0) - (patrol ? 1 : 0);
    const shown = ordered.slice(0, limit);

    const lines = ['todo: TODO.md' + (folder ? ', from ' + loaded.folder + '/' : ''),
        '  Ready ' + readyCount + (folder && readyCount ? ' — ids: ' + ready.map((e) => e.id).join(' ') : '')];
```

11. In `scripts/orient.js`, in the same function, the offered line carries the id in folder mode. Replace `const t = e.text.replace(/\s+/g, ' ').trim();` with:

```js
            const t = (folder ? '[' + e.id + '] ' : '') + e.text.replace(/\s+/g, ' ').trim();
```

   In `scripts/orient.js`, directly above `const audit = auditLine(dir, now);` add:

```js
    if (folder) {
        lines.push('  start: `task.js start --todo <id>` for each entry the picked option covers — the one entry,'
            + ' or every Ready id when ## Ready is taken whole');
    }
```

12. Run it and watch it pass, with the suites these three files already have:

```sh
node --test tests/todo-check-folder.test.js tests/todo-check.test.js tests/orient.test.js tests/blame.test.js
```

13. Commit:

```sh
git add tests/todo-check-folder.test.js scripts/todo-check.js lib/blame.js scripts/orient.js
git commit -m "feat: todo-check, blame and orient read the entry folder"
```

## Task 5: Linking a session to entries

**Files:**
- Modify: `scripts/task.js:1-1150` — `--todo` (repeatable) on `start`, the `todo:` line in `describe()`, `task` clears the ids, `adopt` carries them, `stage land` prints one `todo.js done` line per id
- Modify: `lib/registry.js:880-956` — `todosOf(data)` beside `intendsOf`, exported
- Modify: `lib/stages.js:388-396` — the `land` rule names the `todo.js done` lines
- Read: `lib/todo.js` — `folderOf()`
- Test: `tests/task-todo.test.js`

**Interfaces:**
- Consumes: `folderOf(root)` from Task 3; `add(root, fields)` from Task 3 (the test)
- Produces: `todosOf(data)` — the registry entry's `todo` ids, strings only, `[]` when none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/task-todo.test.js`:

```js
'use strict';

// start --todo, and the land step that closes what it named
// (docs/90-agent/plans/2026-09-29-todo-files-design.md §4).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const registry = require('../lib/registry.js');
const lib = require('../lib/todo.js');
const { byName } = require('../lib/stages.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-5555-4555-8555-555555555555';

function task(dir, args) {
  const cfg = path.join(dir, 'cfg');
  return execFileSync(process.execPath, [SCRIPT, ...args, '--session', A, '--root', dir, '--claude-dir', cfg],
    { encoding: 'utf8', cwd: dir, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

function root(withFolder) {
  const dir = tmp('fankeel-tasktodo-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  if (withFolder) {
    fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
      { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  }
  return dir;
}

test('start --todo, repeated, records every id and the start output says them', () => {
  const dir = root(true);
  const out = task(dir, ['start', '--task', 'close two', '--route', 'build,land', '--todo', 'a-1', '--todo', 'a-2']);
  assert.deepEqual(registry.todosOf(registry.readSession(dir, A)), ['a-1', 'a-2']);
  assert.match(out, /^ {2}todo: a-1, a-2$/m);
  task(dir, ['task', 'something else']);
  assert.deepEqual(registry.todosOf(registry.readSession(dir, A)), [], 'a new task names no entry');
});

test('stage land prints the todo.js done line for each id where the project keeps entry files', () => {
  const dir = root(true);
  lib.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  task(dir, ['start', '--task', 'close one', '--route', 'build,land', '--todo', 'a-1']);
  const out = task(dir, ['stage', 'land']);
  assert.match(out, new RegExp('todo\\.js done a-1 --sha <sha> --session ' + A));
});

test('with no entry folder stage land prints no todo.js line', () => {
  const dir = root(false);
  task(dir, ['start', '--task', 'plain', '--route', 'build,land', '--todo', 'x-1']);
  assert.doesNotMatch(task(dir, ['stage', 'land']), /todo\.js done/);
});

test('the land rule names the todo.js done lines and still runs todo-check', () => {
  const rule = byName('land').rules.find((r) => r.includes('TODO.md entries'));
  assert.match(rule, /`todo\.js done`/);
  assert.match(rule, /`node \{\{TODO_CHECK\}\}`/);
});
```

2. Run it and watch it fail: `node --test tests/task-todo.test.js` — `registry.todosOf is not a function`.

3. In `lib/registry.js`, below `intendsOf()`:

```js
// The TODO entry ids `task.js start --todo` linked this task to, the ones its
// `land` closes. Written once at start; a new task clears them.
function todosOf(data) {
    return stringsOf(data, 'todo');
}
```

   and add `todosOf,` to `module.exports` directly below `intendsOf,`.

4. In `scripts/task.js`, add `const todoFiles = require('../lib/todo.js');` with the other lib requires, add `todo: 'todo',` as the last entry of `STRING_FLAGS` (so `splitAroundVerb` knows it takes a value), and replace the body of `parseArgs()` up to `if (whole.includes('--force')) opts.force = true;` with:

```js
    const options = {};
    for (const flag of Object.keys(STRING_FLAGS)) options[flag] = { type: 'string' };
    // The one repeatable flag: `start --todo a-1 --todo a-2` links both entries.
    options.todo = { type: 'string', multiple: true };

    const { values } = parseArgv({ args: head, strict: false, allowPositionals: true, options });
    const opts = {};
    for (const [flag, key] of Object.entries(STRING_FLAGS)) {
        if (values[flag] === undefined) continue;
        if (flag === 'todo') {
            if (values.todo.some((v) => typeof v !== 'string' || !v.trim())) fail('--todo needs an entry id.');
            opts.todo = [...new Set(values.todo.map((v) => v.trim()))];
            continue;
        }
        if (typeof values[flag] !== 'string') fail('--' + flag + ' needs a value.');
        opts[key] = values[flag];
    }
```

5. In `scripts/task.js`, in `cmdStart()`'s `data` object, directly below `project,`:

```js
        // The TODO entries this task means to close, by id; `stage land`
        // prints the `todo.js done` line for each.
        todo: opts.todo && opts.todo.length ? opts.todo : undefined,
```

   In `scripts/task.js`, in `describe()`, directly below `if (project) lines.push('project: ' + project);`:

```js
    const todo = registry.todosOf(data);
    if (todo.length) lines.push('todo: ' + todo.join(', '));
```

   In `cmdTask()`, below `delete d.intends;`, add `delete d.todo;`. In `cmdAdopt()`, below `if (source.worktree) data.worktree = source.worktree;`, add `if (registry.todosOf(source).length) data.todo = registry.todosOf(source);`.

6. In `scripts/task.js`, above `cmdStage()`:

```js
// The entries `start --todo` named, as the lines `land` closes them with. Only
// where the project keeps entry files: in TODO.md mode there is no file to
// close, and the land rule's hand edit is the whole step.
function todoLines(root, id, data) {
    const ids = registry.todosOf(data);
    if (!ids.length) return null;
    const dir = projectRootFor(root, { project: data.project });
    if (!todoFiles.folderOf(dir)) return null;
    const script = path.join(__dirname, 'todo.js');
    return ['close at land, each with the sha that landed it:']
        .concat(ids.map((t) => '  node ' + script + ' done ' + t + ' --sha <sha> --session ' + id + ' --root ' + dir));
}
```

   In `scripts/task.js`, in `cmdStage()`, directly above `return line;`:

```js
    if (name === 'land') {
        const closing = todoLines(root, id, data);
        if (closing) line += NL + closing.join(NL);
    }
```

7. In `lib/stages.js`, the `land` rule at line 392 becomes (118 characters against 117; the dropped sentence, `A moved plan is a changed-address link.`, is in no skill — record that in the commit body):

```js
            'Close the TODO.md entries this work finished (`todo.js done` lines from `stage land`), then run `node {{TODO_CHECK}}`.',
```

8. Run it and watch it pass, with the two suites that measure the rule text:

```sh
node --test tests/task-todo.test.js tests/render.test.js tests/stages.test.js tests/task.test.js
```

   `tests/render.test.js` prints `land 2397 chars` or less; over 2400 is a failure, not a trim elsewhere.

9. Commit:

```sh
git add tests/task-todo.test.js scripts/task.js lib/registry.js lib/stages.js
git commit -m "feat: task.js start --todo, and stage land prints the todo.js done lines" -m "The land rule drops 'A moved plan is a changed-address link.' to stay under the 2400 cap; no skill carried it."
```

## Task 6: The station's data and `POST /todo`

**Files:**
- Modify: `lib/station.js:1-720` — `gather()` reads each project directory's entries through `load()`; `serialize()` adds `todos` per project
- Modify: `scripts/station.js:1-530` — `POST /todo` writes an entry file through `add()` in folder mode, `addTodo()` as today otherwise
- Modify: `docs/90-agent/reference/station.md:925-950` — the `POST /todo` section says what folder mode does
- Read: `lib/todo.js` — `load()`, `fromLine()`, `add()`, `writeIndex()`, `isoDay()`, `close()`
- Read: `scripts/todo-check.js` — `check()`
- Test: `tests/station-todo-files.test.js`

**Interfaces:**
- Consumes: `load(root, now)`, `fromLine(text, link, state)`, `add(root, fields)`, `writeIndex(root)`, `isoDay(ms)`, `close(root, id, opts)`, `folderOf(root)` from Task 3; `check(file, now)` from Task 4
- Produces: `todos: { pkey, mode, folder, open, done }` — on each `projects[]` row of `window.STATION`; `open` items `{ id, label, title, description, state, condition, stamp }` in index order, `done` items `{ id, label, title, at, sha, disposition, session }` newest first; `mode` `'file'` has `done: []` and `id: null`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/station-todo-files.test.js`:

```js
'use strict';
// The station in folder mode: each project's open and done entries on the
// data file, and 記成 TODO writing an entry file rather than a TODO.md line.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const lib = require('../lib/todo.js');
const tmp = require('./tmp.js');

global.window = { STATION: { serve: false } };

const SID = 'eeeeeeee-7777-4777-8777-777777777777';

function fixture() {
    const base = tmp('fankeel-station-todofiles-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    registry.writeSession(r1, SID, { task: 't', stage: 'land', route: ['build', 'land'], active: false, claims: [],
        started: '2026-09-11T10:00:00.000Z', updated: '2026-09-11T10:05:00.000Z', configDir: cfg });
    fs.mkdirSync(path.join(r1, 'docs', 'todo'), { recursive: true });
    fs.writeFileSync(path.join(r1, 'docs', 'station.md'), '# station\n');
    fs.writeFileSync(path.join(r1, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
        { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
    lib.add(r1, { label: 'a', title: 'one', description: 'first — [station.md](docs/station.md).', state: 'ready' });
    lib.add(r1, { label: 'a', title: 'two', description: 'second', state: 'decision' });
    lib.add(r1, { label: 'b', title: 'three', description: 'third', state: 'ready' });
    lib.close(r1, 'b-1', { sha: 'abcdef1', session: SID, at: '2026-09-29' });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-09-11T10:00:00.000Z' }) + '\n');
    return { cfg, r1 };
}

const request = (url, body) => new Promise((resolve, reject) => {
    const req = http.request(url, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/x-www-form-urlencoded' } : {} }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
});

test('serialize carries each project\'s open and done entries, done with its sha and session', () => {
    const f = fixture();
    const model = station.gather({ configDir: f.cfg, roots: [f.r1], scan: [], cwd: f.r1 });
    const text = station.serialize(model);
    const data = JSON.parse(text.slice('window.STATION = '.length, text.lastIndexOf(';')));
    const row = data.projects.find((p) => path.resolve(p.root) === path.resolve(f.r1));
    const t = row.todos[0];
    const files = fs.readdirSync(path.join(f.r1, 'docs', 'todo'));
    const done = files.filter((n) => lib.parse(fs.readFileSync(path.join(f.r1, 'docs', 'todo', n), 'utf8')).state === 'done');
    assert.equal(t.mode, 'folder');
    assert.equal(t.open.length, files.length - done.length);
    assert.equal(t.done.length, done.length);
    assert.deepEqual(t.done.map((e) => [e.id, e.sha, e.session]), [['b-1', 'abcdef1', SID]]);
    assert.deepEqual(t.open.map((e) => [e.id, e.state]), [['a-1', 'ready'], ['a-2', 'decision']]);
});

test('POST /todo in folder mode writes an entry file and regenerates TODO.md; a refused one leaves no file', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js');
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const post = (o) => request(s.url + 'todo', new URLSearchParams(Object.assign({ nonce, root: f.r1, id: SID }, o)).toString());
        const dir = path.join(f.r1, 'docs', 'todo');
        const before = fs.readdirSync(dir).sort();
        const long = await post({ text: 'x'.repeat(250), link: 'docs/station.md' });
        assert.deepEqual([long.status, long.text.startsWith('too long — ')], [400, true]);
        const dead = await post({ text: 'x', link: 'docs/nope.md' });
        assert.deepEqual([dead.status, dead.text.startsWith('dead link — docs/nope.md')], [400, true]);
        assert.deepEqual(fs.readdirSync(dir).sort(), before, 'a refused entry leaves no file');
        const ok = await post({ text: '〔station〕a new question', link: 'docs/station.md' });
        assert.equal(ok.status, 201);
        assert.equal(ok.text.trim(), 'station-1');
        const made = lib.parse(fs.readFileSync(path.join(dir, 'station-1.md'), 'utf8'));
        assert.deepEqual([made.label, made.state, made.link], ['station', 'decision', 'docs/station.md']);
        assert.match(fs.readFileSync(path.join(f.r1, 'TODO.md'), 'utf8'),
            /^- 〔station〕a new question — \[station\.md\]\(docs\/station\.md\)\.$/m);
    } finally {
        s.close();
    }
});
```

2. Run it and watch it fail: `node --test tests/station-todo-files.test.js` — `row.todos` is undefined.

3. In `lib/station.js`, add `const todoFiles = require('./todo.js');` below `const { queueState } = require('./tune.js');`, and above `gather()`. In `lib/station.js`:

```js
const STATE_OF_SECTION = { Ready: 'ready', 'Needs a decision': 'decision', Blocked: 'blocked', Watch: 'watch' };

// One project directory's TODO entries for the project page, both modes
// through `load`: `open` always, in the index's order; `done` only where the
// project keeps entry files. null where the directory has neither.
function todoOf(dir) {
    let loaded;
    try {
        loaded = todoFiles.load(dir);
    } catch (e) {
        return null;
    }
    if (!loaded) return null;
    if (loaded.mode === 'folder') {
        const rank = new Map(loaded.entries.map((e, i) => [e.id, i]));
        const at = (e) => (rank.has(e.id) ? rank.get(e.id) : Infinity);
        return {
            mode: 'folder', folder: loaded.folder,
            open: loaded.all.filter((e) => e.state !== 'done').sort((a, b) => at(a) - at(b)).map((e) => ({
                id: e.id, label: e.label, title: e.title, description: e.description, state: e.state,
                condition: e.timing, stamp: e.stamp,
            })),
            done: loaded.done.map((e) => ({ id: e.id, label: e.label, title: e.title, at: e.at, sha: e.sha,
                disposition: e.disposition, session: e.session })),
        };
    }
    const byLine = new Map(loaded.timings.map((t) => [t.line, t]));
    return {
        mode: 'file', folder: null,
        open: loaded.entries.map((e) => {
            const f = todoFiles.fromLine(e.text, '', STATE_OF_SECTION[e.section] || '');
            const t = e.timing === null ? null : byLine.get(e.timing);
            return { id: null, label: f.label, title: f.title, description: f.description, state: f.state,
                condition: t && t.kind ? t.kind + ': ' + (t.event || '') : '',
                stamp: t && t.stamp !== null ? todoFiles.isoDay(t.stamp) : '' };
        }),
        done: [],
    };
}
```

4. In `lib/station.js`, in `gather()`, directly below the `docs` loop (after its closing `}` and above `registries.push(...)`):

```js
        // The same project directories' TODO entries, for each project page.
        const todos = [];
        for (const dir of projectDirs) {
            const t = todoOf(dir);
            if (!t) continue;
            const rel = dir === root ? '' : path.relative(root, dir).split(path.sep).join('/');
            todos.push(Object.assign({ pkey: rel ? root + '/' + rel : root }, t));
        }
```

   add `todos` to that `registries.push({ ... docs })` object (`..., profiles, docs, todos });`) and `todos: []` to the `gone` push below it. In `lib/station.js`, in `serialize()`, the `projects` row gains, below `docs: ...`:

```js
            todos: (r.todos || []).filter((t) => !hidden.has(t.pkey)),
```

5. In `scripts/station.js`, add `const todoFiles = require('../lib/todo.js');` below `const todoCheck = require('./todo-check.js');`, and below `addTodo()`. In `scripts/station.js`:

```js
// 記成 TODO where the project keeps entry files: the entry is written through
// `lib/todo.js`'s `add`, the one writer, and the same before-and-after
// `check()` decides — a problem the tree has now that it did not have before
// is the refusal, and the file comes out again with the index rewritten.
function addTodoFile(dir, text, link) {
    if (!String(text || '').trim()) return { status: 400, text: 'empty entry — nothing to write' };
    const file = path.join(dir, 'TODO.md');
    const key = (p) => p.kind + '\n' + p.detail;
    const had = new Map();
    for (const p of todoCheck.check(file).problems) had.set(key(p), (had.get(key(p)) || 0) + 1);
    let made;
    try {
        made = todoFiles.add(dir, todoFiles.fromLine(text, link, 'decision'));
    } catch (e) {
        return { status: 400, text: e.message };
    }
    const seen = new Map();
    for (const p of todoCheck.check(file).problems) {
        seen.set(key(p), (seen.get(key(p)) || 0) + 1);
        if (seen.get(key(p)) > (had.get(key(p)) || 0)) {
            fs.unlinkSync(made.path);
            todoFiles.writeIndex(dir);
            return { status: 400, text: p.kind + ' — ' + p.detail };
        }
    }
    return { status: 201, text: made.id };
}
```

6. In `scripts/station.js`, in `serve()`'s `POST /todo` branch, replace `const out = addTodo(file, view.todoEntry(form.get('text') || '', form.get('link') || ''));` with:

```js
            const dir = path.dirname(file);
            const out = todoFiles.folderOf(dir)
                ? addTodoFile(dir, form.get('text') || '', form.get('link') || '')
                : addTodo(file, view.todoEntry(form.get('text') || '', form.get('link') || ''));
```

7. In `docs/90-agent/reference/station.md`, add a paragraph directly below the `POST /todo` paragraph (the one ending `` `409`. ``):

```md
Where the project keeps entry files — its `.fankeel/docs.json` declares a
bucket with role `todo` and the folder exists — the same form writes one
instead: `lib/todo.js` makes a `decision` entry from the text (a leading
`〔word〕` becomes its label) and the link, and regenerates `TODO.md`. The
same before-and-after `check()` decides, and a refused entry's file is
removed and the index rewritten. A clean one answers `201` with the new
entry's id. The project page's TODO panel reads each project's `todos` row
off the data file: open entries in the index's order, and done ones newest
first where the project keeps entry files.
```

8. Run it and watch it pass, with the station suites that read the data file and `POST /todo`:

```sh
node --test tests/station-todo-files.test.js tests/station-todo.test.js tests/station.test.js tests/station-doc.test.js
```

9. Commit:

```sh
git add tests/station-todo-files.test.js lib/station.js scripts/station.js docs/90-agent/reference/station.md
git commit -m "feat: station data carries each project's todos; POST /todo writes an entry file in folder mode"
```

## Task 7: The project page's TODO panel

**Files:**
- Modify: `assets/station/station.js:2330-2800` — `todoPanelHtml()` above the export guard between two section markers, exported, and called at the end of `projectPage()`
- Modify: `assets/station/station.css:1595-1613` — the mockup's `.td*` rules appended
- Modify: `assets/station/i18n.js:80-100` — the panel's `proj.todo*` English strings
- Read: `.fankeel/build/2026-09-29-todo-files/mockup.html` — blocks `todo-head`, `todo-open`, `todo-done`
- Read: `.fankeel/build/2026-09-29-todo-files/build-mockup.js` — the panel's markup and its `<style>` block
- Read: `lib/station.js` — the `todos` row's shape
- Test: `tests/station-todo-panel.test.js`

**Interfaces:**
- Consumes: `todos: { pkey, mode, folder, open, done }` from Task 6
- Produces: `todoPanelHtml(t, sessions)` — the panel's HTML string, `''` for no row or a row with nothing in it

**Dispatch:** implementer, sonnet — the markup and CSS are the mockup's, carried here; build's render reviewer (`fankeel:fankeel-render-reviewer`) shoots the served project page against the approved mockup's `todo-head`, `todo-open` and `todo-done` blocks.

1. Write the failing test. In `tests/station-todo-panel.test.js`:

```js
'use strict';
// The project page's TODO panel (mockup blocks todo-head, todo-open,
// todo-done): counts off the data file, a done entry's session linked where
// this machine has it and its sha shown where it does not.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');

const ROW = { pkey: 'F:\\ws', mode: 'folder', folder: 'docs/todo', open: [
    { id: 'a-1', label: 'a', title: 'Ready one', description: 'do `x`', state: 'ready', condition: '', stamp: '' },
    { id: 'b-1', label: 'b', title: 'Blocked one', description: 'wait', state: 'blocked', condition: 'after: y', stamp: '2026-09-20' },
    { id: 'b-2', label: 'b', title: 'Blocked two', description: 'wait more', state: 'blocked', condition: 'after: y', stamp: '2026-09-20' },
], done: [
    { id: 'c-1', label: 'c', title: 'Here', at: '2026-09-29', sha: 'abcdef1234', disposition: 'done', session: 'ssss1111-0000' },
    { id: 'c-2', label: '', title: 'Elsewhere', at: '2026-09-28', sha: '1234567abc', disposition: 'abandoned', session: 'gone0000-0000' },
] };

test('the panel counts open and done entries and carries the three mockup blocks', () => {
    const html = V.todoPanelHtml(ROW, [{ id: 'ssss1111-0000' }]);
    for (const b of ['todo-head', 'todo-open', 'todo-done']) assert.match(html, new RegExp('data-block="' + b + '"'));
    assert.match(html, /未完成 3/);
    assert.match(html, /已完成 2/);
    assert.equal((html.match(/<li class="td-row">/g) || []).length, 5);
    assert.match(html, /<code>x<\/code>/);
    assert.match(html, /class="td-tm rep"/, 'a second entry under the same timing is muted');
    assert.match(html, /href="#\/s\/ssss1111-0000"/);
    assert.match(html, /sha 1234567/);
    assert.doesNotMatch(html, /#\/s\/gone0000/);
});

test('a TODO.md-mode project shows its open entries only, and nothing makes no panel', () => {
    const html = V.todoPanelHtml({ pkey: 'p', mode: 'file', folder: null, open: [ROW.open[0]], done: [] }, []);
    assert.match(html, /未完成 1/);
    assert.doesNotMatch(html, /已完成|data-block="todo-done"/);
    assert.match(html, /td-src[^>]*>TODO\.md</);
    assert.equal(V.todoPanelHtml({ pkey: 'p', mode: 'file', folder: null, open: [], done: [] }, []), '');
    assert.equal(V.todoPanelHtml(null, []), '');
});
```

2. Run it and watch it fail: `node --test tests/station-todo-panel.test.js` — `V.todoPanelHtml is not a function`.

3. In `assets/station/station.js`, directly above `if (typeof module !== 'undefined' && module.exports) {` (line 2343), insert the panel between two section markers — the first puts its keys under `proj`, the second hands the rest of the file back to `tune`, which is what the i18n test reads the keys by:

```js
    // ---- the project page, again: its TODO panel (`todoPanelHtml`) ---------
    // The approved mockup's three blocks — todo-head, todo-open, todo-done
    // (.fankeel/build/2026-09-29-todo-files/mockup.html). `t` is one `todos` row
    // off the data file; `sessions` is `S.sessions`, which says whether this
    // machine has a done entry's session to link.
    var TODO_STATES = [['ready', 'Ready'], ['decision', 'Needs a decision'], ['blocked', 'Blocked'], ['watch', 'Watch']];
    function todoGloss(state) {
        if (state === 'ready') return loc('proj.todoReadyGloss', '只等人動手');
        if (state === 'decision') return loc('proj.todoDecisionGloss', '等人決定要怎麼改');
        if (state === 'blocked') return loc('proj.todoBlockedGloss', '等一個 session 查得到的條件');
        return loc('proj.todoWatchGloss', '等一件只有碰上的人才知道的事');
    }
    function todoChip(label) {
        return label ? '<span class="chip td-lb">' + esc(label) + '</span>'
            : '<span class="td-lb td-nolb" aria-label="' + loc('proj.todoNoLabel', '沒有 label') + '"></span>';
    }
    function todoPanelHtml(t, sessions) {
        if (!t || (!t.open.length && !t.done.length)) return '';
        var known = {};
        (sessions || []).forEach(function (s) { known[s.id] = true; });
        var md = function (s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>'); };
        var open = TODO_STATES.map(function (st) {
            var list = t.open.filter(function (e) { return e.state === st[0]; });
            if (!list.length) return '';
            var timed = st[0] === 'blocked' || st[0] === 'watch', prev = null;
            return '<div class="rgh td-grp"><b class="mono">' + st[1] + '</b><span class="mute">'
                + loc('proj.todoNRows', '{n} 筆 · {g}', { n: list.length, g: todoGloss(st[0]) }) + '</span></div>'
                + '<ul class="td-rows' + (timed ? ' timed' : '') + '">' + list.map(function (e) {
                    var rep = timed && e.condition === prev;
                    prev = timed ? e.condition : null;
                    return '<li class="td-row">' + todoChip(e.label) + '<span class="td-t">' + esc(e.title) + '</span>'
                        + '<span class="td-d" title="' + esc(e.description) + '">' + md(e.description) + '</span>'
                        + (timed ? '<span class="td-tm' + (rep ? ' rep' : '') + '" title="' + esc(e.condition || '') + '">' + esc(e.condition || '') + '</span>'
                            + '<span class="td-st" title="stamp ' + esc(e.stamp || '') + '">' + esc(String(e.stamp || '').slice(5)) + '</span>' : '')
                        + '</li>';
                }).join('') + '</ul>';
        }).join('');
        var done = !t.done.length ? '' : '<div class="rgh td-grp"><b>' + loc('proj.todoDone', '已完成') + '</b><span class="mute">'
            + loc('proj.todoDoneNewest', '{n} 筆，最新在上', { n: t.done.length }) + '</span></div>'
            + '<ul class="td-rows donel">' + t.done.map(function (e) {
                return '<li class="td-row">' + todoChip(e.label) + '<span class="td-t">' + esc(e.title) + '</span>'
                    + '<span class="td-at mono">' + esc(e.at) + '</span><span class="td-dp mono">' + esc(e.disposition) + '</span>'
                    + (e.session && known[e.session]
                        ? '<a class="td-rf mono" href="' + sessionHash(e.session) + '" title="' + loc('proj.todoOpenSession', '開啟 session {id}', { id: esc(e.session) }) + '">session ' + esc(e.session.slice(0, 8)) + '</a>'
                        : '<span class="td-rf mono muted" title="' + loc('proj.todoNoSessionHere', '這台機器沒有這個 session；commit {sha}', { sha: esc(e.sha) }) + '">sha ' + esc(String(e.sha).slice(0, 7)) + '</span>')
                    + '</li>';
            }).join('') + '</ul>'
            + '<p class="note">' + loc('proj.todoSessionNote', 'session 只在跑過它的那台機器上找得到；找不到時列出關掉它的 commit。') + '</p>';
        return '<section class="panel td" id="todo">'
            + '<div class="h2" data-block="todo-head">TODO <small><span class="num">' + loc('proj.todoOpenN', '未完成 {n}', { n: t.open.length }) + '</span>'
            + (t.mode === 'folder' ? ' · <span class="num">' + loc('proj.todoDoneN', '已完成 {n}', { n: t.done.length }) + '</span>' : '') + '</small>'
            + '<span class="td-src mono muted">' + esc(t.mode === 'folder' ? t.folder + '/' : 'TODO.md') + '</span></div>'
            + '<div data-block="todo-open">' + open + '</div>'
            + (done ? '<div class="td-done" data-block="todo-done">' + done + '</div>' : '')
            + '</section>';
    }
    // ---- tune: a block changed, continued: what the tests import -----------
```

4. In `assets/station/station.js`, add `todoPanelHtml: todoPanelHtml,` to the `module.exports` object on the line with `projectSessionsHtml: projectSessionsHtml,`. In `projectPage()`, replace the last line's `+ routeLedger(mine) + '</section>';` with:

```js
            + routeLedger(mine) + '</section>'
            + todoPanelHtml((S.projects || []).reduce(function (hit, p) {
                return hit || (p.todos || []).filter(function (x) { return x.pkey === r.pkey; })[0] || null;
            }, null), S.sessions);
```

5. In `assets/station/station.css`, append the rules of the `const style` template in `.fankeel/build/2026-09-29-todo-files/build-mockup.js`, unchanged and without the style tags, under the comment line `/* TODO panel — the 2026-09-29 mockup's todo-head, todo-open, todo-done; tokens only. */`. In `assets/station/station.css`:

```css
/* TODO panel — the 2026-09-29 mockup's todo-head, todo-open, todo-done; tokens only. */
.td{container-type:inline-size}
.td .h2{margin-bottom:6px}
.td-done{margin-top:28px}
.td-done .td-grp{margin-top:0}
.td-src{margin-left:auto;font-size:11.5px}
.td-grp{margin-top:18px}
.td-rows{list-style:none;margin:0;padding:0;border-top:1px solid var(--rule2)}
.td-row{display:grid;grid-template-columns:112px minmax(0,14.5em) minmax(0,1fr);grid-template-areas:"lb tt ds";
  gap:0 14px;align-items:baseline;padding:7px 10px;border-bottom:1px solid var(--rule);font-size:13px;line-height:1.5}
.td-rows.timed .td-row{grid-template-columns:112px minmax(0,14.5em) minmax(0,1fr) minmax(0,17em) 40px;grid-template-areas:"lb tt ds tm st"}
.donel .td-row{grid-template-columns:112px minmax(0,1fr) 88px 52px 136px;grid-template-areas:"lb tt at dp rf"}
.td-lb{grid-area:lb;justify-self:start;font-family:var(--f-mono);max-width:100%;overflow:hidden;text-overflow:ellipsis}
.td-t{grid-area:tt;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.td-d{grid-area:ds;color:var(--ink2);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.td-d code{font-family:var(--f-mono);font-size:.92em}
.td-tm{grid-area:tm;font-family:var(--f-mono);font-size:12px;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.td-tm.rep{color:var(--muted)}
.td-st{grid-area:st;font-family:var(--f-mono);font-size:12px;color:var(--muted);text-align:right}
.td-at{grid-area:at;font-size:12px;color:var(--ink2)}
.td-dp{grid-area:dp;font-size:12px;color:var(--ink2)}
.td-rf{grid-area:rf;font-size:12px;justify-self:end}
a.td-rf{color:var(--ink)}
a.td-rf:focus-visible{outline:2px solid var(--ink);outline-offset:2px;border-radius:3px}
@container (max-width:820px){
  .td-row{grid-template-columns:auto minmax(0,1fr);grid-template-areas:"lb tt" "ds ds"}
  .td-rows.timed .td-row{grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"lb tt st" "ds ds ds" "tm tm tm"}
  .donel .td-row{grid-template-columns:auto auto minmax(0,1fr);grid-template-areas:"lb tt tt" "at dp rf"}
  .td-d,.td-tm{margin-top:2px}
}
```

6. In `assets/station/i18n.js`, below `'proj.unnamed': '(unnamed)',`:

```js
            'proj.todoReadyGloss': 'waiting only for someone to start',
            'proj.todoDecisionGloss': 'waiting for a person to decide what to change',
            'proj.todoBlockedGloss': 'waiting for a condition a session can check',
            'proj.todoWatchGloss': 'waiting for an event only whoever meets it will know of',
            'proj.todoNoLabel': 'no label',
            'proj.todoNRows': '{n} · {g}',
            'proj.todoDone': 'Done',
            'proj.todoDoneNewest': '{n}, newest first',
            'proj.todoOpenSession': 'Open session {id}',
            'proj.todoNoSessionHere': 'This machine does not have this session; commit {sha}',
            'proj.todoSessionNote': 'A session can only be found on the machine that ran it; where it cannot, the commit that closed the entry is shown.',
            'proj.todoOpenN': '{n} open',
            'proj.todoDoneN': '{n} done',
```

7. Run it and watch it pass, with the suites that read `station.js`'s strings and exports:

```sh
node --test tests/station-todo-panel.test.js tests/station-i18n.test.js tests/station-view.test.js
```

8. Stage the test and run the export check: `git add tests/station-todo-panel.test.js && node --test tests/source.test.js`.

9. Commit:

```sh
git add tests/station-todo-panel.test.js assets/station/station.js assets/station/station.css assets/station/i18n.js
git commit -m "feat: the project page's TODO panel — open entries by state, done ones with their session"
```

## Task 8: The contract page

**Files:**
- Modify: `docs/90-agent/reference/todo.md` — new: the contract `TODO.md`'s preamble carried, rewritten for entry files
- Modify: `docs/README.md` — the `todo-completions.md` row becomes the `todo.md` row
- Modify: `CONTRIBUTING.md` — the `TODO.md` row names the entry files and `scripts/todo.js`
- Read: `TODO.md` — its preamble (lines 3-83), the contract being moved
- Read: `lib/todo.js` — the names the page cites

**Interfaces:**
- Consumes: `load(root, now)` from Task 3
- Produces: `contract page` — the reference page `render()`'s preamble links once it exists

**Dispatch:** implementer, sonnet — the page's text is carried here; transcription plus a docs check.

1. Write the page. In `docs/90-agent/reference/todo.md`:

```md
---
status: current
last_verified: 2026-09-29
source_of_truth: lib/todo.js, scripts/todo.js, scripts/todo-check.js, TODO.md
---

# TODO entries

A deferred thing is one file under the project's `todo` bucket — in this
repository `docs/90-agent/todo/` — and `TODO.md` is generated from those
files by `node scripts/todo.js index`. A project whose `.fankeel/docs.json`
declares no `todo` bucket keeps a hand-written `TODO.md` under the same four
headings; `load()` in `lib/todo.js` reads either and returns the same shapes,
so `orient`, todo-check and the station do not care which.

## The entry file

One file per entry, named `<id>.md`, the id a lowercase kebab slug that is
never reused. Its frontmatter:

| field | what |
|---|---|
| `label` | the area — the word a `TODO.md` bullet used to open with in `〔〕`; it groups nothing |
| `title` | at most 28 columns, a CJK character counting two |
| `description` | the line `TODO.md` prints; with the label and the link, at most 200 characters |
| `state` | `ready`, `decision`, `blocked`, `watch` or `done` |
| `link` | optional: the detail page, relative to the repository root |
| `group` | `blocked` and `watch` only: the `### <title>` the index groups it under, at most 28 columns |
| `timing` | `blocked` and `watch` only: `on: MM-DD`, `after: <work>` or `upstream: <release>` for `blocked`; `if: <event>` for `watch` |
| `stamp` | `blocked` and `watch` only: `YYYY-MM-DD`, the day somebody last read the timing and agreed it still holds |
| `done` | a closed entry only: `at`, `sha`, `disposition` — `done`, `measured-no-change` or `abandoned` — and, where known, `session` |

The body is free markdown: the background, what was tried, what it waits on.
A reference page about the system is not where the work's own detail goes.

## The four headings

The state is the heading `TODO.md` files the entry under, and it answers one
question: what is this still waiting for? Not what it is about — the label
answers that.

| state | heading | waiting for | what `/fankeel` does with it |
|---|---|---|---|
| `ready` | `## Ready` | someone's hands; the entry is the specification | the whole section is offered as one task |
| `decision` | `## Needs a decision` | a person, to settle what the change should be | the newest few `orient` lists, one option each |
| `blocked` | `## Blocked` | something a session can check: a date, other work, an upstream release | every timing listed; the patrol, always the last option, walks them |
| `watch` | `## Watch` | an event only whoever meets it will know of | every timing listed; the patrol asks keep-or-drop of a stale one |

Entries sharing a `group` and a `timing` print under one `### <group>`, whose
next line is the timing and the oldest of their stamps as `MM-DD`. A
`blocked` timing with `on:` is due that day; `after:` and `upstream:` are due
once the stamp is seven days old, and the patrol's survey goes and checks
them. A `watch` timing is never due: at sixty days it is stale, and the
patrol asks only whether to keep it — kept, the stamp moves forward. Whoever
meets the event an `if:` names moves the entry to `ready` or `decision` and
drops its `group`, `timing` and `stamp`.

## Opening and closing one

- `node scripts/todo.js new --label <word> --title <title> --description <line> --state <state>`,
  with `--link`, and `--group`, `--timing` and `--stamp` for a timed one,
  writes the file and regenerates `TODO.md`.
- `task.js start --todo <id>`, once per entry, links a session to the entries
  it means to close; `orient`'s `todo:` block prints the ids it offers.
- `task.js stage land` prints `todo.js done <id> --sha <sha> --session <id>`
  for each; run it with the sha that landed the work. The entry turns
  `state: done` with a `done:` record, `TODO.md` is regenerated without it,
  and the file stays.
- `node scripts/todo.js migrate` converts a hand-written `TODO.md` and its
  completions page into entry files, once.

`sha` is the durable link: `.fankeel/sessions/` is per machine and
gitignored, so a `session` id resolves only where it ran. The station's
project page lists done entries newest first, linking the session where this
machine has it and showing the short sha where it does not.

## What todo-check refuses

`node scripts/todo-check.js` reads the folder and fails on: a `TODO.md` that
differs from what `index` writes; a committed entry file that is gone; an id
that is not a kebab slug; a state outside the five; a missing title or one
over 28 columns; a missing description; a printed line over 200 characters; a
`blocked` or `watch` entry with no `stamp`, no `group`, or a timing of the
other state's kind; an `on:` with no `MM-DD`; a `done` entry with no `sha`; a
link that does not resolve or lands on a plan, decision, report or archive.
It prints, without failing, the due and stale timings and the `decision`
entries whose file nobody has committed in seven days.
```

2. In `docs/README.md`, replace the row `| What happened to a closed TODO.md bullet, and what sha closed it | [todo-completions.md](../../99-archive/2026-09-29-todo-completions.md) |` with:

```md
| What a TODO entry file holds, what each heading is waiting for, and how an entry is opened and closed | [todo.md](90-agent/reference/todo.md) |
```

3. In `CONTRIBUTING.md`, replace the row that begins `` | `TODO.md` | itself | `` with:

```md
| `TODO.md` | the entry files under `docs/90-agent/todo/`, written by `scripts/todo.js` | Never edit `TODO.md` by hand: it is generated, and `todo-check` refuses a hand edit. One file per deferred thing, its `state` saying what it is still short of; the contract is [docs/90-agent/reference/todo.md](docs/90-agent/reference/todo.md). |
```

4. Run the checks: `node scripts/docs-check.js` — no finding on `docs/90-agent/reference/todo.md`, `docs/README.md` or `CONTRIBUTING.md`.

5. Commit:

```sh
git add docs/90-agent/reference/todo.md docs/README.md CONTRIBUTING.md
git commit -m "docs: the TODO contract moves to docs/90-agent/reference/todo.md"
```

## Task 9: This repository's migration

**Files:**
- Modify: `.fankeel/docs.json` — the `todo` bucket
- Modify: `TODO.md` — regenerated by `todo.js migrate`; the entry files it writes under `docs/90-agent/todo/` are this task's output too
- Read: `lib/plantasks.js` — `INDEX_FILES` at line 215, which keeps `TODO.md` and needs no change
- Test: `tests/todo-files.test.js`

**Interfaces:**
- Consumes: `migrate(root, now)` and `load(root, now)` from Task 3; `check(file, now)` from Task 4; `'todo'` from Task 1; `contract page` from Task 8
- Produces: `migrated repository` — this repository's entries as files, its completions page read

**Dispatch:** implementer, sonnet — one config line, one command, one test; transcription.

1. Write the failing test. In `tests/todo-files.test.js`, append:

```js
test('this repository keeps entry files, and its TODO.md is what todo.js index writes', () => {
  const root = path.join(__dirname, '..');
  const loaded = lib.load(root);
  assert.equal(loaded.mode, 'folder');
  assert.equal(loaded.folder, 'docs/90-agent/todo');
  assert.equal(fs.readFileSync(path.join(root, 'TODO.md'), 'utf8').replace(/\r\n/g, '\n'), loaded.text);
  assert.match(loaded.text, /\[todo\.md\]\(docs\/90-agent\/reference\/todo\.md\)/);
});
```

2. Run it and watch it fail: `node --test tests/todo-files.test.js` — `'file' !== 'folder'`.

3. In `.fankeel/docs.json`, add as the first object in `buckets`:

```json
    {
      "path": "docs/90-agent/todo",
      "role": "todo",
      "audience": "agent"
    },
```

4. Run the migration from the repository root, and keep its line:

```sh
node scripts/todo.js migrate
```

   It prints `fankeel todo migrate: 27 open, 11 done, 0 not migrated` — 4 Ready, 2 Needs a decision, 16 Blocked, 5 Watch, and the 11 records on `docs/90-agent/reference/todo-completions.md` (its twelfth is the format example). Any other count stops the task: say which entries differ.

5. Run the checks, each clean: `node scripts/todo-check.js` (its first line begins `fankeel todo-check: 27 entries — 4 ready, 2 needs a decision, 16 blocked, 5 watch.`), then `node scripts/docs-check.js`, and `grep -n "const INDEX_FILES" lib/plantasks.js` still reads `['TODO.md', 'docs/README.md']`.

6. Run it and watch it pass: `node --test tests/todo-files.test.js`.

7. Commit:

```sh
git add .fankeel/docs.json TODO.md docs/90-agent/todo tests/todo-files.test.js
git commit -m "chore: this repository's TODO moves to one file per entry under docs/90-agent/todo"
```

## Task 10: Archive the completions page, and the pages this made false

**Files:**
- Modify: `docs/99-archive/2026-09-29-todo-completions.md` — `docs/90-agent/reference/todo-completions.md`, moved here with `git mv`, then marked archived
- Modify: `docs/01-guide/development.md` — the `todo-check.js` section says what folder mode reads and refuses
- Modify: `skills/fankeel/SKILL.md:598-775` — the role table's `todo` row, the deferred-work row, and `--todo` in the init paragraph
- Read: `docs/90-agent/reference/todo.md` — the contract page these link

**Interfaces:**
- Consumes: `migrated repository` from Task 9
- Produces: none

**Dispatch:** implementer, sonnet — the text is carried here; transcription plus a docs check.

1. Move the page first, then edit it (an edit before `git mv` is lost):

```sh
git mv docs/90-agent/reference/todo-completions.md docs/99-archive/2026-09-29-todo-completions.md
```

   In `docs/99-archive/2026-09-29-todo-completions.md`, set the frontmatter's `status: current` to `status: archived`, and directly under `# TODO completions` add:

```md
Retired 2026-09-29. A closed entry is now an entry file with `state: done`
under `docs/90-agent/todo/`, carrying its sha and, where known, its session;
`todo.js migrate` turned the eleven records below into those files.
```

2. In `docs/01-guide/development.md`, at the end of the `## \`todo-check.js\` — whether \`TODO.md\` is still an index` section's first paragraph (after `just moved.`), add a paragraph:

```md
Where `.fankeel/docs.json` declares a bucket with role `todo` and its folder
exists, `TODO.md` is generated: each entry is a file there — in this
repository `docs/90-agent/todo/` — and `node scripts/todo.js index` writes
`TODO.md` from them. todo-check then reads the folder and adds the rules the
files carry: a `TODO.md` that differs from what `index` writes, a committed
entry file that is gone, a title over 28 columns, a state outside the five,
a `blocked` or `watch` entry with no `stamp`, and a `done` entry with no
`sha`. The contract is on
[docs/90-agent/reference/todo.md](../90-agent/reference/todo.md).
```

3. In `skills/fankeel/SKILL.md`, add below the role table's `fixture` row (line 604):

```md
| `todo` | one TODO entry file. Current, but checked like a fixture: links and line numbers, never symbols or `last_verified` — its date is its own `stamp`. |
```

   In `skills/fankeel/SKILL.md`, replace the row that begins `| Work deliberately deferred |` with:

```md
| Work deliberately deferred | one entry: `node <plugin>/scripts/todo.js new` where the project keeps a `todo` bucket — `TODO.md` is then generated, never edited — otherwise one `TODO.md` line, linking to the detail, under the heading for what it is short of — under `## Blocked`, beneath a `### <timing>` whose next line is `on: MM-DD`, `after: <what>` or `upstream: <what>`; under `## Watch`, one whose next line is `if: <the event>`; either line ending in a `MM-DD` stamp |
```

   In `skills/fankeel/SKILL.md`, in the init paragraph, after its last sentence (`**Other** is always there for the real answer.`), add:

```md
Where `orient`'s `todo:` line names a folder, it prints the id of each entry
it offers: start the task with `task.js start --todo <id>` for the one entry
an option covers, or once per id for `## Ready` taken whole, and `stage land`
then prints the `todo.js done` line that closes each.
```

4. Run the checks: `node scripts/docs-check.js` and `node --test tests/skills.test.js`, both clean.

5. Commit:

```sh
git add docs/99-archive/2026-09-29-todo-completions.md docs/01-guide/development.md skills/fankeel/SKILL.md
git commit -m "docs: archive todo-completions.md; development.md and the fankeel skill name the entry files"
```

## Coverage

| promise | task |
|---|---|
| One file per entry: `docs/90-agent/todo/<id>.md`, `<id>` a lowercase kebab slug, unique in the folder, never reused. | Task 3 (`ID`, `add()` refusing an existing id), Task 4 (`bad id`, `deleted entry`), Task 9 |
| Frontmatter fields: `label` (the word that used to sit in `〔〕`), `title` (at most 28 columns, a CJK character counting two), `description` | Task 3 (`parse()`, `serialize()`, `add()`), Task 4 (`long title`, `bad state`, `no description`) |
| `blocked` and `watch` entries also carry `timing` (one of `on: MM-DD`, `after: <work>`, `upstream: <release>` for `blocked`; `if: <event>` for `watch`) and `stamp` | Task 3 (`group` added for the `###` title — see Risks; `render()` groups by `group` and `timing`), Task 4 (`undated`) |
| A `done` entry carries `done: {at, sha, disposition, session?}`. | Task 3 (`close()`), Task 4 (`bad done`) |
| The body is free markdown: background, what was tried, what it waits on. | Task 3 (`parse()`/`serialize()` keep `body`) |
| `.fankeel/docs.json` gets a bucket `{ "path": "docs/90-agent/todo", "role": "todo", "audience": "agent" }`. Role `todo` is new in `lib/docs.js` | Task 1, Task 2, Task 9 |
| New `scripts/todo.js`, the only writer of entry files: | Task 3 (`index`, `new`, `done`, `migrate`) |
| `todo-check` fails when `TODO.md` differs from what `todo.js index` would write | Task 4 (`stale index`) |
| `todo-check`'s `entries()` and `timings()` (`scripts/todo-check.js:294`) read the entry folder when the project's `docs.json` declares a `todo` bucket | Task 3 (`load()`; the readers move to `lib/todo.js`), Task 4 (`check()`, `todoBlock()`) |
| The rules carry over into frontmatter checks: the 200-character description, the 28-column title, a `timing` that matches `state`, a stamp | Task 4 |
| In folder mode an entry file is never deleted. todo-check refuses a deleted entry file the way it refuses an unrecorded deletion today. | Task 4 (`deleted entry`) |
| `lib/blame.js` orders "newest by last edit" by each file's last commit date in folder mode, and by line blame in `TODO.md` mode. | Task 4 (`fileTime()`, `orderByEdit()`) |
| `lib/plantasks.js:215 INDEX_FILES` keeps `TODO.md` exempt from the file conflict check; entry files are ordinary files. | Task 9 (step 5 reads it; no change) |
| `task.js start --todo <id>` (repeatable) writes `todo: [<id>, ...]` on the session's registry entry. `/fankeel` passes it | Task 5, Task 4 (orient prints the ids), Task 10 (the init paragraph) |
| At `land`, each id on the entry that the work finished is closed with `todo.js done <id> --sha <landed sha> --session <this session>`. | Task 5 (`stage land` lines, the `land` rule) |
| `serialize()` (`lib/station.js`) adds per project `todos: { open, done }`, read through todo-check's `entries()` so both modes feed it. | Task 6 |
| `projectPage()` (`assets/station/station.js:2761`) gets a TODO panel: open entries grouped by state; done entries newest first | Task 7 |
| `POST /todo` (`scripts/station.js:511`) writes an entry file through `todo.js new` in folder mode and appends a line as today otherwise. | Task 6 (`add()`, the function `todo.js new` calls) |
| Run `todo.js migrate` here: the open entries and the 69 records on `todo-completions.md` become entry files; `todo-completions.md` moves to `docs/99-archive/`. | Task 9 (27 open, 11 done — see Risks), Task 10 (the move) |
| The contract in `TODO.md`'s preamble moves to a reference page, `docs/90-agent/reference/todo.md`; the generated preamble points at it. | Task 8, Task 3 (`preamble()`), Task 9 (the test asserts the link) |
| Pages this makes false are updated in the same work: `docs/01-guide/development.md:74`, the `POST /todo` section | Task 6 (`station.md`), Task 10 (`development.md`, `skills/fankeel/SKILL.md`), Task 8 (`CONTRIBUTING.md`, `docs/README.md`), Task 2 (`documents.md`) |
| A new `tests/todo-files.test.js`, failing today because `scripts/todo.js` does not exist: on a fixture folder, `entries()` returns the same shape | Task 3, Task 9 (the committed `TODO.md`) |
| On the rendered station, the project page's open count equals the number of non-`done` files in the folder, and its done count equals the `done` files. | Task 6 (`todos` counts against the folder), Task 7 (the panel's counts; the render reviewer on the served page) |
| The existing `tests/todo-check.test.js` and `tests/station-todo.test.js` stay green in `TODO.md` mode. | Task 3, Task 4, Task 6 (each runs them) |
