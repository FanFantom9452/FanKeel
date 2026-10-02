---
status: design-intent
last_verified: 2026-10-02
---

# TODO folder-only Implementation Plan

**Goal:** a project with a `todo` bucket keeps its entries only as files — no generated `TODO.md` — every open entry carries a body of at least 200 characters, the station shows that body, init asks before migrating a hand-written `TODO.md`, and this repository gets `station.bat`/`station.sh`.
**Architecture:** `lib/todo.js` stops writing `TODO.md` (its in-memory `render` stays, because `load()` reads entries through it); `scripts/todo.js` gains `list` and `--body`; `scripts/todo-check.js` swaps `stale index` for `hand TODO.md` and `thin body`. The station carries `body` from `todoOf` to `todoPanelHtml`, which expands a row on click with state held in `view.tdBody` across the 3 s redraw. Rules and skills are reworded so each sentence holds in both modes.
**Tech Stack:** Node.js built-ins only (`node:fs`, `node:path`, `node:child_process`, `node:util`, `node:test`); no dependencies in `package.json`.
**Spec:** [2026-10-02-todo-folder-only-design.md](2026-10-02-todo-folder-only-design.md)

## Global Constraints

From `node scripts/map.js` (`.fankeel/map.md`), `CONTRIBUTING.md`, `package.json` and the test suite:

- Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction (`CONTRIBUTING.md`, Core logic row).
- `scripts/*.js` are thin wrappers over `lib/` (`CONTRIBUTING.md`, CLI entry points row).
- Tests run with `node --test` (`package.json` `scripts.test`). Every exported name needs an importer, and a new test file has to be staged (`git add`) before `tests/source.test.js` can see it (`CONTRIBUTING.md`, Tests row) — the controller's commit stages it; name every new file in your handoff.
- No dependencies may be added: `package.json` declares none.
- Each stage's rules render under a 2400-character budget (`lib/stages.js:227`, `lib/stages.js:286`; `BLOCK_CAP = 2400` at `lib/render.js:602`). Never raise it; a rewritten rule string is the same length or shorter.
- `README.md` carries build's template verbatim (`tests/render.test.js:361`, "the README shows the build template as build actually ships it").
- `/fankeel`'s `INIT` rules must keep naming `TODO.md` (`tests/stages.test.js:633`, `tests/inject.test.js:437`).
- Every CJK string literal in `assets/station/station.js` is the Chinese of a `loc()` call with an English entry in `assets/station/i18n.js`, and every English entry is used (`tests/station-i18n.test.js:69`, `:84`).
- `MAX_ENTRY_CHARS = 200` (`lib/todo.js:25`) caps the description line; `MAX_TITLE_WIDTH = 28` (`lib/todo.js:94`) caps a title in columns, a CJK character counting two. Neither changes.
- Filing (map.md): plans in `docs/90-agent/plans`, the `todo` bucket is `docs/90-agent/todo`, references in `docs/90-agent/reference`.
- Indentation follows the file being edited: four spaces in `lib/`, `scripts/`, `assets/` and `tests/station-*.test.js`; two in `tests/todo-*.test.js`, `tests/task-todo.test.js`, `tests/upgrade.test.js`, `tests/skills.test.js` and the new `tests/init-todo-ask.test.js`.
- An implementer runs only its own test file; the build parent runs the whole suite.

## Risks

- `load()` builds folder-mode entries by rendering an index in memory and pairing bullets with files by position; deleting `render` with `writeIndex` would change every reader — Task 1 — Task 1 keeps `render` and `bulletOf` and deletes only `writeIndex`, `preamble` and `CONTRACT_PAGE`, and its migrate test keeps `assert.equal(lib.render(...).text, after.text)`.
- The `thin body` rule fails this repository's own `todo-check` the moment it lands, until the 18 empty bodies are written — Task 2 and Tasks 10-15 — those six read `scripts/todo-check.js`, so they are serialised after Task 2, and each ends on `todo-check` naming none of its three files.
- 記成 TODO in folder mode now needs a body of 200 characters, or the before/after `check()` refuses it as `thin body` — Task 3 and Task 5 — Task 3's test posts with and without `body`; Task 5 adds the body field to the form.
- The station page redraws every 3 s, so an expanded row held only in the DOM would close — Task 4 — state lives in `view.tdBody`, as `view.tdOpen` does at `assets/station/station.js:3113-3120`.
- A rewritten stage rule could exceed the 2400 budget, or drop the `TODO.md` the init tests require — Task 7 — every new string is shorter than the one it replaces and line 154 keeps `TODO.md`; `tests/stages.test.js`, `tests/inject.test.js` and `tests/render.test.js` run in that task.
- Folder-mode `overdue` lines in todo-check's report cite line numbers of the in-memory index, now under the folder's path rather than a `TODO.md` that no longer exists — Task 2 — reported here, not fixed: the title on the same line is what a reader acts on.

## Task 1: lib/todo.js and scripts/todo.js stop writing TODO.md; `--body`, `list`, migrate writes bodies

**Files:**
- Modify: `lib/todo.js` — drop `writeIndex`, `preamble`, `CONTRACT_PAGE`; `add`/`close`/`migrate` write no `TODO.md`; add `MIN_BODY_CHARS`, `bodyChars`, `headSha`; `migrate` writes bodies and removes `TODO.md`
- Modify: `scripts/todo.js` — drop `index`; add `list` and `--body`
- Modify: `TODO.md` — deleted
- Test: `tests/todo-files.test.js`
- Test: `tests/todo-migrate-errors.test.js`
- Test: `tests/upgrade.test.js`

**Interfaces:**
- Consumes: none
- Produces: `MIN_BODY_CHARS` (number, 200) and `bodyChars(text: string): number` exported from `lib/todo.js`; `add(root, fields)` accepts `fields.body` and writes no `TODO.md`; `close(root, id, opts)` writes no `TODO.md`; `migrate(root, now)` returns `{ open, done, left, warned }` as before and removes the root's `TODO.md`; `writeIndex` no longer exists; `todo.js list` prints `<state> <id> — <title>` per open entry and `<n> open` last; `todo.js new` refuses without `--body` or with fewer than 200 characters.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing tests. In `tests/todo-files.test.js`, replace the test `todo.js index rewrites TODO.md byte for byte, and new and done move an entry through it` (lines 92-113) with:

```js
const BODY = 'From session 9a6a429a on 2026-10-02: the generated index was read by nobody and drifted from the files. '
  + 'It should become one entry file per deferred thing, with a body like this one saying why it exists. '
  + 'Done when todo-check passes with no TODO.md at the root of the project.';

test('new and done write entry files and no TODO.md; new refuses a missing or short --body', () => {
  const dir = project(true);
  lib.migrate(dir, NOW);
  assert.equal(fs.existsSync(path.join(dir, 'TODO.md')), false, 'migrate removed TODO.md');
  const args = ['new', '--root', dir, '--label', 'eps', '--title', 'New one', '--description', 'a new entry', '--state', 'ready'];
  const bare = main(args, NOW);
  assert.equal(bare.ok, false);
  assert.match(bare.text, /--body <text> is required/);
  const short = main(args.concat(['--body', 'x'.repeat(199)]), NOW);
  assert.equal(short.ok, false);
  assert.match(short.text, /199 characters, at least 200/);
  const made = main(args.concat(['--body', BODY]), NOW);
  assert.equal(made.ok, true, made.text);
  assert.equal(fs.existsSync(path.join(dir, 'TODO.md')), false, 'add wrote no TODO.md');
  assert.equal(lib.readFolder(dir, 'docs/todo').find((e) => e.id === 'eps-1').body, BODY);

  const shut = main(['done', 'eps-1', '--root', dir, '--sha', 'abcdef1', '--session', 'sess-1'], NOW);
  assert.equal(shut.ok, true, shut.text);
  assert.equal(fs.existsSync(path.join(dir, 'TODO.md')), false, 'close wrote no TODO.md');
  const done = lib.load(dir, NOW).done.find((d) => d.id === 'eps-1');
  assert.deepEqual([done.sha, done.session, done.disposition, done.at], ['abcdef1', 'sess-1', 'done', '2026-09-25']);
  assert.equal(main(['done', 'eps-1', '--root', dir, '--sha', 'abcdef1'], NOW).ok, false, 'closed once, not twice');
  assert.equal(main(['done', 'alpha-1', '--root', dir], NOW).ok, false, 'no sha, no close');
  assert.equal(main(['index', '--root', dir], NOW).ok, false, 'index is gone');
});

test('todo.js list prints one line per open entry and the total last', () => {
  const dir = project(true);
  lib.migrate(dir, NOW);
  const r = main(['list', '--root', dir], NOW);
  assert.equal(r.ok, true, r.text);
  const lines = r.text.split('\n');
  assert.equal(lines[lines.length - 1], '5 open');
  assert.ok(lines.includes('ready alpha-1 — Do the thing'), r.text);
  assert.ok(!r.text.includes('delta-1'), 'a done entry is not listed');
  assert.equal(main(['list', '--root', project(false)], NOW).ok, false, 'no folder, nothing to list');
});
```

   In `tests/todo-files.test.js`, in the test `migrate turns TODO.md and the completions page into entry files, and load() reads both in one shape`, after `assert.deepEqual([r.open, r.done, r.left.length], [5, 1, 0]);` add:

```js
  assert.equal(fs.existsSync(path.join(folder, 'TODO.md')), false, 'migrate removed TODO.md');
  const alpha = lib.readFolder(folder, 'docs/todo').find((e) => e.id === 'alpha-1');
  assert.match(alpha.body, /^〔alpha〕Do the thing — \[a\.md\]\(docs\/a\.md\)\.\n\n從 TODO\.md 遷移，2026-09-25，/);
  const delta = lib.readFolder(folder, 'docs/todo').find((e) => e.id === 'delta-1');
  assert.match(delta.body, /^〔delta〕Closed last week — \[a\.md\]\(docs\/a\.md\)\.\n\n從 TODO\.md 遷移，/);
```

   In `tests/todo-files.test.js`, in the test `fromLine and add make an entry out of one TODO.md-style line`, replace

```js
  assert.match(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'),
    /^- 〔station〕a question：with detail — \[a\.md\]\(docs\/a\.md\)\.$/m);
```

   with, in `tests/todo-files.test.js`:

```js
  assert.equal(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), TODO, 'add left the hand-written TODO.md alone');
  assert.match(lib.load(dir, NOW).text, /^- 〔station〕a question：with detail — \[a\.md\]\(docs\/a\.md\)\.$/m);
```

   In `tests/todo-files.test.js`, replace the test `this repository keeps entry files, and its TODO.md is what todo.js index writes` with:

```js
test('this repository keeps entry files and no TODO.md', () => {
  const root = path.join(__dirname, '..');
  const loaded = lib.load(root);
  assert.equal(loaded.mode, 'folder');
  assert.equal(loaded.folder, 'docs/90-agent/todo');
  assert.equal(fs.existsSync(path.join(root, 'TODO.md')), false);
});
```

   In `tests/todo-files.test.js`, replace the test `writeIndex does not rewrite TODO.md from a folder it could not read` with:

```js
test('add does not write an entry into a folder it could not read', () => {
  const dir = project(true);
  fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
  const real = fs.readdirSync;
  const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  fs.readdirSync = (p, ...rest) => {
    if (path.resolve(String(p)) === path.join(dir, 'docs', 'todo')) throw denied;
    return real.call(fs, p, ...rest);
  };
  try {
    assert.throws(() => lib.add(dir, { label: 'a', description: 'd', state: 'ready' }), (e) => e === denied);
  } finally {
    fs.readdirSync = real;
  }
  assert.deepEqual(real.call(fs, path.join(dir, 'docs', 'todo')), []);
});

test('bodyChars folds whitespace and counts a CJK character once', () => {
  assert.equal(lib.MIN_BODY_CHARS, 200);
  assert.equal(lib.bodyChars('  a \n\n b  '), 3);
  assert.equal(lib.bodyChars('從哪來'), 3);
  assert.equal(lib.bodyChars(''), 0);
});
```

   At the end of `tests/todo-migrate-errors.test.js` (which already imports `fs`, `path`, `lib` and `tmp`) add:

```js
test('migrate removes TODO.md once every entry file is written, each body the original line first', () => {
  const dir = tmp('fankeel-migrate-rm-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [{ path: 'docs/todo', role: 'todo' }] }));
  fs.writeFileSync(path.join(dir, 'TODO.md'), ['# TODO', '', '## Ready', '', '- one thing', '- two things', ''].join('\n'));
  const r = lib.migrate(dir, Date.parse('2026-09-29T00:00:00Z'));
  assert.equal(r.open, 2);
  assert.equal(fs.existsSync(path.join(dir, 'TODO.md')), false);
  const bodies = lib.readFolder(dir, 'docs/todo').map((e) => e.body.split('\n')[0]);
  assert.deepEqual(bodies, ['one thing', 'two things']);
});
```

   In `tests/upgrade.test.js`, in the test `a project already on entry files has nothing pending`, replace

```js
  assert.match(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), /one/, 'the fixture has entries in TODO.md');
```

   with, in `tests/upgrade.test.js`:

```js
  assert.equal(fs.existsSync(path.join(dir, 'TODO.md')), false, 'add writes no TODO.md');
```

2. Run them and watch them fail:

```
node --test tests/todo-files.test.js tests/todo-migrate-errors.test.js tests/upgrade.test.js
```

3. Write the implementation. In `lib/todo.js`, replace the header comment's lines 5-10 with:

```js
// A project whose `.fankeel/docs.json` declares a bucket with role `todo`, and
// has that folder, keeps one file per entry there and nothing else: no
// `TODO.md` is generated. A project that does not keeps a hand-written
// `TODO.md`. `load` reads either and returns the shapes `entries()` and
// `timings()` give for the hand-written file, so orient, todo-check and the
// station compute what they computed before. Design:
// docs/90-agent/plans/2026-10-02-todo-folder-only-design.md.
```

   In `lib/todo.js`, below `const MAX_ENTRY_CHARS = 200;` add:

```js
// The least an open entry's body holds: where it came from (an incident, a
// session or a sha), what it should become, and what counts as done — enough
// that a reader weeks later need not go to git for the reason. Counted in
// characters once whitespace runs fold to one space; a CJK character is one.
const MIN_BODY_CHARS = 200;

function bodyChars(text) {
    return Array.from(String(text || '').replace(/\s+/g, ' ').trim()).length;
}
```

   In `lib/todo.js`, delete the `CONTRACT_PAGE` constant with its two comment lines (276-278), delete `preamble` (410-420) and `writeIndex` (470-476). In `render`, replace `const out = ['# TODO', '', ...preamble(root, folder), ''];` with `const out = ['# TODO', ''];`, and in `lib/todo.js` replace the comment above `render` with:

```js
// The index `load()` reads in memory and never writes: the four headings
// always, open entries by id under their state's heading, Blocked and Watch
// entries under one `### <group>` per group and timing, whose next line is the
// timing and the oldest stamp as MM-DD. An entry with a state outside the five
// is not printed; todo-check names it. `order` is the ids in bullet order.
```

   In `readFolder`'s comment, replace `"empty": returning [] would let writeIndex and add rewrite TODO.md` / `from nothing.` with `"empty": returning [] would let add pick an id already on disk.`

   In `add`, replace `if (!description) throw new Error('a description is required: it is the line TODO.md prints');` with `if (!description) throw new Error('a description is required: it is the line the index shows');`, and delete the line `writeIndex(root);` that follows `fs.writeFileSync(full, serialize({...}));`. In `close`, delete `writeIndex(root);`.

   In `lib/todo.js`, above `function migrate`, add:

```js
// The commit a migration read TODO.md at, for each entry's source line.
function headSha(root) {
    try {
        const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
            cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
        return sha || 'no commit';
    } catch (e) {
        return 'no commit';
    }
}
```

   In `lib/todo.js`, replace the comment above `migrate` with:

```js
// Once: a hand-written TODO.md and its completions page become entry files,
// each body the original line and a source line, and TODO.md is removed.
// `left` is every bullet under no known heading, which no entry carries —
// printed for a person to re-add.
```

   In `lib/todo.js`, replace the body of `migrate` from `const text = fs.readFileSync(path.join(root, 'TODO.md'), 'utf8');` to its `return` with:

```js
    const text = fs.readFileSync(path.join(root, 'TODO.md'), 'utf8');
    const records = completions(root).reverse();
    const source = '從 TODO.md 遷移，' + isoDay(at) + '，' + headSha(root);
    const bodyOf = (line) => line.replace(/\s+/g, ' ').trim() + '\n\n' + source;
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
            done: null, body: bodyOf(e.text),
        }));
    }
    const warned = [];
    for (const r of records) {
        const f = fromLine(r.original, linksIn(r.original)[0] || '', 'done');
        const dated = commitDay(root, r.sha);
        if (dated.warn) warned.push({ sha: r.sha, why: dated.warn });
        write(Object.assign(f, {
            group: '', timing: '', stamp: '', body: bodyOf(r.original),
            done: { at: dated.day || isoDay(at), sha: r.sha, disposition: r.disposition, session: '' },
        }));
    }
    // Every entry is on disk; the hand-written file goes, and its text stays
    // in git history and in each entry's body.
    fs.unlinkSync(path.join(root, 'TODO.md'));
    return { open: made.length - records.length, done: records.length, left, warned };
```

   Replace `module.exports` in `lib/todo.js` with:

```js
module.exports = {
    MAX_ENTRY_CHARS, MIN_BODY_CHARS, SECTIONS, TIMED, RETIRED, STALE_DAYS, REREAD_DAYS, MAX_TITLE_WIDTH, COMPLETIONS_PAGE,
    STATES, ID, ISO, DATE, conditionAt, mmdd, linksIn, entries, timings, bodyChars,
    isoDay, folderOf, parse, serialize, readFolder, render, fromLine, add, close, load, migrate,
};
```

   In `scripts/todo.js`, replace lines 4-24 (the usage comment through `FLAGS`) with:

```js
// The one writer of TODO entry files, a thin wrapper over lib/todo.js.
//
//   node todo.js list    [--root <dir>]
//   node todo.js new     --label <w> --title <t> --description <d> --state <s> --body <text>
//                        [--link <path>] [--group <title> --timing <cond> --stamp YYYY-MM-DD] [--id <id>]
//   node todo.js done    <id> --sha <sha> [--session <id>] [--disposition done] [--at YYYY-MM-DD]
//   node todo.js migrate [--root <dir>]

const { parseArgs } = require('node:util');

const todo = require('../lib/todo.js');
const { resolveRoot } = require('../lib/registry.js');

const USAGE = [
    'usage: todo.js list | new --label --title --description --state --body [--link --group --timing --stamp --id]',
    '       | done <id> --sha <sha> [--session <id>] [--disposition done] | migrate    [--root <dir>]',
].join('\n');

const FLAGS = ['root', 'label', 'title', 'description', 'state', 'body', 'link', 'group', 'timing', 'stamp', 'id',
    'sha', 'session', 'disposition', 'at'];
```

   In `scripts/todo.js`, replace the `if (cmd === 'index') { ... }` block and the `if (cmd === 'new') { ... }` block with:

```js
        if (cmd === 'list') {
            const loaded = todo.load(root, at);
            if (!loaded || loaded.mode !== 'folder') {
                return { text: 'fankeel todo: no todo folder under ' + root + ' — list reads entry files only', ok: false };
            }
            const open = loaded.all.filter((e) => e.state !== 'done');
            const lines = open.map((e) => e.state + ' ' + e.id + ' — ' + e.title);
            lines.push(open.length + ' open');
            return { text: lines.join('\n'), ok: true };
        }
        if (cmd === 'new') {
            const state = str('state') || 'decision';
            const body = str('body');
            if (!body.trim()) {
                return { text: 'fankeel todo: --body <text> is required — where it came from, what it should become,'
                    + ' and what counts as done', ok: false };
            }
            const n = todo.bodyChars(body);
            if (n < todo.MIN_BODY_CHARS) {
                return { text: 'fankeel todo: --body is ' + n + ' characters, at least ' + todo.MIN_BODY_CHARS
                    + ' — where it came from, what it should become, and what counts as done', ok: false };
            }
            const made = todo.add(root, {
                id: str('id'), label: str('label'), title: str('title'), description: str('description'), state,
                link: str('link'), group: str('group'), timing: str('timing'), body,
                stamp: str('stamp') || (state === 'blocked' || state === 'watch' ? todo.isoDay(at) : ''),
            });
            return { text: 'fankeel todo: ' + made.file, ok: true };
        }
```

   In `scripts/todo.js`'s `migrate` branch, replace `+ ' not migrated' + (r.left.length ? ' — under no known heading; re-add each with todo.js new:' : '')];` with `+ ' not migrated, TODO.md removed' + (r.left.length ? ' — under no known heading; re-add each with todo.js new:' : '')];`.

   Delete this repository's `TODO.md` (its text stays in git history).

4. Run them and watch them pass:

```
node --test tests/todo-files.test.js tests/todo-migrate-errors.test.js tests/upgrade.test.js
```

5. Commit: hand back; the controller commits.

## Task 2: todo-check refuses a root TODO.md and a thin body; orient names the folder

**Files:**
- Modify: `scripts/todo-check.js` — drop `stale index`; add `hand TODO.md` and `thin body`; `check()` takes a directory; `main` passes the root in folder mode
- Modify: `scripts/orient.js` — `todoBlock`'s `todo:` line and its two other `TODO.md` strings name the folder in folder mode
- Read: `lib/todo.js` — `MIN_BODY_CHARS`, `bodyChars`, `folderOf`, `load`, `serialize`, `add`, `close`
- Read: `lib/blame.js` — `orderByEdit` already orders by each entry file's last commit when every entry has `file` (`lib/blame.js:74-79`)
- Test: `tests/todo-check-folder.test.js`

**Interfaces:**
- Consumes: `MIN_BODY_CHARS`, `bodyChars(text)` from Task 1; `add` writing no `TODO.md` (Task 1)
- Produces: `check(target, now)` in `scripts/todo-check.js`, `target` a file path as before or a project directory; problem kinds `hand TODO.md` (`file: 'TODO.md'`) and `thin body` (`file:` the entry file); in folder mode `result.file` is the base joined with the folder; `orient`'s block opens `todo: <folder>/` in folder mode and `todo: TODO.md` otherwise.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing tests. In `tests/todo-check-folder.test.js`, below `const ORIENT = ...` add:

```js
// An open entry's body is at least 200 characters (lib/todo.js MIN_BODY_CHARS).
const BODY = 'b'.repeat(200);
```

   Add `body: BODY` to every `lib.add(...)` fields object in the file, and change the `put` defaults in `frontmatter rules land on the entry file` from `body: ''` to `body: BODY`. Delete every `lib.writeIndex(dir);` line, and the comment `// The body is not in the index, so blame of TODO.md sees no edit to a-1.`

   In `tests/todo-check-folder.test.js`, replace the first test (`a TODO.md that is what index writes is clean; a hand edit is a stale index`) with:

```js
test('with a todo folder the folder alone is clean, and a root TODO.md is refused', () => {
  const dir = root();
  lib.add(dir, { label: 'a', title: 'one', description: 'first — [a.md](docs/a.md).', state: 'ready', body: BODY });
  assert.equal(fs.existsSync(path.join(dir, 'TODO.md')), false);
  assert.deepEqual(kinds(dir), []);
  assert.deepEqual(check.check(dir).problems, [], 'a directory is checked the same as its TODO.md path');
  fs.writeFileSync(path.join(dir, 'TODO.md'), '# TODO\n\n- a hand line\n');
  const got = check.check(dir).problems;
  assert.deepEqual(got.map((p) => [p.file, p.kind]), [['TODO.md', 'hand TODO.md']]);
  assert.match(got[0].detail, /todo\.js migrate/);
  fs.unlinkSync(path.join(dir, 'TODO.md'));
  assert.deepEqual(kinds(dir), []);
});

test('an open entry needs a body of 200 characters; a done one needs none', () => {
  const dir = root();
  lib.add(dir, { label: 'a', title: 'thin', description: 'thin one', state: 'decision', body: 'b'.repeat(199) });
  lib.add(dir, { label: 'a', title: 'full', description: 'full one', state: 'decision', body: BODY });
  lib.add(dir, { label: 'a', title: 'shut', description: 'shut one', state: 'ready' });
  lib.close(dir, 'a-3', { sha: 'abcdef1', at: '2026-09-29' });
  const got = problems(dir).map((p) => p.file + ' ' + p.kind);
  assert.deepEqual(got, ['docs/todo/a-1.md thin body']);
  assert.match(problems(dir)[0].detail, /^199 characters, at least 200/);
});
```

   In the test `orient's todo: block in folder mode names the folder and every id it offers`, replace `assert.match(out, /^todo: TODO\.md, from docs\/todo\/$/m);` with `assert.match(out, /^todo: docs\/todo\/$/m);`.

2. Run it and watch it fail:

```
node --test tests/todo-check-folder.test.js
```

3. Write the implementation. In `scripts/todo-check.js`, replace line 4 `// Whether TODO.md is still an index.` with `// Whether the TODO entries are still an index.`, and in the destructuring that requires `lib/todo.js` add `MIN_BODY_CHARS, bodyChars,` after `ID, ISO, folderOf, load,`.

   In `scripts/todo-check.js`, replace the comment above `const TIMED_STATES` (lines 176-179) with:

```js
// Folder mode's own rules, one `{ line: 1, file }` problem per entry file.
// Nothing is generated, so a TODO.md at the root is a hand-written file that
// nothing reads; an entry file is never deleted, so one that was committed and
// is gone lost its record; an open entry's body is what a reader weeks later
// has instead of git, so a thin one is refused.
```

   In `scripts/todo-check.js`'s `folderProblems`, replace the `if (disk === null || ...) { ... stale index ... }` block with:

```js
    if (disk !== null) {
        out.push({ line: 1, file: 'TODO.md', kind: 'hand TODO.md', detail: 'this project keeps its entries under ' + folder
            + '/, so a root TODO.md is read by nothing. Move its lines in — `todo.js migrate` into an empty folder,'
            + ' `todo.js new` one by one otherwise — then delete it.' });
    }
```

   In `scripts/todo-check.js`, in the same loop of `folderProblems`, replace `if (!e.description) on(e.file, 'no description', 'the description is the line TODO.md prints.');` with:

```js
        if (!e.description) on(e.file, 'no description', 'the description is the line the index shows.');
        if (e.state !== 'done' && bodyChars(e.body) < MIN_BODY_CHARS) {
            on(e.file, 'thin body', bodyChars(e.body) + ' characters, at least ' + MIN_BODY_CHARS + ' — where it came from'
                + ' (an incident, a session or a sha), what it should become, and what counts as done.');
        }
```

   In `scripts/todo-check.js`, replace the opening of `check` — from `function check(file, now) {` through the `let disk = null; try { ... } catch (e) { ... }` block — with:

```js
// `target` is a TODO.md path, or a project directory: a directory reads as its
// own `TODO.md` in hand-written mode, and as its todo folder in folder mode.
function check(target, now) {
    const at = now === undefined ? Date.now() : now;
    let isDir = false;
    try {
        isDir = fs.statSync(target).isDirectory();
    } catch (e) { /* not there: a file path, and the read below says missing */ }
    const base = isDir ? target : path.dirname(target);
    let file = isDir ? path.join(target, 'TODO.md') : target;
    // Folder mode: the entries are the files under the project's `todo`
    // bucket, read through `load`; a TODO.md on disk is only asked whether it
    // is there.
    const folder = folderOf(base);
    let disk = null;
    try {
        disk = fs.readFileSync(file, 'utf8');
    } catch (e) {
        if (!folder) return { file, missing: true, problems: [], overdue: [], stale: [] };
    }
```

   In `scripts/todo-check.js`, directly after the `if (folder) { try { loaded = load(base, at); } catch ... }` block add:

```js
    if (folder) file = path.join(base, folder);
```

   In `scripts/todo-check.js`'s `main`, replace `const at = positionals[0] || path.join(resolveRoot(root || undefined), 'TODO.md');` with:

```js
    const resolved = resolveRoot(root || undefined);
    const at = positionals[0] || (folderOf(resolved) ? resolved : path.join(resolved, 'TODO.md'));
```

   In `scripts/orient.js`, in the comment above `todoBlock`, replace `is always the last option while TODO.md has an entry` with `is always the last option while there is an entry`, and `no TODO.md at \`dir\`` with `no TODO folder or TODO.md at \`dir\``. In `scripts/orient.js`'s `todoBlock`, replace the `try { loaded = todoFiles.load(dir, now); } catch (e) { ... }` block with:

```js
    try {
        loaded = todoFiles.load(dir, now);
    } catch (e) {
        let name = 'TODO.md';
        try {
            const f = todoFiles.folderOf(dir);
            if (f) name = f + '/';
        } catch (x) { /* the load error below is the one to show */ }
        return ['todo: ' + name, '  unreadable — ' + String((e && e.message) || e)];
    }
```

   Replace `const lines = ['todo: TODO.md' + (folder ? ', from ' + loaded.folder + '/' : ''),` with `const lines = ['todo: ' + (folder ? loaded.folder + '/' : 'TODO.md'),`, the comment `// patrol builds it — and the patrol is always the last one while TODO.md` with `// patrol builds it — and the patrol is always the last one while the TODO`, and `: 'TODO.md has no entries, not offered'));` with `: (folder ? loaded.folder + '/' : 'TODO.md') + ' has no entries, not offered'));`. `orderByEdit(dir, 'TODO.md', needs)` stays: in folder mode every entry carries `file`, and `lib/blame.js:74-79` orders by each file's last commit without reading `TODO.md`.

4. Run it and watch it pass; then the hand-written-mode suites, which must pass unchanged:

```
node --test tests/todo-check-folder.test.js
node --test tests/todo-check.test.js tests/orient.test.js
```

5. Commit: hand back; the controller commits.

## Task 3: the station carries `body` and writes 記成 TODO into the folder

**Files:**
- Modify: `lib/station.js:340-395` — `todoOf` puts `body` on every open and done row
- Modify: `scripts/station.js:210-560` — `addTodoFile` takes `body`, checks the directory, no `writeIndex`; `POST /todo` picks the project by folder or `TODO.md`
- Read: `lib/todo.js` — `add`, `fromLine`, `folderOf`, `load`
- Read: `scripts/todo-check.js` — `check(target)` taking a directory (Task 2)
- Test: `tests/station-todo-files.test.js`

**Interfaces:**
- Consumes: `check(dir)` from Task 2; `add(root, fields)` honouring `fields.body` and writing no `TODO.md` (Task 1)
- Produces: each row of `todoOf(dir).open` and `.done` carries `body: string` (`''` in hand-written mode); `POST /todo` reads a `body` form field; `addTodoFile(dir, text, link, body)`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing tests. In `tests/station-todo-files.test.js`, add below the `require` lines:

```js
const BODY = 'From the station, 2026-10-02: a question raised in the middle of a session and parked here. '
    + 'It should become one decided change, written down where the next session can pick it up. '
    + 'Done when the change lands and this entry is closed by the sha that landed it.';
```

   In `tests/station-todo-files.test.js`'s `fixture()`, add `body: BODY` to the three `lib.add(...)` calls. Rename the test `POST /todo in folder mode writes an entry file and regenerates TODO.md; a refused one leaves no file` to `POST /todo in folder mode writes an entry file with its body and no TODO.md; a refused one leaves no file`.

   In `tests/station-todo-files.test.js`, in that test, replace from `const ok = await post({ text: '〔station〕a new question', link: 'docs/station.md' });` through the `TODO.md` assertion with:

```js
        const thin = await post({ text: '〔station〕a new question', link: 'docs/station.md', body: 'too short' });
        assert.deepEqual([thin.status, thin.text.startsWith('thin body — ')], [400, true]);
        assert.deepEqual(fs.readdirSync(dir).sort(), before, 'a thin body leaves no file');
        const ok = await post({ text: '〔station〕a new question', link: 'docs/station.md', body: BODY });
        assert.equal(ok.status, 201);
        assert.equal(ok.text.trim(), 'station-1');
        const made = lib.parse(fs.readFileSync(path.join(dir, 'station-1.md'), 'utf8'));
        assert.deepEqual([made.label, made.state, made.link, made.body], ['station', 'decision', 'docs/station.md', BODY]);
        assert.equal(fs.existsSync(path.join(f.r1, 'TODO.md')), false, 'no TODO.md is written');
```

   At the end of `tests/station-todo-files.test.js` add (reading `row` the way the test `an unreadable entry file gives an error row and a visible panel line, not a project with no TODO` reads it):

```js
test('the project row carries each entry\'s body, open and done', () => {
    const f = fixture();
    const model = station.gather({ configDir: f.cfg, roots: [f.r1], scan: [], cwd: f.r1 });
    const text = station.serialize(model);
    const data = JSON.parse(text.slice('window.STATION = '.length, text.lastIndexOf(';')));
    const row = data.projects.find((p) => path.resolve(p.root) === path.resolve(f.r1));
    const t = row.todos[0];
    assert.deepEqual(t.open.map((e) => e.body), [BODY, BODY]);
    assert.deepEqual(t.done.map((e) => e.body), [BODY]);
});
```

2. Run it and watch it fail:

```
node --test tests/station-todo-files.test.js
```

3. Write the implementation. In `lib/station.js`, in `todoOf`'s folder-mode branch, replace the `return { mode: 'folder', ... };` with:

```js
        const bodyOf = new Map(loaded.all.map((e) => [e.id, e.body || '']));
        return {
            mode: 'folder', folder: loaded.folder,
            open: loaded.all.filter((e) => e.state !== 'done').sort((a, b) => at(a) - at(b)).map((e) => ({
                id: e.id, label: e.label, title: e.title, description: e.description, state: e.state,
                condition: e.timing, stamp: e.stamp, body: e.body || '',
            })),
            done: loaded.done.map((e) => ({ id: e.id, label: e.label, title: e.title, at: e.at, sha: e.sha,
                disposition: e.disposition, session: e.session, body: bodyOf.get(e.id) || '' })),
        };
```

   and in its hand-written branch, in the object returned per entry, add `body: ''` after the `stamp:` field.

   In `scripts/station.js`, replace `addTodoFile` with its comment:

```js
// 記成 TODO where the project keeps entry files: the entry is written through
// `lib/todo.js`'s `add`, the one writer, with the body the form sent, and the
// same before-and-after `check()` on the project directory decides — a
// problem the folder has now that it did not have before (a `thin body`, a
// dead link) is the refusal, and the file comes out again.
function addTodoFile(dir, text, link, body) {
    if (!String(text || '').trim()) return { status: 400, text: 'empty entry — nothing to write' };
    const key = (p) => p.kind + '\n' + p.detail;
    const had = new Map();
    for (const p of todoCheck.check(dir).problems) had.set(key(p), (had.get(key(p)) || 0) + 1);
    let made;
    try {
        made = todoFiles.add(dir, Object.assign(todoFiles.fromLine(text, link, 'decision'), { body: String(body || '').trim() }));
    } catch (e) {
        return { status: 400, text: e.message };
    }
    const seen = new Map();
    for (const p of todoCheck.check(dir).problems) {
        seen.set(key(p), (seen.get(key(p)) || 0) + 1);
        if (seen.get(key(p)) > (had.get(key(p)) || 0)) {
            fs.unlinkSync(made.path);
            return { status: 400, text: p.kind + ' — ' + p.detail };
        }
    }
    return { status: 201, text: made.id };
}
```

   In `scripts/station.js`'s `POST /todo` handler, replace from the comment `// The session's own project when it names one with a TODO.md, and` through `: addTodo(file, view.todoEntry(form.get('text') || '', form.get('link') || ''));` with:

```js
            // The session's own project when it keeps a todo folder or a
            // TODO.md, and the registry's root otherwise.
            const own = path.join(reg.root, row.project || '');
            const dir = todoFiles.folderOf(own) || fs.existsSync(path.join(own, 'TODO.md')) ? own : reg.root;
            const out = todoFiles.folderOf(dir)
                ? addTodoFile(dir, form.get('text') || '', form.get('link') || '', form.get('body') || '')
                : addTodo(path.join(dir, 'TODO.md'), view.todoEntry(form.get('text') || '', form.get('link') || ''));
```

4. Run it and watch it pass; the hand-written-mode station test must pass unchanged:

```
node --test tests/station-todo-files.test.js tests/station-todo.test.js
```

5. Commit: hand back; the controller commits.

## Task 4: the TODO panel expands a row's body

**Files:**
- Modify: `assets/station/station.js:2377-3125` — `todoPanelHtml` takes `bodyOpen`, draws a clickable row and a `todo-body` block; `view.tdBody` and its click and key handler beside `view.tdOpen`
- Modify: `assets/station/station.css:1609-1640` — `.td-has`, `.td-body`
- Test: `tests/station-todo-panel.test.js`

**Interfaces:**
- Consumes: `body` on each `todoOf` row (Task 3)
- Produces: `todoPanelHtml(t, sessions, doneOpen, bodyOpen)` — `bodyOpen` an object of `id: true`; a row with a body is `<li class="td-row td-has" data-tdbody="<id>" role="button" tabindex="0" aria-expanded="...">`, and an open one is followed by `<li class="td-body" data-block="todo-body">`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. At the end of `tests/station-todo-panel.test.js` add:

```js
test('a row with a body is clickable and opens a todo-body block under it; one without stays plain', () => {
    const row = Object.assign({}, ROW, { open: [
        Object.assign({}, ROW.open[0], { body: 'From `x`.\nSecond line <b>' }),
        ROW.open[1],
    ], done: [Object.assign({}, ROW.done[0], { body: 'closed because' }), ROW.done[1]] });
    const shut = V.todoPanelHtml(row, []);
    assert.match(shut, /<li class="td-row td-has" data-tdbody="a-1" role="button" tabindex="0" aria-expanded="false">/);
    assert.match(shut, /data-tdbody="c-1"/);
    assert.doesNotMatch(shut, /data-tdbody="b-1"|data-tdbody="c-2"/);
    assert.doesNotMatch(shut, /data-block="todo-body"/);
    const open = V.todoPanelHtml(row, [], false, { 'a-1': true });
    assert.match(open, /aria-expanded="true">/);
    assert.match(open, /<li class="td-body" data-block="todo-body">From <code>x<\/code>\.\nSecond line &lt;b&gt;<\/li>/);
    assert.equal((open.match(/data-block="todo-body"/g) || []).length, 1);
});
```

2. Run it and watch it fail:

```
node --test tests/station-todo-panel.test.js
```

3. Write the implementation. In `assets/station/station.js`, change `function todoPanelHtml(t, sessions, doneOpen) {` to `function todoPanelHtml(t, sessions, doneOpen, bodyOpen) {`, and below the line `var md = function (s) { ... };` add:

```js
        // A row with a body opens under itself on click or Enter; which are
        // open is the project page's `view.tdBody`, so a 3 s redraw keeps it.
        var opened = bodyOpen || {};
        var rowOpen = function (e, cls) {
            var has = !!(e.body && e.id), on = has && !!opened[e.id];
            return { on: on, head: '<li class="' + cls + (has ? ' td-has" data-tdbody="' + esc(e.id) + '" role="button" tabindex="0" aria-expanded="' + String(on) + '">' : '">') };
        };
        var bodyRow = function (e, r) {
            return r.on ? '<li class="td-body" data-block="todo-body">' + md(e.body) + '</li>' : '';
        };
```

   In the open list's row, replace `return '<li class="td-row">' + todoChip(e.label)` with `var r = rowOpen(e, 'td-row');` on its own line followed by `return r.head + todoChip(e.label)`, and replace that row's closing `+ '</li>';` with `+ '</li>' + bodyRow(e, r);`. In `doneRow`, replace `return '<li class="td-row' + (fold ? ' td-fold' : '') + '">' + todoChip(e.label)` with `var r = rowOpen(e, 'td-row' + (fold ? ' td-fold' : ''));` on its own line followed by `return r.head + todoChip(e.label)`, and its closing `+ '</li>';` with `+ '</li>' + bodyRow(e, r);`.

   In `assets/station/station.js`'s `projectPage`, replace `}, null), S.sessions, !!view.tdOpen);` with `}, null), S.sessions, !!view.tdOpen, view.tdBody);`. In `assets/station/station.js`, below the `view.tdOpen` click listener (the block after `view.tdOpen = false;` ending in `repaint();` and `});`) add:

```js
    // A TODO row with a body: click, Enter or Space flips it in
    // `view.tdBody`, which, like `view.tdOpen`, holds across the redraw.
    view.tdBody = {};
    var tdBody = function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-tdbody]') : null;
        if (!b) return;
        if (e.type === 'keydown') {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
        }
        var id = b.getAttribute('data-tdbody');
        view.tdBody[id] = !view.tdBody[id];
        repaint();
    };
    doc.addEventListener('click', tdBody);
    doc.addEventListener('keydown', tdBody);
```

   In `assets/station/station.css`, below `.td-d code{font-family:var(--f-mono);font-size:.92em}` add:

```css
.td-row.td-has{cursor:pointer}
.td-row.td-has:hover .td-t{text-decoration:underline;text-underline-offset:3px}
.td-row.td-has:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}
.td-body{padding:8px 10px 12px 136px;border-bottom:1px solid var(--rule);font-size:12.5px;line-height:1.6;color:var(--ink2);white-space:pre-wrap;overflow-wrap:anywhere}
.td-body code{font-family:var(--f-mono);font-size:.92em}
```

   and inside `@container (max-width:820px){ ... }`, before its closing `}`, add `  .td-body{padding-left:10px}`.

4. Run it and watch it pass:

```
node --test tests/station-todo-panel.test.js tests/station-i18n.test.js
```

5. The rendered page, once Tasks 10-15 have written the bodies: serve the station, open this project's page, press 展開全部 so every done row shows, and count the clickable rows; it equals the number of entry files whose body is non-empty:

```
node scripts/station.js serve --detach --open
node -e "const t=require('./lib/todo.js');console.log(t.readFolder('.','docs/90-agent/todo').filter((e)=>e.body.trim()).length)"
```

   In the browser console: `document.querySelectorAll('[data-tdbody]').length`. The look of `todo-body` is tuned live with `tune.js` by `data-block`; no mockup was drawn at design.

6. Commit: hand back; the controller commits.

## Task 5: 記成 TODO's form sends a body, and its copy holds in both modes

**Files:**
- Modify: `assets/station/station.js:4340-4805` — `todoSpot` adds a body textarea and mode-neutral copy; the `[data-todo]` click handler posts `body`; the written message
- Modify: `assets/station/i18n.js:835-880` — English for the changed and new keys
- Test: `tests/station-todo.test.js`
- Test: `tests/station-hdl-i.test.js`

**Interfaces:**
- Consumes: `POST /todo` reading `body` (Task 3)
- Produces: served `todoSpot` carries `<textarea class="tdbd" ...>`; loc key `todo.bodyLabel`; the ok message reads `記下了：`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing tests. In `tests/station-todo.test.js`, in the test `the file on disk prints the line to copy; the served page a form carrying the session`, after `assert.match(form, /data-todo>送出/);` add:

```js
    assert.match(form, /<textarea class="tdbd" rows="5" spellcheck="false"><\/textarea>/);
    assert.match(form, /body（有 todo 資料夾時必填，至少 200 字元/);
    assert.match(onDisk, /todo\.js new/, 'the copy line names both modes');
```

   In `tests/station-hdl-i.test.js`, rename the test `todo: an ok answer shows 寫進 TODO.md： and the trimmed body` to `todo: an ok answer shows 記下了： and the trimmed body`, and replace `assert.equal(box.said.textContent, '寫進 TODO.md：- the line');` with `assert.equal(box.said.textContent, '記下了：- the line');`.

2. Run them and watch them fail:

```
node --test tests/station-todo.test.js tests/station-hdl-i.test.js
```

3. Write the implementation. In `assets/station/station.js`, in the comment above `todoEntry`, replace `// One line for TODO.md's \`## Needs a decision\`, in the shape todo-check` with `// One TODO line — an entry's description, or a TODO.md bullet — in the shape todo-check`. In `assets/station/station.js`'s `todoSpot`, replace the on-disk `loc('todo.staticPageCopyLine', ...)` call with:

```js
loc('todo.staticPageCopyLine', '靜態頁不寫檔：有 todo 資料夾就用 todo.js new 記下這一行，否則貼進 TODO.md 的 ## Needs a decision。')
```

   In `assets/station/station.js`'s `todoSpot`, in the served form, replace from `+ '<label>' + loc('todo.entryLabel', ...` through the `todo.checkedBeforeSubmit` help line with:

```js
            + '<label>' + loc('todo.entryLabel', '條目（一行：todo 資料夾的 description，或 TODO.md 的 ## Needs a decision）') + '</label><textarea rows="2" spellcheck="false">'
            + esc(text) + '</textarea><label>' + loc('todo.link', '連結') + '</label><input type="text" spellcheck="false" value="' + esc(link) + '">'
            + '<label>' + loc('todo.bodyLabel', 'body（有 todo 資料夾時必填，至少 200 字元：從哪來、要做成什麼樣、怎樣算完成）') + '</label><textarea class="tdbd" rows="5" spellcheck="false"></textarea>'
            + '<div class="help">' + loc('todo.checkedBeforeSubmit', '送出前跑 todo-check 的同一套規則：條目 ≤ 200 字元、連結要存在、不指向 plan、decision、report、archive；有 todo 資料夾時 body 至少 200 字元。') + '</div>'
```

   In the `[data-todo]` click handler, after `body.set('link', box.querySelector('input').value);` add `body.set('body', box.querySelector('textarea.tdbd').value);`, and replace `loc('cmp.writtenToTodoColon', '寫進 TODO.md：')` with `loc('cmp.writtenToTodoColon', '記下了：')`.

   In `assets/station/i18n.js`, replace the English entries for `todo.staticPageCopyLine`, `todo.entryLabel` and `todo.checkedBeforeSubmit`, adding `todo.bodyLabel` directly below `todo.entryLabel`:

```js
            'todo.staticPageCopyLine': 'A static page cannot write a file: record this line with todo.js new where there is a todo folder, or paste it under TODO.md’s ## Needs a decision.',
            'todo.entryLabel': 'Entry (one line: a todo folder entry’s description, or a TODO.md bullet under ## Needs a decision)',
            'todo.bodyLabel': 'Body (required with a todo folder, at least 200 characters: where it came from, what it should become, what counts as done)',
            'todo.checkedBeforeSubmit': 'Checked before sending against the same todo-check rules: the entry ≤ 200 characters, the link must exist and must not point at plan, decision, report or archive; with a todo folder, a body of at least 200 characters.',
```

   and replace `'cmp.writtenToTodoColon': 'Written to TODO.md: ',` with `'cmp.writtenToTodoColon': 'Recorded: ',`.

4. Run them and watch them pass:

```
node --test tests/station-todo.test.js tests/station-hdl-i.test.js tests/station-i18n.test.js
```

5. Commit: hand back; the controller commits.

## Task 6: init asks before migrating; the TODO reference and CONTRIBUTING describe both modes

**Files:**
- Modify: `skills/fankeel-init/SKILL.md` — section 3 asks: move into docs, or keep `TODO.md`
- Modify: `docs/90-agent/reference/todo.md` — rewritten for both modes, `list`, `--body`, the body's three parts, the two new rules, `migrate`
- Modify: `CONTRIBUTING.md` — the `TODO.md` row becomes the TODO entries row
- Test: `tests/init-todo-ask.test.js`

**Interfaces:**
- Consumes: `todo.js list`, `--body`, `migrate` removing `TODO.md` (Task 1); `hand TODO.md` and `thin body` (Task 2)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus one test.

1. Write the failing test, `tests/init-todo-ask.test.js`:

```js
'use strict';

// fankeel-init section 3: a TODO.md already there is a question — move it into
// docs or keep it — never a migration done without asking
// (docs/90-agent/plans/2026-10-02-todo-folder-only-design.md §3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL = path.join(__dirname, '..', 'skills', 'fankeel-init', 'SKILL.md');

test('init section 3 asks before migrating a TODO.md, with both options', () => {
  const text = fs.readFileSync(SKILL, 'utf8');
  const from = text.indexOf('## 3. TODO');
  const to = text.indexOf('## 4.', from);
  assert.ok(from !== -1 && to > from, 'section 3 is there');
  const s = text.slice(from, to);
  assert.match(s, /ask one question first/);
  assert.match(s, /\*\*Move it into docs\*\*/);
  assert.match(s, /\*\*Keep the hand-written `TODO\.md`\*\*/);
  assert.match(s, /todo\.js migrate --root <project>/);
  assert.match(s, /thin body/);
});
```

2. Run it and watch it fail:

```
node --test tests/init-todo-ask.test.js
```

3. Write the text. In `skills/fankeel-init/SKILL.md`, replace the two bullets under `## 3. TODO` with:

```md
- A `TODO.md` already there: ask one question first, two options.
  **Move it into docs**: declare a `role: todo` bucket — `docs/90-agent/todo`
  under `audience` — run `node <plugin>/scripts/todo.js migrate --root <project>`
  (each line becomes an entry file whose body is that line and a source line,
  and `TODO.md` is removed; its text stays in git history), then
  `node <plugin>/scripts/todo-check.js --root <project>`. Every open entry it
  names `thin body` gets its body written from that line's history — `git log`
  on the old `TODO.md` finds the commit that brought the line in — in three
  parts: where it came from, what it should become, what counts as done, at
  least 200 characters together. **Keep the hand-written `TODO.md`**: declare
  no bucket; `orient`, todo-check and the station go on reading it, and
  `todo.js migrate` can move it in any later day.
- None: declare the same bucket and create its empty folder.
```

   and set its frontmatter `last_verified: 2026-10-02`.

   Replace `docs/90-agent/reference/todo.md` whole with:

```md
---
status: current
last_verified: 2026-10-02
source_of_truth: lib/todo.js, scripts/todo.js, scripts/todo-check.js
---

# TODO entries

A deferred thing is one file under the project's `todo` bucket — in this
repository `docs/90-agent/todo/` — and nothing is generated from those files:
there is no `TODO.md` beside them. A project whose `.fankeel/docs.json`
declares no `todo` bucket keeps a hand-written `TODO.md` under the same four
headings; `load()` in `lib/todo.js` reads either and returns the same shapes,
so `orient`, todo-check and the station do not care which.

`fankeel-init` asks a project that already has a `TODO.md` which it wants:
move it into docs (declare the bucket, run `todo.js migrate`) or keep the
hand-written file. Kept, it can be moved in any later day with the same
command.

## The entry file

One file per entry, named `<id>.md`, the id a lowercase kebab slug that is
never reused. Its frontmatter:

| field | what |
|---|---|
| `label` | the area — the word a `TODO.md` bullet opens with in `〔〕`; it groups nothing |
| `title` | at most 28 columns, a CJK character counting two |
| `description` | the one line `orient`, `todo.js list` and the station show; with the label and the link, at most 200 characters |
| `state` | `ready`, `decision`, `blocked`, `watch` or `done` |
| `link` | optional: the detail page, relative to the repository root |
| `group` | `blocked` and `watch` only: the `### <title>` its timing is listed under, at most 28 columns |
| `timing` | `blocked` and `watch` only: `on: MM-DD`, `after: <work>` or `upstream: <release>` for `blocked`; `if: <event>` for `watch` |
| `stamp` | `blocked` and `watch` only: `YYYY-MM-DD`, the day somebody last read the timing and agreed it still holds |
| `done` | a closed entry only: `at`, `sha`, `disposition` — `done`, `measured-no-change` or `abandoned` — and, where known, `session` |

## The body

Every entry that is not `done` carries a body of at least 200 characters, in
three parts, so that a reader weeks later need not go to git for the reason:

1. where it came from — the incident, the session or the sha that raised it;
2. what it should become — the change, in a sentence or two;
3. what counts as done — the check that says it is finished.

A `done` entry needs none. The station's project page opens a row's body
under it on click. A reference page about the system is not where the work's
own detail goes.

## The four states

The state answers one question: what is this still waiting for? Not what it is
about — the label answers that. In a hand-written `TODO.md` each state is a
heading.

| state | heading | waiting for | what `/fankeel` does with it |
|---|---|---|---|
| `ready` | `## Ready` | someone's hands; the entry is the specification | never an option of its own; the patrol builds it |
| `decision` | `## Needs a decision` | a person, to settle what the change should be | the newest few `orient` lists, one option each |
| `blocked` | `## Blocked` | something a session can check: a date, other work, an upstream release | every timing listed; the patrol, always the last option, walks them |
| `watch` | `## Watch` | an event only whoever meets it will know of | every timing listed; the patrol asks keep-or-drop of a stale one |

Entries sharing a `group` and a `timing` are listed under one `### <group>`,
with the timing and the oldest of their stamps as `MM-DD`. A `blocked` timing
with `on:` is due that day; `after:` and `upstream:` are due once the stamp is
seven days old, and the patrol's survey goes and checks them. A `watch` timing
is never due: at sixty days it is stale, and the patrol asks only whether to
keep it — kept, the stamp moves forward. Whoever meets the event an `if:`
names moves the entry to `ready` or `decision` and drops its `group`,
`timing` and `stamp`.

## Opening, listing and closing one

- `node scripts/todo.js new --label <word> --title <title> --description <line> --state <state> --body <text>`,
  with `--link`, and `--group`, `--timing` and `--stamp` for a timed one,
  writes the file. It refuses an entry with no `--body` or one under 200
  characters.
- `node scripts/todo.js list` prints `<state> <id> — <title>` for each open
  entry and the total on its last line; the patrol's count of entries is that
  total.
- `task.js start --todo <id>`, once per entry, links a session to the entries
  it means to close; `orient`'s `todo:` block prints the ids it offers.
- `task.js stage land` prints `todo.js done <id> --sha <sha> --session <id>`
  for each; run it with the sha that landed the work. The entry turns
  `state: done` with a `done:` record, and the file stays.
- `node scripts/todo.js migrate` converts a hand-written `TODO.md` and its
  completions page into entry files, once, into an empty folder: each body is
  the original line and `從 TODO.md 遷移，<date>，<sha>`, and `TODO.md` is
  removed — its text stays in git history. The completions page
  (`todo-completions.md`) is the record in hand-written mode only, and this
  repo's was archived to `docs/99-archive/2026-09-29-todo-completions.md`.

`sha` is the durable link: `.fankeel/sessions/` is per machine and
gitignored, so a `session` id resolves only where it ran. The station's
project page lists done entries newest first, linking the session where this
machine has it and showing the short sha where it does not.

## What todo-check refuses

`node scripts/todo-check.js` reads the folder and fails on: a `TODO.md` at the
root beside a todo folder, which nothing reads; an open entry whose body is
under 200 characters; a committed entry file that is gone; an id that is not a
kebab slug; a state outside the five; a missing title or one over 28 columns;
a missing description; a line over 200 characters; a `blocked` or `watch`
entry with no `stamp`, no `group`, or a timing of the other state's kind; an
`on:` with no `MM-DD`; a `done` entry with no `sha`; a link that does not
resolve or lands on a plan, decision, report or archive. It prints, without
failing, the due and stale timings and the `decision` entries whose file
nobody has committed in seven days. A hand-written `TODO.md` is checked by the
same rules that apply to a line.
```

   In `CONTRIBUTING.md`, replace the row beginning `| \`TODO.md\` | the entry files under` with:

```md
| TODO entries | the entry files under `docs/90-agent/todo/`, written by `scripts/todo.js` | One file per deferred thing, its `state` saying what it is still short of and its body — at least 200 characters — saying where it came from, what it should become and what counts as done. There is no `TODO.md` here; `todo-check` refuses one beside the folder. The contract is [docs/90-agent/reference/todo.md](docs/90-agent/reference/todo.md). |
```

   and in the `Borrowing from another repository` row replace `a \`TODO.md\` entry or a recorded incident` with `a TODO entry or a recorded incident`.

4. Run it and watch it pass, then the reference checks:

```
node --test tests/init-todo-ask.test.js tests/skills.test.js
node scripts/docs-check.js
```

5. Commit: hand back; the controller commits.

## Task 7: stage rules, README and the build skill say TODO for both modes

**Files:**
- Modify: `lib/stages.js:150-395` — lines 154, 163, 303, 317, 392, each shorter than before; line 154 keeps `TODO.md`
- Modify: `README.md` — the build template's `deferred:` line (130), the intro sentence (34), the `todo-check.js` tree row (244)
- Modify: `skills/fankeel-build/SKILL.md:30-760` — lines 38, 645, 752 and the frontmatter
- Test: `tests/task-todo.test.js`
- Read: `tests/stages.test.js` — line 633 asserts INIT names TODO.md
- Read: `tests/inject.test.js` — line 437 asserts the same of the injected init rules

**Interfaces:**
- Consumes: none
- Produces: the land rule's text `Close the TODO entries this work finished` (read by `tests/task-todo.test.js`); `INIT` still names `TODO.md` (read by `tests/stages.test.js:633`, `tests/inject.test.js:437`).

**Dispatch:** implementer, sonnet — the plan carries the strings; transcription plus tests.

1. Write the failing test. In `tests/task-todo.test.js` (which already imports `fs`, `path` and `byName`), in `the land rule names the todo.js done lines and still runs todo-check`, replace `r.includes('TODO.md entries')` with `r.includes('Close the TODO entries')`, and at the end of `tests/task-todo.test.js` add:

```js
test('the stage rules say TODO, not TODO.md, where both modes are meant', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'stages.js'), 'utf8');
  assert.doesNotMatch(src, /Read `TODO\.md` at the root|TODO\.md clusters|one TODO\.md entry|<TODO\.md entry|Close the TODO\.md entries/);
});
```

2. Run it and watch it fail:

```
node --test tests/task-todo.test.js
```

3. Write the strings. In `lib/stages.js`:

   - line 154: replace `'Read \`TODO.md\` at the root if there is one. Its headings` with `'Read the TODO: \`orient\`\'s \`todo:\` block, bucket or \`TODO.md\`. Its headings`; in the same string replace `offers what \`orient\`\'s \`todo:\` lists,` with `offers what it lists,` and `no \`TODO.md\` means guessing from the commits.` with `no TODO means guessing from the commits.` The string ends shorter than it began, and still names `TODO.md`, which `tests/stages.test.js:633` and `tests/inject.test.js:437` require.
   - line 163: `'<the TODO.md clusters, or the recent commits>'` becomes `'<the TODO clusters, or the recent commits>'`.
   - line 303: `is one TODO.md entry at the detail.` becomes `is one TODO entry at the detail.`
   - line 317: `'deferred: <heading> — <TODO.md entry, or omit this line>'` becomes `'deferred: <heading> — <TODO entry, or omit this line>'`.
   - line 392: `'Close the TODO.md entries this work finished,` becomes `'Close the TODO entries this work finished,`.

   In `README.md`: line 130 becomes `deferred: <heading> — <TODO entry, or omit this line>`; on line 34 replace `read from \`TODO.md\` where the root has one` with `read from the project's TODO — its todo folder, or a root \`TODO.md\``; line 244's row text `whether TODO.md is still an index` becomes `whether the TODO entries are still an index`.

   In `skills/fankeel-build/SKILL.md`: line 38's row becomes `| A new ask from mid-build routed to a TODO entry instead of built | That is the routing rule working, not the ask dropped — \`lib/stages.js:303\` (\`is one TODO entry at the detail\`), not silence. |`; on line 645 replace `(\`todo.js new\` in folder mode; a \`TODO.md\` line in legacy mode)` with `(\`todo.js new --body\` in folder mode; a \`TODO.md\` line in hand-written mode)`; line 752 becomes `deferred: <heading> — <TODO entry, or omit this line>`. Set its frontmatter `last_verified: 2026-10-02`.

4. Run it and watch it pass, with the suites that hold the budget, the init rules and the README template:

```
node --test tests/task-todo.test.js tests/stages.test.js tests/inject.test.js tests/render.test.js
node scripts/docs-check.js
```

5. Commit: hand back; the controller commits.

## Task 8: the `/fankeel` and survey skills read the TODO in both modes

**Files:**
- Modify: `skills/fankeel/SKILL.md:645-780` — lines 652, 666, 751-752, 762, 772-773
- Modify: `skills/fankeel-survey/SKILL.md` — the patrol's lines 314-325 and 366, and the frontmatter
- Read: `scripts/todo.js` — `list`'s last line (Task 1)
- Test: `tests/skills.test.js` — the patrol's count-line assertion (line 1349)

**Interfaces:**
- Consumes: `todo.js list`'s last line `<n> open` (Task 1)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus a test and a grep check.

1. Write the failing test. In `tests/skills.test.js`, rename the test `the patrol lists every TODO.md entry with a count, and says the controller prints it` to `the patrol lists every TODO entry with a count, and says the controller prints it`, and replace

```js
  assert.match(section, /`entries: <n> listed, <m> in TODO\.md`/);
```

   with, in `tests/skills.test.js`:

```js
  assert.match(section, /`entries: <n> listed, <m> in TODO`, where `<m>` is the total/);
  assert.match(section, /todo\.js list/);
```

   The grep below prints four lines now, and none when this task is done:

```
node --test tests/skills.test.js
grep -n "is then generated, never edited\|Read \`TODO.md\` first where the root\|every entry in \`TODO.md\`,$\|<m> in TODO.md\`" skills/fankeel/SKILL.md skills/fankeel-survey/SKILL.md
```

2. Write the text. In `skills/fankeel/SKILL.md`:

   - line 652, the `Work deliberately deferred` row: replace `one entry: \`node <plugin>/scripts/todo.js new\` where the project keeps a \`todo\` bucket — \`TODO.md\` is then generated, never edited — otherwise one \`TODO.md\` line,` with `one entry: \`node <plugin>/scripts/todo.js new ... --body <text>\` where the project keeps a \`todo\` bucket — no \`TODO.md\` is generated, and the body says where it came from, what it should become and what counts as done, at least 200 characters — otherwise one \`TODO.md\` line,`.
   - line 666: `\`TODO.md\` is an index whose bullets \`init\` also offers` becomes `The TODO — the todo bucket's entries, or a hand-written \`TODO.md\` — is an index whose entries \`init\` also offers`.
   - lines 751-752: `**Read \`TODO.md\` first where the root` / `has one**: its headings are the clustering,` becomes `**Read the TODO first — \`orient\`'s \`todo:\` block, from the todo bucket or a root \`TODO.md\`**: its headings are the clustering,`.
   - line 762: `\`TODO.md\` has an entry: it walks every heading,` becomes `the TODO has an entry: it walks every heading,`.
   - lines 772-773: `A repository with no` / `\`TODO.md\` is where guessing from the recent commits belongs,` becomes `A repository with no TODO — no \`todo:\` block — is where guessing from the recent commits belongs,`.

   In `skills/fankeel-survey/SKILL.md`, rewrite lines 314-315 and 318 so they read:

```md
labelled `TODO 全表盤點`, offered whenever the TODO has an entry — arrives on
`--route "survey,plan,build,verify,land"`, and this stage walks every entry —
each open entry file in the todo bucket, or each bullet of a hand-written `TODO.md` —
not only the timings.

**Every entry, one line each.** The report lists every entry —
```

   In `skills/fankeel-survey/SKILL.md`, rewrite lines 324-325 so they read:

```md
line, `entries: <n> listed, <m> in TODO`, where `<m>` is the total on the
last line of `node <plugin>/scripts/todo.js list` in folder mode, and what
`grep -c '^- ' TODO.md` prints in a hand-written one; the two are equal, or the missing entries are
```

   keeping the lines between them as they are. On line 366 replace `` `TODO.md`'s own order, `` with `` the order `orient` lists them in, ``. Set both files' frontmatter `last_verified: 2026-10-02`.

3. (No code beyond the text.)

4. Run the test and watch it pass, the grep print nothing, and the other checks stay green:

```
node --test tests/skills.test.js tests/skills-cli.test.js
grep -n "is then generated, never edited\|Read \`TODO.md\` first where the root\|every entry in \`TODO.md\`,$\|<m> in TODO.md\`" skills/fankeel/SKILL.md skills/fankeel-survey/SKILL.md
node scripts/docs-check.js
```

5. Commit: hand back; the controller commits.

## Task 9: the land and audit skills close and route TODO entries in both modes

**Files:**
- Modify: `skills/fankeel-land/SKILL.md` — lines 64-65, 76, 137
- Modify: `skills/fankeel-audit/SKILL.md` — lines 19, 209, 282
- Read: `scripts/todo.js` — `new --body` (Task 1)

**Interfaces:**
- Consumes: `todo.js new --body` (Task 1)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus a grep check.

1. The check that fails now — it prints four lines, and none when this task is done:

```
grep -n "Close the \`TODO.md\` entries\|added a bullet to \`TODO.md\`\|its \`TODO.md\` heading\|^\`TODO.md\` entries point at plans" skills/fankeel-land/SKILL.md skills/fankeel-audit/SKILL.md
```

2. Write the text. In `skills/fankeel-land/SKILL.md`:

   - line 64: `Close the \`TODO.md\` entries this work finished` becomes `Close the TODO entries this work finished`; line 65's `legacy \`TODO.md\`: remove the line` becomes `hand-written \`TODO.md\`: remove the line`.
   - line 76: `When this session's diff added a bullet to \`TODO.md\` (folder mode: a new entry file from \`todo.js new\`) that was not there in` becomes `When this session's diff added a TODO entry (folder mode: a new entry file from \`todo.js new\`; hand-written: a \`TODO.md\` bullet) that was not there in`.
   - line 137: `folder mode: a new entry via \`todo.js new\`; legacy \`TODO.md\`:` becomes `folder mode: a new entry via \`todo.js new --body\`; hand-written \`TODO.md\`:`.

   In `skills/fankeel-audit/SKILL.md`:

   - line 19: `its \`TODO.md\` heading.` becomes `its TODO state — the entry's \`state\`, or its \`TODO.md\` heading.`
   - line 209: `(folder mode: \`todo.js new --state decision\`; legacy \`TODO.md\`: under \`## Needs a decision\`)` becomes `(folder mode: \`todo.js new --state decision --body <text>\`; hand-written \`TODO.md\`: under \`## Needs a decision\`)`.
   - line 282: `` `TODO.md` entries point at plans. `` becomes `TODO entries point at plans — an entry's \`link\`, or a \`TODO.md\` line's.`

   Set both files' frontmatter `last_verified: 2026-10-02`.

3. (No code beyond the text.)

4. Run the check and watch it print nothing, then:

```
grep -n "Close the \`TODO.md\` entries\|added a bullet to \`TODO.md\`\|its \`TODO.md\` heading\|^\`TODO.md\` entries point at plans" skills/fankeel-land/SKILL.md skills/fankeel-audit/SKILL.md
node --test tests/skills.test.js
node scripts/docs-check.js
```

5. Commit: hand back; the controller commits.

## Task 10: bodies for audit-1, build-1, entry-1

**Files:**
- Modify: `docs/90-agent/todo/audit-1.md` — body (Trovara 的 docs 搬到 preset)
- Modify: `docs/90-agent/todo/build-1.md` — body (knip unused exports 未開)
- Modify: `docs/90-agent/todo/entry-1.md` — body (多目標交付要不要 compiler)
- Read: `scripts/todo-check.js` — the `thin body` rule (Task 2)
- Read: `docs/90-agent/reference/todo.md` — the body's three parts (Task 6)

**Interfaces:**
- Consumes: `thin body` (Task 2)
- Produces: none

**Dispatch:** implementer, sonnet — each body is read out of git, not invented; the plan carries the procedure.

1. The check that fails now names these three as `thin body`:

```
node scripts/todo-check.js
```

2. For each of the three files, find its origin, in this order, stopping at the first that answers; then open its `link` page if it has one. Do not write from memory or from the description alone:

```
git log --format="%h %cs %s" --follow -- docs/90-agent/todo/<id>.md
git log -S "<a distinctive phrase from its description>" --format="%h %cs %s" -- TODO.md
git show <sha> --stat
```

3. Write the body below the frontmatter's closing `---` — a blank line, then three short paragraphs, at least 200 characters together: `來源：` the commit (short sha and date), session or incident that brought the line in and what was happening; `要做成：` the change, in a sentence or two; `完成條件：` the check that says it is finished. Where nothing in git or the link page says where it came from, the first paragraph opens `來源不明：` and says what was searched and what came back, and the id goes in your handoff under `來源不明`. Change nothing in the frontmatter.

4. Run the check and watch it name none of the three:

```
node scripts/todo-check.js
```

5. Commit: hand back; the controller commits.

## Task 11: bodies for quota-1, security-1, test-1

**Files:**
- Modify: `docs/90-agent/todo/quota-1.md` — body (7d 水位差 4.7 倍的成因)
- Modify: `docs/90-agent/todo/security-1.md` — body (Security lens 交本地模型篩)
- Modify: `docs/90-agent/todo/test-1.md` — body (一次性整套測試失敗未重現)
- Read: `scripts/todo-check.js` — the `thin body` rule (Task 2)
- Read: `docs/90-agent/reference/todo.md` — the body's three parts (Task 6)

**Interfaces:**
- Consumes: `thin body` (Task 2)
- Produces: none

**Dispatch:** implementer, sonnet — each body is read out of git, not invented; the plan carries the procedure.

1. The check that fails now names these three as `thin body`:

```
node scripts/todo-check.js
```

2. For each of the three files, find its origin, in this order, stopping at the first that answers; then open its `link` page if it has one. Do not write from memory or from the description alone:

```
git log --format="%h %cs %s" --follow -- docs/90-agent/todo/<id>.md
git log -S "<a distinctive phrase from its description>" --format="%h %cs %s" -- TODO.md
git show <sha> --stat
```

3. Write the body below the frontmatter's closing `---` — a blank line, then three short paragraphs, at least 200 characters together: `來源：` the commit (short sha and date), session or incident that brought the line in and what was happening; `要做成：` the change, in a sentence or two; `完成條件：` the check that says it is finished. Where nothing in git or the link page says where it came from, the first paragraph opens `來源不明：` and says what was searched and what came back, and the id goes in your handoff under `來源不明`. Change nothing in the frontmatter.

4. Run the check and watch it name none of the three:

```
node scripts/todo-check.js
```

5. Commit: hand back; the controller commits.

## Task 12: bodies for survey-1, survey-2, stage-agents-1

**Files:**
- Modify: `docs/90-agent/todo/survey-1.md` — body (Unlisted language patterns)
- Modify: `docs/90-agent/todo/survey-2.md` — body (graphify 接為查詢工具)
- Modify: `docs/90-agent/todo/stage-agents-1.md` — body (stage.agents 設 all 實跑量測)
- Read: `scripts/todo-check.js` — the `thin body` rule (Task 2)
- Read: `docs/90-agent/reference/todo.md` — the body's three parts (Task 6)

**Interfaces:**
- Consumes: `thin body` (Task 2)
- Produces: none

**Dispatch:** implementer, sonnet — each body is read out of git, not invented; the plan carries the procedure.

1. The check that fails now names these three as `thin body`:

```
node scripts/todo-check.js
```

2. For each of the three files, find its origin, in this order, stopping at the first that answers; then open its `link` page if it has one. Do not write from memory or from the description alone:

```
git log --format="%h %cs %s" --follow -- docs/90-agent/todo/<id>.md
git log -S "<a distinctive phrase from its description>" --format="%h %cs %s" -- TODO.md
git show <sha> --stat
```

3. Write the body below the frontmatter's closing `---` — a blank line, then three short paragraphs, at least 200 characters together: `來源：` the commit (short sha and date), session or incident that brought the line in and what was happening; `要做成：` the change, in a sentence or two; `完成條件：` the check that says it is finished. Where nothing in git or the link page says where it came from, the first paragraph opens `來源不明：` and says what was searched and what came back, and the id goes in your handoff under `來源不明`. Change nothing in the frontmatter.

4. Run the check and watch it name none of the three:

```
node scripts/todo-check.js
```

5. Commit: hand back; the controller commits.

## Task 13: bodies for stage-agents-2, stage-agents-3, stage-agents-4

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-2.md` — body (design 跨輪對話未實跑)
- Modify: `docs/90-agent/todo/stage-agents-3.md` — body (接縫「站 agent 做不到的事」)
- Modify: `docs/90-agent/todo/stage-agents-4.md` — body (接縫「第二個 agent」)
- Read: `scripts/todo-check.js` — the `thin body` rule (Task 2)
- Read: `docs/90-agent/reference/todo.md` — the body's three parts (Task 6)

**Interfaces:**
- Consumes: `thin body` (Task 2)
- Produces: none

**Dispatch:** implementer, sonnet — each body is read out of git, not invented; the plan carries the procedure.

1. The check that fails now names these three as `thin body`:

```
node scripts/todo-check.js
```

2. For each of the three files, find its origin, in this order, stopping at the first that answers; then open its `link` page if it has one. Do not write from memory or from the description alone:

```
git log --format="%h %cs %s" --follow -- docs/90-agent/todo/<id>.md
git log -S "<a distinctive phrase from its description>" --format="%h %cs %s" -- TODO.md
git show <sha> --stat
```

3. Write the body below the frontmatter's closing `---` — a blank line, then three short paragraphs, at least 200 characters together: `來源：` the commit (short sha and date), session or incident that brought the line in and what was happening; `要做成：` the change, in a sentence or two; `完成條件：` the check that says it is finished. Where nothing in git or the link page says where it came from, the first paragraph opens `來源不明：` and says what was searched and what came back, and the id goes in your handoff under `來源不明`. Change nothing in the frontmatter.

4. Run the check and watch it name none of the three:

```
node scripts/todo-check.js
```

5. Commit: hand back; the controller commits.

## Task 14: bodies for stage-agents-5, stage-agents-6, stage-agents-7

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-5.md` — body (接縫「profile 中途翻轉」)
- Modify: `docs/90-agent/todo/stage-agents-6.md` — body (接縫「記帳」)
- Modify: `docs/90-agent/todo/stage-agents-7.md` — body (接縫「claims」)
- Read: `scripts/todo-check.js` — the `thin body` rule (Task 2)
- Read: `docs/90-agent/reference/todo.md` — the body's three parts (Task 6)

**Interfaces:**
- Consumes: `thin body` (Task 2)
- Produces: none

**Dispatch:** implementer, sonnet — each body is read out of git, not invented; the plan carries the procedure.

1. The check that fails now names these three as `thin body`:

```
node scripts/todo-check.js
```

2. For each of the three files, find its origin, in this order, stopping at the first that answers; then open its `link` page if it has one. Do not write from memory or from the description alone:

```
git log --format="%h %cs %s" --follow -- docs/90-agent/todo/<id>.md
git log -S "<a distinctive phrase from its description>" --format="%h %cs %s" -- TODO.md
git show <sha> --stat
```

3. Write the body below the frontmatter's closing `---` — a blank line, then three short paragraphs, at least 200 characters together: `來源：` the commit (short sha and date), session or incident that brought the line in and what was happening; `要做成：` the change, in a sentence or two; `完成條件：` the check that says it is finished. Where nothing in git or the link page says where it came from, the first paragraph opens `來源不明：` and says what was searched and what came back, and the id goes in your handoff under `來源不明`. Change nothing in the frontmatter.

4. Run the check and watch it name none of the three:

```
node scripts/todo-check.js
```

5. Commit: hand back; the controller commits.

## Task 15: bodies for stage-agents-8, stage-agents-9, stage-agents-10

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-8.md` — body (接縫「在哪提交」)
- Modify: `docs/90-agent/todo/stage-agents-9.md` — body (verify mutation 專屬 agent？)
- Modify: `docs/90-agent/todo/stage-agents-10.md` — body (allow 規則效果無法證明)
- Read: `scripts/todo-check.js` — the `thin body` rule (Task 2)
- Read: `docs/90-agent/reference/todo.md` — the body's three parts (Task 6)

**Interfaces:**
- Consumes: `thin body` (Task 2)
- Produces: none

**Dispatch:** implementer, sonnet — each body is read out of git, not invented; the plan carries the procedure.

1. The check that fails now names these three as `thin body`:

```
node scripts/todo-check.js
```

2. For each of the three files, find its origin, in this order, stopping at the first that answers; then open its `link` page if it has one. Do not write from memory or from the description alone:

```
git log --format="%h %cs %s" --follow -- docs/90-agent/todo/<id>.md
git log -S "<a distinctive phrase from its description>" --format="%h %cs %s" -- TODO.md
git show <sha> --stat
```

3. Write the body below the frontmatter's closing `---` — a blank line, then three short paragraphs, at least 200 characters together: `來源：` the commit (short sha and date), session or incident that brought the line in and what was happening; `要做成：` the change, in a sentence or two; `完成條件：` the check that says it is finished. Where nothing in git or the link page says where it came from, the first paragraph opens `來源不明：` and says what was searched and what came back, and the id goes in your handoff under `來源不明`. Change nothing in the frontmatter.

4. Run the check and watch it name none of the three — once Tasks 10-15 are all in, it passes whole:

```
node scripts/todo-check.js
```

5. Commit: hand back; the controller commits.

## Task 16: station.bat and station.sh at the repository root

**Files:**
- Modify: `station.bat` — new: one line, `serve --detach --open` on the `scripts/station.js` beside it
- Modify: `station.sh` — new: the same for a POSIX shell
- Test: `tests/station-launchers.test.js`

**Interfaces:**
- Consumes: none (`scripts/station.js` already takes `serve --detach --open`, `scripts/station.js:6`)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test, `tests/station-launchers.test.js`:

```js
'use strict';

// The two launchers at the repository root: each runs the station.js beside it
// with serve --detach --open (docs/90-agent/plans/2026-10-02-todo-folder-only-design.md §5).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('station.bat runs scripts\\station.js beside it, serve --detach --open', () => {
    const text = fs.readFileSync(path.join(ROOT, 'station.bat'), 'utf8');
    assert.match(text, /^@node "%~dp0scripts\\station\.js" serve --detach --open %\*\r?\n?$/);
});

test('station.sh runs scripts/station.js beside it, serve --detach --open', () => {
    const text = fs.readFileSync(path.join(ROOT, 'station.sh'), 'utf8');
    assert.match(text, /^#!\/bin\/sh\nexec node "\$\(dirname "\$0"\)\/scripts\/station\.js" serve --detach --open "\$@"\n$/);
});
```

2. Run it and watch it fail:

```
node --test tests/station-launchers.test.js
```

3. Write the files. `station.bat`, one line, CRLF:

```bat
@node "%~dp0scripts\station.js" serve --detach --open %*
```

   `station.sh`, LF line endings:

```sh
#!/bin/sh
exec node "$(dirname "$0")/scripts/station.js" serve --detach --open "$@"
```

   Say in the handoff that `station.sh` wants `git update-index --chmod=+x station.sh` at commit time; until then it runs as `sh station.sh`.

4. Run it and watch it pass:

```
node --test tests/station-launchers.test.js
```

5. Commit: hand back; the controller commits.

## Coverage

| promise | task |
|---|---|
| folder mode（有 bucket）：條目檔是唯一的來源，不再產生 `TODO.md`。 | Task 1 |
| 手寫模式（沒有 bucket）：使用者自己的 `TODO.md` 照舊被 `load()`、`orient`、todo-check 與 station 讀， | Task 2 (step 4 runs `tests/todo-check.test.js`, `tests/orient.test.js`), Task 3 (step 4 runs `tests/station-todo.test.js`) |
| `lib/todo.js`：`add`、`close` 不再寫 `TODO.md`；`writeIndex`、`render`、`preamble`、`bulletOf` | Task 1 — `writeIndex` and `preamble` deleted; `render` and `bulletOf` struck from the deletion — `load()` pairs entries with files through the in-memory `render`, and the same bullet says `load()` 的兩種讀法與排序不變 |
| `scripts/todo.js`：拿掉 `index` 動詞，新增 `list`：每條 open 條目印一行 `<state> <id> — <title>`， | Task 1 |
| 本 repo 的 `TODO.md` 刪除。 | Task 1 |
| `scripts/todo-check.js`：拿掉 `stale index` 規則；folder mode 的檢查錨點從 `<root>/TODO.md` 改成 root； | Task 2 |
| `scripts/station.js` 的「記成 TODO」：folder mode（`addTodoFile`）錨點從 `TODO.md` 改成 bucket 資料夾； | Task 3 |
| `scripts/orient.js` 的 `todoBlock`：folder mode 下 `orderByEdit(dir,'TODO.md',…)` 改成用每條條目檔 | Task 2 — the ordering already reads each entry file's last commit (`lib/blame.js:74-79`); the task changes the `todo:` strings |
| `todo.js new` 新增 `--body <text>`；非 `done` 的條目沒有 `--body` 就拒絕建立。 | Task 1 |
| `todo-check` 新規則（folder mode）：非 `done` 的條目 body 少於 200 字元即失敗。`done` 條目不要求 | Task 2 |
| body 寫什麼由 `docs/90-agent/reference/todo.md` 規定三段：從哪來（事件、session 或 sha）、 | Task 6 |
| 本 repo 現有 18 條 body 空白的 open 條目逐條補寫，內容取自該條目的 git 歷史、`link` 頁與引入它的 commit， | Tasks 10-15 |
| `skills/fankeel-init/SKILL.md` 第 3 節：已有 `TODO.md` 時不再直接遷移，先問使用者一題，兩個選項—— | Task 6 |
| `lib/todo.js` 的 `migrate`：每條條目的 body 寫入原本那行 bullet 的全文與一行來源 | Task 1 |
| 遷移後 init 跑 todo-check；body 未滿 200 字元的 open 條目，由 init 依該行 bullet 的 git 歷史 | Task 6 |
| 選了保留的專案，之後隨時可以自己跑 `todo.js migrate` 遷移；`scripts/upgrade.js` 對「有 bucket、 | Task 6 (the text); `scripts/upgrade.js` unchanged, and Task 1 runs `tests/upgrade.test.js` |
| `lib/station.js` 的 `todoOf`：folder mode 下 open 與 done 的每一列都帶 `body`。 | Task 3 |
| `assets/station/station.js` 的 `todoPanelHtml`：有 body 的列可點開，在列下方展開 body | Task 4 |
| 前端判斷：這是前端工作，但 design stage agent 不能派 `fankeel-mockup`，所以沒有畫 mockup； | Task 4 (step 5: the rendered page, `tune.js` live by `data-block`) |
| 本 repo 根目錄新增 `station.bat` 與 `station.sh`，各一行：以腳本所在目錄解析 | Task 16 |
| `lib/stages.js:154,163,303,317,392` 與 `skills/fankeel`、`fankeel-build`、`fankeel-audit`、`fankeel-land`、 | Task 7 (`lib/stages.js`, build), Task 8 (`fankeel`, survey), Task 9 (land, audit); `skills/fankeel-plan/SKILL.md:165` struck — it names `lib/plantasks.js`'s `INDEX_FILES`, which still holds `TODO.md` for hand-written projects |
| `assets/station/i18n.js`、`assets/station/station.js`、`assets/station/tour-ring.js` 中提到 `TODO.md` 的字串 | Task 5 — worded to hold in both modes, since `todoSpot` is not told the project's mode; `assets/station/tour-ring.js` struck — its `TODO.md` is a file in the tour's sample project tree, true of a hand-written project |
| `docs/90-agent/reference/todo.md` 改寫：去掉產生索引的段落、寫明兩種模式與 init 的詢問、加 `list`、 | Task 6 |
| `tests/todo-files.test.js`：folder mode `add` 後 `TODO.md` 不存在——現在失敗。 | Task 1 |
| `tests/todo-check-folder.test.js`：open 條目 body 199 字元被拒、200 通過；有 bucket 時根目錄有 `TODO.md` 被拒——現在失敗。 | Task 2 |
| `todo.js new` 不帶 `--body` 建 open 條目時非零退出——現在失敗。 | Task 1 |
| `tests/todo-migrate-errors.test.js` 或新測試：`migrate` 後每條條目 body 含原 bullet 全文與來源行， | Task 1 |
| 手寫模式不變：沒有 bucket 的 fixture，`load()`、todo-check、`addTodo` 的既有測試照舊通過。 | Task 2, Task 3 (step 4 of each) |
| `tests/station-todo-panel.test.js`：有 body 的列輸出含 body 文字的展開區塊——現在失敗。 | Task 4 |
| `tests/skills.test.js` 或新測試：`skills/fankeel-init/SKILL.md` 第 3 節含遷移與保留兩個選項——現在失敗。 | Task 6 (`tests/init-todo-ask.test.js`) |
| artefact：渲染後的 station 專案頁，帶 body 的列數等於 `load()` 中 body 非空的條目數。 | Task 4 (step 5) |
| 其餘提到 `TODO.md` 的測試檔隨行為更新，全套綠燈。 | Task 1, Task 2, Task 3, Task 5, Task 7, Task 8 |
