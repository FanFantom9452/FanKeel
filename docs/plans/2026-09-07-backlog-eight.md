---
status: design-intent
last_verified: 2026-09-07
source_of_truth: scripts/docs-check.js, scripts/todo-check.js, skills/fankeel/SKILL.md
---

# Eight Backlog Entries Implementation Plan

**Goal:** close seven of the eight open backlog entries — two on measurement
alone, five with a change — and leave the eighth under `## Ready` because it is
blocked on a setting only the user can make.

**Architecture:** two scanners gain one finding each, four documents gain a
deferral or a quote, one decision record narrows a boundary it set two days ago,
and one report records the two measurements. Nothing new is introduced:
`docs-check` gains a finding tag beside its existing four, `todo-check` gains a
non-fatal channel beside its existing one, and every documentation change uses a
sentence pattern the file already contains.

**Tech Stack:** Node, no dependencies. `node --test` is the whole suite
(`package.json:8`). Version 0.52.0.

**Spec:** [2026-09-07-backlog-eight-design.md](2026-09-07-backlog-eight-design.md)

## Global Constraints

Generated from the project on 2026-09-07, not remembered.

- **No `CLAUDE.md` and no `AGENTS.md` exist.** Conventions come from the code.
- **No dependencies may be added.** `package.json` has no `dependencies` or
  `devDependencies` key at all; `"private": true`, `"license": "MIT"`.
- **`npm test` is `node --test`** (`package.json:8`). The spec reporter prints
  `✔`/`✖` and a final `ℹ pass` / `ℹ fail`; it prints no TAP `ok` lines, so a
  grep for `ok`/`not ok` returns nothing and reads as silence. Judge on
  `ℹ pass|fail`.
- **Indentation is 4 spaces in `scripts/` and `lib/`.** No `.editorconfig`
  exists; match the surrounding file.
- **Line endings are LF.** `.gitattributes:1` is `* text=auto eol=lf`. A write
  that produces CRLF will show the whole file as changed.
- **Filing comes from `.fankeel/docs.json`**: `docs` at depth 1, `skills` and
  `output-styles` are `reference`; `docs/decisions` is `decision`, `docs/plans`
  is `plan`, `docs/reports` is `report`, `docs/archive` is `archive`. The index
  is `docs/README.md`.
- **Every report is indexed.** All ten files in `docs/reports/` have a row in
  `docs/README.md`; a new one without a row is a finding in `docs-audit`.
- **Reports are written in 繁體中文** with `status` / `last_verified` /
  `source_of_truth` frontmatter. Plans and designs are in English.
- **`.fankeel/map.md` reports 0 pages marked `design-intent`**, so no page in
  this repository describes something not yet built. The two files this plan
  creates in `docs/plans/` are the exception and are archived at `land`.
- **Existing caps, with their lines:** `MAX_FINDINGS = 200`
  (`scripts/docs-check.js:29`), `MAX_ENTRY_CHARS = 200`
  (`scripts/todo-check.js:46`), `MAX_PAIRS = 12` and `LANDMARK = 4`
  (`scripts/docs-audit.js:47-48`). None of them changes.
- **`docs-check` exits non-zero when `result.findings.length > 0`**
  (`scripts/docs-check.js:405-406`). A non-fatal channel therefore must not live
  in `findings`.

## File structure

| file | responsibility after this plan |
|---|---|
| `scripts/docs-check.js` | four finding tags plus `moved`; one non-fatal `unquoted` list beside `unfiled` |
| `tests/docs-check.test.js` | the suite's first `path:line` fixtures |
| `scripts/todo-check.js` | unchanged behaviour except that a wholly off-convention `TODO.md` reports once and passes |
| `tests/todo-check.test.js` | both halves of that split |
| `docs/registry.md` | seven citations, all quoted, one corrected |
| `docs/documents.md` | one citation quoted; the citation rule stated where the other markup rules are |
| `skills/fankeel/SKILL.md` | two deferrals; `source_of_truth` naming `lib/guard.js`; the `docs-check` finding list gains `moved` |
| `skills/fankeel-land/SKILL.md`, `skills/fankeel-survey/SKILL.md` | three citations quoted, two of them corrected |
| `docs/station.md` | defers the `usage` sentence to `docs/registry.md` |
| `docs/decisions/fankeel-shell.md` | a new section narrowing the 09-05 boundary |
| `docs/reports/2026-09-07-audit-constants.md` | the two measurements, dated |
| `docs/README.md` | a row for the report; the 09-05 decision row reworded |
| `TODO.md` | seven entries closed |

---

## Task 1: `docs-check` reports a quoted citation whose line moved

**Files:**
- Modify: `scripts/docs-check.js` — add `quoteBeside`, `linesOf`, the `moved`
  and `unquoted` findings, the split in `scan`, the `report` section, and the
  header comment at `:8-18` which currently states the opposite boundary
- Test: `tests/docs-check.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: finding tag `moved` (fails the run) and `result.unquoted`, an array
  of strings `'<doc>:<line>  <target>:<n>'` (does not fail the run).

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

Read `scripts/docs-check.js:205-250` first: the loop already has `span`, `hit`,
`wanted`, `found`, `role`, `text` and `lineOf` in scope, which is everything this
needs.

**Step 1 — the failing test.** `tests/docs-check.test.js` has two fixture
styles, and this needs the second: most of its tests hand `report` a result
object built by hand, because they test formatting. These test `scan`, so they
build a real repository the way the test at `tests/docs-check.test.js:81-99`
does — `tmp()`, `git init -q`, files, `git add -A`. The `git add` is not
decoration: `scan` goes through `trackedFiles`, which uses `git ls-files` inside
a repository, so an unadded file is invisible to it.

Add a shared builder at the top of the new block, since five tests want it:

```js
// `scan` reads the working tree through `git ls-files`, so a fixture that is a
// repository has to have its files added or the scan sees an empty project.
function repoWith(prefix, files) {
  const root = tmp(prefix);
  execFileSync('git', ['init', '-q'], { cwd: root });
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({
    preset: 'flat',
    index: 'docs/README.md',
    buckets: [{ path: 'docs', role: 'reference', depth: 1 },
              { path: 'docs/plans', role: 'plan' }],
  }));
  for (const [name, text] of Object.entries(files)) {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

// Ten filler lines so the quote sits at :11 and the citation at :3 is wrong by
// a margin no off-by-one could produce.
const FOO = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nconst target = 1;\n';
```

Then the failing test:

```js
test('a reference page citing a line that no longer holds its quote is reported', () => {
  const root = repoWith('fankeel-docscheck-moved-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO,
    'docs/page.md': 'See `lib/foo.js:3`, which sets `const target`.\n',
  });

  const moved = scan(root, []).findings.filter((f) => f.tag === 'moved');
  assert.equal(moved.length, 1);
  assert.equal(moved[0].file, 'docs/page.md');
  assert.match(moved[0].what, /lib\/foo\.js:3 does not hold `const target`/);
  assert.match(moved[0].what, /it is at :11/);
});
```

Run `node --test tests/docs-check.test.js` and watch it fail: today `scan`
returns no finding at all for that page, so `moved.length` is 0.

**Step 2 — the implementation.** Add beside `lineCount`
(`scripts/docs-check.js:133`) a cached line reader, keyed by root **and** path.
The key matters: the tests call `scan` many times against different temp roots
that all contain `lib/foo.js`, and a cache keyed by the relative path alone
would serve the first root's file to every later one.

```js
const LINES = new Map();
function linesOf(root, rel) {
    const key = root + '\0' + rel;
    if (!LINES.has(key)) {
        const text = readFile(root, rel);
        LINES.set(key, text === null ? null : text.split('\n'));
    }
    return LINES.get(key);
}
```

Rewrite `lineCount` to use it, so there is one reader:

```js
function lineCount(root, rel) {
    const l = linesOf(root, rel);
    return l === null ? null : l.length;
}
```

Then, above `checkDoc`:

```js
// The page recorded what it meant to point at, right beside the citation. A
// nearby symbol is a proxy for intent; this is the author's own note, on disk,
// which is the thing `docs/decisions/fankeel-shell.md:424` said nothing records.
// A second path is not a quote — `lib/a.js:10` beside `lib/b.js` is two
// citations, not one citation and its evidence.
function quoteBeside(text, from) {
    const eol = text.indexOf('\n', from);
    const rest = text.slice(from, eol === -1 ? undefined : eol);
    const span = /`([^`\n]{2,120})`/.exec(rest);
    if (!span) return null;
    return PATHISH.test(span[1].trim()) ? null : span[1];
}

const flat = (s) => s.replace(/\s+/g, ' ').trim();
```

Replace the `wanted !== null` branch (`scripts/docs-check.js:244-249`) with:

```js
        if (wanted !== null) {
            const n = lineCount(root, found);
            if (n !== null && wanted > n) {
                out.push({ file: rel, line: lineOf(m.index), tag: 'past-end', what: found + ':' + wanted + ' but the file ends at ' + n });
            } else if (role === 'reference') {
                // Reference only. A plan cites lines it is about to change, and
                // a decision cites the lines that existed the day it was
                // written; both are the role working, exactly as with `gone`.
                const quote = quoteBeside(text, m.index + m[0].length);
                const target = linesOf(root, found);
                if (quote === null) {
                    out.push({ file: rel, line: lineOf(m.index), tag: 'unquoted', what: found + ':' + wanted + ' carries no quote, so nothing checks the line' });
                } else if (target && !flat(target[wanted - 1] || '').includes(flat(quote))) {
                    const at = [];
                    for (let i = 0; i < target.length; i++) {
                        if (flat(target[i]).includes(flat(quote))) at.push(i + 1);
                    }
                    // One hit is where it went. Two is ambiguous and stays
                    // ambiguous — reporting a guessed line is the thing the
                    // 09-05 decision was right about.
                    out.push({ file: rel, line: lineOf(m.index), tag: 'moved',
                        what: found + ':' + wanted + ' does not hold `' + quote + '`'
                            + (at.length === 1 ? ' — it is at :' + at[0] : '') });
                }
            }
        }
```

**Step 3 — keep `unquoted` out of the exit code.** In `scan`, after the
`for (const rel of markdown)` loop finishes and before the `return`, split the
collected findings:

```js
    const unquoted = findings.filter((f) => f.tag === 'unquoted')
        .map((f) => f.file + ':' + f.line + '  ' + f.what);
    const failing = findings.filter((f) => f.tag !== 'unquoted');
```

Return `findings: failing` and `unquoted` on the result object. `main`'s
`bad = result.findings.length > 0` (`scripts/docs-check.js:405`) then needs no
change, which is the point of splitting here rather than there.

**Step 4 — report it.** Add `'moved'` to `ORDER`
(`scripts/docs-check.js:343`) between `'past-end'` and `'orphan'`, so a moved
citation sorts beside the other citation findings:

```js
const ORDER = ['open-fence', 'gone', 'past-end', 'moved', 'orphan', 'into-archive'];
```

In `report`, immediately after the `unfiled` section and before the findings
section, add the non-failing one:

```js
    lines.push(...section(result.unquoted.length + ' cited with no quote — the line number is not checked:',
        result.unquoted, 20));
```

**Step 5 — the header comment.** `scripts/docs-check.js:8-18` currently says a
citation pointing at the wrong line is not mechanical. Replace the third
sentence of that block so the file does not argue against its own code:

```js
// This reports only what can be decided mechanically: a path that no longer
// exists, a `file:line` past the end of the file, a `file:line` whose page
// quoted what it meant to point at and no longer finds it there, a symbol
// nothing declares, a link to a document that has gone. Whether two documents
// contradict each other, or whether a page is merely out of date in its prose,
// is not mechanical, and a script that guessed at it would produce findings
// nobody could act on. That judgement belongs to the `audit` stage; this gives
// it the facts to start from.
```

Leave the rest of that comment block, from `The role a document holds decides
what is checked`, exactly as it is — it is the reason this check is scoped to
`reference` and it is already correct.

**Step 6 — the remaining tests.** Four more, all on `repoWith` and `FOO`:

```js
test('a quote found at the cited line is not reported', () => {
  const root = repoWith('fankeel-docscheck-at-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO,
    'docs/page.md': 'See `lib/foo.js:11`, which sets `const target`.\n',
  });
  assert.equal(scan(root, []).findings.filter((f) => f.tag === 'moved').length, 0);
});

// Two hits is ambiguous and stays ambiguous. Naming one of them would be the
// guess `docs/decisions/fankeel-shell.md:426` was right to refuse.
test('a quote found at two places is reported without naming a line', () => {
  const root = repoWith('fankeel-docscheck-twice-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO + 'const target = 2;\n',
    'docs/page.md': 'See `lib/foo.js:3`, which sets `const target`.\n',
  });
  const moved = scan(root, []).findings.filter((f) => f.tag === 'moved');
  assert.equal(moved.length, 1);
  assert.doesNotMatch(moved[0].what, /it is at/);
});

test('a citation with no quote beside it is listed and does not fail the run', () => {
  const root = repoWith('fankeel-docscheck-unquoted-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO,
    'docs/page.md': 'See `lib/foo.js:3`.\n',
  });
  const scanned = scan(root, []);
  assert.equal(scanned.unquoted.length, 1);
  assert.match(scanned.unquoted[0], /lib\/foo\.js:3/);
  // `main` exits on `findings.length`, so an empty `findings` IS the exit code.
  assert.equal(scanned.findings.length, 0);
  assert.match(report(scanned), /1 cited with no quote/);
});

// The role boundary. A plan cites lines it is about to change; policing them
// would report every plan in a repository the first time this shipped.
test('a plan-role page with a moved citation is silent', () => {
  const root = repoWith('fankeel-docscheck-plan-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO,
    'docs/plans/p.md': 'See `lib/foo.js:3`, which sets `const target`.\n',
  });
  const scanned = scan(root, []);
  assert.equal(scanned.findings.filter((f) => f.tag === 'moved').length, 0);
  assert.equal(scanned.unquoted.length, 0);
});
```

The last two matter most. `unquoted` must be listed while `findings` stays
empty, because that is what the exit code reads; and the plan-role one is what
keeps the role boundary honest.

`main` is not exported from `scripts/docs-check.js` — the export list at
`scripts/docs-check.js:415` has `scan`, `report`, `parseArgs` and the regexes
but no `main` — so do **not** write a test that calls it. Either assert on
`findings.length` as above, or run the script as a subprocess the way
`tests/todo-check.test.js:27-33` does. Do not add `main` to the export list to
make a test easier; that widens the module's surface for a test's convenience.

Run `node --test tests/docs-check.test.js`, watch all five new tests and the
seven existing ones pass, then commit.

---

## Task 2: `todo-check` stops failing a repository that uses its own headings

**Files:**
- Modify: `scripts/todo-check.js` — the `unclassified` branch and `report`
- Test: `tests/todo-check.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `result.vocabulary`, an array of the heading names found when every
  entry is off-convention, otherwise absent.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Step 1 — the failing test.** `tests/todo-check.test.js:135-141` already
asserts that a `## Someday` heading exits 1. That test stays and keeps passing —
it has one off-convention heading among conventional ones. Add its opposite:

Use the file's own two helpers, `fixture(body)` at
`tests/todo-check.test.js:14-23` and `run(file)` at `:27-33`, exactly as the
existing `## Someday` test at `:134-140` does. `run` catches the non-zero exit
so the output can be read, which is the whole reason it exists.

```js
// The opposite of the `## Someday` test above. One stray heading among the three
// is an entry nobody classified; every heading being its own is a repository
// that uses another vocabulary, and that is one fact, not N defects.
test('a TODO.md whose every entry is off-convention reports once and passes', () => {
  const file = fixture('# TODO\n\n## Someday\n\n- a thing\n\n## Icebox\n\n- another thing\n');
  const { out, code } = run(file);
  assert.equal(code, 0);
  assert.match(out, /does not use the three headings/);
  assert.doesNotMatch(out, /unclassified/);
});
```

Run it and watch it fail: today `code` is 1 and `out` says `unclassified` twice.

**Two existing tests break, and fixing them is part of this task.** Both have a
fixture whose only entry is under `## Someday`, which is a wholesale case under
the new rule, so both would flip to passing and stop testing what their names
say:

- `tests/todo-check.test.js:135-141`, *an entry under a heading that is not one
  of the three is unclassified* — asserts `code === 1`.
- `tests/todo-check.test.js:149`, *the entry names the three headings it could
  have sat under* — same fixture, asserts the detail text.

Give both fixtures one conventional entry alongside the stray, which is the
case they were always about — a repository that uses the convention and has one
entry nobody filed:

```js
const file = fixture('# TODO\n\n## Ready\n\n- a real one\n\n## Someday\n\n- a thing\n');
```

A third test, `tests/todo-check.test.js:143-147`, *an entry under no heading at
all is unclassified*, must keep passing **with its fixture untouched**. That is
what the `named.length === found.length` guard above is for, and this test is
the only thing standing between that guard and a silent regression. Run it and
confirm it still reports `unclassified` before considering this task done.

**Step 2 — the implementation.** In `check`, after the entry loop that ends
around `scripts/todo-check.js:290` and before `counts` is built at `:296`:

```js
    // Every entry off-convention is one fact about the repository, not N
    // defects in it. A repository using its own vocabulary has said nothing
    // wrong; one that uses the convention and has a stray heading has, and that
    // stays a defect because the stray is the entry nobody classified.
    const off = problems.filter((p) => p.kind === 'unclassified');
    // Under a heading of its own, not under none. An entry with no heading
    // above it is not another vocabulary — it is an entry nobody filed, and it
    // stays a defect however many there are. Without this guard `named` is
    // empty, `vocabulary` becomes `[]`, and `[]` is truthy, so a repository
    // whose entries sit under no heading at all would have its one real defect
    // deleted by the branch meant to spare a different repository entirely.
    const named = found.filter((e) => e.section);
    const vocabulary = found.length > 0
        && named.length === found.length
        && off.length === found.length
        ? [...new Set(found.map((e) => e.section))]
        : null;
    if (vocabulary) problems = problems.filter((p) => p.kind !== 'unclassified');
```

`problems` is declared with `const` today; change that declaration to `let`.

Add `vocabulary` to the object `check` returns.

**Step 3 — report it.** In `report`, after the counts split at
`scripts/todo-check.js:308` and before the problems section:

```js
    if (result.vocabulary) {
        lines.push('This TODO.md does not use the three headings ' + SECTIONS.map((s) => '## ' + s).join(' · ')
            + ' — it uses ' + result.vocabulary.map((s) => '## ' + s).join(' · ')
            + '. Nothing here says which entries can be started today, which is what those three are for.');
    }
```

`main` needs no change: `ok` is `result.missing || !result.problems.length`
(`scripts/todo-check.js:362`), and the unclassified problems are gone from
`problems` by then.

**Step 4.** Run `node --test tests/todo-check.test.js`, watch both the new test
and the existing `## Someday` test pass, then commit.

---

## Task 3: quote the eleven reference citations, and correct the three that drifted

**Files:**
- Modify: `docs/registry.md` — seven citations
- Modify: `docs/documents.md` — one citation, and the citation rule
- Modify: `skills/fankeel-land/SKILL.md` — one citation
- Modify: `skills/fankeel-survey/SKILL.md` — two citations
- Test: none — Task 1's fixtures cover the mechanism; this task's proof is
  `node scripts/docs-check.js` exiting 0 with an empty `unquoted` section

**Interfaces:**
- Consumes: `moved` and `unquoted` from Task 1 — a citation is checked against
  the first code span after it on the same line, a second path does not count as
  one, and a citation with no such span is listed as `unquoted` rather than
  failing the run.
- Produces: nothing.

**Dispatch:** implementer, sonnet — eleven edits in four files, each one located by the citation itself.

These are every `path:line` citation in a `reference`-role page. Nothing else in
the repository is touched: `docs/plans/`, `docs/archive/`, `docs/decisions/` and
`docs/reports/` keep their citations exactly as they are, because those roles
record a moment.

Run this first to see the eleven, and again at the end:

```
node scripts/docs-check.js
```

| file | citation | what to do |
|---|---|---|
| `docs/registry.md` | `lib/dirty.js:180` | **drifted.** The prose says it calls `addClaim`; `addClaim` is at `:183`. Correct the number to `:183` and keep the existing `` `addClaim` `` span, which is already the quote |
| `docs/registry.md` | `lib/registry.js:200`, `lib/registry.js:624`, `lib/dirty.js:173`, `hooks/touch.js:42`, `lib/live.js:124`, `scripts/map.js:31` | open each target at the cited line, confirm the number, and add a short span quoting a distinctive fragment of that line immediately after the citation |
| `docs/documents.md` | `scripts/docs-audit.js:559` | same |
| `skills/fankeel-land/SKILL.md` | `lib/registry.js:33` | same |
| `skills/fankeel-survey/SKILL.md` | `scripts/task.js:476`, `scripts/task.js:938` | **check both before quoting.** These are the two that drifted on 09-05 and one of them drifted again afterwards. Open `scripts/task.js` and correct the numbers if they have moved, then quote |

The quote is a fragment of the target line, not a paraphrase — `` `addClaim` ``,
not `` `adds a claim` ``. Keep it short: it has to survive whitespace
normalisation, which is all `flat` does, so a fragment naming one identifier is
more durable than a whole statement.

Where a citation has nothing worth quoting — the target line is a brace or a
bare `}` — **remove the `:line` and cite the path alone**. A path without a line
is checked for existence and nothing else, which is honest. Do not invent a
quote to satisfy the check.

Then in `docs/documents.md`, in the paragraph beginning **A path that needs
checking goes in a link** (`docs/documents.md:144`), add one sentence after the
existing rules: a `path:line` in a reference page is checked against the code
span that follows it on the same line, and one written without such a span is
listed as unchecked rather than as broken.

Finish with `node scripts/docs-check.js` exiting 0 and reporting no `unquoted`.

---

## Task 4: the skill defers on the scope guard and on task memory

**Files:**
- Modify: `skills/fankeel/SKILL.md` — frontmatter `:7`, the finding list at
  `:428`, `## The scope guard` at `:977`, `## Task memory` at `:547`
- Test: none — the proof is `node scripts/docs-check.js` and `node scripts/docs-audit.js` still exiting 0

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Dispatch:** implementer, sonnet — four edits in one file, each one a sentence.

This is entries D1 and D2. **Neither section is deleted or shortened.** Both are
short form the agent needs in its context on every prompt; what is missing is the
sentence saying so, which this file already writes twice — at `:129`
(*"this is the short form, not the only copy"*, deferring to `docs/registry.md`)
and at `:545` (deferring to `docs/documents.md`). Match that wording.

1. **Frontmatter, `skills/fankeel/SKILL.md:7`.** It reads
   `source_of_truth: lib/stages.js, lib/registry.js, lib/live.js, scripts/task.js`.
   Append `, lib/guard.js` — that module implements the whole of
   `## The scope guard` and is the one file the tag omits.

2. **`## The scope guard`, at the end of the section (after `:1013`).** Add the
   deferral, naming the page and what only it holds:

   > The subagent rule, what a refused edit looks like from inside, and the run
   > that decided `ask` over `deny` are in
   > [docs/collisions.md](../../docs/collisions.md). This section is the short
   > form, not the only copy.

   A whole-file grep for `collisions` currently returns one hit, at `:55`, in an
   unrelated sentence about a workspace holding several projects — so this is
   the file's first link to the page describing its own guard.

3. **`## Task memory`, after the caps sentence at `:549-550`.** Add:

   > [docs/registry.md](../../docs/registry.md) has where the two fields are
   > written, what happens to them when a task is renamed, and the run the caps
   > came from. This section is the short form, not the only copy.

4. **The finding list at `:428`.** It reads *"a link that no longer resolves, a
   `path:line` past the end of a file, a symbol nothing declares"*. Add the new
   one: a `path:line` whose page quoted what it meant to point at and no longer
   finds it there. Task 1 makes this true; without this edit the skill
   under-describes its own tool.

---

## Task 5: `docs/station.md` defers the `usage` sentence instead of restating it

**Files:**
- Modify: `docs/station.md` — `:203-205`
- Test: none — `node scripts/docs-audit.js` exiting 0 is the proof

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Dispatch:** implementer, sonnet — one sentence replaced in one file.

Entry D3. The two sentences are near-verbatim:

- `docs/registry.md:230-231` — *"Both halves are deleted from `usage` before that
  field is written, so every existing reader of `usage` still sees the shape it
  always had."*
- `docs/station.md:203-205` — *"`spend` sits beside `burn`, `clock` and `waited`
  as a field of its own, and is deleted from `usage` — from `usage.subagents`
  too — so every existing reader of `usage` sees the shape it has always seen."*

`docs/registry.md` owns the record shape; it keeps its sentence unchanged.
Rewrite `docs/station.md:203-205` to state only what this page is for — that
`spend` is a field of its own — and defer the `usage` guarantee:

Fenced rather than quoted, because the link inside it is meant to resolve from
`docs/station.md` and would be a dead link if `docs-check` read it from here:

```markdown
`spend` sits beside `burn`, `clock` and `waited` as a field of its own. What is
deleted from `usage` when it is written, and why every existing reader still
sees the shape it always had, is in [registry.md](registry.md).
```

`docs/registry.md:232` already points forward to `station.md`, so after this the
pair defers in both directions and neither side is edited twice. Do **not** touch
`docs/station.md:93`, which defers the field list and is a different pointer.

---

## Task 6: the decision record narrows its own boundary

**Files:**
- Modify: `docs/decisions/fankeel-shell.md` — a new section appended in the
  file's existing shape
- Test: none

**Interfaces:**
- Consumes: from Task 1, the finding tags `moved` and `unquoted` and the fact
  that the check is scoped to the `reference` role.
- Produces: nothing.

**Dispatch:** in-session — it reverses part of a decision recorded two days ago, which is not an implementer's call to transcribe.

`docs/decisions/fankeel-shell.md:416-448`, *"The document checker stops where the
machine stops"*, stays exactly as written. A decision record is written once and
not maintained; editing it would destroy the record of what was decided on
2026-09-05.

Append a new section in the same shape as the others — a `##` heading, then
`Decided 2026-09-07.` — saying:

- The 09-05 section rejected two proxies by name, *look for a symbol near the
  line* and *compare against the last commit that touched both*. The first was
  measured against the four incidents **the `TODO.md` entry was filed for** — not
  the four that section itself describes — and catches **0 of 4**. Say which four,
  because the section's own four include *`scripts/task.js:317` for `LINE_MAX`*,
  where the symbol is backticked beside the citation and a symbol proxy would
  catch it. What carries the argument is reach, not those four: across the
  repository only 126 of 719 resolved citations land on a declaration line, so
  the proxy is blind to 82% of them however it does on any four. That conclusion
  holds and is not being reversed.
- What is being narrowed is the premise, quoted from `:424`: *"Deciding it needs
  someone to know what the citation was meant to point at, and nothing on disk
  records that."* Where a reference page writes `` `lib/dirty.js:180` `` and then
  `` `addClaim` `` in the same sentence, the page has recorded it. Comparing the
  two is reading the author's note, not guessing at intent.
- The scope is one role and one shape. `reference` only; a quote only; ambiguity
  reported and never resolved; and a citation with no quote listed as unchecked
  rather than as broken, so no repository upgrading fankeel has its `land` broken
  by citations written under the old rule.
- The cost this pays: eleven citations in four files, and a false-positive mode
  — a cited line reworded without moving — measured on four quoted citations in
  one repository, which is not a sample.
- The evidence that reopened it: `docs/registry.md` cited `lib/dirty.js:180` for
  a call at `:183` the whole time the 09-05 section was being written, and
  `skills/fankeel-survey/SKILL.md` cited `scripts/task.js:914`, was corrected to
  `:929` on 09-05, and had drifted again by 09-07.

Then update the index row for the old section — see Task 7.

---

## Task 7: the report, and the index

**Files:**
- Create: `docs/reports/2026-09-07-audit-constants.md`
- Modify: `docs/README.md` — one new row, one reworded row
- Test: none

**Interfaces:**
- Consumes: nothing. Every figure is in the spec.
- Produces: nothing.

**Dispatch:** implementer, sonnet — the spec carries every number; this is transcription into the house format.

**The report.** 繁體中文, `report` role, frontmatter matching
`docs/reports/2026-09-04-chains-as-workflows.md`:

```markdown
---
status: current
last_verified: 2026-09-07
source_of_truth: 本頁是兩次量測的記錄，不隨程式碼更新；常數以 scripts/docs-audit.js 為準
---
```

Two sections, both taken from
[2026-09-07-backlog-eight-design.md](2026-09-07-backlog-eight-design.md) —
copy the figures, do not recompute them:

1. **`LANDED_QUIET` re-measured.** The six-row table of last-edit / archived /
   gap, the 0–4 band with mode 3, and the conclusion that the constant stands.
   Include the measurement trap: `git log -1 -- docs/plans/X.md` returns the
   archiving commit, because a rename touches the old path, and read that way
   every gap is 0 and the band looks collapsed. That trap is the most reusable
   thing on the page.
2. **`LANDMARK = 4` measured.** 102 pairs with the constant raised out of reach,
   31 shipped, 71 suppressed. And the second question the entry asked: of 8 pairs
   read, 0 held a factual disagreement and 3 restated what a neighbour owns —
   those three being entries D1, D2 and D3, closed by Tasks 4 and 5 of this plan.

**The index, `docs/README.md`.** Two edits:

- Add a row for the report, in the same shape as the rows at `:56-60`, ending
  `— *a dated snapshot, 繁體中文*`.
- `docs/README.md:77` currently reads *"Why `docs-check` leaves a citation that
  drifted but still resolves"*. After Task 1 that is only true of an unquoted
  citation, and of every non-reference role. Reword it to say that — the row
  still points at `decisions/fankeel-shell.md`, which now holds both sections.

---

## Task 8: close the seven entries

**Files:**
- Modify: `TODO.md`
- Test: none — `node scripts/todo-check.js` exiting 0 is the proof

**Interfaces:**
- Consumes: Tasks 1 through 7, all of them. This task is what makes the plan's
  claim to have closed the entries true, so it runs last.
- Produces: nothing.

**Dispatch:** in-session — one edit to one file, which is one tool call.

Under `## Ready`, remove:

- the `LANDED_QUIET` entry — measured, unchanged, recorded in the report
- the `docs-audit` pairs / `LANDMARK = 4` entry — measured, earns its output

Under `## Needs a decision`, remove:

- the `skills/fankeel/SKILL.md` scope-guard entry — Task 4
- the `## Task memory` entry — Task 4
- the `docs/station.md:182-205` entry — Task 5
- the `docs-check` `path:line` entry — Tasks 1 and 3
- the `todo-check` `SECTIONS` entry — Task 2

**Leave standing, untouched:** the third `## Ready` entry, *whether an output
style reaches a subagent*. No `outputStyle` is set in any settings file on this
machine; a style lives in the system prompt and nothing in this repository reads
one. Setting one is the user's to do, which is what the 09-07 gate at
`docs/plans/2026-09-07-ready-fourteen.md:892-894` already concluded. It stays
under `## Ready` because nothing but a person's hands is missing.

Every other entry under `## Needs a decision` and all five under `## Waiting`
stay exactly as they are.

Run `node scripts/todo-check.js` and watch it exit 0.

## Coverage

| spec promise | task |
|---|---|
| `LANDED_QUIET` re-measured, constant stands | 7 (report), 8 (entry) |
| `LANDMARK = 4` measured, earns its output | 7 (report), 8 (entry) |
| output style entry stays open and blocked | 8 |
| `moved` fails, `unquoted` is context, reference role only | 1 |
| the eleven citations quoted, the drifted ones corrected | 3 |
| `todo-check` all-unclassified downgrade, some-unclassified still fails | 2 |
| D1 — scope guard deferral and `source_of_truth` | 4 |
| D2 — task memory deferral | 4 |
| D3 — `station.md` defers the `usage` sentence | 5 |
| the 09-05 decision narrowed, not overridden | 6 |
| the index learns about the report and re-words the old row | 7 |

## Done when

- `node --test` green.
- `node scripts/docs-check.js` exits 0 with no `unquoted` section.
- `node scripts/todo-check.js` exits 0.
- `node scripts/docs-audit.js` exits 0.
- `git status --porcelain` empty.
