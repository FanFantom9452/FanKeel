---
status: design-intent
last_verified: 2026-09-07
source_of_truth: lib/plantasks.js, scripts/ledger.js, lib/ledger.js, lib/stages.js, skills/fankeel-plan/SKILL.md, skills/fankeel-build/SKILL.md
---

# Plan Quality and the Build Brief — Implementation Plan

**Goal:** a plan cannot reach `build` with a design promise dropped, a fence
that names no file, or a `Read:` nobody wrote down; and a build implementer
starts from a brief file that carries everything it may read and everything
it must return.

**Architecture:** `lib/plantasks.js` learns the `Read:` kind, keeps each task's
section text, and gains `lint(plan, design)` — pure functions over two strings.
`scripts/ledger.js` gains three verbs over them: `lint` (exit code), `brief <n>`
(writes the task's brief file) and `fix` (a reviewed fix commit's ledger line).
The stage anchors in `lib/stages.js` and the four skills say when each is run.
Nothing new touches git, hooks or the registry.

**Tech Stack:** Node 22 (`node:test`, `node:util` `parseArgs`), no dependencies.

**Spec:** [2026-09-07-plan-quality-design.md](2026-09-07-plan-quality-design.md)

## Global Constraints

Generated from this project on 2026-09-07, not remembered.

- **No dependency may be added.** `package.json` has no `dependencies` key at
  all.
- **`npm test` is `node --test`.** The spec reporter prints `✔`/`✖` and an
  `ℹ pass` / `ℹ fail` summary. It prints **no TAP `ok` lines** — a grep for
  `ok` returns nothing and that is not a failure signal.
- **Style, from every file in `lib/` and `scripts/`:** `'use strict';` as line 1
  (after the shebang in `scripts/`), four-space indent, CommonJS `require`,
  `module.exports` last, and a comment block at the top of the file saying
  *why* rather than *what*. Match it. Tests use two-space indent.
- **`tests/source.test.js` reads `git ls-files '*.js'`.** This plan creates no
  `.js` file, so nothing here is invisible to it.
- **`tests/skills.test.js`** — `name` equals the directory (`:37`);
  `description` is longer than 60 and shorter than 500 characters and contains
  `Use for` or `Use when` (`:46`); every stage skill contains `AskUserQuestion`
  and `**Done when**` (`:140`, `:154`); a split skill's `rationale.md`
  frontmatter carries `source_of_truth` naming `skills/<n>/SKILL.md` **and every
  path the SKILL.md's own `source_of_truth` names** (`:205-211`), and no
  `version` (`:214`); **the fenced block under a stage skill's `## Output`
  equals `templateFor(stage)` in `lib/stages.js`, line for line** (`:383`).
- **`tests/render.test.js:534`** — every stage's injection is under 2400
  characters at a 59-character plugin root. Measured 2026-09-07: plan 2393,
  build 2386, verify 2394, design 2339. Room: **plan 7, build 14, verify 6.**
  Run `node --test tests/render.test.js 2>&1 | grep 'chars at'` to read them.
- **`tests/render.test.js:270`** — `docs/pipeline.md` carries exactly two copies
  of each `ALWAYS` rule. Only `ALWAYS` is checked; the stage rules it also shows
  are prose.
- **`tests/stages.test.js:92`** — each stage's untokenised rules joined are under
  2000 characters (plan 1831, build 1789, verify 1740 today).
  `tests/stages.test.js:648` pins the build entry line verbatim, `:662` the plan
  entry line verbatim, `:676` that build's still says `resume the fixer, commit
  shape.`, and `:647` that plan's still says
  `` carries `**Files:**`, `**Interfaces:**` and a `**Dispatch:**` line ``.
- **`tests/plantasks.test.js`** pins: only the first backticked token on a
  `Files:` entry is taken (`:119`); a fenced block is never a declaration
  (`:133`, `:154`); a task with an empty `Modify:` conflicts with everything
  (`:64`, `:188`); `Interfaces:` entries take every backticked token (`:81`).
- **`scripts/ledger.js`:** flags precede the verb; `VERBS` (`:40`) and
  `STRING_FLAGS` (`:34`) are read by `lib/argv.js` `splitAtVerb`, so a new verb
  goes in the set or a flag will spend it; `main` returns a string and
  `require.main` prints it once (`:288`); `fail()` prints and exits 1 (`:27`).
- **`lib/ledger.js:34`** — `RANGE` is the one spelling of a review range;
  `isRange` is the writer's check and `completions` the reader's.
- **`tests/contract.test.js`** fails when the version disagrees across
  `package.json`, `.claude-plugin/plugin.json` and every `skills/*/SKILL.md`.
  Do not hand-edit a version; `land` runs `scripts/version.js`.
- **`.fankeel/docs.json` roles:** `docs` → reference, `docs/plans` → plan,
  `skills` → reference. `.fankeel/.gitignore` ignores `sessions/`, `map.md`,
  `build/`, `station.html` — a brief written under `.fankeel/build/` is never
  committed, which is the point.
- **A subagent gets no stage rules.** Whatever binds an implementer travels in
  the brief file this plan creates, or it does not reach it.

## File structure

| file | responsibility after this change |
|---|---|
| `lib/plantasks.js` | reads a plan and a design; now also `Read:`, task bodies, the plan header, fences and `lint` |
| `scripts/ledger.js` | the ledger CLI; now also `lint`, `brief` and `fix` |
| `lib/ledger.js` | the ledger's line shapes; now also the `Fix:` line and its reader |
| `lib/stages.js` | the injected anchors; plan, build and verify reworded within the cap, plan's template gains two slots |
| `skills/fankeel-plan/SKILL.md` | the plan contract: `Read:`, fences name their file, `## Coverage`, `lint`, the plan reviewer |
| `skills/fankeel-build/SKILL.md` | the loop: the brief file, the return contract, the reviewer template, fix rows |
| `skills/fankeel-verify/SKILL.md`, `skills/fankeel-design/SKILL.md` | a fix is build's commit; the end-to-end criterion and numbered sections |
| `docs/pipeline.md`, `docs/subagents.md`, `docs/README.md`, `TODO.md` | describe the above and close the `## Ready` entry |

---

## Task 1: `Read:`, task bodies, fences and `lint` in `lib/plantasks.js`

**Files:**
- Modify: `lib/plantasks.js` — `ENTRY` accepts `Read`; `parsePlan` keeps `header`, `line`, `body`, `read` and `producesText`; `conflict` returns `'read'`; `fences`, `promises`, `filedPaths`, `lint` added
- Read: `tests/ledger.test.js` — run once at the end, never edited here
- Test: `tests/plantasks.test.js`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: `parsePlan` — called `parsePlan(text)`, returns `{ header, tasks }`,
  where `header` is the text before the first task and each task carries
  `read` (string[]), `producesText` (string[]), `line` (number) and `body`
  (string); `parseTasks` — `parseTasks(text)` is `parsePlan(text).tasks`,
  unchanged for every caller; `conflict` — `conflict(a, b)` returns `'read'`
  when one reads what the other modifies or tests; `fences` — `fences(task)`
  returns `[{ line, info, named }]`; `lint` — `lint(planText, designText)`
  returns string[] of report lines, empty when clean; `normalise`, `keyOf`,
  `promises`, `filedPaths`, `EXEMPT`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Test first.** Append these to `tests/plantasks.test.js`, run
`node --test tests/plantasks.test.js`, and watch exactly nine fail — every
`parsePlan`, `fences`, `lint` and `Read` test — before touching the library.
The existing `task()` helper stays; a second helper writes a task with a
`Read:` line and a body.

In `tests/plantasks.test.js`, after the existing `task` helper, add:

```js
// A task with a Read: line and a body. The fence shape here is the one `lint`
// reads: a language fence names its file within three non-blank lines above.
const readTask = (n, modify, reads, body) => [
  '## Task ' + n + ': name',
  '',
  '**Files:**',
  ...modify.map((p) => '- Modify: `' + p + '`'),
  ...reads.map((p) => '- Read: `' + p + '` — why'),
  '',
  '**Interfaces:**',
  '- Consumes: nothing.',
  '- Produces: nothing.',
  '',
  ...(body || []),
  '',
].join('\n');

const design = (bullets, rows, files) => [
  '# A design',
  '',
  '## The ask',
  '',
  '- not a promise: this section is not numbered',
  '',
  '## 1. The first area',
  '',
  ...bullets.map((b) => '- ' + b),
  '  - a nested bullet is not a promise either',
  '',
  '## File table',
  '',
  '| file | change | dispatch |',
  '|---|---|---|',
  ...(files || []).map((f) => '| `' + f + '` | something | implementer, sonnet |'),
  '',
  '## What proves it done',
  '',
  '| test | fails now because |',
  '|---|---|',
  ...(rows || []).map((r) => '| ' + r + ' | reason |'),
  '',
].join('\n');
```

In `tests/plantasks.test.js`, at the end of the file, add:

```js
test('a Read: entry lands in task.read and takes only its first backticked token', () => {
  const [t] = parseTasks(readTask(1, ['lib/a.js'], ['lib/b.js` beside `lib/c.js']));
  assert.deepEqual(t.modify, ['lib/a.js']);
  assert.deepEqual(t.read, ['lib/b.js']);
});

test('a Read of a file another task modifies serialises the pair as read', () => {
  const [a, b] = parseTasks(readTask(1, ['lib/a.js'], ['lib/b.js']) + task(2, ['lib/b.js'], [], [], []));
  assert.equal(conflict(a, b), 'read');
  assert.equal(conflict(b, a), 'read');
  assert.deepEqual(groups([a, b]), [[1], [2]]);
});

test('two tasks reading one file may run at once', () => {
  const [a, b] = parseTasks(readTask(1, ['lib/a.js'], ['lib/x.js']) + readTask(2, ['lib/b.js'], ['lib/x.js']));
  assert.equal(conflict(a, b), null);
});

test('parsePlan keeps the header and each task body, fences included, and a body stops at the next heading', () => {
  const text = [
    '# Plan', '', '**Spec:** design.md', '', '## Global Constraints', '', '- no deps', '',
    readTask(1, ['lib/a.js'], [], ['Some prose.', '', '```js', '## Task 9: not a task', '```']),
    '## Self-review', '', 'Not part of any task.', '',
  ].join('\n');
  const { header, tasks } = plantasks.parsePlan(text);
  assert.match(header, /\*\*Spec:\*\* design\.md/);
  assert.match(header, /## Global Constraints\n\n- no deps/);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].line, 9);
  assert.match(tasks[0].body, /^## Task 1: name/);
  assert.match(tasks[0].body, /## Task 9: not a task/);
  assert.doesNotMatch(tasks[0].body, /Self-review/);
  assert.deepEqual(parseTasks(text).map((t) => t.n), [1]);
});

test('producesText holds the raw text of each Produces entry', () => {
  const [t] = parseTasks(task(1, ['lib/a.js'], [], [], ['makeA']) );
  assert.deepEqual(t.producesText, ['`makeA`']);
});

test('fences lists language fences with the files named above them, and skips command fences', () => {
  const [t] = parseTasks(readTask(1, ['lib/a.js'], [], [
    'In `lib/a.js`, add:', '', '```js', 'x', '```', '',
    'Run:', '', '```', 'node --test', '```', '',
    'Then:', '', '```sh', 'npm test', '```', '',
    'In `gather()`, add:', '', '```js', 'y', '```',
  ]));
  const out = plantasks.fences(t);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].named, ['lib/a.js']);
  assert.equal(out[0].info, 'js');
  assert.deepEqual(out[1].named, ['gather()']);
});

test('lint names a promise whose first eight words appear nowhere in the plan, and is silent when the plan quotes it', () => {
  const d = design(['the page **gains** a `waited` column, one per stage, after the burn column', 'rows carry `data-state`'], []);
  const plan = readTask(1, ['lib/a.js'], [], ['## Coverage', '', '| promise | task |', '|---|---|', '| rows carry `data-state` | Task 1 |']);
  const out = plantasks.lint(plan, d);
  assert.equal(out.length, 1, out.join('\n'));
  assert.match(out[0], /promise with no task: the page \*\*gains\*\* a `waited` column/);
  const quoted = plan + '\n| the page gains a waited column, one per stage | Task 1 |\n';
  assert.deepEqual(plantasks.lint(quoted, d), []);
});

test('lint reads the What proves it done rows and the file table as promises', () => {
  const d = design([], ['`tests/a.test.js` — the thing fails now and passes after this lands'], ['lib/a.js', 'lib/zzz.js']);
  const plan = readTask(1, ['lib/a.js'], [], []);
  const out = plantasks.lint(plan, d);
  assert.equal(out.length, 2, out.join('\n'));
  assert.match(out[0], /promise with no task: `tests\/a\.test\.js` — the thing fails now/);
  assert.match(out[1], /design file table names lib\/zzz\.js, which no task modifies or tests/);
});

test('lint names a js fence with no file line above it, and a named path outside the Files block', () => {
  const plan = readTask(1, ['lib/a.js'], [], [
    'In `gather()`, add:', '', '```js', 'x', '```', '',
    'In `lib/other.js`, add:', '', '```js', 'y', '```',
  ]);
  const out = plantasks.lint(plan, design([], []));
  assert.equal(out.length, 2, out.join('\n'));
  assert.match(out[0], /Task 1 line \d+: a `js` fence names no file from its Files block/);
  assert.match(out[1], /Task 1 line \d+: `lib\/other\.js` is named but not in its Files block/);
  const ranged = readTask(1, ['lib/a.js'], [], ['In `lib/a.js:12`, add:', '', '```js', 'x', '```']);
  assert.deepEqual(plantasks.lint(ranged, design([], [])), []);
  const member = readTask(1, ['lib/a.js'], [], ['In `lib/a.js`, replace the `module.exports` line with:', '', '```js', 'x', '```']);
  assert.deepEqual(plantasks.lint(member, design([], [])), []);
  const routes = readTask(1, ['lib/a.js'], [], ['In `lib/a.js`, `POST /clear-stale` writes `roots.json` beside `/clear`; `source_of_truth: lib/b.js` stays:', '', '```js', 'x', '```']);
  assert.deepEqual(plantasks.lint(routes, design([], [])), []);
});
```

Now the library. In `lib/plantasks.js`, replace the three regexes at the top
and the `ticked` comment's neighbours with this block — `ENTRY` gains `Read`,
and two constants join it:

```js
const TASK = /^##\s+Task\s+(\d+):\s*(.*)$/;
const HEADING = /^##\s/;
const BLOCK = /^\*\*(Files|Interfaces):\*\*\s*$/;
const ENTRY = /^-\s*(Modify|Test|Read|Consumes|Produces):\s*(.*)$/;

// A fence whose info string is one of these holds a command or its output,
// not code that lands in a file, so it names no file. Everything else — `js`,
// `json`, `md`, a language nobody here has used yet — is code and must say
// where it goes.
const EXEMPT = new Set(['', 'sh', 'bash', 'shell', 'console', 'text']);
```

In `lib/plantasks.js`, replace the whole of `parseTasks` with `parsePlan` and a
one-line `parseTasks`:

```js
// The whole plan, not only its declarations. `header` is everything before the
// first task heading — the goal, the spec line, the constraints block — and a
// task's `body` is its section from its own heading to the next `## ` heading,
// fences included: `brief` writes both out for an implementer, and an
// implementer given a slice needs the slice whole. `line` is the heading's
// 1-based line in the plan, so a report can point at the file.
function parsePlan(text) {
    const tasks = [];
    const headerLines = [];
    let task = null;
    let block = null;
    // A fenced code block is an example of the format, not the format itself —
    // the `**Files:**` block a task's own Steps show to document the block's
    // shape must not thereby declare files. Markdown nests fences by opening
    // the outer one with more backticks than any fence inside it, so a shorter
    // run is content: only a line with at least as many backticks as the one
    // that opened the fence can close it.
    let fenceLen = 0;
    let n = 0;
    for (const raw of String(text || '').split(/\r?\n/)) {
        n += 1;
        const line = raw.trim();
        const t = fenceLen ? null : TASK.exec(line);
        if (t) {
            task = { n: Number(t[1]), name: t[2].trim(), line: n, modify: [], test: [], read: [], consumes: [], produces: [], consumesText: [], producesText: [], interfaces: false, lines: [] };
            tasks.push(task);
            block = null;
        } else if (!fenceLen && task && HEADING.test(line)) {
            // `## Self-review`, `## Coverage`: the tasks are over, and what
            // follows belongs to no task. It is not header either — the header
            // is what comes before the first task, because that is what a
            // brief needs to carry.
            task = null;
            block = null;
        }
        if (task) task.lines.push(raw);
        else if (!tasks.length) headerLines.push(raw);
        if (t) continue;
        const f = /^`{3,}/.exec(line);
        if (f) {
            if (fenceLen === 0) { fenceLen = f[0].length; continue; }
            if (f[0].length >= fenceLen) { fenceLen = 0; continue; }
        }
        if (fenceLen) continue;
        if (!task) continue;
        // A blank line closes the block. Without this, a `- Modify:` line in the
        // prose below the block reads as another declared file.
        if (!line) { block = null; continue; }
        const b = BLOCK.exec(line);
        if (b) { block = b[1].toLowerCase(); if (block === 'interfaces') task.interfaces = true; continue; }
        const e = ENTRY.exec(line);
        if (!e || !block) continue;
        const key = e[1].toLowerCase();
        const inFiles = block === 'files' && (key === 'modify' || key === 'test' || key === 'read');
        const inInterfaces = block === 'interfaces' && (key === 'consumes' || key === 'produces');
        if (inFiles || inInterfaces) task[key].push(...ticked(e[2], inInterfaces));
        if (inInterfaces) task[key + 'Text'].push(e[2].trim());
    }
    for (const t of tasks) {
        t.body = t.lines.join('\n').replace(/\s+$/, '');
        delete t.lines;
    }
    return { header: headerLines.join('\n').replace(/\s+$/, ''), tasks };
}

// The declarations alone, which is what every caller before `brief` wanted.
const parseTasks = (text) => parsePlan(text).tasks;
```

In `lib/plantasks.js`, in `conflict`, after the line `if (files.some(([x, y]) => shares(x, y))) return 'files';` add:

```js
    // A file being edited is not a file to read. A `Read:` of a neighbour's
    // `Modify:` or `Test:` waits for that neighbour's commit; two readers of
    // one file do not conflict, because nothing moves under either of them.
    const owned = (t) => [...t.modify, ...t.test];
    if (shares(a.read || [], owned(b)) || shares(b.read || [], owned(a))) return 'read';
```

In `lib/plantasks.js`, before `module.exports`, add the four readers `lint`
is made of, and `lint` itself:

```js
// Every fence opener in a task's section, with the files the lines above it
// name. Only the opener carries an info string, and markdown nests fences by
// length, so the closer is the next line with at least as many backticks.
// `named` is every backticked token in the three non-blank lines above, with a
// trailing `:12` or `:12-40` dropped, because a plan may point into a file and
// the Files block names the file alone.
function fences(task) {
    const out = [];
    const lines = String(task.body || '').split(/\r?\n/);
    let fenceLen = 0;
    for (let i = 0; i < lines.length; i++) {
        const f = /^(`{3,})(.*)$/.exec(lines[i].trim());
        if (!f) continue;
        if (fenceLen) { if (f[1].length >= fenceLen) fenceLen = 0; continue; }
        fenceLen = f[1].length;
        const info = f[2].trim().toLowerCase();
        if (EXEMPT.has(info)) continue;
        const above = [];
        for (let j = i - 1; j >= 0 && above.length < 3; j--) if (lines[j].trim()) above.push(lines[j]);
        const named = above.flatMap((l) => ticked(l, true)).map((p) => p.replace(/:\d+(-\d+)?$/, ''));
        out.push({ line: (task.line || 1) + i, info, named });
    }
    return out;
}

// Words only, lower-cased. Backticks, asterisks, dashes and every other mark
// become spaces, so a bullet quoted into a table cell with different emphasis
// still matches, and `<f>` reads as `f` on both sides.
const normalise = (s) => String(s || '').toLowerCase()
    .replace(/[`*]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const keyOf = (s) => normalise(s).split(' ').slice(0, 8).join(' ');

// The design's promises: every first-level bullet under a numbered `## N.`
// heading, and every body row of `## What proves it done`. A bullet under an
// unnumbered heading is context, and a nested bullet is detail of the one
// above it. Only the first line of a wrapped bullet is taken — eight words
// of it are the key, and a first line holds more than eight.
function promises(designText) {
    const out = [];
    let numbered = false;
    let proves = false;
    let fenceLen = 0;
    for (const raw of String(designText || '').split(/\r?\n/)) {
        const line = raw.trim();
        const f = /^`{3,}/.exec(line);
        if (f) {
            if (fenceLen === 0) fenceLen = f[0].length;
            else if (f[0].length >= fenceLen) fenceLen = 0;
            continue;
        }
        if (fenceLen) continue;
        if (HEADING.test(line)) {
            numbered = /^##\s+\d+\./.test(line);
            proves = /^##\s+what proves it done/i.test(line);
            continue;
        }
        if (numbered && /^-\s/.test(raw)) out.push(line.replace(/^-\s*/, ''));
        if (proves && line.startsWith('|') && !/^\|\s*-{2,}/.test(line) && !/^\|\s*test\s*\|/i.test(line)) {
            out.push(line.split('|')[1].trim());
        }
    }
    return out;
}

// Every backticked path in the first cell of a `| file | ... |` table.
function filedPaths(designText) {
    const out = [];
    let inTable = false;
    for (const raw of String(designText || '').split(/\r?\n/)) {
        const line = raw.trim();
        if (/^\|\s*file\s*\|/i.test(line)) { inTable = true; continue; }
        if (!line.startsWith('|')) { inTable = false; continue; }
        if (!inTable || /^\|\s*-{2,}/.test(line)) continue;
        out.push(...ticked(line.split('|')[1], true));
    }
    return out;
}

// A path, for the second report only, is directory-qualified: a slash inside
// it, no whitespace, and not a leading slash. `module.exports` is a member,
// `POST /clear-stale` and `/clear` are routes, `roots.json` is a file the
// program writes rather than one the task edits, and `source_of_truth:
// lib/a.js` is a frontmatter line — each was read as a path by a looser test.
const looksLikePath = (p) => /^[^/\s][^\s]*\/[^\s]+$/.test(p);

// What a plan got wrong against its design, one line each; empty is clean.
// Three checks, all text: a promise the plan never quotes, a path the design's
// file table names that no task modifies or tests, and a code fence with no
// file named above it — or one naming a file its task does not own. On the
// 2026-09-06 station plan this names the `waited` column, `data-state`, the
// cleared count and Task 7's `render()` fence, which is the incident this
// exists for.
function lint(planText, designText) {
    const { tasks } = parsePlan(planText);
    const out = [];
    const plan = normalise(planText);
    for (const p of promises(designText)) {
        const key = keyOf(p);
        if (key && !plan.includes(key)) out.push('promise with no task: ' + p.slice(0, 80));
    }
    const declared = new Set(tasks.flatMap((t) => [...t.modify, ...t.test]));
    for (const p of filedPaths(designText)) {
        if (!declared.has(p)) out.push('design file table names ' + p + ', which no task modifies or tests');
    }
    for (const t of tasks) {
        const files = [...t.modify, ...t.test, ...t.read];
        for (const f of fences(t)) {
            // A fence naming a file the task does not own gets the specific
            // line and not the general one: it did name a file.
            const owned = f.named.some((p) => files.includes(p));
            const foreign = f.named.filter((p) => !files.includes(p) && looksLikePath(p));
            if (!owned && !foreign.length) {
                out.push('Task ' + t.n + ' line ' + f.line + ': a `' + f.info + '` fence names no file from its Files block');
            }
            for (const p of foreign) out.push('Task ' + t.n + ' line ' + f.line + ': `' + p + '` is named but not in its Files block');
        }
    }
    return out;
}
```

In `lib/plantasks.js`, replace the `module.exports` line with:

```js
module.exports = { parsePlan, parseTasks, conflict, groups, proseConflicts, surfaces, missingInterfaces, fences, promises, filedPaths, normalise, keyOf, lint, EXEMPT };
```

Update the file's opening comment: the sentence "This file reads a plan and
nothing else" becomes "This file reads a plan, and a design where `lint` is
asked to, and nothing else." Then run `node --test tests/plantasks.test.js`
and watch every test pass, the sixteen that were there included. Run
`node --test tests/ledger.test.js` once as well: it drives `parseTasks`
through the CLI and must be untouched by this task.

Report to `.fankeel/build/2026-09-07-plan-quality/task-1-report.md`.

---

## Task 2: `lint`, `brief` and `fix` verbs in `scripts/ledger.js`

**Files:**
- Modify: `scripts/ledger.js` — three verbs, `serialCause` names a `read` conflict, `ranges` lists fixes
- Modify: `lib/ledger.js` — `fixLine`, `fixes`
- Read: `lib/plantasks.js` — `parsePlan`, `lint` and the task fields Task 1 added
- Read: `tests/plantasks.test.js` — run once at the end, never edited here
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: `parsePlan`, `lint`, `body`, `header`, `producesText`, `read` from
  Task 1; `isRange`, `ledgerPath`, `append`, `completions`, `owns` from
  `lib/ledger.js`, unchanged.
- Produces: verbs `lint`, `brief`, `fix`; `fixLine(what, range)` → the `Fix:`
  line; `fixes(text)` → `[{ what, range }]`; the brief file
  `.fankeel/build/<plan>/task-<n>-brief.md`; `FOOTER`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Test first.** Append these to `tests/ledger.test.js`, run
`node --test tests/ledger.test.js`, and watch the seven new tests fail before
touching either file. They drive the script the way the existing `groups` tests
do, through `execFileSync`.

In `tests/ledger.test.js`, at the end of the file, add:

```js
// A fixture plan with a header, a constraints block, two tasks and a coverage
// table, beside the design it argues from. `lint` reads the design from the
// plan's own Spec line, so the two are written into one directory.
const PLAN_HEAD = [
  '# A plan', '',
  '**Goal:** one line, and a', 'second line of it.', '',
  '**Spec:** [design.md](design.md)', '',
  '## Global Constraints', '', '- **No dependency may be added.**', '- four-space indent', '',
  '## File structure', '', '| file | responsibility |', '|---|---|', '| `lib/a.js` | a |', '',
].join('\n');

const PLAN_TASKS = [
  '## Task 1: the first', '',
  '**Files:**', '- Modify: `lib/a.js`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: `makeA` — `makeA(x)` → `{ a }`, the thing Task 2 reads', '',
  'In `lib/a.js`, add:', '', '```js', 'x', '```', '',
  '## Task 2: the second', '',
  '**Files:**', '- Modify: `lib/b.js`', '- Read: `lib/a.js` — for makeA', '',
  '**Interfaces:**', '- Consumes: `makeA` from Task 1.', '- Produces: nothing.', '',
  'Then run:', '', '```', 'node --test', '```', '',
].join('\n');

const DESIGN = [
  '# A design', '',
  '## 1. The area', '',
  '- the page gains a `waited` column beside the burn column', '',
  '## What proves it done', '',
  '| test | fails now because |', '|---|---|',
  '| `tests/a.test.js` — makeA returns the thing | no makeA |', '',
].join('\n');

const writePair = (dir, coverage) => {
  fs.writeFileSync(path.join(dir, 'design.md'), DESIGN);
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN_HEAD + PLAN_TASKS + (coverage || ''));
  return plan;
};

const run = (dir, plan, ...args) => {
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, ...args], { encoding: 'utf8' }), code: 0 };
  } catch (e) {
    return { out: String(e.stdout || ''), code: e.status };
  }
};

test('lint reads the design from the Spec line and exits non-zero naming the promise with no task', () => {
  const dir = root();
  const plan = writePair(dir);
  const { out, code } = run(dir, plan, 'lint');
  assert.equal(code, 1);
  assert.match(out, /lint: 2 findings/);
  assert.match(out, /promise with no task: the page gains a `waited` column/);
  assert.match(out, /promise with no task: `tests\/a\.test\.js` — makeA returns the thing/);
});

test('lint is clean when the Coverage table quotes every promise', () => {
  const dir = root();
  const plan = writePair(dir, [
    '## Coverage', '', '| promise | task |', '|---|---|',
    '| the page gains a `waited` column beside the burn column | Task 1 |',
    '| `tests/a.test.js` — makeA returns the thing | Task 1 |', '',
  ].join('\n'));
  const { out, code } = run(dir, plan, 'lint');
  assert.equal(code, 0, out);
  assert.match(out, /lint: clean/);
});

test('lint refuses a plan whose header names no Spec', () => {
  const dir = root();
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, '# A plan\n\n' + PLAN_TASKS);
  const { out, code } = run(dir, plan, 'lint');
  assert.equal(code, 1);
  assert.match(out, /Spec:/);
});

test('brief writes the task section, the constraints, the producer entry and the footer, and prints the path', () => {
  const dir = root();
  const plan = writePair(dir);
  const { out, code } = run(dir, plan, 'brief', '2');
  assert.equal(code, 0, out);
  const file = out.trim().replace(/^fankeel ledger — /, '');
  assert.match(file.replace(/\\/g, '/'), /\.fankeel\/build\/plan\/task-2-brief\.md$/);
  const brief = fs.readFileSync(file, 'utf8');
  assert.match(brief, /^# Task 2 — the second/m);
  assert.match(brief, /\*\*Goal:\*\* one line, and a\nsecond line of it\./);
  assert.match(brief, /\*\*Spec:\*\* \[design\.md\]/);
  assert.match(brief, /## Global Constraints\n\n- \*\*No dependency may be added\.\*\*\n- four-space indent/);
  assert.doesNotMatch(brief, /## File structure/);
  assert.match(brief, /## Task 2: the second[\s\S]*- Read: `lib\/a\.js`[\s\S]*node --test/);
  assert.doesNotMatch(brief, /## Task 1: the first/);
  assert.match(brief, /## From the tasks this consumes\n\n- Task 1 produces: `makeA` — `makeA\(x\)` → `\{ a \}`, the thing Task 2 reads/);
  assert.match(brief, /## Rules you cannot infer/);
  assert.match(brief, /Never walk `\/`, a home directory or a Temp directory/);
  assert.match(brief, /blocked: <the file>/);
  assert.match(brief, /red when: <the mutation>/);
});

test('brief refuses a task number the plan does not carry', () => {
  const dir = root();
  const plan = writePair(dir);
  const { out, code } = run(dir, plan, 'brief', '7');
  assert.equal(code, 1);
  assert.match(out, /no Task 7/);
});

test('fix records a Fix line with its range, ranges lists it beside the tasks, and a fix with no range is refused', () => {
  const dir = root();
  const plan = writePair(dir);
  run(dir, plan, 'init');
  run(dir, plan, '--range', 'aaaaaaa..bbbbbbb', 'complete', '1', 'landed');
  const ok = run(dir, plan, '--range', 'bbbbbbb..ccccccc', 'fix', 'the guard counted an empty object');
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /fix recorded/);
  const text = fs.readFileSync(ledger.ledgerPath(dir, plan), 'utf8');
  assert.match(text, /^Fix: \[bbbbbbb\.\.ccccccc\] — the guard counted an empty object$/m);
  assert.deepEqual(ledger.fixes(text), [{ what: 'the guard counted an empty object', range: 'bbbbbbb..ccccccc' }]);
  const { out } = run(dir, plan, 'ranges');
  assert.match(out, /  1 aaaaaaa\.\.bbbbbbb\n  fix bbbbbbb\.\.ccccccc — the guard counted an empty object/);
  const bad = run(dir, plan, 'fix', 'no range');
  assert.equal(bad.code, 1);
  assert.match(bad.out, /--range/);
});

// The incident this verb exists for. The plan and design are copied, not
// pointed at, because the Spec link between them is relative and the pair may
// move to docs/archive together once the audit stage retires them.
test('lint on the 2026-09-06 station plan names the promises it dropped and the fence that named no file', () => {
  const dir = root();
  const repo = path.join(__dirname, '..');
  const find = (name) => ['docs/plans', 'docs/archive'].map((d) => path.join(repo, d, name)).find((p) => fs.existsSync(p));
  fs.copyFileSync(find('2026-09-06-station-reads-back.md'), path.join(dir, 'plan.md'));
  fs.copyFileSync(find('2026-09-06-station-reads-back-design.md'), path.join(dir, '2026-09-06-station-reads-back-design.md'));
  const { out, code } = run(dir, path.join(dir, 'plan.md'), 'lint');
  assert.equal(code, 1);
  // Four of the six promises verify found dropped on 09-06, by the design's
  // own wording. The x axis and the maximum's position were corrected in the
  // design after the build; `data-state` and the cleared count never shipped.
  assert.match(out, /promise with no task: \*\*x\*\* is milliseconds since `started`/);
  assert.match(out, /promise with no task: \*\*Two units in one box/);
  assert.match(out, /promise with no task: Each `<details>` carries `data-updated`/);
  assert.match(out, /promise with no task: [^\n]*`POST \/clear-stale` clears every stale row/);
  assert.match(out, /Task 7 line \d+: a `js` fence names no file from its Files block/);
  // And the one it cannot see: `waited` was a paragraph in that design, not a
  // bullet. The design skill now says to write promises as bullets for this
  // reason, and this assertion pins the limit rather than hiding it.
  assert.doesNotMatch(out, /`waited`/);
});
```

Now `lib/ledger.js`. In `lib/ledger.js`, after the `RANGE_ONLY` line, add:

```js
// A fix that came back from verify, committed and reviewed like a task. It has
// no task number, so it is its own line shape; the range is required on the
// way in — `scripts/ledger.js` refuses without it — because a fix with no
// range is exactly the unreviewed commit this line exists to rule out.
const FIX_RANGE = new RegExp('^Fix:(?: \\[(' + RANGE + ')\\])? — (.*)$');
```

In `lib/ledger.js`, after `completions`, add:

```js
function fixes(text) {
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
        const m = FIX_RANGE.exec(line.trim());
        if (m) out.push({ what: m[2].trim(), range: m[1] || null });
    }
    return out;
}

const fixLine = (what, range) => 'Fix:'
    + (range ? ' [' + range + ']' : '')
    + ' — ' + String(what || '').trim();
```

In `lib/ledger.js`, replace the `module.exports` line with:

```js
module.exports = { ledgerPath, header, owns, completed, completions, completionLine, isRange, rulingLine, fixLine, fixes, init, append };
```

Now `scripts/ledger.js`. In `scripts/ledger.js`, replace the `VERBS` line with:

```js
const VERBS = new Set(['init', 'complete', 'ruling', 'show', 'groups', 'ranges', 'lint', 'brief', 'fix']);
```

In `scripts/ledger.js`, replace `serialCause`'s loop body from `const reason`
to the end of the `for` so a `read` conflict names its file too:

```js
        const reason = plantasks.conflict(a, b);
        if (reason === 'interface') edge = true;
        if (reason === 'files') {
            const owned = [...b.modify, ...b.test];
            for (const p of [...a.modify, ...a.test]) if (owned.includes(p)) shared.add(p);
        }
        if (reason === 'read') {
            for (const p of a.read || []) if ([...b.modify, ...b.test].includes(p)) shared.add(p);
            for (const p of b.read || []) if ([...a.modify, ...a.test].includes(p)) shared.add(p);
        }
```

In `scripts/ledger.js`, after `CONFORMING_HEADING`, add the footer and two
readers of a plan's header:

```js
// What a dispatched implementer cannot infer and the brief must therefore
// carry: it receives this file and nothing else. Fixed text, so that every
// brief says it the same way and a reviewer can hold the return to it.
const FOOTER = [
    '## Rules you cannot infer',
    '',
    '- The files you may read are named above, under Files (Modify, Test, Read) and Interfaces. Never walk `/`, a home directory or a Temp directory. A file you need that is not named here is returned as `blocked: <the file>`, in your first turn.',
    '- A file the task text names that the Files block does not list is returned as `blocked: <the file> is named but not declared`, before anything is built.',
    '- Neighbours are editing other files in this working tree. Run only your own test command, never the full suite.',
    '- Do not commit, and do not touch the index, HEAD or branch state.',
    '- Write the failing tests first and watch them fail. Every new test must be shown red once: name the mutation that reddens it.',
    '- Return, and nothing else: a status line (`done`, `partial: <what>` or `blocked: <why>`), the paths you wrote, the `ℹ pass` and `ℹ fail` line, and one line per new test as `<test name> — red when: <the mutation>`. Never a diff, never a summary of the code: every line you return stays in a long-running parent context for the rest of the session.',
].join('\n');

// The paragraph opening with `**Label:**`, to the next blank line: a Goal wraps.
function paragraph(header, label) {
    const lines = String(header || '').split(/\r?\n/);
    const at = lines.findIndex((l) => l.trim().startsWith('**' + label + ':**'));
    if (at === -1) return '';
    const out = [];
    for (let i = at; i < lines.length && lines[i].trim(); i++) out.push(lines[i]);
    return out.join('\n');
}

// A `## <heading>` section of the header, heading included, to the next `## `.
function section(header, heading) {
    const lines = String(header || '').split(/\r?\n/);
    const at = lines.findIndex((l) => l.trim() === '## ' + heading);
    if (at === -1) return '';
    const out = [lines[at]];
    for (let i = at + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) out.push(lines[i]);
    return out.join('\n').replace(/\s+$/, '');
}

// The design a plan argues from, off its `**Spec:**` line: a bare path, or a
// markdown link, either one relative to the plan's own directory.
function specPath(planFile, header) {
    const line = paragraph(header, 'Spec');
    if (!line) return null;
    const value = line.replace(/^\s*\*\*Spec:\*\*\s*/, '').trim();
    const link = /\]\(([^)]+)\)/.exec(value);
    const rel = (link ? link[1] : value).replace(/`/g, '').trim();
    return path.resolve(path.dirname(planFile), rel);
}

function readPlan(root, plan) {
    const file = path.resolve(root, plan);
    try {
        return { file, text: fs.readFileSync(file, 'utf8') };
    } catch (e) {
        return fail('No plan at ' + file);
    }
}
```

In `scripts/ledger.js`, before the `if (verb === 'ranges')` block, add the
three verbs:

```js
    if (verb === 'lint') {
        const { file, text: planText } = readPlan(root, opts.plan);
        const { header } = plantasks.parsePlan(planText);
        const design = specPath(file, header);
        if (!design) fail('lint wants a **Spec:** line in the plan header naming the design file.');
        let designText = '';
        try {
            designText = fs.readFileSync(design, 'utf8');
        } catch (e) {
            return fail('No design at ' + design + ', named by the plan\'s **Spec:** line.');
        }
        const lines = plantasks.lint(planText, designText);
        if (!lines.length) return 'fankeel ledger — lint: clean';
        // Exit 1, so a gate that chains it stops here. The lines are the
        // report; nothing is summarised on their behalf.
        return fail('fankeel ledger — lint: ' + lines.length + ' findings\n  ' + lines.join('\n  '));
    }

    if (verb === 'brief') {
        const n = Number(text[0]);
        if (!Number.isInteger(n) || n < 1) fail('brief <task number>');
        const { file, text: planText } = readPlan(root, opts.plan);
        const { header, tasks } = plantasks.parsePlan(planText);
        const task = tasks.find((t) => t.n === n);
        if (!task) fail('brief: no Task ' + n + ' in ' + file + '. ' + CONFORMING_HEADING);
        // For every name this task consumes, the entry that produces it — the
        // exact signature, from the task that owns it, rather than a memory.
        const produced = [];
        for (const name of task.consumes) {
            for (const t of tasks) {
                if (t.n === task.n) continue;
                for (const entry of t.producesText) {
                    if (entry.includes('`' + name + '`') && !produced.includes('- Task ' + t.n + ' produces: ' + entry)) {
                        produced.push('- Task ' + t.n + ' produces: ' + entry);
                    }
                }
            }
        }
        const out = [
            '# Task ' + n + ' — ' + task.name,
            '',
            opts.plan + ', Task ' + n + '. This file is your whole brief.',
            '',
            paragraph(header, 'Goal'),
            '',
            paragraph(header, 'Spec'),
            '',
            section(header, 'Global Constraints'),
            '',
            task.body,
            '',
            '## From the tasks this consumes',
            '',
            produced.length ? produced.join('\n') : 'Nothing consumed from an earlier task.',
            '',
            FOOTER,
            '',
        ].join('\n');
        const dir = path.dirname(ledger.ledgerPath(root, opts.plan));
        fs.mkdirSync(dir, { recursive: true });
        const briefFile = path.join(dir, 'task-' + n + '-brief.md');
        fs.writeFileSync(briefFile, out);
        return 'fankeel ledger — ' + briefFile;
    }

    if (verb === 'fix') {
        const what = text.join(' ');
        if (!what.trim()) fail('fix "<what the fix was>" — with --range <base>..<sha> before the verb.');
        // Required, not optional as it is on `complete`: a fix is the commit
        // that came back from verify, and a fix line with no range is the
        // unreviewed commit this verb exists to rule out.
        if (opts.range === undefined) fail('fix wants --range <base>..<sha>: a fix with no range is a commit nobody reviewed.');
        if (!ledger.isRange(opts.range)) {
            fail('--range wants two commit shas: <base>..<head>, 7 to 40 hex each. '
                + '"' + opts.range + '" would reach the file and read back as no range at all.');
        }
        ledger.append(root, opts.plan, ledger.fixLine(what, opts.range));
        return 'fankeel ledger — fix recorded.';
    }
```

In `scripts/ledger.js`, in the `ranges` verb, replace the four lines from
`const rows = ledger.completions(contents);` to the `const lines = ...` line
with:

```js
        const rows = ledger.completions(contents);
        const fixed = ledger.fixes(contents);
        if (!rows.length && !fixed.length) return 'fankeel ledger — nothing complete yet at ' + file;
        const lines = rows.map((r) => '  ' + r.n + ' ' + (r.range || '(no range recorded)'))
            .concat(fixed.map((r) => '  fix ' + (r.range || '(no range recorded)') + ' — ' + r.what));
```

Update the comment at the top of `scripts/ledger.js`: "Four verbs" becomes
"Nine verbs", and add one sentence: "`lint`, `brief` and `fix` came with the
2026-09-07 plan-quality change: check a plan against its design, write one
task's brief file, and record a reviewed fix." Then run
`node --test tests/ledger.test.js` and watch every test pass, and
`node --test tests/plantasks.test.js` once, which this task must not have
touched.

**Last step, and it is part of this task:** run both of these and put their
output, verbatim, in the report:

```
node scripts/ledger.js --plan docs/plans/2026-09-07-plan-quality.md lint
node scripts/ledger.js --plan docs/plans/2026-09-06-station-reads-back.md lint
```

The first is this very plan: its `## Coverage` table was written by hand
before `lint` existed, and a finding there is a defect in the table, recorded
in the report, not a reason to change the code. The second is the committed
2026-09-06 plan, the incident this verb exists for: the report quotes what it
names.

Report to `.fankeel/build/2026-09-07-plan-quality/task-2-report.md`.

---

## Task 3: the anchors and the four skills

**Files:**
- Modify: `lib/stages.js` — plan, build and verify rules reworded within the cap; plan's template gains `lint:` and `reviewer:`
- Modify: `skills/fankeel-plan/SKILL.md` — `Read:`, fences name their file, `## Coverage`, `lint`, the plan reviewer, the Output fence, the frontmatter
- Modify: `skills/fankeel-plan/rationale.md` — why, under the same headings
- Modify: `skills/fankeel-build/SKILL.md` — the brief file, the return contract, `blocked:`, the reviewer template, fix rows
- Modify: `skills/fankeel-build/rationale.md` — the task-brief paragraph rewritten as written
- Modify: `skills/fankeel-verify/SKILL.md` — a fix is build's commit, `ranges` shows fixes
- Modify: `skills/fankeel-design/SKILL.md` — the end-to-end criterion row, numbered sections
- Test: `tests/stages.test.js` — the two assertions that pin the old entry lines

**Interfaces:**
- Consumes: nothing from an earlier task — the verb names this text quotes
  are fixed by this plan, not read from the code.
- Produces: `build entry line`, `plan entry line`, `verify fix rule` — the
  three reworded anchor strings in `lib/stages.js`, which the docs task quotes.

**Dispatch:** implementer, sonnet — the plan carries every sentence; the cap is a test the implementer iterates against.

**The cap comes first.** Every sentence below is written to net under the
room measured today (plan 7, build 14, verify 6). After every edit to
`lib/stages.js` run:

```
node --test tests/render.test.js tests/stages.test.js 2>&1 | grep -E 'chars at|✖|^ℹ (pass|fail)'
```

and read the per-stage figures. If a stage is over 2400, shorten the sentence
named as its fallback below and nothing else; if under, stop.

### `lib/stages.js` — plan

The file spells some em dashes as `—` escapes inside these strings; a
literal `—` is the same string, and either spelling is fine. In
`lib/stages.js`, replace the `plan` entry's whole `rules` array and its
`template` with:

```js
        rules: [
            'Write docs/plans/<date>-<topic>.md, headed by the goal, the spec path, and Global Constraints taken from `node {{MAP}}`.',
            'A task is the smallest unit carrying its own test cycle. Fold setup and docs into the task needing them; split only where a reviewer could reject one and pass its neighbour.',
            'Every step holds the actual code, not a description of it. "TBD", "add appropriate error handling" and "similar to Task N" are failures, not shorthand.',
            'Before the gate: `ledger.js --plan <f> lint` clean, then one sonnet reviewer over design and plan, returning only promises with no task and Files blocks that disagree with their task.',
            'Every `## Task N:` carries `**Files:**`, `**Interfaces:**` and a `**Dispatch:**` line — `implementer, <model>` or `in-session`; `sonnet` is the floor, and anything above it names why on that line. A task without one is a plan failure.',
            'Read the fankeel-plan skill on entry: Read:, a fence names its file, ## Coverage, no-dispatch on every task.',
            'Output: one line per task as `N. name — its files`, then the question. Under 100 words of your own; the file is the output.',
        ],
        template: [
            'docs/plans/<date>-<topic>.md — <n> tasks',
            '',
            '1. <name> — path, path',
            '2. <name> — path',
            '',
            'constraints: <n> lines, from map.md',
            'lint: <its line>',
            'reviewer: clean | <n> gaps, fixed',
            'then AskUserQuestion',
        ].join('\n'),
```

Fallback if plan is still over 2400: in the last rule, `Under 100 words of
your own; the file is the output.` becomes `Under 100 words; the file is the
output.`

### `lib/stages.js` — build

In `lib/stages.js`, replace the `build` entry's whole `rules` array with (the
`template` is unchanged):

```js
        rules: [
            'Do not stop where the happy path works and the rest is "later". That, and a new ask that neither blocks nor belongs, is one TODO.md line at the detail. Say which; ambiguous, ask that turn.',
            'From a plan: `node {{LEDGER}} --plan <f> show` first; never redo a task it lists complete. One reviewer per task or fix, then `complete <n> "<what>"` or `fix "<what>"`.',
            'Decide rather than stall, recording `Ruling: what — why — costs if wrong`. Only four things stop the loop: irreversible, security-sensitive, a side effect outside this workspace, every path a guess.',
            'Every changed line traces to the ask. Follow the patterns here; do not improve adjacent code. Remove what your own change orphaned; dead code you did not create gets mentioned, not deleted.',
            'A new document is the last resort: use an existing page, or write a generator when it derives from code. One written carries status, last_verified and source_of_truth.',
            'Read the fankeel-build skill on entry: worktree consent, brief file, reviewer template, fix rows, five rounds, resume the fixer, commit shape.',
            'Output: one line per file, then the question. Under 80 words.',
        ],
```

Fallback if build is still over 2400: `A new document is the last resort: use
an existing page,` becomes `A new document is the last resort: an existing
page,`.

### `lib/stages.js` — verify

In `lib/stages.js`, replace the `verify` entry's whole `rules` array with (the
`template` is unchanged):

```js
        rules: [
            'Run the tests and quote what they said. "Should work" is not a result.',
            'Check that what you claimed to change actually changed.',
            'Anything half-built sends this back to build; a fix is build\'s commit with its own review range, never verify\'s.',
            'Run `node {{DOCS_CHECK}}` and name any page this change just made no longer true. A change that is correct and leaves three pages describing the old behaviour is half verified.',
            'A coverage claim states its denominator: nine of twenty-one pages, not "the pages".',
            'Before the question, one read-only adversary over the evidence: was each command run after the last edit, on the thing claimed, by a check that could have failed. Give it paths, never a paste, and ask only for the rows it defeats: every line it returns stays here for good. Where the host opens it, the chain is one workflow.',
            'Read the fankeel-verify skill on entry: ledger ranges, red-green, line by line.',
            'Output: the command and the line that decided it, in a code block, then the question. Filter the run — never paste tens of thousands of characters to report 24.',
        ],
```

Fallback if verify is still over 2400: `Run the tests and quote what they
said. "Should work" is not a result.` becomes `Run the tests and quote them.
"Should work" is not a result.`

### `tests/stages.test.js`

In `tests/stages.test.js`, replace the assertion at line 648 with:

```js
  assert.match(rules('build'), /Read the fankeel-build skill on entry: worktree consent, brief file, reviewer template, fix rows, five rounds, resume the fixer, commit shape\./);
```

and, in `tests/stages.test.js`, the assertion at line 662 with:

```js
  assert.match(rules('plan'), /Read the fankeel-plan skill on entry: Read:, a fence names its file, ## Coverage, no-dispatch on every task\./);
```

Both tests keep their names. The `carries` needle at line 647 and the
`resume the fixer, commit shape.` needle at line 676 still match the new
strings and are not edited.

### `skills/fankeel-plan/SKILL.md`

In `skills/fankeel-plan/SKILL.md`, the frontmatter `source_of_truth` becomes
`lib/stages.js, scripts/map.js, lib/plantasks.js, scripts/ledger.js` and
`last_verified` becomes `2026-09-07`. In `skills/fankeel-plan/rationale.md`,
`source_of_truth` becomes `lib/stages.js, scripts/map.js, lib/plantasks.js,
scripts/ledger.js, skills/fankeel-plan/SKILL.md` and `last_verified`
`2026-09-07`.

In `skills/fankeel-plan/SKILL.md`, under `## The header`, after the fenced
header example, add:

```md
`**Spec:**` is read by a script: `ledger.js lint` opens the design it names —
a bare path or a markdown link, relative to the plan's own directory — and a
plan with no such line is refused.
```

In `skills/fankeel-plan/SKILL.md`, replace the fenced Files block example and
the paragraph after it (from `Every task carries a **Files** block:` to
`serialises work that could have run at once.`) with:

````md
Every task carries a **Files** block, in three kinds:

```markdown
**Files:**
- Modify: `path` — what changes in it
- Read: `path` — what it depends on there, and does not change
- Test: `path`
```

`Test:` lists the test files this task **writes**. A suite it merely has to keep
green is not an entry: two tasks that both have to leave `npm test` passing are
not in conflict, and listing it as though they were is how a plan serialises
work that could have run at once.

`Read:` lists the files the task must open and will not change — the module a
helper it calls lives in, the fixture it copies. It is what keeps an
implementer from walking the disk for a definition: on 2026-09-06 a reviewer
that needed `tokens` and was not told it lived in `lib/context.js` ran
`find /` and sat 38 minutes. A `Read:` of a file a neighbour lists under
`Modify:` or `Test:` **serialises the pair** — a file mid-edit is not a file to
read — and two tasks reading one file do not conflict. Only the first
backticked token on the line is the path, as for the other two kinds.
````

In `skills/fankeel-plan/SKILL.md`, after the `## Steps are two to five
minutes` section and before `## No placeholders`, add:

````md
## Every code fence names its file

A fence whose info string is a language — `js`, `json`, `md`, anything but
none, `sh`, `bash`, `shell`, `console` or `text` — is code that lands in a
file, and the three non-blank lines above it say which, in backticks, naming a
path from the task's own Files block:

```markdown
In `lib/station.js`, in `gather()` beside `burn:`, add:
```

A fence introduced with a function name alone — "In `gather()`, add:" — is
how Task 7 of the 2026-09-06 station plan carried a `render()` snippet for a
file its Files block never listed, and how the implementer, correctly, built
around it. `ledger.js lint` names every such fence, and every path named above
a fence that the task does not own. A fence with no info string, or one of the
five exempt ones, holds a command or its output and names nothing.
````

In `skills/fankeel-plan/SKILL.md`, in the `## No placeholders` list, add two
lines at the end:

```md
- a language fence with no file named in the three lines above it
- a `Read:` left off when the task calls a helper from a file it does not modify
```

In `skills/fankeel-plan/SKILL.md`, replace the whole `## Self-review before
the gate` section (its heading, the three numbered items and `Fix inline. If a
requirement has no task, add the task.`) with:

````md
## Coverage, then lint, then a reviewer — before the gate

1. **Coverage, bullet by bullet.** Under a `## Coverage` heading, one table
   row per promise the design makes: every first-level bullet under its
   numbered `## N.` sections, and every row of its `## What proves it done`
   table. Quote the promise's opening — its first line at least — and name the
   task:

   ```markdown
   ## Coverage

   | promise | task |
   |---|---|
   | x is milliseconds since `started`. This is the "how long it ran" axis. | Task 4 |
   | the maximum is printed at the top of the box in that series' colour | struck — the label carries it; see the ruling |
   ```

   A struck promise is quoted too, with `struck — <why>` in the task cell: the
   design's own `Struck:` convention, kept where `lint` can read it. Area-level
   coverage — "Curve → Task 4" — is what let three bullets of one area drop on
   2026-09-06 while the area read as covered.
2. **Placeholder scan** — the list above.
3. **Type consistency** — a helper named `clearLayers` in Task 3 and
   `clearFullLayers` in Task 7 is a bug, and only the implementer of Task 7
   will meet both names.
4. **Lint**, and it must be clean:

   ```
   node <plugin>/scripts/ledger.js --plan docs/plans/<file>.md lint
   ```

   It reads the design off the plan's `**Spec:**` line and reports, one line
   each: a promise whose first eight words appear nowhere in the plan, a path
   in the design's file table that no task modifies or tests, a language fence
   naming no file from its task's Files block, and a path named above a fence
   that the task does not own. It exits non-zero on any of them, and the
   output line goes on the report's `lint:` slot.
5. **One reviewer over the plan**, `sonnet`, dispatched before the gate and
   said out loud — one, on which model. It gets three paths and a question:
   the design, the plan, the lint output, and *which promises in the design
   have no task, and which task's Files block disagrees with its own text*.
   It returns only those lines, or `clean` — say why: every line it returns
   stays in this context for the rest of the session. Fix what it finds
   inline, and put the count on the `reviewer:` slot.

Fix inline. If a requirement has no task, add the task.
````

In `skills/fankeel-plan/SKILL.md`, replace the `## Output` fence with:

````md
```
docs/plans/<date>-<topic>.md — <n> tasks

1. <name> — path, path
2. <name> — path

constraints: <n> lines, from map.md
lint: <its line>
reviewer: clean | <n> gaps, fixed
then AskUserQuestion
```
````

In `skills/fankeel-plan/rationale.md`, at the end of the file, add:

```md
## Every code fence names its file

The fence rule is mechanical on purpose. A person reading the plan knows that
`render()` lives in `lib/station.js`; the implementer, given only the task, did
not, and the Files block was the contract it held to. Naming the file beside
the code costs the author one backticked path and gives `lint` something it
can check, which is the tier this belongs at.

## Coverage, then lint, then a reviewer — before the gate

Three things, in cost order. The table is the author's own reading, and it is
what turned area-level coverage — one line per section of the design — into
bullet-level, because the three promises dropped on 2026-09-06 all sat inside
areas the plan had ticked. `lint` is the part a script can hold: it cannot
judge whether a task implements a promise, but it can refuse a plan that never
quotes one, and eight normalised words is enough to tell two bullets apart on
every design in `docs/plans`. The reviewer is the judgement the other two
cannot make, and it is the one superpowers already runs at this point — a
plan-document reviewer for completeness and spec alignment. It costs a sonnet
dispatch of a few minutes; the return trips it replaces cost hours.
```

### `skills/fankeel-build/SKILL.md`

In `skills/fankeel-build/SKILL.md`, set `last_verified: 2026-09-07`. In the
task loop's step 2, replace the paragraph beginning `A dispatch carries four
things and nothing else` (through `and never a paste of the plan.`) with:

````md
   A dispatch carries three things and nothing else, and **none of them is a
   decision**: one line on where the task fits, the path to the task's brief
   file, and the path it must write its report to. The brief is written by

   ```
   node <plugin>/scripts/ledger.js --plan docs/plans/<file>.md brief <n>
   ```

   and holds the plan's goal and spec line, the `## Global Constraints` block
   verbatim, the task's whole section, the `Produces:` entry of every task it
   consumes from, and a fixed footer of the rules an implementer cannot infer
   — the files it may read and the walk it may never make, no commits, its
   own test command only, and the return contract below. Never the session's
   history, and never a paste of the plan: the brief is a file, and the
   dispatch names it.
````

In `skills/fankeel-build/SKILL.md`, in step 2, replace the paragraph beginning
`A dispatched implementer **does not commit.` (through `branch state.`) with:

```md
   A dispatched implementer **does not commit. It returns a status line, the
   paths it wrote, the `ℹ pass` / `ℹ fail` line, and one line per new test:
   `<test name> — red when: <the mutation>`.** Never a diff — a returned diff
   puts the whole change back in this context, which is the one cost
   dispatching exists to avoid, and step 5 reads it from git once the parent
   has committed. The mutation lines are the return contract's new half: a
   new test with no line naming what reddens it is a finding before the
   reviewer reads anything, and eight of them on 2026-09-06 cost five fix
   rounds. And a brief whose task text names a file its Files block does not
   list comes back as `blocked: <the file> is named but not declared` in the
   implementer's first turn, never built around — that is a plan defect, ruled
   on here, and a task built around it ships a feature nothing can reach.
```

In `skills/fankeel-build/SKILL.md`, in step 4's `**workflow**` paragraph,
replace the sentence beginning `Tell every implementer in the run three things
it cannot infer` (through `never a diff;`) with:

```md
   Every implementer in the run gets its brief file, and the brief's footer
   carries the three things it cannot infer — neighbours in the same tree so
   its own test command only, no commits and no touching the index, `HEAD` or
   branch state, and paths and a status back rather than a diff —
```

In `skills/fankeel-build/SKILL.md`, replace step 5's first paragraph (from
`5. One reviewer, against the task text and the diff.` through `never a paste
of the session's history.`) with:

````md
5. One reviewer, on this template and no other, against the brief and the
   diff. **Pin the range at both ends** — `BASE..<the sha this task's commit
   produced>`. Every task has one, `in-session` included, because step 4
   commits them all; there is no `HEAD` form left, and that is deliberate.
   An open upper end is not a range: the next task's commits walk into the
   review the moment they land.

   ```
   You are reviewing ONE task's change in <repo>. READ-ONLY: never mutate the
   working tree, the index, HEAD or branch state; inspect with git show, git
   diff and git log only.

   THE RANGE, pinned at both ends: <BASE>..<sha>
   THE BRIEF: <the task's brief file> — its Files block says what the task
   owns, its section says what it must do.
   THE COVERAGE ROWS naming this task, from the plan's ## Coverage table:
   <quoted, one per line>
   THE MAP: .fankeel/map.md
   THE IMPLEMENTER RETURNED: <its status, paths, test line and mutation lines>

   Part 1 — against the brief and the coverage rows, in this order:
     Missing: a promise or step the change does not implement, or claims
       without evidence.
     Extra: a change no line of the task asks for — adjacent code improved,
       a file outside the Files block touched.
     Misunderstood: the right thing built the wrong way.
   Part 2 — the tests: every new test in the diff has a mutation line.
     Pick one, apply its mutation to a scratch copy of the file
     (git show <sha>:<path> > <scratch>), and confirm the named test
     reddens. A new test with no line, or a picked mutation that leaves
     its test green, is a finding.
   Part 3 — every changed line traces to the task's text; the patterns
     already in the repository are followed.

   RETURN, and nothing else: one line per finding as `path:line — <the
   problem>`, most serious first, or the single word `clean`. Every line you
   return stays in a long-running parent context for the rest of the session.
   ```

   Give it the brief path and the range — never a paste of the session's
   history.
````

In `skills/fankeel-build/SKILL.md`, after the numbered task loop and before
`Then one whole-branch review when the last task is done.`, add:

````md
**A fix that came back from `verify` is a row of this loop.** `verify` commits
nothing; a defeated row is routed here at its gate, and here it gets what a
task gets: BASE taken immediately before its commit, the implementer resumed
or the fix made in-session, the parent's commit, one reviewer on the template
above over `BASE..<sha>`, and then

```
node <plugin>/scripts/ledger.js --plan <file> --range <BASE>..<sha> fix "<what>"
```

which writes a `Fix:` line `ranges` lists beside the task rows. The five
commits that landed during `verify` on 2026-09-06 had no reviewer, and the
third return to build was made of their defects; `--range` is required on
`fix` for exactly that reason.
````

In `skills/fankeel-build/rationale.md`, set `last_verified: 2026-09-07` and
replace the two paragraphs from `A draft of this paragraph replaced the four
with three` through `asks for the rule, not the tool.` with:

```md
The four became three on 2026-09-07, and the reason is the one the earlier
draft of this paragraph got wrong: pasting a task costs the parent the tokens a
path costs nothing, and so does pasting the constraints block — which every
dispatch had been doing, by hand, since the rule said the block must travel.
`ledger.js brief <n>` writes both into one file with the task's section and
the footer, so the dispatch is three paths and a line, and every brief carries
the same footer rather than whatever the parent remembered to type. Measured
on the 2026-09-06 build, the implementer briefs ran 2,500 to 3,400 characters
each, all typed; the footer alone is longer than most of them were, and it is
typed once.

The seven implementers of that plan each began by reading the whole 871-line
plan, then navigating to their own task. The brief is the slice they were
navigating to.
```

### `skills/fankeel-verify/SKILL.md`

In `skills/fankeel-verify/SKILL.md`, set `last_verified: 2026-09-07`. In the
`## One verifier per task, where a ledger exists` section, after the paragraph
ending `is a finding for the report.`, add:

```md
A row reading `fix <range> — <what>` is a fix that came back from this stage
once already, committed and reviewed in `build` the way a task is. Verify it
like a task row. A commit on the branch that appears in neither list is the
finding: a change nobody reviewed, and where it came from is the first
question.
```

In `skills/fankeel-verify/SKILL.md`, replace the `## Half-built sends it back`
section's one paragraph with:

```md
Verify is not where the bar gets lowered. Anything unfinished returns to
`build` — and so does every fix. **This stage commits nothing.** A defeated
row, a test that should have reddened and did not, a page found false: each is
routed to `build` at the gate, where the fix gets BASE, the parent's commit,
one reviewer over its range and a `Fix:` line in the ledger. On 2026-09-06 five
fix commits landed during this stage with no reviewer, and the next lap's
findings were theirs.
```

### `skills/fankeel-design/SKILL.md`

In `skills/fankeel-design/SKILL.md`, the frontmatter's `last_verified` becomes
2026-09-07 and its `source_of_truth` gains lib/plantasks.js after lib/stages.js.

In `skills/fankeel-design/SKILL.md`, under `### 3. The success criterion`,
after the three-row table and before the `If a simpler approach` paragraph, add:

```md
**And one row on the artefact, wherever the change produces one.** A rendered
page, a written file, a printed report — checked against itself, not against a
unit: the row's cost cell and the curve under it agree. Unit tests each passed
on 2026-09-06 while the curve drew a third of what the cell printed, because
no criterion had named the artefact.
```

In `skills/fankeel-design/SKILL.md`, in `### 5. Present in sections`, after
`Cover architecture, components, data flow, error handling, testing.`, add:

```md
**Number the sections whose bullets are promises** — `## 1. The curve`,
`## 2. Discovery` — and write each promise as a first-level bullet. That is
what `plan`'s coverage table is built from and what `ledger.js lint` reads:
a bullet under an unnumbered heading is context, and a nested bullet is
detail of the one above it.
```

Then run the four test files that read these files and watch them pass:

```
node --test tests/render.test.js tests/stages.test.js tests/skills.test.js tests/contract.test.js 2>&1 | grep -E 'chars at|✖|^ℹ (pass|fail)'
```

Report to `.fankeel/build/2026-09-07-plan-quality/task-3-report.md`.

---

## Task 4: the documents this change makes false

**Files:**
- Modify: `docs/pipeline.md` — the build paragraph's "four fixed things", the plan diagram's task node and self-review, the two shown copies of the build rules
- Modify: `docs/subagents.md` — one sentence: the task brief is a file the dispatch names, beside the hook's brief
- Modify: `docs/README.md` — one index row for what `lint` and `brief` do
- Modify: `TODO.md` — the `## Ready` entry on the design's file table closed; the `## Needs a decision` entry on the reviewer-plus-mutation cost annotated
- Read: `lib/stages.js` — the rule strings as they landed, quoted verbatim into `docs/pipeline.md`
- Read: `scripts/docs-check.js` — run at the end
- Read: `scripts/todo-check.js` — run at the end

**Interfaces:**
- Consumes: `build entry line` and the other reworded strings, read from
  `lib/stages.js` as they landed.
- Produces: nothing.

**Dispatch:** in-session — these pages describe the code as it finally landed, and the session that landed it is the one that knows.

- `docs/pipeline.md:458-464`: "The brief a dispatch carries is four fixed
  things, none of them chosen per task" becomes "The brief a dispatch carries
  is one file, written by `ledger.js brief <n>` from the plan — the task's
  section, the constraints, what it consumes, and the rules it cannot infer —
  and a line saying where the task fits."
- `docs/pipeline.md:435`: the plan node reads
  `files · read · interfaces consumed and produced ·` and gains
  `every fence names its file`; `H1` becomes `every design promise<br/>has a
  task — lint, then a reviewer`.
- `docs/pipeline.md:127-131` and `:210-214`: the four build rule lines Task 3
  reworded, copied from `lib/stages.js` with `{{LEDGER}}` rendered as
  `<plugin>/scripts/ledger.js`, so the page shows what a session sees.
- `docs/subagents.md`, in the section describing the `SubagentStart` brief:
  one sentence after it — "A build implementer receives a second brief beside
  it, a file `ledger.js brief <n>` writes from the plan; the hook's brief says
  which task and which files, the task brief says what to build."
- `docs/README.md`: one row — *What a plan is checked for before its gate,
  and what an implementer's brief file holds* — pointing at `pipeline.md`,
  its *plan* and *build* sections.
- `TODO.md`: delete the `## Ready` bullet beginning `Nothing checks that a
  design's file table reached the plan's tasks`; under `## Needs a decision`,
  the bullet beginning `Whether a reviewer per task plus a mutation control
  per fix earns its cost` gains, at its end, ` The mutation moved into the
  implementer's return on 09-07, so the reviewer checks a list rather than
  hunting; measure the next build before deciding.`
- Run `node scripts/docs-check.js` and `node scripts/todo-check.js`, unpiped,
  and both exit 0.

---

## Coverage

One row per promise in the design, quoted from its first line.

| promise | task |
|---|---|
| A `- Read: \`path\` — why` entry lists a file the task depends on and does not change | Task 1 |
| A `Read:` of a file another task lists under `Modify:` or `Test:` serialises the pair | Task 1 |
| Two tasks that both `Read:` one file do not conflict. | Task 1 |
| `groups` names a `read` conflict the way it names a shared file, and `surfaces` is unchanged | Task 2 — `serialCause`; `surfaces` untouched in Task 1 |
| Inside a `## Task N` section, a fence whose info string is a language — anything other than none, `sh`, `bash`, `shell`, `console` or `text` — must have, within the three non-blank lines above it, a backticked path | Task 1 |
| A fence with no info string, or one of the five above, is a command or its output and is exempt | Task 1 |
| `lint` reports each fence that has no such line, and each path named on those lines that is not in the task's Files block | Task 1 |
| The plan header's `**Spec:**` line names the design file, as a bare path or as a markdown link | Task 2 — `specPath` |
| A promise is every first-level bullet under a `## <digit>.` heading of the design, and every body row of its `## What proves it done` table | Task 1 — `promises` |
| A promise's key is its first eight words, normalised: lower-cased, with backticks, asterisks and punctuation replaced by spaces | Task 1 — `normalise`, `keyOf` |
| `lint` reports every promise whose key does not occur in the normalised plan text | Task 1 |
| Every backticked path in the design's `\| file \| change \| dispatch \|` table must appear in some task's `Modify` or `Test` list | Task 1 — `filedPaths` |
| `lint` exits non-zero on any report and prints `lint: clean` otherwise. | Task 2 |
| Replayed on `docs/plans/2026-09-06-station-reads-back.md` against its design, it names the x-axis bullet, the maximum-at-the-top bullet, the `data-state` bullet, the `/clear-stale` count row, and Task 7's `render()` fence; it misses `waited` | Task 2 — the last test asserts all five and pins the miss |
| `ledger.js --plan <f> brief <n>` writes `.fankeel/build/<plan>/task-<n>-brief.md` and prints its path | Task 2 |
| The brief holds, in order: the plan's `**Goal:**` and `**Spec:**` lines, the `## Global Constraints` block verbatim, the task's whole section | Task 2 |
| It ends with a fixed footer: the files this task may read are named above; never walk `/`, a home directory or a Temp directory | Task 2 — `FOOTER` |
| The build dispatch carries three things, not four: one line on where the task fits, the brief path, and the report path | Task 3 — build skill step 2 |
| `parseTasks` keeps each task's `body` — its section text — and the plan's `header` — everything before the first task heading | Task 1 — via `parsePlan`, a sibling: `parseTasks` still returns the array sixteen tests index, and `parsePlan` returns `{ header, tasks }` |
| The implementer returns a status line, the paths it wrote, the `ℹ pass` and `ℹ fail` line, and one line per new test | Task 2 — the footer; Task 3 — build skill step 2 |
| A brief whose task text names a file its Files block does not list is returned as `blocked: <the file> is named but not declared` | Task 2 — the footer; Task 3 — build skill |
| The reviewer's brief is one fixed template in the build skill: Part 1 Missing, Extra and Misunderstood | Task 3 — build skill step 5 |
| The build anchor's entry line names the brief file and the reviewer template in place of `four-item brief`, within the cap | Task 3 — `lib/stages.js`, `tests/stages.test.js:648` |
| `verify` commits nothing: a defeated row is routed to `build` at the gate, as the verify skill already says | Task 3 — verify skill and anchor |
| In `build`, a fix is a row of the loop: BASE taken immediately before its commit, the parent commits it, one reviewer over `BASE..<sha>` | Task 3 — build skill; Task 2 — the `fix` verb |
| `ranges` lists `Fix:` lines beside task lines, so `verify` can see that every commit on the branch had a reviewer | Task 2 — `ranges`; Task 3 — verify skill |
| Before the plan gate: `lint` clean, then one `sonnet` reviewer given the design path, the plan path and the lint output | Task 3 — plan skill and anchor |
| The plan's output shape gains two slots, `lint: <its line>` and `reviewer: clean \| <n> gaps, fixed`, in `lib/stages.js` and the skill's Output fence alike | Task 3 |
| The design skill's success criterion gains one end-to-end row wherever the change produces an artefact — a rendered page, a written file, a printed report — checked against itself; and its sections whose bullets are promises are numbered | Task 3 — design skill |
| `tests/plantasks.test.js` — a `Read:` entry lands in `task.read`, and a Read of a file another task modifies serialises the pair as `read` | Task 1 |
| `tests/plantasks.test.js` — `lint` names a design bullet whose first eight words appear nowhere in the plan, a design file-table path in no task's Files, and a `js` fence with no file line above it | Task 1 |
| `tests/plantasks.test.js` — `parseTasks` keeps `header` and each task's `body` | Task 1 — via `parsePlan` |
| `tests/ledger.test.js` — `brief 4` writes `task-4-brief.md` holding the constraints block, the task's section, the producer's `Produces:` entry for a consumed name, and the no-walk footer, and prints the path | Task 2 — the fixture has two tasks, so the test briefs Task 2 rather than a Task 4; the assertions are the ones this row lists |
| `tests/ledger.test.js` — `lint` on a copy of the 2026-09-06 plan and design exits non-zero, names the x-axis bullet, `data-state` and the `/clear-stale` row, and pins that `waited` is missed | Task 2 — the last test |
| `tests/ledger.test.js` — `fix` with `--range` appends a `Fix:` line and `ranges` lists it | Task 2 |
| `tests/render.test.js` and `tests/skills.test.js` — every stage under 2400 and the plan Output fence equal to its template | Task 3 |
| end to end — `node scripts/ledger.js --plan docs/plans/2026-09-06-station-reads-back.md lint` on the committed plan names the five items in section 3 | Task 2 — its last step runs it and quotes the output; verify re-runs it against the branch |

## Self-review

**Coverage.** Thirty-seven rows above, one per bullet of the design's seven
numbered sections and one per row of its done table; every one names a task.
The design's file table lists fifteen paths and every one is in a task's
`Modify:` or `Test:` — `docs/subagents.md` gains a sentence rather than staying
untouched, which is a correction to the design's "unchanged" and is recorded
here. `lint` itself does not exist until Task 2 lands, so this table was
checked by eye; Task 2's last step runs the new `lint` over this plan and
reports what it says.

**Placeholders.** None. Every task carries its code or its sentences, its
`**Files:**`, its `**Interfaces:**` and its `**Dispatch:**` line; every
language fence names a file from its task's Files block within three lines.

**Type consistency.** `parsePlan` returns `{ header, tasks }` in Task 1 and is
read that way in Task 2; `lint(planText, designText)` returns `string[]` and
Task 2 prints its `length`; `fixLine(what, range)` writes what `fixes` reads,
and `FIX_RANGE` is built from the same `RANGE` as `COMPLETE_RANGE`; the entry
lines in `lib/stages.js` and the two assertions in `tests/stages.test.js` are
the same strings, character for character.

**Groups.** Task 2 consumes Task 1; Task 3 consumes nothing and shares no file
with Task 2, so `groups` prints `1: 1 — agent`, `2: 2, 3 — agents`,
`3: 4 — agent`, and Task 4 is `in-session`. Measured 2026-09-07 before the
gate.

**Lint, by prototype.** The verb does not exist yet, so the Task 1 code was run
from a scratch copy over this plan and its design: 37 promises and 15 file-table
paths all found, every fence naming its file — after it had first found fifteen
fences of this plan's own Task 3 naming none, and three tasks grouped as one
because `Produces:` wrote `parsePlan(text)` where `Consumes:` read `parsePlan`.
Both fixed here; both are the failure modes the rule is for.

**Reviewer.** One `sonnet` reader over the design and this plan, before the
gate: three gaps, fixed — the reviewer template said every mutation where the
design said one; the done-table row on the 2026-09-06 replay claimed `waited`
where the test pins the miss; the end-to-end replay was deferred to `verify`
and is now Task 2's last step. Plus four files tasks run without declaring —
`tests/ledger.test.js`, `tests/plantasks.test.js`, `scripts/docs-check.js`,
`scripts/todo-check.js` — now on `Read:` lines, because the brief's footer
forbids opening what is not named.
