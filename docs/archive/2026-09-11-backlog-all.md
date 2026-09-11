---
status: current
---

# 改進 backlog 全部實作 Implementation Plan

**Goal:** 照 design 的十一節，把 TODO 的 Ready 一條、Needs a decision 七條、〔profile〕缺口與唯讀 agent 用 Bash 寫檔的洞實作完。
**Architecture:** 十一節各自獨立，只在少數共用檔（audit 與 land 的 skill、`scripts/task.js`、`.claude-plugin/plugin.json`）上排隊。新行為全部放在 script 輸出、skill 內文或條件行，不加任何注入規則文字。station 的新資料層是每個 session 一份、以 transcript 大小加 mtime 為鍵的快取，細節面板與總覽都讀它。
**Tech Stack:** Node（本機 v24.9.0；`package.json` 沒有 engines，也沒有任何依賴），`node --test`，Claude Code plugin hooks。
**Spec:** [2026-09-11-backlog-all-design.md](2026-09-11-backlog-all-design.md)

## Global Constraints

- No `CLAUDE.md` or `AGENTS.md`; `CONTRIBUTING.md` is where the conventions are.
- `lib/*.js` are pure functions tested directly; nothing in `lib/` requires
  `scripts/` or `hooks/` (`CONTRIBUTING.md:15`).
- `scripts/*.js` are thin wrappers over `lib/`; a new flag on the station CLI
  needs a row in `docs/station.md` or `tests/station-doc.test.js` fails
  (`CONTRIBUTING.md:16`).
- Every hook exits `0` on every path, its own errors included
  (`CONTRIBUTING.md:17`). Hooks are registered in `.claude-plugin/plugin.json`
  (there is no `hooks/hooks.json`).
- Skills stay thin: no routing tables or shared conventions copied out of the
  skill that owns them (`CONTRIBUTING.md:18`). A skill line that names a
  script's flag must be a flag that script accepts — `node scripts/skills-check.js`
  checks it.
- Tests: `node --test` (`package.json` `"test"`). Every exported name needs an
  importer, and a new file must be `git add`-ed before `tests/source.test.js`
  sees it (`CONTRIBUTING.md:19`).
- A new or renamed page under `docs/` gets its `docs/README.md` index row in the
  same change (`CONTRIBUTING.md:20`).
- Station output: the `EMITTED` list in `lib/station.js`; never hand-edit a file
  `station.js serve` writes (`CONTRIBUTING.md:21`).
- `TODO.md`: `## Ready` / `## Needs a decision` / `## Waiting` only;
  `MAX_ENTRY_CHARS = 200` (`scripts/todo-check.js:47`).
- Version numbers move only through `scripts/version.js` — no task in this plan
  touches a version (`CONTRIBUTING.md:23`).
- `package.json` has no dependencies; add none.
- **Injection cap — no task adds text to what is injected.** `tests/render.test.js:530`
  asserts every stage `< 2400`, `:555` init `< 1400`, `:567` init with a station
  line `< 1400`. Measured 2026-09-11: design and land render 2396, init+station
  1361. So no task edits the rule text in `lib/stages.js` (`ALWAYS`, a stage's
  rules, `INIT`) or lengthens `profile.summary()` (`lib/profile.js:141`). New
  behaviour goes in script output, skill text or conditional lines.
- Registry caps: `MAX_NOTES = 5`, `MAX_NOTE_LEN = 100`, `MAX_NEXT_LEN = 120`
  (`lib/registry.js:33-35`), `MAX_CLAIMS = 60` (`:45`), `MAX_MOVES = 60` (`:50`).
- After every task these exit 0: `npm test`, `node scripts/docs-check.js`,
  `node scripts/todo-check.js`, `node scripts/skills-check.js`. A `path:line`
  in a reference page (`docs/*.md`, `skills/**`) is checked by docs-check —
  inserting lines into a cited file shifts citations; the task that inserts
  them re-runs docs-check and corrects what it prints.
- Judge a check on an unpiped run: a pipe swallows the exit code. The spec
  reporter prints `✔`/`✖` and `ℹ pass N` / `ℹ fail N`, never `ok` lines.
- Windows machine (Git Bash and PowerShell both present): heredocs eat
  backslashes — write files with the Write/Edit tools; never run `find /`;
  `MSYS_NO_PATHCONV=1` per command, never exported; a subagent holds both a
  Bash and a PowerShell tool, so a hook matcher naming only `Bash` misses half.

## Task 1: Map's navigation table says how many rows it dropped

`lib/map.js:22-23` promises the dropped count is printed. It is not:
`firstTable()` returns a bare, already-cut slice and `signpost()` throws away
everything past `MAX_NAV`. `TODO.md`'s `## Ready` entry names this exact gap.

**Files:**
- Modify: `lib/map.js` — `signpost()` computes and returns how many nav rows
  were cut; `buildMap()` prints the count under the table; `listing()` gets
  the same ", not listed" suffix so both truncation sentences in this file
  read the same, which is the promise `lib/map.js:22-23` is making.
- Read: `lib/map.js` — `firstTable()` (`:57-68`), unchanged and re-used with a
  second `maxRows` value; nothing about its signature or return shape changes,
  so `tests/map.test.js:31-56` (`firstTable`/`signpost` shape) stay green
  untouched.
- Test: `tests/map.test.js`

**Interfaces:**
- Consumes: none
- Produces: `signpost(root)` (`lib/map.js:207`) now returns
  `{ name, lines, dropped }` — `dropped` is new, a count, `0` when nothing was
  cut. `buildMap()`'s output gains a `  ... and N more, not listed` line
  directly under the printed nav table when `dropped > 0`.

**Dispatch:** implementer, sonnet — a return shape grows one field and two
sentences get unified; transcription plus tests.

Open `lib/map.js` and `tests/map.test.js` before writing anything: line
numbers below are what is in each file today.

### Step 1 — the failing test

Right after the existing test `'the signpost is the first of CLAUDE.md,
AGENTS.md, README.md that exists'` (`tests/map.test.js:50-56`) and before
`'a project with no signpost says so rather than returning nothing'`
(`:58-63`), in `tests/map.test.js` add:

```js
test('a navigation table longer than the cap says how many rows were dropped', () => {
  const dir = root();
  const rows = ['| a | b |', '|---|---|'];
  for (let i = 0; i < 28; i++) rows.push('| r' + i + ' | x |');
  write(dir, 'README.md', rows.join('\n') + '\n');
  const text = map.buildMap(dir);
  assert.match(text, /\.\.\. and 6 more, not listed/);
});
```

30 total table lines (2 header/separator + 28 data rows), `MAX_NAV` is 24
(`lib/map.js:24`), so 6 are dropped.

Run it and watch it fail:

```
node --test tests/map.test.js
```

```
✖ a navigation table longer than the cap says how many rows were dropped
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /\.\.\. and 6 more, not listed/
  actual: '---\nstatus: generated\n...\nread first: README.md\n\n| a | b |\n|---|---|\n| r0 | x |\n...\n| r21 | x |\n\nfiling: nothing declared...'
```

The table is silently cut to 24 lines (through `r21`) and nothing says 6 more
existed.

### Step 2 — the implementation

In `lib/map.js`, replace `signpost()` (`:207-215`):

```js
function signpost(root) {
    for (const name of SIGNPOSTS) {
        const text = readIf(path.join(root, name));
        if (text === null) continue;
        const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
        return { name, lines: firstTable(lines, MAX_NAV, MAX_WIDTH) };
    }
    return null;
}
```

In `lib/map.js`, replace `signpost()` with:

```js
function signpost(root) {
    for (const name of SIGNPOSTS) {
        const text = readIf(path.join(root, name));
        if (text === null) continue;
        const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
        const shown = firstTable(lines, MAX_NAV, MAX_WIDTH);
        // The count of what was dropped is still printed, the promise
        // `lib/map.js:22-23` makes and `firstTable()` alone cannot keep: it is
        // capped at MAX_NAV and never told how much more there was. Uncapped
        // only when the cap was actually hit — the ordinary case, a table
        // inside MAX_NAV rows, costs nothing extra.
        const full = shown.length === MAX_NAV ? firstTable(lines, Infinity, MAX_WIDTH) : shown;
        return { name, lines: shown, dropped: full.length - shown.length };
    }
    return null;
}
```

In `lib/map.js`, in `buildMap()`, replace (`:314-317`):

```js
        lines.push('read first: ' + sign.name);
        lines.push('');
        for (const l of sign.lines) lines.push(l);
    }
```

In `lib/map.js`, in `buildMap()`, replace it with:

```js
        lines.push('read first: ' + sign.name);
        lines.push('');
        for (const l of sign.lines) lines.push(l);
        if (sign.dropped) lines.push('  ... and ' + sign.dropped + ' more, not listed');
    }
```

In `lib/map.js`, in `listing()` (`:289-293`), replace:

```js
    if (items.length > MAX_PAGES) shown.push('  ... and ' + (items.length - MAX_PAGES) + ' more');
```

In `lib/map.js`, in `listing()`, replace it with:

```js
    if (items.length > MAX_PAGES) shown.push('  ... and ' + (items.length - MAX_PAGES) + ' more, not listed');
```

(`listing()`'s cap is exercised by the existing "planned, not built" and
"undeclared" sections, none of which pins the old wording — `tests/map.test.js`
has no test asserting `... and N more` without the suffix, only the negative
`assert.doesNotMatch(text, /\.\.\. and \d+ more/)` at `:155`, which still
passes: it asserts *absence*, and a suffixed string still contains that
substring only where the original assertion already required none to be
present.)

### Step 3 — run it and watch it pass

```
node --test tests/map.test.js
```

```
ℹ tests 28
ℹ pass 28
ℹ fail 0
```

### Step 4 — the gate

```
npm test
node scripts/docs-check.js
node scripts/todo-check.js
node scripts/skills-check.js
```

All four exit 0 — nothing here touches a reference page's `path:line`, a
`TODO.md` entry, or a skill's flags.

### Step 5 — commit

```
git add lib/map.js tests/map.test.js
git commit -m "fix: map's nav table says how many rows it dropped"
```

---

## Task 2: `path:N-M` range citations are checked, not invisible

A range citation like `` `scripts/judge.js:86-106` `` holds a block, not one
line — but `PATHISH` (`scripts/docs-check.js:89`) only ever matched a single
optional line number, so the whole citation fails to match at all: not
checked for existing, not flagged as unquoted, invisible to `docs-check`
entirely. Five reference-page citations are in exactly this state today
(verified below), and one of them would misfire the moment ranges are turned
on — its fix is folded into this task, per `CONTRIBUTING.md`'s "documentation
edits fold into the task whose change makes them necessary."

**Files:**
- Modify: `scripts/docs-check.js` — `PATHISH` gains an optional `-M` (or en
  dash `–M`); `checkDoc()`'s numbered-citation branch checks a range's
  extent for past-end and its quote against every line in `N..M` rather than
  only line `N`.
- Modify: `docs/documents.md` — at `:321`, the bare `` `:445-453` `` citation is
  missing its filename, so it never matched `PATHISH` at all even as a
  single-file reference; once ranges are checked this is the one existing
  citation in this repository whose *content* (not the rule) needs fixing to
  stay correct. Content correction, not a rule change.
- Modify: `docs/subagents.md` — at `:74-82`, the only one of the five newly-checked
  range citations that would misfire (see verification below): line 77's
  citation `` `scripts/judge.js:86-106` `` shares its physical line with the
  *next* sentence's `` `-2` ``, which `quoteBeside()` picks up as if it were
  this citation's own quote. `-2` exists exactly once elsewhere in
  `scripts/judge.js` (a comment, line 7), so once ranges are checked this
  reads as `moved` and fails the gate. Splitting the sentence onto its own
  line removes the stray adjacency; no wording changes.
- Read: `scripts/docs-audit.js` — its two `PATHISH.exec(...)` call sites
  (`:216-217`, `:282-286`) read only `hit[1]`, so a longer optional tail on
  the regex changes nothing there. Not modified.
- Test: `tests/docs-check.test.js`

**Interfaces:**
- Consumes: none
- Produces: `PATHISH` (`scripts/docs-check.js:89`) gains an optional third
  capture group holding the range's end line. `scan()`'s findings can carry
  `tag: 'past-end'` or `tag: 'moved'` for a range citation, `what` formatted
  as `path:N-M ...` instead of `path:N ...`.

**Dispatch:** implementer, sonnet — a regex grows one optional group and one
branch is extended to a span; transcription plus tests.

**Verified before writing this task** (dry run of the exact patch below
against every markdown file this repository tracks — `scripts/docs-check.js`'s
own `scan()`, re-implemented read-only over the real tree, not guessed): of
every `` `path:N-M` `` citation in a `reference`-role page (the role
`checkDoc` quote-checks), exactly one fails once ranges are turned on —
`docs/subagents.md:77`, fixed above — and every other one (including the two
in `docs/documents.md:320-321` once the filename fix lands) is either
unaffected or resolves to `unquoted`, which does not fail the run. A `fixture`
role page (`evals/**`) only gets the past-end check, and both of its range
citations (`lib/eval.js:64-73`, `skills/fankeel/SKILL.md:348-350`) sit well
inside their targets' current length.

Open `scripts/docs-check.js`, `tests/docs-check.test.js`, `docs/documents.md`
and `docs/subagents.md` before writing anything: line numbers below are what
is in each file today.

### Step 1 — the failing tests

In `tests/docs-check.test.js`, right after the test `'a reference one line
past the end is past-end'` (the file's last test, `:214-228`), add:

```js
const FOO_RANGE = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nconst target = 1;\n';

test('a reference page citing a range past the end of the file is reported', () => {
  const root = repoWith('fankeel-docscheck-range-pastend-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO_RANGE,
    'docs/page.md': 'See `lib/foo.js:3-20`, which sets `const target`.\n',
  });
  const past = scan(root, []).findings.filter((f) => f.tag === 'past-end');
  assert.equal(past.length, 1);
  assert.match(past[0].what, /lib\/foo\.js:3-20 but the file ends at 11/);
});

test('a range citation whose quote sits outside it is reported as moved, with a same-length range suggested', () => {
  const root = repoWith('fankeel-docscheck-range-moved-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO_RANGE,
    'docs/page.md': 'See `lib/foo.js:1-5`, which sets `const target`.\n',
  });
  const moved = scan(root, []).findings.filter((f) => f.tag === 'moved');
  assert.equal(moved.length, 1);
  assert.match(moved[0].what, /lib\/foo\.js:1-5 does not hold `const target` — it is at :11, try :11-15/);
});

test('a range citation whose quote sits inside it is not reported', () => {
  const root = repoWith('fankeel-docscheck-range-ok-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO_RANGE,
    'docs/page.md': 'See `lib/foo.js:9-11`, which sets `const target`.\n',
  });
  const scanned = scan(root, []);
  assert.equal(scanned.findings.filter((f) => f.tag === 'moved').length, 0);
  assert.equal(scanned.findings.filter((f) => f.tag === 'past-end').length, 0);
});
```

(`repoWith` is the helper already defined at `tests/docs-check.test.js:123-140`.
`FOO_RANGE` is the same eleven-line fixture the file's existing `FOO` constant
at `:144` already uses — named separately here only so this task's diff does
not touch that constant.)

Run it and watch it fail:

```
node --test tests/docs-check.test.js
```

```
✖ a reference page citing a range past the end of the file is reported
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  0 !== 1
✖ a range citation whose quote sits outside it is reported as moved, with a same-length range suggested
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  0 !== 1
✔ a range citation whose quote sits inside it is not reported
ℹ tests 16
ℹ pass 14
ℹ fail 2
```

`PATHISH` does not match a `path:N-M` span at all today, so both findings
lists are empty — the third test passes for the wrong reason (nothing was
ever checked), which the first two prove.

### Step 2 — the implementation

In `scripts/docs-check.js`, replace the `PATHISH` line and the comment above
it (`:85-89`):

```js
// Both conditions were learned by running it. A bare `settings.json` or
// `CLAUDE.md` in prose is naming a kind of file, not pointing at one, and
// `Waypoint/web/src` in an example is describing somebody else's tree. Reported
// as broken references they were nine findings out of ten, and a report that is
// nine parts noise gets read once.
const PATHISH = /^(?:\.\/)?([\w.-]+\/[\w./-]+)(?::(\d+))?$/;
```

In `scripts/docs-check.js`, replace it with:

```js
// Both conditions were learned by running it. A bare `settings.json` or
// `CLAUDE.md` in prose is naming a kind of file, not pointing at one, and
// `Waypoint/web/src` in an example is describing somebody else's tree. Reported
// as broken references they were nine findings out of ten, and a report that is
// nine parts noise gets read once.
//
// A third, optional group: `path:N-M` holds a block rather than one line, so a
// range has to be checked against a span rather than a single index. Both a
// hyphen and an en dash close it, because the prose in this repository uses
// both.
const PATHISH = /^(?:\.\/)?([\w.-]+\/[\w./-]+)(?::(\d+)(?:[-–](\d+))?)?$/;
```

In `scripts/docs-check.js`, in `checkDoc()`, replace (`:258`):

```js
        const wanted = hit[2] ? parseInt(hit[2], 10) : null;
        const found = resolveRef(root, rel, ref);
```

In `scripts/docs-check.js`, in `checkDoc()`, replace it with:

```js
        const wanted = hit[2] ? parseInt(hit[2], 10) : null;
        const wantedEnd = hit[3] ? parseInt(hit[3], 10) : null;
        const found = resolveRef(root, rel, ref);
```

In `scripts/docs-check.js`, in `checkDoc()`, replace the whole `if (wanted
!== null) { ... }` block (`:286-311`):

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

In `scripts/docs-check.js`, in `checkDoc()`, replace the whole block with:

```js
        if (wanted !== null) {
            const n = lineCount(root, found);
            // A range holds a block, not one line: `found + ':' + wanted`
            // grows a `-wantedEnd` suffix everywhere this citation is named.
            const label = found + ':' + wanted + (wantedEnd ? '-' + wantedEnd : '');
            if (wantedEnd !== null && wanted > wantedEnd) {
                out.push({ file: rel, line: lineOf(m.index), tag: 'past-end', what: label + ' — the range starts after it ends' });
            } else if (n !== null && (wantedEnd || wanted) > n) {
                out.push({ file: rel, line: lineOf(m.index), tag: 'past-end', what: label + ' but the file ends at ' + n });
            } else if (role === 'reference') {
                // Reference only. A plan cites lines it is about to change, and
                // a decision cites the lines that existed the day it was
                // written; both are the role working, exactly as with `gone`.
                const quote = quoteBeside(text, m.index + m[0].length);
                const target = linesOf(root, found);
                if (quote === null) {
                    out.push({ file: rel, line: lineOf(m.index), tag: 'unquoted', what: label + ' carries no quote, so nothing checks the ' + (wantedEnd ? 'range' : 'line') });
                } else if (target && wantedEnd === null && !flat(target[wanted - 1] || '').includes(flat(quote))) {
                    const at = [];
                    for (let i = 0; i < target.length; i++) {
                        if (flat(target[i]).includes(flat(quote))) at.push(i + 1);
                    }
                    // One hit is where it went. Two is ambiguous and stays
                    // ambiguous — reporting a guessed line is the thing the
                    // 09-05 decision was right about.
                    out.push({ file: rel, line: lineOf(m.index), tag: 'moved',
                        what: label + ' does not hold `' + quote + '`'
                            + (at.length === 1 ? ' — it is at :' + at[0] : '') });
                } else if (target && wantedEnd !== null) {
                    // A range citation holds a block, so the quote only has to
                    // land on one line inside N..M, not on N itself.
                    let inRange = false;
                    for (let i = wanted; i <= wantedEnd; i++) {
                        if (flat(target[i - 1] || '').includes(flat(quote))) { inRange = true; break; }
                    }
                    if (!inRange) {
                        const at = [];
                        for (let i = 0; i < target.length; i++) {
                            if (flat(target[i]).includes(flat(quote))) at.push(i + 1);
                        }
                        // Reported only where there is exactly one place to send
                        // it, the same reasoning that keeps a two-hit single line
                        // ambiguous rather than guessed. Zero or several
                        // candidates leave the range unverified rather than wrong.
                        if (at.length === 1) {
                            const span = wantedEnd - wanted;
                            out.push({ file: rel, line: lineOf(m.index), tag: 'moved',
                                what: label + ' does not hold `' + quote + '` — it is at :' + at[0]
                                    + ', try :' + at[0] + '-' + (at[0] + span) });
                        } else {
                            out.push({ file: rel, line: lineOf(m.index), tag: 'unquoted',
                                what: label + ' does not hold `' + quote + '` anywhere in the range' });
                        }
                    }
                }
            }
        }
```

In `docs/documents.md`, replace the sentence at `:320-321`:

```
Both branches are tested. `tests/docs-audit.test.js:434-440` covers the
no-index case; `:445-453` covers the index case and asserts `orphans` comes
back empty. This project declares an index, so the branch that would populate
```

with:

```
Both branches are tested. `tests/docs-audit.test.js:434-440` covers the
no-index case; `tests/docs-audit.test.js:445-453` covers the index case and
asserts `orphans` comes back empty. This project declares an index, so the
branch that would populate
```

In `docs/subagents.md`, replace the paragraph at `:74-82`:

```
It writes `docs/judgements/<date>-<slug>.md`: frontmatter carrying `judged`,
`model`, `agent: fankeel-judge`, `task`, `session` and `stage`, then the brief
and the answer copied in whole rather than summarised
(`scripts/judge.js:86-106`). A slug already on disk gets `-2` rather than
overwriting the first record (`scripts/judge.js:35-39`, `freePath`), and a
missing `--session`, `--brief`, `--answer` or `--slug` exits 1 before
anything is written. It then appends a row to `docs/README.md`'s own
`## Judgements` table when that heading exists, and says so plainly when it
does not rather than inventing one (`scripts/judge.js:50-66`, `indexRow`).
```

with (the only change is the line break after the first citation — no words
move):

```
It writes `docs/judgements/<date>-<slug>.md`: frontmatter carrying `judged`,
`model`, `agent: fankeel-judge`, `task`, `session` and `stage`, then the brief
and the answer copied in whole rather than summarised
(`scripts/judge.js:86-106`).
A slug already on disk gets `-2` rather than overwriting the first record
(`scripts/judge.js:35-39`, `freePath`), and a missing `--session`, `--brief`,
`--answer` or `--slug` exits 1 before anything is written. It then appends a
row to `docs/README.md`'s own `## Judgements` table when that heading exists,
and says so plainly when it does not rather than inventing one
(`scripts/judge.js:50-66`, `indexRow`).
```

Why this one and not the other four: `quoteBeside()` takes the first backtick
span *after* a citation on the same physical line. On the original line 77,
that span is the next sentence's `` `-2` `` — not this citation's own
evidence. `-2` occurs exactly once elsewhere in `scripts/judge.js` (a comment
at line 7, "gets -2"), outside the cited range `86-106`, so once ranges are
checked this reads as `moved`. Splitting the line removes the adjacency:
nothing follows `` (`scripts/judge.js:86-106`). `` on its own line, so the
citation is `unquoted` (does not fail the run) instead. This file grows one
line, and nothing in this repository cites `docs/subagents.md` at a line
number past 82 from a `reference`-role page — the only citations into that
span are from `report`-role and `plan`-role pages, neither of which is
quote-checked, and both stay well inside the file's new, one-line-longer
length.

### Step 3 — run it and watch it pass

```
node --test tests/docs-check.test.js
```

```
ℹ tests 16
ℹ pass 16
ℹ fail 0
```

### Step 4 — the gate

```
npm test
node scripts/docs-check.js
node scripts/todo-check.js
node scripts/skills-check.js
```

All four exit 0. `docs-check` in particular: this task is the one that turns
range citations on for the whole repository, so it is the one that has to
confirm the live run is clean, not just the fixture suite — the two content
fixes above are exactly what keeps it that way.

### Step 5 — commit

```
git add scripts/docs-check.js tests/docs-check.test.js docs/documents.md docs/subagents.md
git commit -m "feat: docs-check reads path:N-M range citations"
```

---

## Task 3: Drift rows list what happened afterward, not a verdict

`scripts/docs-audit.js:437`'s drift condition — code changed after the page's
own date — is one fact that answers two different questions: the page could
be stale, or the code could have departed from what it correctly described.
The report only ever prints the first reading. This task adds what a person
needs to tell the two apart: the commit subjects that actually touched the
target after the page's date.

**Files:**
- Modify: `scripts/docs-audit.js` — a new `subjectsSince()` helper; `sweep()`
  attaches its result to each drift entry; `report()` prints them and drops
  the implicit "the page is wrong" framing.
- Modify: `skills/fankeel-audit/SKILL.md` — the routing a reader now follows:
  a commit that already says it means to change this behaviour means the
  page is the fix; no such commit means the code is the suspect and the page
  stays put.
- Read: `scripts/docs-audit.js` — `dateSource()` (`:165-169`) and
  `commitTimes()` (`:110-129`), unchanged; `subjectsSince()` is a second,
  per-file `git log`, not a change to the whole-tree pass those two already
  do.
- Read: `tests/docs-audit.test.js:76-82` (`'a document newer than its subject
  is not drift'`) — the guard condition it pins (`scripts/docs-audit.js:437`,
  `if (!at || at <= docAt) continue;`) is not touched by this task.
- Test: `tests/docs-audit.test.js`

**Interfaces:**
- Consumes: none
- Produces: `subjectsSince(root, rel, sinceMs, limit = 3)`
  (`scripts/docs-audit.js`) — returns `string[]`, up to `limit` commit
  subjects that touched `rel` after `sinceMs`, newest first, `[]` outside a
  repository. `sweep()`'s `drift[]` entries gain `subjects: string[]`.

**Dispatch:** implementer, sonnet — one new helper reusing the existing
`git log` pattern this file already has twice; transcription plus tests.

Open `scripts/docs-audit.js`, `tests/docs-audit.test.js` and
`skills/fankeel-audit/SKILL.md` before writing anything: line numbers below
are what is in each file today.

### Step 1 — the failing test

In `tests/docs-audit.test.js`, right after the test `'a document newer than
its subject is not drift'` (`:76-82`), add:

```js
// A date gap alone cannot say which side is wrong, so the row hands over what
// actually happened to the target after the page's date — the commit subjects
// a person needs to route the finding, rather than a default blame on the page.
test('a drift row carries the commit subjects that touched its target after the page', () => {
  const root = withTree(tree({
    'docs/01-architecture.md': { body: 'the badge is written by `lib/badge.js`\n', age: 60 },
    'lib/badge.js': { body: 'x\n', age: 60 },
  }), 'flat');
  const envAt = (at) => Object.assign({}, process.env, { GIT_AUTHOR_DATE: at, GIT_COMMITTER_DATE: at });
  const git = (args, env) => execFileSync('git', args, { cwd: root, env, stdio: 'ignore' });
  const first = new Date(daysAgo(60)).toISOString();
  git(['init', '-q']);
  git(['config', 'user.email', 'test@example.invalid']);
  git(['config', 'user.name', 'test']);
  git(['config', 'commit.gpgsign', 'false']);
  git(['add', '-A'], envAt(first));
  git(['commit', '-q', '-m', 'one'], envAt(first));

  fs.writeFileSync(path.join(root, 'lib', 'badge.js'), 'y\n');
  const second = new Date(daysAgo(3)).toISOString();
  git(['add', '-A'], envAt(second));
  git(['commit', '-q', '-m', 'rewrite the badge writer'], envAt(second));

  const r = sweep(root);
  assert.equal(r.drift.length, 1);
  assert.deepEqual(r.drift[0].subjects, ['rewrite the badge writer']);
});
```

Run it and watch it fail:

```
node --test tests/docs-audit.test.js
```

```
✖ a drift row carries the commit subjects that touched its target after the page
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  + undefined
  - [
  -   'rewrite the badge writer'
  - ]
```

### Step 2 — the implementation

In `scripts/docs-audit.js`, between `commitTimes()` (ends `:129`) and the
comment above `deletedPaths()` (`:131`), add:

```js
// Up to `limit` commit subjects that touched `rel` after `sinceMs`, newest
// first. A date gap alone cannot say which side is wrong — the page could be
// stale, or the code could have departed from what it still correctly
// described — so drift hands over what a person needs to judge that: what
// actually happened to the file after the page's own date. One `git log` per
// drift row rather than the whole-tree pass `commitTimes` makes: there are at
// most a dozen drift rows in a run and `--follow` on one path costs one
// process, where doing this for every file in the tree the way `commitTimes`
// does would cost one process per file instead of one for all of them.
function subjectsSince(root, rel, sinceMs, limit = 3) {
    if (!isRepo(root)) return [];
    let out;
    try {
        out = execFileSync('git', ['log', '--format=%ct%n%s', '--follow', '--', rel], {
            cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch (e) {
        return [];
    }
    // `%ct` then `%s` on the line under it, one pair per commit, newest first.
    const lines = out.split('\n');
    const subjects = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
        const ts = parseInt(lines[i], 10) * 1000;
        if (!Number.isFinite(ts) || ts <= sinceMs) continue;
        subjects.push(lines[i + 1]);
        if (subjects.length >= limit) break;
    }
    return subjects;
}
```

In `scripts/docs-audit.js`, in `sweep()`, replace the `drift.push(...)` call
(`:474-479`):

```js
            const c = contracts.get(rel);
            drift.push({
                file: rel, target: worst.target, gap: worst.gap,
                docAge: daysBetween(now, docAt),
                declared: Boolean(c && c.verified),
            });
```

In `scripts/docs-audit.js`, in `sweep()`, replace it with:

```js
            const c = contracts.get(rel);
            drift.push({
                file: rel, target: worst.target, gap: worst.gap,
                docAge: daysBetween(now, docAt),
                declared: Boolean(c && c.verified),
                // Neither side is assumed guilty: the page could be stale, or
                // the code could have departed from what it correctly
                // described. These are what actually happened to the target
                // after the page's own date, for a reader to judge from.
                subjects: subjectsSince(root, worst.target, docAt),
            });
```

In `scripts/docs-audit.js`, in `report()`, replace (`:729-732`):

```js
    lines.push(...section(plural(r.drift.length, 'reference document has', 'reference documents have')
        + ' fallen behind the code they describe:',
    r.drift.map((d) => d.file + '  (' + (d.declared ? 'verified' : 'last touched') + ' ' + d.docAge + 'd ago; '
        + d.target + ' changed ' + d.gap + 'd after it)')));
```

In `scripts/docs-audit.js`, in `report()`, replace it with:

```js
    lines.push(...section(plural(r.drift.length, 'reference document has', 'reference documents have')
        + ' fallen behind the code they describe — page stale, or the code departed from it:',
    r.drift.map((d) => d.file + '  (' + (d.declared ? 'verified' : 'last touched') + ' ' + d.docAge + 'd ago; '
        + d.target + ' changed ' + d.gap + 'd after it)'
        + (d.subjects.length ? d.subjects.map((s) => '\n    - ' + s).join('') : '\n    - no commit subject found for it'))));
```

(The bold row label `**fallen behind the code they describe**` that
`tests/docs-audit.test.js`'s `'the sweep table names every category sweep()
returns'` test pins, in both `skills/fankeel/SKILL.md` and
`skills/fankeel-audit/SKILL.md`, is a substring of the new heading and stays
matched — neither of those two pages' own table text changes.)

In `skills/fankeel-audit/SKILL.md`, in the section `## The part only reading
finds`, right after the three-item list (`:119-126`) and before `So dispatch
it:` (`:128`), add:

```markdown
**Drift's two readings.** A drift finding is a gap, not a verdict: the code
named changed after the page did, and either side can be the one that is
wrong. The row lists what actually happened to the code afterward — read the
commit subjects it carries. One that already says it means to change this
behaviour is the page's fix: bring the page in line with it. No commit says
so, and the code itself is the suspect: leave the page alone and open a
`TODO.md` entry under `## Needs a decision` naming what looks wrong, rather
than rewriting the page to match a change nobody meant to make.
```

### Step 3 — run it and watch it pass

```
node --test tests/docs-audit.test.js
```

```
ℹ tests 47
ℹ pass 47
ℹ fail 0
```

### Step 4 — the gate

```
npm test
node scripts/docs-check.js
node scripts/todo-check.js
node scripts/skills-check.js
```

All four exit 0. `skills-check.js` in particular: the new bullet names no
script flag, so it has nothing to check against a script's accepted options.

### Step 5 — commit

```
git add scripts/docs-audit.js tests/docs-audit.test.js skills/fankeel-audit/SKILL.md
git commit -m "feat: drift rows list what happened to their subject afterward"
```

---

## Task 4: TODO.md's preamble names the 〔group〕 prefix convention

`###` is not the answer to grouping `TODO.md` entries: it breaks
`todo-check.js:174`'s section contract (any heading resets which section an
entry is read under), and `INIT`'s injected block has 39 characters of spare
capacity to say so — nowhere near enough to explain a heading change. The
〔group〕 prefix already does the job informally; this task is the decision
closing, so it gets written down.

**Files:**
- Modify: `TODO.md` — the preamble gets one paragraph naming the prefix
  convention; the `## Needs a decision` entry this section answers is
  removed, since this section is that decision.
- Read: `scripts/todo-check.js:174` — the section-reset behaviour the
  preamble's new paragraph explains why `###` is not used for; not modified,
  per this section's own ruling.

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — a preamble paragraph and one bullet removed, both
in `TODO.md`; one file, two edits, no test cycle to gate.

Open `TODO.md` before writing anything: line numbers below are what is in the
file today.

### Step 1 — add the paragraph

In `TODO.md`, right after the paragraph ending "...A later reader has to
guess." (`:23-24`) and before the paragraph beginning "An entry under `##
Waiting`..." (`:26`), add:

```markdown
A bullet may also open with a `〔word〕` prefix — `〔map〕`, `〔caveman〕`,
`〔station〕` and so on. It groups nothing the heading does not already
decide: it is there so bullets about one area sit together at a glance, and
it changes neither an entry's state nor what `/fankeel` offers. The heading
still answers what an entry is waiting for; the prefix only answers what it
is about, which is the question the heading is deliberately not asking.
```

### Step 2 — close the decision

In `TODO.md`, under `## Needs a decision`, remove the bullet (today at
`:79`, preceded by its own blank line):

```markdown
- 〔todo〕分群要不要改用 `###`：`todo-check.js:174` 任何標題都會重設 section，`INIT` 只認三個 `##`，:55 明說不按主題分；要改就動兩處 — [scripts/todo-check.js](scripts/todo-check.js). 目前以〔群組〕前綴代替。
```

Delete the bullet's own blank line above it too, so the remaining entries
keep single-blank-line spacing.

### Step 3 — check it

```
node scripts/todo-check.js
```

Exits 0 — the paragraph adds no entry and no heading, and the removed bullet
was a well-formed entry, not a defect the checker was holding open.

### Step 4 — the gate

```
npm test
node scripts/docs-check.js
node scripts/skills-check.js
```

All three exit 0 — `TODO.md` gains no new `path:line` citation and no new
skill-facing flag.

### Step 5 — commit

```
git add TODO.md
git commit -m "docs: TODO's preamble names the group-prefix convention"
```

## Task 5: caveman-learn — 成本理由的改動要被量過，不是被相信

以成本為理由的改動，任務要寫明量它的 script 與改前的數字，並在改完後用同一支再量一次；
沒有變好就是一條 ruling，把改動退回，不留著這個 task。這條規則寫進
`skills/fankeel-build/SKILL.md`（設計 §4 A）。

**Files:**
- Modify: `skills/fankeel-build/SKILL.md` — 在「## Rulings, not stalls」與「## A new
  ask is not a fifth stopper」之間插入新的一節「## A cost claim is measured, not
  assumed」
- Test: `tests/skills.test.js` — 新增一則斷言釘住這節的用字

**Interfaces:**
- Consumes: none
- Produces: none（純散文規則，沒有新函式）

**Dispatch:** implementer, sonnet

### 步驟

1. 先寫失敗的測試。在 `tests/skills.test.js` 檔尾（最後一個 `test(...)` 之後）加入：

```js
// caveman-learn: a cost-justified task states its own before/after measurement
// rather than being trusted on its word. Flattened first — a hard wrap through
// the middle of the pinned sentence would otherwise defeat this the same way it
// has defeated a grep before.
test('fankeel-build: a cost claim is measured, not assumed', () => {
  const flat = read('fankeel-build').replace(/\s+/g, ' ');
  assert.match(flat, /its steps name the script that measures the claim/,
    'no rule ties a cost-justified task to the script that measures it');
  assert.match(flat, /Run that same script again once the change lands/,
    'no rule says to re-measure after the change lands');
  assert.match(flat, /A number that has not improved is not a task to patch/,
    'the ruling for an unproven cost claim is missing');
});
```

2. 執行並確認失敗：

```
node --test tests/skills.test.js
```

預期在這則新測試上失敗（`fankeel-build` 目前沒有這幾句），其餘既有測試仍是綠的。

3. 實作。在 `skills/fankeel-build/SKILL.md` 裡，緊接在

```markdown
The spec is the binding authority, the plan is its argument, and your judgement
settles what neither answers.

**Four things stop the loop, and only these:**

1. an irreversible or destructive operation
2. a security-sensitive action
3. a side effect outside this workspace that norms say you ask about first — a
   merge, a push to a shared branch, a publish
4. a plan, or a file table, so broken that every path forward is a guess
```

這一段之後、「## A new ask is not a fifth stopper」這個標題之前，在
`skills/fankeel-build/SKILL.md` 插入一整節：

```markdown
## A cost claim is measured, not assumed

Where a task's whole justification is that a change is cheaper, faster or
lighter, its steps name the script that measures the claim and record what it
printed before the change — the same discipline
`docs/reports/2026-09-03-dispatch-vs-inline.md` already keeps by hand. Run
that same script again once the change lands, before treating the task as
done.

A number that has not improved is not a task to patch: revert the change,
record the ruling and the number with `ledger.js ruling`, and leave the task
un-kept rather than defending it through a fix round it was never about. A
cost claim `verify` finds still unproven when it re-runs the same script over
the merged tree is routed back here exactly as any other finding is, and this
is the ruling it lands on.
```

4. 執行並確認通過：

```
node --test tests/skills.test.js
```

輸出應以 `ℹ pass` 結尾，`ℹ fail 0`。

5. Commit：

```
git add skills/fankeel-build/SKILL.md tests/skills.test.js
git commit -m "docs(build): a cost claim is measured, not assumed"
```

---

## Task 6: caveman-stats — 成本／token／計數類的證據要貼原始輸出

證據表的「Requires」欄不接受模型估的數字或重打的命令；一個成本、token 或計數類的說法，
證據欄貼的必須是一次沒有經過管線截斷的命令輸出，逐字貼上。這條規則寫進
`skills/fankeel-verify/SKILL.md`（設計 §4 B）。

**Files:**
- Modify: `skills/fankeel-verify/SKILL.md` — 「## What each claim requires」表格加一列，
  表格後加一段理由
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

### 步驟

1. 先寫失敗的測試。在 `tests/skills.test.js` 檔尾加入：

```js
// caveman-stats: a cost/token/count claim's evidence cell is one unpiped
// command's raw output, never a model's estimate or a retyped command — the
// exact three traps this repository's own reports have already fallen into.
test('fankeel-verify: a cost or count figure requires one unpiped command output, pasted verbatim', () => {
  const flat = read('fankeel-verify').replace(/\s+/g, ' ');
  assert.match(flat, /A cost, token or count figure/);
  assert.match(flat, /one command's raw, unpiped, untruncated output, pasted verbatim/);
  assert.match(flat, /a model's estimate, a retyped command/);
});
```

2. 執行並確認失敗：

```
node --test tests/skills.test.js
```

3. 實作。在 `skills/fankeel-verify/SKILL.md` 裡，現有表格

```markdown
| Claim | Requires | Not sufficient |
|---|---|---|
| Tests pass | the test command's output, 0 failures | a previous run, "should pass" |
| Linter clean | the linter's output, 0 errors | a partial check, extrapolation |
| Build succeeds | the build command, exit 0 | the linter passing, logs looking fine |
| Bug fixed | the original symptom retested | the code changed |
| Regression test works | red-green verified: revert the fix, watch it fail, restore | it passes once |
| An agent finished | the VCS diff | the agent's report |
| Requirements met | line by line against the plan | tests passing |
```

改成（在 `skills/fankeel-verify/SKILL.md` 裡，最後一列之後新增一列，並在表格後補一段理由，
`## Red flags — stop` 標題之前）：

```markdown
| Claim | Requires | Not sufficient |
|---|---|---|
| Tests pass | the test command's output, 0 failures | a previous run, "should pass" |
| Linter clean | the linter's output, 0 errors | a partial check, extrapolation |
| Build succeeds | the build command, exit 0 | the linter passing, logs looking fine |
| Bug fixed | the original symptom retested | the code changed |
| Regression test works | red-green verified: revert the fix, watch it fail, restore | it passes once |
| An agent finished | the VCS diff | the agent's report |
| Requirements met | line by line against the plan | tests passing |
| A cost, token or count figure | one command's raw, unpiped, untruncated output, pasted verbatim | a model's estimate, a retyped command, a number carried over from an earlier run |

A figure here has broken three ways on this repository alone: a report's own
number cut to ten by a piped `head`, a rewritten regex that miscounted twice
running, and a number retyped from memory instead of re-run. The row above is
what stops all three — the evidence cell is the command's own output, not a
description of what it should have said.
```

4. 執行並確認通過：

```
node --test tests/skills.test.js
```

5. Commit：

```
git add skills/fankeel-verify/SKILL.md tests/skills.test.js
git commit -m "docs(verify): a cost or count claim's evidence is the raw command output"
```

---

## Task 7: cavecrew-builder — 新 agent `fankeel-fixer`，只做不需要測試的修正

新增 `agents/fankeel-fixer.md`：工具只有 `Read`、`Edit`、`Write`、`Grep`、`Glob`（沒有
`Bash`、沒有 `PowerShell`、沒有 `NotebookEdit`），碰到三個以上檔案的改動就整份拒絕，
回傳改了哪些檔、哪些行；model 下限 `sonnet`。`build`、`verify`、`audit` 三支 skill 各補
一句指到它，且都限定「不需要跑測試的修正」這個場景（設計 §4 C）。

**Files:**
- Modify: `agents/fankeel-fixer.md`（new） — 新 agent 的 frontmatter 與內文
- Modify: `.claude-plugin/plugin.json` — `agents` 陣列加入這個新檔
- Modify: `skills/fankeel-verify/SKILL.md` — 「## Documentation verification」節裡
  指到 `fankeel-fixer` 的一段
- Modify: `skills/fankeel-audit/SKILL.md` — 「## Run all three」節裡指到 `fankeel-fixer`
  的一段
- Modify: `skills/fankeel-build/SKILL.md` — 「The task loop」步驟 6（Fix rounds are
  bounded at five）裡指到 `fankeel-fixer` 的一段
- Test: `tests/agents.test.js` — `NAMES`、`MAY_WRITE` 擴充成含 `fankeel-fixer`
- Test: `tests/skills.test.js` — 三則新斷言，各釘住一支 skill 指到它的那句

**Interfaces:**
- Consumes: none
- Produces: none（agent 檔不是被 import 的模組，三支 skill 的新句子也不是函式）

**Dispatch:** implementer, sonnet

### 步驟

1. 先寫失敗的測試。在 `tests/agents.test.js`，把

```js
const NAMES = ['fankeel-reader', 'fankeel-judge', 'fankeel-reviewer', 'fankeel-verifier'];
```

改成（`tests/agents.test.js`）：

```js
const NAMES = ['fankeel-reader', 'fankeel-judge', 'fankeel-reviewer', 'fankeel-verifier', 'fankeel-fixer'];
```

再把（`tests/agents.test.js` 裡）：

```js
const MAY_WRITE = { 'fankeel-verifier': ['Write'] };
```

改成（`tests/agents.test.js`）：

```js
// `fankeel-fixer` is the second named exception: it makes the small edit
// itself rather than returning it for the parent to apply, so it needs both
// `Edit` and `Write` — never `Bash`, so it never runs the test the edit would
// need.
const MAY_WRITE = { 'fankeel-verifier': ['Write'], 'fankeel-fixer': ['Edit', 'Write'] };
```

在 `tests/skills.test.js` 檔尾加入三則新測試：

```js
// cavecrew-builder: verify, audit and build each name fankeel-fixer for the
// one case it exists for — a fix with no test cycle of its own — and all
// three carry the same file-count refusal in the same words, so one grep
// checks the contract everywhere it is repeated.
test('fankeel-verify: a false page with no test of its own goes to fankeel-fixer', () => {
  const flat = read('fankeel-verify').replace(/\s+/g, ' ');
  assert.match(flat, /subagent_type: fankeel-fixer/);
  assert.match(flat, /never more than two files at once/);
  assert.match(flat, /re-runs `docs-check` itself once it returns/);
});

test('fankeel-audit: a dead reference with no test of its own goes to fankeel-fixer', () => {
  const flat = read('fankeel-audit').replace(/\s+/g, ' ');
  assert.match(flat, /subagent_type: fankeel-fixer/);
  assert.match(flat, /never more than two files at once/);
});

test('fankeel-build: a no-test fix goes to fankeel-fixer instead of a resumed implementer', () => {
  const flat = read('fankeel-build').replace(/\s+/g, ' ');
  assert.match(flat, /subagent_type: fankeel-fixer/);
  assert.match(flat, /never more than two files at once/);
  assert.match(flat, /fankeel-fixer` cannot run a test/);
});
```

2. 執行並確認失敗：

```
node --test tests/agents.test.js tests/skills.test.js
```

預期 `tests/agents.test.js` 的兩則既有測試（`every agent parses...`、`the manifest ships
them all...`）失敗，因為 `agents/fankeel-fixer.md` 還不存在、`plugin.json` 也還沒列它；
`tests/skills.test.js` 的三則新測試失敗。

3. 實作。

新增 `agents/fankeel-fixer.md`：

```markdown
---
name: fankeel-fixer
description: Surgical fixer for a reference-page correction or a one-line code fix that needs no test run — verify's and audit's dead references and false sentences, and the small code fixes a reviewer already named. Refuses a fix that touches 3 or more files. Cannot call Bash, PowerShell or NotebookEdit.
tools: [Read, Edit, Write, Grep, Glob]
model: sonnet
status: current
last_verified: 2026-09-11
source_of_truth: lib/render.js
---

You are a fixer. The session that sent you has a finding and the file or
files it names; you make the smallest edit that resolves it and return which
lines changed, nothing else.

## Job

Read what the brief names — the finding, the file or files, the exact text a
page should say instead. Make the edit. This agent exists for fixes with
nothing to run afterward: a reference page's dead path or stale quote, a
false sentence a reviewer or the audit adversary already found, a one-line
code correction with no test cycle of its own. A fix that needs a
red-then-green test is a `build` task, not this agent — dispatch it there
instead.

## Tools

`Read`, `Edit`, `Write`, `Grep` and `Glob`. There is no `Bash` and no
`PowerShell`: this agent never runs a command, never runs the test suite, and
never touches `git`. `NotebookEdit` is not on the list either.

## Refusals

- **Three or more files.** If the brief's fix, read plainly, touches three
  files or more, refuse the whole thing before editing any of them — say how
  many files and name them, and make no edit. Two files or fewer is in scope.
- Do not run a test, a build, or any command — there is no tool for it here.
- Do not dispatch a subagent of your own.
- Do not fix anything the brief did not name, however clearly wrong it looks
  beside it.

## Return

Which file, which line numbers, and what changed — one line per file — or the
refusal above with the file count and names. Nothing else: every line you
return stays in the parent's context for the rest of the session.
```

在 `.claude-plugin/plugin.json`，把

```json
  "agents": ["./agents/fankeel-reader.md", "./agents/fankeel-judge.md", "./agents/fankeel-reviewer.md", "./agents/fankeel-verifier.md"],
```

改成（`.claude-plugin/plugin.json`）：

```json
  "agents": ["./agents/fankeel-reader.md", "./agents/fankeel-judge.md", "./agents/fankeel-reviewer.md", "./agents/fankeel-verifier.md", "./agents/fankeel-fixer.md"],
```

在 `skills/fankeel-verify/SKILL.md`，在

```markdown
A renamed export, a changed default, a removed flag, a moved file — each has a
page somewhere that still says the old thing, and every reference in it still
resolves. Name the page and the line.

A change that is correct and leaves three pages describing the old behaviour has
been half verified.
```

這兩段之間，在 `skills/fankeel-verify/SKILL.md` 插入一段：

```markdown
A false page with nothing else to fix is a fix with no test cycle of its own:
dispatch `subagent_type: fankeel-fixer` with the page and the exact
correction, never more than two files at once. It returns which lines
changed, and this stage re-runs `docs-check` itself once it returns — a code
fix that needs its own red-then-green cycle is `build`'s, not this agent's.
```

在 `skills/fankeel-audit/SKILL.md`，在

```markdown
A dead path is a bug in a reference document and history in an archive.
`docs-check` reads the role from `docs.json` and grades it that way, which is
why the injected rule no longer says so: the script holds it.
```

這一段之後、「### The one that is not about documents」這個標題之前，在
`skills/fankeel-audit/SKILL.md` 插入：

```markdown
A dead reference or a stale quote with no test of its own is exactly this
kind of fix: dispatch `subagent_type: fankeel-fixer` with the page and the
correction, never more than two files at once, and re-run `docs-check`
yourself once it returns.
```

在 `skills/fankeel-build/SKILL.md`，在

```markdown
6. Fix rounds are bounded at **five**. A finding you overrule is a ruling, not a
   silence.

   When the fifth round ends with findings still open, record what remains as
   rulings with their cost — `ledger.js ruling` — and mark the task complete
   with them named. A cap that silently drops what it caps is the failure
   this is preventing.
```

這一段之後、「**A fix round lands the same way the task did**」這一段之前，在
`skills/fankeel-build/SKILL.md` 插入：

```markdown
   A finding that is a reference-page correction or a one-line fix with no
   test cycle of its own does not need a fix round at all: dispatch
   `subagent_type: fankeel-fixer` instead of resuming the task's implementer,
   never more than two files at once, and re-run whatever check the finding
   named yourself once it returns. A fix that needs its own red-then-green
   cycle still resumes the implementer — `fankeel-fixer` cannot run a test.
```

4. 執行並確認通過：

```
node --test tests/agents.test.js tests/skills.test.js
```

5. Commit：

```
git add agents/fankeel-fixer.md .claude-plugin/plugin.json skills/fankeel-verify/SKILL.md skills/fankeel-audit/SKILL.md skills/fankeel-build/SKILL.md tests/agents.test.js tests/skills.test.js
git commit -m "feat(agents): add fankeel-fixer for no-test reference and one-line fixes"
```

---

## Task 8: caveman 解耦 — badge.js 的註解不再點名

`lib/badge.js:166,181` 的兩段註解目前點名 caveman 與 ponytail；改成不點名的「另一個外掛」，
`docs/improvement-brief.md` 引用這兩行的引文與散文一起改（設計 §4「解耦」）。
`docs/plans/2026-09-08-behaviour-eval.md` 是 plan 紀錄，不動。

**Files:**
- Modify: `lib/badge.js` — 166-167 行、179-182 行兩段註解改寫，不再點名 caveman／ponytail
- Modify: `docs/improvement-brief.md` — 第 1070-1071 行引用這兩段註解的引文與散文一起改
- Test: `tests/badge.test.js` — 新增一則斷言，檔案裡不再出現這兩個外掛的名字

**Interfaces:**
- Consumes: none
- Produces: none（只改註解與文件散文，行為不變）

**Dispatch:** implementer, sonnet

### 步驟

1. 先寫失敗的測試。在 `tests/badge.test.js`，在既有的
   `test('pruneBadges leaves another plugin flag and its directory alone', ...)`
   （目前這則測試本身不動，行為釘住的是 pruning 邏輯，不是註解文字）之後加入：

```js
// caveman decoupling: the comments used to name caveman and ponytail by
// identity for no functional reason — pruneBadges never checks who a
// sibling flag belongs to. This is a comment-only change, so the test reads
// the source text rather than calling anything.
test('lib/badge.js does not name another plugin by identity in its comments', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'badge.js'), 'utf8');
  assert.equal(/caveman/i.test(src), false, 'lib/badge.js still names caveman');
  assert.equal(/ponytail/i.test(src), false, 'lib/badge.js still names ponytail');
});
```

（`fs` 與 `path` 已經是這個檔案頂端既有的 `require`，不必新增。）

2. 執行並確認失敗：

```
node --test tests/badge.test.js
```

3. 實作。在 `lib/badge.js`，把

```js
// Standing a task down turns the mode off, and the badge has to go with it in the
// same breath. Leaving it would show a stage for a task that no longer exists —
// the statusline is the only place a lie about the mode is visible all the time.
//
// Only this plugin's flag is removed, never the directory: caveman and ponytail
// keep theirs in the same place.
function clearBadge(claudeDir, sessionId) {
```

改成（`lib/badge.js`）：

```js
// Standing a task down turns the mode off, and the badge has to go with it in the
// same breath. Leaving it would show a stage for a task that no longer exists —
// the statusline is the only place a lie about the mode is visible all the time.
//
// Only this plugin's flag is removed, never the directory: another plugin may
// keep its own flag in the same place.
function clearBadge(claudeDir, sessionId) {
```

再把（`lib/badge.js` 裡）：

```js
// Sessions end without warning and their flag files outlive them. Only this
// plugin's own flag is ever removed, and the enclosing directory only when
// nothing else is left in it — caveman and ponytail keep their flags in the same
// place, and tidying is no reason to delete another plugin's state.
```

改成（`lib/badge.js`）：

```js
// Sessions end without warning and their flag files outlive them. Only this
// plugin's own flag is ever removed, and the enclosing directory only when
// nothing else is left in it — another plugin may keep its own flag in the same
// place, and tidying is no reason to delete another plugin's state.
```

在 `docs/improvement-brief.md`，把

```markdown
- `lib/badge.js:166`（`caveman and ponytail`）與 `lib/badge.js:181`（`caveman and ponytail keep their flags`）兩段註解：清徽章時不刪 caveman 與 ponytail
  放在同一個目錄裡的旗標。
```

改成（`docs/improvement-brief.md`）：

```markdown
- `lib/badge.js:166`（`another plugin may`）與 `lib/badge.js:181`（`another plugin may keep its own flag`）兩段註解：清徽章時不刪
  別的外掛放在同一個目錄裡的旗標，不點名是哪一個。
```

4. 執行並確認通過：

```
node --test tests/badge.test.js
node scripts/docs-check.js
```

`docs-check.js` 要 exit 0 ——引文改了之後，:166、:181 兩個引用的行號沒有位移，但引文
必須改到能在對應行找到，否則會印 `moved` 或 `does not hold`。

5. Commit：

```
git add lib/badge.js docs/improvement-brief.md tests/badge.test.js
git commit -m "refactor(badge): stop naming another plugin by identity in comments"
```

---

## Task 9: `scripts/memory-check.js` — 索引、失效路徑、超出檔尾

新增 `scripts/memory-check.js`，找 `<configDir>/projects/<slug>/memory/`（slug 由專案
絕對路徑把 `:`、`\`、`/` 換成 `-`），報四種問題裡的前三種：索引與檔案兩個方向對不上、
引用的 repo 路徑已不存在（`dead`）、`path:line` 超出檔尾（`past-end`）。只看第一段是
專案頂層已追蹤項目的路徑，`.fankeel/` 底下的樣板片段一律不報。第四種（`stale`）留給
Task 10（設計 §5，前三種的部分）。

**Files:**
- Modify: `scripts/memory-check.js`（new） — CLI、`scan()`、`report()`
- Read: `scripts/docs-check.js` — 重用 `LINK`、`CODE`、`PATHISH`（regex）、
  `resolveRef(root, fromRel, ref)`、`external(ref)`
- Read: `lib/live.js` — 重用 `liveConfigDir()` 當 `--config-dir` 的預設值
- Read: `lib/registry.js` — 重用 `resolveRoot(value)` 當 `--root` 的解析
- Read: `lib/tracked.js` — 重用 `trackedFiles(root)` 算出「頂層已追蹤項目」的集合
- Read: `lib/report.js` — 重用 `section(title, rows, max)` 排版清單
- Read: `lib/docs.js` — 重用 `STATE_DIR` 常數，排掉 `.fankeel/` 底下的樣板片段
- Test: `tests/memory-check.test.js`（new）

**Interfaces:**
- Consumes: `LINK`、`CODE`、`PATHISH`（RegExp）、`resolveRef(root, fromRel, ref)`、
  `external(ref)` from `scripts/docs-check.js`；`liveConfigDir()` from `lib/live.js`；
  `resolveRoot(value)` from `lib/registry.js`；`trackedFiles(root)` from
  `lib/tracked.js`；`section(title, rows, max)` from `lib/report.js`；`STATE_DIR`
  from `lib/docs.js`
- Produces: `scan(root, configDir)`、`report(result)`、`parseArgs(argv)`、
  `main(argv)`、`projectSlug(root)`、`memoryDir(configDir, root)`、
  `indexEntries(text)`、`citations(text, roots)` from `scripts/memory-check.js` —
  Task 10 擴充 `scan()`／`report()` 加入 `stale`，並消費 `memoryDir()`

**Dispatch:** implementer, sonnet

### 步驟

1. 先寫失敗的測試。新增 `tests/memory-check.test.js`：

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const {
  scan, report, main, projectSlug, memoryDir,
} = require('../scripts/memory-check.js');

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-memcheck-project-'));
}
function tmpConfig() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-memcheck-config-'));
}
function initGit(root) {
  cp.execFileSync('git', ['init', '-q'], { cwd: root });
  cp.execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  cp.execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
}
function commitAll(root, msg) {
  cp.execFileSync('git', ['add', '-A'], { cwd: root });
  cp.execFileSync('git', ['commit', '-q', '-m', msg], { cwd: root });
}
function seedNote(dir, name, body) {
  fs.writeFileSync(path.join(dir, name),
    '---\nname: ' + name.replace(/\.md$/, '') + '\ndescription: x\nmetadata:\n  type: reference\n---\n\n' + body + '\n');
}

test('projectSlug replaces :, \\ and / each with -', () => {
  assert.equal(projectSlug('F:\\ymlab\\fankeel'), 'F--ymlab-fankeel');
});

test('memoryDir composes configDir/projects/<slug>/memory', () => {
  const configDir = tmpConfig();
  const root = 'F:\\ymlab\\fankeel';
  assert.equal(memoryDir(configDir, root), path.join(configDir, 'projects', 'F--ymlab-fankeel', 'memory'));
});

test('scan() says there is nothing to check when the project has no memory yet', () => {
  const result = scan(tmpProject(), tmpConfig());
  assert.equal(result.present, false);
  assert.match(report(result), /nothing to check/);
});

test('scan() reports a memory entry citing a repo path that does not exist', () => {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'real.js'), 'module.exports = {};\n');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [A note](a-note.md) — a hook\n');
  seedNote(dir, 'a-note.md', 'See `lib/ghost.js` for the thing.');
  const result = scan(root, configDir);
  assert.ok(result.findings.some((f) => f.tag === 'dead' && f.what.includes('lib/ghost.js')));
});

test('scan() does not report a path whose first segment this project never tracks', () => {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'real.js'), '');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [B note](b-note.md) — a hook\n');
  seedNote(dir, 'b-note.md', 'See `SomeOtherProject/file.js`.');
  const result = scan(root, configDir);
  assert.equal(result.findings.filter((f) => f.tag === 'dead').length, 0);
});

test('scan() never reports a .fankeel/ citation, even when .fankeel is tracked', () => {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), '{}');
  initGit(root);
  commitAll(root, 'seed');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [C note](c-note.md) — a hook\n');
  seedNote(dir, 'c-note.md', 'See `.fankeel/build/some-plan/scratch.md`.');
  const result = scan(root, configDir);
  assert.equal(result.findings.filter((f) => f.tag === 'dead').length, 0);
});

test('scan() reports a memory entry citing a line past the end of the file', () => {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'real.js'), 'line1\nline2\nline3\n');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [D note](d-note.md) — a hook\n');
  seedNote(dir, 'd-note.md', 'See `lib/real.js:99`.');
  const result = scan(root, configDir);
  assert.ok(result.findings.some((f) => f.tag === 'past-end' && f.what.includes('lib/real.js:99')));
});

test('scan() reports the index and the directory when they disagree, both directions', () => {
  const root = tmpProject();
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [E note](e-note.md) — a hook\n');
  // e-note.md is never written: the index links a file missing on disk.
  seedNote(dir, 'f-note.md', 'body with no citations');
  // f-note.md exists on disk but MEMORY.md never links it.
  const result = scan(root, configDir);
  assert.ok(result.findings.some((f) => f.tag === 'index' && f.what.includes('e-note.md')));
  assert.ok(result.findings.some((f) => f.tag === 'index' && f.what.includes('f-note.md')));
});

test('main() exits non-zero when findings exist, zero when the memory is clean', () => {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'real.js'), 'ok\n');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [Z note](z-note.md) — a hook\n');
  seedNote(dir, 'z-note.md', 'All good, see `lib/real.js`.');
  const clean = main(['--root', root, '--config-dir', configDir]);
  assert.equal(clean.code, 0);

  seedNote(dir, 'z-note.md', 'See `lib/ghost.js`.');
  const dirty = main(['--root', root, '--config-dir', configDir]);
  assert.equal(dirty.code, 1);
});
```

2. 執行並確認失敗：

```
node --test tests/memory-check.test.js
```

預期整個檔案因為 `scripts/memory-check.js` 還不存在、`require` 找不到檔案而整批失敗
（`MODULE_NOT_FOUND`）。

3. 實作。新增 `scripts/memory-check.js`：

```js
#!/usr/bin/env node
'use strict';

// Whether Claude Code's own memory for this project still points at
// something real.
//
//   node memory-check.js [--root <project>] [--config-dir <dir>]
//
// Claude Code writes here and never prunes it. Nothing else in this plugin
// ever reads it, so a path a memory entry cites can go dead — or move —
// with nothing noticing but the next person who trusts the entry. This
// reuses `docs-check.js`'s own machinery for the reference-checking half
// rather than writing a second regex for a claim this repository already
// knows how to check.
//
// Only a path whose first segment is a top-level entry this project actually
// tracks is a claim about this project. A survey pass that guessed at "dead"
// paths by pattern alone found six hits that were every one of them a path
// outside the repository — `~/.claude/...`, another project, a
// `.fankeel/build/` scratch fragment — and reporting those is how a checker
// earns being ignored.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');

const { liveConfigDir } = require('../lib/live.js');
const { resolveRoot } = require('../lib/registry.js');
const { trackedFiles } = require('../lib/tracked.js');
const docs = require('../lib/docs.js');
const { section } = require('../lib/report.js');
const { LINK, CODE, PATHISH, resolveRef, external } = require('./docs-check.js');

const MAX_FINDINGS = 200;

// `F:\ymlab\fankeel` -> `F--ymlab-fankeel`. The three characters a Windows or
// POSIX path can carry that a directory name cannot, each turned into the one
// character every path already avoids — Claude Code's own scheme, read off a
// real memory directory rather than guessed at.
function projectSlug(root) {
    return path.resolve(root).replace(/[:\\/]/g, '-');
}

function memoryDir(configDir, root) {
    return path.join(configDir, 'projects', projectSlug(root), 'memory');
}

function readFile(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
}

function lineCount(file) {
    const text = readFile(file);
    if (text === null) return null;
    const l = text.split('\n');
    if (l.length && l[l.length - 1] === '') l.pop();
    return l.length;
}

// Every `[title](file.md)` bullet MEMORY.md carries. A bare same-directory
// `.md` name only — a link elsewhere on the page pointing anywhere else is
// not one of the memory files this index is keeping in step with the
// directory.
function indexEntries(text) {
    const out = [];
    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(text)) !== null) {
        const ref = m[1];
        if (external(ref)) continue;
        if (/^[\w.-]+\.md$/.test(ref)) out.push(ref);
    }
    return out;
}

// One memory file's own citations of this project's code, in the same shape
// `docs-check.js` checks a reference document in: a code span shaped like
// `path` or `path:N`, its first segment a root this project actually tracks.
// The state directory is excluded the same way and for the same reason
// `docs-check.js` excludes it — this project's own `.fankeel/docs.json` is
// tracked, and `.fankeel/build/` is not the runtime's promise to keep
// existing.
function citations(text, roots) {
    const out = [];
    CODE.lastIndex = 0;
    let m;
    while ((m = CODE.exec(text)) !== null) {
        const span = m[1].trim();
        if (span.endsWith('/')) continue;
        const hit = PATHISH.exec(span);
        if (!hit) continue;
        const ref = hit[1];
        if (ref === docs.STATE_DIR || ref.startsWith(docs.STATE_DIR + '/')) continue;
        if (!roots.has(ref.split('/')[0])) continue;
        out.push({ ref, wanted: hit[2] ? parseInt(hit[2], 10) : null });
    }
    return out;
}

function scan(root, configDir) {
    const dir = memoryDir(configDir, root);
    const indexFile = path.join(dir, 'MEMORY.md');
    const indexText = readFile(indexFile);
    if (indexText === null) return { dir, present: false, findings: [], indexed: 0, onDisk: 0 };

    let names;
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'MEMORY.md');
    } catch (e) {
        names = [];
    }
    const onDisk = new Set(names);
    const indexed = indexEntries(indexText);
    const indexedSet = new Set(indexed);

    const findings = [];
    for (const ref of indexed) {
        if (!onDisk.has(ref)) findings.push({ tag: 'index', what: 'MEMORY.md links ' + ref + ', which is not on disk' });
    }
    for (const name of onDisk) {
        if (!indexedSet.has(name)) findings.push({ tag: 'index', what: name + ' is on disk and not linked from MEMORY.md' });
    }

    const tracked = trackedFiles(root);
    const roots = new Set((tracked ? tracked.files : []).map((f) => f.split('/')[0]));

    for (const name of onDisk) {
        const text = readFile(path.join(dir, name));
        if (text === null) continue;
        for (const { ref, wanted } of citations(text, roots)) {
            const found = resolveRef(root, '', ref);
            if (found === null) {
                findings.push({ tag: 'dead', what: name + ' cites ' + ref + ', which no longer exists' });
                continue;
            }
            if (wanted !== null) {
                const n = lineCount(path.join(root, found.split('/').join(path.sep)));
                if (n !== null && wanted > n) {
                    findings.push({ tag: 'past-end', what: name + ' cites ' + ref + ':' + wanted + ' but the file ends at ' + n });
                }
            }
        }
    }

    return { dir, present: true, findings, indexed: indexed.length, onDisk: onDisk.size };
}

function report(result) {
    if (!result.present) {
        return 'fankeel memory-check: no native memory yet at ' + result.dir + ' — nothing to check.';
    }
    const lines = [];
    lines.push('fankeel memory-check — ' + result.dir);
    lines.push('  ' + result.indexed + ' indexed, ' + result.onDisk + ' on disk');
    lines.push(...section(result.findings.length + (result.findings.length === 1 ? ' finding:' : ' findings:'),
        result.findings.map((f) => f.tag + ': ' + f.what), MAX_FINDINGS));
    if (!result.findings.length) {
        lines.push('');
        lines.push('Every entry is indexed both ways, and every cited repository path still');
        lines.push('exists where it says it does.');
    }
    return lines.join('\n');
}

function parseArgs(argv) {
    const { values } = parseArgv({
        args: argv,
        strict: false,
        allowPositionals: true,
        options: { root: { type: 'string' }, 'config-dir': { type: 'string' }, quiet: { type: 'boolean' } },
    });
    return {
        root: resolveRoot(values.root),
        configDir: typeof values['config-dir'] === 'string' && values['config-dir'] ? path.resolve(values['config-dir']) : liveConfigDir(),
        quiet: Boolean(values.quiet),
    };
}

function main(argv) {
    const { root, configDir, quiet } = parseArgs(argv);
    const result = scan(root, configDir);
    const text = report(result);
    const bad = result.present && result.findings.length > 0;
    return { text: quiet && !bad ? '' : text, code: bad ? 1 : 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    if (text) process.stdout.write(text + '\n');
    process.exit(code);
}

module.exports = { scan, report, parseArgs, main, projectSlug, memoryDir, indexEntries, citations };
```

4. 執行並確認通過：

```
node --test tests/memory-check.test.js
```

輸出應以 `ℹ pass` 結尾，`ℹ fail 0`。再跑一次全套避免動到別的檔案：

```
npm test
```

5. Commit：

```
git add scripts/memory-check.js tests/memory-check.test.js
git commit -m "feat(memory-check): report index, dead and past-end memory citations"
```

---

## Task 10: `scripts/memory-check.js` — 加入 `stale`

在 Task 9 的基礎上，加入第四種問題：`stale`——條目 frontmatter 的
`metadata.modified` 早於它引用的某個檔案最後一次 commit。`stale` 只列出來，不讓
exit 非零。要讀 `metadata.modified` 得先讓 `lib/docs.js` 的 `frontmatter()` 認得一層
巢狀鍵（`metadata:` 底下縮排的 `modified: ...`），目前它只認頂層 `key: value`
（設計 §5，`stale` 與重用 `frontmatter()` 的部分）。

**Files:**
- Modify: `lib/docs.js` — `frontmatter()` 多認一層巢狀鍵，用 `parent.child` 當鍵名
- Modify: `scripts/memory-check.js` — 加入 `lastCommit()`，`scan()`／`report()`
  擴充出 `stale`
- Test: `tests/docs.test.js` — `frontmatter()` 的新測試
- Test: `tests/memory-check.test.js` — `stale` 的新測試

**Interfaces:**
- Consumes: `scan(root, configDir)`、`memoryDir(configDir, root)` from
  `scripts/memory-check.js`（Task 9 產生）
- Produces: `lastCommit(root, rel)` from `scripts/memory-check.js`；`scan()` 的回傳
  多一個 `stale` 陣列；`lib/docs.js` 的 `frontmatter()` 對巢狀鍵多回傳
  `'metadata.modified'`、`'metadata.type'` 這類 `parent.child` 鍵

**Dispatch:** implementer, sonnet

### 步驟

1. 先寫失敗的測試。在 `tests/docs.test.js`（檔案已經以 `lib/docs.js` 的 `require(...)` 結果
   為 `docs`），在最後一個 `test(...)` 之後加入：

```js
// memory-check needs metadata.modified, which sits one level indented under a
// top-level `metadata:` key with an empty inline value — frontmatter() today
// only reads lines starting at column 0, so this is currently invisible to it.
test('frontmatter() flattens one level of nested keys under a parent with no inline value', () => {
  const text = '---\nname: x\nmetadata:\n  type: reference\n  modified: 2026-08-25T06:45:37.444Z\n---\nbody\n';
  const fm = docs.frontmatter(text);
  assert.equal(fm.name, 'x');
  assert.equal(fm['metadata.type'], 'reference');
  assert.equal(fm['metadata.modified'], '2026-08-25T06:45:37.444Z');
});
```

在 `tests/memory-check.test.js` 檔尾加入：

```js
test('scan() flags a memory entry whose modified predates the last commit to a path it cites', () => {
  const root = tmpProject();
  initGit(root);
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'thing.js'), 'v1\n');
  commitAll(root, 'add thing.js');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [G note](g-note.md) — a hook\n');
  fs.writeFileSync(path.join(dir, 'g-note.md'),
    '---\nname: g-note\ndescription: x\nmetadata:\n  type: reference\n  modified: 2020-01-01T00:00:00.000Z\n---\n\nSee `lib/thing.js`.\n');
  const result = scan(root, configDir);
  assert.ok(result.stale.some((s) => s.what.includes('lib/thing.js')));
  assert.equal(result.findings.length, 0, 'a stale citation is not a failing finding');
});

test('scan() does not flag a memory entry modified after the path it cites', () => {
  const root = tmpProject();
  initGit(root);
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'thing.js'), 'v1\n');
  commitAll(root, 'add thing.js');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [H note](h-note.md) — a hook\n');
  const future = new Date(Date.now() + 3600e3).toISOString();
  fs.writeFileSync(path.join(dir, 'h-note.md'),
    '---\nname: h-note\ndescription: x\nmetadata:\n  type: reference\n  modified: ' + future + '\n---\n\nSee `lib/thing.js`.\n');
  const result = scan(root, configDir);
  assert.equal(result.stale.length, 0);
});
```

2. 執行並確認失敗：

```
node --test tests/docs.test.js tests/memory-check.test.js
```

`frontmatter()` 那則測試失敗（巢狀鍵目前讀不到）；`memory-check.test.js` 的兩則新測試
失敗（`result.stale` 是 `undefined`，`.some`／`.length` 會丟例外）。

3. 實作。在 `lib/docs.js`，把

```js
function frontmatter(text) {
    const m = FRONTMATTER.exec(String(text || ''));
    if (!m) return null;
    const out = {};
    for (const line of m[1].split(/\r?\n/)) {
        const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
        if (kv) out[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '');
    }
    return out;
}
```

改成（`lib/docs.js`）：

```js
function frontmatter(text) {
    const m = FRONTMATTER.exec(String(text || ''));
    if (!m) return null;
    const out = {};
    let parent = null;
    for (const line of m[1].split(/\r?\n/)) {
        const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
        if (kv) {
            const key = kv[1].toLowerCase();
            const value = kv[2].trim().replace(/^["']|["']$/g, '');
            out[key] = value;
            // A top-level key with nothing after the colon is a parent whose
            // fields sit indented on the lines under it — `metadata:` for the
            // memory frontmatter this exists to read. Any other top-level
            // line, blank value or not, closes it.
            parent = value === '' ? key : null;
            continue;
        }
        const nested = parent && /^\s+([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
        if (nested) {
            out[parent + '.' + nested[1].toLowerCase()] = nested[2].trim().replace(/^["']|["']$/g, '');
        }
    }
    return out;
}
```

在 `scripts/memory-check.js`，把

```js
const { liveConfigDir } = require('../lib/live.js');
const { resolveRoot } = require('../lib/registry.js');
const { trackedFiles } = require('../lib/tracked.js');
const docs = require('../lib/docs.js');
const { section } = require('../lib/report.js');
const { LINK, CODE, PATHISH, resolveRef, external } = require('./docs-check.js');
```

改成（`scripts/memory-check.js` 加入 `child_process`）

```js
const cp = require('node:child_process');
const { liveConfigDir } = require('../lib/live.js');
const { resolveRoot } = require('../lib/registry.js');
const { trackedFiles } = require('../lib/tracked.js');
const docs = require('../lib/docs.js');
const { section } = require('../lib/report.js');
const { LINK, CODE, PATHISH, resolveRef, external } = require('./docs-check.js');
```

在 `scripts/memory-check.js` 的 `lineCount()` 之後加入一個新函式：

```js
// The last time a real commit touched this path, or null for "never, or this
// is not a repository". `%cI` is the committer date in strict ISO 8601,
// which `Date.parse` reads with no translation step.
function lastCommit(root, rel) {
    try {
        const out = cp.execFileSync('git', ['log', '-1', '--format=%cI', '--', rel], {
            cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        return out ? Date.parse(out) : null;
    } catch (e) {
        return null;
    }
}
```

把 `scripts/memory-check.js` 的 `scan()` 裡

```js
    for (const name of onDisk) {
        const text = readFile(path.join(dir, name));
        if (text === null) continue;
        for (const { ref, wanted } of citations(text, roots)) {
            const found = resolveRef(root, '', ref);
            if (found === null) {
                findings.push({ tag: 'dead', what: name + ' cites ' + ref + ', which no longer exists' });
                continue;
            }
            if (wanted !== null) {
                const n = lineCount(path.join(root, found.split('/').join(path.sep)));
                if (n !== null && wanted > n) {
                    findings.push({ tag: 'past-end', what: name + ' cites ' + ref + ':' + wanted + ' but the file ends at ' + n });
                }
            }
        }
    }

    return { dir, present: true, findings, indexed: indexed.length, onDisk: onDisk.size };
```

改成（`scripts/memory-check.js`）：

```js
    const stale = [];
    for (const name of onDisk) {
        const text = readFile(path.join(dir, name));
        if (text === null) continue;
        const fm = docs.frontmatter(text) || {};
        const modified = fm['metadata.modified'] ? Date.parse(fm['metadata.modified']) : NaN;

        for (const { ref, wanted } of citations(text, roots)) {
            const found = resolveRef(root, '', ref);
            if (found === null) {
                findings.push({ tag: 'dead', what: name + ' cites ' + ref + ', which no longer exists' });
                continue;
            }
            if (wanted !== null) {
                const n = lineCount(path.join(root, found.split('/').join(path.sep)));
                if (n !== null && wanted > n) {
                    findings.push({ tag: 'past-end', what: name + ' cites ' + ref + ':' + wanted + ' but the file ends at ' + n });
                    continue;
                }
            }
            if (Number.isNaN(modified)) continue;
            const commit = lastCommit(root, found);
            // A correct memory entry can still cite a file that changed after
            // it was written — this is listed, never a failing finding.
            if (commit !== null && modified < commit) {
                stale.push({ tag: 'stale', what: name + ' cites ' + ref + ', changed since this entry was last touched' });
            }
        }
    }

    return { dir, present: true, findings, stale, indexed: indexed.length, onDisk: onDisk.size };
```

把 `scripts/memory-check.js` 的 `report()` 裡

```js
    lines.push(...section(result.findings.length + (result.findings.length === 1 ? ' finding:' : ' findings:'),
        result.findings.map((f) => f.tag + ': ' + f.what), MAX_FINDINGS));
    if (!result.findings.length) {
        lines.push('');
        lines.push('Every entry is indexed both ways, and every cited repository path still');
        lines.push('exists where it says it does.');
    }
    return lines.join('\n');
```

改成（`scripts/memory-check.js`）：

```js
    lines.push(...section(result.findings.length + (result.findings.length === 1 ? ' finding:' : ' findings:'),
        result.findings.map((f) => f.tag + ': ' + f.what), MAX_FINDINGS));
    if (!result.findings.length) {
        lines.push('');
        lines.push('Every entry is indexed both ways, and every cited repository path still');
        lines.push('exists where it says it does.');
    }
    lines.push(...section(result.stale.length + (result.stale.length === 1
        ? ' entry cites a file changed since it was written:'
        : ' entries cite a file changed since they were written:'),
        result.stale.map((f) => f.what), MAX_FINDINGS));
    return lines.join('\n');
```

同時把 `scripts/memory-check.js` 的 `scan()` 裡「沒有 memory 目錄」的早退回傳也補上空的 `stale`：

```js
    if (indexText === null) return { dir, present: false, findings: [], indexed: 0, onDisk: 0 };
```

改成（`scripts/memory-check.js`）：

```js
    if (indexText === null) return { dir, present: false, findings: [], stale: [], indexed: 0, onDisk: 0 };
```

最後把 `scripts/memory-check.js` 的 `module.exports` 加上 `lastCommit`：

```js
module.exports = { scan, report, parseArgs, main, projectSlug, memoryDir, indexEntries, citations, lastCommit };
```

4. 執行並確認通過：

```
node --test tests/docs.test.js tests/memory-check.test.js
npm test
```

5. Commit：

```
git add lib/docs.js scripts/memory-check.js tests/docs.test.js tests/memory-check.test.js
git commit -m "feat(memory-check): flag a stale citation via frontmatter's nested modified"
```

---

## Task 11: memory-check 接進 `/fankeel-audit` 與 `/fankeel-land`，寫下修正慣例

`memory-check.js` 當 `/fankeel-audit` 的第四支 scanner，`fankeel-land` skill 在
「這個任務寫過 memory」時點它一次；D 的修正慣例（`**Corrected YYYY-MM-DD:**`）寫在
memory-check 的結果旁邊。都不進注入規則（設計 §4 D、§5 觸發與修正慣例部分）。連帶把
caveman／ponytail 解除安裝「使用者的指令、land 時提出、不由 session 執行」這句寫成
`fankeel-land` 的一條規則（設計 §4「解除安裝」）。

**Files:**
- Modify: `lib/stages.js` — `audit` 這個 stage 的 `template` 陣列裡加入
  `scripts/memory-check.js` 的輸出區塊（不是 `rules`，不佔注入容量）
- Modify: `skills/fankeel-audit/SKILL.md` — frontmatter 的 `source_of_truth`、
  「## Run all three」改「## Run all four」、新的「### The native memory」節、
  「## Output」的 fenced 區塊
- Modify: `skills/fankeel-land/SKILL.md` — 「## 4. Land the notes」加一段跑
  memory-check 的時機；「Discarding is not on the menu」旁邊加一段解除安裝的規則
- Read: `scripts/memory-check.js` — CLI 介面與旗標（Task 9、Task 10 產生）
- Test: `tests/skills.test.js` — 三則新斷言
- Test: `tests/stages.test.js` — 一則新斷言，釘住 `template` 裡兩者的相對順序

**Interfaces:**
- Consumes: `templateFor(name)` from `lib/stages.js`；
  `node <plugin>/scripts/memory-check.js [--root <dir>] [--config-dir <dir>]` 這支
  CLI（Task 9、Task 10 產生）
- Produces: none（純樣板／散文擴充）

**Dispatch:** implementer, sonnet

### 步驟

1. 先寫失敗的測試。在 `tests/skills.test.js` 檔尾加入：

```js
// D + §5 triggers: audit runs memory-check as its fourth scanner and names
// the correction convention beside it; land runs it once when this task
// wrote memory, and never runs an uninstall on its own say-so.
test('fankeel-audit: runs memory-check as the fourth scanner and names the correction convention', () => {
  const flat = read('fankeel-audit').replace(/\s+/g, ' ');
  assert.match(flat, /scripts\/memory-check\.js/);
  assert.match(flat, /\*\*Corrected YYYY-MM-DD:\*\*/);
});

test('fankeel-land: runs memory-check when this task wrote memory', () => {
  const flat = read('fankeel-land').replace(/\s+/g, ' ');
  assert.match(flat, /scripts\/memory-check\.js/);
  assert.match(flat, /\*\*Corrected YYYY-MM-DD:\*\*/);
});

test('fankeel-land: uninstalling a decoupled plugin is offered, never run here', () => {
  const flat = read('fankeel-land').replace(/\s+/g, ' ');
  assert.match(flat, /Neither is uninstalling a plugin this session decoupled from/);
  assert.match(flat, /offered here rather than run/);
});
```

在 `tests/stages.test.js`，在既有的
`assert.match(templateFor('audit'), /^pairs disagree: <where, or omit this line>$/m);`
那則測試之後加入一則新測試：

```js
test('the audit template shows the memory-check pair after the docs-audit pair', () => {
  const { templateFor } = require('../lib/stages.js');
  const t = templateFor('audit');
  const iAudit = t.indexOf('node <plugin>/scripts/docs-audit.js');
  const iMemory = t.indexOf('node <plugin>/scripts/memory-check.js');
  assert.ok(iAudit !== -1 && iMemory !== -1 && iMemory > iAudit,
    'the audit template does not show memory-check.js after docs-audit.js');
});
```

2. 執行並確認失敗：

```
node --test tests/skills.test.js tests/stages.test.js
```

同時也會讓既有的 `each stage template is exactly the shape its skill shows`（在
`tests/skills.test.js`）暫時失控——等第 3 步兩邊一起改完才會回到綠燈，先確認上面兩則
新測試以及這一則既有測試現在都是紅的（`lib/stages.js` 與兩支 SKILL.md 目前都還沒有
memory-check 的任何字樣）。

3. 實作。

在 `lib/stages.js`，把 `audit` 這個 stage 定義裡的 `template` 陣列

```js
        template: [
            'node <plugin>/scripts/docs-check.js',
            '<its output, quoted>',
            '',
            'node <plugin>/scripts/residue.js',
            '<its output, quoted>',
            '',
            'knip --dependencies · PYTHONUTF8=1 deptry . --ignore DEP001,DEP003,DEP004 --no-ansi',
            '<quoted, or which is not installed>',
            '',
            'node <plugin>/scripts/docs-audit.js',
            '<its output, quoted>',
            '',
            '- path:line — what is no longer true',
            '- path:line × path:line — what they disagree about, and which one the code supports',
            '',
            'adversary: <what it defeated, or none>',
            'pairs disagree: <where, or omit this line>',
            'routed: <heading — the entry, or omit this line>',
            'clean: <what you read and found nothing wrong in>',
            'then AskUserQuestion',
        ].join('\n'),
```

改成（在 `lib/stages.js` 的 `docs-audit.js` 那一對之後插入 `memory-check.js` 那一對）

```js
        template: [
            'node <plugin>/scripts/docs-check.js',
            '<its output, quoted>',
            '',
            'node <plugin>/scripts/residue.js',
            '<its output, quoted>',
            '',
            'knip --dependencies · PYTHONUTF8=1 deptry . --ignore DEP001,DEP003,DEP004 --no-ansi',
            '<quoted, or which is not installed>',
            '',
            'node <plugin>/scripts/docs-audit.js',
            '<its output, quoted>',
            '',
            'node <plugin>/scripts/memory-check.js',
            '<its output, quoted>',
            '',
            '- path:line — what is no longer true',
            '- path:line × path:line — what they disagree about, and which one the code supports',
            '',
            'adversary: <what it defeated, or none>',
            'pairs disagree: <where, or omit this line>',
            'routed: <heading — the entry, or omit this line>',
            'clean: <what you read and found nothing wrong in>',
            'then AskUserQuestion',
        ].join('\n'),
```

（`rules` 陣列與其他 stage 都不動——這是 `template`，不佔注入容量。）

在 `skills/fankeel-audit/SKILL.md`，frontmatter 裡把

```markdown
source_of_truth: scripts/docs-check.js, scripts/docs-audit.js, scripts/residue.js
```

改成（`skills/fankeel-audit/SKILL.md`）：

```markdown
source_of_truth: scripts/docs-check.js, scripts/docs-audit.js, scripts/residue.js, scripts/memory-check.js
```

把 `skills/fankeel-audit/SKILL.md` 裡的

`````markdown
## Run all three

```
node <plugin>/scripts/docs-check.js [--root <dir>]
node <plugin>/scripts/residue.js [--root <dir>]
node <plugin>/scripts/docs-audit.js [--root <dir>] [--since <days>]
```
`````

改成（`skills/fankeel-audit/SKILL.md`）：

`````markdown
## Run all four

```
node <plugin>/scripts/docs-check.js [--root <dir>]
node <plugin>/scripts/residue.js [--root <dir>]
node <plugin>/scripts/docs-audit.js [--root <dir>] [--since <days>]
node <plugin>/scripts/memory-check.js [--root <dir>] [--config-dir <dir>]
```
`````

在 `skills/fankeel-audit/SKILL.md`

```markdown
### An environment nothing can rebuild or run

| | |
|---|---|
| **no Python manifest beside it** | no `pyproject.toml`, `requirements.txt`, `setup.py`, `setup.cfg`, `Pipfile` or `environment.yml` in the same directory. Nothing here can rebuild it, so whatever is inside is all there is |
| **interpreter gone** | the `home` line in `pyvenv.cfg` names a path that is not on this machine. This is what a tree copied from another computer looks like: it cannot be activated and it cannot be rebuilt |
```

這一段之後、「## What the sweep reports」之前，在 `skills/fankeel-audit/SKILL.md` 插入一整節：

```markdown
### The native memory

`memory-check.js` reads Claude Code's own memory for this project —
`<configDir>/projects/<slug>/memory/` — the notes nothing else in this
plugin ever prunes. It reports mechanically: the index and the directory
disagreeing about which files exist, a cited repository path that is gone, a
`path:line` past the end of its file. Those three fail the run. A `stale`
line — an entry's `modified` older than the last commit to a path it cites —
is listed, never failed: a correct memory can still cite a file that changed
after it was written.

A memory entry `memory-check` finds wrong is corrected by adding a
`**Corrected YYYY-MM-DD:**` line naming what was wrong, never by a silent
rewrite — `workflow-run-meta-json.md`'s own corrected line is the working
example. Deletion is the user's call: remove only the entry the user points
at from the findings, never one inferred from a scanner alone.
```

在「## Output」的 fenced 區塊裡，把

```
node <plugin>/scripts/docs-audit.js
<its output, quoted>

- path:line — what is no longer true
```

改成

```
node <plugin>/scripts/docs-audit.js
<its output, quoted>

node <plugin>/scripts/memory-check.js
<its output, quoted>

- path:line — what is no longer true
```

在 `skills/fankeel-land/SKILL.md`，在

```markdown
| a project convention | `CLAUDE.md` |
| a durable fact about the user or repository | the memory directory |
| why a change was made | the commit message |
| work deliberately deferred | `TODO.md`, one line, under the heading for what it is short of — under `## Waiting`, `lifts when: <the event>` then a `MM-DD` stamp, or `todo-check` fails the gate below |
```

這個表格之後、「`notes` holds five」那一段之前，在 `skills/fankeel-land/SKILL.md` 插入：

```markdown
If this task wrote to the memory directory, run
`node <plugin>/scripts/memory-check.js` once before standing the task down. A
wrong entry it finds is corrected in place with a `**Corrected
YYYY-MM-DD:**` line, never a silent rewrite; a stale citation is only ever
listed, and a deletion happens only for the entry the user points at.
```

在 `skills/fankeel-land/SKILL.md`

```markdown
**Discarding is not on the menu.** It happens only when the user asks for it in
so many words, and then only against the typed word `discard`.
```

這一段之後，在 `skills/fankeel-land/SKILL.md` 插入：

```markdown
**Neither is uninstalling a plugin this session decoupled from.** Removing
caveman or ponytail after their code has been unhooked is the user's own
command, offered here rather than run — say what was decoupled and that it
can now be removed, and stop there.
```

4. 執行並確認通過：

```
node --test tests/skills.test.js tests/stages.test.js
npm test
node scripts/docs-check.js
node scripts/skills-check.js
```

`skills-check.js` 要 exit 0：`memory-check.js` 在 `SKILL.md` 裡第一次被點名時帶的
`--root`、`--config-dir` 兩個旗標必須是它自己 `parseArgs()` 真的接受的（Task
Task 9 已經用 `options: { root: ..., 'config-dir': ..., quiet: ... }` 這個形狀宣告過）。

5. Commit：

```
git add lib/stages.js skills/fankeel-audit/SKILL.md skills/fankeel-land/SKILL.md tests/skills.test.js tests/stages.test.js
git commit -m "docs(audit,land): wire memory-check in as the fourth scanner"
```

## Task 12: 探測 hook payload 帶不帶 `tool_response` 與 `agent_type`

第 6 節與第 10 節都引官方 hooks 文件（https://code.claude.com/docs/en/hooks.md）的兩句
話——PostToolUse 的輸入帶 `tool_response`、subagent 內觸發的 hook 輸入多帶 `agent_id` 與
`agent_type`——但本機從沒實際觀察過。兩節各自的「runtime 沒帶就改 Waiting」都要一個
具體的觀察結果才能判斷，所以這個 task 先跑，寫成一份可以被後面兩個 task 讀的紀錄。

**這一步要花錢：一次真正的 headless `claude -p` turn，會計費。** 執行 build 的人在跑下面
那條指令之前，要先把這一點對使用者說清楚並等一句可以繼續的話——不是安靜地跑過去。

**Files:**
- Modify: `docs/reports/2026-09-11-hook-payload-probe.md`（新檔）
- Modify: `docs/README.md` — 這份報告的索引列（`CONTRIBUTING.md:20`）

**Interfaces:**
- Consumes: none
- Produces: `docs/reports/2026-09-11-hook-payload-probe.md` 的「這一次定下來的」表——
  Task 14 與 Task 18 各讀其中一列（`tool_response`、`agent_type`）決定要不要照抄
  這兩個 task 後面的程式碼，還是改寫一條 `TODO.md` `## Waiting`。

**Dispatch:** in-session — 這一步本身要花錢跑一次 headless turn，只有正在跑 build 的
session 能在跑之前把這筆花費講給使用者聽並等一句話；派出去的 implementer 看不到這個
session 的使用者，沒有東西可等。

步驟：

1. 在 scratch 目錄建一支一次性 hook 腳本，把 payload 的最上層鍵和 `agent_type` 的值
   append 進一個 log 檔。

`C:/Users/Owner/AppData/Local/Temp/claude/F--ymlab-fankeel/13ebea34-67f5-4db3-a14d-09623cd37c0e/scratchpad/hook-probe/probe-hook.js`
（scratch，不進 repo，這個 task 的 `Files:` 不列它）：

```text
#!/usr/bin/env node
'use strict';
// 一次性探測腳本，不進 repo。把每次觸發的事件名、工具名、payload 最上層的鍵，以及
// agent_id / agent_type（有才印）各寫一行 JSON 進同目錄的 probe-log.jsonl。
const fs = require('fs');
const path = require('path');
const LOG = path.join(__dirname, 'probe-log.jsonl');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let line;
  try {
    const payload = JSON.parse(input);
    line = JSON.stringify({
      event: payload.hook_event_name || null,
      tool: payload.tool_name || null,
      keys: Object.keys(payload).sort(),
      agent_id: Object.prototype.hasOwnProperty.call(payload, 'agent_id') ? payload.agent_id : undefined,
      agent_type: Object.prototype.hasOwnProperty.call(payload, 'agent_type') ? payload.agent_type : undefined,
    });
  } catch (e) {
    line = JSON.stringify({ error: String(e) });
  }
  fs.appendFileSync(LOG, line + '\n');
});
```

2. 在同一個目錄放一份 settings 檔，把這支腳本掛上 PostToolUse 與 PreToolUse，兩邊都不設
   `matcher`（每個工具都要看到）。

`C:/Users/Owner/AppData/Local/Temp/claude/F--ymlab-fankeel/13ebea34-67f5-4db3-a14d-09623cd37c0e/scratchpad/hook-probe/settings.json`
（scratch，不進 repo）：

```text
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          { "type": "command", "command": "node \"C:/Users/Owner/AppData/Local/Temp/claude/F--ymlab-fankeel/13ebea34-67f5-4db3-a14d-09623cd37c0e/scratchpad/hook-probe/probe-hook.js\"", "timeout": 5 }
        ]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [
          { "type": "command", "command": "node \"C:/Users/Owner/AppData/Local/Temp/claude/F--ymlab-fankeel/13ebea34-67f5-4db3-a14d-09623cd37c0e/scratchpad/hook-probe/probe-hook.js\"", "timeout": 5 }
        ]
      }
    ]
  }
}
```

3. 產生一個新的 session id，跑一次 headless turn，提示語同時觸發一個 `Bash` 呼叫
   （在主 session 裡）和一個 `subagent_type: fankeel-reader` 的 `Agent` 呼叫（讓
   subagent 裡面也真的執行一個工具，這樣它自己的 PreToolUse/PostToolUse 才有東西可看）：

```bash
node -e "console.log(require('crypto').randomUUID())"
# 把印出來的值當作 <uuid> 代入下面這行
claude -p --session-id <uuid> \
  --settings "C:/Users/Owner/AppData/Local/Temp/claude/F--ymlab-fankeel/13ebea34-67f5-4db3-a14d-09623cd37c0e/scratchpad/hook-probe/settings.json" \
  --plugin-dir F:/ymlab/fankeel \
  "Run the Bash command \`echo probe-bash\` verbatim, exactly once. Then call the Agent tool exactly once with subagent_type fankeel-reader and this task text: 'Read package.json in this repository with the Read tool, then reply with just the word done.' Do nothing else, and stop once both have finished."
```

4. 等指令結束後再等幾秒（SessionEnd 是 async，可能在行程退出後才追上），然後讀 log：

```bash
cat "C:/Users/Owner/AppData/Local/Temp/claude/F--ymlab-fankeel/13ebea34-67f5-4db3-a14d-09623cd37c0e/scratchpad/hook-probe/probe-log.jsonl"
```

   對每一行判斷兩件事：
   - 有沒有一行 `event` 是 `PostToolUse`、`tool` 是 `Bash`、`agent_id` 是
     `undefined`（也就是主 session 自己的 Bash 呼叫）——它的 `keys` 陣列裡有沒有
     `"tool_response"`。
   - 有沒有一行帶 `agent_id`（也就是在 fankeel-reader 這個 subagent 裡面觸發
     的）——它的 `agent_type` 是什麼字面值：完全等於 `fankeel-reader`，還是
     `fankeel:fankeel-reader`，還是這個鍵根本不存在。

5. 把結果寫成一份紀錄頁，格式照既有的 `2026-09-07-brief-probe.md` 那份量測報告的樣子
   （同一種一次性量測，不隨程式碼更新）：

`docs/reports/2026-09-11-hook-payload-probe.md`:

```markdown
---
status: current
last_verified: 2026-09-11
source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新；機制以 hooks/size.js 與
  hooks/guard.js 為準
---

# hook payload 帶不帶 `tool_response` 與 `agent_type` — 2026-09-11 的量測

第 6 節的 `hooks/size.js`（大輸出提醒）要讀 PostToolUse 的 `tool_response`，第 10 節的
`hooks/guard.js` Bash|PowerShell matcher 要讀 subagent 內的 `agent_type`——官方 hooks
文件都提到，但本機從沒實際觀察過。這一頁是那次觀察，跑一次就不再更新。

## 方法

一支一次性 hook（不進 repo）掛在 PostToolUse 與 PreToolUse，兩邊都不設 matcher，把每次
觸發的事件名、工具名、payload 最上層的鍵，以及 `agent_id`／`agent_type`（有才印）各
append 一行 JSON。一次 headless `claude -p` turn：主 session 跑一句 Bash，再派一個
`subagent_type: fankeel-reader` 的 Agent，讓它自己也跑一個工具呼叫。

[這裡貼上實際跑出來的 probe-log.jsonl 逐行內容，或摘要每一種 event/tool/agent_id 組合
各出現幾次——原始檔不在這個 repository 裡，貼在這裡的是抄錄。]

## 這一次定下來的

| 欄位 | 結果 |
|---|---|
| `tool_response`（主 session 自己的 `Bash` 呼叫，`PostToolUse`，無 `agent_id`） | PRESENT 或 ABSENT——照 log 實際內容填一個 |
| `agent_type`（`agent_id` 有值的那幾行） | PRESENT，值是 `<實際字面值>`；或 ABSENT |

## 這一次沒有定下來的

- 只跑了一次，兩個欄位都沒有重跑驗證是否穩定。
- `tool_response` 如果 PRESENT，這裡沒有窮舉它在每一種工具（`Bash`、`Read`、`Edit`……）
  下的形狀，只看了 `Bash` 這一種。

## 出處

- 探測腳本與 settings 檔：本次 session 的 scratch 目錄，不在這個 repository 裡。
- `claude -p --session-id <uuid> --settings <path> --plugin-dir F:/ymlab/fankeel "..."`
  的完整輸出同樣不在這個 repository 裡；上面的表格是從 `probe-log.jsonl` 抄錄的結論。
```

   把「[這裡貼上...]」與表格裡的「照 log 實際內容填一個」換成第 4 步實際讀到的內容——
   這一步的產出就是這份寫實的紀錄，不是這裡的骨架文字本身。

5b. 補索引列。`docs/README.md` 逐篇列出每一份報告（09-11 量過：17 份 tracked 的報告
   全部在索引裡），`CONTRIBUTING.md:20` 要求新頁在同一個變更裡補上索引列。在
   `docs/README.md` 裡，09-09 profile-evidence 報告那一列（目前最後一列報告，:117）
   之後加上這一列，第一格照第 4 步實際讀到的結果改寫：

```markdown
| Whether the hook payload carries `tool_response` and `agent_type` on this machine, observed once with a probe hook | [reports/2026-09-11-hook-payload-probe.md](reports/2026-09-11-hook-payload-probe.md) — *a dated snapshot, 繁體中文* |
```

6. Commit：

```bash
git add docs/reports/2026-09-11-hook-payload-probe.md docs/README.md
git commit -m "docs: whether the hook payload carries tool_response and agent_type"
```

---

## Task 13: `scripts/sessions.js`，由 `.fankeel/build/ask/measure-sessions.js` 升格

`.fankeel/build/ask/measure-sessions.js` 已經印出 09-11 那張表（峰值中位數與 p90、
subagent 回傳佔比、倒退次數），但 `DIR` 是寫死的路徑、`BOOL_FLAGS` 沒有任何 flag 在用它、
也沒有測試。升格成 `scripts/sessions.js`，讓它收 `--config-dir`、`--project` 與
`--since`，並多數一種：主 session 單次超過 20,000 字元的工具輸出（`bigPerSession`，每個
session 平均幾次）。這是第 6 節「改之前與之後」的量尺，`hooks/size.js` 要不要留
（Task 14）就是拿這支腳本量兩次：改前全部量一次，改後用 `--since` 只量 hook 上線後的。

**Files:**
- Modify: `scripts/sessions.js`（新檔，內容由 `.fankeel/build/ask/measure-sessions.js`
  搬過來並加 flag）
- Test: `tests/sessions.test.js`
- Read: `.fankeel/build/ask/measure-sessions.js` — 搬過去的原始邏輯

**Interfaces:**
- Consumes: none
- Produces: `scripts/sessions.js` 的 `parseArgs(argv)`（回傳
  `{ configDir, project, since }`）、`main(argv)`（回傳要印的字串，`out` 多
  `sumBigToolResults` 與 `bigPerSession`）、`percentile(arr, p)`、
  `processFile(file)`（回傳的物件多 `bigToolResults`）— 都經 `module.exports` 匯出

**Dispatch:** implementer, sonnet — 既有邏輯搬過去，加三個 flag、一個計數和一支測試。

步驟：

1. 先寫失敗的測試。一支新檔案要先 `git add` 才會被 `source.test.js` 那支既有測試看見，
   所以先建立空殼再寫測試會綠得太早；這裡直接連同實作一起寫，測試先跑一次確認它現在
   不存在。

`tests/sessions.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'sessions.js');
const tmp = require('./tmp.js');

// 一個最小的 transcript：一則 assistant 訊息帶 usage，一則 user 訊息帶
// task-notification，讓 peakContext 與 subagentChars 都不是零。
function writeTranscript(dir, name, lines) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

test('--config-dir and --project point sessions.js at a fixture directory', () => {
  const cfg = tmp('fankeel-sessions-');
  const dir = path.join(cfg, 'projects', 'my-project');
  writeTranscript(dir, 'a.jsonl', [
    { type: 'assistant', message: { usage: { input_tokens: 1000, cache_read_input_tokens: 500 }, content: [] } },
    { type: 'user', message: { content: '<task-notification>x</task-notification>' } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'read-1', content: 'x'.repeat(20001) }] } },
  ]);
  const out = execFileSync(process.execPath, [SCRIPT, '--config-dir', cfg, '--project', 'my-project'], { encoding: 'utf8' });
  const payload = JSON.parse(out);
  assert.equal(payload.out.totalSessions, 1);
  assert.equal(payload.out.medianPeak, 1500);
  assert.equal(payload.out.sumBigToolResults, 1);
  assert.equal(payload.out.bigPerSession, 1);
});

test('--since drops transcripts last written before that day', () => {
  const cfg = tmp('fankeel-sessions-');
  const dir = path.join(cfg, 'projects', 'p');
  writeTranscript(dir, 'old.jsonl', [{ type: 'assistant', message: { usage: { input_tokens: 10 }, content: [] } }]);
  const old = new Date('2020-01-01T00:00:00Z');
  fs.utimesSync(path.join(dir, 'old.jsonl'), old, old);
  writeTranscript(dir, 'new.jsonl', [{ type: 'assistant', message: { usage: { input_tokens: 20 }, content: [] } }]);
  const out = JSON.parse(execFileSync(process.execPath, [SCRIPT, '--config-dir', cfg, '--project', 'p', '--since', '2021-01-01'], { encoding: 'utf8' }));
  assert.equal(out.out.totalSessions, 1);
  assert.equal(out.out.medianPeak, 20);
});

test('percentile and processFile are exported for a fixture-driven test, not only the CLI', () => {
  const { percentile } = require(SCRIPT);
  assert.equal(percentile([1, 2, 3, 4], 50), 3);
  assert.equal(percentile([], 50), 0);
});
```

2. 跑 `npm test` 看紅：`scripts/sessions.js` 還不存在。

```bash
npm test
```

印出 `Cannot find module '.../scripts/sessions.js'`（或等價的找不到檔案錯誤）。

3. 把 `.fankeel/build/ask/measure-sessions.js` 的內容搬到 `scripts/sessions.js`，把
   `DIR` 換成 `--config-dir`／`--project` 兩個 flag 算出來的路徑，砍掉沒人用的
   `BOOL_FLAGS`，並匯出可以單獨測的函式：

`scripts/sessions.js`:

```js
#!/usr/bin/env node
'use strict';

// 升格自 .fankeel/build/ask/measure-sessions.js（09-11 一次性量測腳本）。09-11 的
// 那張表——峰值中位數與 p90、subagent 回傳佔比、倒退次數——現在是這支腳本的輸出，
// 而不是一次跑完就丟的手稿：第 6 節 `hooks/size.js` 要不要留，就是靠這支腳本改
// 前跑一次、改後跑一次比較。

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseArgs: parseArgv } = require('node:util');

const FULL_ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
const routeIndex = new Map(FULL_ROUTE.map((s, i) => [s, i]));
// hooks/size.js 的 THRESHOLD，同一個數：改前改後量的就是那支 hook 提醒的那一種輸出。
const BIG = 20000;

function parseArgs(argv) {
  const { values } = parseArgv({
    args: argv, strict: false, allowPositionals: true,
    options: { 'config-dir': { type: 'string' }, project: { type: 'string' }, since: { type: 'string' } },
  });
  const home = process.env.HOME || process.env.USERPROFILE;
  const configDir = values['config-dir'] || process.env.CLAUDE_CONFIG_DIR || (home ? path.join(home, '.claude') : null);
  const since = values.since ? Date.parse(values.since) : null;
  if (Number.isNaN(since)) throw new Error('--since takes a date, YYYY-MM-DD.');
  return { configDir, project: values.project || null, since };
}

function dirFor({ configDir, project }) {
  if (!configDir) throw new Error('No config directory: pass --config-dir or set CLAUDE_CONFIG_DIR.');
  if (!project) throw new Error('--project <slug> is required — the same slug .claude/projects uses.');
  return path.join(configDir, 'projects', project);
}

function contentText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((item) => (item && item.type === 'text' && typeof item.text === 'string' ? item.text : JSON.stringify(item))).join('');
  }
  return JSON.stringify(content);
}

function extractStageName(tail) {
  const tokens = tail.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '&&' || t === ';' || t === '|' || t === '||') break;
    if (t.startsWith('2>') || t.startsWith('1>') || t.startsWith('>')) break;
    if (t.startsWith('--')) { i++; continue; }
    return t.replace(/["'`]/g, '').toLowerCase();
  }
  return null;
}

function extractStagesFromCommand(cmd) {
  const out = [];
  for (const line of cmd.split('\n')) {
    const m = line.match(/task\.js\s+stage\s+(.*)/);
    if (!m) continue;
    const name = extractStageName(m[1]);
    if (name) out.push(name);
  }
  return out;
}

async function processFile(file) {
  const stat = fs.statSync(file);
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });

  let peakContext = 0;
  let agentCalls = 0;
  let subagentChars = 0;
  let allToolResultChars = 0;
  let bigToolResults = 0;
  let notifChars = 0;
  let hadStart = false;
  const rawStages = [];
  const idKind = new Map();

  for await (const line of rl) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch (e) { continue; }

    if (o.type === 'assistant' && o.message) {
      const u = o.message.usage;
      if (u) {
        const total = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        if (total > peakContext) peakContext = total;
      }
      const content = o.message.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c.type !== 'tool_use') continue;
          if (c.name === 'Agent' || c.name === 'Task') { agentCalls++; idKind.set(c.id, 'agent'); }
          else if (c.name === 'Bash') {
            const cmd = c.input && c.input.command;
            if (typeof cmd === 'string') {
              if (/task\.js\s+start(\s|$)/.test(cmd)) hadStart = true;
              for (const s of extractStagesFromCommand(cmd)) rawStages.push(s);
            }
          }
        }
      }
    } else if (o.type === 'user' && o.message) {
      const content = o.message.content;
      if (typeof content === 'string' && content.indexOf('<task-notification>') !== -1) {
        notifChars += content.length;
        const m = content.match(/<tool-use-id>([^<]*)<\/tool-use-id>/);
        const srcId = m ? m[1] : null;
        if (srcId && idKind.get(srcId) === 'agent') subagentChars += content.length;
      } else if (Array.isArray(content)) {
        for (const c of content) {
          if (c.type !== 'tool_result') continue;
          const txt = contentText(c.content);
          allToolResultChars += txt.length;
          if (idKind.get(c.tool_use_id) === 'agent' && txt.indexOf('Async agent launched successfully') === -1) {
            subagentChars += txt.length;
          } else if (txt.length > BIG) {
            // hooks/size.js 提醒的就是這一種：主 session 自己的一次工具輸出超過 20,000 字元。
            bigToolResults++;
          }
        }
      }
    }
  }

  let backwardCount = 0;
  for (let i = 1; i < rawStages.length; i++) {
    const pi = routeIndex.has(rawStages[i - 1]) ? routeIndex.get(rawStages[i - 1]) : null;
    const ci = routeIndex.has(rawStages[i]) ? routeIndex.get(rawStages[i]) : null;
    if (pi !== null && ci !== null && ci < pi) backwardCount++;
  }

  return { size: stat.size, peakContext, agentCalls, subagentChars, allToolResultChars, bigToolResults, notifChars, hadStart, backwardCount };
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main(argv) {
  const opts = parseArgs(argv);
  const dir = dirFor(opts);
  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.jsonl'))
    .map((d) => path.join(dir, d.name))
    // --since：只算那一天之後還寫過的 transcript，改後那一次量測靠它排掉改前的 session。
    .filter((f) => opts.since == null || fs.statSync(f).mtimeMs >= opts.since);

  const results = [];
  for (const f of files) results.push(await processFile(f));

  const out = {
    totalSessions: results.length,
    fankeelSessions: results.filter((r) => r.hadStart).length,
    medianPeak: percentile(results.map((r) => r.peakContext), 50),
    p90Peak: percentile(results.map((r) => r.peakContext), 90),
    sumSubagentChars: results.reduce((a, r) => a + r.subagentChars, 0),
    sumAllToolResultChars: results.reduce((a, r) => a + r.allToolResultChars, 0),
    sumNotifChars: results.reduce((a, r) => a + r.notifChars, 0),
    sessionsWithBackward: results.filter((r) => r.backwardCount > 0).length,
    sumBigToolResults: results.reduce((a, r) => a + r.bigToolResults, 0),
  };
  // 改前改後比的是這一個：每個 session 平均有幾次超過 20,000 字元的主 session 工具輸出。
  out.bigPerSession = results.length ? out.sumBigToolResults / results.length : 0;
  out.adjustedDenominator = out.sumAllToolResultChars + out.sumNotifChars;
  out.share = out.adjustedDenominator ? out.sumSubagentChars / out.adjustedDenominator : null;

  return JSON.stringify({ out }, null, 2);
}

if (require.main === module) {
  main(process.argv.slice(2)).then((s) => process.stdout.write(s + '\n'));
}

module.exports = { parseArgs, dirFor, percentile, processFile, main };
```

4. 跑 `npm test` 看綠：

```bash
npm test
```

5. 沒有一份 reference 頁把 scripts 逐支列成一張總表可以補列——`docs/development.md` 的
   四支是「保住一句書面聲明不漂走」這一類腳本專用的清單（`todo-check.js`、
   `version.js`、`skills-check.js`、`stage-registry.js`），`docs/README.md` 的
   「## The three scanners」是另一組固定的三支文件掃描腳本，兩張表都不是
   `sessions.js` 這種量測工具的位置；`tests/station-doc.test.js` 也只讀死
   `scripts/station.js` 這一個檔名，不會因為多一支腳本而紅。所以這個 task 不補文件列——
   這一條本身就是核對過、不是漏掉。

6. Commit：

```bash
git add scripts/sessions.js tests/sessions.test.js
git commit -m "feat: sessions.js takes flags instead of a hardcoded path"
```

---

## Task 14: `hooks/size.js` — 單次工具輸出太大時提醒一次

**先讀 Task 12 的結論。** 打開 `docs/reports/2026-09-11-hook-payload-probe.md` 的
「這一次定下來的」表，看 `tool_response` 那一列：

- 如果是 **PRESENT**：往下照步驟 1 開始做。
- 如果是 **ABSENT**：不要建立 `hooks/size.js`，也不要動 `.claude-plugin/plugin.json`。
  改成在 `TODO.md` 的 `## Waiting` 補這一條，只 commit `TODO.md`，本 task 到此結束：

  ```markdown
  - 〔session〕`hooks/size.js` 的大輸出提醒需要 PostToolUse payload 帶 `tool_response`；2026-09-11 的探測沒有觀察到這個鍵 — [hooks/touch.js](hooks/touch.js). lifts when: 一次 payload 觀察到 tool_response. 09-11.
  ```

  ```bash
  git add TODO.md
  git commit -m "docs: hooks/size.js waits on tool_response actually showing up"
  ```

以下是 `tool_response` 是 PRESENT 時要做的事。09-11 的量測顯示主 session 自己的工具輸出
占了 context 堆疊的大宗，多過 subagent 回傳。`hooks/size.js` 在主 session 裡單次工具輸出
超過 20,000 字元時提醒一次；`agent_id` 有值（subagent 內）時不說話；同一個 prompt 只說
一次。

**Files:**
- Modify: `hooks/size.js`（新檔）
- Modify: `.claude-plugin/plugin.json` — `PostToolUse` 陣列尾端加一個沒有 `matcher` 的
  項目
- Modify: `docs/development.md` — 「all eight hooks」改成「all nine hooks」
- Modify: `tests/hook.test.js` — 檔頭註解「all eight hooks」同樣改成「all nine hooks」
- Modify: `docs/collisions.md` — 只修正被這個 task 推走的行號引用（`docs-check` 印出來
  的那個），不改內文——內文本身是 Task 18 的事
- Test: `tests/size.test.js`
- Modify: `TODO.md` — `## Waiting` 補一條：兩個分支各一條，PRESENT 那條記改前的數字、等改後
- Modify: `.fankeel/build/2026-09-11-backlog-all/size-before.json` — 改前量測的證據檔；gitignored，不 commit
- Read: `docs/reports/2026-09-11-hook-payload-probe.md` — Task 12 的結論，決定走哪一支
- Read: `scripts/sessions.js` — 改前改後同一支量尺，看 `bigPerSession`（Task 13）
- Read: `hooks/touch.js` — 同一種 PostToolUse hook 的既有寫法（`parse`/`run`、
  `registry.readSession` 早退）
- Read: `lib/hook.js` — `run(main)`、`parse(raw)`
- Read: `lib/live.js` — `liveConfigDir()`

**Interfaces:**
- Consumes: `scripts/sessions.js` 的 `main(argv)` 印出的 `out.bigPerSession`（Task 13）
- Produces: none（hook 腳本，`run(main)` 是唯一進入點）

**Dispatch:** implementer, sonnet — 既有 hook 的形狀照抄，新邏輯是字串長度與一個標記檔。

步驟：

0. 改前的量測。設計第 4 節 A：以成本為理由的改動，改前改後用同一支 script 量，沒有變好就
   退回。`scripts/sessions.js`（Task 13）此刻已經 commit；這個 project 目錄裡還沒有任何
   session 載入過 `hooks/size.js`。證據檔寫絕對路徑，因為 `.fankeel/build/` 只在主
   checkout 裡，worktree 看不到：

```bash
node scripts/sessions.js --project F--ymlab-fankeel > F:/ymlab/fankeel/.fankeel/build/2026-09-11-backlog-all/size-before.json
node -e "console.log(require('F:/ymlab/fankeel/.fankeel/build/2026-09-11-backlog-all/size-before.json').out.bigPerSession)"
```

   記下第二行印出的數字，步驟 7 的 Waiting 條目要用。

1. 先寫失敗的測試。

`tests/size.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const mkTmp = require('./tmp.js');
const HOOK = path.join(__dirname, '..', 'hooks', 'size.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000002';

const tmp = () => mkTmp('fankeel-size-');

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'read the log', stage: 'build', active: true,
    started: new Date(Date.now() - 3600e3).toISOString(),
    updated: new Date().toISOString(),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

function run(root, cfg, payload) {
  const env = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: cfg });
  return execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), env, encoding: 'utf8' });
}

test('a tool result over 20,000 chars speaks once', () => {
  const root = tmp();
  const cfg = path.join(root, 'cfg');
  seed(root, MINE);
  const payload = { session_id: MINE, cwd: root, tool_name: 'Bash', tool_response: 'x'.repeat(30000) };
  const parsed = JSON.parse(run(root, cfg, payload));
  assert.match(parsed.hookSpecificOutput.additionalContext, /Bash returned 30000 chars into this context/);
});

test('1,000 chars says nothing', () => {
  const root = tmp();
  const cfg = path.join(root, 'cfg');
  seed(root, MINE);
  const payload = { session_id: MINE, cwd: root, tool_name: 'Bash', tool_response: 'x'.repeat(1000) };
  assert.equal(run(root, cfg, payload), '');
});

test('a second large result in the same prompt says nothing more', () => {
  const root = tmp();
  const cfg = path.join(root, 'cfg');
  seed(root, MINE);
  const payload = { session_id: MINE, cwd: root, tool_name: 'Bash', tool_response: 'x'.repeat(30000) };
  run(root, cfg, payload);
  assert.equal(run(root, cfg, payload), '', 'the marker is keyed to `updated`, which has not moved');
});

test('a large result inside a subagent says nothing', () => {
  const root = tmp();
  const cfg = path.join(root, 'cfg');
  seed(root, MINE);
  const payload = { session_id: MINE, cwd: root, tool_name: 'Bash', tool_response: 'x'.repeat(30000), agent_id: 'sub-1' };
  assert.equal(run(root, cfg, payload), '');
});
```

2. 跑 `npm test` 看紅：

```bash
npm test
```

印出 `Cannot find module '.../hooks/size.js'`。

3. 建立 `hooks/size.js`：

```js
#!/usr/bin/env node
'use strict';

// PostToolUse，沒有 matcher——機上每個工具、每個 session 都會觸發。09-11 的量測
// （docs/reports/2026-09-11-hook-payload-probe.md 之前、scripts/sessions.js 的
// 09-11 量測）顯示主 session 自己的工具輸出才是 context 堆疊的大宗，多過 subagent
// 回傳；所以提醒放在來源，不是放在派工那一側。
//
// 同樣兩條規則：每條路徑都 exit 0，對不在模式裡的 session 不花任何成本。
// `agent_id` 有值代表這是在 subagent 內觸發的——docs/reports/2026-09-11-hook-payload-probe.md
// 是這個欄位真的會出現這件事被核對過的地方——一個 subagent 自己的輸出進了它自己的
// context 不是這裡要提醒的事，所以那裡不說話。

const registry = require('../lib/registry.js');
const live = require('../lib/live.js');
const { run, parse } = require('../lib/hook.js');
const fs = require('node:fs');
const path = require('node:path');

const THRESHOLD = 20000;

// `tool_response` 不是每個工具都同一個形狀——有的是字串，有的是帶
// content／stdout／stderr 的物件。這裡照可能的形狀各讀一次，讀不出來才退回量
// JSON 本身的長度，而不是猜一個零。
function responseText(response) {
  if (response == null) return '';
  if (typeof response === 'string') return response;
  if (Array.isArray(response)) return response.map(responseText).join('');
  if (typeof response === 'object') {
    if (typeof response.text === 'string') return response.text;
    if (Array.isArray(response.content)) return response.content.map(responseText).join('');
    if (typeof response.stdout === 'string' || typeof response.stderr === 'string') {
      return (response.stdout || '') + (response.stderr || '');
    }
    try { return JSON.stringify(response); } catch (e) { return ''; }
  }
  return String(response);
}

// 一個 session 一個標記檔，存的是上次講話時這個任務的 `updated`。`updated` 一個
// prompt 只變一次——只有 hooks/inject.js 和 hooks/resume.js 會寫它——所以標記檔
// 還等於現在的 `updated`，就代表還是同一個 prompt。
function markerFile(configDir, sessionId) {
  return configDir ? path.join(configDir, 'fankeel', 'size', sessionId + '.marker') : null;
}

function alreadySpoke(configDir, sessionId, stamp) {
  const file = markerFile(configDir, sessionId);
  if (!file) return false;
  try { return fs.readFileSync(file, 'utf8') === stamp; } catch (e) { return false; }
}

function markSpoke(configDir, sessionId, stamp) {
  const file = markerFile(configDir, sessionId);
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, stamp);
  } catch (e) { /* housekeeping */ }
}

function main(raw) {
  const payload = parse(raw);
  if (!payload) return;
  if (payload.agent_id) return;

  const root = registry.rootFor(payload);
  const mine = registry.readSession(root, payload.session_id);
  if (!mine || mine.active !== true) return;

  const text = responseText(payload.tool_response);
  if (text.length <= THRESHOLD) return;

  const stamp = typeof mine.updated === 'string' ? mine.updated : '';
  const configDir = live.liveConfigDir();
  if (stamp && alreadySpoke(configDir, payload.session_id, stamp)) return;
  if (stamp) markSpoke(configDir, payload.session_id, stamp);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: (payload.tool_name || 'a tool') + ' returned ' + text.length
        + ' chars into this context — pipe it or send a fankeel-reader next time',
    },
  }));
}

// 刻意沉默。漏掉一次提醒不會多花一個 session 本來就要付的成本；一個會丟例外的
// hook 才會賠上它接在後面的那次工具呼叫。
run(main);
```

4. 在 `.claude-plugin/plugin.json`，把 `PostToolUse` 陣列裡 `touch.js` 那個項目的收尾
   從（第一行帶上它的 `statusMessage` 才唯一——光是這串收尾括號，檔裡有五處一模一樣）

```json
            "statusMessage": "Noting where the work went..."
          }
        ]
      }
    ],
```

在 `.claude-plugin/plugin.json` 裡換成（在它後面多一個項目，不動前面任何一行）：

```json
            "statusMessage": "Noting where the work went..."
          }
        ]
      },
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/size.js\"",
            "timeout": 5,
            "statusMessage": "Checking how much that just added to context..."
          }
        ]
      }
    ],
```

   這個 fence 落在 `.claude-plugin/plugin.json` 的 `PostToolUse` 陣列裡，是這個 task
   `Modify:` 清單上的檔案。

5. `docs/development.md` 這句話折在兩行：第 25 行行尾是「and all eight」，第 26 行接
   「hooks are tested as subprocesses with real payloads.」。只改第 25 行的 `all eight`
   → `all nine`，第 26 行不動；`tests/hook.test.js` 檔頭第 3 行「What all eight hooks
   do」的 `all eight` 同樣改成 `all nine`。這兩處是這個 task 讓它們
   變成假話的地方，跟著改掉。

6. 跑 `npm test` 看綠，再跑 `node scripts/docs-check.js`——這個 task 在
   `PostToolUse` 陣列裡插了新項目，`docs/collisions.md` 引的
   `` `.claude-plugin/plugin.json:76` ``（`Edit|Write|NotebookEdit` 那個 matcher）會被往下推；
   docs-check 印出新的行號就照改，不要用猜的：

```bash
npm test
node scripts/docs-check.js
```

7. 改後那一次量測這個 session 做不到：hook 清單在 process 啟動時讀一次，`hooks/size.js`
   要到 relaunch 之後的 session 才載入，所以 verify 量不到改後，只能留一條等它。在
   `TODO.md` 的 `## Waiting` 補這一條；`<N>` 換成步驟 0 印出的 `bigPerSession`，`<date>`
   換成今天的日期（YYYY-MM-DD）：

```markdown
- 〔session〕`hooks/size.js` 留不留：改前 bigPerSession <N>；hook 上線後十個 session 用 `sessions.js --since <date>` 再量，沒降就移除 — [hooks/size.js](hooks/size.js). lifts when: 十個 session 帶著 hook 跑完. 09-11.
```

8. 跑 `node scripts/todo-check.js`，exit 0 之後 commit：

```bash
node scripts/todo-check.js
git add hooks/size.js tests/size.test.js .claude-plugin/plugin.json docs/development.md tests/hook.test.js docs/collisions.md TODO.md
git commit -m "feat: hooks/size.js nudges once when a tool result is most of a turn"
```

---

## Task 15: 第二次 verify→build 要說出來

`task.js stage build` 目前不管 `moves` 裡有沒有出現過 `verify → build` 都只印移動本身。
`moves` 是逐次記的 `[stage, at]`，`clock` 每個 stage 只留最早與最近兩個時間點，所以一次
verify→build→verify→build 在 `clock` 裡看起來像一段長 verify——這正是要看
`moves`、不是看 `clock` 的原因。

**Files:**
- Modify: `lib/registry.js` — 新增 `returnsTo(data, from, to)`，放在 `seriesOf` 之後、
  `gateOpen` 之前（第 566 行之後），並加進第 720 行 `seriesOf,` 旁的匯出清單
- Modify: `scripts/task.js` — `cmdStage`（第 570 行起）在成功換到 `build` 且來自
  `verify` 時多印一段
- Modify: `docs/registry.md` — 只修正被這個 task 推走的 `` `lib/registry.js:657` ``
  行號引用（`docs-check` 印出來的那個），不改內文
- Modify: `skills/fankeel-survey/SKILL.md` — 同理修正被推走的
  `` `scripts/task.js:1005` `` 行號引用
- Test: `tests/registry.test.js`
- Test: `tests/task.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lib/registry.js` 的 `returnsTo(data, from, to)`（回傳次數，`0` 代表沒有）

**Dispatch:** implementer, sonnet — 一個純函式加一段字串組裝。

步驟：

1. 先寫失敗的測試。在 `tests/registry.test.js` 檔尾加：

```js
test('returnsTo counts prior from->to steps out of moves, not clock', () => {
  const data = { moves: [['survey', 1], ['build', 2], ['verify', 3], ['build', 4], ['verify', 5]] };
  assert.equal(registry.returnsTo(data, 'verify', 'build'), 1);
  assert.equal(registry.returnsTo({}, 'verify', 'build'), 0);
  assert.equal(registry.returnsTo({ moves: [['survey', 1]] }, 'verify', 'build'), 0);
});
```

2. 跑 `npm test` 看紅：

```bash
npm test
```

印出 `registry.returnsTo is not a function`。

3. 在 `lib/registry.js`，在 `seriesOf` 的收尾 `}`（第 566 行）之後加：

```js
// `moves` 是逐次記的序列，`clock` 每個 stage 只留最早與最近，所以一段
// verify → build → verify → build 在 `clock` 裡看起來像一段長 verify。第二次
// verify→build 要不要被看見，得數 `moves` 裡相鄰的 `from → to` 出現過幾次，
// 而不是看 `clock` 有沒有兩個 pair。
function returnsTo(data, from, to) {
  const moves = Array.isArray(data && data.moves) ? data.moves : [];
  let count = 0;
  for (let i = 1; i < moves.length; i++) {
    const prev = Array.isArray(moves[i - 1]) ? moves[i - 1][0] : null;
    const curr = Array.isArray(moves[i]) ? moves[i][0] : null;
    if (prev === from && curr === to) count++;
  }
  return count;
}
```

   並在 `module.exports` 裡 `seriesOf,` 那一行後面加一行 `returnsTo,`。

4. 在 `scripts/task.js` 的 `cmdStage`，把收尾的

```js
    const at = positionIn(route, name);
    const spent = registry.burnOf(data, from);
    const took = registry.clockOf(data, from);
    const held = registry.waitedOf(data, from);
    return 'fankeel — ' + from + ' to ' + name + (at ? '   ' + at.step + ' of ' + at.steps : '')
        + (spent ? '   ' + from + ' burned ' + tokens(spent) : '')
        + (took ? '   ' + from + ' took ' + mins(took)
            + (held ? ', ' + mins(held) + ' of it at the gate' : '') : '');
}
```

在 `scripts/task.js` 換成：

```js
    const at = positionIn(route, name);
    const spent = registry.burnOf(data, from);
    const took = registry.clockOf(data, from);
    const held = registry.waitedOf(data, from);
    let line = 'fankeel — ' + from + ' to ' + name + (at ? '   ' + at.step + ' of ' + at.steps : '')
        + (spent ? '   ' + from + ' burned ' + tokens(spent) : '')
        + (took ? '   ' + from + ' took ' + mins(took)
            + (held ? ', ' + mins(held) + ' of it at the gate' : '') : '');
    // 只在「已經有一次」之後才說，因為第一次 verify→build 就是這條 pipeline
    // 本來的走法。只是 script 輸出，不佔注入——build 自己的區塊已經是 2393 / 2400。
    if (name === 'build' && from === 'verify' && registry.returnsTo(data, 'verify', 'build') > 0) {
        line += NL + 'second return to build from verify — name what verify caught that build\'s'
            + NL + 'review did not, and add that check to the review';
    }
    return line;
}
```

5. 在 `tests/task.test.js` 檔尾加（`moves` 是 fixture 直接寫進 entry 檔，不是靠一串
   `stage` 呼叫湊出來——`moves` 平常是下一個 prompt的 `touch()` 才補上的，不是
   `stage` 自己寫的）：

```js
test('a second verify->build return says so; the first does not', () => {
  const dir = root();
  started(dir, A, 'ship it');
  let data = entry(dir, A);
  data.stage = 'verify';
  data.moves = [['survey', 1], ['build', 2], ['verify', 3]];
  registry.writeSession(dir, A, data);
  const first = run(dir, ['stage', 'build', '--session', A]);
  assert.equal(/second return/.test(first.out), false);

  data = entry(dir, A);
  data.stage = 'verify';
  data.moves = [['survey', 1], ['build', 2], ['verify', 3], ['build', 4], ['verify', 5]];
  registry.writeSession(dir, A, data);
  const second = run(dir, ['stage', 'build', '--session', A]);
  assert.match(second.out, /second return to build from verify — name what verify caught/);
});
```

6. 跑 `npm test` 看綠，再跑 `node scripts/docs-check.js`——這個 task 在
   `lib/registry.js` 裡插了新函式（推走 `docs/registry.md` 引的
   `` `lib/registry.js:657` ``），也在 `scripts/task.js` 的 `cmdStage` 插了新行（推走
   `skills/fankeel-survey/SKILL.md` 引的 `` `scripts/task.js:1005` ``）。docs-check
   印出新的行號就照改，不要用猜的：

```bash
npm test
node scripts/docs-check.js
```

7. Commit：

```bash
git add lib/registry.js scripts/task.js tests/registry.test.js tests/task.test.js docs/registry.md skills/fankeel-survey/SKILL.md
git commit -m "feat: a second verify->build return names itself so build can fix the review"
```

---

## Task 16: profile 的 `class.default`，以及 `start` 在沒有 profile.json 時的建議

`scripts/task.js:506` 在沒給 `--class` 也沒給 `--route` 時，目前一律退回 `FULL_ROUTE`。
新鍵 `class.default`（`spike` | `bounded` | `architectural`）讓專案先答過的話，`start`
不用每次都被問。它不進 `profile.summary()`——那一行算在注入容量裡，`class.default` 不是
`land`/`guard` 那種每個 prompt都要提醒的欄位。另外，`start` 碰到專案完全沒有
`profile.json` 時，把 `suggest` 的結果連同一行可以直接照打的 `profile set` 指令印出來，
省得使用者另外跑一次 `profile suggest`。兩處都改 `cmdStart`，放同一個 task。

**Files:**
- Modify: `lib/profile.js` — `KEYS`（第 16-24 行）加一鍵 `class.default`
- Modify: `scripts/task.js` — `cmdStart`（第 473-568 行）讀 `class.default`、印
  `(profile)`、在沒有 `profile.json` 時印建議
- Modify: `skills/fankeel-survey/SKILL.md` — 只修正被這個 task 再推一次的
  `` `scripts/task.js:1005` `` 行號引用（`docs-check` 印出來的那個）
- Test: `tests/profile.test.js`
- Test: `tests/task.test.js`
- Read: `lib/stages.js` — `CLASSES`（第 474-487 行）三個鍵名，`routeForClass`

**Interfaces:**
- Consumes: none
- Produces: `lib/profile.js` `KEYS['class.default']`

**Dispatch:** implementer, sonnet — 一個 profile 鍵加一段既有函式的重排。

步驟：

1. 先寫失敗的測試。在 `tests/profile.test.js` 檔尾加：

```js
test('class.default is a class name, and stays out of summary', () => {
  const d = dir();
  fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
  fs.writeFileSync(profile.projectFile(d), JSON.stringify({ 'class.default': 'bounded' }));
  const { values, sources } = profile.read(d, null);
  assert.equal(values['class.default'], 'bounded');
  assert.equal(sources['class.default'], 'project');
  assert.equal(profile.write(profile.projectFile(d), 'class.default', 'orbital').ok, false);
  assert.equal(profile.summary(values, sources).includes('class.default'), false);
});
```

在 `tests/task.test.js` 檔尾加：

```js
test('start reads class.default when neither --class nor --route is given', () => {
  const dir = root();
  run(dir, ['profile', 'set', 'class.default', 'bounded']);
  const out = run(dir, ['start', '--session', A, '--task', 'x']);
  assert.match(out.out, /class: bounded \(profile\)/);
  const data = entry(dir, A);
  assert.equal(data.class, 'bounded');
  assert.deepEqual(data.route, ['survey', 'design', 'build', 'verify', 'land']);
});

test('an explicit --class overrides class.default and carries no (profile) tag', () => {
  const dir = root();
  run(dir, ['profile', 'set', 'class.default', 'bounded']);
  const out = run(dir, ['start', '--session', A, '--task', 'x', '--class', 'spike']);
  assert.match(out.out, /class: spike/);
  assert.equal(/\(profile\)/.test(out.out), false);
});

test('start with no profile.json prints suggest plus a runnable profile set line', () => {
  const dir = root();
  const g = (...a) => require('node:child_process').execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  g('init', '-q', '-b', 'main');
  g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  for (let i = 0; i < 3; i++) {
    g('checkout', '-q', '-b', 'f' + i);
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'work ' + i);
    g('checkout', '-q', 'main');
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'merge', '-q', '--no-ff', '-m', 'merge: f' + i, 'f' + i);
  }
  const out = run(dir, ['start', '--session', A, '--task', 'x']);
  assert.match(out.out, /No profile\.json for this project yet/);
  assert.match(out.out, /profile set land\.integration merge/);
});
```

2. 跑 `npm test` 看紅：

```bash
npm test
```

3. 在 `lib/profile.js` 的 `KEYS`，在 `guard: { ... }` 那一行之前加一鍵：

```js
    'class.default': { values: ['spike', 'bounded', 'architectural'], builtin: null },
```

   `summary()`（第 141-150 行）的迭代清單 `['guard', 'dispatch.floor', 'judge.model',
   'design.mockup']` 保持原樣不動——不把 `class.default` 加進去，就是design要求的
   「不進 summary()」。

4. 在 `scripts/task.js` 的 `cmdStart`，把

```js
    if (opts.class && opts.route) {
        fail('--class or --route, not both. A class already names a route.');
    }
    let route;
    if (opts.class) {
        route = routeForClass(opts.class);
        if (!route) {
            fail('Not a class: ' + opts.class + NL
                + Object.keys(CLASSES).map((c) => '  ' + c + '  ' + CLASSES[c].means).join(NL));
        }
    } else {
        route = opts.route ? normaliseRoute(splitScope(opts.route)) : FULL_ROUTE.slice();
    }
```

在 `scripts/task.js` 換成：

```js
    if (opts.class && opts.route) {
        fail('--class or --route, not both. A class already names a route.');
    }
    // Read early: the class default lives in the same profile as guard, and
    // the class decides the route before anything else below needs one.
    const prof = profile.read(projectRootFor(root, opts), claudeDir(opts));
    let cls = opts.class;
    let classFromProfile = false;
    if (!cls && !opts.route && prof.values['class.default']) {
        cls = prof.values['class.default'];
        classFromProfile = true;
    }
    let route;
    if (cls) {
        route = routeForClass(cls);
        if (!route) {
            fail('Not a class: ' + cls + NL
                + Object.keys(CLASSES).map((c) => '  ' + c + '  ' + CLASSES[c].means).join(NL));
        }
    } else {
        route = opts.route ? normaliseRoute(splitScope(opts.route)) : FULL_ROUTE.slice();
    }
```

   往下，仍在 `scripts/task.js` 裡，把

```js
        class: opts.class ? String(opts.class).trim().toLowerCase() : undefined,
```

   在 `scripts/task.js` 換成：

```js
        class: cls ? String(cls).trim().toLowerCase() : undefined,
```

   再往下，同一個 `scripts/task.js`，刪掉原本第二次讀 profile 的那一行（現在 `prof`
   已經在上面讀過一次）：

```js
    // The profile is the user's standing answer, written once with
    // `profile set guard`; applying it here is executing that instruction,
    // not the script choosing a mode — which is what invariant 6 forbids.
    const prof = profile.read(projectRootFor(root, opts), claudeDir(opts));
    if (prof.sources.guard && prof.sources.guard !== 'builtin') data.guard = prof.values.guard;
```

   在 `scripts/task.js` 裡換成（只刪掉重複的那一行宣告，保留下面的判斷）：

```js
    // The profile is the user's standing answer, written once with
    // `profile set guard`; applying it here is executing that instruction,
    // not the script choosing a mode — which is what invariant 6 forbids.
    if (prof.sources.guard && prof.sources.guard !== 'builtin') data.guard = prof.values.guard;
```

   然後在 `scripts/task.js` 裡把印表頭的

```js
    const lines = ['fankeel — started, at ' + data.stage
        + (data.class ? '   class: ' + data.class : '')
        + '   route: ' + route.join(' → ')];
```

   在 `scripts/task.js` 換成：

```js
    const lines = ['fankeel — started, at ' + data.stage
        + (data.class ? '   class: ' + data.class + (classFromProfile ? ' (profile)' : '') : '')
        + '   route: ' + route.join(' → ')];
```

   最後，在 `scripts/task.js` 裡 `lines.push(FIRST_STEP[...])` 之前（也就是回傳
   `lines.join('\n')` 之前）加上沒有 `profile.json` 時的建議：

```js
    // Only when the project has never answered anything — a project with a
    // file that merely lacks `class.default` already made a choice about
    // something, and this is not a nag for the fields it left out.
    if (!fs.existsSync(profile.projectFile(projectRootFor(root, opts)))) {
        const { values: suggested, evidence } = profile.suggest(projectRootFor(root, opts), root);
        lines.push('');
        lines.push('No profile.json for this project yet — suggested from its history:');
        for (const e of evidence) lines.push('  ' + e);
        const keys = Object.keys(suggested);
        if (keys.length) {
            for (const k of keys) {
                lines.push('  node ' + __filename + ' profile set ' + k + ' ' + suggested[k]
                    + (opts.project ? ' --project ' + opts.project : ''));
            }
        } else {
            lines.push('  nothing the history answers');
        }
    }
```

   （`profile.suggest` 的第二個參數是 Task 17 加的；在 Task 17 落地之前，
   `suggest(projectRoot, root)` 的第二個參數會被目前版本的 `suggest` 忽略，行為和只傳
   一個參數一樣——這裡先照兩個參數寫，等 Task 17 落地後兩個 task 的效果才會疊在一起。）

5. 跑 `npm test` 看綠，再跑 `node scripts/docs-check.js`——`cmdStart` 裡插入的這幾段
   會把 `skills/fankeel-survey/SKILL.md` 引的 `` `scripts/task.js:1005` `` 再往下推；
   照 docs-check 印出來的新行號改，不要用猜的：

```bash
npm test
node scripts/docs-check.js
```

6. Commit：

```bash
git add lib/profile.js scripts/task.js tests/profile.test.js tests/task.test.js skills/fankeel-survey/SKILL.md
git commit -m "feat: task.js start reads class.default and suggests a first profile"
```

---

## Task 17: `task.js land` 記錄整合方式；`profile suggest` 把它算回去

`task.js land merge|pr|keep [--push|--no-push]` 是一個新命令，把使用者在 land 選單答的
（或 profile 已經答的）整合方式寫進 entry 的 `land: {integration, push, at}`。
`fankeel-land` skill 在答案定案之後跑它。`profile.suggest()` 除了既有的 git merge
歷史，也數這個 registry 裡同一專案過去每一筆 `land` ——這是 `pr` 和 `keep` 唯一能被
建議出來的路徑，因為 git 的 merge 歷史看不到這兩種。

**Files:**
- Modify: `scripts/task.js` — 新增 `cmdLand`，放在 `cmdRoute` 之後、`COMMANDS` 之前
  （第 1018 行之後），並在 `COMMANDS`（第 1020 行起）與 `USAGE`（第 1035 行起）各加一行
- Modify: `lib/profile.js` — `suggest()`（第 109-125 行）多收一個可省略的
  `registryRoot` 參數，也數 registry 裡的 `land`
- Modify: `skills/fankeel-land/SKILL.md` — 「## 6. The menu」（第 163-179 行）加一段
  「記錄下來」
- Modify: `docs/registry.md` — 第 31 行的欄位寫手清單加一項 `land`
- Modify: `skills/fankeel/SKILL.md` — 第 111 行「Eleven more」改成「Twelve more」，
  第 114 行「the seven below」改成「the eight below」，第 143 行「A twelfth,
  `gateAt`」改成「A thirteenth, `gateAt`」，並在 `burn` 那句之後補一句 `land` 的說明
- Test: `tests/task.test.js`
- Test: `tests/profile.test.js`
- Read: `lib/registry.js` — `readAll(projectRoot)`（第 181-204 行）、
  `projectOf(data)`（第 637-639 行）

**Interfaces:**
- Consumes: none
- Produces: `scripts/task.js` 的 `land` 命令（`task.js land merge|pr|keep
  [--push|--no-push]`）；`lib/profile.js` 的 `suggest(projectRoot, registryRoot)`
  ——第二個參數可省略，省略時行為與今天完全相同

**Dispatch:** implementer, sonnet — 一個新命令加一段既有函式的擴充，都是既有形狀的重複。

步驟：

1. 先寫失敗的測試。在 `tests/task.test.js` 檔尾加：

```js
test('land records the integration and push choice on the entry', () => {
  const dir = root();
  started(dir, A, 'ship it');
  const out = run(dir, ['land', 'merge', '--push', '--session', A]);
  assert.equal(out.code, 0);
  const data = entry(dir, A);
  assert.equal(data.land.integration, 'merge');
  assert.equal(data.land.push, true);
  assert.ok(Date.parse(data.land.at));
  assert.match(out.out, /land: merge, push/);
});

test('land without --push or --no-push writes no push field', () => {
  const dir = root();
  started(dir, A, 'ship it');
  run(dir, ['land', 'keep', '--session', A]);
  assert.equal('push' in entry(dir, A).land, false);
});

test('land refuses a verb that is not merge, pr or keep', () => {
  const dir = root();
  started(dir, A, 'ship it');
  const out = run(dir, ['land', 'discard', '--session', A]);
  assert.equal(out.code, 1);
});
```

在 `tests/profile.test.js` 檔尾加：

```js
test('suggest also counts this registry\'s own land records for the same project', () => {
  const d = dir();
  const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'ignore' });
  g('init', '-q', '-b', 'main');
  g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  const sessions = path.join(d, '.fankeel', 'sessions');
  fs.mkdirSync(sessions, { recursive: true });
  const write = (id, integration) => fs.writeFileSync(path.join(sessions, id + '.json'), JSON.stringify({
    task: 't', active: false, started: new Date().toISOString(), updated: new Date().toISOString(),
    land: { integration, at: new Date().toISOString() },
  }));
  write('11111111-0000-4000-8000-000000000001', 'pr');
  write('11111111-0000-4000-8000-000000000002', 'pr');
  write('11111111-0000-4000-8000-000000000003', 'pr');
  const out = profile.suggest(d, d);
  assert.equal(out.values['land.integration'], 'pr');
  assert.ok(out.evidence.some((e) => e.startsWith('land records:') && /3 pr/.test(e)));
});

test('suggest with no second argument behaves exactly as before', () => {
  const d = dir();
  const out = profile.suggest(d);
  assert.equal(out.evidence[0], 'not a git repository, or git is not on PATH');
});
```

2. 跑 `npm test` 看紅：

```bash
npm test
```

3. 在 `scripts/task.js`，先在檔頭常數區（`GUARDS` 旁）加：

```js
const LAND_VERBS = ['merge', 'pr', 'keep'];
```

   在 `scripts/task.js` 的 `parseArgs`（第 179-194 行）裡，
   `if (whole.includes('--default')) opts.default = true;` 之後加：

```js
    if (whole.includes('--push')) opts.push = true;
    if (whole.includes('--no-push')) opts.push = false;
```

   在 `scripts/task.js` 裡 `cmdRoute` 收尾（第 1018 行）之後、`const COMMANDS = {`
   （第 1020 行）之前加：

```js
// 使用者在 land 選單實際答的（或 profile 已經答的），寫一次進 entry。不動 stage、
// 不動 badge——land 這個時間點通常已經在往 down 走，不是 collision 相關的欄位。
// `profile.suggest` 讀回這裡的紀錄，是 `pr` 與 `keep` 唯一能被建議出來的路徑：
// git 的 merge 歷史只看得到 `merge`。
function cmdLand(root, opts) {
    const id = requireSession(opts);
    const verb = String(opts.positional[0] || '').toLowerCase();
    if (!LAND_VERBS.includes(verb)) fail('land is one of: ' + LAND_VERBS.join(', '));

    let data = null;
    const wrote = registry.update(root, id, (d) => {
        if (d.active !== true) return false;
        const land = { integration: verb, at: now() };
        if (opts.push !== undefined) land.push = opts.push;
        d.land = land;
        data = d;
        return true;
    });
    if (!data) fail('No active entry for this session under ' + root);
    if (!wrote) fail('Could not write the entry.');

    return 'fankeel — land: ' + verb + (opts.push === true ? ', push' : opts.push === false ? ', no push' : '');
}

```

   還是在 `scripts/task.js` 裡，在 `COMMANDS` 的 `adopt: cmdAdopt,` 之後加一行
   `land: cmdLand,`。在 `USAGE` 的
   `'  down                              stand the task down; never deletes',` 之前加：

```js
    '  land <merge|pr|keep> [--push|--no-push]',
    '                                    record the integration this task actually took',
```

4. 在 `lib/profile.js`，把 `suggest` 的簽名與收尾換成：

```js
function suggest(projectRoot, registryRoot) {
    const values = {};
    const evidence = [];
    const merges = git(projectRoot, ['log', '--merges', '--format=%s']);
    if (merges === null) return { values, evidence: ['not a git repository, or git is not on PATH'] };
    const subjects = merges.split('\n').filter(Boolean);
    const pr = subjects.filter((s) => /^Merge pull request/i.test(s)).length;
    const local = subjects.length - pr;
    evidence.push('merges: ' + local + ' local, ' + pr + ' pull request');
    if (subjects.length >= 3) values['land.integration'] = pr > local ? 'pr' : 'merge';
    const remotes = (git(projectRoot, ['remote']) || '').split('\n').filter(Boolean);
    const unpushed = (git(projectRoot, ['log', '--oneline', '--branches', '--not', '--remotes']) || '').split('\n').filter(Boolean).length;
    evidence.push(remotes.length ? 'remotes: ' + remotes.join(', ') + '; ' + unpushed + ' commits on no remote' : 'no remote');
    if (!remotes.length || unpushed >= 3) values['land.push'] = false;
    else if (remotes.length && unpushed === 0) values['land.push'] = true;

    // The registry's own record of what `task.js land` was actually told, for
    // the same project — the only place `pr` and `keep` ever show up, since
    // git's merge history only speaks to `merge`. A fallback, not an
    // override: it fills a key git left unset, never replaces one git set.
    if (registryRoot) {
        const rel = path.relative(registryRoot, projectRoot).split(path.sep).join('/');
        const { entries } = registryLib.readAll(registryRoot);
        const lands = entries
            .filter((e) => registryLib.projectOf(e.data) === rel)
            .map((e) => e.data.land)
            .filter((l) => l && typeof l === 'object' && typeof l.integration === 'string');
        if (lands.length) {
            const counts = {};
            for (const l of lands) counts[l.integration] = (counts[l.integration] || 0) + 1;
            const ranked = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
            evidence.push('land records: ' + ranked.map((k) => counts[k] + ' ' + k).join(', '));
            if (values['land.integration'] === undefined && lands.length >= 3) {
                values['land.integration'] = ranked[0];
            }
            const pushed = lands.filter((l) => l.push === true).length;
            const noPush = lands.filter((l) => l.push === false).length;
            if (values['land.push'] === undefined && pushed + noPush >= 3) {
                values['land.push'] = pushed > noPush;
            }
        }
    }
    return { values, evidence };
}
```

   在檔頭加一行 `const registryLib = require('./registry.js');`（放在既有的
   `require('node:child_process')` 之後）。

5. 在 `skills/fankeel-land/SKILL.md`，「## 6. The menu」裡 Task 11 加的「**Neither is
   uninstalling…**」那一段（結尾「can now be removed, and stop there.」）之後加——它以
   Neither 接 Discarding 那段，兩段中間不能插東西：

```markdown
**Record the choice.** Once the integration is settled — by this menu, or by
the profile already answering it — run
`node <plugin>/scripts/task.js land merge|pr|keep [--push|--no-push]` before
step 7 executes it: `merge` for option 1, `pr` for option 2 (which always
pushes), `keep` for option 3. `profile suggest` counts these across a
project's past sessions, which is the only way `pr` and `keep` ever become a
suggested answer — git's merge history only speaks to `merge`.
```

6. 在 `docs/registry.md` 第 31 行的欄位寫手清單，把 `` `leave.js` for `ended`,
   `model`, `usage` and `spend`, once, at `SessionEnd` `` 之後補上
   `` ; `task.js land` for `land`, once per invocation ``。

7. 在 `skills/fankeel/SKILL.md`：第 111 行「Eleven more」改「Twelve more」；第 114 行
   「the seven below」改「the eight below」；第 143 行「A twelfth, `gateAt`」改「A
   thirteenth, `gateAt`」；並在第 119 行「by the same prompt hook that refreshes
   `updated`.」之後，仍在 `skills/fankeel/SKILL.md` 裡，補一句：

```markdown
`land` is `{integration, push, at}`, written once by `task.js land` when the
integration is chosen — `push` is absent unless `--push` or `--no-push` said
so.
```

8. 跑 `npm test` 看綠，再跑 `node scripts/docs-check.js`——`cmdLand` 插在 `cmdRoute`
   之後、`COMMANDS` 之前，不會動到 `` `scripts/task.js:1005` `` 那個 `cmdRoute` 內部的
   引用（插入點在它後面），但如果 Task 15 或 Task 16 已經先落地，這裡的插入還是會
   再往下推一次那個行號——照 docs-check 當下印出來的數字改：

```bash
npm test
node scripts/docs-check.js
```

9. Commit：

```bash
git add scripts/task.js lib/profile.js tests/task.test.js tests/profile.test.js skills/fankeel-land/SKILL.md docs/registry.md skills/fankeel/SKILL.md
git commit -m "feat: task.js land records the choice; suggest counts it back"
```

---

## Task 18: `hooks/guard.js` 的 `Bash|PowerShell` matcher：唯讀 agent 不准寫檔

**先讀 Task 12 的結論。** 打開 `docs/reports/2026-09-11-hook-payload-probe.md` 的
「這一次定下來的」表，看 `agent_type` 那一列：

- 如果是 **PRESENT**：往下照步驟 1 開始做，並把觀察到的字面值（裸名或
  `fankeel:` 前綴）套進步驟 3 的 `readOnlyAgentType`。
- 如果是 **ABSENT**：不要動 `hooks/guard.js`、`lib/guard.js` 或
  `.claude-plugin/plugin.json`。改成在 `TODO.md` 的 `## Waiting` 補這一條，只 commit
  `TODO.md`，本 task 到此結束；skills/fankeel-survey 與 skills/fankeel-audit 的
  `git status --porcelain` 那一步（步驟 6）仍然要做，因為它不靠 `agent_type`：

  ```markdown
  - 〔guard〕`hooks/guard.js` 的 Bash|PowerShell 拒絕清單需要 payload 帶 `agent_type`；2026-09-11 的探測沒有觀察到這個鍵 — [hooks/guard.js](hooks/guard.js). lifts when: 一次 payload 觀察到 agent_type. 09-11.
  ```

  ```bash
  git add TODO.md skills/fankeel-survey/SKILL.md skills/fankeel-audit/SKILL.md
  git commit -m "docs: the read-only-agent guard waits on agent_type actually showing up"
  ```

  （這個分支仍然要做步驟 6：在兩份 skill 裡加 `git status --porcelain` 那一步——它是
  獨立於 `agent_type` 的第二道防線，設計裡是「並在 survey 與 audit 的 skill 內文加一
  步」，不是條件句的一部分。）

以下是 `agent_type` 是 PRESENT 時要做的事。09-11 的 survey workflow 裡，一個交代「什麼都
不寫」的 `fankeel-reader`（工具清單拿掉 Edit/Write）仍然用 Bash 的 `>` 在 repo 根目錄
留下 `files_ref.txt`。`docs/judgements/2026-09-10-shell-whitelist.md` 之前否決過在
`Bash|PowerShell` 上掛全面的 collision guard，理由是成本（每個 session 的每一句 Bash
都要付）和它自己驗證過的動機案例零命中；那份判斷同時列出這個決定會錯的條件——
「有記錄顯示某個 subagent 直接打出一句裸的……不在腳本裡」——`files_ref.txt` 正是這個
條件。這次要做的比那次窄：只擋三個唯讀 agent 型別，不是全機每一句 Bash。

**Files:**
- Modify: `lib/guard.js` — 新增 `readOnlyAgentType(agentType)` 與
  `writesFiles(command)`，放在檔尾 `module.exports`（第 189 行）之前
- Modify: `hooks/guard.js` — `main()`（第 19-67 行）在既有的 `mine.active` 檢查之後、
  `guardMode` 檢查之前多一個分支
- Modify: `.claude-plugin/plugin.json` — `PreToolUse` 陣列尾端加一個 `matcher:
  "Bash|PowerShell"` 的項目
- Modify: `docs/collisions.md` — 「## What the guard does not watch」之後補一節
- Modify: `skills/fankeel-survey/SKILL.md` — 「One workflow, not several
  dispatches」那個條列清單多一條
- Modify: `skills/fankeel-audit/SKILL.md` — 「Where the host opens it, the chain is
  one workflow」那段之後多一段
- Test: `tests/guard.test.js`
- Modify: `TODO.md` — 只在 ABSENT 分支：`## Waiting` 補一條
- Read: `docs/reports/2026-09-11-hook-payload-probe.md` — Task 12 的結論，決定走哪一支
- Read: `docs/judgements/2026-09-10-shell-whitelist.md` — 上一次否決的理由與
  這次不適用的差異（不編輯：判斷紀錄「a wrong judgement is corrected by the next
  one, not by rewriting this」）

**Interfaces:**
- Consumes: none
- Produces: `lib/guard.js` 的 `readOnlyAgentType(agentType)`、`writesFiles(command)`

**Dispatch:** implementer, sonnet — 兩個純函式加一段既有 hook 的分支。

步驟：

1. 先寫失敗的測試。在 `tests/guard.test.js` 檔尾加：

```js
// ---- the Bash|PowerShell matcher: a read-only agent denied by name --------

const bashCall = (agentType, command, tool) => ({
  session_id: MINE, cwd: undefined, tool_name: tool || 'Bash', agent_type: agentType,
  tool_input: { command },
});

test('a fankeel-reader redirecting output is denied', () => {
  const root = tmp();
  seed(root, MINE, { guard: undefined });
  const out = run(root, bashCall('fankeel-reader', 'ls > files_ref.txt'));
  assert.equal(decisionOf(out), 'deny');
  assert.match(reasonOf(out), /fankeel-reader/);
});

test('the fankeel: prefixed form is read the same way', () => {
  const root = tmp();
  seed(root, MINE, { guard: undefined });
  const out = run(root, bashCall('fankeel:fankeel-reader', 'ls > files_ref.txt'));
  assert.equal(decisionOf(out), 'deny');
});

test('a fankeel-reader piping to grep is not denied', () => {
  const root = tmp();
  seed(root, MINE, { guard: undefined });
  assert.equal(run(root, bashCall('fankeel-reader', 'cat a.txt | grep foo')), '');
});

test('fankeel-verifier is excluded — it writes its own evidence file', () => {
  const root = tmp();
  seed(root, MINE, { guard: undefined });
  assert.equal(run(root, bashCall('fankeel-verifier', 'ls > evidence.txt')), '');
});

test('a redirect to /dev/null is not a write worth denying', () => {
  const root = tmp();
  seed(root, MINE, { guard: undefined });
  assert.equal(run(root, bashCall('fankeel-reader', 'noisy-command > /dev/null')), '');
});

test('the same identity through PowerShell is denied the same way', () => {
  const root = tmp();
  seed(root, MINE, { guard: undefined });
  const out = run(root, bashCall('fankeel-reader', 'Get-Content a.txt | Out-File b.txt', 'PowerShell'));
  assert.equal(decisionOf(out), 'deny');
});

test('a session with no entry is not guarded on Bash either', () => {
  const root = tmp();
  assert.equal(run(root, bashCall('fankeel-reader', 'ls > x')), '');
});
```

   （`decisionOf`／`reasonOf`／`seed`／`run`／`tmp` 都是這個檔案既有的 helper，第
   21-93 行已經有。）

2. 跑 `npm test` 看紅：

```bash
npm test
```

四個 `deny` 斷言都會拿到 `''`。

3. 在 `lib/guard.js`，`module.exports = { guardMode, ... decide };`（第 189 行）之前加：

```js
// `Bash|PowerShell` matcher 用的身分表。這三個型別的工具清單本來就拿掉了
// Edit/Write，但一句 shell redirect 不走那兩個工具——`files_ref.txt` 就是這樣
// 留下來的：一個交代「什麼都不寫」的 fankeel-reader，在 09-11 的 survey
// workflow 裡用 `>` 寫了它。`fankeel-verifier` 不在這張表裡，寫自己的證據檔
// 是它的工作。
const READ_ONLY_AGENTS = new Set(['fankeel-reader', 'fankeel-reviewer', 'fankeel-judge']);

// `agent_type` 到底是裸名還是帶 `fankeel:` 前綴，
// docs/reports/2026-09-11-hook-payload-probe.md 量過，這裡兩種都收。
function readOnlyAgentType(agentType) {
    const bare = String(agentType || '').replace(/^fankeel:/, '');
    return READ_ONLY_AGENTS.has(bare);
}

// 拒絕清單而不是允許清單——一張允許清單會連 `npm test`、`node scripts/...`
// 這些 reader 本來就該跑的指令一起擋下。只對這三個型別的 Bash/PowerShell
// 呼叫跑，不是對全機每一個 session，這正是
// docs/judgements/2026-09-10-shell-whitelist.md 否決的那個提案（對每個
// session 的每一句 Bash 都跑）與這次的差異：成本只落在三個型別身上。
const WRITE_PATTERNS = [
    />>?\s*(?!\/dev\/null\b|\$null\b)\S/, // 除了 /dev/null、$null 以外的 redirect
    /\btee\b/,
    /\b(?:rm|mv|cp)\b/,
    /\bsed\b[^\n]*-i\b/,
    /\bgit\s+(?:add|commit|checkout|reset|stash|clean)\b/,
    /\b(?:Set-Content|Out-File|New-Item|Remove-Item)\b/i,
];

function writesFiles(command) {
    if (typeof command !== 'string' || !command.trim()) return false;
    return WRITE_PATTERNS.some((re) => re.test(command));
}

```

   並在 `module.exports` 的清單裡，`decide` 前面補上 `readOnlyAgentType, writesFiles,`。

4. 在 `hooks/guard.js`，把 import 那行

```js
const { decide, guardMode, targetOf } = require('../lib/guard.js');
```

   在 `hooks/guard.js` 換成：

```js
const { decide, guardMode, targetOf, readOnlyAgentType, writesFiles } = require('../lib/guard.js');
```

   在 `hooks/guard.js` 的 `main()` 裡，把

```js
    if (!guardMode(mine)) return;

    const file = targetOf(payload);
```

   在 `hooks/guard.js` 換成：

```js
    // A second matcher, `Bash|PowerShell`, checked before the collision guard
    // below: three named agent types are denied a command that writes,
    // regardless of `guard` mode — this is about a read-only contract, not
    // about two sessions overlapping a file.
    if (payload.tool_name === 'Bash' || payload.tool_name === 'PowerShell') {
        if (!readOnlyAgentType(payload.agent_type)) return;
        const command = (payload.tool_input && payload.tool_input.command) || '';
        if (!writesFiles(command)) return;
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'fankeel: ' + payload.agent_type + ' is read-only for this task, '
                    + 'and this command writes to disk. Redirect to /dev/null (or $null), or ask for a '
                    + 'fankeel-verifier if the result needs to be written.',
            },
        }));
        return;
    }

    if (!guardMode(mine)) return;

    const file = targetOf(payload);
```

5. 在 `.claude-plugin/plugin.json`，把 `PreToolUse` 陣列裡 `gate.js` 那個項目的收尾從
   （第一行帶上它的 `statusMessage` 才唯一——光是這串收尾括號，檔裡有五處一模一樣）

```json
            "statusMessage": "Noting when the gate opened..."
          }
        ]
      }
    ],
```

   （在 `AskUserQuestion` 那個 matcher 之下）在 `.claude-plugin/plugin.json` 裡換成
   （在它後面多一個項目，不動前面任何一行——這麼放不會推動陣列裡前兩個項目原有的行
   號）：

```json
            "statusMessage": "Noting when the gate opened..."
          }
        ]
      },
      {
        "matcher": "Bash|PowerShell",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guard.js\"",
            "timeout": 5,
            "statusMessage": "Checking whether a read-only agent is about to write..."
          }
        ]
      }
    ],
```

6. 在 `skills/fankeel-survey/SKILL.md`，「One workflow, not several dispatches」那個
   條列清單（**Compare the returns against each other** 那一條之後）加：

```markdown
- **Once that workflow returns, run `git status --porcelain` once** before
  trusting what it found. A `fankeel-reader` briefed to write nothing can
  still write through a shell redirect no hook watches for every case —
  `docs/collisions.md` names the incident and the narrower guard this stage
  cannot rely on alone.
```

   在 `skills/fankeel-audit/SKILL.md`，「**Where the host opens it, the chain is one
   workflow.**」那一段之後加一段：

```markdown
**Once that workflow returns, run `git status --porcelain` once** before
reading its findings — the same check `fankeel-survey` now makes, for the
same reason: a read-only reader's tool list is not the same thing as a
guarantee it wrote nothing. `docs/collisions.md` has the incident.
```

7. 在 `docs/collisions.md`，「## What the guard does not watch」那一節收尾（「... is a
   step worth taking, not a guarantee to lean on.」那句之後）加一整節：

```markdown
## A named exception: three read-only agents, denied by command

`files_ref.txt` is where the paragraph above stopped being enough. A
`fankeel-reader` dispatched inside the 2026-09-11 survey workflow was told to
write nothing — its tool list drops `Edit` and `Write` — and left that file in
the repository root anyway, through `Bash`'s own `>`.
`docs/judgements/2026-09-10-shell-whitelist.md` weighed a wider version of
this question — a `Bash|PowerShell` matcher for every session, to protect any
two tasks from colliding — and rejected it on cost, and on that judgement's
own motivating case scoring zero. That judgement also named the condition
under which it would be wrong: a record of a subagent typing a bare
write, outside a script. `files_ref.txt` is that record.

This is narrower than what was rejected. `.claude-plugin/plugin.json` now
registers `hooks/guard.js` a second time, matcher `Bash|PowerShell`, and the
hook denies a command only when both are true: `payload.agent_type` — read
bare or with a `fankeel:` prefix, `lib/guard.js`'s `readOnlyAgentType` —
names `fankeel-reader`, `fankeel-reviewer` or `fankeel-judge`, and the command
matches `writesFiles()`'s fixed list — a redirect to anywhere but `/dev/null`
or `$null`, `tee`, `rm`, `mv`, `cp`, `sed -i`, a writing `git` subcommand, or
one of four PowerShell cmdlets. `fankeel-verifier` is not on the list —
writing its own evidence file is what it is for.

The list is a denylist rather than an allowlist for the reason the rejected
2026-09-10 proposal already named: an allowlist would refuse the `npm test`
and `node scripts/...` calls these agents are supposed to make. It runs only
against three named agent types rather than every session's Bash calls, which
is the difference that makes the per-call cost worth paying here and not
worth paying everywhere — the general guard above still says nothing about a
`Bash` or `PowerShell` call from anything else.

Whether `agent_type` reaches the hook at all, and in which of the two shapes,
was checked rather than assumed —
[docs/reports/2026-09-11-hook-payload-probe.md](reports/2026-09-11-hook-payload-probe.md)
is where.

Belt and suspenders: `skills/fankeel-survey/SKILL.md` and
`skills/fankeel-audit/SKILL.md`, the two skills that dispatch a
`fankeel-reader` workflow, now run `git status --porcelain` once the workflow
returns — a write this hook missed, or one from a tool it is not wired to,
still shows up there before the returned findings are trusted.
```

8. 跑 `npm test` 看綠，再跑 `node scripts/docs-check.js`——`hooks/guard.js` 裡插的新
   分支會把「## What the guard does not watch」那一節既有的
   `` `hooks/guard.js:42` ``／`` `hooks/guard.js:43` `` 兩處引用往下推，`.claude-plugin/plugin.json`
   裡插的新項目不會動到同一節引的 `` `.claude-plugin/plugin.json:76` ``（新項目加在
   `PreToolUse` 陣列最後一個，那個引用在它之前）。docs-check 印出來的行號照改，不要用
   猜的；上一步新增的段落如果引了行號，也要核對：

```bash
npm test
node scripts/docs-check.js
```

9. Commit：

```bash
git add lib/guard.js hooks/guard.js .claude-plugin/plugin.json docs/collisions.md skills/fankeel-survey/SKILL.md skills/fankeel-audit/SKILL.md tests/guard.test.js
git commit -m "feat: deny a read-only agent's Bash or PowerShell write, by name"
```

## Task 19: A per-request context series and the transcript readers in `lib/usage.js`

Design §7 draws the context line from `summarise()`'s own `byRequest` (`lib/usage.js:59`), and asks that `spanOf()` (`lib/usage.js:163`, not exported today) be exported rather than copied. This task adds the series behind `opts.series` so every existing caller keeps the exact shape it has, and the readers the later tasks share: one line parser, one request numbering (turn n is `series[n - 1]`), and the task-notification reader. The existing `tests/usage.test.js` stays green unchanged.

**Files:**
- Modify: `lib/usage.js` — `summarise()` gains `opts.series`; new `contextOf`, `entriesOf`, `turnIndex`, `textOf`, `notificationOf`; `spanOf`, `agentFiles`, `sessionDirOf` exported
- Modify: `docs/improvement-brief.md` — the two `lib/usage.js` citations the insertion moves
- Test: `tests/usage-series.test.js`

**Interfaces:**
- Consumes: none
- Produces: `summarise(transcriptPath, { series: true })` adds `series: [{ id, at, model, context, output }]`, one row per request in first-seen order, `context` = input + cache read + both cache writes; `spanOf(file)` → `{ first, last } | null`; `agentFiles(sessionDir)` → `string[]`; `sessionDirOf(transcriptPath)` → `string | null`; `entriesOf(file)` → `object[] | null`; `turnIndex(entries)` → `(i) => number | null`; `textOf(content)` → `string`; `notificationOf(entry)` → `{ toolUseId, chars, at } | null`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing test.** Create `tests/usage-series.test.js` with:

```js
'use strict';
// The per-request series and the transcript readers the station's detail panel
// is built on. The series is `summarise()`'s own `byRequest`, so the curve and
// the request count come from one pass and cannot disagree.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const usage = require('../lib/usage.js');
const tmp = require('./tmp.js');

const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const said = (rid, s, u) => line({ type: 'assistant', requestId: rid, timestamp: T(s),
    message: { model: 'claude-opus-5', usage: u, content: [] } });

function transcript(lines) {
    const file = path.join(tmp('fankeel-series-'), 't.jsonl');
    fs.writeFileSync(file, lines.join(''));
    return file;
}

test('series is one row per request in first-seen order; context is input, cache read and both cache writes', () => {
    const file = transcript([
        said('req_a', 1, { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100,
            cache_creation: { ephemeral_5m_input_tokens: 20, ephemeral_1h_input_tokens: 30 } }),
        said('req_b', 2, { input_tokens: 1, output_tokens: 7, cache_read_input_tokens: 200, cache_creation_input_tokens: 40 }),
        said('req_a', 3, { input_tokens: 10, output_tokens: 9, cache_read_input_tokens: 100,
            cache_creation: { ephemeral_5m_input_tokens: 20, ephemeral_1h_input_tokens: 30 } }),
        line({ type: 'assistant', requestId: 'req_c', message: { model: 'claude-opus-5', usage: { input_tokens: 3 } } }),
    ]);
    const seen = usage.summarise(file, { series: true });
    assert.deepEqual(seen.series.map((r) => [r.id, r.context, r.output]),
        [['req_a', 160, 9], ['req_b', 241, 7], ['req_c', 3, 0]]);
    assert.equal(seen.series[0].at, Date.parse(T(3)), 'the last line of a request wins, its time included');
    assert.ok(Number.isNaN(seen.series[2].at));
    assert.equal(seen.series.length, seen.usage.requests);
    assert.equal(usage.summarise(file).series, undefined, 'no series unless asked');
});

test('turnIndex numbers requests the way the series does, and entriesOf skips a torn line', () => {
    const file = transcript([
        line({ type: 'user', message: { content: 'go' } }),
        said('req_a', 1, { input_tokens: 1 }),
        said('req_a', 2, { input_tokens: 1 }),
        line({ type: 'assistant', message: { model: 'claude-opus-5', usage: { input_tokens: 1 } } }),
        said('req_b', 3, { input_tokens: 1 }),
        '{"torn',
    ]);
    const entries = usage.entriesOf(file);
    assert.equal(entries.length, 5);
    const turnAt = usage.turnIndex(entries);
    assert.deepEqual(entries.map((e, i) => turnAt(i)), [null, 1, 1, 2, 3]);
    assert.deepEqual(usage.summarise(file, { series: true }).series.map((r) => r.id), ['req_a', 'anonymous-0', 'req_b']);
    assert.equal(usage.entriesOf(path.join(tmp('fankeel-series-'), 'none.jsonl')), null);
});

test('textOf reads a string or text blocks, and notificationOf names the tool_use it returns for', () => {
    assert.equal(usage.textOf('abc'), 'abc');
    assert.equal(usage.textOf([{ type: 'text', text: 'ab' }, { type: 'image' }, { type: 'text', text: 'c' }]), 'abc');
    assert.equal(usage.textOf(undefined), '');
    const body = '<task-notification>\n<task-id>x</task-id>\n<tool-use-id>toolu_9</tool-use-id>\n</task-notification>';
    const flagged = { type: 'user', origin: { kind: 'task-notification' }, timestamp: T(5), message: { content: body } };
    assert.deepEqual(usage.notificationOf(flagged), { toolUseId: 'toolu_9', chars: body.length, at: Date.parse(T(5)) });
    assert.equal(usage.notificationOf({ type: 'user', timestamp: T(5), message: { content: body } }).toolUseId, 'toolu_9',
        'an older line carries no origin and is read by its opening tag');
    assert.equal(usage.notificationOf({ type: 'user', message: { content: 'hello' } }), null);
});

test('spanOf, agentFiles and sessionDirOf are exported for the station to use rather than copy', () => {
    const file = transcript([said('r1', 4, { input_tokens: 1 }), line({ type: 'user', timestamp: T(9) }), said('r2', 2, { input_tokens: 1 })]);
    assert.deepEqual(usage.spanOf(file), { first: Date.parse(T(2)), last: Date.parse(T(9)) });
    assert.deepEqual(usage.agentFiles(path.join(path.dirname(file), 'nothing-here')), []);
    assert.equal(usage.sessionDirOf(path.join('x', 'abc.jsonl')), path.join('x', 'abc'));
});
```

- [ ] **Step 2: Run it and watch it fail.**

```
node --test tests/usage-series.test.js
```

It prints `ℹ pass 0 ℹ fail 4`, the first failures reading `TypeError: Cannot read properties of undefined (reading 'map')` and `TypeError: usage.entriesOf is not a function`.

- [ ] **Step 3: Write the implementation.**

In `lib/usage.js`, replace:

```js
function summarise(transcriptPath, opts) {
    const sidechain = Boolean(opts && opts.sidechain);
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/usage.js`:

```js
// The context one request carried: everything it sent, read from the cache or
// written into it. Its own output is not context until the next request reads
// it back, so it is counted there and not here.
function contextOf(usage) {
    const split = usage.cache_creation;
    const writes = split && typeof split === 'object'
        ? num(split.ephemeral_5m_input_tokens) + num(split.ephemeral_1h_input_tokens)
        : num(usage.cache_creation_input_tokens);
    return num(usage.input_tokens) + num(usage.cache_read_input_tokens) + writes;
}

function summarise(transcriptPath, opts) {
    const sidechain = Boolean(opts && opts.sidechain);
```

In `lib/usage.js`, replace:

```js
    return { model, usage: stages ? { requests: byRequest.size, models, stages } : { requests: byRequest.size, models } };
}
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/usage.js`:

```js
    const out = { model, usage: stages ? { requests: byRequest.size, models, stages } : { requests: byRequest.size, models } };
    // The station's context curve, one row per request in the order the
    // requests were first written — `byRequest` already holds them, so the
    // curve and the request count cannot disagree. Only when asked: every
    // other caller wants exactly the shape above.
    if (opts && opts.series) {
        out.series = [];
        for (const [id, r] of byRequest) {
            out.series.push({ id, at: r.at, model: r.model, context: contextOf(r.usage), output: num(r.usage.output_tokens) });
        }
    }
    return out;
}
```

In `lib/usage.js`, replace:

```js
module.exports = { summarise, agentsOf, summariseTree };
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/usage.js`:

```js
// Every line of a transcript that parses, in order; null when the file cannot
// be read. The station's readers walk the lines `summarise` walks, and one
// parser is how they agree on what a line is.
function entriesOf(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
    const out = [];
    for (const raw of text.split('\n')) {
        if (!raw) continue;
        try {
            const e = JSON.parse(raw);
            if (e && typeof e === 'object') out.push(e);
        } catch (e) { /* a torn last line */ }
    }
    return out;
}

// Which request each line belongs to, numbered from 1 in the order `summarise`
// first meets the requests — so turn n and `series[n - 1]` are one request. A
// line with no `requestId` is its own request, as it is there. Returns a
// function of the line's index in `entries`; null for a line in no request.
function turnIndex(entries) {
    const byRequest = new Map();
    const byLine = new Map();
    let n = 0;
    entries.forEach((e, i) => {
        if (!e || e.type !== 'assistant' || e.isSidechain === true) return;
        const m = e.message;
        if (!m || typeof m !== 'object' || typeof m.model !== 'string' || !m.usage || typeof m.usage !== 'object') return;
        const rid = typeof e.requestId === 'string' && e.requestId ? e.requestId : null;
        if (!rid) byLine.set(i, ++n);
        else if (!byRequest.has(rid)) byRequest.set(rid, ++n);
    });
    return (i) => {
        const e = entries[i];
        if (!e) return null;
        const rid = typeof e.requestId === 'string' && e.requestId ? e.requestId : null;
        if (rid) return byRequest.has(rid) ? byRequest.get(rid) : null;
        return byLine.has(i) ? byLine.get(i) : null;
    };
}

// A tool result's text, whether it arrived as a string or as blocks.
function textOf(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('');
}

// A background agent's or a workflow's return is not a tool result: it comes
// back later as a user line flagged `origin.kind: "task-notification"`, naming
// the tool_use that launched it. Older transcripts carry no `origin`, so the
// opening tag is read too.
const TOOL_USE_ID = /<tool-use-id>([^<]+)<\/tool-use-id>/;
function notificationOf(entry) {
    if (!entry || entry.type !== 'user' || !entry.message) return null;
    const text = textOf(entry.message.content);
    const flagged = entry.origin && entry.origin.kind === 'task-notification';
    if (!flagged && !text.trimStart().startsWith('<task-notification>')) return null;
    const m = TOOL_USE_ID.exec(text);
    return m ? { toolUseId: m[1].trim(), chars: text.length, at: Date.parse(entry.timestamp) } : null;
}

module.exports = {
    summarise, agentsOf, summariseTree, spanOf, agentFiles, sessionDirOf,
    entriesOf, turnIndex, textOf, notificationOf,
};
```


- [ ] **Step 4: Correct the citations the new lines moved.** `node scripts/docs-check.js` names them as `moved:`; with this plan's tasks landed in order the corrections are:

- In `docs/improvement-brief.md`: `lib/usage.js:198` → `lib/usage.js:220`
- In `docs/improvement-brief.md`: `lib/usage.js:129` → `lib/usage.js:151`

If another task landed in between and moved the same lines further, use the number docs-check prints instead. Then `node scripts/docs-check.js` exits 0.

- [ ] **Step 5: Run it and watch it pass.**

```
node --test tests/usage-series.test.js tests/usage.test.js
```

It prints `ℹ pass 16 ℹ fail 0`. Then the four checks, each run on its own and judged by its exit code, not through a pipe: `npm test`, `node scripts/docs-check.js`, `node scripts/todo-check.js`, `node scripts/skills-check.js` — all exit 0.

- [ ] **Step 6: Commit.**

```
git add lib/usage.js docs/improvement-brief.md tests/usage-series.test.js
git commit -m "feat: usage.js keeps a per-request series and exports its transcript readers"
```


## Task 20: `dispatchesOf()`: every dispatch and every agent, with its own tokens and return size

Design §7: one row per dispatch with its surface, turn, label, agent type, model and tokens; tokens split by kind from the agent's own `agent-<id>.jsonl` (`summarise(..., { sidechain: true })`) so they can be priced, not `workflow_agent.tokens`; every workflow run in the session, not only the newest (`05de9a54` has two); and the return size a dispatch left in the parent. Measured on two real sessions on 2026-09-11 with this code: the rows' token and dollar sums equal `agentsOf()`'s to the cent (4135 = 4135, 2047 = 2047), and the workflow rows equal the run files' `workflow_agent` rows (10 = 10, 22 = 22). The rows are built over `agentFiles()` — the same files `agentsOf()` sums — which is what makes those two totals the same number.

**Files:**
- Modify: `lib/usage.js` — `readJson`, `runsOf`, `splitOf`, `tokensOf`, `dispatchesOf` added and exported
- Test: `tests/dispatches.test.js`

**Interfaces:**
- Consumes: `entriesOf`, `turnIndex`, `textOf`, `notificationOf`, `summarise`, `spanOf`, `agentFiles`, `sessionDirOf` from `lib/usage.js`
- Produces: `dispatchesOf(transcriptPath)` → `{ dispatches, rows, runs } | null`. `dispatches[i]`: `{ key, turn, surface, text, agentType, alias, out, back, ret, launch, run, agentId, ids, phases }` — one per Agent or Workflow tool_use, `surface` `agent` | `agents` (two or more Agent calls in one request) | `workflow`, `ret` the characters its result put into the parent (a background agent's or workflow's task-notification, a foreground agent's tool result), `launch` the characters of a background launch acknowledgement. `rows[j]`: `{ id, file, surface, disp, turn, label, agentType, alias, phase, run, requests, model, models, split, tokens, first, last, durMs }` — one per file `agentFiles()` finds plus a zero row for a run-file `workflow_agent` with no transcript; `disp` indexes `dispatches` or is null. `runs`: `[{ run, name, agents }]`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing test.** Create `tests/dispatches.test.js` with:

```js
'use strict';
// dispatchesOf: every dispatch the parent made and every agent it ran, from the
// parent's tool calls, the agents' own transcripts and the workflow run files.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const usage = require('../lib/usage.js');
const tmp = require('./tmp.js');

const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const said = (rid, s, content) => line({ type: 'assistant', requestId: rid, timestamp: T(s),
    message: { model: 'claude-opus-5', usage: { input_tokens: 1, output_tokens: 1 }, content } });
const result = (s, id, text, meta) => line({ type: 'user', timestamp: T(s), toolUseResult: meta,
    message: { content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }] }] } });
const NOTE = (id) => '<task-notification>\n<tool-use-id>' + id + '</tool-use-id>\n<result>done</result>\n</task-notification>';
const notify = (s, id) => line({ type: 'user', timestamp: T(s), origin: { kind: 'task-notification' }, message: { content: NOTE(id) } });
const agentLine = (rid, s, model, u) => line({ type: 'assistant', isSidechain: true, requestId: rid, timestamp: T(s),
    message: { model, usage: u, content: [] } });

// Two Agent calls in one request (one in the background, one not), then a
// Workflow; an agent file whose tool_use is not in the transcript; a run file
// naming two agents, one of which left no transcript.
function session() {
    const base = tmp('fankeel-dispatch-');
    const t = path.join(base, 'sess.jsonl');
    const dir = path.join(base, 'sess');
    fs.writeFileSync(t, [
        line({ type: 'user', timestamp: T(0), message: { content: 'go' } }),
        said('req_1', 1, [
            use('toolu_a', 'Agent', { description: 'A', subagent_type: 'fankeel-reader', model: 'sonnet', prompt: 'p' }),
            use('toolu_b', 'Agent', { description: 'B', subagent_type: 'general-purpose', prompt: 'p' })]),
        result(2, 'toolu_a', 'launched', { status: 'async_launched', isAsync: true, agentId: 'aaa1' }),
        result(3, 'toolu_b', 'the answer', { status: 'completed', agentId: 'bbb2' }),
        said('req_2', 4, [use('toolu_w', 'Workflow', { script: 'export const meta = {}' })]),
        result(5, 'toolu_w', 'started', { status: 'async_launched', runId: 'wf_1', workflowName: 'flow' }),
        notify(20, 'toolu_a'),
        notify(30, 'toolu_w'),
    ].join(''));
    const sub = path.join(dir, 'subagents');
    fs.mkdirSync(path.join(sub, 'workflows', 'wf_1'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(sub, 'agent-aaa1.jsonl'),
        agentLine('r1', 10, 'claude-sonnet-5', { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 1000 })
        + agentLine('r2', 40, 'claude-sonnet-5', { input_tokens: 5, output_tokens: 5 }));
    fs.writeFileSync(path.join(sub, 'agent-aaa1.meta.json'),
        JSON.stringify({ agentType: 'fankeel-reader', description: 'A', toolUseId: 'toolu_a', model: 'sonnet' }));
    fs.writeFileSync(path.join(sub, 'agent-bbb2.jsonl'), agentLine('r3', 3, 'claude-opus-5', { input_tokens: 7 }));
    fs.writeFileSync(path.join(sub, 'agent-ccc3.jsonl'), agentLine('r4', 6, 'claude-haiku-4-5-20251001', { input_tokens: 2 }));
    fs.writeFileSync(path.join(sub, 'agent-ccc3.meta.json'),
        JSON.stringify({ agentType: 'general-purpose', description: 'orphan', toolUseId: 'toolu_gone' }));
    fs.writeFileSync(path.join(sub, 'workflows', 'wf_1', 'agent-ddd4.jsonl'),
        agentLine('r5', 8, 'claude-sonnet-5', { input_tokens: 50, output_tokens: 50 }));
    fs.writeFileSync(path.join(dir, 'workflows', 'wf_1.json'), JSON.stringify({
        runId: 'wf_1', workflowName: 'flow', workflowProgress: [
            { type: 'workflow_phase', index: 1, title: 'Read' },
            { type: 'workflow_agent', agentId: 'ddd4', label: 'read:x', phaseTitle: 'Read', agentType: 'fankeel:fankeel-reader', model: 'claude-sonnet-5', tokens: 999 },
            { type: 'workflow_agent', agentId: 'eee5', label: 'check:y', phaseTitle: 'Check', agentType: 'fankeel:fankeel-reviewer', model: 'claude-sonnet-5' },
        ],
    }));
    return t;
}

test('two Agent calls in one request are agents, a Workflow is workflow, each on the turn it went out on', () => {
    const out = usage.dispatchesOf(session());
    assert.deepEqual(out.dispatches.map((d) => [d.surface, d.turn, d.text, d.agentType, d.alias]), [
        ['agents', 1, 'A', 'fankeel-reader', 'sonnet'],
        ['agents', 1, 'B', 'general-purpose', null],
        ['workflow', 2, 'flow', null, null],
    ]);
});

test('a background dispatch returns through its notification, a foreground one through its tool result', () => {
    const [a, b, w] = usage.dispatchesOf(session()).dispatches;
    assert.deepEqual([a.launch, a.ret, a.back], ['launched'.length, NOTE('toolu_a').length, Date.parse(T(20))]);
    assert.deepEqual([b.launch, b.ret, b.back], [0, 'the answer'.length, Date.parse(T(3))]);
    assert.deepEqual([w.run, w.launch, w.ret, w.back], ['wf_1', 'started'.length, NOTE('toolu_w').length, Date.parse(T(30))]);
});

test('one row per agent file and a zero row for a run agent with no transcript, each on its dispatch', () => {
    const out = usage.dispatchesOf(session());
    const by = Object.fromEntries(out.rows.map((r) => [r.id, r]));
    assert.deepEqual(Object.keys(by).sort(), ['aaa1', 'bbb2', 'ccc3', 'ddd4', 'eee5']);
    assert.deepEqual([by.aaa1.disp, by.aaa1.turn, by.aaa1.label, by.aaa1.surface, by.aaa1.tokens, by.aaa1.durMs, by.aaa1.requests],
        [0, 1, 'A', 'agents', 1120, 30000, 2]);
    assert.deepEqual(by.aaa1.split, { input: 105, output: 15, cacheRead: 1000, cacheWrite5m: 0, cacheWrite1h: 0 });
    assert.equal(by.bbb2.disp, 1);
    assert.deepEqual([by.ccc3.disp, by.ccc3.surface, by.ccc3.label, by.ccc3.agentType], [null, 'agent', 'orphan', 'general-purpose']);
    assert.deepEqual([by.ddd4.surface, by.ddd4.disp, by.ddd4.label, by.ddd4.phase, by.ddd4.tokens], ['workflow', 2, 'read:x', 'Read', 100]);
    assert.deepEqual([by.eee5.tokens, by.eee5.requests, by.eee5.disp, by.eee5.phase], [0, 0, 2, 'Check']);
    assert.deepEqual(out.dispatches[2].ids.slice().sort(), ['ddd4', 'eee5']);
    assert.deepEqual(out.dispatches[2].phases, ['Read', 'Check']);
    assert.deepEqual(out.runs, [{ run: 'wf_1', name: 'flow', agents: 2 }]);
});

test('the rows add up to what agentsOf sums over the same files, and a missing transcript is null', () => {
    const t = session();
    const rows = usage.dispatchesOf(t).rows;
    const five = (m) => m.input + m.output + m.cacheRead + m.cacheWrite5m + m.cacheWrite1h;
    const theirs = Object.values(usage.agentsOf(t).models).reduce((n, m) => n + five(m), 0);
    assert.equal(rows.reduce((n, r) => n + r.tokens, 0), theirs);
    assert.equal(usage.dispatchesOf(path.join(path.dirname(t), 'none.jsonl')), null);
});
```

- [ ] **Step 2: Run it and watch it fail.**

```
node --test tests/dispatches.test.js
```

It prints `ℹ pass 0 ℹ fail 4`, the first failures reading `TypeError: usage.dispatchesOf is not a function`.

- [ ] **Step 3: Write the implementation.**

In `lib/usage.js`, replace:

```js
module.exports = {
    summarise, agentsOf, summariseTree, spanOf, agentFiles, sessionDirOf,
    entriesOf, turnIndex, textOf, notificationOf,
};
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/usage.js`:

```js
function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return null;
    }
}

// Every workflow run the session made — all of them, not only the newest:
// `05de9a54` has two — keyed by run id, each with its `workflow_agent` rows by
// agent id. Filtered on `type`, never by position: the same array holds the
// `workflow_phase` rows.
function runsOf(sessionDir) {
    const out = new Map();
    let names;
    try {
        names = fs.readdirSync(path.join(sessionDir, 'workflows'));
    } catch (e) {
        return out;
    }
    for (const name of names.sort()) {
        if (!name.endsWith('.json')) continue;
        const data = readJson(path.join(sessionDir, 'workflows', name));
        if (!data || typeof data !== 'object') continue;
        const run = typeof data.runId === 'string' && data.runId ? data.runId : name.slice(0, -'.json'.length);
        const agents = new Map();
        for (const r of Array.isArray(data.workflowProgress) ? data.workflowProgress : []) {
            if (r && r.type === 'workflow_agent' && typeof r.agentId === 'string') agents.set(r.agentId, r);
        }
        out.set(run, { name: typeof data.workflowName === 'string' ? data.workflowName : run, agents });
    }
    return out;
}

const FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];
function splitOf(models) {
    const out = blank();
    for (const m of Object.values(models || {})) for (const k of FIELDS) out[k] += m[k] || 0;
    return out;
}
const tokensOf = (split) => FIELDS.reduce((n, k) => n + split[k], 0);

const DISPATCH_TOOLS = new Set(['Agent', 'Task']);

// Every dispatch the parent made and every agent it ran, as two lists.
//
// `dispatches` is one row per Agent or Workflow tool_use: the turn it went out
// on, when it came back and how many characters its return put into the
// parent's context. A background agent's tool result is only the launch
// acknowledgement, so that is `launch` and its task-notification is `ret`;
// a foreground agent's tool result is its return. Two or more Agent calls in
// one request are `agents`.
//
// `rows` is one row per agent file `agentFiles()` finds — the same files
// `agentsOf` sums, so the rows add up to its total — plus a zero row for any
// `workflow_agent` a run file names that left no transcript. Tokens come from
// the agent's own transcript, split by kind so the caller can price them;
// `workflow_agent.tokens` is one undivided number and cannot be priced.
function dispatchesOf(transcriptPath) {
    const entries = entriesOf(transcriptPath);
    const dir = sessionDirOf(transcriptPath);
    if (!entries || !dir) return null;
    const turnAt = turnIndex(entries);
    const uses = [];
    const results = new Map();
    const notes = new Map();
    entries.forEach((e, i) => {
        if (e.isSidechain === true || !e.message || typeof e.message !== 'object') return;
        const content = Array.isArray(e.message.content) ? e.message.content : [];
        if (e.type === 'assistant') {
            for (const b of content) {
                if (!b || b.type !== 'tool_use' || !(DISPATCH_TOOLS.has(b.name) || b.name === 'Workflow')) continue;
                uses.push({
                    key: b.id, name: b.name, input: b.input && typeof b.input === 'object' ? b.input : {},
                    request: typeof e.requestId === 'string' && e.requestId ? e.requestId : 'line-' + i,
                    turn: turnAt(i), at: Date.parse(e.timestamp),
                });
            }
            return;
        }
        if (e.type !== 'user') return;
        const note = notificationOf(e);
        if (note) {
            if (!notes.has(note.toolUseId)) notes.set(note.toolUseId, note);
            return;
        }
        for (const b of content) {
            if (!b || b.type !== 'tool_result' || typeof b.tool_use_id !== 'string') continue;
            results.set(b.tool_use_id, {
                chars: textOf(b.content).length, at: Date.parse(e.timestamp),
                meta: e.toolUseResult && typeof e.toolUseResult === 'object' ? e.toolUseResult : {},
            });
        }
    });
    const perRequest = new Map();
    for (const u of uses) if (DISPATCH_TOOLS.has(u.name)) perRequest.set(u.request, (perRequest.get(u.request) || 0) + 1);
    const dispatches = uses.map((u) => {
        const res = results.get(u.key) || null;
        const note = notes.get(u.key) || null;
        const meta = res ? res.meta : {};
        const later = meta.status === 'async_launched' || meta.isAsync === true;
        const flow = u.name === 'Workflow';
        return {
            key: u.key, turn: u.turn,
            surface: flow ? 'workflow' : perRequest.get(u.request) > 1 ? 'agents' : 'agent',
            text: flow ? String(meta.workflowName || 'workflow') : String(u.input.description || ''),
            agentType: !flow && typeof u.input.subagent_type === 'string' ? u.input.subagent_type : null,
            alias: !flow && typeof u.input.model === 'string' ? u.input.model : null,
            out: u.at,
            back: later ? (note ? note.at : null) : (res ? res.at : null),
            ret: later ? (note ? note.chars : null) : (res ? res.chars : null),
            launch: later && res ? res.chars : 0,
            run: flow && typeof meta.runId === 'string' ? meta.runId : null,
            agentId: !flow && typeof meta.agentId === 'string' ? meta.agentId : null,
            ids: [], phases: [],
        };
    });
    const runs = runsOf(dir);
    const rows = [];
    const seen = new Set();
    const place = (row, di) => {
        if (di >= 0) {
            row.disp = di;
            row.turn = dispatches[di].turn;
            dispatches[di].ids.push(row.id);
            if (row.phase && !dispatches[di].phases.includes(row.phase)) dispatches[di].phases.push(row.phase);
        }
        seen.add(row.id);
        rows.push(row);
    };
    for (const file of agentFiles(dir)) {
        const id = path.basename(file, '.jsonl').slice('agent-'.length);
        const parent = path.dirname(file);
        const inRun = path.basename(path.dirname(parent)) === 'workflows';
        const run = inRun ? path.basename(parent) : null;
        const own = summarise(file, { sidechain: true });
        const models = own ? own.usage.models : {};
        const split = splitOf(models);
        const span = spanOf(file);
        const row = {
            id, file, surface: inRun ? 'workflow' : 'agent', disp: null, turn: null,
            label: '', agentType: null, alias: null, phase: null, run,
            requests: own ? own.usage.requests : 0, model: own ? own.model : null, models, split,
            tokens: tokensOf(split), first: span ? span.first : null, last: span ? span.last : null,
            durMs: span ? span.last - span.first : 0,
        };
        let di;
        if (inRun) {
            const p = runs.has(run) ? runs.get(run).agents.get(id) : null;
            if (p) {
                row.label = String(p.label || '');
                row.agentType = typeof p.agentType === 'string' ? p.agentType : null;
                row.alias = typeof p.model === 'string' ? p.model : null;
                row.phase = typeof p.phaseTitle === 'string' ? p.phaseTitle : null;
            }
            di = dispatches.findIndex((d) => d.run === run);
        } else {
            const meta = readJson(path.join(parent, 'agent-' + id + '.meta.json')) || {};
            di = dispatches.findIndex((d) => d.agentId === id);
            if (di < 0 && typeof meta.toolUseId === 'string') di = dispatches.findIndex((d) => d.key === meta.toolUseId);
            const d = di >= 0 ? dispatches[di] : null;
            row.surface = d ? d.surface : 'agent';
            row.label = d && d.text ? d.text : String(meta.description || '');
            row.agentType = (d && d.agentType) || (typeof meta.agentType === 'string' ? meta.agentType : null);
            row.alias = (d && d.alias) || (typeof meta.model === 'string' ? meta.model : null);
        }
        place(row, di);
    }
    for (const [run, r] of runs) {
        for (const [id, p] of r.agents) {
            if (seen.has(id)) continue;
            place({
                id, file: null, surface: 'workflow', disp: null, turn: null,
                label: String(p.label || ''), agentType: typeof p.agentType === 'string' ? p.agentType : null,
                alias: typeof p.model === 'string' ? p.model : null,
                phase: typeof p.phaseTitle === 'string' ? p.phaseTitle : null, run,
                requests: 0, model: null, models: {}, split: blank(), tokens: 0, first: null, last: null, durMs: 0,
            }, dispatches.findIndex((d) => d.run === run));
        }
    }
    return { dispatches, rows, runs: [...runs].map(([run, r]) => ({ run, name: r.name, agents: r.agents.size })) };
}

module.exports = {
    summarise, agentsOf, summariseTree, spanOf, agentFiles, sessionDirOf,
    entriesOf, turnIndex, textOf, notificationOf, dispatchesOf,
};
```


- [ ] **Step 4: Run it and watch it pass.**

```
node --test tests/dispatches.test.js tests/usage.test.js
```

It prints `ℹ pass 16 ℹ fail 0`. Then the four checks, each run on its own and judged by its exit code, not through a pipe: `npm test`, `node scripts/docs-check.js`, `node scripts/todo-check.js`, `node scripts/skills-check.js` — all exit 0.

- [ ] **Step 5: Commit.**

```
git add lib/usage.js tests/dispatches.test.js
git commit -m "feat: dispatchesOf lists every dispatch and every agent with its own tokens"
```


## Task 21: `lib/detail.js`: stage moves from real `task.js` commands, backtracks, largest-remainder rounding, context rises with causes

Design §7: the stage sequence and the backtrack count come from the `task.js` commands the transcript actually ran, with `moves` only where there are none (`05de9a54` has no `moves`), and never from `git commit -m` text naming `task.js stage` — the v3 mockup's first parse was fooled by exactly that. Stage boundaries take the command's own timestamp (`moves` was 19 minutes late on 2026-09-11). Money, tokens and seconds are rounded by the largest remainder so a printed total equals its rows ($10.77 against $10.78 otherwise). Each of the five largest rises is named by what arrived between the two requests, or as the model's own output when the previous response's output tokens are at least half the rise. Checked on the two real sessions: 05de9a54 yields eight steps from commands with one verify→build backtrack, 13ebea34 three steps and none. `lib/detail.js` is a new file; `plantasks` reads only `Modify:` lines, so it is declared that way.

**Files:**
- Modify: `lib/detail.js` — new file
- Read: `lib/usage.js` — `textOf`, `notificationOf`, `turnIndex`
- Read: `lib/registry.js` — `seriesOf` for the clock fallback
- Test: `tests/detail.test.js`

**Interfaces:**
- Consumes: `textOf`, `notificationOf`, `turnIndex` from `lib/usage.js`; `seriesOf` from `lib/registry.js`
- Produces: `statements(cmd)` → `string[][]`; `taskCalls(cmd)` → `[{ verb, stage }]`; `stageCommands(entries, turnAt)` → `[{ at, turn, verb, stage, text }]`; `stageSequence(commands, data)` → `[{ stage, at, source }]` with `source` `cmd` | `moves` | `clock`; `backtracksOf(seq, route)` → `[{ i, from, to, at, since }]`; `largestRemainder(values, unit)` → `number[]`; `contextPoints(series)` → `{ points: [{ n, t, y }], noTime }`; `arrivals(entries, turnAt)` → `{ into, own }`; `risesOf(series, into, own, max)` → `[{ n, from, t, y0, y1, dy, cause, self: { tok, label }, top: [{ k, label, chars }], restN, restChars, inChars }]`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing test.** Create `tests/detail.test.js` with:

```js
'use strict';
// lib/detail.js: the stage sequence from the commands a session ran, its
// backward steps, the rounding that keeps a column's total equal to its rows,
// and the context rises with their causes.
const test = require('node:test');
const assert = require('node:assert/strict');
const detail = require('../lib/detail.js');
const usage = require('../lib/usage.js');

const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const said = (rid, s, content) => ({ type: 'assistant', requestId: rid, timestamp: T(s),
    message: { model: 'claude-opus-5', usage: { input_tokens: 1 }, content } });
const result = (s, id, content, extra) => ({ type: 'user', timestamp: T(s),
    message: { content: [Object.assign({ type: 'tool_result', tool_use_id: id, content }, extra || {})] } });

test('statements keeps a quoted commit message inside its git statement', () => {
    assert.deepEqual(detail.statements('cd x && git commit -m "fix; node scripts/task.js stage build"'),
        [['cd', 'x'], ['git', 'commit', '-m', 'fix; node scripts/task.js stage build']]);
});

test('taskCalls reads start, stage and route, and nothing inside a message or a heredoc', () => {
    assert.deepEqual(detail.taskCalls('P=/p; S=1\nnode $P/scripts/task.js start --session $S --task "x y"'),
        [{ verb: 'start', stage: 'survey' }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js start --route design,build --task t'), [{ verb: 'start', stage: 'design' }]);
    assert.deepEqual(detail.taskCalls('node C:\\p\\scripts\\task.js stage build --session s'), [{ verb: 'stage', stage: 'build' }]);
    assert.deepEqual(detail.taskCalls('git commit -m "node scripts/task.js stage build"'), []);
    assert.deepEqual(detail.taskCalls("git commit -F - <<'EOF'\nnode scripts/task.js stage build\nEOF\nnode scripts/task.js stage verify"),
        [{ verb: 'stage', stage: 'verify' }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js route survey,design,build'), [{ verb: 'route', stage: null }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js note "stage build"'), []);
});

test('stageCommands keeps the calls that ran, stamped with their own time and turn, and drops one that errored', () => {
    const entries = [
        said('r1', 1, [use('t1', 'Bash', { command: 'node scripts/task.js start --task x' })]),
        result(2, 't1', 'fankeel — started, at survey\nmore'),
        said('r2', 3, [use('t2', 'Bash', { command: 'node scripts/task.js stage build' })]),
        result(4, 't2', 'refused', { is_error: true }),
        said('r3', 5, [use('t3', 'PowerShell', { command: 'node scripts\\task.js stage design' })]),
        result(6, 't3', [{ type: 'text', text: 'fankeel — survey to design' }]),
        said('r4', 7, [use('t4', 'Bash', { command: 'git commit -m "task.js stage verify"' })]),
    ];
    assert.deepEqual(detail.stageCommands(entries, usage.turnIndex(entries)), [
        { at: Date.parse(T(1)), turn: 1, verb: 'start', stage: 'survey', text: 'fankeel — started, at survey' },
        { at: Date.parse(T(5)), turn: 3, verb: 'stage', stage: 'design', text: 'fankeel — survey to design' },
    ]);
});

test('stageSequence: commands first, the entry\'s first stage in front when there is no start, then moves, then the clock', () => {
    const data = { moves: [['survey', 100], ['design', 200]], clock: { survey: [100, 150], design: [200, 250] } };
    const cmds = [{ verb: 'stage', stage: 'design', at: 300 }, { verb: 'stage', stage: 'design', at: 310 }, { verb: 'route', stage: null, at: 320 }];
    assert.deepEqual(detail.stageSequence(cmds, data),
        [{ stage: 'survey', at: 100, source: 'moves' }, { stage: 'design', at: 300, source: 'cmd' }]);
    assert.deepEqual(detail.stageSequence([], data),
        [{ stage: 'survey', at: 100, source: 'moves' }, { stage: 'design', at: 200, source: 'moves' }]);
    assert.deepEqual(detail.stageSequence([], { clock: data.clock }),
        [{ stage: 'survey', at: 100, source: 'clock' }, { stage: 'design', at: 200, source: 'clock' }]);
    assert.deepEqual(detail.stageSequence([{ verb: 'start', stage: 'survey', at: 5 }], data), [{ stage: 'survey', at: 5, source: 'cmd' }]);
});

test('backtracksOf marks each step to an earlier stage on the route', () => {
    const route = ['survey', 'design', 'plan', 'build', 'verify', 'land'];
    const seq = ['survey', 'build', 'verify', 'build', 'verify', 'land'].map((stage, i) => ({ stage, at: i * 10 }));
    assert.deepEqual(detail.backtracksOf(seq, route), [{ i: 3, from: 'verify', to: 'build', at: 30, since: 20 }]);
    assert.deepEqual(detail.backtracksOf(seq.slice(0, 3), route), []);
});

test('largestRemainder: rounded cells add up to the rounded total, where rounding each alone does not', () => {
    const values = [1500, 1500, 1500];
    assert.equal(values.map((v) => Math.round(v / 1000)).reduce((a, b) => a + b, 0), 6, 'the failure this exists for');
    assert.deepEqual(detail.largestRemainder(values, 1000), [2, 2, 1]);
    const usd = [1.234, 2.3456, 3.4567, 0.0049, 3.7351];
    const cents = detail.largestRemainder(usd, 0.01);
    assert.equal(cents.reduce((a, b) => a + b, 0), Math.round(usd.reduce((a, b) => a + b, 0) * 100));
    usd.forEach((v, i) => assert.ok(Math.abs(cents[i] - v * 100) < 1, 'each cell stays within one cent'));
});

test('contextPoints counts a request with no time instead of placing it', () => {
    assert.deepEqual(detail.contextPoints([{ at: 10, context: 5 }, { at: NaN, context: 6 }, { at: 30, context: 7 }]),
        { points: [{ n: 1, t: 10, y: 5 }, { n: 3, t: 30, y: 7 }], noTime: 1 });
});

test('risesOf ranks the rises and names each cause: what arrived before it, or the model\'s own output', () => {
    const entries = [
        said('r1', 1, [use('u1', 'Read', { file_path: 'a/b/c/d.md' })]),
        result(2, 'u1', 'x'.repeat(5000)),
        said('r2', 3, [use('u2', 'Bash', { command: 'echo hi' })]),
        result(4, 'u2', 'y'.repeat(50)),
        said('r3', 5, []),
        { type: 'user', timestamp: T(6), message: { content: 'hello' } },
        said('r4', 7, []),
    ];
    const series = [100, 6000, 11000, 11100].map((context, i) => ({ id: 'r' + (i + 1), at: i, context, output: [10, 3000, 1, 1][i] }));
    const { into, own } = detail.arrivals(entries, usage.turnIndex(entries));
    const rises = detail.risesOf(series, into, own, 5);
    assert.deepEqual(rises.map((r) => [r.n, r.from, r.dy, r.cause]), [[2, 1, 5900, 'in'], [3, 2, 5000, 'self'], [4, 3, 100, 'in']]);
    assert.deepEqual(rises[0].top, [{ k: 'tool', label: 'Read b/c/d.md', chars: 5000 }]);
    assert.equal(rises[0].inChars, 5000);
    assert.deepEqual(rises[1].self, { tok: 3000, label: '上一回應寫的 Bash echo hi' });
    assert.deepEqual(rises[2].top, [{ k: 'prompt', label: 'prompt', chars: 5 }]);
    assert.equal(detail.risesOf(series, into, own, 1).length, 1);
});
```

- [ ] **Step 2: Run it and watch it fail.**

```
node --test tests/detail.test.js
```

It prints `ℹ pass 0 ℹ fail 1`, the first failures reading `Error: Cannot find module '../lib/detail.js'`.

- [ ] **Step 3: Write the implementation.**

Create `lib/detail.js` with:

```js
'use strict';
// One session taken apart, for the station's detail panel: its context curve,
// the five largest rises and what caused them, its stage sequence with every
// backward step, each dispatch and what it cost, and a replay of what it did.
// Everything is read from files already on disk — the transcript, the agents'
// own transcripts, the workflow run files — and cached per session under
// `<configDir>/fankeel/station/cache/`, keyed on what those files look like, so
// a session is read again only when one of them has changed, and a session
// that has ended is read once.
//
// Two rules from the 2026-09-08 redesign hold for everything below: one series
// per chart, and every total the page prints is the sum of the rows printed
// under it, from the same source. So the rounding that makes a column add up
// happens here, once, and the page only adds.
const usage = require('./usage.js');
const registry = require('./registry.js');

// ---- stage commands --------------------------------------------------------

// A heredoc body is text a command feeds itself, not a command. A commit
// message written with `<<'EOF'` can name `task.js stage build` on a line of its
// own, and read as a statement that line is a stage move nobody made.
const HEREDOC = /<<-?[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g;

// One shell command as statements, each a list of words. Quotes group, so a
// `git commit -m "... task.js stage build ..."` stays one word of a `git`
// statement — the 2026-09-11 mockup's first parse read exactly that as a
// backward move. `;`, `&`, `|` and a newline end a statement. A backslash is
// literal except before a newline, or before `"` or `\` inside double quotes:
// PowerShell writes paths with backslashes and they are not escapes there.
function statements(cmd) {
    const s = String(cmd || '').replace(HEREDOC, ' $3');
    const out = [];
    let words = [];
    let word = '';
    let has = false;
    let quote = null;
    const endWord = () => {
        if (has) words.push(word);
        word = '';
        has = false;
    };
    const endStatement = () => {
        endWord();
        if (words.length) out.push(words);
        words = [];
    };
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (quote) {
            if (c === quote) quote = null;
            else if (c === '\\' && quote === '"' && (s[i + 1] === '"' || s[i + 1] === '\\')) word += s[++i];
            else word += c;
            continue;
        }
        if (c === '"' || c === "'") {
            quote = c;
            has = true;
            continue;
        }
        if (c === '\\' && s[i + 1] === '\n') {
            i++;
            continue;
        }
        if (c === '\n' || c === ';' || c === '&' || c === '|') {
            endStatement();
            continue;
        }
        if (c === ' ' || c === '\t' || c === '\r') {
            endWord();
            continue;
        }
        word += c;
        has = true;
    }
    endStatement();
    return out;
}

const ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const NODE = /(^|[\\/])node(\.exe)?$/i;
const TASKJS = /(^|[\\/])task\.js$/;

// The `task.js` verbs a stage sequence is built from, out of one command: a
// statement whose program is `node` and whose script is `task.js`, after any
// `VAR=value` words in front. `start` enters the first stage of its `--route`,
// or `survey`, which every class's route begins with.
function taskCalls(cmd) {
    const out = [];
    for (const words of statements(cmd)) {
        let i = 0;
        while (i < words.length && ASSIGN.test(words[i])) i++;
        if (!NODE.test(words[i] || '') || !TASKJS.test(words[i + 1] || '')) continue;
        const verb = words[i + 2];
        const arg = words[i + 3];
        if (verb === 'stage' && arg && !arg.startsWith('-')) out.push({ verb, stage: arg });
        else if (verb === 'start') {
            const at = words.indexOf('--route', i);
            const route = at >= 0 && words[at + 1] ? words[at + 1].split(/[,\s]+/).filter(Boolean) : [];
            out.push({ verb, stage: route[0] || 'survey' });
        } else if (verb === 'route') out.push({ verb, stage: null });
    }
    return out;
}

// Every `task.js start|stage|route` the session ran, from its own Bash and
// PowerShell calls, in order, each stamped with the call's own timestamp —
// `moves` records when a hook first saw the change, which on 2026-09-11 was
// nineteen minutes after `start`. A call whose result came back as an error
// moved nothing and is dropped; one still waiting for its result is kept.
function stageCommands(entries, turnAt) {
    const out = [];
    const pending = new Map();
    (entries || []).forEach((e, i) => {
        if (!e || e.isSidechain === true || !e.message || !Array.isArray(e.message.content)) return;
        if (e.type === 'assistant') {
            for (const b of e.message.content) {
                if (!b || b.type !== 'tool_use' || (b.name !== 'Bash' && b.name !== 'PowerShell')) continue;
                const calls = taskCalls(b.input && b.input.command).map((c) => ({
                    at: Date.parse(e.timestamp), turn: turnAt ? turnAt(i) : null, verb: c.verb, stage: c.stage, text: '', ok: true,
                }));
                if (!calls.length) continue;
                out.push(...calls);
                pending.set(b.id, calls);
            }
            return;
        }
        if (e.type !== 'user') return;
        for (const b of e.message.content) {
            if (!b || b.type !== 'tool_result' || !pending.has(b.tool_use_id)) continue;
            const line = (usage.textOf(b.content).split('\n').find((l) => l.trim()) || '').trim().slice(0, 120);
            for (const c of pending.get(b.tool_use_id)) {
                c.ok = b.is_error !== true;
                c.text = line;
            }
            pending.delete(b.tool_use_id);
        }
    });
    return out.filter((c) => c.ok).map(({ ok, ...c }) => c);
}

const movesOf = (data) => (Array.isArray(data && data.moves) ? data.moves : [])
    .filter((m) => Array.isArray(m) && typeof m[0] === 'string' && Number.isFinite(m[1]));

// The stages in the order they were entered, each with where that came from.
// Commands first; `moves` only where there are none; the clock last, which
// keeps one window per stage and so cannot show a return. A command list that
// does not open with `start` — an adopted task, a transcript begun after the
// entry was — gets the entry's own first stage in front of it.
function stageSequence(commands, data) {
    const steps = [];
    const push = (stage, at, source) => {
        if (!steps.length || steps[steps.length - 1].stage !== stage) steps.push({ stage, at, source });
    };
    const cmds = (commands || []).filter((c) => (c.verb === 'start' || c.verb === 'stage') && c.stage);
    const moves = movesOf(data);
    if (cmds.length) {
        if (cmds[0].verb !== 'start') {
            const clock = registry.seriesOf(data || {});
            const first = moves.length ? { stage: moves[0][0], at: moves[0][1], source: 'moves' }
                : clock.length ? { stage: clock[0].stage, at: clock[0].from, source: 'clock' } : null;
            if (first && first.stage !== cmds[0].stage) push(first.stage, first.at, first.source);
        }
        for (const c of cmds) push(c.stage, c.at, 'cmd');
        return steps;
    }
    if (moves.length) {
        for (const [stage, at] of moves) push(stage, at, 'moves');
        return steps;
    }
    for (const w of registry.seriesOf(data || {})) push(w.stage, w.from, 'clock');
    return steps;
}

// A step to a stage earlier on the route than the one before it.
function backtracksOf(seq, route) {
    const r = Array.isArray(route) ? route : [];
    const out = [];
    for (let i = 1; i < (seq || []).length; i++) {
        const a = r.indexOf(seq[i - 1].stage);
        const b = r.indexOf(seq[i].stage);
        if (a >= 0 && b >= 0 && b < a) out.push({ i, from: seq[i - 1].stage, to: seq[i].stage, at: seq[i].at, since: seq[i - 1].at });
    }
    return out;
}

// ---- rounding --------------------------------------------------------------

// Round a column so its rounded cells add to its rounded total: floor every
// cell, then hand the units the floors lost to the cells with the largest
// remainders. Rounding each cell alone printed thirteen rows summing to $10.77
// under a total of $10.78.
function largestRemainder(values, unit) {
    const raw = (values || []).map((v) => (Number.isFinite(v) ? v : 0) / unit);
    const out = raw.map(Math.floor);
    let need = Math.round(raw.reduce((a, b) => a + b, 0)) - out.reduce((a, b) => a + b, 0);
    const order = raw.map((r, i) => [r - out[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let k = 0; k < order.length && need > 0; k++, need--) out[order[k][1]] += 1;
    return out;
}

// ---- context ---------------------------------------------------------------

// The curve's points: request n's context at its own time. A request with no
// timestamp cannot be placed on a time axis, so it is counted instead, and
// points plus that count is the request count.
function contextPoints(series) {
    const points = [];
    let noTime = 0;
    (series || []).forEach((r, i) => {
        if (Number.isFinite(r.at)) points.push({ n: i + 1, t: r.at, y: r.context });
        else noTime += 1;
    });
    return { points, noTime };
}

const tail = (p) => String(p || '').split(/[\\/]/).filter(Boolean).slice(-3).join('/');
const gist = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

function labelOf(u) {
    if (!u) return 'tool result';
    const i = u.input || {};
    const file = i.file_path || i.notebook_path;
    const arg = file ? tail(file) : (i.command || i.pattern || i.description || i.url || i.query || i.skill || '');
    return (u.name + ' ' + String(arg).replace(/\s+/g, ' ')).trim().slice(0, 80);
}

// What arrived before each request — every tool result, notification and
// prompt the parent received after the request before it — and the tool calls
// each request wrote.
function arrivals(entries, turnAt) {
    const uses = new Map();
    const own = new Map();
    const into = new Map();
    let buffer = [];
    let last = null;
    (entries || []).forEach((e, i) => {
        if (!e || e.isSidechain === true || !e.message || typeof e.message !== 'object') return;
        if (e.type === 'assistant') {
            const n = turnAt(i);
            if (n === null) return;
            if (n !== last) {
                into.set(n, buffer);
                buffer = [];
                last = n;
            }
            for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
                if (!b || b.type !== 'tool_use') continue;
                const u = { name: b.name, input: b.input && typeof b.input === 'object' ? b.input : {} };
                uses.set(b.id, u);
                if (!own.has(n)) own.set(n, []);
                own.get(n).push(u);
            }
            return;
        }
        if (e.type !== 'user') return;
        const note = usage.notificationOf(e);
        if (note) {
            buffer.push({ k: 'notification', label: 'task-notification', chars: note.chars });
            return;
        }
        // System text — a skill loaded, a reminder, hook output — is named by its
        // opening words: `system text 23,600` alone did not say which one.
        const said = (text) => ({ k: e.isMeta ? 'meta' : 'prompt',
            label: e.isMeta ? 'system text: ' + gist(text) : 'prompt', chars: text.length });
        const content = e.message.content;
        if (typeof content === 'string') {
            buffer.push(said(content));
            return;
        }
        for (const b of Array.isArray(content) ? content : []) {
            if (b && b.type === 'tool_result') {
                buffer.push({ k: 'tool', label: labelOf(uses.get(b.tool_use_id)), chars: usage.textOf(b.content).length });
            } else if (b && b.type === 'text' && typeof b.text === 'string') {
                buffer.push(said(b.text));
            }
        }
    });
    return { into, own };
}

// The five largest rises from one request to the next, each with its cause:
// what arrived between them, largest first, or — when the previous response's
// own output tokens are at least half the rise — the model's own output.
// Thinking is stored as a signature only, so it cannot be measured here.
function risesOf(series, into, own, max) {
    const ups = [];
    for (let n = 2; n <= (series || []).length; n++) {
        const dy = series[n - 1].context - series[n - 2].context;
        if (dy > 0) ups.push({ n, dy });
    }
    ups.sort((x, y) => y.dy - x.dy || x.n - y.n);
    return ups.slice(0, max || 5).map(({ n, dy }) => {
        const a = series[n - 2];
        const b = series[n - 1];
        const came = ((into && into.get(n)) || []).slice().sort((x, y) => y.chars - x.chars);
        const wrote = ((own && own.get(n - 1)) || []).slice()
            .sort((x, y) => JSON.stringify(y.input).length - JSON.stringify(x.input).length);
        const self = { tok: a.output, label: wrote.length ? '上一回應寫的 ' + labelOf(wrote[0]) : '上一回應的文字' };
        return {
            n, from: n - 1, t: b.at, y0: a.context, y1: b.context, dy,
            cause: self.tok * 2 >= dy ? 'self' : 'in',
            self, top: came.slice(0, 3), restN: Math.max(came.length - 3, 0),
            restChars: came.slice(3).reduce((s, x) => s + x.chars, 0),
            inChars: came.reduce((s, x) => s + x.chars, 0),
        };
    });
}

module.exports = {
    statements, taskCalls, stageCommands, stageSequence, backtracksOf, largestRemainder,
    contextPoints, arrivals, risesOf,
};
```


- [ ] **Step 4: Run it and watch it pass.**

```
node --test tests/detail.test.js
```

It prints `ℹ pass 8 ℹ fail 0`. Then the four checks, each run on its own and judged by its exit code, not through a pipe: `npm test`, `node scripts/docs-check.js`, `node scripts/todo-check.js`, `node scripts/skills-check.js` — all exit 0.

- [ ] **Step 5: Commit.**

```
git add lib/detail.js tests/detail.test.js
git commit -m "feat: lib/detail.js reads stage moves from task.js commands and names each context rise"
```


## Task 22: `lib/replay.js`: the session as a capped event list, and each agent's own steps

Design §7 (B4): one row per event in time order — the prompt's first 60 characters, stage moves, each gate's question and chosen answer, dispatches out and back, the files each turn edited (one row per turn), each commit's subject, each test run's `ℹ pass` and `ℹ fail` lines — capped at 300 rows, past which only gates, stages, commits and dispatches are kept and the drop is counted. Each dispatch opens into its own steps from its own transcript, capped too. A commit's subject is read from the `[branch sha]` line `git commit` prints or, after `git commit -q`, from the first `<sha> <subject>` line: on 2026-09-11 every commit in session 13ebea34 had the second shape and the bracket form alone found none.

**Files:**
- Modify: `lib/replay.js` — new file
- Read: `lib/usage.js` — `entriesOf`, `textOf`
- Test: `tests/replay.test.js`

**Interfaces:**
- Consumes: `entriesOf`, `textOf` from `lib/usage.js`; the row shape `stageCommands()` returns (`{ at, turn, verb, stage, text }`) and `dispatchesOf().dispatches`, both passed in by the caller
- Produces: `eventsOf(entries, { commands, dispatches, turnAt })` → `{ events, total, dropped }`, each event `{ t, kind, ... }` with `kind` one of `prompt`, `stage`, `gate`, `out`, `back`, `edit`, `commit`, `test`; `stepsOf(file, cap)` → `{ steps: [{ k, f, c, r, w }], total, dropped, droppedN }`; `MAX_EVENTS` (300)

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing test.** Create `tests/replay.test.js` with:

```js
'use strict';
// lib/replay.js: a session's events in time order, capped, and one agent's own
// steps, capped with edits and commands kept first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const replay = require('../lib/replay.js');
const usage = require('../lib/usage.js');
const tmp = require('./tmp.js');

const T = (ms) => new Date(Date.UTC(2026, 8, 11, 10) + ms).toISOString();
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const said = (rid, ms, content) => ({ type: 'assistant', requestId: rid, timestamp: T(ms),
    message: { model: 'claude-opus-5', usage: { input_tokens: 1 }, content } });
const result = (ms, id, text, meta) => ({ type: 'user', timestamp: T(ms), toolUseResult: meta,
    message: { content: [{ type: 'tool_result', tool_use_id: id, content: text }] } });

test('eventsOf: prompt, gate with its answer, one row per turn of edits, commit, test line, stage and dispatch, in time order', () => {
    const entries = [
        { type: 'user', timestamp: T(0), message: { content: '<command-message>fankeel</command-message>\n<command-name>/fankeel:fankeel</command-name>\n<command-args>fix the station</command-args>' } },
        said('r1', 1000, [use('q1', 'AskUserQuestion', { questions: [{ question: 'Which?', options: [{ label: 'A' }, { label: 'B' }] }] })]),
        result(2000, 'q1', 'answered', { answers: { 'Which?': 'my own' } }),
        said('r2', 3000, [use('e1', 'Edit', { file_path: 'x/y/lib/a.js' }), use('e2', 'Edit', { file_path: 'x/y/lib/a.js' }), use('e3', 'Write', { file_path: 'x/docs/b.md' })]),
        said('r3', 4000, [use('c1', 'Bash', { command: 'git add -A && git commit -q -m "x" && git log --oneline -1' })]),
        result(5000, 'c1', 'abc1234 fix: the thing'),
        said('r4', 6000, [use('c2', 'Bash', { command: 'npm test' })]),
        result(7000, 'c2', '✔ a\nℹ tests 3\nℹ pass 3\nℹ fail 0\n'),
        { type: 'user', isMeta: true, timestamp: T(7500), message: { content: 'a system note' } },
    ];
    const commands = [{ at: Date.parse(T(8000)), turn: 5, verb: 'stage', stage: 'verify', text: 'fankeel — build to verify' }];
    const dispatches = [{ out: Date.parse(T(9000)), back: Date.parse(T(12000)), turn: 5, surface: 'agent', text: 'Review', agentType: 'fankeel-reviewer', alias: null, ret: 500 }];
    const out = replay.eventsOf(entries, { commands, dispatches, turnAt: usage.turnIndex(entries) });
    assert.deepEqual(out.events.map((e) => e.kind), ['prompt', 'gate', 'edit', 'commit', 'test', 'stage', 'out', 'back']);
    const [prompt, gate, edit, commit, tested, , sent, back] = out.events;
    assert.deepEqual([prompt.text, prompt.cmd], ['fix the station', '/fankeel:fankeel']);
    assert.deepEqual(gate.qs, [{ q: 'Which?', a: 'my own', own: true }]);
    assert.equal(gate.askedAt, Date.parse(T(1000)));
    assert.deepEqual(edit.files, [{ f: 'y/lib/a.js', n: 2 }, { f: 'x/docs/b.md', n: 1 }]);
    assert.deepEqual([commit.sha, commit.text], ['abc1234', 'fix: the thing']);
    assert.equal(tested.text, 'ℹ pass 3 · ℹ fail 0');
    assert.deepEqual([sent.disp, back.disp, back.ret], [0, 0, 500]);
    assert.deepEqual([out.total, out.dropped], [8, 0]);
});

test('a commit that prints its own [branch sha] line is read from there', () => {
    const entries = [
        said('r1', 0, [use('c1', 'Bash', { command: 'git commit -m "x"' })]),
        result(1000, 'c1', '[main 1a2b3c4] feat: bracket form\n 1 file changed'),
    ];
    const out = replay.eventsOf(entries, { turnAt: usage.turnIndex(entries) });
    assert.deepEqual(out.events.map((e) => [e.kind, e.sha, e.text]), [['commit', '1a2b3c4', 'feat: bracket form']]);
});

test('past the cap only gates, stages, commits and dispatches are kept, and the rest is counted', () => {
    const entries = [];
    for (let i = 0; i < 400; i++) entries.push(said('r' + i, i * 10, [use('e' + i, 'Edit', { file_path: 'f' + i })]));
    entries.push(said('rq', 5000, [use('q', 'AskUserQuestion', { questions: [{ question: 'Go?', options: [{ label: 'yes' }] }] })]));
    entries.push(result(5001, 'q', 'ok', { answers: { 'Go?': 'yes' } }));
    const out = replay.eventsOf(entries, { turnAt: usage.turnIndex(entries) });
    assert.equal(out.total, 401);
    assert.deepEqual(out.events.map((e) => e.kind), ['gate']);
    assert.equal(out.dropped, 400);
    assert.equal(out.events[0].qs[0].own, false);
    assert.equal(replay.MAX_EVENTS, 300);
});

test('stepsOf keeps edits and commands before reads and searches, and counts what the cap dropped', () => {
    const file = path.join(tmp('fankeel-steps-'), 'agent-abc.jsonl');
    const line = (o) => JSON.stringify(o) + '\n';
    fs.writeFileSync(file, [
        said('a1', 0, [use('s1', 'Read', { file_path: 'r/lib/x.js' })]),
        said('a2', 1, [use('s2', 'Grep', { pattern: 'foo' })]),
        said('a3', 2, [use('s3', 'Bash', { command: 'npm test' })]),
        result(3, 's3', '\nℹ pass 1\nℹ fail 0'),
        said('a4', 4, [use('s4', 'Write', { file_path: 'r/lib/y.js' })]),
        said('a5', 5, [use('s5', 'Skill', { skill: 'x' })]),
    ].map((o) => line(Object.assign({ isSidechain: true }, o))).join(''));
    const out = replay.stepsOf(file, 3);
    assert.deepEqual(out.steps, [
        { k: 'read', f: 'r/lib/x.js' },
        { k: 'cmd', c: 'npm test', r: 'ℹ pass 1' },
        { k: 'edit', f: 'r/lib/y.js', w: true },
    ]);
    assert.deepEqual(out.total, { read: 1, find: 1, cmd: 1, edit: 1, other: 1 });
    assert.deepEqual(out.dropped, { find: 1, other: 1 });
    assert.equal(out.droppedN, 2);
    assert.equal(replay.stepsOf(file).steps.length, 5);
});
```

- [ ] **Step 2: Run it and watch it fail.**

```
node --test tests/replay.test.js
```

It prints `ℹ pass 0 ℹ fail 1`, the first failures reading `Error: Cannot find module '../lib/replay.js'`.

- [ ] **Step 3: Write the implementation.**

Create `lib/replay.js` with:

```js
'use strict';
// What a session did, one line per event, for the station's 過程還原: the
// prompts, the stage moves, the gates and what was chosen at them, every
// dispatch out and back, the files each turn edited, the commits and the test
// results. Read out of the session's own transcript, and for a dispatch, out of
// that agent's own transcript — so the replay needs nothing the transcript
// does not already hold, and the transcript itself need not be opened.
const usage = require('./usage.js');

// Past this many rows only the rows a review turns on are kept — the gates,
// the stage moves, the commits and the dispatches — and the page says how many
// were dropped rather than scrolling for ever.
const MAX_EVENTS = 300;
const KEEP = new Set(['gate', 'stage', 'commit', 'out', 'back']);
const MAX_STEPS = 40;

const EDITS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
// `git commit` prints `[branch sha] subject` on its first line; reading the
// subject from there, rather than out of `-m "..."`, is what keeps a heredoc
// or a quoted message from having to be parsed at all.
const COMMIT = /^\[[^\]\n]*?\s([0-9a-f]{7,40})\]\s+(.+)$/m;
// `git commit -q` prints nothing, and this repository's sessions follow it with
// `git log --oneline -1`: the first `<sha> <subject>` line is then the commit.
// Measured 2026-09-11: every commit in session 13ebea34 had this shape, and the
// bracket form alone found none of them.
const ONELINE = /^([0-9a-f]{7,40}) (\S.*)$/m;
// The spec reporter's two summary lines; `ok` lines it never prints.
const TEST = /^ℹ (pass|fail) (\d+)\s*$/gm;

const clip = (s, n) => {
    const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const tail = (p) => String(p || '').split(/[\\/]/).filter(Boolean).slice(-3).join('/');
const when = (ev) => (Number.isFinite(ev.t) ? ev.t : Number.MAX_SAFE_INTEGER);

// A person typing, not a tool result, a notification or a system message. A
// slash command's own arguments are the prompt; with none, its name is.
function promptOf(e) {
    if (e.isMeta === true || (e.origin && e.origin.kind === 'task-notification')) return null;
    const c = e.message && e.message.content;
    let text = null;
    if (typeof c === 'string') text = c;
    else if (Array.isArray(c) && !c.some((b) => b && b.type === 'tool_result')) {
        text = c.map((b) => (b && b.type === 'text' && typeof b.text === 'string' ? b.text : '')).join(' ');
    }
    if (!text || !text.trim()) return null;
    if (/^\s*<(local-command|system-reminder|task-notification)/.test(text) || /^\s*Caveat:/.test(text)) return null;
    const cmd = /<command-name>([^<]*)<\/command-name>/.exec(text);
    const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(text);
    if (cmd) text = (args && args[1].trim()) || cmd[1];
    return { text: clip(text.replace(/<[^>]+>/g, ' '), 60), cmd: cmd ? cmd[1].trim() : null };
}

function answerOf(a) {
    if (Array.isArray(a)) return a.map(String).join(', ');
    return a === undefined || a === null ? null : String(a);
}

// `opts.commands` is `stageCommands()`'s list and `opts.dispatches` is
// `dispatchesOf().dispatches`; both are read here rather than found again, so a
// stage move and a dispatch are the same rows in the replay as on the rest of
// the panel. `opts.turnAt` is `usage.turnIndex(entries)`.
function eventsOf(entries, opts) {
    const commands = (opts && opts.commands) || [];
    const dispatches = (opts && opts.dispatches) || [];
    const turnAt = (opts && typeof opts.turnAt === 'function') ? opts.turnAt : () => null;
    const events = [];
    const asks = new Map();
    const commits = new Map();
    const edits = new Map();
    (entries || []).forEach((e, i) => {
        if (!e || e.isSidechain === true || !e.message || typeof e.message !== 'object') return;
        const at = Date.parse(e.timestamp);
        if (e.type === 'assistant') {
            const turn = turnAt(i);
            for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
                if (!b || b.type !== 'tool_use') continue;
                const input = b.input && typeof b.input === 'object' ? b.input : {};
                if (b.name === 'AskUserQuestion') {
                    asks.set(b.id, { at, turn, questions: Array.isArray(input.questions) ? input.questions : [] });
                } else if ((b.name === 'Bash' || b.name === 'PowerShell') && /\bgit\b[^\n]*\bcommit\b/.test(String(input.command || ''))) {
                    commits.set(b.id, turn);
                } else if (EDITS.has(b.name)) {
                    const f = tail(input.file_path || input.notebook_path);
                    if (!f) continue;
                    let ev = edits.get(turn);
                    if (!ev) {
                        ev = { t: at, kind: 'edit', turn, files: [] };
                        edits.set(turn, ev);
                        events.push(ev);
                    }
                    const hit = ev.files.find((x) => x.f === f);
                    if (hit) hit.n += 1;
                    else ev.files.push({ f, n: 1 });
                }
            }
            return;
        }
        if (e.type !== 'user') return;
        const p = promptOf(e);
        if (p) {
            events.push({ t: at, kind: 'prompt', text: p.text, cmd: p.cmd });
            return;
        }
        for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
            if (!b || b.type !== 'tool_result') continue;
            const text = usage.textOf(b.content);
            if (asks.has(b.tool_use_id)) {
                const ask = asks.get(b.tool_use_id);
                const answers = e.toolUseResult && e.toolUseResult.answers && typeof e.toolUseResult.answers === 'object'
                    ? e.toolUseResult.answers : {};
                events.push({
                    t: at, kind: 'gate', turn: ask.turn, askedAt: ask.at,
                    qs: ask.questions.map((q) => {
                        const a = answerOf(answers[q.question]);
                        const labels = (Array.isArray(q.options) ? q.options : []).map((o) => o && o.label);
                        return { q: clip(q.question, 120), a: a === null ? null : clip(a, 120), own: a !== null && !labels.includes(a) };
                    }),
                });
            }
            if (commits.has(b.tool_use_id)) {
                const m = COMMIT.exec(text) || ONELINE.exec(text);
                if (m) events.push({ t: at, kind: 'commit', turn: commits.get(b.tool_use_id), sha: m[1].slice(0, 7), text: clip(m[2], 100) });
            }
            let pass = null;
            let fail = null;
            TEST.lastIndex = 0;
            let m;
            while ((m = TEST.exec(text)) !== null) {
                if (m[1] === 'pass') pass = Number(m[2]);
                else fail = Number(m[2]);
            }
            if (pass !== null || fail !== null) {
                events.push({ t: at, kind: 'test', text: 'ℹ pass ' + (pass === null ? '?' : pass) + ' · ℹ fail ' + (fail === null ? '?' : fail) });
            }
        }
    });
    for (const c of commands) {
        events.push({ t: c.at, kind: 'stage', turn: c.turn, verb: c.verb, stage: c.stage, text: c.text });
    }
    dispatches.forEach((d, i) => {
        events.push({ t: d.out, kind: 'out', disp: i, turn: d.turn, surface: d.surface, text: d.text, agentType: d.agentType, alias: d.alias });
        if (Number.isFinite(d.back)) events.push({ t: d.back, kind: 'back', disp: i, ret: d.ret, text: d.text });
    });
    events.sort((a, b) => when(a) - when(b));
    const total = events.length;
    let kept = events;
    if (kept.length > MAX_EVENTS) kept = kept.filter((ev) => KEEP.has(ev.kind));
    if (kept.length > MAX_EVENTS) kept = kept.slice(0, MAX_EVENTS);
    return { events: kept, total, dropped: total - kept.length };
}

const kindOf = (name) => (name === 'Read' ? 'read'
    : EDITS.has(name) ? 'edit'
        : name === 'Bash' || name === 'PowerShell' ? 'cmd'
            : name === 'Grep' || name === 'Glob' ? 'find' : 'other');
const PRIORITY = { edit: 0, cmd: 1, read: 2, find: 3, other: 4 };

// One agent's own steps, from its own transcript: what it read, what it
// edited, which commands it ran and the first line each printed. Capped, and
// the cap drops reads and searches before it drops an edit or a command —
// those are what a review of a dispatch turns on.
function stepsOf(file, cap) {
    const max = Number.isFinite(cap) ? cap : MAX_STEPS;
    const all = [];
    const byId = new Map();
    for (const e of usage.entriesOf(file) || []) {
        if (!e.message || !Array.isArray(e.message.content)) continue;
        for (const b of e.message.content) {
            if (!b) continue;
            if (e.type === 'assistant' && b.type === 'tool_use') {
                const input = b.input && typeof b.input === 'object' ? b.input : {};
                const s = { k: kindOf(b.name) };
                if (s.k === 'read' || s.k === 'edit') {
                    s.f = tail(input.file_path || input.notebook_path);
                    if (b.name === 'Write') s.w = true;
                } else if (s.k === 'cmd') s.c = clip(input.command, 90);
                else if (s.k === 'find') s.c = clip(b.name + ' ' + (input.pattern || ''), 90);
                else s.c = String(b.name);
                byId.set(b.id, s);
                all.push(s);
            } else if (e.type === 'user' && b.type === 'tool_result' && byId.has(b.tool_use_id)) {
                const s = byId.get(b.tool_use_id);
                if (s.k === 'cmd') s.r = clip(usage.textOf(b.content).split('\n').find((l) => l.trim()) || '', 60);
            }
        }
    }
    const total = {};
    for (const s of all) total[s.k] = (total[s.k] || 0) + 1;
    const keep = new Set(all.map((s, i) => [s.k, i])
        .sort((a, b) => PRIORITY[a[0]] - PRIORITY[b[0]] || a[1] - b[1])
        .slice(0, max).map((x) => x[1]));
    const dropped = {};
    all.forEach((s, i) => { if (!keep.has(i)) dropped[s.k] = (dropped[s.k] || 0) + 1; });
    return { steps: all.filter((s, i) => keep.has(i)), total, dropped, droppedN: all.length - keep.size };
}

module.exports = { MAX_EVENTS, eventsOf, stepsOf };
```


- [ ] **Step 4: Run it and watch it pass.**

```
node --test tests/replay.test.js
```

It prints `ℹ pass 4 ℹ fail 0`. Then the four checks, each run on its own and judged by its exit code, not through a pipe: `npm test`, `node scripts/docs-check.js`, `node scripts/todo-check.js`, `node scripts/skills-check.js` — all exit 0.

- [ ] **Step 5: Commit.**

```
git add lib/replay.js tests/replay.test.js
git commit -m "feat: lib/replay.js turns a transcript into a capped event list and agent steps"
```


## Task 23: `tasksOf()`: the claimed plan, its ledger status, its dispatch groups and the parallel hint

Design §7 (B2): a claimed `docs/plans/<stem>.md` (not `-design`) maps to `.fankeel/build/<stem>/progress.md`, parsed by `lib/ledger.js`, titles from `lib/plantasks.js`; an unfinished task has no `Task` line, so rows come from the plan and read `no ledger line`, not a guess (`2026-09-11-ready-ten` has none at all). A dispatch is tied to a task by `task N` in its label and nothing else; the rest are listed. A group `plantasks` would send together that went out over more than one turn is the `could have gone in one response` hint.

**Files:**
- Modify: `lib/detail.js` — `tasksOf` and its requires
- Read: `lib/ledger.js` — `ledgerPath`, `completions`
- Read: `lib/plantasks.js` — `parseTasks`, `surfaces`
- Read: `lib/registry.js` — `claimsOf`
- Test: `tests/detail-tasks.test.js`

**Interfaces:**
- Consumes: `claimsOf` from `lib/registry.js`; `ledgerPath`, `completions` from `lib/ledger.js`; `parseTasks`, `surfaces` from `lib/plantasks.js`
- Produces: `tasksOf(root, data, rows)` → `[{ plan, ledgerLines, tasks: [{ n, title, status, range, turns }], groups: [{ g, tasks, surface, turns, hint }], unmatched }]` — `status` `complete` | `no ledger line`; `hint` true when a group of two or more went out over more than one turn

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing test.** Create `tests/detail-tasks.test.js` with:

```js
'use strict';
// tasksOf: the plan a session claimed, its tasks with what the ledger says of
// each, the groups plantasks would dispatch them in, and the parallel hint.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const task = (n, name, file) => [
    '## Task ' + n + ': ' + name, '', '**Files:**', '- Modify: `' + file + '`', '',
    '**Interfaces:**', '- Consumes: none', '- Produces: none', '',
].join('\n');

function repo() {
    const root = tmp('fankeel-tasks-');
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'plans', '2026-09-11-x.md'),
        '# X Implementation Plan\n\n' + task(1, 'one', 'a.js') + task(2, 'two', 'b.js') + task(3, 'three', 'a.js'));
    fs.mkdirSync(path.join(root, '.fankeel', 'build', '2026-09-11-x'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'build', '2026-09-11-x', 'progress.md'),
        '# fankeel build ledger — plan: docs/plans/2026-09-11-x.md\nTask 1: complete [abc1234..def5678] — done\n');
    return root;
}

test('tasks come from the plan, status from the ledger, groups from plantasks; two dispatch turns in one group is the hint', () => {
    const root = repo();
    const data = { claims: ['docs/plans/2026-09-11-x.md', 'docs/plans/2026-09-11-x-design.md', 'lib/a.js'] };
    const rows = [
        { id: 'a1', label: 'Task 1: one', turn: 4 },
        { id: 'a2', label: 'implement task 2', turn: 6 },
        { id: 'a3', label: 'Plan reviewer', turn: 2 },
    ];
    assert.deepEqual(detail.tasksOf(root, data, rows), [{
        plan: 'docs/plans/2026-09-11-x.md',
        ledgerLines: 1,
        tasks: [
            { n: 1, title: 'one', status: 'complete', range: 'abc1234..def5678', turns: [4] },
            { n: 2, title: 'two', status: 'no ledger line', range: null, turns: [6] },
            { n: 3, title: 'three', status: 'no ledger line', range: null, turns: [] },
        ],
        groups: [
            { g: 1, tasks: [1, 2], surface: 'agents', turns: [4, 6], hint: true },
            { g: 2, tasks: [3], surface: 'agent', turns: [], hint: false },
        ],
        unmatched: ['Plan reviewer'],
    }]);
});

test('one group sent in one turn carries no hint; no plan claimed, or a plan not on disk, is no task list', () => {
    const root = repo();
    const data = { claims: ['docs/plans/2026-09-11-x.md'] };
    const same = detail.tasksOf(root, data, [{ id: 'a', label: 'task 1', turn: 3 }, { id: 'b', label: 'task 2', turn: 3 }]);
    assert.equal(same[0].groups[0].hint, false);
    assert.deepEqual(detail.tasksOf(root, { claims: ['lib/a.js'] }, []), []);
    assert.deepEqual(detail.tasksOf(root, { claims: ['docs/plans/2026-09-11-gone.md'] }, []), []);
});
```

- [ ] **Step 2: Run it and watch it fail.**

```
node --test tests/detail-tasks.test.js
```

It prints `ℹ pass 0 ℹ fail 2`, the first failures reading `TypeError: detail.tasksOf is not a function`.

- [ ] **Step 3: Write the implementation.**

In `lib/detail.js`, replace:

```js
const usage = require('./usage.js');
const registry = require('./registry.js');
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/detail.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const usage = require('./usage.js');
const registry = require('./registry.js');
const ledger = require('./ledger.js');
const plantasks = require('./plantasks.js');
```

In `lib/detail.js`, replace:

```js
module.exports = {
    statements, taskCalls, stageCommands, stageSequence, backtracksOf, largestRemainder,
    contextPoints, arrivals, risesOf,
};
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/detail.js`:

```js
// ---- tasks -----------------------------------------------------------------

const PLAN = /(^|[\\/])docs[\\/]plans[\\/][^\\/]+\.md$/;
const TASK_REF = /\btask\s+(\d+)\b/i;

function readText(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
}

// The plan this session built from, per plan it claimed: its tasks with what
// the ledger says of each, the groups `plantasks` would dispatch them in, and
// the parallel hint. A task unfinished has no `Task` line in the ledger, so
// the rows come from the plan and such a task reads `no ledger line` rather
// than a guess. A dispatch is tied to a task by `task N` in its label and by
// nothing else; the ones that name no task are listed, not guessed at.
function tasksOf(root, data, rows) {
    const out = [];
    const claims = registry.claimsOf(data).filter((c) => PLAN.test(c) && !/-design\.md$/.test(c));
    for (const claim of claims) {
        const candidates = [path.resolve(root, claim)];
        if (data && data.project) candidates.push(path.resolve(root, data.project, claim));
        const planFile = candidates.find((f) => fs.existsSync(f));
        if (!planFile) continue;
        const tasks = plantasks.parseTasks(readText(planFile) || '');
        if (!tasks.length) continue;
        const lines = ledger.completions(readText(ledger.ledgerPath(root, claim)) || '');
        const done = new Map(lines.map((c) => [c.n, c]));
        const turns = new Map();
        const unmatched = new Set();
        for (const r of rows || []) {
            const m = TASK_REF.exec(r.label || '');
            const n = m ? Number(m[1]) : null;
            if (n === null || !tasks.some((t) => t.n === n)) {
                unmatched.add(r.label || r.id);
                continue;
            }
            if (!turns.has(n)) turns.set(n, new Set());
            if (Number.isFinite(r.turn)) turns.get(n).add(r.turn);
        }
        const sorted = (set) => [...(set || [])].sort((a, b) => a - b);
        out.push({
            plan: claim,
            ledgerLines: lines.length,
            tasks: tasks.map((t) => ({
                n: t.n, title: t.name,
                status: done.has(t.n) ? 'complete' : 'no ledger line',
                range: done.has(t.n) ? done.get(t.n).range : null,
                turns: sorted(turns.get(t.n)),
            })),
            groups: plantasks.surfaces(tasks).map((g, i) => {
                const seen = new Set();
                for (const n of g.tasks) for (const t of turns.get(n) || []) seen.add(t);
                return { g: i + 1, tasks: g.tasks, surface: g.surface, turns: sorted(seen), hint: g.tasks.length > 1 && seen.size > 1 };
            }),
            unmatched: [...unmatched],
        });
    }
    return out;
}

module.exports = {
    statements, taskCalls, stageCommands, stageSequence, backtracksOf, largestRemainder,
    contextPoints, arrivals, risesOf, tasksOf,
};
```


- [ ] **Step 4: Run it and watch it pass.**

```
node --test tests/detail-tasks.test.js tests/detail.test.js
```

It prints `ℹ pass 10 ℹ fail 0`. Then the four checks, each run on its own and judged by its exit code, not through a pipe: `npm test`, `node scripts/docs-check.js`, `node scripts/todo-check.js`, `node scripts/skills-check.js` — all exit 0.

- [ ] **Step 5: Commit.**

```
git add lib/detail.js tests/detail-tasks.test.js
git commit -m "feat: tasksOf ties a session's plan, ledger and dispatch groups together"
```


## Task 24: `detailOf()`: one session's detail assembled, priced, rounded and cached

Design §7: the extraction is cached at `<configDir>/fankeel/station/cache/<session>.json`, keyed on the size and mtime of the transcript and the agents' files, so only what changed is read again and an ended session is read once; the cache also saves the re-read `summarise()` does today. Design §11 adds `project`, `day`, `class`, `route`, `backtracks`, `usd` and `peak` to it so a later overview redesign need not read a transcript again. Every row's dollars, tokens and seconds are rounded by `largestRemainder` here, once, and `agentsTotal` is `agentsOf()`'s own independent sum, so the page can set the two against each other. Timed on the two real sessions: 543 and 516 ms per changed session.

**Files:**
- Modify: `lib/detail.js` — `cachePath`, `transcriptOf`, `keyOf`, `extract`, `detailOf` and their requires
- Read: `lib/usage.js` — `dispatchesOf`, `agentsOf`, `summarise`, `entriesOf`, `turnIndex`, `agentFiles`, `sessionDirOf`
- Read: `lib/replay.js` — `eventsOf`, `stepsOf`
- Read: `lib/prices.js` — `costOf`
- Read: `lib/stages.js` — `classForRoute`
- Test: `tests/detail-cache.test.js`

**Interfaces:**
- Consumes: `dispatchesOf`, `agentsOf`, `summarise`, `entriesOf`, `turnIndex`, `agentFiles`, `sessionDirOf` from `lib/usage.js`; `eventsOf`, `stepsOf` from `lib/replay.js`; `costOf` from `lib/prices.js`; `classForRoute` from `lib/stages.js`; `renameRetrying` from `lib/registry.js`
- Produces: `cachePath(configDir, sessionId)`; `transcriptOf(configDir, sessionId)` → `string | null`; `keyOf(transcript)` → `string`; `detailOf(configDir, sessionId, data, { reuse, now })` → `{ detail, fresh } | null`, `detail` carrying `v, sessionId, key, at, project, day, class, route, stage, model, requests, ownUsd, agentUsd, usd, unpriced, points, noTime, peak, peakN, rises, marks, seq, seqSource, backs, backtracks, dispatches, rows, runs, agentCents, agentKtok, agentSecs, agentsTotal: { cents, tokens, wallMs, agents }, events, evTotal, dropped, steps`; each row gains `usd`, `unpriced`, `c` (cents), `k` (thousands of tokens), `s` (seconds)

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing test.** Create `tests/detail-cache.test.js` with:

```js
'use strict';
// detailOf: one session's detail, cached under <configDir>/fankeel/station/cache/
// and keyed on the size and mtime of the transcript and its agents' files.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const SID = '11111111-2222-4333-8444-555555555555';
const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const said = (rid, s, context, content) => line({ type: 'assistant', requestId: rid, timestamp: T(s),
    message: { model: 'claude-sonnet-5', usage: { input_tokens: context, output_tokens: 10 }, content: content || [] } });

function setup() {
    const cfg = tmp('fankeel-detail-cache-');
    const dir = path.join(cfg, 'projects', 'F--some-project');
    fs.mkdirSync(dir, { recursive: true });
    const t = path.join(dir, SID + '.jsonl');
    fs.writeFileSync(t, said('r1', 1, 1000, [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'node scripts/task.js start --task x' } }])
        + line({ type: 'user', timestamp: T(2), message: { content: [{ type: 'tool_result', tool_use_id: 'b1', content: 'fankeel — started' }] } })
        + said('r2', 3, 5000));
    const data = { route: ['survey', 'build'], stage: 'survey', started: '2026-09-11T10:00:00.000Z', project: 'p', claims: [] };
    return { cfg, t, data };
}

test('transcriptOf finds the session under any project directory, and nothing is null', () => {
    const f = setup();
    assert.equal(detail.transcriptOf(f.cfg, SID), f.t);
    assert.equal(detail.transcriptOf(f.cfg, 'nobody'), null);
    assert.equal(detail.detailOf(f.cfg, 'nobody', {}), null);
});

test('the first read is fresh and cached; an unchanged set of files is not read again; a grown transcript is', () => {
    const f = setup();
    const first = detail.detailOf(f.cfg, SID, f.data, { now: 1000 });
    assert.equal(first.fresh, true);
    assert.ok(fs.existsSync(detail.cachePath(f.cfg, SID)));
    const d = first.detail;
    assert.deepEqual([d.requests, d.points.length + d.noTime, d.peak, d.peakN], [2, 2, 5000, 2]);
    assert.deepEqual([d.project, d.day, d.class, d.backtracks, d.seqSource], ['p', '2026-09-11', 'spike', 0, 'task.js']);
    assert.deepEqual(d.marks.map((m) => [m.kind, m.stage]), [['start', 'survey']]);
    assert.equal(d.usd, d.ownUsd + d.agentUsd);
    assert.equal(detail.detailOf(f.cfg, SID, f.data).fresh, false);
    const key = detail.keyOf(f.t);
    fs.appendFileSync(f.t, said('r3', 4, 6000));
    assert.notEqual(detail.keyOf(f.t), key, 'the key moves when the transcript grows');
    const grown = detail.detailOf(f.cfg, SID, f.data);
    assert.deepEqual([grown.fresh, grown.detail.requests], [true, 3]);
});

test('an ended session cached after it ended is not stat-ed again; reuse returns the cache without reading', () => {
    const f = setup();
    detail.detailOf(f.cfg, SID, f.data, { now: Date.parse(T(30)) });
    fs.appendFileSync(f.t, said('r3', 4, 6000));
    const ended = Object.assign({}, f.data, { ended: { at: T(20), reason: 'exit' } });
    const kept = detail.detailOf(f.cfg, SID, ended);
    assert.deepEqual([kept.fresh, kept.detail.requests], [false, 2]);
    assert.deepEqual([detail.detailOf(f.cfg, SID, f.data, { reuse: true }).fresh, detail.detailOf(f.cfg, 'nobody', {}, { reuse: true })], [false, null]);
    const later = Object.assign({}, f.data, { ended: { at: T(40), reason: 'exit' } });
    assert.equal(detail.detailOf(f.cfg, SID, later).fresh, true, 'a session that ended after its cache was written is read once more');
});
```

- [ ] **Step 2: Run it and watch it fail.**

```
node --test tests/detail-cache.test.js
```

It prints `ℹ pass 0 ℹ fail 3`, the first failures reading `TypeError: detail.transcriptOf is not a function` and `TypeError: detail.detailOf is not a function`.

- [ ] **Step 3: Write the implementation.**

In `lib/detail.js`, replace:

```js
const fs = require('node:fs');
const path = require('node:path');
const usage = require('./usage.js');
const registry = require('./registry.js');
const ledger = require('./ledger.js');
const plantasks = require('./plantasks.js');
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/detail.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const usage = require('./usage.js');
const prices = require('./prices.js');
const registry = require('./registry.js');
const ledger = require('./ledger.js');
const plantasks = require('./plantasks.js');
const replay = require('./replay.js');
const { classForRoute } = require('./stages.js');
```

In `lib/detail.js`, replace:

```js
module.exports = {
    statements, taskCalls, stageCommands, stageSequence, backtracksOf, largestRemainder,
    contextPoints, arrivals, risesOf, tasksOf,
};
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/detail.js`:

```js
// ---- the cache -------------------------------------------------------------

const VERSION = 1;

function cachePath(configDir, sessionId) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'station', 'cache', sessionId + '.json');
}

// Claude Code files a transcript as `projects/<slug>/<session>.jsonl`, and the
// slug is the launch directory — which the entry does not record and which need
// not be the registry's root. So every project directory is asked for this one
// file name.
function transcriptOf(configDir, sessionId) {
    const base = path.join(String(configDir == null ? '' : configDir), 'projects');
    let dirs;
    try {
        dirs = fs.readdirSync(base);
    } catch (e) {
        return null;
    }
    for (const d of dirs) {
        const file = path.join(base, d, sessionId + '.jsonl');
        try {
            if (fs.statSync(file).isFile()) return file;
        } catch (e) { /* not this project */ }
    }
    return null;
}

// The size and mtime of the transcript, every agent file and every run file,
// summed and maxed. A directory's own mtime does not move when a file inside
// it grows, so the files are what is stat-ed.
function keyOf(transcript) {
    const dir = usage.sessionDirOf(transcript);
    const files = [transcript].concat(dir ? usage.agentFiles(dir) : []);
    try {
        for (const n of fs.readdirSync(path.join(dir, 'workflows'))) {
            if (n.endsWith('.json')) files.push(path.join(dir, 'workflows', n));
        }
    } catch (e) { /* no runs */ }
    let count = 0;
    let size = 0;
    let mtime = 0;
    for (const f of files) {
        try {
            const st = fs.statSync(f);
            count += 1;
            size += st.size;
            mtime = Math.max(mtime, st.mtimeMs);
        } catch (e) { /* gone between readdir and stat */ }
    }
    return count + ':' + size + ':' + Math.floor(mtime);
}

const FIVE = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];
const tokensIn = (models) => Object.values(models || {}).reduce((n, m) => n + FIVE.reduce((k, f) => k + (m[f] || 0), 0), 0);

function extract(transcript, sessionId, data) {
    const d = data || {};
    const entries = usage.entriesOf(transcript) || [];
    const turnAt = usage.turnIndex(entries);
    const seen = usage.summarise(transcript, { series: true });
    const series = seen ? seen.series : [];
    const { points, noTime } = contextPoints(series);
    const commands = stageCommands(entries, turnAt);
    const route = Array.isArray(d.route) ? d.route : [];
    const seq = stageSequence(commands, d);
    const backs = backtracksOf(seq, route);
    const { into, own } = arrivals(entries, turnAt);
    const found = usage.dispatchesOf(transcript) || { dispatches: [], rows: [], runs: [] };
    const steps = {};
    const unpriced = new Set();
    const rows = found.rows.map((r) => {
        const cost = prices.costOf(r.models);
        for (const id of cost.unpriced) unpriced.add(id);
        if (r.file) steps[r.id] = replay.stepsOf(r.file);
        const { file, models, ...rest } = r;
        return Object.assign(rest, { usd: cost.priced.length ? cost.usd : 0, unpriced: cost.unpriced });
    });
    const cents = largestRemainder(rows.map((r) => r.usd), 0.01);
    const ktok = largestRemainder(rows.map((r) => r.tokens), 1000);
    const secs = largestRemainder(rows.map((r) => r.durMs), 1000);
    rows.forEach((r, i) => {
        r.c = cents[i];
        r.k = ktok[i];
        r.s = secs[i];
    });
    const ownCost = seen ? prices.costOf(seen.usage.models) : { usd: 0, priced: [], unpriced: [] };
    for (const id of ownCost.unpriced) unpriced.add(id);
    const agents = usage.agentsOf(transcript);
    const replayed = replay.eventsOf(entries, { commands, dispatches: found.dispatches, turnAt });
    let peak = null;
    for (const p of points) if (!peak || p.y > peak.y) peak = p;
    const agentUsd = rows.reduce((n, r) => n + r.usd, 0);
    const ownUsd = ownCost.priced.length ? ownCost.usd : 0;
    return {
        v: VERSION, sessionId,
        project: typeof d.project === 'string' ? d.project : '',
        day: typeof d.started === 'string' ? d.started.slice(0, 10) : null,
        class: typeof d.class === 'string' && d.class ? d.class : classForRoute(route),
        route, stage: typeof d.stage === 'string' ? d.stage : '',
        model: seen ? seen.model : null,
        requests: seen ? seen.usage.requests : 0,
        ownUsd, agentUsd, usd: ownUsd + agentUsd, unpriced: [...unpriced],
        points, noTime, peak: peak ? peak.y : 0, peakN: peak ? peak.n : null,
        rises: risesOf(series, into, own, 5),
        marks: commands.map((c) => ({ t: c.at, kind: c.verb, stage: c.stage, text: c.text, turn: c.turn }))
            .concat(seq.filter((s) => s.source !== 'cmd').map((s) => ({ t: s.at, kind: s.source, stage: s.stage, text: '', turn: null }))),
        seq, seqSource: seq.some((s) => s.source === 'cmd') ? 'task.js' : seq.length ? seq[0].source : null,
        backs, backtracks: backs.length,
        dispatches: found.dispatches, rows, runs: found.runs,
        agentCents: cents.reduce((a, b) => a + b, 0),
        agentKtok: ktok.reduce((a, b) => a + b, 0),
        agentSecs: secs.reduce((a, b) => a + b, 0),
        agentsTotal: agents
            ? { cents: Math.round(prices.costOf(agents.models).usd * 100), tokens: tokensIn(agents.models), wallMs: agents.wallMs, agents: agents.agents }
            : { cents: 0, tokens: 0, wallMs: 0, agents: 0 },
        events: replayed.events, evTotal: replayed.total, dropped: replayed.dropped,
        steps,
    };
}

// One session's detail and whether it was read just now. An ended session whose
// cache was written after it ended is returned without a stat; any other with
// a cache whose key still matches is returned without a read. `opts.reuse`
// asks for whatever is cached, stat-free — how `write()` spends no time on a
// session once its budget is gone. `opts.now` is a seam for the tests.
function detailOf(configDir, sessionId, data, opts) {
    const o = opts || {};
    const file = cachePath(configDir, sessionId);
    let old = null;
    try {
        old = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        old = null;
    }
    if (!old || old.v !== VERSION) old = null;
    if (o.reuse) return old ? { detail: old, fresh: false } : null;
    const endedAt = data && data.ended && typeof data.ended.at === 'string' ? Date.parse(data.ended.at) : NaN;
    if (old && Number.isFinite(endedAt) && old.at >= endedAt) return { detail: old, fresh: false };
    const transcript = transcriptOf(configDir, sessionId);
    if (!transcript) return old ? { detail: old, fresh: false } : null;
    const key = keyOf(transcript);
    if (old && old.key === key) return { detail: old, fresh: false };
    const detail = extract(transcript, sessionId, data);
    detail.key = key;
    detail.at = Number.isFinite(o.now) ? o.now : Date.now();
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const temp = file + '.' + process.pid + '.tmp';
        fs.writeFileSync(temp, JSON.stringify(detail));
        registry.renameRetrying(temp, file);
    } catch (e) { /* the page still gets this read; the next write repeats it */ }
    return { detail, fresh: true };
}

module.exports = {
    statements, taskCalls, stageCommands, stageSequence, backtracksOf, largestRemainder,
    contextPoints, arrivals, risesOf, tasksOf, cachePath, transcriptOf, keyOf, detailOf,
};
```


- [ ] **Step 4: Run it and watch it pass.**

```
node --test tests/detail-cache.test.js tests/detail-tasks.test.js tests/detail.test.js
```

It prints `ℹ pass 13 ℹ fail 0`. Then the four checks, each run on its own and judged by its exit code, not through a pipe: `npm test`, `node scripts/docs-check.js`, `node scripts/todo-check.js`, `node scripts/skills-check.js` — all exit 0.

- [ ] **Step 5: Commit.**

```
git add lib/detail.js tests/detail-cache.test.js
git commit -m "feat: detailOf assembles and caches one session's detail"
```


## Task 25: The station writes one detail script per session and serves it

The detail is kept out of `station-data.js`, which `hooks/inject.js` rewrites on every `/fankeel` prompt: measured on the two real sessions the detail scripts are 84 KB and 130 KB against a 6 KB data file. Only `hasDetail`, `peak`, `backtracks` and `class` ride in the data file, for the list and the overview. `write()` spends at most 1.5 s reading transcripts (the prompt hook has five seconds and a changed session costs about half of one); past that every session reuses its cache as it stands. The CLI passes `Infinity`, `serve` passes no budget, `--json` passes `details: false`. The registry copy's `station/` is already ignored by `ensureIgnored(root, ['index.html', 'station/'])`, and the lifetime table in `docs/documents.md` already names `station/`, so neither changes. In a checkout whose `.fankeel/` holds no ignored path, `tests/docs.test.js`'s `the lifetime table names every ignored path under .fankeel/` fails before and after this task alike — it passes in the main checkout.

**Files:**
- Modify: `lib/station.js` — `gather()` reads each session's detail under a budget; `serialize()` carries four small fields; `serializeDetail`; `write()` emits `station/detail/<id>.js`; `EMITTED`
- Modify: `scripts/station.js` — `--json` asks for no detail, the default form for every changed session, `GET /station/detail/<id>.js`
- Modify: `docs/station.md` — the detail directory, the cache, the budget, `--json`; two `lib/station.js` citations
- Read: `lib/detail.js` — `detailOf`, `tasksOf`, `stageSequence`, `backtracksOf`
- Test: `tests/station-detail.test.js`

**Interfaces:**
- Consumes: `detailOf`, `tasksOf`, `stageSequence`, `backtracksOf` from `lib/detail.js`
- Produces: `serializeDetail(s)` → `'window.STATION_DETAIL = window.STATION_DETAIL || {};\nwindow.STATION_DETAIL["<id>"] = {...detail, tasks};\n'`; `gather()` session fields `class`, `detail`, `detailFresh`, `tasks`, `backtracks`, and options `details: false`, `detailBudgetMs`; `serialize()` session fields `class`, `backtracks`, `hasDetail`, `peak`; `EMITTED` gains a fifth name, the `detail` directory under `station/`; `GET /station/detail/<id>.js`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing test.** Create `tests/station-detail.test.js` with:

```js
'use strict';
// The station's per-session detail: read by lib/detail.js inside gather(),
// written by write() as one script per session beside the data file, and
// served by `serve` at the same path. The data file itself carries only the
// few numbers the list and the overview read.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'dddddddd-4444-4444-8444-444444444444';
const BARE = 'eeeeeeee-5555-4555-8555-555555555555';
const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';

// One ended session with a transcript and a verify-to-build step in its moves,
// and one with no transcript on this machine at all.
function fixture() {
    const base = tmp('fankeel-station-detail-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'projects', 'ws-slug'), { recursive: true });
    registry.ensureLayout(r1);
    const common = { stage: 'build', route: ['survey', 'build', 'verify'], active: false, claims: [],
        started: T(0), updated: T(9), configDir: cfg, ended: { at: T(9), reason: 'exit' },
        moves: [['survey', 1], ['build', 2], ['verify', 3], ['build', 4]] };
    registry.writeSession(r1, SID, Object.assign({ task: 'with a transcript' }, common));
    registry.writeSession(r1, BARE, Object.assign({ task: 'without one' }, common));
    fs.writeFileSync(path.join(cfg, 'projects', 'ws-slug', SID + '.jsonl'),
        line({ type: 'assistant', requestId: 'r1', timestamp: T(1), message: { model: 'claude-sonnet-5', usage: { input_tokens: 900 }, content: [] } })
        + line({ type: 'assistant', requestId: 'r2', timestamp: T(2), message: { model: 'claude-sonnet-5', usage: { input_tokens: 2000 }, content: [] } }));
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: T(0) }) + '\n');
    return { cfg, r1 };
}

const run = (js) => {
    const window = {};
    vm.runInNewContext(js, { window });
    return window;
};

test('write leaves a detail script for a session with a transcript, beside both copies, and keeps it out of the data file', () => {
    const f = fixture();
    station.write({ configDir: f.cfg, root: f.r1 });
    for (const into of [path.join(f.cfg, 'fankeel'), path.join(f.r1, '.fankeel')]) {
        const js = fs.readFileSync(path.join(into, 'station', 'detail', SID + '.js'), 'utf8');
        const d = run(js).STATION_DETAIL[SID];
        assert.deepEqual([d.requests, d.peak, d.backtracks, d.seqSource], [2, 2000, 1, 'moves']);
        assert.equal(JSON.stringify(d.tasks), '[]', 'no plan claimed, no task list');
        assert.ok(!fs.existsSync(path.join(into, 'station', 'detail', BARE + '.js')), 'no transcript, no script');
    }
    const data = fs.readFileSync(path.join(f.cfg, 'fankeel', 'station', 'station-data.js'), 'utf8');
    const rows = run(data).STATION.sessions;
    const has = rows.find((s) => s.id === SID);
    const bare = rows.find((s) => s.id === BARE);
    assert.deepEqual([has.hasDetail, has.backtracks, has.peak], [true, 1, 2000]);
    assert.deepEqual([bare.hasDetail, bare.backtracks, bare.peak], [false, 1, null], 'moves count the same step without a transcript');
    assert.ok(!data.includes('"points"'), 'the detail stays out of station-data.js');
});

test('details: false reads no transcript, and a spent budget reuses the cache rather than reading', () => {
    const f = fixture();
    const find = (m, id) => m.registries[0].sessions.find((s) => s.sessionId === id);
    assert.equal(find(station.gather({ configDir: f.cfg, details: false }), SID).detail, null);
    assert.equal(find(station.gather({ configDir: f.cfg, detailBudgetMs: -1 }), SID).detail, null, 'nothing cached yet, nothing read');
    assert.equal(find(station.gather({ configDir: f.cfg }), SID).detail.requests, 2);
    assert.equal(find(station.gather({ configDir: f.cfg, detailBudgetMs: -1 }), SID).detail.requests, 2, 'the cache is reused');
});

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
    }).on('error', reject);
});

test('serve answers a session\'s detail script, and 404 for a session with none', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const ok = await get(s.url + 'station/detail/' + SID + '.js');
        assert.equal(ok.status, 200);
        assert.equal(run(ok.text).STATION_DETAIL[SID].requests, 2);
        assert.equal((await get(s.url + 'station/detail/' + BARE + '.js')).status, 404);
    } finally {
        s.close();
    }
});
```

- [ ] **Step 2: Run it and watch it fail.**

```
node --test tests/station-detail.test.js
```

It prints `ℹ pass 0 ℹ fail 3`, the first failures reading `Error: ENOENT: no such file or directory, open '<tmp>\fankeel-station-detail-Ly8i43\cfg\fankeel\station\detail` and `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`.

- [ ] **Step 3: Write the implementation.**

In `lib/station.js`, replace:

```js
const profile = require('./profile.js');
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
const profile = require('./profile.js');
const detail = require('./detail.js');
```

In `lib/station.js`, replace:

```js
    const found = discover(opts);
    // One liveness scan per config dir this page needs, for the life of this call.
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
    const found = discover(opts);
    // How long this call may spend reading transcripts for the detail panel. A
    // changed session costs about half a second (measured 2026-09-11 on two
    // real sessions: 543 and 516 ms), and `hooks/inject.js` writes the page
    // inside a five-second hook — so `write()` hands a budget in, and every
    // session reached after it is spent reuses its cache as it stands. No
    // budget is no limit.
    const until = Number.isFinite(opts.detailBudgetMs) ? Date.now() + opts.detailBudgetMs : Infinity;
    // One liveness scan per config dir this page needs, for the life of this call.
```

In `lib/station.js`, replace:

```js
            const usage = data.usage && typeof data.usage === 'object' ? data.usage : null;
            sessions.push({
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
            const usage = data.usage && typeof data.usage === 'object' ? data.usage : null;
            // The panel's detail, read and cached by `lib/detail.js`. `--json`
            // asks for none: it prints rows, and a replay is not a row.
            const got = opts.details === false ? null
                : detail.detailOf(theirs, sessionId, data, { reuse: Date.now() > until });
            sessions.push({
```

In `lib/station.js`, replace:

```js
                guard: typeof data.guard === 'string' ? data.guard : '',
                configDir: theirs,
            });
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
                guard: typeof data.guard === 'string' ? data.guard : '',
                configDir: theirs,
                class: typeof data.class === 'string' && data.class ? data.class : null,
                detail: got ? got.detail : null,
                detailFresh: Boolean(got && got.fresh),
                tasks: detail.tasksOf(root, data, got ? got.detail.rows : []),
                // The detail's own sequence when there is a transcript, and the
                // entry's `moves` or clock when there is none — one
                // `stageSequence` either way, so the two cannot count apart.
                backtracks: got ? got.detail.backtracks
                    : detail.backtracksOf(detail.stageSequence([], data), data.route).length,
            });
```

In `lib/station.js`, replace:

```js
            claims: s.claims, notes: s.notes, next: s.next, guard: s.guard,
        })),
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
            claims: s.claims, notes: s.notes, next: s.next, guard: s.guard,
            class: s.class, backtracks: s.backtracks,
            hasDetail: Boolean(s.detail), peak: s.detail ? s.detail.peak : null,
        })),
```

In `lib/station.js`, replace:

```js
// `render` keeps its name and its two callers, and now returns the shell.
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
// One session's detail as the script the panel loads when that session is
// opened, `station/detail/<id>.js`. Kept out of `station-data.js`, which every
// `/fankeel` prompt rewrites: a hundred sessions' replays in it would be
// megabytes rewritten per prompt for the one panel open at a time. The tasks
// ride along uncached, because the ledger moves without the transcript.
function serializeDetail(s) {
    const body = Object.assign({}, s.detail, { tasks: s.tasks || [] });
    return 'window.STATION_DETAIL = window.STATION_DETAIL || {};\n'
        + 'window.STATION_DETAIL[' + JSON.stringify(s.sessionId) + '] = ' + JSON.stringify(body) + ';\n';
}

// `render` keeps its name and its two callers, and now returns the shell.
```

In `lib/station.js`, replace:

```js
// Four names, in one place, because `.gitignore` and the writer disagreeing is
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
// Five names — the last a directory — in one place, because `.gitignore` and the writer disagreeing is
```

In `lib/station.js`, replace:

```js
const EMITTED = ['index.html', 'station/station.css', 'station/station.js', 'station/station-data.js'];
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
const EMITTED = ['index.html', 'station/station.css', 'station/station.js', 'station/station-data.js', 'station/detail'];

// What one write spends on transcripts at most; see `until` in `gather()`. The
// CLI passes `Infinity`, and `serve` passes nothing: a person who typed a
// command can wait for it.
const DETAIL_BUDGET_MS = 1500;
```

In `lib/station.js`, replace:

```js
    const model = gather(Object.assign({}, opts, { now }));
    const html = render();
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
    const model = gather(Object.assign({ detailBudgetMs: DETAIL_BUDGET_MS }, opts, { now }));
    const html = render();
```

In `lib/station.js`, replace:

```js
        fs.writeFileSync(path.join(into, 'station', 'station-data.js'), data);
    };
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
        fs.writeFileSync(path.join(into, 'station', 'station-data.js'), data);
        // One script per session that has a detail, written when it was read
        // just now or is missing here — so an ended session's is written once.
        const details = path.join(into, 'station', 'detail');
        fs.mkdirSync(details, { recursive: true });
        for (const r of model.registries) {
            for (const s of r.sessions) {
                if (!s.detail) continue;
                const at = path.join(details, s.sessionId + '.js');
                if (s.detailFresh || !fs.existsSync(at)) fs.writeFileSync(at, serializeDetail(s));
            }
        }
    };
```

In `lib/station.js`, replace:

```js
module.exports = { discover, gather, render, serialize, write, scanRoots, readRoots, rootsPath, rememberRoots, EMITTED };
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
module.exports = { discover, gather, render, serialize, serializeDetail, write, scanRoots, readRoots, rootsPath, rememberRoots, EMITTED };
```

In `scripts/station.js`, replace:

```js
            deadline: scanDeadline(args.scan),
            root: registry.findStateRoot(process.cwd()),
        });
```

That text occurs exactly once in the file; replace it whole.

With, in `scripts/station.js`:

```js
            deadline: scanDeadline(args.scan),
            root: registry.findStateRoot(process.cwd()),
            // The rows, not the panel: a session's detail is a file of its own.
            details: false,
        });
```

In `scripts/station.js`, replace:

```js
        root: registry.findStateRoot(process.cwd()), plugin: PLUGIN,
    });
```

That text occurs exactly once in the file; replace it whole.

With, in `scripts/station.js`:

```js
        root: registry.findStateRoot(process.cwd()), plugin: PLUGIN,
        // Typed by a person, so every changed session is read, however long.
        detailBudgetMs: Infinity,
    });
```

In `scripts/station.js`, replace:

```js
        if (req.method === 'GET' && url.pathname === '/station/health') {
```

That text occurs exactly once in the file; replace it whole.

With, in `scripts/station.js`:

```js
        const wanted = /^\/station\/detail\/([0-9A-Za-z-]+)\.js$/.exec(url.pathname);
        if (req.method === 'GET' && wanted) {
            // One session's detail, the script `write()` leaves beside the
            // data file, rendered from this request's model rather than read
            // off disk.
            const hit = modelNow().registries.flatMap((r) => r.sessions).find((s) => s.sessionId === wanted[1]);
            if (!hit || !hit.detail) {
                res.writeHead(404, { 'content-type': 'text/plain' });
                res.end('no detail for that session\n');
                return;
            }
            res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
            res.end(station.serializeDetail(hit));
            return;
        }
        if (req.method === 'GET' && url.pathname === '/station/health') {
```

In `docs/station.md`, replace:

```md
The page is four files. `index.html` is a shell with no session data in it,
```

That text occurs exactly once in the file; replace it whole.

With, in `docs/station.md`:

```md
The page is four files and a directory. `index.html` is a shell with no session data in it,
```

In `docs/station.md`, replace:

```md
`write()` compares the three copied files before writing them, so a prompt that
changed nothing rewrites `station-data.js` alone. `hooks/inject.js` calls it on
every prompt, which is the reason that comparison is there.
```

That text occurs exactly once in the file; replace it whole.

With, in `docs/station.md`:

```md
`write()` compares the three copied files before writing them, so a prompt that
changed nothing rewrites `station-data.js` alone. `hooks/inject.js` calls it on
every prompt, which is the reason that comparison is there.

The directory is `station/detail/`: one file per session whose transcript is
under this machine's config directory, `station/detail/<id>.js`, holding that
session's detail panel. `station-data.js` carries only whether there is one,
the session's peak context and its count of backward steps, so the file every
prompt rewrites stays small. `lib/detail.js` reads the detail and caches it at
`<configDir>/fankeel/station/cache/<session>.json`, keyed on the size and mtime
of the transcript, its agents' files and its workflow run files: a session is
read again only when one of them changed, and one that has ended is read once.
A write spends at most a second and a half reading — the `/fankeel` prompt
writes the page inside a five-second hook, and a changed session costs about
half a second — and a session reached after that reuses its cache as it
stands. `node scripts/station.js` reads every changed session however long it
takes, and `serve` answers the same file at `GET /station/detail/<id>.js`.
Both the page and the cache sit where git does not look — the registry copy's
`station/` is ignored and the cache is under the config directory — so the
prompt fragments a replay quotes stay on this machine.
```

In `docs/station.md`, replace:

```md
`node scripts/station.js --json` is the same model as one JSON document on
stdout, and it writes nothing — no page, no `roots.json`, no first-run walk.
```

That text occurs exactly once in the file; replace it whole.

With, in `docs/station.md`:

```md
`node scripts/station.js --json` is the same model as one JSON document on
stdout, and it writes nothing — no page, no `roots.json`, no first-run walk.
It carries no session's detail either: it reads no transcript.
```


- [ ] **Step 4: Correct the citations the new lines moved.** `node scripts/docs-check.js` names them as `moved:`; with this plan's tasks landed in order the corrections are:

- In `docs/station.md`: `lib/station.js:384` → `lib/station.js:405`
- In `docs/station.md`: `lib/station.js:298` → `lib/station.js:310`

If another task landed in between and moved the same lines further, use the number docs-check prints instead. Then `node scripts/docs-check.js` exits 0.

- [ ] **Step 5: Run it and watch it pass.**

```
node --test tests/station-detail.test.js tests/station.test.js tests/station-cli.test.js tests/station-doc.test.js
```

It prints `ℹ pass 63 ℹ fail 0`. Then the four checks, each run on its own and judged by its exit code, not through a pipe: `npm test`, `node scripts/docs-check.js`, `node scripts/todo-check.js`, `node scripts/skills-check.js` — all exit 0.

- [ ] **Step 6: Commit.**

```
git add lib/station.js scripts/station.js docs/station.md tests/station-detail.test.js
git commit -m "feat: the station writes one detail script per session and serves it"
```


## Task 26: The detail panel opens by state and draws the context line, its rises and the stage order

Design §7 (A1, B1, B5): the panel's sections open by state — a live session on 摘要 and claims, an ended one on context and 派工, the replay always closed — laid out as the v3 mockup (`.fankeel/build/2026-09-11-backlog-all/mockup.html`). The context chart is one series (the 2026-09-08 rule), with stage lines at the commands' times, dispatch dots, the five rises numbered, and the tally `points + no time = requests`. No stage's own cost is added (`docs/station.md:129`). The helpers sit after `genText()` so the only lines they move are the export block's; the DOM half below `if (!doc) return;` is checked against the served page at verify — on 2026-09-11 this exact code, served over the two real sessions, opened 05de9a54 on context and 派工 with one line, five rises, one backtrack and every tally reading 一致.

**Files:**
- Modify: `assets/station/station.js` — `drawDetail()` in sections; `needDetail`, `openSections`, `lineChart`, `downsample`, `ctxSection`, `risesList`, `seqHtml`, `orderSection` and helpers
- Modify: `assets/station/station.css` — sections, the chart, the rises, the stage order
- Modify: `docs/station.md` — the opened-session section; six view-script citations
- Test: `tests/station-panel.test.js`

**Interfaces:**
- Consumes: `window.STATION_DETAIL[id]` and the serialized `hasDetail` from `lib/station.js`; the detail fields `points`, `noTime`, `requests`, `peak`, `peakN`, `marks`, `dispatches`, `rises`, `seq`, `backs`, `backtracks`, `seqSource`
- Produces: view exports `openSections(s)`, `niceStep(v)`, `downsample(points, max)`, `lineChart(points, { W, H, t0, t1, ymax, marks, dots, rises, elapsed, label })`, `comma(n)`, `riseText(rise)`, `ctxSection(s, x)`, `seqHtml(seq, backs, route, stage, active)`, `orderSection(s, x)`; internal `needDetail(s)`, `DETAIL`, `secOpen`, `sec`, `detailSections(s, x, open)`, `detailNote(s)`, `risesList(s, x)`, `backBlock(s, b)`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing test.** Create `tests/station-panel.test.js` with:

```js
'use strict';
// The detail panel's pure builders: which sections start open, the context
// line, its rises, and the stage order. The panel itself is DOM and is checked
// against the served page; every number and string it prints is decided here.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const count = (s, re) => (s.match(re) || []).length;

test('a live session opens on who and where, an ended one on what it cost, and neither opens the replay', () => {
    assert.deepEqual(V.openSections({ state: 'live' }), ['s-sum', 's-claims']);
    assert.deepEqual(V.openSections({ state: 'down' }), ['s-ctx', 's-disp']);
    assert.deepEqual(V.openSections({ state: 'stale' }), ['s-ctx', 's-disp']);
    for (const s of ['live', 'down', 'stale']) assert.ok(!V.openSections({ state: s }).includes('s-rp'));
});

test('downsample keeps at most max points, and the peak is one of them', () => {
    const pts = Array.from({ length: 1000 }, (_, i) => ({ n: i + 1, t: i, y: i === 777 ? 99999 : i % 50 }));
    const out = V.downsample(pts, 240);
    assert.equal(out.length, 240);
    assert.ok(out.some((p) => p.y === 99999));
    assert.equal(V.downsample(pts.slice(0, 10), 240).length, 10);
});

test('lineChart draws one line, a line per stage mark, a dot per dispatch out and back, a number per rise', () => {
    const svg = V.lineChart([{ n: 1, t: 0, y: 10 }, { n: 2, t: 10, y: 50 }, { n: 3, t: 20, y: 30 }], {
        t0: 0, t1: 20, ymax: 100,
        marks: [{ t: 0, kind: 'start', stage: 'survey' }, { t: 10, kind: 'stage', stage: 'build' }],
        dots: [{ t: 5, kind: 'out' }, { t: 15, kind: 'back' }],
        rises: [{ n: 2, t: 10, y1: 50 }],
    });
    assert.equal(count(svg, /class="ln"/g), 1, 'one series');
    assert.equal(count(svg, /class="bd /g), 2);
    assert.equal(count(svg, /class="dout"/g), 1);
    assert.equal(count(svg, /class="dback"/g), 1);
    assert.equal(count(svg, /<g class="rb">/g), 1);
    assert.equal(count(svg, /class="hit"/g), 3, 'every point carries its own reading');
});

const rise = { n: 2, from: 1, t: 10, y0: 10, y1: 5000, dy: 4990, cause: 'in', self: { tok: 3, label: '上一回應的文字' },
    top: [{ k: 'tool', label: 'Read a/b.md', chars: 4321 }], restN: 2, restChars: 15, inChars: 4336 };

test('riseText names an arrival by its characters and the model\'s own output by its tokens', () => {
    assert.equal(V.riseText(rise), 'Read a/b.md 4,321 字元；另 2 項 15 字元');
    assert.equal(V.riseText(Object.assign({}, rise, { cause: 'self', self: { tok: 12000, label: '上一回應寫的 Write x.md' } })),
        '上一回應寫的 Write x.md，輸出 12,000 tokens');
});

test('ctxSection prints the points and the no-time count against the requests, and lists the rises', () => {
    const x = { points: [{ n: 1, t: 0, y: 10 }, { n: 3, t: 10, y: 5000 }], noTime: 1, requests: 3, peak: 5000, peakN: 3,
        marks: [], dispatches: [{ out: 2, back: 8, text: 'Review' }], rises: [rise] };
    const html = V.ctxSection({ id: 'abcdef1234' }, x);
    assert.match(html, /折線 <b>2 點<\/b> ＋ 1 requests with no time ＝ 摘要的 3 requests <span class="eq">一致/);
    assert.match(html, /<ol class="rz"/);
    assert.equal(count(html, /<li>/g), 1);
    assert.match(V.ctxSection({ id: 'x' }, Object.assign({}, x, { requests: 4 })), /class="ne">不一致/);
});

test('seqHtml marks a backward step and dots a stage not taken from a command; orderSection names its source', () => {
    const seq = [{ stage: 'survey', at: 0, source: 'clock' }, { stage: 'build', at: 1, source: 'cmd' },
        { stage: 'verify', at: 2, source: 'cmd' }, { stage: 'build', at: 3, source: 'cmd' }];
    const backs = [{ i: 3, from: 'verify', to: 'build', at: 3, since: 2 }];
    const html = V.seqHtml(seq, backs, ['survey', 'build', 'verify', 'land'], 'build', true);
    assert.equal(count(html, /class="ar bk"/g), 1);
    assert.equal(count(html, /class="s fb"/g), 1);
    assert.equal(count(html, /class="s todo"/g), 2, 'a live session shows the stages still ahead');
    const order = V.orderSection({ id: 'x', route: ['survey', 'build', 'verify', 'land'], stage: 'land', state: 'down' },
        { seq, backs, backtracks: 1, seqSource: 'task.js' });
    assert.match(order, /transcript 裡真正執行的 task\.js 指令；倒退 1 次/);
    assert.equal(count(order, /class="bkl"/g), 1);
});
```

- [ ] **Step 2: Run it and watch it fail.**

```
node --test tests/station-panel.test.js
```

It prints `ℹ pass 0 ℹ fail 6`, the first failures reading `TypeError: V.openSections is not a function` and `TypeError: V.downsample is not a function`.

- [ ] **Step 3: Write the implementation.**

In `assets/station/station.js`, replace:

```js
            profileCard: profileCard,
        };
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            profileCard: profileCard,
            openSections: openSections, niceStep: niceStep, downsample: downsample, lineChart: lineChart,
            comma: comma, riseText: riseText, ctxSection: ctxSection, seqHtml: seqHtml, orderSection: orderSection,
        };
```

In `assets/station/station.js`, replace:

```js
        var s = hit[0];
        var tot = s.stages.reduce(function (n, w) {
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
        var s = hit[0];
        needDetail(s);
        var open = openSections(s);
        var x = DETAIL[s.id] || null;
        var tot = s.stages.reduce(function (n, w) {
```

In `assets/station/station.js`, replace:

```js
            + esc(s.task || '（未命名）') + '</h2>'
            + (s.stages.length
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            + esc(s.task || '（未命名）') + '</h2>'
            + secOpen('s-sum', '摘要', esc(s.stage || '—') + ' · ' + mins(tot)
                + (x ? ' · ' + x.requests + ' requests' : ''), open)
            + (s.stages.length
```

In `assets/station/station.js`, replace:

```js
            + '<dt>guard</dt><dd>' + esc(s.guard || 'ask (預設)') + '</dd></dl>'
            + '<h3 style="font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;'
            + 'color:var(--mute);margin:14px 0 6px">碰過的檔案 ' + s.claims.length + '</h3>'
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            + (x ? '<dt>requests</dt><dd class="num">' + x.requests + '</dd>' : '')
            + '<dt>guard</dt><dd>' + esc(s.guard || 'ask (預設)') + '</dd></dl>'
            + '</details>'
            + secOpen('s-claims', 'claims', s.claims.length + ' 個檔', open)
```

In `assets/station/station.js`, replace:

```js
            + clearControl(s) + '</div>';
    }
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            + clearControl(s) + '</details>'
            + (x ? detailSections(s, x, open) : detailNote(s))
            + '</div>';
    }
```

In `assets/station/station.js`, replace:

```js
    function draw() {
        var p = doc.getElementById('page');
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
    // ---- the detail panel ----------------------------------------------
    // One session's detail is a script of its own, `station/detail/<id>.js`,
    // loaded the first time the session is opened: `lib/station.js` keeps it
    // out of `station-data.js`, which every `/fankeel` prompt rewrites.
    var DETAIL = w.STATION_DETAIL || (w.STATION_DETAIL = {});
    var asked = {};
    function needDetail(s) {
        if (!s.hasDetail || DETAIL[s.id] || asked[s.id]) return;
        asked[s.id] = 'loading';
        var el = doc.createElement('script');
        el.src = 'station/detail/' + encodeURIComponent(s.id) + '.js';
        el.onload = function () { asked[s.id] = 'loaded'; if (sel === s.id) drawDetail(); };
        el.onerror = function () { asked[s.id] = 'failed'; if (sel === s.id) drawDetail(); };
        doc.head.appendChild(el);
    }
    function detailNote(s) {
        return '<p class="tally">' + (!s.hasDetail
            ? '這台機器的 config dir 裡沒有這個 session 的 transcript，所以沒有 context、階段順序、派工與過程還原'
            : asked[s.id] === 'failed' ? '細節檔讀不到：station/detail/' + esc(s.id) + '.js'
                : '讀取細節…') + '</p>';
    }
    function detailSections(s, x, open) {
        return sec('s-ctx', 'context', tokens(x.peak) + ' 峰值 · ' + x.requests + ' requests', ctxSection(s, x), open)
            + sec('s-order', '階段順序', x.seq.length + ' 步 · 倒退 ' + x.backtracks, orderSection(s, x), open);
    }

    // Which sections start open. A live session is watched for who is in which
    // file; an ended one is reviewed for what it cost. The replay starts closed
    // whatever the state: it is the longest section and the last one read.
    function openSections(s) {
        return s && s.state === 'live' ? ['s-sum', 's-claims'] : ['s-ctx', 's-disp'];
    }
    function secOpen(id, title, count, open) {
        return '<details class="sec" id="' + id + '"' + (open.indexOf(id) >= 0 ? ' open' : '') + '><summary>'
            + '<span class="t">' + title + '</span> <span class="cnt">' + count + '</span></summary>';
    }
    function sec(id, title, count, body, open) {
        return secOpen(id, title, count, open) + body + '</details>';
    }
    function comma(n) {
        return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function niceStep(v) {
        var steps = [1e3, 2e3, 5e3, 1e4, 25e3, 5e4, 1e5, 2e5, 25e4, 5e5, 1e6, 2e6, 5e6];
        for (var i = 0; i < steps.length; i++) if (v / steps[i] <= 5) return steps[i];
        return 1e7;
    }
    // At most `max` points, one per bucket, each bucket keeping its highest —
    // so the peak the tally names is a point the line still passes through.
    function downsample(points, max) {
        if (points.length <= max) return points.slice();
        var out = [];
        var size = points.length / max;
        for (var b = 0; b < max; b++) {
            var lo = Math.floor(b * size);
            var hi = Math.min(points.length, Math.floor((b + 1) * size));
            var best = points[lo];
            for (var i = lo + 1; i < hi; i++) if (points[i].y > best.y) best = points[i];
            out.push(best);
        }
        return out;
    }
    // One series: x is time, y the context each request carried. Stage moves
    // are vertical lines, dispatches out and back are dots on the line, the
    // five largest rises are numbered. `t0`, `t1` and `ymax` come from the
    // caller so two charts can share one scale.
    function lineChart(points, o) {
        var W = o.W || 340, H = o.H || 170, L = 40, R = 10, TOP = 14, B = 20;
        var t0 = o.t0, t1 = o.t1 > o.t0 ? o.t1 : o.t0 + 1, ymax = o.ymax || 1;
        var X = function (t) { return (L + (Math.max(Math.min(t, t1), t0) - t0) / (t1 - t0) * (W - L - R)).toFixed(1); };
        var Y = function (v) { return (H - B - Math.min(v, ymax) / ymax * (H - TOP - B)).toFixed(1); };
        var yAt = function (t) {
            var y = points.length ? points[0].y : 0;
            for (var i = 0; i < points.length && points[i].t <= t; i++) y = points[i].y;
            return y;
        };
        var pts = downsample(points, 240);
        var step = niceStep(ymax);
        var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'context') + '">';
        for (var v = 0; v <= ymax; v += step) {
            out += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>'
                + '<text class="axis" x="' + (L - 4) + '" y="' + (Number(Y(v)) + 3) + '" text-anchor="end">' + tokens(v) + '</text>';
        }
        (o.marks || []).forEach(function (m) {
            if (!isFinite(m.t)) return;
            out += '<line class="bd ' + esc(m.kind) + '" x1="' + X(m.t) + '" x2="' + X(m.t) + '" y1="' + TOP + '" y2="' + (H - B)
                + '" stroke="' + (STAGE_C[m.stage] || 'var(--mute)') + '"><title>' + esc((m.stage || m.kind) + ' · ' + stamp(m.t)) + '</title></line>';
        });
        if (pts.length) {
            out += '<path class="ln" d="' + pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.t) + ' ' + Y(p.y); }).join(' ') + '"/>';
        }
        (o.dots || []).forEach(function (d) {
            if (!isFinite(d.t)) return;
            out += '<circle class="' + (d.kind === 'back' ? 'dback' : 'dout') + '" r="3.5" cx="' + X(d.t) + '" cy="' + Y(yAt(d.t))
                + '"><title>' + esc(d.text || d.kind) + '</title></circle>';
        });
        (o.rises || []).forEach(function (r, i) {
            if (!isFinite(r.t)) return;
            out += '<g class="rb"><circle r="7" cx="' + X(r.t) + '" cy="' + Y(r.y1) + '"/><text x="' + X(r.t) + '" y="'
                + (Number(Y(r.y1)) + 3) + '" text-anchor="middle">' + (i + 1) + '</text></g>';
        });
        pts.forEach(function (p) {
            out += '<circle class="hit" r="4" cx="' + X(p.t) + '" cy="' + Y(p.y) + '"><title>回合 ' + p.n + ' · '
                + stamp(p.t) + ' · ' + comma(p.y) + ' tokens</title></circle>';
        });
        out += '<text class="axis" x="' + L + '" y="' + (H - 4) + '">' + (o.elapsed ? '0m' : stamp(t0).slice(11)) + '</text>'
            + '<text class="axis" x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end">'
            + (o.elapsed ? mins(t1 - t0) : stamp(t1).slice(11)) + '</text>';
        return out + '</svg>';
    }
    function riseText(r) {
        if (r.cause === 'self') return r.self.label + '，輸出 ' + comma(r.self.tok) + ' tokens';
        var top = r.top.map(function (x) { return x.label + ' ' + comma(x.chars) + ' 字元'; });
        return (top.join('；') || '沒有記到進來的輸出')
            + (r.restN ? '；另 ' + r.restN + ' 項 ' + comma(r.restChars) + ' 字元' : '');
    }
    function risesList(s, x) {
        if (!x.rises.length) return '<p class="tally">沒有上升</p>';
        return '<ol class="rz" aria-label="最大的五次上升">' + x.rises.map(function (r, i) {
            return '<li><span class="rzn">' + (i + 1) + '</span><div><div class="rzh"><span class="d">+' + tokens(r.dy)
                + '</span><span class="w">回合 ' + r.from + '→' + r.n + (isFinite(r.t) ? ' · ' + stamp(r.t).slice(11) : '')
                + '</span><span class="w">' + (r.cause === 'self' ? '模型自己的輸出' : '進來 ' + comma(r.inChars) + ' 字元')
                + '</span></div><div class="rzm">' + esc(riseText(r)) + '</div>'
                + '</div></li>';
        }).join('') + '</ol>';
    }
    function ctxSection(s, x) {
        var P = x.points;
        var step = niceStep(x.peak || 1);
        var dots = [];
        x.dispatches.forEach(function (d) {
            dots.push({ t: d.out, kind: 'out', text: '派出 · ' + d.text });
            if (isFinite(d.back)) dots.push({ t: d.back, kind: 'back', text: '回來 · ' + d.text });
        });
        var same = P.length + x.noTime === x.requests;
        return '<div class="srcline">summarise() 的 byRequest：每個 request 的 input ＋ cache read ＋ cache write</div>'
            + (P.length ? '<div class="cx">' + lineChart(P, {
                W: 340, H: 170, t0: P[0].t, t1: P[P.length - 1].t, ymax: Math.ceil((x.peak || 1) / step) * step,
                marks: x.marks, dots: dots, rises: x.rises,
                label: String(s.id).slice(0, 8) + ' 的 context，' + P.length + ' 點，峰值 ' + tokens(x.peak),
            }) + '</div>' : '')
            + '<div class="key" aria-hidden="true"><span><i class="kl"></i>context / request</span>'
            + '<span><i class="ko"></i>派出</span><span><i class="kb"></i>回來</span><span><i class="ks"></i>階段</span></div>'
            + '<p class="tally">折線 <b>' + P.length + ' 點</b>' + (x.noTime ? ' ＋ ' + x.noTime + ' requests with no time' : '')
            + ' ＝ 摘要的 ' + x.requests + ' requests <span class="' + (same ? 'eq' : 'ne') + '">' + (same ? '一致' : '不一致')
            + '</span>' + (P.length > 240 ? ' · 超過 240 點，降取樣並保留峰值' : '')
            + ' · 峰值 ' + tokens(x.peak) + (x.peakN ? '（回合 ' + x.peakN + '）' : '') + '</p>'
            + risesList(s, x);
    }
    function seqHtml(seq, backs, route, stage, active) {
        var bk = {};
        (backs || []).forEach(function (b) { bk[b.i] = true; });
        var out = (seq || []).map(function (m, i) {
            var b = bk[i];
            return (i ? '<span class="ar' + (b ? ' bk' : '') + '" aria-hidden="true">' + (b ? '↩' : '→') + '</span>' : '')
                + '<span class="s' + (b ? ' bk' : '') + (m.source !== 'cmd' ? ' fb' : '') + '" role="listitem" title="'
                + esc(m.stage + ' · ' + stamp(m.at) + ' · ' + (m.source === 'cmd' ? 'task.js 指令' : m.source)) + '">'
                + '<span class="i">' + (i + 1) + '</span><i class="dot" style="background:' + (STAGE_C[m.stage] || '#888')
                + '"></i>' + esc(m.stage) + '</span>';
        }).join('');
        if (active) {
            (route || []).slice((route || []).indexOf(stage) + 1).forEach(function (n) {
                out += '<span class="ar" aria-hidden="true">→</span><span class="s todo" role="listitem">' + esc(n) + '</span>';
            });
        }
        return '<div class="seq" role="list" aria-label="階段移動次序">' + out + '</div>';
    }
    function backBlock(s, b) {
        return '<div class="bkl"><div class="hd2">↩ ' + esc(b.from) + ' → ' + esc(b.to) + ' <span class="mono">'
            + stamp(b.at) + ' · ' + esc(b.from) + ' 待了 ' + mins(b.at - b.since) + '</span></div>'
            + '</div>';
    }
    function orderSection(s, x) {
        return seqHtml(x.seq, x.backs, s.route, s.stage, s.state === 'live')
            + x.backs.map(function (b) { return backBlock(s, b); }).join('')
            + '<p class="tally">次序取 ' + (x.seqSource === 'task.js' ? 'transcript 裡真正執行的 task.js 指令'
                : x.seqSource === 'moves' ? 'moves（transcript 裡沒有 task.js 指令）'
                    : 'clock（沒有指令也沒有 moves，看不出回頭）') + '；倒退 ' + x.backtracks + ' 次</p>';
    }

    function draw() {
        var p = doc.getElementById('page');
```

In `assets/station/station.css`, replace:

```css
.pf{display:inline-flex;gap:6px;align-items:center}
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.css`:

```css
.pf{display:inline-flex;gap:6px;align-items:center}

/* The detail panel: sections that open and close, the context line, its
   rises, and the stage order. */
details.sec{border-top:1px solid var(--line);margin-top:10px}
details.sec>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:6px;
  font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);font-weight:600;
  padding:12px 2px 8px;user-select:none;border-radius:6px}
details.sec>summary::-webkit-details-marker{display:none}
details.sec>summary::before{content:"";flex:0 0 auto;width:6px;height:6px;border-right:1.5px solid currentColor;
  border-bottom:1.5px solid currentColor;transform:rotate(-45deg);margin:0 3px 0 1px;transition:transform .15s ease-out}
details.sec[open]>summary::before{transform:rotate(45deg) translate(-1px,-1px)}
details.sec>summary:hover{color:var(--fg-2)}
details.sec>summary:focus-visible{outline:2px solid var(--ind);outline-offset:1px}
details.sec>summary .cnt{font:11px var(--mono);text-transform:none;letter-spacing:0;color:var(--fg-2);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
#det details.sec:first-of-type{border-top:0;margin-top:0}
@media(prefers-reduced-motion:reduce){details.sec>summary::before{transition:none}}
.srcline{font:10.5px var(--mono);color:var(--mute);margin:0 0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tally{font-size:11px;color:var(--mute);margin:8px 0 0;line-height:1.55}
.tally b{color:var(--fg-2);font-weight:600}
.tally .eq{color:var(--up);font-weight:600}
.tally .ne{color:var(--dn);font-weight:600}
.cx svg{display:block;width:100%;height:auto;overflow:visible}
.cx .grid{stroke:var(--line);stroke-width:1}
.cx .axis{fill:var(--mute);font:10px var(--mono)}
.cx .ln{fill:none;stroke:var(--ind);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.cx .bd{stroke-width:1;opacity:.8}
.cx .bd.route{stroke:var(--mute);stroke-dasharray:2 3}
.cx .bd.moves,.cx .bd.clock{stroke-dasharray:1 2}
.cx .dout{fill:var(--fg-2);stroke:var(--card);stroke-width:2}
.cx .dback{fill:var(--card);stroke:var(--fg-2);stroke-width:2}
.cx .rb circle{fill:var(--card);stroke:var(--fg);stroke-width:1.5}
.cx .rb text{font:700 9.5px var(--mono);fill:var(--fg)}
.cx .hit{fill:transparent}
.cx .hit:hover{fill:var(--ind)}
.key{display:flex;flex-wrap:wrap;gap:3px 12px;font-size:10.5px;color:var(--mute);margin:4px 0 0}
.key i{display:inline-block;margin-right:5px;vertical-align:1px}
.key .kl{width:14px;height:2px;background:var(--ind)}
.key .ko{width:8px;height:8px;border-radius:50%;background:var(--fg-2)}
.key .kb{width:8px;height:8px;border-radius:50%;border:2px solid var(--fg-2)}
.key .ks{width:0;height:11px;border-left:1px solid #8b5cf6}
ol.rz{list-style:none;margin:10px 0 0;padding:0;border-top:1px solid var(--line)}
ol.rz>li{display:grid;grid-template-columns:18px minmax(0,1fr);gap:0 8px;padding:9px 0 8px;
  border-bottom:1px solid var(--line);font-size:12px;line-height:1.45}
.rzn{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--fg);display:grid;place-items:center;
  font:700 10px var(--mono);color:var(--fg);margin-top:1px}
.rzh{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;color:var(--fg-2);font-size:11.5px}
.rzh .d{font:600 12px var(--mono);color:var(--fg)}
.rzh .w{font:10.5px var(--mono);color:var(--mute)}
.rzm{margin-top:2px;color:var(--fg);overflow-wrap:anywhere}
.seq{display:flex;flex-wrap:wrap;align-items:center;gap:7px 3px;margin:6px 0 4px}
.seq .s{display:inline-flex;align-items:center;gap:5px;padding:3px 9px 3px 7px;border-radius:var(--r-pill);
  background:var(--soft);border:1px solid var(--line);font:11.5px var(--mono);color:var(--fg-2);white-space:nowrap}
.seq .s .i{font-size:9.5px;color:var(--mute)}
.seq .ar{color:var(--mute);font-size:11px;padding:0 1px}
.seq .ar.bk{color:var(--dn);font-weight:700;font-size:13px}
.seq .s.bk{border:1px dashed var(--dn);background:var(--dn-bg);color:var(--fg)}
.seq .s.todo{background:transparent;border-style:dashed;color:var(--mute)}
.seq .s.fb{border-style:dotted}
.bkl{margin-top:8px;padding:7px 9px;border-left:3px solid var(--dn);background:var(--soft);
  border-radius:0 var(--r-sm) var(--r-sm) 0;font-size:12px}
.bkl .hd2{font-weight:600;color:var(--fg)}
.bkl .hd2 .mono{font-weight:400;color:var(--mute);font-size:10.5px}
```

In `docs/station.md`, replace:

```md
### Where per-stage spend comes from
```

That text occurs exactly once in the file; replace it whole.

With, in `docs/station.md`:

```md
### One session, opened

Opening a row fills the panel with sections that open and close, and which
start open is the session's state — `openSections()` in the view script: a
live session opens on 摘要 and claims, who is in which file; one that has
ended opens on context and 派工, what it cost. 過程還原 starts closed either
way. Everything below claims is the session's detail, read out of its
transcript by `lib/detail.js` and loaded the first time the session is opened;
a session whose transcript is not under this machine's config directory has
none, and the panel says so rather than drawing an empty chart.

**context** is one line. x is time and y is the context each request carried —
input, cache read and both cache writes — taken from `summarise()`'s own
per-request map, so the tally under it (the points plus the requests with no
time equal the request count on 摘要) holds by construction and is printed
anyway. A request with no timestamp is counted, not drawn; past 240 points the
line keeps each bucket's highest point, so the peak it names is on it. Stage
moves are vertical lines at the time of the `task.js` command that made them,
dispatches out and back are dots, and the five largest rises are numbered and
listed with their cause: what arrived between the two requests — tool results,
notifications and prompts, largest first, in characters — or the model's own
output, when the previous response's output tokens are at least half the rise.
Thinking is stored as a signature and cannot be counted.

**階段順序** is the stages in the order they were entered, from the `task.js
start` and `stage` commands the transcript actually ran — one named inside a
`git commit -m` message or a heredoc is not a command — then from `moves`, and
last from the clock, which keeps one window per stage and cannot show a return.
A step to an earlier stage on the route is a backtrack, marked `↩` with how
long the stage before it lasted.

### Where per-stage spend comes from
```


- [ ] **Step 4: Correct the citations the new lines moved.** `node scripts/docs-check.js` names them as `moved:`; with this plan's tasks landed in order the corrections are:

- In `docs/station.md`: the assets/station/station.js citation now at line 767 → the line docs-check prints (this plan expects 774)
- In `docs/station.md`: the assets/station/station.js citation now at line 476 → the line docs-check prints (this plan expects 478)
- In `docs/station.md`: the assets/station/station.js citation now at line 493 → the line docs-check prints (this plan expects 495)
- In `docs/station.md`: the assets/station/station.js citation now at line 797 → the line docs-check prints (this plan expects 807)
- In `docs/station.md`: the assets/station/station.js citation now at line 583 → the line docs-check prints (this plan expects 585)
- In `docs/station.md`: the assets/station/station.js citation now at line 534 → the line docs-check prints (this plan expects 536)

If another task landed in between and moved the same lines further, use the number docs-check prints instead. Then `node scripts/docs-check.js` exits 0.

- [ ] **Step 5: Run it and watch it pass.**

```
node --test tests/station-panel.test.js tests/station-view.test.js tests/station-shell.test.js
```

It prints `ℹ pass 41 ℹ fail 0`. Then the four checks, each run on its own and judged by its exit code, not through a pipe: `npm test`, `node scripts/docs-check.js`, `node scripts/todo-check.js`, `node scripts/skills-check.js` — all exit 0.

- [ ] **Step 6: Commit.**

```
git add assets/station/station.js assets/station/station.css docs/station.md tests/station-panel.test.js
git commit -m "feat: the detail panel opens by state and draws the context line and stage order"
```


## Task 27: The detail panel shows the task table, the dispatch table and the replay

Design §7 (B2, B3, B4, B5): tasks in `plantasks` groups with the parallel hint; one band per dispatch turn with `surface` on it; per agent its duration, tokens, dollars (price table `verified` date beside them, `unpriced` where the model is unknown) and the characters its result returned to the parent; a workflow folded to one row per phase until opened; every total the sum of the rows under it; the tally setting the rows' dollars against `agentsOf()` and the workflow rows against the run file; the replay with each dispatch opening into its own steps; each backtrack linking to the replay rows before it.

**Files:**
- Modify: `assets/station/station.js` — `tasksHtml`, `dispatchHtml`, `replayHtml`, `stepsFor`, `dur` and helpers; three more sections; the phase, replay-filter and backtrack-jump clicks
- Modify: `assets/station/station.css` — tables, bands, the hint, phases, the replay; five colour tokens in both themes
- Modify: `docs/station.md` — 任務, 派工, 過程還原; six view-script citations
- Test: `tests/station-dispatch-view.test.js`

**Interfaces:**
- Consumes: `detailSections`, `backBlock`, `sec`, `comma` from `assets/station/station.js` (Task 26); the detail fields `tasks`, `rows`, `dispatches`, `runs`, `agentCents`, `agentsTotal`, `unpriced`, `events`, `dropped`, `steps`
- Produces: view exports `dur(sec)`, `tasksHtml(list)`, `dispatchHtml(x)`, `replayHtml(x)`; internal `cents`, `taskCount`, `sums`, `numCells`, `agentRow`, `stepsFor`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing test.** Create `tests/station-dispatch-view.test.js` with:

```js
'use strict';
// The detail panel's task table, dispatch table and replay. Every total they
// print is the sum of the rows printed under it; these tests hold that to the
// rows handed in.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const count = (s, re) => (s.match(re) || []).length;

const x = {
    dispatches: [
        { key: 't1', turn: 3, surface: 'agent', text: 'Review task 1', out: 1000, back: 61000, ret: 1873, launch: 1066, ids: ['a1'] },
        { key: 't2', turn: 5, surface: 'workflow', text: 'survey', out: 2000, back: 90000, ret: 9602, launch: 1198, run: 'wf_1', ids: ['w1', 'w2', 'w3'] },
    ],
    rows: [
        { id: 'a1', disp: 0, surface: 'agent', label: 'Review task 1', agentType: 'fankeel-reviewer', model: 'claude-sonnet-5', phase: null, c: 123, k: 45, s: 60, unpriced: [] },
        { id: 'w1', disp: 1, surface: 'workflow', label: 'read:a', agentType: 'fankeel:fankeel-reader', model: 'claude-sonnet-5', phase: 'Read', c: 40, k: 10, s: 30, unpriced: [] },
        { id: 'w2', disp: 1, surface: 'workflow', label: 'read:b', agentType: 'fankeel:fankeel-reader', model: 'claude-sonnet-5', phase: 'Read', c: 10, k: 5, s: 20, unpriced: [] },
        { id: 'w3', disp: 1, surface: 'workflow', label: 'check', agentType: 'fankeel:fankeel-reviewer', model: 'claude-mystery-9', phase: 'Check', c: 0, k: 2, s: 5, unpriced: ['claude-mystery-9'] },
    ],
    runs: [{ run: 'wf_1', name: 'survey', agents: 3 }],
    agentCents: 173,
    agentsTotal: { cents: 173 },
    unpriced: ['claude-mystery-9'],
    steps: { a1: { steps: [{ k: 'read', f: 'lib/a.js' }, { k: 'cmd', c: 'npm test', r: 'ℹ pass 3' }], total: { read: 1, cmd: 1, find: 2 }, dropped: { find: 2 }, droppedN: 2 } },
    events: [
        { t: 500, kind: 'prompt', text: 'fix it', cmd: '/fankeel:fankeel' },
        { t: 600, kind: 'gate', qs: [{ q: 'Which?', a: 'my own', own: true }] },
        { t: 1000, kind: 'out', disp: 0, surface: 'agent', text: 'Review task 1', agentType: 'fankeel-reviewer', alias: 'sonnet' },
        { t: 61000, kind: 'back', disp: 0, ret: 1873, text: 'Review task 1' },
        { t: 62000, kind: 'commit', sha: 'abc1234', text: 'fix: it' },
    ],
    dropped: 0,
};

test('the dispatch footer and each band are the sums of their rows, and the tally sets them against agentsOf and the run file', () => {
    const html = V.dispatchHtml(x);
    const foot = html.slice(html.indexOf('<tfoot>'), html.indexOf('</tfoot>'));
    assert.match(foot, /4 個 agent/);
    assert.match(foot, /\$1\.73/);
    assert.match(foot, /62k/);
    assert.match(foot, /1m55s/);
    assert.match(foot, /11,475/, 'returned characters, launches left out');
    assert.match(html, /各列美元相加 <b>\$1\.73<\/b> <span class="eq">＝<\/span> agentsOf\(\) 的 \$1\.73/);
    assert.match(html, /workflow 派工 3 列 <span class="eq">＝<\/span> run 檔的 workflow_agent 3 列/);
    assert.match(html, /合計 2,264 字元/);
    assert.match(V.dispatchHtml(Object.assign({}, x, { agentsTotal: { cents: 174 } })), /class="ne">≠/);
});

test('a workflow folds into one row per phase, its agents hidden until the phase opens; an unknown model reads unpriced', () => {
    const html = V.dispatchHtml(x);
    assert.equal(count(html, /data-ph="/g), 2);
    assert.equal(count(html, /class="wa" data-in="ph-1-0" hidden/g), 2);
    assert.equal(count(html, /class="wa" data-in="ph-1-1" hidden/g), 1);
    assert.match(html, /title="價目表不認得：claude-mystery-9">unpriced/);
    assert.match(html, /<span class="sf workflow">workflow<\/span>/);
});

test('the task table marks the hint and a task with no ledger line, and counts completed rows against the ledger', () => {
    const tasks = [{
        plan: 'docs/plans/2026-09-11-x.md', ledgerLines: 1,
        tasks: [{ n: 1, title: 'one', status: 'complete', range: 'abc1234..def5678', turns: [3] },
            { n: 2, title: 'two', status: 'no ledger line', range: null, turns: [5] }],
        groups: [{ g: 1, tasks: [1, 2], surface: 'agents', turns: [3, 5], hint: true }],
        unmatched: ['Plan reviewer'],
    }];
    const html = V.tasksHtml(tasks);
    assert.match(html, /could have gone in one response/);
    assert.match(html, /class="pill sm pend">no ledger line/);
    assert.match(html, /標為完成的 <b>1 列<\/b> <span class="eq">＝<\/span> ledger 的 Task 行 1/);
    assert.match(html, /Plan reviewer/);
    assert.match(V.tasksHtml([]), /沒有 plan 檔/);
});

test('the replay is one row per event with a filter per kind, a gate shows the answer, a dispatch opens into its steps', () => {
    const html = V.replayHtml(x);
    assert.equal(count(html, /<li data-kind=/g), 5);
    assert.equal(count(html, /data-rk="/g), 8);
    assert.match(html, /my own<span class="own">自己寫的<\/span>/);
    assert.match(html, /展開它自己的步驟 <span class="n">2 \/ 4 步<\/span>/);
    assert.match(html, /另有 2 步沒列出（搜 2）/);
    assert.match(V.replayHtml(Object.assign({}, x, { dropped: 12 })), /丟掉了 12 列/);
    assert.equal(V.dur(59), '59s');
    assert.equal(V.dur(3725), '1h02m');
});
```

- [ ] **Step 2: Run it and watch it fail.**

```
node --test tests/station-dispatch-view.test.js
```

It prints `ℹ pass 0 ℹ fail 4`, the first failures reading `TypeError: V.dispatchHtml is not a function` and `TypeError: V.tasksHtml is not a function`.

- [ ] **Step 3: Write the implementation.**

In `assets/station/station.js`, replace:

```js
            comma: comma, riseText: riseText, ctxSection: ctxSection, seqHtml: seqHtml, orderSection: orderSection,
        };
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            comma: comma, riseText: riseText, ctxSection: ctxSection, seqHtml: seqHtml, orderSection: orderSection,
            dur: dur, tasksHtml: tasksHtml, dispatchHtml: dispatchHtml, replayHtml: replayHtml,
        };
```

In `assets/station/station.js`, replace:

```js
            + sec('s-order', '階段順序', x.seq.length + ' 步 · 倒退 ' + x.backtracks, orderSection(s, x), open);
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            + sec('s-order', '階段順序', x.seq.length + ' 步 · 倒退 ' + x.backtracks, orderSection(s, x), open)
            + sec('s-tasks', '任務', taskCount(x.tasks), tasksHtml(x.tasks), open)
            + sec('s-disp', '派工', x.rows.length + ' 個 agent · ' + cents(x.agentCents), dispatchHtml(x), open)
            + sec('s-rp', '過程還原', x.events.length + ' 列', replayHtml(x), open);
```

In `assets/station/station.js`, replace:

```js
            + stamp(b.at) + ' · ' + esc(b.from) + ' 待了 ' + mins(b.at - b.since) + '</span></div>'
            + '</div>';
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            + stamp(b.at) + ' · ' + esc(b.from) + ' 待了 ' + mins(b.at - b.since) + '</span></div>'
            + '<a class="lk" tabindex="0" data-goto="' + b.since + '" data-until="' + b.at + '">過程還原裡它前面那幾列 ↓</a>'
            + '</div>';
```

In `assets/station/station.js`, replace:

```js

    function draw() {
        var p = doc.getElementById('page');
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
    function cents(c) { return '$' + ((c || 0) / 100).toFixed(2); }
    function dur(sec) {
        if (!isFinite(sec)) return '—';
        if (sec < 60) return sec + 's';
        var m = Math.floor(sec / 60), r = sec % 60;
        if (m < 60) return m + 'm' + (r < 10 ? '0' : '') + r + 's';
        return Math.floor(m / 60) + 'h' + (m % 60 < 10 ? '0' : '') + (m % 60) + 'm';
    }
    function taskCount(list) {
        if (!list || !list.length) return '沒有 plan';
        var n = 0, g = 0;
        list.forEach(function (p) { n += p.tasks.length; g += p.groups.length; });
        return n + ' 個 · ' + g + ' 組';
    }
    // One band per group `plantasks` would dispatch together, its tasks under
    // it, and the hint where one group went out over more than one turn.
    function tasksHtml(list) {
        if (!list || !list.length) return '<p class="tally">這個 session 的 claims 裡沒有 plan 檔，沒有任務表</p>';
        return list.map(function (p) {
            var byN = {};
            p.tasks.forEach(function (t) { byN[t.n] = t; });
            var done = p.tasks.filter(function (t) { return t.status === 'complete'; }).length;
            return '<div class="srcline" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>'
                + '<table class="x"><colgroup><col style="width:30px"><col><col style="width:96px"></colgroup>'
                + '<thead><tr><th>#</th><th>任務</th><th>狀態</th></tr></thead><tbody>'
                + p.groups.map(function (g) {
                    return '<tr class="band"><td colspan="3"><div class="bandrow"><span class="gb">G' + g.g + '</span>'
                        + '<span>Task ' + g.tasks.join('、') + ' · 建議 <span class="mono">' + esc(g.surface) + '</span></span>'
                        + '<span class="rt">' + (g.turns.length ? '回合 ' + g.turns.join(' · ') : '沒有派工') + '</span></div>'
                        + (g.hint ? '<div class="hint">could have gone in one response<span class="why">同組，分 '
                            + g.turns.length + ' 個回合派出</span></div>' : '') + '</td></tr>'
                        + g.tasks.map(function (n) {
                            var t = byN[n];
                            return '<tr><td class="num mute">' + n + '</td><td><div>' + esc(t ? t.title : '') + '</div>'
                                + '<div class="l2">' + (t && t.range ? esc(t.range) : '出自 plan 的 task 清單')
                                + (t && t.turns.length ? ' · 回合 ' + t.turns.join(' · ') : '') + '</div></td>'
                                + '<td><span class="pill sm ' + (t && t.status === 'complete' ? 'ok' : 'pend') + '">'
                                + esc(t ? t.status : 'no ledger line') + '</span></td></tr>';
                        }).join('');
                }).join('') + '</tbody></table>'
                + '<p class="tally">標為完成的 <b>' + done + ' 列</b> <span class="' + (done === p.ledgerLines ? 'eq">＝' : 'ne">≠')
                + '</span> ledger 的 Task 行 ' + p.ledgerLines
                + (p.unmatched.length ? '；label 裡沒有 task N 的派工 ' + p.unmatched.length + ' 個，不猜：'
                    + p.unmatched.map(esc).join('、') : '') + '</p>';
        }).join('');
    }
    // Every column below is the sum of the rows under it: each row's cents,
    // thousands of tokens and seconds were rounded in `lib/detail.js` by the
    // largest remainder, so the page only adds.
    function sums(rows) {
        return rows.reduce(function (a, r) { a.c += r.c; a.k += r.k; a.s += r.s; return a; }, { c: 0, k: 0, s: 0 });
    }
    function numCells(t, unpriced) {
        return '<td class="r">' + dur(t.s) + '</td><td class="r">' + comma(t.k) + 'k</td><td class="r"'
            + (unpriced ? ' title="價目表不認得：' + esc(unpriced) + '"' : '') + '>'
            + (unpriced && !t.c ? 'unpriced' : cents(t.c)) + '</td>';
    }
    function agentRow(r, cls, attr) {
        return '<tr class="' + cls + '"' + (attr || '') + '><td><div class="lab" title="' + esc(r.label) + '">'
            + esc(r.label || r.id) + '</div><div class="l2">' + esc((r.agentType || '—') + ' · '
            + String(r.model || r.alias || '—').replace(/^claude-/, '')) + '</div></td>'
            + numCells(r, (r.unpriced || []).join(', ')) + '<td class="r rc"></td></tr>';
    }
    // One band per dispatch, in turn order, `surface` on the band; a workflow
    // folds into one row per phase until that phase is opened. Agents that no
    // dispatch in the transcript accounts for are a band of their own.
    function dispatchHtml(x) {
        var groups = {}, order = [];
        x.rows.forEach(function (r) {
            var k = r.disp === null ? 'none' : String(r.disp);
            if (!groups[k]) { groups[k] = []; order.push(k); }
            groups[k].push(r);
        });
        order.sort(function (a, b) {
            if (a === 'none') return 1;
            if (b === 'none') return -1;
            var da = x.dispatches[a], db = x.dispatches[b];
            return (da.turn || 0) - (db.turn || 0) || (da.out || 0) - (db.out || 0);
        });
        var body = order.map(function (k) {
            var list = groups[k], d = k === 'none' ? null : x.dispatches[k];
            var head = '<tr class="band"><td><div class="bandrow"><span class="sf ' + (d ? d.surface : 'agent') + '">'
                + (d ? d.surface : '—') + '</span><span class="ell">' + esc(d ? d.text : '沒有對上派工的 agent') + '</span>'
                + '<span class="rt">' + (d && d.turn ? '回合 ' + d.turn : '')
                + (d && isFinite(d.out) ? ' · ' + stamp(d.out).slice(11) + '→' + (isFinite(d.back) ? stamp(d.back).slice(11) : '…') : '')
                + '</span></div></td>' + numCells(sums(list), '') + '<td class="r rc">'
                + (d && d.ret !== null && d.ret !== undefined ? comma(d.ret) : '—') + '</td></tr>';
            if (!d || d.surface !== 'workflow') return head + list.map(function (r) { return agentRow(r, 'ag', ''); }).join('');
            var phases = [];
            list.forEach(function (r) { var p = r.phase || '—'; if (phases.indexOf(p) < 0) phases.push(p); });
            return head + phases.map(function (p, i) {
                var pr = list.filter(function (r) { return (r.phase || '—') === p; });
                var key = 'ph-' + k + '-' + i;
                return '<tr class="phr"><td><button type="button" class="phb" data-ph="' + key + '" aria-expanded="false">'
                    + esc(p) + '<span class="n">· ' + pr.length + ' agents</span></button></td>' + numCells(sums(pr), '')
                    + '<td class="r rc"></td></tr>'
                    + pr.map(function (r) { return agentRow(r, 'wa', ' data-in="' + key + '" hidden'); }).join('');
            }).join('');
        }).join('');
        var all = sums(x.rows);
        var ret = x.dispatches.reduce(function (n, d) { return n + (d.ret || 0); }, 0);
        var launch = x.dispatches.reduce(function (n, d) { return n + (d.launch || 0); }, 0);
        var wf = x.rows.filter(function (r) { return r.surface === 'workflow'; }).length;
        var wfRun = x.runs.reduce(function (n, r) { return n + r.agents; }, 0);
        var eq = function (a, b) { return '<span class="' + (a === b ? 'eq">＝' : 'ne">≠') + '</span>'; };
        return '<table class="x dx"><colgroup><col><col style="width:50px"><col style="width:54px"><col style="width:54px">'
            + '<col style="width:58px"></colgroup><thead><tr><th>派工</th><th class="r">耗時</th><th class="r">tokens</th>'
            + '<th class="r">USD</th><th class="r rc" title="這次派工的結果進入主 context 的字元數">回傳字元</th></tr></thead>'
            + '<tbody>' + body + '</tbody><tfoot><tr><td>' + x.rows.length + ' 個 agent</td>' + numCells(all, '')
            + '<td class="r rc">' + comma(ret) + '</td></tr></tfoot></table>'
            + '<p class="tally">各列美元相加 <b>' + cents(all.c) + '</b> ' + eq(all.c, x.agentsTotal.cents) + ' agentsOf() 的 '
            + cents(x.agentsTotal.cents) + '；workflow 派工 ' + wf + ' 列 ' + eq(wf, wfRun) + ' run 檔的 workflow_agent '
            + wfRun + ' 列</p>'
            + '<p class="tally">回傳字元是派工的結果進入主 context 的長度：背景 agent 與 workflow 取 task-notification，前景的取 Agent 的'
            + ' tool_result。背景啟動時回來的確認不算在內，這個 session 合計 ' + comma(launch) + ' 字元。美元照價目表 '
            + esc(S.pricesVerified || '—') + (x.unpriced.length ? '；價目表不認得、寫 unpriced 的：' + x.unpriced.map(esc).join('、') : '')
            + '</p>';
    }
    function stepsFor(x, d) {
        var SK = { read: '讀', edit: '改', cmd: '指令', find: '搜', other: '其他' };
        if (!d) return '';
        var ids = d.ids.filter(function (id) { return x.steps[id]; });
        if (!ids.length) return '';
        var shown = 0, total = 0;
        ids.forEach(function (id) { shown += x.steps[id].steps.length; total += x.steps[id].steps.length + x.steps[id].droppedN; });
        return '<details class="stw"><summary class="rpx">展開它自己的步驟 <span class="n">' + shown + ' / ' + total + ' 步'
            + (ids.length > 1 ? ' · ' + ids.length + ' agents' : '') + '</span></summary>' + ids.map(function (id) {
                var st = x.steps[id];
                var r = x.rows.filter(function (y) { return y.id === id; })[0];
                return (ids.length > 1 ? '<div class="stg">' + esc(r ? r.label : id) + '</div>' : '')
                    + '<ul class="stp">' + st.steps.map(function (y) {
                        return '<li><span class="sk ' + y.k + '">' + (y.k === 'edit' && y.w ? '寫' : SK[y.k]) + '</span><div>'
                            + (y.f ? '<span class="fl">' + esc(y.f) + '</span>' : '<span class="cm">' + esc(y.c) + '</span>')
                            + (y.r ? '<div class="rl">' + esc(y.r) + '</div>' : '') + '</div></li>';
                    }).join('') + '</ul>'
                    + (st.droppedN ? '<p class="stn">上限 40 步，另有 ' + st.droppedN + ' 步沒列出（'
                        + Object.keys(st.dropped).map(function (k) { return SK[k] + ' ' + st.dropped[k]; }).join('、') + '）</p>' : '');
            }).join('') + '</details>';
    }
    // One row per event in time order. Each dispatch's row opens into its
    // own steps, read from its own transcript; each kind can be hidden.
    function replayHtml(x) {
        var KINDS = [['prompt', 'prompt'], ['stage', '階段'], ['gate', 'gate'], ['out', '派出'], ['back', '回來'],
            ['edit', '改檔'], ['commit', 'commit'], ['test', '測試']];
        var tag = {};
        KINDS.forEach(function (k) { tag[k[0]] = k[1]; });
        var count = {};
        x.events.forEach(function (e) { count[e.kind] = (count[e.kind] || 0) + 1; });
        var bar = '<div class="rpf" role="group" aria-label="事件種類">' + KINDS.map(function (k) {
            return '<button type="button" data-rk="' + k[0] + '" aria-pressed="true">' + k[1] + '<span class="n">'
                + (count[k[0]] || 0) + '</span></button>';
        }).join('') + '</div>';
        var list = x.events.map(function (e) {
            var body;
            if (e.kind === 'prompt') body = esc(e.text) + (e.cmd ? '<div class="sub">' + esc(e.cmd) + '</div>' : '');
            else if (e.kind === 'stage') {
                body = esc(e.verb === 'stage' ? e.stage : e.verb + (e.stage ? ' · ' + e.stage : ''))
                    + (e.text ? '<div class="sub">' + esc(e.text) + '</div>' : '');
            } else if (e.kind === 'gate') {
                body = e.qs.map(function (q) {
                    return '<div class="qa"><div class="q">' + esc(q.q) + '</div><div class="a">'
                        + esc(q.a === null ? '（沒有答案）' : q.a) + (q.own ? '<span class="own">自己寫的</span>' : '') + '</div></div>';
                }).join('');
            } else if (e.kind === 'out') {
                body = esc(e.text) + '<div class="sub">' + esc(e.surface + (e.agentType ? ' · ' + e.agentType : '')
                    + (e.alias ? ' · ' + e.alias : '')) + '</div>' + stepsFor(x, x.dispatches[e.disp]);
            } else if (e.kind === 'back') {
                body = esc(e.text) + '<div class="sub">回傳 ' + (e.ret === null || e.ret === undefined ? '—' : comma(e.ret) + ' 字元') + '</div>';
            } else if (e.kind === 'edit') {
                body = e.files.map(function (f) { return '<span class="fl">' + esc(f.f) + (f.n > 1 ? ' ×' + f.n : '') + '</span>'; }).join('、');
            } else if (e.kind === 'commit') body = '<span class="sha">' + esc(e.sha) + '</span>' + esc(e.text);
            else body = esc(e.text);
            return '<li data-kind="' + esc(e.kind) + '" data-t="' + (isFinite(e.t) ? e.t : '') + '"><span class="tm">'
                + (isFinite(e.t) ? stamp(e.t).slice(11) : '—') + '</span><div class="tx"><span class="tg ' + esc(e.kind) + '">'
                + esc(tag[e.kind] || e.kind) + '</span>' + body + '</div></li>';
        }).join('');
        return bar + '<ol class="rp">' + list + '</ol><p class="tally">' + x.events.length + ' 列'
            + (x.dropped ? '；超過 300 列，只留 gate、階段、commit 與派工，丟掉了 ' + x.dropped + ' 列' : '') + '</p>';
    }

    function draw() {
        var p = doc.getElementById('page');
```

In `assets/station/station.js`, replace:

```js
    doc.addEventListener('click', function (e) {
        var pg = e.target.closest('[data-page]');
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
    doc.addEventListener('click', function (e) {
        // A workflow phase opens into its agents.
        var ph = e.target.closest('[data-ph]');
        if (ph) {
            var shown = ph.getAttribute('aria-expanded') !== 'true';
            ph.setAttribute('aria-expanded', String(shown));
            [].forEach.call(doc.querySelectorAll('[data-in="' + ph.getAttribute('data-ph') + '"]'), function (r) { r.hidden = !shown; });
            return;
        }
        // A replay kind is hidden or shown again.
        var rk = e.target.closest('[data-rk]');
        if (rk) {
            var on = rk.getAttribute('aria-pressed') !== 'true';
            rk.setAttribute('aria-pressed', String(on));
            [].forEach.call(doc.querySelectorAll('#det .rp > li[data-kind="' + rk.getAttribute('data-rk') + '"]'), function (li) { li.hidden = !on; });
            return;
        }
        // A backtrack opens the replay on the rows between entering the stage
        // it left and the step back — what that stage saw before it sent the
        // work back.
        var jump = e.target.closest('[data-goto]');
        if (jump) {
            var from = Number(jump.getAttribute('data-goto')), until = Number(jump.getAttribute('data-until'));
            var rp = doc.getElementById('s-rp');
            if (!rp) return;
            rp.open = true;
            var first = null;
            [].forEach.call(rp.querySelectorAll('.rp > li[data-t]'), function (li) {
                var t = Number(li.getAttribute('data-t'));
                var hit = li.getAttribute('data-t') !== '' && t >= from && t <= until;
                li.classList.toggle('hl', hit);
                if (hit && !first) first = li;
            });
            if (first) first.scrollIntoView({ block: 'center' });
            return;
        }
        var pg = e.target.closest('[data-page]');
```

In `assets/station/station.css`, replace:

```css
  --sh:0 1px 2px rgba(20,22,33,.04),0 4px 16px rgba(20,22,33,.04);
}
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.css`:

```css
  --sh:0 1px 2px rgba(20,22,33,.04),0 4px 16px rgba(20,22,33,.04);
  --stale-ink:#92400e; --teal-soft:#dcf5f1; --teal-ink:#0f766e; --up-ink:#15803d; --dn-ink:#b91c1c;
}
```

In `assets/station/station.css`, replace:

```css
  --sh:0 1px 2px rgba(0,0,0,.3);
}}
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.css`:

```css
  --sh:0 1px 2px rgba(0,0,0,.3);
  --stale-ink:#fbbf24; --teal-soft:#0f2e2b; --teal-ink:#5eead4; --up-ink:#4ade80; --dn-ink:#fca5a5;
}}
```

In `assets/station/station.css`, replace:

```css
.bkl .hd2 .mono{font-weight:400;color:var(--mute);font-size:10.5px}
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.css`:

```css
.bkl .hd2 .mono{font-weight:400;color:var(--mute);font-size:10.5px}
.lk{display:inline-block;margin-top:4px;font:600 11px var(--mono);color:var(--ind);cursor:pointer;text-decoration:none}
.lk:focus-visible{outline:2px solid var(--ind);outline-offset:2px}

/* tasks, dispatches, replay */
.det table.x th{padding:7px 8px}
.det table.x td{padding:7px 8px;font-size:12px;vertical-align:top}
.det tr.band td{padding:11px 8px 5px;border-bottom:1px solid var(--line-2);font-size:11.5px;color:var(--fg-2)}
.bandrow{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}
.bandrow .rt{margin-left:auto;font:10.5px var(--mono);color:var(--mute);white-space:nowrap}
.gb{display:inline-block;font:600 10.5px var(--mono);padding:1px 7px;border-radius:5px;
  background:var(--soft);border:1px solid var(--line-2);color:var(--fg-2)}
.hint{display:flex;align-items:center;gap:6px;margin-top:6px;padding:4px 9px;
  border-radius:0 var(--r-sm) var(--r-sm) 0;background:var(--stale-bg);color:var(--stale-ink);
  border-left:3px solid var(--stale);font-size:11.5px;font-weight:600}
.hint .why{font-weight:400;opacity:.85;margin-left:auto;font-size:10.5px;white-space:nowrap}
.pill.ok{background:var(--up-bg);color:var(--up)}
.pill.pend{background:var(--down-bg);color:var(--down)}
.pill.sm{font-size:10px;padding:0 7px}
.l2{font:10.5px var(--mono);color:var(--mute);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sf{display:inline-block;font:600 10.5px var(--mono);padding:1px 7px;border-radius:var(--r-pill);white-space:nowrap}
.sf.agent{background:var(--soft);color:var(--fg-2);border:1px solid var(--line-2)}
.sf.agents{background:var(--ind-soft);color:var(--ind)}
.sf.workflow{background:var(--teal-soft);color:var(--teal-ink)}
.det table.dx th{padding:7px 5px;overflow:hidden;text-overflow:ellipsis}
.det table.dx td{padding:6px 5px;font-size:12px;vertical-align:top}
.det table.dx td.r{padding-top:7px;font:11.5px var(--mono);font-variant-numeric:tabular-nums;color:var(--fg-2)}
.det table.dx tr.band td.r{padding-top:11px;color:var(--fg);font-weight:600}
.det table.dx th.rc,.det table.dx td.rc{background:var(--soft)}
.det table.dx .lab{font:11.5px var(--mono);color:var(--fg);white-space:normal;overflow-wrap:anywhere;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4}
.det tr.phr td{padding-top:5px;padding-bottom:5px;background:var(--soft)}
.det tr.wa td:first-child{padding-left:18px}
.det tfoot td{border-top:1.5px solid var(--line-2);border-bottom:0;font-weight:600;padding-top:8px}
.phb{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:7px;
  font:600 11px var(--sans);color:var(--fg-2);padding:2px 0;min-height:22px}
.phb::before{content:"";width:5px;height:5px;border-right:1.5px solid currentColor;
  border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .15s ease-out}
.phb[aria-expanded=true]::before{transform:rotate(45deg) translate(-1px,-1px)}
.phb .n{font:10.5px var(--mono);color:var(--mute);font-weight:400}
.phb:focus-visible{outline:2px solid var(--ind);outline-offset:2px;border-radius:4px}
.rpf{display:flex;flex-wrap:wrap;gap:4px;margin:2px 0 6px}
.rpf button{font:11px var(--sans);padding:3px 9px;border-radius:var(--r-pill);border:1px solid var(--line-2);
  background:var(--card);color:var(--mute);cursor:pointer;min-height:24px}
.rpf button[aria-pressed=true]{background:var(--soft);color:var(--fg-2);font-weight:600}
.rpf button[aria-pressed=false]{text-decoration:line-through;opacity:.7}
.rpf .n{font-family:var(--mono);margin-left:3px}
.rp{list-style:none;margin:0;padding:0}
.rp>li{display:grid;grid-template-columns:50px minmax(0,1fr);gap:0 8px;padding:6px 0;
  border-bottom:1px solid var(--line);font-size:12px;line-height:1.45}
.rp>li.hl{background:var(--stale-bg)}
.rp .tm{font:10.5px var(--mono);color:var(--mute);padding-top:2px}
.rp .tx{overflow-wrap:anywhere;color:var(--fg)}
.rp .tg{display:inline-block;font:600 9.5px var(--sans);letter-spacing:.04em;padding:0 6px;border-radius:4px;
  margin-right:5px;vertical-align:1px;white-space:nowrap;line-height:16px;background:var(--soft);color:var(--fg-2)}
.tg.prompt{background:var(--ind-soft);color:var(--ind)}
.tg.gate{background:var(--stale-bg);color:var(--stale-ink)}
.tg.out,.tg.back{background:var(--teal-soft);color:var(--teal-ink)}
.tg.commit{background:var(--up-bg);color:var(--up)}
.tg.test{background:var(--dn-bg);color:var(--dn)}
.rp .sub{font:10.5px var(--mono);color:var(--mute);margin-top:2px;overflow-wrap:anywhere}
.rp .qa{margin-top:3px;padding-left:8px;border-left:2px solid var(--line-2)}
.rp .qa .q{color:var(--fg-2)}
.rp .qa .a{color:var(--fg);font-weight:500}
.rp .own{font:600 9.5px var(--sans);color:var(--ind);border:1px solid var(--ind-2);border-radius:4px;
  padding:0 4px;margin-left:4px;white-space:nowrap}
.rp .fl{font:11px var(--mono);color:var(--fg-2)}
.rp .sha{font:600 11px var(--mono);color:var(--fg-2);margin-right:5px}
.stw{margin:4px 0 2px}
.rpx{cursor:pointer;font:600 10.5px var(--sans);color:var(--ind);list-style:none}
.rpx::-webkit-details-marker{display:none}
.rpx .n{font:10px var(--mono);color:var(--mute);font-weight:400}
.stp{list-style:none;margin:2px 0 0;padding:2px 0 2px 9px;border-left:2px solid var(--line-2)}
.stp li{display:grid;grid-template-columns:28px minmax(0,1fr);gap:0 6px;padding:2px 0;font-size:11px;line-height:1.4}
.sk{font:600 9.5px var(--sans);color:var(--mute);padding-top:1px;white-space:nowrap}
.sk.edit{color:var(--ind)}
.sk.cmd{color:var(--teal-ink)}
.stp .cm,.stp .fl{font:10.5px var(--mono);color:var(--fg-2);overflow-wrap:anywhere}
.stp .rl{font:10px var(--mono);color:var(--mute);overflow-wrap:anywhere}
.stg{font:600 10.5px var(--mono);color:var(--fg-2);margin-top:7px}
.stn{font-size:10px;color:var(--mute);margin:2px 0 0;line-height:1.45}
```

In `docs/station.md`, replace:

```md
long the stage before it lasted.

### Where per-stage spend comes from
```

That text occurs exactly once in the file; replace it whole.

With, in `docs/station.md`:

```md
long the stage before it lasted. Each backtrack links to the replay rows
between entering the stage it left and the step back.

**任務** is the plan the session claimed — a `docs/plans/<stem>.md` among its
claims, not the `-design` one — with its tasks from the plan and each one's
status from `.fankeel/build/<stem>/progress.md`. A task still open has no
`Task` line in the ledger and reads `no ledger line`, not a guess. The bands are
the groups `lib/plantasks.js` would dispatch together; a group whose tasks
went out over more than one turn is marked `could have gone in one response`.
A dispatch is tied to a task by `task N` in its label and by nothing else, and
the ones naming no task are listed under the table.

**派工** is one band per dispatch in turn order, `agent`, `agents` (two or more
Agent calls in one response) or `workflow` on it, and one row per agent: its
wall-clock from its own transcript, its tokens, and its dollars priced from its
own per-kind counts — `workflow_agent.tokens` is one undivided number and cannot
be priced — with the price table's `verified` date beside them and `unpriced`
where the table does not know the model. Every workflow run the session made is
read, not only the newest. A workflow folds into one row per phase until the
phase is opened. The last column is the characters the dispatch's result put
into the parent's context: the task-notification for a background agent or a
workflow, the tool result for a foreground one; the acknowledgement a background
launch returns at once is not counted, and the page says how much it came to.
The seconds, thousands and cents are each rounded by the largest remainder in
`lib/detail.js`, so every band and the footer are the sums of the rows under
them, and the tally under the table sets the rows' dollar sum against
`agentsOf()`'s total and the workflow rows against the run files' own count.

**過程還原** is one row per event in time order: prompts (their first sixty
characters), stage moves, each gate's question and the answer chosen, each
dispatch out and back, the files each turn edited (one row per turn), each
commit's subject and each test run's `ℹ pass` and `ℹ fail` lines. A dispatch's
row opens into its own steps — what it read, edited and ran — from its own
transcript, capped at forty with edits and commands kept first. Past 300 rows
only the gates, stage moves, commits and dispatches are kept and the page says
how many were dropped.

### Where per-stage spend comes from
```


- [ ] **Step 4: Correct the citations the new lines moved.** `node scripts/docs-check.js` names them as `moved:`; with this plan's tasks landed in order the corrections are:

- In `docs/station.md`: the assets/station/station.js citation now at line 774 → the line docs-check prints (this plan expects 775)
- In `docs/station.md`: the assets/station/station.js citation now at line 478 → the line docs-check prints (this plan expects 479)
- In `docs/station.md`: the assets/station/station.js citation now at line 495 → the line docs-check prints (this plan expects 496)
- In `docs/station.md`: the assets/station/station.js citation now at line 807 → the line docs-check prints (this plan expects 808)
- In `docs/station.md`: the assets/station/station.js citation now at line 585 → the line docs-check prints (this plan expects 586)
- In `docs/station.md`: the assets/station/station.js citation now at line 536 → the line docs-check prints (this plan expects 537)

If another task landed in between and moved the same lines further, use the number docs-check prints instead. Then `node scripts/docs-check.js` exits 0.

- [ ] **Step 5: Run it and watch it pass.**

```
node --test tests/station-dispatch-view.test.js tests/station-panel.test.js
```

It prints `ℹ pass 10 ℹ fail 0`. Then the four checks, each run on its own and judged by its exit code, not through a pipe: `npm test`, `node scripts/docs-check.js`, `node scripts/todo-check.js`, `node scripts/skills-check.js` — all exit 0.

- [ ] **Step 6: Commit.**

```
git add assets/station/station.js assets/station/station.css docs/station.md tests/station-dispatch-view.test.js
git commit -m "feat: the detail panel shows tasks, dispatches and the replay"
```


## Task 28: 記成 TODO: a served `POST /todo` checked by todo-check's own `check()`, a copyable line on the static page

Design §7 (B6): in serve mode each rise with a cause and each backtrack gets a button prefilled with a `〔station〕` line and a link, posting to `/todo`, written under `## Needs a decision` only after todo-check's rules pass — and those rules exist once. `scripts/todo-check.js` exports only the whole-file `check(file, now)` (`:207`, `:395`), so the line goes into a copy of `TODO.md` written beside it (so the link resolves from the same directory against the same `docs.json`) and any problem the copy has that the file had not is the refusal. The static page prints the line to copy. The server builds the line with the page's own `todoEntry`, required from `assets/station/station.js` (which loads in node without a window, as `tests/station-view.test.js` already relies on). On 2026-09-11 the served form, run against a registry with no `TODO.md`, came back `404 — 沒有寫進去：no TODO.md at …` inline, as designed.

**Files:**
- Modify: `assets/station/station.js` — `todoEntry`, `riseTodo`, `backTodo`, `todoSpot`; a spot beside each rise and backtrack; the submit click
- Modify: `assets/station/station.css` — the TODO form and the copyable line
- Modify: `scripts/station.js` — `addTodo` and `POST /todo`
- Modify: `docs/station.md` — 記成 TODO and the `/todo` route; six view-script citations
- Read: `scripts/todo-check.js` — `check(file, now)`
- Test: `tests/station-todo.test.js`

**Interfaces:**
- Consumes: `risesList`, `backBlock` from `assets/station/station.js` (Task 26, Task 27); `check` from `scripts/todo-check.js`
- Produces: view exports `todoEntry(text, link)`, `riseTodo(id, rise)`, `backTodo(id, back)`, `todoSpot(text, link, s)`; `addTodo(file, entry)` → `{ status, text }` in `scripts/station.js`; `POST /todo` taking `nonce`, `root`, `id`, `text`, `link` — `201` with the line written, `400` with the failing rule's kind and detail, `403`, `404`, `409`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing test.** Create `tests/station-todo.test.js` with:

```js
'use strict';
// 記成 TODO: the served page posts a line to /todo, which writes it under
// `## Needs a decision` only once todo-check's own check() passes it; the file
// on disk prints the line to copy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');

const SID = 'ffffffff-6666-4666-8666-666666666666';
const TODO = '# TODO\n\n## Ready\n\n- a thing — [station.md](docs/station.md)\n\n'
    + '## Needs a decision\n\n- a question — [station.md](docs/station.md)\n\n## Waiting\n';

function fixture() {
    const base = tmp('fankeel-station-todo-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    registry.writeSession(r1, SID, { task: 't', stage: 'build', route: ['survey', 'build'], active: false, claims: [],
        started: '2026-09-11T10:00:00.000Z', updated: '2026-09-11T10:05:00.000Z', configDir: cfg });
    fs.writeFileSync(path.join(r1, 'TODO.md'), TODO);
    fs.mkdirSync(path.join(r1, 'docs', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(r1, 'docs', 'station.md'), '# station\n');
    fs.writeFileSync(path.join(r1, 'docs', 'plans', 'p.md'), '# p\n');
    fs.writeFileSync(path.join(r1, '.fankeel', 'docs.json'), JSON.stringify({ preset: 'flat', buckets: [
        { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/plans', role: 'plan' }] }));
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

test('todoEntry is the line todo-check reads; the prefilled texts say where they came from', () => {
    assert.equal(V.todoEntry('  a\n  b ', 'docs/station.md#x'), 'a b — [station.md](docs/station.md#x)');
    assert.equal(V.todoEntry('a', ''), 'a');
    const rise = { n: 4, from: 3, dy: 20632, cause: 'in', self: { tok: 1, label: '' }, top: [{ label: 'Read docs/x.md', chars: 14423 }] };
    assert.equal(V.riseTodo('13ebea34-67f5', rise), '〔station〕13ebea34 回合 3→4 context +21k：Read docs/x.md 14,423 字元');
    const back = { from: 'verify', to: 'build', at: Date.UTC(2026, 8, 9, 2, 59), since: Date.UTC(2026, 8, 9, 2, 15) };
    assert.equal(V.backTodo('05de9a54-0910', back), '〔station〕05de9a54 verify→build 倒退（2026-09-09 02:59，verify 待了 44m）：verify 抓到的，build 為什麼沒抓到');
});

test('the file on disk prints the line to copy; the served page a form carrying the session', () => {
    global.window.STATION.serve = false;
    assert.match(V.todoSpot('x', 'docs/station.md', { root: 'R', id: 'I' }), /<code>- x — \[station\.md\]\(docs\/station\.md\)<\/code>/);
    global.window.STATION.serve = true;
    const form = V.todoSpot('x', 'docs/station.md', { root: 'R', id: 'I' });
    assert.match(form, /data-todo-root="R" data-todo-id="I"/);
    assert.match(form, /data-todo>送出/);
    global.window.STATION.serve = false;
});

test('POST /todo writes a clean line under Needs a decision, and refuses with the rule todo-check names', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js');
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const post = (o) => request(s.url + 'todo', new URLSearchParams(Object.assign({ nonce, root: f.r1, id: SID }, o)).toString());
        const file = path.join(f.r1, 'TODO.md');
        assert.equal((await post({ nonce: 'wrong', text: 'x', link: 'docs/station.md' })).status, 403);
        assert.equal((await post({ id: 'nobody', text: 'x', link: 'docs/station.md' })).status, 404);
        const long = await post({ text: 'x'.repeat(250), link: 'docs/station.md' });
        assert.deepEqual([long.status, long.text.startsWith('too long — ')], [400, true]);
        const dead = await post({ text: 'x', link: 'docs/nope.md' });
        assert.deepEqual([dead.status, dead.text.startsWith('dead link — docs/nope.md')], [400, true]);
        const plan = await post({ text: 'x', link: 'docs/plans/p.md' });
        assert.deepEqual([plan.status, plan.text.startsWith('stale citation — docs/plans/p.md is filed as plan')], [400, true]);
        assert.equal(fs.readFileSync(file, 'utf8'), TODO, 'a refused line leaves the file as it was');
        const text = '〔station〕ffffffff 回合 3→4 context +20k：Read x';
        const ok = await post({ text, link: 'docs/station.md' });
        assert.equal(ok.status, 201);
        const line = '- ' + V.todoEntry(text, 'docs/station.md');
        assert.equal(ok.text.trim(), line);
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        assert.equal(lines.indexOf(line), lines.indexOf('- a question — [station.md](docs/station.md)') + 1);
        assert.ok(lines.indexOf(line) < lines.indexOf('## Waiting'));
        assert.deepEqual(fs.readdirSync(f.r1).filter((n) => n.startsWith('.TODO.station-')), [], 'the copy is removed');
    } finally {
        s.close();
    }
});
```

- [ ] **Step 2: Run it and watch it fail.**

```
node --test tests/station-todo.test.js
```

It prints `ℹ pass 0 ℹ fail 3`, the first failures reading `TypeError: V.todoEntry is not a function` and `TypeError: V.todoSpot is not a function`.

- [ ] **Step 3: Write the implementation.**

In `assets/station/station.js`, replace:

```js
            dur: dur, tasksHtml: tasksHtml, dispatchHtml: dispatchHtml, replayHtml: replayHtml,
        };
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            dur: dur, tasksHtml: tasksHtml, dispatchHtml: dispatchHtml, replayHtml: replayHtml,
            todoEntry: todoEntry, riseTodo: riseTodo, backTodo: backTodo, todoSpot: todoSpot,
        };
```

In `assets/station/station.js`, replace:

```js
                + '</span></div><div class="rzm">' + esc(riseText(r)) + '</div>'
                + '</div></li>';
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
                + '</span></div><div class="rzm">' + esc(riseText(r)) + '</div>'
                + todoSpot(riseTodo(s.id, r), r.cause === 'self' ? 'skills/fankeel/SKILL.md' : 'docs/station.md', s)
                + '</div></li>';
```

In `assets/station/station.js`, replace:

```js
            + '<a class="lk" tabindex="0" data-goto="' + b.since + '" data-until="' + b.at + '">過程還原裡它前面那幾列 ↓</a>'
            + '</div>';
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            + '<a class="lk" tabindex="0" data-goto="' + b.since + '" data-until="' + b.at + '">過程還原裡它前面那幾列 ↓</a>'
            + todoSpot(backTodo(s.id, b), 'skills/fankeel-build/SKILL.md', s)
            + '</div>';
```

In `assets/station/station.js`, replace:

```js

    function draw() {
        var p = doc.getElementById('page');
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
    // ---- 記成 TODO -------------------------------------------------------
    // One line for TODO.md's `## Needs a decision`, in the shape todo-check
    // reads: the text, then the link it points at. `scripts/station.js`
    // builds the line it writes with this same function.
    function todoEntry(text, link) {
        var l = String(link || '').trim();
        var label = l ? (l.split('#')[0].split('/').pop() || l) : '';
        return String(text || '').replace(/\s+/g, ' ').trim() + (l ? ' — [' + label + '](' + l + ')' : '');
    }
    function riseTodo(id, r) {
        return '〔station〕' + String(id).slice(0, 8) + ' 回合 ' + r.from + '→' + r.n + ' context +' + tokens(r.dy) + '：'
            + (r.cause === 'self' ? r.self.label
                : r.top[0] ? r.top[0].label + ' ' + comma(r.top[0].chars) + ' 字元' : '進來的輸出');
    }
    function backTodo(id, b) {
        return '〔station〕' + String(id).slice(0, 8) + ' ' + b.from + '→' + b.to + ' 倒退（' + stamp(b.at) + '，'
            + b.from + ' 待了 ' + mins(b.at - b.since) + '）：' + b.from + ' 抓到的，' + b.to + ' 為什麼沒抓到';
    }
    // Served, a form that posts the line to `/todo`, which checks it with
    // todo-check's own rules before writing and answers 400 with the rule that
    // failed. A file on disk cannot post, so it prints the line to copy.
    function todoSpot(text, link, s) {
        if (!S.serve) {
            return '<div class="td"><div class="tdc"><code>- ' + esc(todoEntry(text, link)) + '</code></div>'
                + '<div class="tds">靜態頁不寫檔：複製這一行，貼進 TODO.md 的 ## Needs a decision。</div></div>';
        }
        return '<details class="td"><summary class="tdb">記成 TODO <span class="m">POST /todo</span></summary>'
            + '<div class="tdf" data-todo-root="' + esc(s.root) + '" data-todo-id="' + esc(s.id) + '">'
            + '<label>條目（寫進 TODO.md 的 ## Needs a decision）</label><textarea rows="2" spellcheck="false">'
            + esc(text) + '</textarea><label>連結</label><input type="text" spellcheck="false" value="' + esc(link) + '">'
            + '<div class="help">送出前跑 todo-check 的同一套規則：≤ 200 字元、連結要存在、不指向 plan、decision、report、archive。</div>'
            + '<div class="act"><button type="button" class="go" data-todo>送出</button></div>'
            + '<div class="tdr" role="status" aria-live="polite"></div></div></details>';
    }

    function draw() {
        var p = doc.getElementById('page');
```

In `assets/station/station.js`, replace:

```js
        // A workflow phase opens into its agents.
        var ph = e.target.closest('[data-ph]');
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
        // 記成 TODO: the server checks the line and answers with the rule it
        // failed, or with the line it wrote.
        var todo = e.target.closest('[data-todo]');
        if (todo) {
            var box = todo.closest('.tdf');
            var said = box.querySelector('.tdr');
            var body = new URLSearchParams();
            body.set('nonce', S.nonce || '');
            body.set('root', box.getAttribute('data-todo-root'));
            body.set('id', box.getAttribute('data-todo-id'));
            body.set('text', box.querySelector('textarea').value);
            body.set('link', box.querySelector('input').value);
            fetch('todo', { method: 'POST', body: body }).then(function (r) {
                return r.text().then(function (t) {
                    said.className = 'tdr ' + (r.ok ? 'ok' : 'bad');
                    said.textContent = (r.ok ? '寫進 TODO.md：' : r.status + ' — 沒有寫進去：') + t.trim();
                });
            }, function () {
                said.className = 'tdr bad';
                said.textContent = '送不出去：serve 還在跑嗎？';
            });
            return;
        }
        // A workflow phase opens into its agents.
        var ph = e.target.closest('[data-ph]');
```

In `scripts/station.js`, replace:

```js
const profile = require('../lib/profile.js');
```

That text occurs exactly once in the file; replace it whole.

With, in `scripts/station.js`:

```js
const profile = require('../lib/profile.js');
const todoCheck = require('./todo-check.js');
const view = require('../assets/station/station.js');
```

In `scripts/station.js`, replace:

```js
async function serve(opts) {
```

That text occurs exactly once in the file; replace it whole.

With, in `scripts/station.js`:

```js
// The one write behind 記成 TODO. The entry goes under `## Needs a decision` in
// the project's TODO.md, and only once `scripts/todo-check.js`'s own `check()`
// has passed it: the line is put into a copy of the file, written beside the
// file so its link resolves from the same directory against the same
// `docs.json`, and any problem the copy has that the file had not is the
// refusal, named. todo-check exports only the whole-file check, and that is
// the point: the rules stay in one place.
function addTodo(file, entry) {
    if (!entry.trim()) return { status: 400, text: 'empty entry — nothing to write' };
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return { status: 404, text: 'no TODO.md at ' + file };
    }
    const lines = text.split('\n');
    const at = lines.findIndex((l) => /^##\s+Needs a decision\s*$/.test(l));
    if (at < 0) return { status: 409, text: 'no "## Needs a decision" heading in ' + file };
    let put = at + 1;
    while (put < lines.length && !/^#{1,6}\s/.test(lines[put])) put++;
    while (put > at + 1 && !lines[put - 1].trim()) put--;
    const next = lines.slice(0, put).concat(['- ' + entry], lines.slice(put)).join('\n');
    const copy = path.join(path.dirname(file), '.TODO.station-' + process.pid + '.md');
    const key = (p) => p.kind + '\n' + p.detail;
    try {
        fs.writeFileSync(copy, next);
        const had = new Map();
        for (const p of todoCheck.check(file).problems) had.set(key(p), (had.get(key(p)) || 0) + 1);
        const seen = new Map();
        for (const p of todoCheck.check(copy).problems) {
            seen.set(key(p), (seen.get(key(p)) || 0) + 1);
            if (seen.get(key(p)) > (had.get(key(p)) || 0)) return { status: 400, text: p.kind + ' — ' + p.detail };
        }
    } finally {
        try { fs.unlinkSync(copy); } catch (e) { /* already gone */ }
    }
    const temp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(temp, next);
    registry.renameRetrying(temp, file);
    return { status: 201, text: '- ' + entry };
}

async function serve(opts) {
```

In `scripts/station.js`, replace:

```js
        if (req.method === 'POST' && url.pathname === '/profile') {
```

That text occurs exactly once in the file; replace it whole.

With, in `scripts/station.js`:

```js
        if (req.method === 'POST' && url.pathname === '/todo') {
            const form = new URLSearchParams(await readBody(req));
            if (form.get('nonce') !== nonce) {
                res.writeHead(403, { 'content-type': 'text/plain' });
                res.end('wrong nonce: open the page this server printed and try again\n');
                return;
            }
            const model = modelNow();
            const reg = model.registries.find((r) => r.root === path.resolve(form.get('root') || ''));
            const row = reg && reg.sessions.find((s) => s.sessionId === form.get('id'));
            if (!row) {
                res.writeHead(404, { 'content-type': 'text/plain' });
                res.end('no such session on this page\n');
                return;
            }
            // The session's own project when it names one with a TODO.md, and
            // the registry's root otherwise.
            const own = path.join(reg.root, row.project || '', 'TODO.md');
            const file = fs.existsSync(own) ? own : path.join(reg.root, 'TODO.md');
            const out = addTodo(file, view.todoEntry(form.get('text') || '', form.get('link') || ''));
            res.writeHead(out.status, { 'content-type': 'text/plain; charset=utf-8' });
            res.end(out.text + '\n');
            return;
        }
        if (req.method === 'POST' && url.pathname === '/profile') {
```

In `assets/station/station.css`, replace:

```css
.stn{font-size:10px;color:var(--mute);margin:2px 0 0;line-height:1.45}
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.css`:

```css
.stn{font-size:10px;color:var(--mute);margin:2px 0 0;line-height:1.45}

/* 記成 TODO */
.td{margin-top:6px}
.tdb{font:600 11px var(--sans);min-height:26px;padding:3px 11px;border-radius:var(--r-pill);list-style:none;
  border:1px solid var(--line-2);background:var(--card);color:var(--ind);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.tdb::-webkit-details-marker{display:none}
.tdb:focus-visible,.tdf button:focus-visible{outline:2px solid var(--ind);outline-offset:2px}
.tdb .m{font:10px var(--mono);color:var(--mute);font-weight:400}
.tdf{margin-top:6px;padding:9px 10px 10px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--soft)}
.tdf label{display:block;font-size:10.5px;color:var(--fg-2);font-weight:600;margin:6px 0 3px}
.tdf textarea,.tdf input{display:block;width:100%;font:11.5px/1.45 var(--mono);color:var(--fg);background:var(--card);
  border:1px solid var(--line-2);border-radius:6px;padding:5px 7px;resize:vertical}
.tdf .help{font-size:10.5px;color:var(--mute);margin-top:5px}
.tdf .act{display:flex;gap:6px;margin-top:8px}
.tdf .go{font:600 11px var(--sans);min-height:28px;padding:3px 12px;border-radius:var(--r-pill);border:0;
  background:var(--ind);color:#fff;cursor:pointer}
.tdr:empty{display:none}
.tdr{margin-top:8px;padding:6px 9px;border-radius:6px;font-size:11.5px;line-height:1.45;overflow-wrap:anywhere}
.tdr.ok{background:var(--up-bg);color:var(--up-ink)}
.tdr.bad{background:var(--dn-bg);color:var(--dn-ink)}
.tdc{padding:6px 8px;border:1px dashed var(--line-2);border-radius:6px;background:var(--soft)}
.tdc code{font:10.5px/1.5 var(--mono);color:var(--fg-2);overflow-wrap:anywhere;user-select:all}
.tds{font-size:10.5px;color:var(--mute);margin-top:3px}
```

In `docs/station.md`, replace:

```md
only the gates, stage moves, commits and dispatches are kept and the page says
how many were dropped.
```

That text occurs exactly once in the file; replace it whole.

With, in `docs/station.md`:

```md
only the gates, stage moves, commits and dispatches are kept and the page says
how many were dropped.

Beside each rise with a cause and each backtrack sits **記成 TODO**: a line
starting `〔station〕`, prefilled with what the panel just showed, and a link.
Served, it is a form that posts to `/todo` (below); a file on disk cannot post,
so it prints the line to copy into `## Needs a decision` instead.
```

In `docs/station.md`, replace:

```md
Both routes call the same `clearEntry`, which writes `active: false` and
```

That text occurs exactly once in the file; replace it whole.

With, in `docs/station.md`:

```md
`POST /todo` is the third write the served page can make, and the only one
outside the registry: one entry under `## Needs a decision` in the session's
project's `TODO.md`, or the registry root's when the project has none. It takes
`root`, `id`, `text` and `link` with the run's nonce, builds the line with the
page's own `todoEntry`, and checks it with `scripts/todo-check.js`'s own
`check()` before writing: the line goes into a copy of the file written beside
it — so the link resolves from the same directory against the same
`docs.json` — and a problem the copy has that the file did not is answered
`400` with that problem's kind and detail, the file untouched. So the cap, a
link that must resolve, and a link that must not point at a plan, decision,
report or archive are todo-check's rules and nobody else's. A clean line
answers `201` with the line written; a wrong nonce is `403`, a session not on
the page `404`, and a `TODO.md` with no `## Needs a decision` heading `409`.

Both routes call the same `clearEntry`, which writes `active: false` and
```


- [ ] **Step 4: Correct the citations the new lines moved.** `node scripts/docs-check.js` names them as `moved:`; with this plan's tasks landed in order the corrections are:

- In `docs/station.md`: the assets/station/station.js citation now at line 775 → the line docs-check prints (this plan expects 776)
- In `docs/station.md`: the assets/station/station.js citation now at line 479 → the line docs-check prints (this plan expects 480)
- In `docs/station.md`: the assets/station/station.js citation now at line 496 → the line docs-check prints (this plan expects 497)
- In `docs/station.md`: the assets/station/station.js citation now at line 808 → the line docs-check prints (this plan expects 809)
- In `docs/station.md`: the assets/station/station.js citation now at line 586 → the line docs-check prints (this plan expects 587)
- In `docs/station.md`: the assets/station/station.js citation now at line 537 → the line docs-check prints (this plan expects 538)

If another task landed in between and moved the same lines further, use the number docs-check prints instead. Then `node scripts/docs-check.js` exits 0.

- [ ] **Step 5: Run it and watch it pass.**

```
node --test tests/station-todo.test.js tests/station-cli.test.js
```

It prints `ℹ pass 32 ℹ fail 0`. Then the four checks, each run on its own and judged by its exit code, not through a pipe: `npm test`, `node scripts/docs-check.js`, `node scripts/todo-check.js`, `node scripts/skills-check.js` — all exit 0.

- [ ] **Step 6: Commit.**

```
git add assets/station/station.js assets/station/station.css scripts/station.js docs/station.md tests/station-todo.test.js
git commit -m "feat: 記成 TODO posts a line that todo-check's own check() must pass"
```


## Task 29: 比較: two sessions on one y axis and one x length

Design §7 (B7): tick two sessions on the list and open the comparison — two lines one above the other on one y axis and one x length, x the time since each one's first request, each still a single series; beneath them peak, request count, dispatch dollars and backtrack count side by side, each from the same field the session's own panel prints. On 2026-09-11, served over the two real sessions, it drew two lines on 0–600k over 5h39m with $63.72 and $20.47 each equal to its `agentsOf()`.

**Files:**
- Modify: `assets/station/station.js` — `figures`, `compareHtml`, `cmpPage`; a tick column on 清單, 比較 on the rail and the page
- Modify: `assets/station/station.css` — the comparison
- Modify: `docs/station.md` — the 比較 view; six view-script citations
- Test: `tests/station-compare.test.js`

**Interfaces:**
- Consumes: `lineChart`, `seqHtml`, `niceStep`, `comma`, `needDetail`, `DETAIL` (Task 26) and `cents` (Task 27) from `assets/station/station.js`
- Produces: view exports `figures(x)` → `{ peak, peakN, requests, pts, noTime, cents, agentCents, back, t0, t1 }`, `compareHtml(a, xa, b, xb)`; internal `cmpPage()`, `picked`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing test.** Create `tests/station-compare.test.js` with:

```js
'use strict';
// 比較: two sessions' context lines on one y axis and one x length, and their
// figures side by side, each taken from the field their own panel prints.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');

const count = (s, re) => (s.match(re) || []).length;
const detail = (t0, peak, cents, back) => ({
    points: [{ n: 1, t: t0, y: 1000 }, { n: 2, t: t0 + 600000, y: peak }], noTime: 0, requests: 2, peak, peakN: 2,
    rows: cents.map((c) => ({ c })), agentsTotal: { cents: cents.reduce((a, b) => a + b, 0) }, backtracks: back,
    backs: back ? [{ i: 1, from: 'verify', to: 'build', at: t0 + 1, since: t0 }] : [],
    seq: [{ stage: 'verify', at: t0, source: 'cmd' }, { stage: 'build', at: t0 + 1, source: 'cmd' }], marks: [],
});
const a = { id: 'aaaaaaaa-1', task: 'before', route: ['survey', 'build', 'verify'], stage: 'verify', state: 'down' };
const b = { id: 'bbbbbbbb-2', task: 'after', route: ['survey', 'build', 'verify'], stage: 'verify', state: 'down' };

test('figures take the dispatch dollars from the rows and the backtracks from the stage order', () => {
    const f = V.figures(detail(0, 50000, [120, 30], 1));
    assert.deepEqual([f.peak, f.requests, f.cents, f.agentCents, f.back, f.t0, f.t1], [50000, 2, 150, 150, 1, 0, 600000]);
});

test('two charts, one line each, on one y axis and one x length; the table and both sequences follow', () => {
    const xa = detail(0, 50000, [120, 30], 1);
    const xb = Object.assign(detail(5e9, 180000, [10], 0), { points: [{ n: 1, t: 5e9, y: 1000 }, { n: 2, t: 5e9 + 1200000, y: 180000 }] });
    const html = V.compareHtml(a, xa, b, xb);
    assert.equal(count(html, /class="ln"/g), 2, 'two charts, each one series');
    assert.match(html, /共用 y 軸（0 到 200k）與 x 軸的長度（20m）/);
    assert.equal(count(html, /<text class="axis" x="[\d.]+" y="\d+" text-anchor="end">20m<\/text>/g), 2, 'both x axes end at the longer span');
    assert.match(html, /\$1\.50<span class="s2">＝ agentsOf\(\) \$1\.50/);
    assert.equal(count(html, /class="ar bk"/g), 1, 'the backward step shows in its own sequence');
});
```

- [ ] **Step 2: Run it and watch it fail.**

```
node --test tests/station-compare.test.js
```

It prints `ℹ pass 0 ℹ fail 2`, the first failures reading `TypeError: V.figures is not a function` and `TypeError: V.compareHtml is not a function`.

- [ ] **Step 3: Write the implementation.**

In `assets/station/station.js`, replace:

```js
            todoEntry: todoEntry, riseTodo: riseTodo, backTodo: backTodo, todoSpot: todoSpot,
        };
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            todoEntry: todoEntry, riseTodo: riseTodo, backTodo: backTodo, todoSpot: todoSpot,
            figures: figures, compareHtml: compareHtml,
        };
```

In `assets/station/station.js`, replace:

```js
    var page = 'overview', sel = null, sortKey = 'updated', sortDir = -1;
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
    var page = 'overview', sel = null, sortKey = 'updated', sortDir = -1;
    // The sessions ticked for 比較, oldest tick first; a third tick drops the first.
    var picked = [];
```

In `assets/station/station.js`, replace:

```js
            + '<span class="n">' + S.sessions.length + '</span></a></div></div>'
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            + '<span class="n">' + S.sessions.length + '</span></a>'
            + '<a data-page="cmp" aria-current="' + (page === 'cmp') + '">'
            + '<span class="ic">⇅</span><span class="lb">比較</span>'
            + '<span class="n">' + picked.length + '</span></a></div></div>'
```

In `assets/station/station.js`, replace:

```js
        return '<div class="phead"><h1>清單</h1><span class="chip" id="cnt"></span>'
            + '<span class="spacer"></span>'
            + '<span class="ctl" data-page="overview">▦ 總覽</span></div>'
            + '<div class="listwrap" style="height:calc(100% - 54px)">'
            + '<div class="card listcard"><div class="scroll"><table>'
            + '<colgroup><col><col style="width:130px"><col style="width:80px">'
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
        return '<div class="phead"><h1>清單</h1><span class="chip" id="cnt"></span>'
            + '<span class="spacer"></span>'
            + '<span class="ctl" data-page="cmp">⇅ 比較勾選的 <b id="ncmp">' + picked.length + '</b> 個</span>'
            + '<span class="ctl" data-page="overview">▦ 總覽</span></div>'
            + '<div class="listwrap" style="height:calc(100% - 54px)">'
            + '<div class="card listcard"><div class="scroll"><table>'
            + '<colgroup><col style="width:34px"><col><col style="width:130px"><col style="width:80px">'
```

In `assets/station/station.js`, replace:

```js
        doc.getElementById('lh').innerHTML = '<tr>' + COLS.map(function (c) {
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
        doc.getElementById('lh').innerHTML = '<tr><th aria-label="選來比較"></th>' + COLS.map(function (c) {
```

In `assets/station/station.js`, replace:

```js
            return '<tr data-id="' + esc(s.id) + '" aria-selected="' + (sel === s.id) + '">'
                + '<td>' + taskCell(s) + '</td><td>' + stageCell(s) + '</td>'
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            return '<tr data-id="' + esc(s.id) + '" aria-selected="' + (sel === s.id) + '">'
                + '<td><input type="checkbox" data-cmp="' + esc(s.id) + '" aria-label="選來比較"'
                + (picked.indexOf(s.id) >= 0 ? ' checked' : '')
                + (s.hasDetail ? '' : ' disabled title="沒有 transcript，沒有細節可比"') + '></td>'
                + '<td>' + taskCell(s) + '</td><td>' + stageCell(s) + '</td>'
```

In `assets/station/station.js`, replace:

```js
        }).join('') || '<tr><td colspan="7"><div class="empty">沒有符合的 session</div></td></tr>';
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
        }).join('') || '<tr><td colspan="8"><div class="empty">沒有符合的 session</div></td></tr>';
```

In `assets/station/station.js`, replace:

```js
        el.onload = function () { asked[s.id] = 'loaded'; if (sel === s.id) drawDetail(); };
        el.onerror = function () { asked[s.id] = 'failed'; if (sel === s.id) drawDetail(); };
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
        var redraw = function () {
            if (page === 'cmp') draw();
            else if (sel === s.id) drawDetail();
        };
        el.onload = function () { asked[s.id] = 'loaded'; redraw(); };
        el.onerror = function () { asked[s.id] = 'failed'; redraw(); };
```

In `assets/station/station.js`, replace:

```js
        p.innerHTML = page === 'list' ? listPage() : overview();
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
        p.innerHTML = page === 'list' ? listPage() : page === 'cmp' ? cmpPage() : overview();
```

In `assets/station/station.js`, replace:

```js
        var pg = e.target.closest('[data-page]');
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
        var cb = e.target.closest('input[data-cmp]');
        if (cb) {
            var id = cb.getAttribute('data-cmp');
            picked = picked.filter(function (x) { return x !== id; });
            if (cb.checked) picked.push(id);
            if (picked.length > 2) picked.shift();
            var nc = doc.getElementById('ncmp');
            if (nc) nc.textContent = picked.length;
            drawList();
            drawSide();
            return;
        }
        var pg = e.target.closest('[data-page]');
```

In `assets/station/station.js`, replace:

```js

    function draw() {
        var p = doc.getElementById('page');
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
    // ---- 比較 ----------------------------------------------------------------
    // The figures the comparison sets side by side, each from the field the
    // session's own panel prints it from.
    function figures(x) {
        var P = x.points;
        return {
            peak: x.peak, peakN: x.peakN, requests: x.requests, pts: P.length, noTime: x.noTime,
            cents: x.rows.reduce(function (n, r) { return n + r.c; }, 0), agentCents: x.agentsTotal.cents,
            back: x.backtracks, t0: P.length ? P[0].t : 0, t1: P.length ? P[P.length - 1].t : 0,
        };
    }
    // Two lines one above the other, on one y axis and one x length, x being
    // the time since each one's first request — each chart still one series.
    function compareHtml(a, xa, b, xb) {
        var fa = figures(xa), fb = figures(xb);
        var span = Math.max(fa.t1 - fa.t0, fb.t1 - fb.t0) || 1;
        var top = Math.max(fa.peak, fb.peak) || 1;
        var ymax = Math.ceil(top / niceStep(top)) * niceStep(top);
        var chart = function (s, x, f) {
            return '<div class="cmph"><span class="sid">' + esc(String(s.id).slice(0, 8)) + '</span><span class="tk" title="'
                + esc(s.task) + '">' + esc(s.task) + '</span><span class="meta">' + stamp(f.t0) + ' 起 · ' + mins(f.t1 - f.t0)
                + ' · ' + s.route.length + ' 段</span></div><div class="cx">' + lineChart(x.points, {
                    W: 720, H: 180, t0: f.t0, t1: f.t0 + span, ymax: ymax, marks: x.marks, elapsed: true,
                    label: String(s.id).slice(0, 8) + ' 的 context，' + f.pts + ' 點，峰值 ' + tokens(f.peak),
                }) + '</div>';
        };
        var row = function (s, f) {
            return '<tr><td class="sid">' + esc(String(s.id).slice(0, 8)) + '<span class="s2">' + esc(s.state + ' · ' + s.stage) + '</span></td>'
                + '<td class="v r">' + tokens(f.peak) + '<span class="s2">' + (f.peakN ? '回合 ' + f.peakN + ' · ' : '') + comma(f.peak) + '</span></td>'
                + '<td class="v r">' + f.requests + '<span class="s2">' + f.pts + ' 點 ＋ ' + f.noTime + ' no time</span></td>'
                + '<td class="v r">' + cents(f.cents) + '<span class="s2">' + (f.cents === f.agentCents ? '＝' : '≠')
                + ' agentsOf() ' + cents(f.agentCents) + '</span></td>'
                + '<td class="v r">' + f.back + '</td></tr>';
        };
        return chart(a, xa, fa) + '<div style="height:14px"></div>' + chart(b, xb, fb)
            + '<p class="cmpnote">兩張圖共用 y 軸（0 到 ' + tokens(ymax) + '）與 x 軸的長度（' + mins(span)
            + '）；x 是從各自第一個 request 起算的經過時間，所以同一個橫座標是「開工後同樣久」。每張圖仍然只有一條線。</p>'
            + '<div class="figs"><table><thead><tr><th>session</th><th class="r">峰值 context</th><th class="r">requests</th>'
            + '<th class="r">派工 USD</th><th class="r">倒退</th></tr></thead><tbody>' + row(a, fa) + row(b, fb) + '</tbody></table></div>'
            + '<p class="cmpnote">每一格都和各自 session 的細節面板出自同一個欄位：峰值與 requests 是 context 折線的，'
            + '派工 USD 是派工表各列的和，倒退是階段順序的。</p>'
            + '<div class="cmpseq">' + [[a, xa], [b, xb]].map(function (p) {
                return '<h3>' + esc(String(p[0].id).slice(0, 8)) + ' · ' + p[1].seq.length + ' 步 · 倒退 ' + p[1].backtracks + '</h3>'
                    + seqHtml(p[1].seq, p[1].backs, p[0].route, p[0].stage, false);
            }).join('') + '</div>';
    }
    function cmpPage() {
        var two = picked.map(function (id) {
            return S.sessions.filter(function (s) { return s.id === id; })[0];
        }).filter(Boolean);
        var head = '<div class="phead"><h1>比較</h1><span class="spacer"></span>'
            + '<span class="ctl" data-page="list">☰ 回清單</span></div>';
        if (two.length < 2) {
            return head + '<div class="card"><div class="cbody"><p class="mute">在清單上勾兩個有細節的 session，'
                + '這裡就上下並排比較它們。</p></div></div>';
        }
        two.forEach(needDetail);
        var xa = DETAIL[two[0].id], xb = DETAIL[two[1].id];
        return head + '<div class="card cmpcard"><div class="cbody">'
            + (xa && xb ? compareHtml(two[0], xa, two[1], xb) : '<p class="mute">讀取細節…</p>') + '</div></div>';
    }

    function draw() {
        var p = doc.getElementById('page');
```

In `assets/station/station.css`, replace:

```css
.tds{font-size:10.5px;color:var(--mute);margin-top:3px}
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.css`:

```css
.tds{font-size:10.5px;color:var(--mute);margin-top:3px}

/* 比較 */
.cmpcard{max-width:1080px}
.cmpcard .cbody{padding:16px 20px 18px}
.cmph{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 2px}
.cmph .sid,.figs td.sid{font:600 12px var(--mono);color:var(--fg)}
.cmph .tk{font-size:12.5px;color:var(--fg-2);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 200px}
.cmph .meta{font:11px var(--mono);color:var(--mute);white-space:nowrap}
.figs{overflow-x:auto;margin-top:12px}
.figs table{min-width:560px}
.figs td{padding:10px;vertical-align:top}
.figs td.v{font:600 16px var(--mono);font-variant-numeric:tabular-nums;color:var(--fg)}
.figs .s2{display:block;font:400 10.5px var(--mono);color:var(--mute);margin-top:2px;white-space:normal}
.cmpnote{font-size:11.5px;color:var(--mute);line-height:1.55;margin:8px 0 0}
.cmpseq h3{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);margin:14px 0 4px}
```

In `docs/station.md`, replace:

```md
A stale row's clear control is the one thing that differs between the served
```

That text occurs exactly once in the file; replace it whole.

With, in `docs/station.md`:

```md
**比較** is a third view. Tick two sessions on 清單 — only a session with a
detail can be ticked, and a third tick drops the first — and 比較 on the rail
opens them one above the other: two context lines on one y axis and one x
length, x being the time since each one's first request, each still a single
line; under them their peak context, request count, dispatch dollars and
backward steps side by side, each from the same field that session's own panel
prints it from; and both stage sequences. It is the before-and-after view for a
change to a skill.

A stale row's clear control is the one thing that differs between the served
```


- [ ] **Step 4: Correct the citations the new lines moved.** `node scripts/docs-check.js` names them as `moved:`; with this plan's tasks landed in order the corrections are:

- In `docs/station.md`: the assets/station/station.js citation now at line 776 → the line docs-check prints (this plan expects 786)
- In `docs/station.md`: the assets/station/station.js citation now at line 480 → the line docs-check prints (this plan expects 486)
- In `docs/station.md`: the assets/station/station.js citation now at line 497 → the line docs-check prints (this plan expects 503)
- In `docs/station.md`: the assets/station/station.js citation now at line 809 → the line docs-check prints (this plan expects 819)
- In `docs/station.md`: the assets/station/station.js citation now at line 587 → the line docs-check prints (this plan expects 593)
- In `docs/station.md`: the assets/station/station.js citation now at line 538 → the line docs-check prints (this plan expects 544)

If another task landed in between and moved the same lines further, use the number docs-check prints instead. Then `node scripts/docs-check.js` exits 0.

- [ ] **Step 5: Run it and watch it pass.**

```
node --test tests/station-compare.test.js tests/station-view.test.js
```

It prints `ℹ pass 29 ℹ fail 0`. Then the four checks, each run on its own and judged by its exit code, not through a pipe: `npm test`, `node scripts/docs-check.js`, `node scripts/todo-check.js`, `node scripts/skills-check.js` — all exit 0.

- [ ] **Step 6: Commit.**

```
git add assets/station/station.js assets/station/station.css docs/station.md tests/station-compare.test.js
git commit -m "feat: 比較 sets two sessions on one scale"
```


## Task 30: The overview's stage ledger grouped by route, backtracks on a row of their own

Design §11: the 七個階段 card (`overview()` in `assets/station/station.js`) sums every session's stages regardless of route. Every cross-session average and per-stage figure is now taken inside one route — `spike`, `bounded`, `architectural` by name, a hand-written route by its stages — and never across two. A session with a backtrack (the same count as §7's stage order) is counted in its group but kept out of its averages, on a `有倒退` row of its own, and each group says how many sessions stepped back and how many times. The overview redesign itself is not in this task (the design files it as a TODO at land). `out.classes` is added below the `lib/station.js` lines `docs/station.md` cites, so it moves none of them. On 2026-09-11 the served overview grouped 13ebea34 under `architectural` and 05de9a54 — whose route has no `audit` — under its own stages, with its one backtrack.

**Files:**
- Modify: `lib/station.js` — `serialize()` carries the class routes as `classes`
- Modify: `assets/station/station.js` — `routeGroups`, `routeLedger` replace `stageLedger`
- Modify: `assets/station/station.css` — the group heading
- Modify: `docs/station.md` — the grouped ledger; six view-script citations
- Read: `lib/stages.js` — `CLASSES`
- Test: `tests/station-routes.test.js`

**Interfaces:**
- Consumes: `CLASSES` from `lib/stages.js`; the serialized session field `backtracks` (Task 25)
- Produces: `serialize()` field `classes: { spike, bounded, architectural }` (routes); view exports `routeGroups(R, classes)` → `[{ name, route, n, clean, backN, backtracks, stages: { <stage>: { n, ms, wait, burn, usd } }, back: { ms, wait, burn, usd } }]`, `routeLedger(R)`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing test.** Create `tests/station-routes.test.js` with:

```js
'use strict';
// The overview's stage ledger is grouped by route, and a session that stepped
// back is counted in its group but kept out of its averages.
const test = require('node:test');
const assert = require('node:assert/strict');
const { CLASSES } = require('../lib/stages.js');

const classes = Object.fromEntries(Object.entries(CLASSES).map(([name, c]) => [name, c.route]));
global.window = { STATION: { serve: false, classes } };
const V = require('../assets/station/station.js');

const stage = (name, ms, usd) => ({ stage: name, from: 0, to: ms, burn: 1000, usd, waited: 0 });
const bounded = { route: classes.bounded, backtracks: 0, stages: [stage('survey', 60000, 0.5), stage('build', 120000, 2)] };
const clean = { route: classes.architectural, backtracks: 0, stages: [stage('survey', 100000, 1), stage('build', 300000, 3)] };
const back = { route: classes.architectural, backtracks: 2, stages: [stage('survey', 900000, 9), stage('build', 900000, 9)] };
const hand = { route: ['survey', 'build', 'land'], backtracks: 0, stages: [stage('survey', 1000, 0.1)] };

test('routeGroups: one group per route, a class route under its name, averages only from sessions that did not step back', () => {
    const groups = V.routeGroups([bounded, clean, back, hand], classes);
    const arch = groups.find((g) => g.name === 'architectural');
    assert.deepEqual([arch.n, arch.clean, arch.backN, arch.backtracks], [2, 1, 1, 2]);
    assert.deepEqual(arch.stages.survey, { n: 1, ms: 100000, wait: 0, burn: 1000, usd: 1 }, 'the backtracking session is not in the average');
    assert.deepEqual(arch.back, { ms: 1800000, wait: 0, burn: 2000, usd: 18 });
    assert.equal(groups.find((g) => g.name === 'bounded').stages.survey.usd, 0.5, 'no average crosses two groups');
    assert.ok(groups.some((g) => g.name === 'survey → build → land'), 'a hand-written route is named by its stages');
});

test('routeLedger prints each group\'s sessions and backtracks, and the 有倒退 row apart from the stage rows', () => {
    const html = V.routeLedger([bounded, clean, back]);
    assert.match(html, /<b>architectural<\/b><span class="mute">2 個 session · 有倒退 1 個、倒退 2 次/);
    assert.match(html, /<b>bounded<\/b><span class="mute">1 個 session · 有倒退 0 個、倒退 0 次/);
    const arch = html.slice(html.indexOf('<b>architectural'), html.indexOf('<b>bounded'));
    assert.match(arch, />survey<\/span>[\s\S]*?\$1\.00/, 'survey averages the clean session alone');
    assert.match(arch, /有倒退<\/span>[\s\S]*?\$18\.00/, 'the backtracking session\'s whole cost is its own row');
    assert.equal((html.match(/有倒退<\/span>/g) || []).length, 1, 'only the group with one has the row');
});
```

- [ ] **Step 2: Run it and watch it fail.**

```
node --test tests/station-routes.test.js
```

It prints `ℹ pass 0 ℹ fail 2`, the first failures reading `TypeError: V.routeGroups is not a function` and `TypeError: V.routeLedger is not a function`.

- [ ] **Step 3: Write the implementation.**

In `lib/station.js`, replace:

```js
const { positionIn } = require('./stages.js');
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
const { positionIn, CLASSES } = require('./stages.js');
```

In `lib/station.js`, replace:

```js
    if (opts.nonce) out.nonce = opts.nonce;
```

That text occurs exactly once in the file; replace it whole.

With, in `lib/station.js`:

```js
    // The three classes' routes by name, so the overview can group sessions by
    // route and call a route a class names by that class's name.
    out.classes = Object.fromEntries(Object.entries(CLASSES).map(([name, c]) => [name, c.route]));
    if (opts.nonce) out.nonce = opts.nonce;
```

In `assets/station/station.js`, replace:

```js
            figures: figures, compareHtml: compareHtml,
        };
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            figures: figures, compareHtml: compareHtml,
            routeGroups: routeGroups, routeLedger: routeLedger,
        };
```

In `assets/station/station.js`, replace:

```js
    function stageLedger(R) {
        var st = {};
        R.forEach(function (s) {
            s.stages.forEach(function (w) {
                if (!st[w.stage]) st[w.stage] = { n: 0, ms: 0, wait: 0, burn: 0, usd: 0 };
                var x = st[w.stage];
                x.n++;
                x.ms += Math.max(w.to - w.from, 0);
                x.wait += w.waited || 0;
                x.burn += w.burn || 0;
                x.usd += w.usd || 0;
            });
        });
        var max = Math.max.apply(null, ROUTE.map(function (k) {
            return st[k] ? st[k].ms + st[k].wait : 0;
        })) || 1;
        return '<table><colgroup><col style="width:86px"><col><col style="width:70px">'
            + '<col style="width:70px"><col style="width:56px"></colgroup>'
            + '<thead><tr><th>階段</th><th>做事 / 等你</th><th class="r">context</th>'
            + '<th class="r">花費</th><th class="r">等待</th></tr></thead><tbody>'
            + ROUTE.map(function (k) {
                var x = st[k];
                if (!x) return '';
                return '<tr><td><span class="chip" style="background:' + STAGE_C[k]
                    + '1f;border-color:transparent;color:' + STAGE_C[k] + ';font-weight:600">'
                    + k + '</span></td>'
                    + '<td><div class="mini"><span style="width:' + (x.ms / max * 100)
                    + '%;background:' + STAGE_C[k] + '"></span><span style="width:'
                    + (x.wait / max * 100) + '%;background:' + STAGE_C[k] + '38"></span></div>'
                    + '<div class="mute" style="font-size:10.5px;margin-top:4px">'
                    + hours(x.ms) + ' 做事 · ' + hours(x.wait) + ' 等你</div></td>'
                    + '<td class="r num mute">' + tokens(x.burn) + '</td>'
                    + '<td class="r num">' + usd(x.usd) + '</td>'
                    + '<td class="r num" style="color:'
                    + (x.wait > x.ms ? 'var(--dn)' : 'var(--mute)') + '">'
                    + Math.round(x.wait / (x.ms + x.wait || 1) * 100) + '%</td></tr>';
            }).join('') + '</tbody></table>';
    }
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
    // A seven-stage session and a three-stage one averaged together describe
    // neither, so every cross-session figure is taken inside one route: a
    // class's route under the class's name, a hand-written route under its
    // own stages, and no average crosses two groups. A session that stepped
    // back — `backtracks`, the count the detail panel's stage order prints —
    // is counted in its group but kept out of its averages, on a row of its
    // own.
    function routeName(route, classes) {
        var key = (route || []).join('>');
        for (var k in classes || {}) if ((classes[k] || []).join('>') === key) return k;
        return (route || []).join(' → ') || '（沒有 route）';
    }
    function routeGroups(R, classes) {
        var by = {}, order = [];
        R.forEach(function (s) {
            var name = routeName(s.route, classes);
            if (!by[name]) {
                by[name] = { name: name, route: s.route || [], n: 0, clean: 0, backN: 0, backtracks: 0, stages: {},
                    back: { ms: 0, wait: 0, burn: 0, usd: 0 } };
                order.push(name);
            }
            var g = by[name];
            g.n++;
            if (s.backtracks > 0) {
                g.backN++;
                g.backtracks += s.backtracks;
                s.stages.forEach(function (w) {
                    g.back.ms += Math.max(w.to - w.from, 0);
                    g.back.wait += w.waited || 0;
                    g.back.burn += w.burn || 0;
                    g.back.usd += w.usd || 0;
                });
                return;
            }
            g.clean++;
            s.stages.forEach(function (w) {
                var x = g.stages[w.stage] || (g.stages[w.stage] = { n: 0, ms: 0, wait: 0, burn: 0, usd: 0 });
                x.n++;
                x.ms += Math.max(w.to - w.from, 0);
                x.wait += w.waited || 0;
                x.burn += w.burn || 0;
                x.usd += w.usd || 0;
            });
        });
        return order.map(function (k) { return by[k]; }).sort(function (a, b) { return b.n - a.n; });
    }
    // One table per route group; each stage row a per-session average over the
    // sessions in the group that reached the stage without stepping back, the
    // 有倒退 row the same averages over the ones that did. Nothing here is a
    // total, so nothing here has rows to add up to.
    function routeLedger(R) {
        var groups = routeGroups(R, S.classes);
        if (!groups.length) return '<div class="empty">這個篩選下沒有 session</div>';
        return groups.map(function (g) {
            var names = (g.route.length ? g.route : ROUTE).filter(function (k) { return g.stages[k]; });
            var per = names.map(function (k) { return (g.stages[k].ms + g.stages[k].wait) / g.stages[k].n; });
            if (g.backN) per.push((g.back.ms + g.back.wait) / g.backN);
            var max = Math.max.apply(null, per.concat([0])) || 1;
            var line = function (label, x, n, colour) {
                var ms = x.ms / n, wait = x.wait / n;
                return '<tr><td>' + label + '</td><td><div class="mini"><span style="width:' + (ms / max * 100)
                    + '%;background:' + colour + '"></span><span style="width:' + (wait / max * 100) + '%;background:'
                    + colour + '38"></span></div><div class="mute" style="font-size:10.5px;margin-top:4px">'
                    + hours(ms) + ' 做事 · ' + hours(wait) + ' 等你 · ' + n + ' 個</div></td>'
                    + '<td class="r num mute">' + tokens(Math.round(x.burn / n)) + '</td>'
                    + '<td class="r num">' + usd(x.usd / n) + '</td>'
                    + '<td class="r num" style="color:' + (wait > ms ? 'var(--dn)' : 'var(--mute)') + '">'
                    + Math.round(wait / (ms + wait || 1) * 100) + '%</td></tr>';
            };
            return '<div class="rgh"><b>' + esc(g.name) + '</b><span class="mute">' + g.n + ' 個 session · 有倒退 '
                + g.backN + ' 個、倒退 ' + g.backtracks + ' 次</span></div>'
                + '<table><colgroup><col style="width:96px"><col><col style="width:64px"><col style="width:64px">'
                + '<col style="width:52px"></colgroup><thead><tr><th>階段</th><th>平均：做事 / 等你</th>'
                + '<th class="r">context</th><th class="r">花費</th><th class="r">等待</th></tr></thead><tbody>'
                + names.map(function (k) {
                    return line('<span class="chip" style="background:' + STAGE_C[k] + '1f;border-color:transparent;color:'
                        + STAGE_C[k] + ';font-weight:600">' + k + '</span>', g.stages[k], g.stages[k].n, STAGE_C[k]);
                }).join('')
                + (g.backN ? line('<span class="chip" style="color:var(--dn);border-color:var(--dn)">有倒退</span>',
                    g.back, g.backN, 'var(--dn)') : '')
                + '</tbody></table>';
        }).join('');
    }
```

In `assets/station/station.js`, replace:

```js
            + '<div class="card"><div class="chd"><span class="ci">◫</span><h2>七個階段</h2>'
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            + '<div class="card"><div class="chd"><span class="ci">◫</span><h2>各 route 的階段</h2>'
```

In `assets/station/station.js`, replace:

```js
            + '<div class="cbody" style="padding-top:8px">' + stageLedger(R) + '</div></div>'
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.js`:

```js
            + '<div class="cbody" style="padding-top:8px">' + routeLedger(R) + '</div></div>'
```

In `assets/station/station.css`, replace:

```css
.cmpseq h3{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);margin:14px 0 4px}
```

That text occurs exactly once in the file; replace it whole.

With, in `assets/station/station.css`:

```css
.cmpseq h3{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);margin:14px 0 4px}
.rgh{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin:14px 0 4px;font-size:12.5px}
.rgh:first-child{margin-top:0}
.rgh .mute{font-size:11px}
```

In `docs/station.md`, replace:

```md
figure any more; a stage's own cost surfaces only in the aggregate
seven-stage ledger on **總覽**, not per row.
```

That text occurs exactly once in the file; replace it whole.

With, in `docs/station.md`:

```md
figure any more; a stage's own cost surfaces only in the aggregate
per-route stage ledger on **總覽**, not per row.
```

In `docs/station.md`, replace:

```md
stacked context flow by registry, a weekday bar, the waiting gauge and the
seven-stage ledger. A delta whose previous window holds nothing prints
```

That text occurs exactly once in the file; replace it whole.

With, in `docs/station.md`:

```md
stacked context flow by registry, a weekday bar, the waiting gauge and the
per-route stage ledger. A delta whose previous window holds nothing prints
```

In `docs/station.md`, replace:

```md
ratio moves in percentage points, and a rise in it is the bad direction.
```

That text occurs exactly once in the file; replace it whole.

With, in `docs/station.md`:

```md
ratio moves in percentage points, and a rise in it is the bad direction.

The stage ledger is grouped by route, because a seven-stage session and a
three-stage one averaged together describe neither: `spike`, `bounded` and
`architectural` each get a table under the class's name, a hand-written route
gets one under its own stages, and no average crosses two tables. Each stage
row is a per-session average over the sessions that reached that stage. A
session that stepped back — the backward step the detail panel's 階段順序
counts — is counted in its group but kept out of its averages, on a `有倒退`
row of its own, and every group's heading says how many such sessions it has
and how many backward steps between them.
```


- [ ] **Step 4: Correct the citations the new lines moved.** `node scripts/docs-check.js` names them as `moved:`; with this plan's tasks landed in order the corrections are:

- In `docs/station.md`: the assets/station/station.js citation now at line 786 → the line docs-check prints (this plan expects 832)
- In `docs/station.md`: the assets/station/station.js citation now at line 486 → the line docs-check prints (this plan expects 532)
- In `docs/station.md`: the assets/station/station.js citation now at line 503 → the line docs-check prints (this plan expects 549)
- In `docs/station.md`: the assets/station/station.js citation now at line 819 → the line docs-check prints (this plan expects 865)
- In `docs/station.md`: the assets/station/station.js citation now at line 593 → the line docs-check prints (this plan expects 639)
- In `docs/station.md`: the assets/station/station.js citation now at line 544 → the line docs-check prints (this plan expects 590)

If another task landed in between and moved the same lines further, use the number docs-check prints instead. Then `node scripts/docs-check.js` exits 0.

- [ ] **Step 5: Run it and watch it pass.**

```
node --test tests/station-routes.test.js tests/station.test.js
```

It prints `ℹ pass 32 ℹ fail 0`. Then the four checks, each run on its own and judged by its exit code, not through a pipe: `npm test`, `node scripts/docs-check.js`, `node scripts/todo-check.js`, `node scripts/skills-check.js` — all exit 0.

- [ ] **Step 6: Commit.**

```
git add lib/station.js assets/station/station.js assets/station/station.css docs/station.md tests/station-routes.test.js
git commit -m "feat: the overview's stage ledger is grouped by route, backtracks apart"
```

## Coverage

| promise | task |
|---|---|
| 每一節先寫一個現在會失敗的測試，改完變綠；`npm test`、`docs-check`、`todo-check`、 | every task — Global Constraints |
| `tests/render.test.js` 的容量測試不刪任何字就保持綠色。 | every task — Global Constraints |
| 每一節改到的 reference 頁（`docs/documents.md`、`docs/registry.md`、 | every task — Global Constraints |
| `signpost()` 多回一個 `dropped`；`buildMap()` 在導覽表下面印 | Task 1 |
| `firstTable()` 的回傳形狀不變，`tests/map.test.js:31-44` 照舊通過。 | Task 1 |
| 測試：30 列的導覽表，map 裡出現 `... and 6 more, not listed`。 | Task 1 |
| `PATHISH`（`scripts/docs-check.js:89`）多收一個選擇性的 `-M`（連字號與 en dash 都收）。 | Task 2 |
| 超出：`M` 大於檔案行數、或 `N > M`，報 past-end。 | Task 2 |
| 引文：頁面在引用旁引了字串時，那個字串要落在 `N..M` 之內；只在別處找到一次就報 | Task 2 |
| `scripts/docs-audit.js` 不動：它的兩處 `PATHISH.exec` 只讀 `hit[1]`。 | Task 2 |
| `docs/documents.md:321` 那條沒寫檔名的 `:445-453` 補上檔名（內容修正，不是規則）。 | Task 2 |
| 測試：`tests/docs-check.test.js` 新增三例——範圍超出、引文在範圍外、引文在範圍內。 | Task 2 |
| 每一條 drift 列出頁面日期之後動到它主題的最多三個 commit subject，並寫 | Task 3 |
| `skills/fankeel-audit/SKILL.md` 的分流：commit 本來就要改這個行為 → 改頁面； | Task 3 |
| `tests/docs-audit.test.js:76`（頁面比主題新就不算 drift）保持不變。 | Task 3 |
| 測試：drift fixture 帶一個 commit，那一列帶著它的 subject。 | Task 3 |
| `TODO.md` 的前言寫明〔群組〕前綴的慣例：只是方便掃讀，不改變條目的狀態，也不改變 | Task 4 |
| `scripts/todo-check.js` 與 `INIT` 不動。 | Task 4 |
| 這條 Needs a decision 由這一節結案。 | Task 4 |
| A `caveman-learn` → `skills/fankeel-build/SKILL.md` 一條：以成本為理由的改動，plan 的 task 寫明量它的 script 與改前的數字，verify 用同一支再量一次，沒有變好就把那個 task 退回，不留著。 | Task 5, Task 13, Task 14 |
| B `caveman-stats` → `skills/fankeel-verify/SKILL.md` 的證據表：成本、token、計數類的說法，證據欄貼的是一次沒有經過管線截斷的命令輸出，不是模型估的，也不是重打的命令。 | Task 6 |
| C `cavecrew-builder` → `agents/fankeel-fixer.md`：工具只有 Read、Edit、Write、Grep、Glob（沒有 Bash、沒有 PowerShell），碰到三個以上檔案的改動就拒絕，回傳改了哪幾行；model 下限 sonnet。 | Task 7 |
| D `cavemem` 的 `supersede`/`history` → 第 5 節的修正慣例。 | Task 11 |
| 解耦：`lib/badge.js:166,181` 的註解改成「別的外掛的旗標」，不點名；reference 頁不再把 caveman 寫成一個還在的依賴（`docs/plans/2026-09-08-behaviour-eval.md` 是 plan 紀錄，不動）。 | Task 8 |
| 解除安裝是使用者的指令，land 時提出，不由 session 執行。 | Task 11 |
| `scripts/memory-check.js [--root <project>] [--config-dir <dir>]` 找 `<configDir>/projects/<slug>/memory/`，slug 由專案絕對路徑把 `:`、`\`、`/` 換成 `-`（`F:\ymlab\fankeel` → `F--ymlab-fankeel`）。 | Task 9 |
| 只報告、從不寫檔。報的有四種：索引與檔案兩個方向對不上；引用的 repo 路徑已不存在 | Task 9, Task 10 |
| 只看第一段是專案頂層已追蹤項目的路徑，所以 `~/.claude/...`、別的專案、`.fankeel/build/<plan>/` 這種樣板片段都不報。 | Task 9 |
| 前三種讓 exit 非零；`stale` 只列出來，因為一條正確的 memory 也可以引一個後來改過的檔。 | Task 9, Task 10 |
| 重用 `resolveRef`（`scripts/docs-check.js:158`）、`CODE` 與 `PATHISH`、`lib/docs.js` 的 `frontmatter()`，不另寫 regex。 | Task 9, Task 10 |
| 修正慣例（勾了 D 才有）：改錯的條目保留一行 `**Corrected YYYY-MM-DD:**` 說錯在哪，不默默改寫；刪除只刪使用者從清單上點的。 | Task 11 |
| 觸發：`/fankeel-audit` 把它當第四支 scanner 跑；fankeel-land skill 在「這個任務寫過 memory」時點它一次。不進注入規則。 | Task 11 |
| 測試：fixture memory 目錄——失效路徑被報、別專案路徑不報、git fixture 造出 `stale`、索引兩個方向對不上都被報。 | Task 9, Task 10 |
| `scripts/sessions.js --config-dir <dir> --project <slug>`：由 | Task 13 |
| 大輸出提醒。官方 hooks 文件（https://code.claude.com/docs/en/hooks.md）說 PostToolUse | Task 12, Task 14 |
| 第二次 verify→build：`task.js stage build` 發現 `moves` 裡已經有一次 verify→build 時， | Task 15 |
| 測試：size hook 收到 30k 的輸出說話、1k 不說；stage 用 `moves` fixture。 | Task 14, Task 15 |
| 新鍵 `class.default`（spike \| bounded \| architectural），在 `scripts/task.js:506` | Task 16 |
| `task.js start` 碰到沒有 `profile.json` 的專案，印出 `suggest` 的結果，加上一行可以 | Task 16 |
| `task.js land merge\|pr\|keep [--push\|--no-push]` 把 `land: {integration, push, at}` 記進 | Task 17 |
| 不做 `reply.language`：CLAUDE.md 和 memory 已經帶了這個偏好，容量也放不下。不做 | struck — design 自己說明是不做的決定：`reply.language` 已由 CLAUDE.md 與 memory 涵蓋且容量不足；plan 檔的鍵留給 class 決定，沒有第二個鍵可加。 |
| `docs/registry.md` 的欄位表，以及 `skills/fankeel/SKILL.md:111` 的 `Eleven more`， | Task 17 |
| 官方 hooks 文件說 subagent 內觸發的 hook 輸入多帶 `agent_id` 與 `agent_type`， | Task 12, Task 18 |
| build 的第一步和第 6 節一起探測；runtime 沒帶 `agent_type` 時改成 Waiting 條目，並在 | Task 12, Task 18 |
| 測試：fixture payload——reader 帶 `>` 被拒、帶 `\| grep` 放行、verifier 放行。 | Task 18 |
| 面板的區塊依 session 的狀態決定預設開合：還活著的 session 預設打開摘要與 claims | Task 26 |
| context 折線只畫一條線。x 是時間，y 是每個 request 的 context（input 加 cache read | Task 26 |
| 最大的五次上升各標出原因：兩個 request 之間進來的是哪一個工具的輸出、哪一次派工的 | Task 21 |
| 階段序列與倒退次數都從 transcript 裡真正執行的 `task.js` 指令算，`moves` 只在沒有 | Task 21 |
| 階段邊界的時間取 transcript 裡 `task.js start\|stage\|route` 那個指令的時間戳記； | Task 21 |
| 美元、tokens、秒數三欄用最大餘數法捨入，所以每一個印出來的總數都等於它下面各列的 | Task 21 |
| `spanOf()` 改成 export，station 直接用它，不另外寫一份同樣的邏輯。沒有時間戳記的 request 不畫，寫 `N requests with no time`。超過 240 點就 | Task 19, Task 21, Task 26 |
| 派工每一列加上耗時、tokens、美元。tokens 與美元來自那個 agent 自己的 transcript | Task 27 |
| 派工每一列再多一欄「回傳字元」：那次派工的結果進入主 context 的長度（背景 agent 是 | Task 20 |
| 一個 session 的所有 workflow run 都要算進去，不只是最新的一個：`05de9a54` 有兩個。 | Task 20 |
| 比較視圖除了共用 y 軸，x 軸的長度也共用，兩張圖在同一個時間刻度上比。 | Task 29 |
| 過程還原：從主 transcript 抽事件，一個事件一列，照時間排——使用者的 prompt（前 60 | Task 22 |
| 每一次派工在過程還原裡是一列，點開後展開它自己的步驟：讀了哪些檔、改了哪些檔、跑了 | Task 22 |
| 寫入的界線：靜態頁什麼都不寫；serve 模式只在使用者按下按鍵時寫，能寫的是既有的 | Task 28 |
| 記成 TODO（B6）：serve 模式在每一次標出原因的上升、每一次倒退旁邊放一個按鍵，預填 | Task 28 |
| `todo-check.js` 只 export 了整份檔的 `check(file, now)`（`:207`、`:395`），沒有單條的 | Task 28 |
| 並排比較（B7）：在列表上勾兩個 session，打開比較視圖。兩張折線上下排、共用同一個 | Task 29 |
| 快取：每個 session 抽出來的結果存在 `<configDir>/fankeel/station/cache/<session>.json`， | Task 24 |
| 只留在本機：頁面與快取都放在 gitignored 的位置，還原裡的 prompt 片段不會離開這台 | Task 25 |
| `lib/usage.js` 新增 `dispatchesOf()`，每一次派工一列： | Task 20 |
| 任務：這個 session 的 claims 裡的 `docs/plans/<stem>.md`（不含 `-design`）對到 | Task 23 |
| 階段順序：照 `moves` 的次序畫，倒退的那一步標出來。 | Task 21 |
| 平行提示：每個 task 旁邊放 `plantasks` 算出的分組。同一組的 task 如果在不同回合派出， | Task 23 |
| `assets/station/station.js` 的 `drawDetail()` 多三塊：任務、派工、階段順序。版面照 | Task 26, Task 27 |
| 還沒完成的 task 在 ledger 裡沒有 `Task` 行，所以任務列來自 plan 的 task 清單；ledger | Task 23 |
| workflow 的派工預設收合成每個 phase 一列（agent 數、tokens 合計），點開才展開逐列。 | Task 27 |
| 每個 stage 自己的成本照舊不顯示（`docs/station.md:129`）。 | Task 26 |
| 成品檢查：這個 session 的頁面上，折線的點數加上 `no time` 的數目，等於摘要列的 | Task 27 |
| 總覽上每一個跨 session 的平均、每一個分 stage 的彙總，都只在同一個 route 裡算： | Task 30 |
| 有倒退的 session（階段序列裡出現往回的一步，算法同第 7 節）照樣計入它那一組的 | Task 30 |
| 第 7 節的快取再多存 `project`、`day`（開始的日期）、`class`、`route`、`backtracks`、 | Task 24 |
| 總覽改版的版面不在這個任務：兩個專案並排、單一專案、某一天的花費、趨勢折線。land | struck — the design files the overview redesign as a TODO entry written at land, with its own mockup; nothing here builds it |
| 測試：三個 fixture session——一個 bounded、一個 architectural、一個有倒退的 | Task 30 |
