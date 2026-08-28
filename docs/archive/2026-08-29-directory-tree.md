---
status: design-intent
last_verified: 2026-08-29
source_of_truth: lib/map.js, lib/docs.js, scripts/survey.js
---

# Directory Tree Implementation Plan

**Goal:** a session learns what each directory is for without reading the files,
and a project without that answer is told so and handed a skeleton to fill.

**Architecture:** the responsibility text lives once, in the project's own README,
written by a person. `lib/map.js` finds it by structure — the signpost file that
contains box-drawing lines, and the nearest heading above the first of them — and
lifts it into `.fankeel/map.md`. `docs.json` gains an optional `layout` key that
overrides the search when the guess is wrong. Where no tree exists,
`scripts/layout.js` prints a one-level skeleton built from `treeLines()` for the
developer to paste and fill; it writes nothing.

**Tech Stack:** Node, no dependencies, CommonJS. `node:test` with
`node:assert/strict`. `npm test` runs `node --test`. No lockfile, no `engines`
field, no linter.

**Spec:** [2026-08-28-directory-tree-design.md](2026-08-28-directory-tree-design.md)

## Global Constraints

Read off this project on 2026-08-29, not remembered.

**Exact values already asserted, with the line that asserts them**

| constraint | where | value |
|---|---|---|
| whole rendered injection, per stage | `tests/render.test.js:445`, at `REFERENCE_ROOT` = 59 (`:375`) | cap **2400**; `survey` renders **2371** |
| a stage's `rules` joined | `tests/stages.test.js:94` | cap **2000** |
| navigation rows lifted from a signpost | `lib/map.js:24` `MAX_NAV` | **24** — for table rows; **not** the tree cap, see Task 3 |
| width a lifted line is cut to | `lib/map.js:25` `MAX_WIDTH` | **160** |
| pages listed per status bucket | `lib/map.js:27` `MAX_PAGES` | **30** |
| signpost search order | `lib/map.js:30` `SIGNPOSTS` | `['CLAUDE.md', 'AGENTS.md', 'README.md']` |
| scanner rows per section | `scripts/survey.js:32` `DEFAULT_MAX` | **25** |
| a file the scanner will open | `scripts/survey.js:33` `MAX_FILE_BYTES` | **512 \* 1024** |
| notes / note length / next length / claims | `lib/registry.js:33-45` | 5 / 100 / 120 / 60 |
| a `TODO.md` entry | `scripts/todo-check.js` | **200** characters, and only the three headings |

**Invariants that make the suite red if broken**

- `tests/source.test.js:90` — **every name in a non-test `module.exports = {...}`
  must be imported by some file**, tests included. A new export with no consumer
  turns the suite red. Add the export and its first importer in the same task.
- `tests/source.test.js:24` — no source file holds a NUL byte.
- `lib/docs.js:133` — `normalise()` ends
  `return { preset: ..., index, buckets };`. It rebuilds from three keys, so any
  other key in `docs.json` is discarded at `read()`. **Task 1 exists because of
  this line.**
- `.fankeel/.gitignore` holds `sessions/`, `map.md`, `build/`. `docs.json` is
  committed; `.fankeel/map.md` is not.

**Conventions read off the files**

- There is **no `CLAUDE.md`** in this repository.
- Four-space indent in `lib/` and `scripts/` and `hooks/`; two-space indent in
  `tests/`. Single quotes. Semicolons. `'use strict';` at the top of every file.
- Scripts under `scripts/` start `#!/usr/bin/env node`.
- Comments explain *why*, at length, in prose. A constant carries the measurement
  that set it. Match that or the file reads as someone else's.
- Commit subject is `type: lowercase sentence`; the body says why, and ends
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- `.fankeel/map.md` reports `0 planned, not built`, so nothing here is being built
  against intent. Filing is `flat`, index `docs/README.md`.

**Naming, settled in the spec**

`tree` already means three things here — `read().tree` (the parsed `docs.json`),
`opts.tree` (the `--tree` flag), `treeLines()` (the renderer). The new key is
`layout`, the script is `scripts/layout.js`, the function is `layoutBlock`. Prose
still says "directory tree".

## File structure

| file | responsibility |
|---|---|
| `lib/docs.js` | modified — `normalise()` carries `layout` through `read()` |
| `lib/map.js` | modified — `layoutBlock()` finds and lifts the tree; `buildMap()` renders it or names its absence |
| `scripts/layout.js` | **new** — prints a one-level skeleton; writes nothing |
| `tests/docs.test.js` | modified — the key survives `read()` |
| `tests/map.test.js` | modified — found by structure, overridden by declaration, absent, half-filled |
| `tests/layout.test.js` | **new** — one row per directory, nothing written |
| `docs/documents.md` | modified — `layout` documented beside the buckets |

---

## Task 1 — the skeleton generator

`scripts/layout.js` prints one row per top-level directory, with its size and what
is underneath, and an empty responsibility column. It writes nothing.

This is first because three quarters of the 185 files measured have no tree at
all: the generator serves them, the lifter serves the rest.

Run against four real projects on 2026-08-29 it produced 9 to 11 rows in 541 to
687 bytes. One of those runs is worth keeping, because it is the project this
whole design started from:

```
firmware/             80.9M  1122 files, 2 directories below   #
archive/               5.2M   335 files, 2 directories below   #
docs/                  736K    23 files, 1 directory below     #
```

`firmware/` there is a retired logger, and that project's `docs/next-steps.md:48`
tells a reader to double-click `firmware/build_and_flash.bat`. The document and
the directory are each harmless; together they are an instruction that runs and
flashes the wrong firmware onto a fleet board. Filling in that one row forces
somebody to type "retired — do not flash", and that sentence is precisely the
background a person carries and never says out loud.

The same run also showed three `RESULT_2026...` directories taking a row each.
That is not a defect to fix: a skeleton that hides directories has decided what
matters, and deleting three rows is a second of work for the person who knows
they are noise.

**Interfaces:**
- Consumes: `require('../lib/tracked.js')` for the file list — the same source
  `scripts/survey.js` uses. Read `scripts/survey.js:300` `treeLines(root, files, max)`
  for the grouping it already does, and reuse the approach rather than the function:
  `treeLines` is not exported.
- Produces: nothing other modules import. A CLI only.

Create `scripts/layout.js`:

```js
#!/usr/bin/env node
'use strict';

// The half of the directory tree no tool can write, and the half it can.
//
// Every path here is derivable and not one responsibility is: `backend/` is the
// FastAPI backend because somebody decided it was, and no listing says so. So
// this prints the derivable half with the other half left blank, and stops. It
// writes nothing — the README is the developer's document, and a tool that edits
// it uninvited is a tool people turn off.
//
// One level deep, measured 2026-08-29 across three projects: eleven or twelve
// directories at depth one regardless of project size, fourteen to forty-two at
// depth two, up to eighty-seven at depth three. A dozen rows is a skeleton
// somebody fills in one sitting; a hundred and forty is one nobody does. Each row
// says what is underneath so the person can choose which ones earn more depth —
// which is the same judgement the responsibility column is asking for, and not
// one to make for them.

const fs = require('node:fs');
const path = require('node:path');

const { trackedFiles } = require('../lib/tracked.js');

function parseArgs(argv) {
    let root = process.cwd();
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root' && argv[i + 1]) root = argv[++i];
    }
    return { root: path.resolve(root) };
}

// The shape `scripts/survey.js:286` uses, with the tier it is missing. Run
// against a real project on 2026-08-29 this printed `data/ 3071.0M`, which is a
// number nobody reads as three gigabytes. `survey.js` has the same gap and is
// filed in TODO.md rather than fixed from here.
const human = (n) => (n < 1024 ? n + 'B'
    : n < 1024 * 1024 ? (n / 1024).toFixed(1) + 'K'
    : n < 1024 * 1024 * 1024 ? (n / (1024 * 1024)).toFixed(1) + 'M'
    : (n / (1024 * 1024 * 1024)).toFixed(1) + 'G');

// `scripts/survey.js:323` does it this way; a skeleton reading "1 files" is a
// skeleton that looks generated, which is the opposite of what it is asking
// somebody to sit down and finish.
const count = (n, one, many) => n + ' ' + (n === 1 ? one : many);

// Grouped by first path segment. A file loose at the top is its own row, because
// a project whose entry point is a single script has that fact worth stating too.
function rows(root, files) {
    const dirs = new Map();
    const loose = [];
    for (const rel of files) {
        const cut = rel.indexOf('/');
        let size = 0;
        try { size = fs.statSync(path.join(root, rel)).size; } catch (e) { /* raced */ }
        if (cut === -1) { loose.push({ rel, size }); continue; }
        const top = rel.slice(0, cut);
        const seen = dirs.get(top) || { files: 0, bytes: 0, below: new Set() };
        seen.files += 1;
        seen.bytes += size;
        const rest = rel.slice(cut + 1);
        const next = rest.indexOf('/');
        if (next !== -1) seen.below.add(rest.slice(0, next));
        dirs.set(top, seen);
    }
    return { dirs, loose };
}

function main(argv) {
    const { root } = parseArgs(argv);
    const found = trackedFiles(root);
    if (!found || !found.files.length) {
        process.stdout.write('fankeel layout — nothing readable under ' + root + '\n');
        return 0;
    }

    const { dirs, loose } = rows(root, found.files);
    const names = [...dirs.keys()].sort();
    const width = names.reduce((n, d) => Math.max(n, d.length + 1), 0);

    const out = ['fankeel layout — ' + names.length + ' directories under ' + root, ''];
    out.push('Paste this under a heading in your README and fill the right column.');
    out.push('Nothing was written; the paths are derivable and the answers are not.');
    out.push('');
    out.push('```');
    for (const d of names) {
        const it = dirs.get(d);
        const under = it.below.size
            ? ', ' + count(it.below.size, 'directory below', 'directories below')
            : '';
        out.push((d + '/').padEnd(width + 1)
            + ' ' + human(it.bytes).padStart(7)
            + '  ' + count(it.files, 'file', 'files') + under
            + '   # ');
    }
    if (loose.length) {
        out.push('');
        out.push('# ' + count(loose.length, 'file', 'files') + ' loose at the top: '
            + loose.map((f) => f.rel).sort().join(', '));
    }
    out.push('```');
    process.stdout.write(out.join('\n') + '\n');
    return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { rows };
```

`module.exports = { rows }` needs an importer or `tests/source.test.js:90` turns
the suite red — the test file below is that importer.

Create `tests/layout.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'layout.js');
const { rows } = require('../scripts/layout.js');

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-layout-'));
  for (const [rel, text] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return root;
}

const run = (root) => execFileSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' });

test('every directory appears once, with a size and an empty responsibility', () => {
  const root = fixture({
    'README.md': '# x\n',
    'lib/a.js': 'a',
    'lib/b.js': 'bb',
    'scripts/c.js': 'ccc',
    'docs/deep/d.md': 'dddd',
  });
  const out = run(root);
  for (const d of ['lib/', 'scripts/', 'docs/']) {
    assert.equal(out.split('\n').filter((l) => l.startsWith(d)).length, 1, d + ' appeared other than once');
  }
  assert.match(out, /docs\/.*1 directory below/);
  assert.match(out, /lib\/.*2 files/);
  // The responsibility column is what a person fills in; the tool leaves it open.
  for (const line of out.split('\n').filter((l) => /^(lib|scripts|docs)\//.test(l))) {
    assert.match(line, /#\s*$/, 'a row arrived with something already in it: ' + line);
  }
});

test('a file loose at the top is reported rather than dropped', () => {
  const root = fixture({ 'README.md': '# x\n', 'index.js': 'x', 'lib/a.js': 'a' });
  assert.match(run(root), /files loose at the top: README\.md, index\.js/);
});

test('the run writes nothing at all', () => {
  const root = fixture({ 'README.md': '# x\n', 'lib/a.js': 'a' });
  const before = fs.readdirSync(root).sort();
  const readme = fs.readFileSync(path.join(root, 'README.md'));
  run(root);
  assert.deepEqual(fs.readdirSync(root).sort(), before);
  assert.deepEqual(fs.readFileSync(path.join(root, 'README.md')), readme);
});

test('a root with nothing readable says so rather than printing an empty tree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-layout-'));
  assert.match(run(root), /nothing readable under/);
});

test('rows groups by first segment and counts what is below', () => {
  const root = fixture({ 'lib/a.js': 'a', 'lib/sub/b.js': 'bb', 'top.js': 'c' });
  const { dirs, loose } = rows(root, ['lib/a.js', 'lib/sub/b.js', 'top.js']);
  assert.deepEqual([...dirs.keys()], ['lib']);
  assert.equal(dirs.get('lib').files, 2);
  assert.deepEqual([...dirs.get('lib').below], ['sub']);
  assert.deepEqual(loose.map((f) => f.rel), ['top.js']);
});
```

Steps: write `tests/layout.test.js` first, run `node --test tests/layout.test.js`
and watch every test fail on the missing module, write `scripts/layout.js`, run it
again and watch them pass, then `npm test`, then commit.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus
running the tests.

---

## Task 2 — the `layout` key survives `read()`

`lib/docs.js` `normalise()` rebuilds the parsed object from `preset`, `index` and
`buckets`, so a `layout` key in `docs.json` is discarded before any consumer sees
it. Nothing else in this plan works until it is carried through.

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `read(root).tree.layout` — either `undefined`, or
  `{ file: string, heading: string }` where each is present only if it was a
  non-empty string. Task 3 reads exactly this shape.

In `lib/docs.js`, immediately above the `return` at the end of `normalise`, add:

```js
    // Where the directory tree lives, when the structural search in lib/map.js
    // gets it wrong — a file whose first box-drawing block is a diagram of
    // something else, or a README with a tree its author does not want lifted.
    //
    // An override, never a copy: the responsibility text stays in the README and
    // exists nowhere else, so there is no second version of it to disagree.
    // Validated the way `index` is, and dropped whole when neither half is usable
    // rather than half-kept, because a pointer with no file is not a pointer.
    const layoutIn = data.layout && typeof data.layout === 'object' ? data.layout : null;
    const layout = {};
    if (layoutIn && typeof layoutIn.file === 'string') {
        // Tested after the transform, not before. An earlier draft guarded on
        // `layoutIn.file.trim()` and stripped afterwards, so a file of `./`
        // passed the guard, became the empty string, and landed anyway — which
        // is the one shape the stated contract forbids.
        const file = layoutIn.file.replace(/\\/g, '/').replace(/^\.\//, '').trim();
        if (file) layout.file = file;
    }
    if (layoutIn && typeof layoutIn.heading === 'string') {
        const heading = layoutIn.heading.trim();
        if (heading) layout.heading = heading;
    }
```

and change the return to

```js
    const out = { preset: typeof data.preset === 'string' ? data.preset : 'custom', index, buckets };
    if (layout.file || layout.heading) out.layout = layout;
    return out;
```

Add to `tests/docs.test.js`:

```js
test('a layout pointer survives read, normalised the way index is', () => {
  const root = tree({
    '.fankeel/docs.json': JSON.stringify({
      preset: 'flat',
      index: 'docs/README.md',
      buckets: [{ path: 'docs', role: 'reference' }],
      layout: { file: '.\\README.md', heading: '  目錄結構  ' },
    }),
  });
  const parsed = docs.read(root).tree;
  assert.deepEqual(parsed.layout, { file: 'README.md', heading: '目錄結構' });
});

test('half a pointer is kept and no pointer at all is absent, not empty', () => {
  const only = docs.normalise({ buckets: [{ path: 'docs', role: 'reference' }], layout: { file: 'CLAUDE.md' } });
  assert.deepEqual(only.layout, { file: 'CLAUDE.md' });

  for (const bad of [undefined, null, 'README.md', [], {}, { file: '   ' }, { file: './' }, { heading: 42 }]) {
    const t = docs.normalise({ buckets: [{ path: 'docs', role: 'reference' }], layout: bad });
    assert.equal(t.layout, undefined, 'layout survived from ' + JSON.stringify(bad));
  }

  // The case the first draft of this file missed: `./` alone drops the whole key
  // because neither half is usable, but paired with a heading it kept the key
  // alive carrying an empty file. Half a pointer is kept — half an empty string
  // is not half a pointer.
  const stripped = docs.normalise({
    buckets: [{ path: 'docs', role: 'reference' }],
    layout: { file: './', heading: 'Layout' },
  });
  assert.deepEqual(stripped.layout, { heading: 'Layout' });
});
```

`tree(files)` at `tests/docs.test.js:21` writes a fixture from a file map and
returns its root; use it rather than `withTree` at `:31`, which takes a preset
*name* and calls `docs.write(root, docs.PRESETS[name])` — it cannot carry a
`layout` key. Do not redefine either.

Steps: add both tests, run `node --test tests/docs.test.js` and watch them fail,
make the two edits to `lib/docs.js`, run again and watch them pass, then
`npm test`, then commit.

**Dispatch:** implementer, sonnet — the plan carries the code and the exact
validation shape.

---

## Task 3 — find the tree by structure, and lift it

`lib/map.js` gains `layoutBlock(root, declared)`. It answers which file holds the
directory tree, which heading names it, the lines of it, and how many of those
lines carry no responsibility.

Measured 2026-08-29 over 185 `README.md` and `CLAUDE.md` files: 43 hold a box tree
of three lines or more, and taking the nearest heading above the first box line
found a heading in 43 of 43.

**Interfaces:**
- Consumes: `read(root).tree.layout` from Task 2 — `{ file?, heading? }` or
  `undefined`.
- Produces: `layoutBlock(root, declared)` returning `null`, or
  `{ file, heading, lines, rows, total, unfilled }` — `file` and `heading`
  strings, `lines` an array already cut to `MAX_WIDTH` and to `MAX_TREE` rows,
  `rows` how many entry lines are in `lines`, `total` how many the tree has
  before the cap, `unfilled` how many of the kept rows carry nothing after the
  path. `rows < total` means it was truncated. Task 4 renders exactly this.

In `lib/map.js`, beside `signpost()`:

```js
// Two patterns, because they answer different questions and conflating them
// counts a continuation line as a directory. Measured 2026-08-29 across 185
// README.md and CLAUDE.md files — every project under one workspace plus 36
// third-party plugins: 43 carry a tree, every one drawn with these characters,
// and not one written as a bullet list.
//
// MEMBER decides whether a line belongs to the block; a bare `│` holding a
// subtree open is part of the tree. ROW decides whether it is an entry worth
// counting, and — this is the part that took running it to find — where the
// block starts.
//
// Counting with MEMBER reported 45 trees where counting with ROW reports 43, and
// would have called every `│   ` line a directory with no responsibility. Worse,
// *seeking* with MEMBER found the wrong block entirely in three of 43 real files:
//
//   MeetPM/README.md:93     summary.json├─ push.mjs ──POST /meetings──▶ ...
//   XiaoMi.../README.md:124     ├─ Step 1: 待派工服務單處理 (已關閉)
//   esp32s3.../docs/README.md:368  ├─ XH711 Sensor Configuration
//
// All three draw a flow diagram with a single dash, above a real directory tree
// at :109, :222 and :459. Seeking MEMBER lands in the diagram, the block ends
// with too few rows, and the file is abandoned. Seeking ROW — two dashes, which
// is what a directory tree uses and a flow diagram does not — returns all 43.
const MEMBER = /[├└│]/;
const ROW = /[├└]──/;

// Three is the floor for the same reason `firstTable` uses three: one or two
// lines is a fragment of a diagram, not a map of a project.
const MIN_ROWS = 3;

// Rows of tree carried into the map. Deliberately not MAX_NAV, which is 24 and
// sized for the rows of a navigation table: measured over the same 43 trees the
// row count is 16 at the median, 30 at the third quartile, 48 at the ninetieth
// and 87 at the largest, so 24 would silently cut 13 of 43. Fifty cuts two, and
// nothing between fifty and eighty-seven buys a third. Fifty rows is roughly
// three kilobytes on a map that is two, which is the trade this whole design is:
// three kilobytes read once against a quarter of a million tokens of reading
// files to guess the same thing.
const MAX_TREE = 50;

// Which file, then which heading, then the block — and none of the three reads
// the heading's words. A keyword list of "Structure", "Directory", "Layout" would
// have missed 23 Chinese headings and 9 English ones that are ordinary sentences
// ("What lives where", "Files it writes"). Structure does not care what language
// the project is written in, which is the whole reason to use it.
function layoutBlock(root, declared) {
    const want = (declared && declared.layout) || {};
    const candidates = want.file ? [want.file] : SIGNPOSTS;

    for (const name of candidates) {
        const text = readIf(path.join(root, name));
        if (text === null) continue;
        const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));

        let first = -1;
        if (want.heading) {
            // Declared: the first box line after that heading, and no other.
            const at = lines.findIndex((l) => /^#{1,6}\s/.test(l)
                && l.replace(/^#{1,6}\s*/, '').trim() === want.heading);
            if (at === -1) continue;
            for (let i = at + 1; i < lines.length; i++) {
                if (/^#{1,6}\s/.test(lines[i])) break;
                if (ROW.test(lines[i])) { first = i; break; }
            }
        } else {
            first = lines.findIndex((l) => ROW.test(l));
        }
        if (first === -1) continue;

        // Contiguous from there. A gap of more than two non-member lines ends the
        // block, which is what separates a project's one tree from the second and
        // third diagrams further down the page. Measured over the 43: the largest
        // gap inside a tree is 0 in forty of them and 2 in three, and none has a
        // gap above 2 — so this threshold cuts nothing short in the whole sample.
        //
        // `total` keeps counting past the cap so the map can say what it left
        // out. A truncation nobody is told about is the failure `MAX_PAGES`
        // already avoids with its "... and N more".
        const out = [];
        let rows = 0;
        let total = 0;
        let gap = 0;
        for (let i = first; i < lines.length; i++) {
            if (/^#{1,6}\s/.test(lines[i])) break;
            if (/^\s*```/.test(lines[i])) break;
            const isRow = ROW.test(lines[i]);
            if (MEMBER.test(lines[i])) {
                gap = 0;
                if (isRow) total += 1;
                if (rows < MAX_TREE) { if (isRow) rows += 1; out.push(lines[i]); }
                continue;
            }
            if (++gap > 2) break;
            if (rows < MAX_TREE) out.push(lines[i]);
        }
        while (out.length && !MEMBER.test(out[out.length - 1])) out.pop();
        if (total < MIN_ROWS) continue;

        let heading = want.heading || '';
        if (!heading) {
            for (let i = first - 1; i >= 0; i--) {
                if (/^#{1,6}\s/.test(lines[i])) { heading = lines[i].replace(/^#{1,6}\s*/, '').trim(); break; }
            }
        }

        // A row with a path and nothing after it. 163 of 1,000 rows measured were
        // like this, spread across 31 of the 43 trees — partly described is the
        // normal state, so this counts rather than refuses. ROW rather than
        // MEMBER: a `│` holding a subtree open has no path and is not a row that
        // could have been filled in.
        let unfilled = 0;
        for (const l of out) {
            if (!ROW.test(l)) continue;
            const after = l.replace(/^.*[├└]──\s*/, '');
            if (after.trim().split(/\s+/).length < 2) unfilled += 1;
        }

        return {
            file: name,
            heading,
            lines: out.map((l) => l.slice(0, MAX_WIDTH)),
            rows,
            total,
            unfilled,
        };
    }
    return null;
}
```

Add `layoutBlock` to that file's `module.exports`.

Add to `tests/map.test.js`. That file has `root()` at `:16` and
`write(dir, rel, text)` at `:17` and **no** `withTree`; this puts the two together
because the tests below want a whole fixture at once. Add it beside them:

`tests/map.test.js` requires only `../lib/map.js` today; the override test below
reads a declaration, so add `const docs = require('../lib/docs.js');` beside it.

```js
const withFiles = (files) => {
  const dir = root();
  for (const [rel, text] of Object.entries(files)) write(dir, rel, text);
  return dir;
};

test('the tree is found with nothing declared, even when another file sorts first', () => {
  const dir = withFiles({
    'CLAUDE.md': '# c\n\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n',
    'README.md': '# r\n\n## 目錄結構\n\n├── lib/    the library\n├── docs/   the pages\n└── bin/    entry points\n',
  });
  const found = map.layoutBlock(dir, null);
  assert.equal(found.file, 'README.md');
  assert.equal(found.heading, '目錄結構');
  assert.equal(found.rows, 3);
  assert.equal(found.unfilled, 0);
});

test('a declared pointer overrides the structural search', () => {
  const dir = withFiles({
    'README.md': '# r\n\n## First\n\n├── a/  one\n├── b/  two\n└── c/  three\n\n'
      + '## Second\n\n├── x/  ex\n├── y/  why\n└── z/  zed\n',
    '.fankeel/docs.json': JSON.stringify({
      buckets: [{ path: 'docs', role: 'reference' }],
      layout: { file: 'README.md', heading: 'Second' },
    }),
  });
  const found = map.layoutBlock(dir, docs.read(dir).tree);
  assert.equal(found.heading, 'Second');
  assert.match(found.lines.join('\n'), /x\//);
  assert.doesNotMatch(found.lines.join('\n'), /a\//);
});

test('rows with a path and nothing after it are counted, not refused', () => {
  const dir = withFiles({
    'README.md': '# r\n\n## Layout\n\n├── lib/    the library\n├── docs/\n└── bin/\n',
  });
  const found = map.layoutBlock(dir, null);
  assert.equal(found.rows, 3);
  assert.equal(found.unfilled, 2);
});

test('fewer than three entry lines is a fragment, not a tree', () => {
  const dir = withFiles({ 'README.md': '# r\n\n## Layout\n\n├── lib/  one\n└── x/  two\n' });
  assert.equal(map.layoutBlock(dir, null), null);
});

test('a continuation line is part of the block but is not a row', () => {
  const dir = withFiles({
    'README.md': '# r\n\n## Layout\n\n├── lib/    the library\n│   └── x.js\n├── docs/   the pages\n└── bin/    entries\n',
  });
  const found = map.layoutBlock(dir, null);
  // Four entry lines, and the bare `│` line is carried but counted as neither a
  // row nor an unfilled one.
  assert.equal(found.rows, 4);
  assert.equal(found.unfilled, 1);
  assert.match(found.lines.join('\n'), /│   └── x\.js/);
});

test('a tree longer than the cap is cut and says how long it was', () => {
  const long = Array.from({ length: 60 }, (_, i) => '├── d' + i + '/  holds ' + i).join('\n');
  const dir = withFiles({ 'README.md': '# r\n\n## Layout\n\n' + long + '\n' });
  const found = map.layoutBlock(dir, null);
  assert.equal(found.total, 60);
  assert.equal(found.rows, 50);
  assert.equal(found.lines.filter((l) => /[├└]──/.test(l)).length, 50);
});

test('a file with no box lines at all yields nothing', () => {
  const dir = withFiles({ 'README.md': '# r\n\n- lib/ the library\n- docs/ the pages\n- bin/ entries\n' });
  assert.equal(map.layoutBlock(dir, null), null);
});

// Found by running this against 43 real files: three of them draw a flow diagram
// with a single dash above the real tree, and seeking any box character landed in
// the diagram and abandoned the file. A directory tree uses two dashes; a flow
// diagram does not.
test('a single-dash diagram above the tree does not swallow the search', () => {
  const dir = withFiles({
    'README.md': '# r\n\n## Pipeline\n\n  ├─ Step 1: fetch\n  ├─ Step 2: transform\n  └─ Step 3: push\n\n'
      + '## Layout\n\n├── lib/    the library\n├── docs/   the pages\n└── bin/    entry points\n',
  });
  const found = map.layoutBlock(dir, null);
  assert.equal(found.heading, 'Layout');
  assert.equal(found.rows, 3);
  assert.doesNotMatch(found.lines.join('\n'), /Step 1/);
});
```

`withFiles` is defined once, above the first of these tests, and Task 4 uses it
too. Do not add a second copy.

Steps: add the five tests, run `node --test tests/map.test.js` and watch them fail,
write `layoutBlock` and export it, run again and watch them pass, then `npm test`,
then commit.

**Dispatch:** implementer, sonnet — the plan carries the code and every threshold
with the measurement that set it.

---

## Task 4 — the map prints the tree, or names its absence

`buildMap()` renders what Task 3 found, and where there is nothing, says so and
names the command that starts one. Today the map lists the 14 documents that must
not be followed and never says which directories are worth reading.

**Interfaces:**
- Consumes: `layoutBlock(root, declared)` from Task 3.
- Produces: lines in `.fankeel/map.md`. Nothing imports this.

**What it costs the map.** Measured 2026-08-29 by lifting all 43 trees with
`MAX_TREE` and `MAX_WIDTH` applied: 1,124 bytes at the median, 1,475 at the mean,
3,722 at the ninetieth percentile and 4,985 at the largest — the last of those
with the cap already doing its work. `.fankeel/map.md` is 2,333 bytes on this
repository today, so the median case takes it to about three and a half
kilobytes.

It is paid once per survey, not per prompt: the map is a file the model reads at
`survey` step 2, and nothing injects it. Against it, the README it saves reading
averages 13,908 bytes — and the real comparison is not the README at all but the
reading-until-you-can-guess the spec measured at 249,000 tokens for this
repository.

In `buildMap`, after the `filing:` section and before `documents:`:

```js
    // What each directory is for — the one question orient, the scanner and the
    // status buckets all leave unanswered, and the reason a session reads files
    // until it can guess.
    const layout = layoutBlock(root, declared.tree);
    lines.push('');
    if (!layout) {
        lines.push('no directory tree found in ' + SIGNPOSTS.join(', ') + '.');
        lines.push('  `node <plugin>/scripts/layout.js` prints a skeleton to fill in.');
    } else {
        lines.push('tree — ' + layout.total + ' rows from ' + layout.file
            + ', under ' + (layout.heading || 'no heading')
            + (layout.rows < layout.total ? ', ' + layout.rows + ' shown' : '')
            + (layout.unfilled ? ', ' + layout.unfilled + ' with no responsibility' : ''));
        for (const l of layout.lines) lines.push('  ' + l);
    }
```

Add to `tests/map.test.js`:

```js
test('a project with no tree is told so, and told what makes one', () => {
  const dir = withFiles({ 'README.md': '# r\n\nprose only\n' });
  const text = map.buildMap(dir);
  assert.match(text, /no directory tree found in CLAUDE\.md, AGENTS\.md, README\.md/);
  assert.match(text, /scripts\/layout\.js/);
});

test('a tree is printed with its file, its heading and its unfilled count', () => {
  const dir = withFiles({
    'README.md': '# r\n\n## 目錄結構\n\n├── lib/  the library\n├── docs/\n└── bin/\n',
  });
  const text = map.buildMap(dir);
  assert.match(text, /tree — 3 rows from README\.md, under 目錄結構, 2 with no responsibility/);
  assert.match(text, /├── lib\/  the library/);
});

test('a fully described tree says nothing about unfilled rows', () => {
  const dir = withFiles({
    'README.md': '# r\n\n## Layout\n\n├── lib/  one\n├── docs/  two\n└── bin/  three\n',
  });
  assert.match(map.buildMap(dir), /tree — 3 rows from README\.md, under Layout\n/);
});
```

Steps: add the three tests, run `node --test tests/map.test.js` and watch them
fail, edit `buildMap`, run again and watch them pass, then `npm test`, then
`node scripts/map.js` on this repository and read `.fankeel/map.md` to see what it
now says about `docs/ hooks/ lib/ output-styles/ scripts/ skills/ tests/` — this
repository has no tree, so it must print the absent case. Then commit.

**Dispatch:** implementer, sonnet — the plan carries the code and the three
expected strings verbatim.

---

## Task 5 — say what `layout` is where `docs.json` is described

`docs/documents.md` describes what `docs.json` declares. It gains the `layout`
key. Without this the only description of the new key is a plan that gets archived.

**Interfaces:**
- Consumes: the behaviour built in Tasks 2, 3 and 4.
- Produces: nothing code depends on.

Read `docs/documents.md` in full first. Add, in that page's own voice and beside
the bucket table rather than as a new section at the end:

- that `layout` is optional, and what its two keys are;
- that it is an override, and that with it absent the tree is found by structure —
  the signpost file containing box-drawing characters, and the nearest heading
  above the first of them;
- that it points rather than copies, so the responsibility text has exactly one
  home and nothing can disagree with it;
- that `node <plugin>/scripts/layout.js` prints a skeleton where no tree exists.

Set that page's `last_verified` to the day it is re-read, and add `lib/map.js` to
its `source_of_truth` if it is not already named there.

Steps: read the page, make the edit, run `node scripts/docs-check.js` and
`npm test`, then commit.

**Dispatch:** in-session — matching an existing page's voice is judgement about
this repository, and the reading it needs is already here.

---

## Self-review

**Spec coverage.** README holds the text — Tasks 3, 4. `docs.json` holds a pointer
— Task 2. Found by structure — Task 3. Absence is a finding — Task 4. Half-filled
is counted — Tasks 3, 4. Skeleton, one level, prints nothing — Task 1. The
`--tree` defect this plan was written around **does not exist**: `parseArgs`
defaults the root, the two commands produce identical output, and the spec's
section on it now records the mistake rather than the bug.

**Placeholder scan.** No `TBD`, no "similar to Task N", no "add error handling".
Every task carries its code and its tests. Every task carries a `**Dispatch:**`
line.

**Type consistency.** `layoutBlock(root, declared)` takes the parsed tree, not the
raw `docs.json`; Task 3's tests pass `docs.read(root).tree` and Task 4 passes
`declared.tree`, which are the same object. `rows` is the box-line count in Task 3
and the grouping function in Task 1 — different files, no shared import, and the
alternative names read worse in both places. The `layout` key, the `layout` local
in `normalise`, and `layoutBlock` all refer to the same thing.
