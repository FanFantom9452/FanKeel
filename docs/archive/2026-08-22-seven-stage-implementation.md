---
status: archived
last_verified: 2026-08-22
source_of_truth: lib/stages.js, lib/map.js, lib/ledger.js
---

# Seven-Stage Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every stage a named internal sequence, add `plan` as a seventh stage, and generate a project map that travels from `survey` to `land` so no step has to rediscover what the project is.

**Architecture:** Two layers. The injected layer stays compressed law and rides every prompt; a new skill per stage carries the full protocol and is read once when the stage is entered. A generated `.fankeel/map.md` is the artefact both layers point at — built by `lib/map.js` from `CLAUDE.md`, `docs.json` and the per-file frontmatter contracts, never hand-written.

**Tech Stack:** Node.js, built-ins only. `node:test` + `node:assert/strict`. No dependencies — `package.json` is `private: true` and has none. Markdown for skills and documentation.

**Spec:** [docs/plans/2026-08-22-seven-stage-pipeline.md](../archive/2026-08-22-seven-stage-pipeline.md)

## Global Constraints

Generated from this repository rather than copied from prose. Every task's requirements implicitly include this section.

- **Zero dependencies.** `require` only `node:` built-ins and this repo's own modules. Adding a package is out of scope.
- **Indentation:** 4 spaces in `lib/` and `scripts/`, 2 spaces in `tests/`. Every file opens with `'use strict';`.
- **Tests:** `node --test` from the repo root. `const test = require('node:test');` and `const assert = require('node:assert/strict');`.
- **Stage rule cap:** `tests/stages.test.js:57` asserts `rulesFor(name).join('\n').length < 1600`. The `ALWAYS` block is **655 chars**, so a stage's own rules get **944**. Current own-sizes: survey 535, design 644, build 852, verify 366, audit 570, land 466. **`build` has 92 chars of headroom** — Task 3 raises the cap to 1800 before anything else grows.
- **Render caps:** `tests/render.test.js:254` asserts worst injection `< 2600`; `:263` asserts each stage `< 1900`. Task 3 raises these to 3000 and 2300.
- **Stage names:** must match `/^[a-z0-9][a-z0-9-]*$/` and be at most `MAX_WORD` = **16** characters (`lib/badge.js:19`), because the name is the statusline badge.
- **Skill contract** (`tests/skills.test.js`): directory name must equal frontmatter `name`; `name` must match `/^[a-z0-9-]+$/`; `description` must be **> 60 and < 500** characters and must contain the literal `Use for` or `Use when`.
- **Every new markdown page carries `status`, `last_verified` and `source_of_truth`** in frontmatter. A plan is filed under `docs/plans/`, never as reference.
- **Version lives in two files** and must agree: `package.json` and `.claude-plugin/plugin.json`. Target for this work: **0.24.0**.
- **`.fankeel/.gitignore`** currently holds exactly one line, `sessions/`. Generated files added under `.fankeel/` must be added to it.
- **Never write another session's registry file.** `lib/registry.js` invariants are enforced in `scripts/task.js`, not merely described.
- **Substitution tokens:** a rule naming a script carries a `{{TOKEN}}` that the caller replaces (`lib/stages.js:190`). A new script that a rule names needs a new token in `TOKENS` and a substitution wherever `rulesFor` is called.
- **Commit after every task.** Conventional prefixes as used in this repo: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `lib/map.js` | Build the project map text from a root directory. Pure: takes a path, returns a string. | 1 |
| `scripts/map.js` | CLI wrapper. Writes `.fankeel/map.md`, keeps `.gitignore` honest. | 2 |
| `lib/stages.js` | Gains the `plan` stage, `CLASSES`, and the `{{MAP}}` / `{{LEDGER}}` tokens. | 3, 4, 6, 8, 11 |
| `scripts/task.js` | Gains `--class`, which picks a route instead of typing one. | 5 |
| `lib/ledger.js` | Read and append the build ledger. Pure functions over text. | 7 |
| `scripts/ledger.js` | CLI wrapper: `init`, `complete`, `show`. | 7 |
| `skills/fankeel-<stage>/SKILL.md` | Six new skills, one per stage. The full protocol. | 9, 10 |
| `scripts/orient.js` | One function extracted to `lib/map.js` and called from there instead. | 1 |
| `docs/pipeline.md`, `docs/README.md`, `README.md` | Seven stages instead of six. | 12 |

---

### Task 1: The map builder

**Files:**
- Create: `lib/map.js`
- Modify: `scripts/orient.js` — `mapFrom` at line 150 calls the extracted helper
- Test: `tests/map.test.js`

**Interfaces:**
- Consumes: `lib/docs.js` — `read(root)`, `roleOf(tree, rel)`, `contractOf(text)`, `statusKind(status)`
- Produces:
  - `firstTable(lines, maxRows, maxWidth) -> string[]` — the first markdown table of at least 3 rows, or `[]`
  - `buildMap(root) -> string` — the whole `map.md` body including frontmatter
  - `signpost(root) -> {name, lines} | null` — which of `CLAUDE.md`, `AGENTS.md`, `README.md` was read, and its nav rows
  - `pagesByStatus(root) -> {current: string[], intent: string[], retired: string[], generated: string[], undeclared: string[]}`

- [ ] **Step 1: Write the failing test**

Create `tests/map.test.js`:

```js
'use strict';

// The map is the one artefact that travels from survey to land, so what matters
// is that it says what it does not know rather than producing an empty section
// that reads as "there is nothing here".

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const map = require('../lib/map.js');

const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-map-'));
const write = (dir, rel, text) => {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
};

test('firstTable takes the first table of three rows or more', () => {
  const lines = [
    '# Title',
    '',
    'Some prose.',
    '',
    '| a | b |',
    '|---|---|',
    '| 1 | 2 |',
    '',
    'after',
  ];
  assert.deepEqual(map.firstTable(lines, 18, 160), ['| a | b |', '|---|---|', '| 1 | 2 |']);
});

test('firstTable refuses a two-row table, which is a formatting accident', () => {
  assert.deepEqual(map.firstTable(['| a |', '|---|'], 18, 160), []);
});

test('the signpost is the first of CLAUDE.md, AGENTS.md, README.md that exists', () => {
  const dir = root();
  write(dir, 'README.md', '| x | y |\n|---|---|\n| 1 | 2 |\n');
  assert.equal(map.signpost(dir).name, 'README.md');
  write(dir, 'CLAUDE.md', '| a | b |\n|---|---|\n| 1 | 2 |\n');
  assert.equal(map.signpost(dir).name, 'CLAUDE.md');
});

test('a project with no signpost says so rather than returning nothing', () => {
  const dir = root();
  write(dir, 'lib/thing.js', 'x');
  const text = map.buildMap(dir);
  assert.match(text, /no CLAUDE\.md, AGENTS\.md or README\.md/);
});

test('pages are grouped by what they declare about themselves', () => {
  const dir = root();
  write(dir, '.fankeel/docs.json', JSON.stringify({ preset: 'flat', index: 'docs/README.md' }));
  write(dir, 'docs/now.md', '---\nstatus: current\n---\n# Now\n');
  write(dir, 'docs/later.md', '---\nstatus: design-intent\n---\n# Later\n');
  write(dir, 'docs/gone.md', '---\nstatus: archived\n---\n# Gone\n');
  write(dir, 'docs/bare.md', '# Bare\n');
  const by = map.pagesByStatus(dir);
  assert.deepEqual(by.intent, ['docs/later.md']);
  assert.deepEqual(by.retired, ['docs/gone.md']);
  assert.deepEqual(by.undeclared, ['docs/bare.md']);
  assert.ok(by.current.includes('docs/now.md'));
});

test('the map names what was planned but not built, because nothing else does', () => {
  const dir = root();
  write(dir, '.fankeel/docs.json', JSON.stringify({ preset: 'flat', index: 'docs/README.md' }));
  write(dir, 'docs/roadmap.md', '---\nstatus: design-intent\n---\n# Roadmap\n');
  const text = map.buildMap(dir);
  assert.match(text, /planned, not built/);
  assert.match(text, /docs\/roadmap\.md/);
});

test('the map declares itself generated so the sweep skips it', () => {
  const text = map.buildMap(root());
  assert.match(text, /^---\r?\nstatus: generated\r?\n/);
  assert.match(text, /source_of_truth: generated-by scripts\/map\.js/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/map.test.js`
Expected: FAIL with `Cannot find module '../lib/map.js'`

- [ ] **Step 3: Write `lib/map.js`**

```js
'use strict';

// The project's map, generated rather than written.
//
// Every stage before this existed started from the files the task named and
// inferred the rest, which works on a project built last week and fails on one
// stitched together from two systems. The thing that was missing is not a
// summary of the codebase — it is the project's own navigation, read: what the
// signpost file points at, and which of the documents are claiming to describe
// what exists as against what is meant to exist.
//
// It is generated because a hand-written map is the exact failure the
// documentation sweep exists to catch, and it is a file because a subagent
// should be handed a path rather than a paste.

const fs = require('node:fs');
const path = require('node:path');

const docs = require('./docs.js');

// A nav table longer than this is not being read as a table. The count of what
// was dropped is still printed — a silent cap reads as "that is all there is".
const MAX_NAV = 24;
const MAX_WIDTH = 160;
// Per status bucket. Same reasoning; the total is printed either way.
const MAX_PAGES = 30;

// In the order Claude Code itself prefers them.
const SIGNPOSTS = ['CLAUDE.md', 'AGENTS.md', 'README.md'];

function readIf(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
}

// The first markdown table of at least three rows. Extracted here because
// orient.js wants the same thing for a different reason, and two copies of one
// extractor is two answers to "what is this project's map".
function firstTable(lines, maxRows, maxWidth) {
    const start = lines.findIndex((l) => /^\s*\|.*\|\s*$/.test(l));
    if (start === -1) return [];
    const out = [];
    for (let i = start; i < lines.length && out.length < maxRows; i++) {
        if (!/^\s*\|/.test(lines[i])) break;
        out.push(lines[i]);
    }
    // A one-row table is a formatting accident, not a map.
    if (out.length < 3) return [];
    return out.map((l) => l.slice(0, maxWidth));
}

function signpost(root) {
    for (const name of SIGNPOSTS) {
        const text = readIf(path.join(root, name));
        if (text === null) continue;
        const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
        return { name, lines: firstTable(lines, MAX_NAV, MAX_WIDTH) };
    }
    return null;
}

// Every markdown file under the root, repo-relative, forward-slashed. Walks
// rather than shelling out to git: a project that is not a repository still has
// documents, and a map that only works inside git is a map that fails on the
// project most likely to need one.
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'target', 'coverage', 'vendor', '.fankeel']);

function markdownUnder(root) {
    const found = [];
    const walk = (dir, prefix) => {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
            return;
        }
        for (const entry of entries) {
            if (SKIP.has(entry.name)) continue;
            const rel = prefix ? prefix + '/' + entry.name : entry.name;
            if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
            else if (/\.md$/i.test(entry.name)) found.push(rel);
        }
    };
    walk(root, '');
    return found.sort();
}

function pagesByStatus(root) {
    const out = { current: [], intent: [], retired: [], generated: [], undeclared: [] };
    for (const rel of markdownUnder(root)) {
        const text = readIf(path.join(root, rel));
        if (text === null) continue;
        const contract = docs.contractOf(text);
        if (!contract.declared) {
            out.undeclared.push(rel);
            continue;
        }
        if (docs.isGenerated(contract)) out.generated.push(rel);
        else if (contract.kind === 'intent') out.intent.push(rel);
        else if (contract.kind === 'retired') out.retired.push(rel);
        else out.current.push(rel);
    }
    return out;
}

// A capped list plus an honest tail. Never a silent truncation.
function listing(items) {
    const shown = items.slice(0, MAX_PAGES).map((i) => '  ' + i);
    if (items.length > MAX_PAGES) shown.push('  ... and ' + (items.length - MAX_PAGES) + ' more');
    return shown;
}

function buildMap(root) {
    const lines = [
        '---',
        'status: generated',
        'source_of_truth: generated-by scripts/map.js',
        '---',
        '',
        '# ' + path.basename(path.resolve(root)) + ' — map',
        '',
        'Generated. Do not edit; re-run `node scripts/map.js` instead.',
        '',
    ];

    const sign = signpost(root);
    if (!sign) {
        lines.push('read first: nothing — no CLAUDE.md, AGENTS.md or README.md at the root.');
    } else if (!sign.lines.length) {
        lines.push('read first: ' + sign.name + ' — no navigation table in it.');
    } else {
        lines.push('read first: ' + sign.name);
        lines.push('');
        for (const l of sign.lines) lines.push(l);
    }

    const tree = docs.read(root);
    lines.push('');
    if (!tree) {
        lines.push('filing: nothing declared. `.fankeel/docs.json` would say which directory holds what.');
    } else {
        lines.push('filing:');
        for (const b of tree.buckets || []) lines.push('  ' + b.path + ' — ' + b.role);
    }

    const by = pagesByStatus(root);
    lines.push('');
    lines.push('documents: ' + Object.keys(by).reduce((n, k) => n + by[k].length, 0) + ' markdown files');

    // The section nothing else in this plugin produces, and the reason the map
    // exists: a page describing what the system is meant to become, read as
    // intent rather than as a description that has drifted.
    if (by.intent.length) {
        lines.push('');
        lines.push('planned, not built — ' + by.intent.length + ':');
        for (const l of listing(by.intent)) lines.push(l);
    }
    if (by.retired.length) {
        lines.push('');
        lines.push('retired, do not follow — ' + by.retired.length + ':');
        for (const l of listing(by.retired)) lines.push(l);
    }
    if (by.undeclared.length) {
        lines.push('');
        lines.push('undeclared — ' + by.undeclared.length + ', dated by git rather than by anyone reading them:');
        for (const l of listing(by.undeclared)) lines.push(l);
    }

    lines.push('');
    return lines.join('\n');
}

module.exports = { firstTable, signpost, pagesByStatus, buildMap, MAX_NAV, MAX_WIDTH, MAX_PAGES, SIGNPOSTS };
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test tests/map.test.js`
Expected: PASS, 7 tests

- [ ] **Step 5: Point `orient.js` at the extracted helper**

In `scripts/orient.js`, add to the requires near line 25:

```js
const { firstTable } = require('../lib/map.js');
```

Then replace the table branch inside `mapFrom` (lines 160–168) — from `const start = lines.findIndex(` through the closing brace of that `if` — with:

```js
    const table = firstTable(lines, MAP_LINES, MAP_WIDTH);
    if (table.length) return table;
```

- [ ] **Step 6: Run the orient tests**

Run: `node --test tests/orient.test.js`
Expected: PASS, no change in count

- [ ] **Step 7: Commit**

```bash
git add lib/map.js tests/map.test.js scripts/orient.js
git commit -m "feat: build the project map from its own navigation and contracts"
```

---

### Task 2: The map CLI

**Files:**
- Create: `scripts/map.js`
- Modify: `.fankeel/.gitignore`
- Test: `tests/map-cli.test.js`

**Interfaces:**
- Consumes: `lib/map.js` — `buildMap(root)`
- Produces: `main(argv) -> string`, `parseArgs(argv) -> {root, write}`, and the constant `MAP_REL = '.fankeel/map.md'`

- [ ] **Step 1: Write the failing test**

Create `tests/map-cli.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'map.js');
const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-mapcli-'));

const run = (dir) => execFileSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });

test('it writes the map where every stage will look for it', () => {
  const dir = root();
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '| a | b |\n|---|---|\n| 1 | 2 |\n');
  const out = run(dir);
  const written = path.join(dir, '.fankeel', 'map.md');
  assert.ok(fs.existsSync(written), 'no map written');
  assert.match(out, /\.fankeel[\\/]map\.md/);
  assert.match(fs.readFileSync(written, 'utf8'), /status: generated/);
});

test('it keeps the generated map out of git', () => {
  const dir = root();
  run(dir);
  const ignore = fs.readFileSync(path.join(dir, '.fankeel', '.gitignore'), 'utf8');
  assert.match(ignore, /^map\.md$/m);
  assert.match(ignore, /^sessions\/$/m);
});

test('running twice does not duplicate the ignore line', () => {
  const dir = root();
  run(dir);
  run(dir);
  const ignore = fs.readFileSync(path.join(dir, '.fankeel', '.gitignore'), 'utf8');
  assert.equal(ignore.split(/\r?\n/).filter((l) => l === 'map.md').length, 1);
});

test('it reports what it found rather than only that it wrote a file', () => {
  const dir = root();
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'later.md'), '---\nstatus: design-intent\n---\n# Later\n');
  const out = run(dir);
  assert.match(out, /1 planned, not built/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/map-cli.test.js`
Expected: FAIL — `Cannot find module` for `scripts/map.js`

- [ ] **Step 3: Write `scripts/map.js`**

```js
#!/usr/bin/env node
'use strict';

// Writes the map. Everything interesting is in lib/map.js; this owns the path,
// the ignore line, and saying what was found rather than only that a file was
// written — a script that reports "wrote map.md" has told the reader nothing
// they can act on.

const fs = require('node:fs');
const path = require('node:path');

const { buildMap, pagesByStatus } = require('../lib/map.js');

const MAP_REL = '.fankeel/map.md';
const IGNORE_LINE = 'map.md';

function parseArgs(argv) {
    let root = process.cwd();
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root' && argv[i + 1]) {
            root = argv[++i];
        }
    }
    return { root: path.resolve(root) };
}

// The map is generated, so committing it would put a file in review that nobody
// wrote. The ignore file is created if it is missing, because the state dir may
// not exist yet on a project that has never started a task.
function keepIgnored(stateDir) {
    const file = path.join(stateDir, '.gitignore');
    let text = '';
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) { /* first run */ }
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.includes('sessions/')) lines.push('sessions/');
    if (!lines.includes(IGNORE_LINE)) lines.push(IGNORE_LINE);
    fs.writeFileSync(file, lines.join('\n') + '\n');
}

function main(argv) {
    const { root } = parseArgs(argv);
    const stateDir = path.join(root, '.fankeel');
    fs.mkdirSync(stateDir, { recursive: true });
    keepIgnored(stateDir);

    const text = buildMap(root);
    const out = path.join(root, MAP_REL);
    fs.writeFileSync(out, text);

    const by = pagesByStatus(root);
    const total = Object.keys(by).reduce((n, k) => n + by[k].length, 0);
    const lines = ['fankeel map — ' + out];
    lines.push('');
    lines.push('  ' + total + ' markdown files'
        + ', ' + by.intent.length + ' planned, not built'
        + ', ' + by.retired.length + ' retired'
        + ', ' + by.undeclared.length + ' undeclared');
    lines.push('');
    lines.push('Read it before designing anything. It is regenerated, so it cannot be stale;');
    lines.push('if it is wrong, the project\'s own documents are what is wrong.');
    return lines.join('\n');
}

if (require.main === module) {
    process.stdout.write(main(process.argv.slice(2)) + '\n');
}

module.exports = { main, parseArgs, keepIgnored, MAP_REL, IGNORE_LINE };
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test tests/map-cli.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Add the line to this repo's own ignore file**

```bash
printf 'map.md\n' >> .fankeel/.gitignore
```

Verify it now reads exactly two lines, `sessions/` then `map.md`:

Run: `cat .fankeel/.gitignore`
Expected: `sessions/` and `map.md`

- [ ] **Step 6: Commit**

```bash
git add scripts/map.js tests/map-cli.test.js .fankeel/.gitignore
git commit -m "feat: write the generated map to .fankeel/map.md"
```

---

### Task 3: Raise the caps and add the `plan` stage

**Files:**
- Modify: `lib/stages.js` — `STAGES`, `FULL_ROUTE`, `TOKENS`
- Modify: `tests/stages.test.js:57` — the 1600 cap
- Modify: `tests/render.test.js:254,263` — the 2600 and 1900 caps
- Test: `tests/stages.test.js`

**Interfaces:**
- Produces: `byName('plan')` returns a stage whose `produces` is `'a decomposition someone with no context could execute'`; `FULL_ROUTE` becomes `['survey','design','plan','build','verify','audit','land']`; `TOKENS.map` is `'{{MAP}}'`

- [ ] **Step 1: Write the failing test**

Append to `tests/stages.test.js`:

```js
// Plan is its own stage rather than the head of build, because the approval of a
// plan is a human gate and build's own discipline is that it does not stop to
// ask. A gate inside a stage that must not stop is a contradiction that resolves
// itself by being ignored.
test('plan is a stage, and it sits between design and build', () => {
  const { FULL_ROUTE } = require('../lib/stages.js');
  assert.deepEqual(FULL_ROUTE, ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land']);
  assert.equal(nextStage('design'), 'plan');
  assert.equal(nextStage('plan'), 'build');
});

test('the plan stage refuses the placeholders that make a plan unexecutable', () => {
  const text = byName('plan').rules.join(' ');
  assert.match(text, /the actual code, not a description of it/);
  assert.match(text, /TBD/);
});

// The container superpowers already had; what changes is who fills it. Copied by
// hand, it carries whatever a person remembered from the spec, so anything true
// of the project but absent from the spec never reaches the work.
test('Global Constraints are generated from the project, not copied by hand', () => {
  const text = byName('plan').rules.join(' ');
  assert.match(text, /\{\{MAP\}\}/);
  assert.match(text, /Global Constraints/);
});

test('the plan stage shows its skeleton rather than describing one', () => {
  const t = templateFor('plan');
  assert.ok(t, 'no template');
  assert.match(t, /then AskUserQuestion/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/stages.test.js`
Expected: FAIL — `FULL_ROUTE` has 6 entries, `byName('plan')` is null

- [ ] **Step 3: Raise the three caps first**

In `tests/stages.test.js` line 57, change `1600` to `1800`. Replace the comment above the loop with:

```js
// 1800, not 1600. Seven stages now, and each carries a pointer to its own skill;
// the ALWAYS block is 655 of whatever the number is, so a stage's own rules get
// 1144. `build` is the binding one at 852 before this work, which is 92 chars of
// headroom under the old cap — a cap that would have been hit by the first rule
// added rather than by the rule that deserved to hit it.
```

In `tests/render.test.js` line 254, change `2600` to `3000`. In line 263, change `1900` to `2300`.

- [ ] **Step 4: Add the `plan` stage to `lib/stages.js`**

Add `map: '{{MAP}}'` to the `TOKENS` object (after `survey`):

```js
const TOKENS = {
    survey: '{{SURVEY}}',
    map: '{{MAP}}',
    todoCheck: '{{TODO_CHECK}}',
    docsCheck: '{{DOCS_CHECK}}',
    docsAudit: '{{DOCS_AUDIT}}',
};
```

Insert this stage object into `STAGES` between `design` and `build`:

```js
    {
        name: 'plan',
        produces: 'a decomposition someone with no context could execute',
        rules: [
            'Write it to docs/plans/<date>-<topic>.md, headed by the goal, the spec path, and Global Constraints taken from `node {{MAP}}` rather than remembered.',
            'A task is the smallest unit carrying its own test cycle. Fold setup and docs into the task that needs them; split only where a reviewer could reject one and pass its neighbour.',
            'Every step holds the actual code, not a description of it. TBD, "add appropriate error handling", "write tests for the above" and "similar to Task N" are failures, not shorthand.',
            'Before the gate, check it yourself: every spec requirement has a task, no placeholder survived, and a name a later task uses is the name an earlier task defined.',
            'Output: one line per task as `N. name — the files it touches`, then the question. Under 100 words of your own; the file is the output.',
        ],
        template: [
            'docs/plans/<date>-<topic>.md — <n> tasks',
            '',
            '1. <name> — path, path',
            '2. <name> — path',
            '',
            'constraints: <n> lines, from map.md',
            'then AskUserQuestion',
        ].join('\n'),
    },
```

Change `FULL_ROUTE`:

```js
const FULL_ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
```

Update the header comment at line 5 — `Six stages, because` becomes `Seven stages, because`, and add to the sentence listing what each produces: `` `plan` a decomposition someone with no context could execute, ``.

- [ ] **Step 5: Fix the canonical-order test**

`tests/stages.test.js:9` asserts the six names. Change it to:

```js
test('the stages are the seven a route is assembled from, in canonical order', () => {
  assert.deepEqual(NAMES, ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land']);
});
```

- [ ] **Step 6: Add the `FIRST_STEP` line in `scripts/task.js`**

In the `FIRST_STEP` object at line 38, after the `design` entry:

```js
    plan:   'Now plan: decompose it into tasks a stranger could execute, then stop at the gate.',
```

- [ ] **Step 7: Run the whole suite**

Run: `node --test`
Expected: PASS. Print the sizes to confirm the budget:

```bash
node -e "const s=require('./lib/stages.js');for(const n of s.NAMES)console.log(n,s.rulesFor(n).join('\n').length)"
```
Expected: every number below 1800, `plan` around 1560.

- [ ] **Step 8: Commit**

```bash
git add lib/stages.js scripts/task.js tests/stages.test.js tests/render.test.js
git commit -m "feat: make plan a stage of its own between design and build"
```

---

### Task 4: Classification and the preset routes

**Files:**
- Modify: `lib/stages.js` — add `CLASSES`, export it
- Test: `tests/route.test.js`

**Interfaces:**
- Consumes: `FULL_ROUTE` from Task 3
- Produces: `CLASSES` — an object keyed `spike` / `bounded` / `architectural`, each `{route: string[], means: string}`; and `routeForClass(name) -> string[] | null`

- [ ] **Step 1: Write the failing test**

Append to `tests/route.test.js`:

```js
// The classification superpowers makes before its first question, with the
// stations named. It is not new machinery — a route was already a field — it is
// the decision that picks one, which was being made silently or not at all.
test('the three classes are routes, not a separate mechanism', () => {
  const { CLASSES, routeForClass, normaliseRoute } = require('../lib/stages.js');
  assert.deepEqual(Object.keys(CLASSES), ['spike', 'bounded', 'architectural']);
  assert.deepEqual(routeForClass('spike'), ['survey', 'build']);
  assert.deepEqual(routeForClass('bounded'), ['survey', 'design', 'build', 'verify', 'land']);
  assert.deepEqual(routeForClass('architectural'), FULL_ROUTE);
  // Every preset must survive the same validation a typed route does.
  for (const name of Object.keys(CLASSES)) {
    assert.deepEqual(normaliseRoute(routeForClass(name)), routeForClass(name), name);
  }
});

test('an unknown class is refused rather than defaulting to the long route', () => {
  const { routeForClass } = require('../lib/stages.js');
  assert.equal(routeForClass('medium'), null);
  assert.equal(routeForClass(''), null);
  assert.equal(routeForClass(undefined), null);
});

test('every class says what it means, because the word alone does not', () => {
  const { CLASSES } = require('../lib/stages.js');
  for (const name of Object.keys(CLASSES)) {
    assert.ok(CLASSES[name].means.length > 30, name + ' has no explanation');
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/route.test.js`
Expected: FAIL — `CLASSES` is undefined

- [ ] **Step 3: Add `CLASSES` to `lib/stages.js`**

After the `FULL_ROUTE` declaration:

```js
// Three classes, because the route was already choosable and nobody was choosing
// it. A route typed by hand is a decision made silently; a class is the same
// decision made out loud, which is what lets the user disagree with it.
//
// Two rules travel with them and are enforced by nothing here, because neither
// is checkable: when in doubt take the heavier one, and the ratchet is one-way —
// complexity found mid-task upgrades the route and says so, and nothing
// downgrades mid-task.
const CLASSES = {
    spike: {
        route: ['survey', 'build'],
        means: 'a feasibility question whose output is an answer. Anything built is labelled throwaway.',
    },
    bounded: {
        route: ['survey', 'design', 'build', 'verify', 'land'],
        means: 'a scoped change to a flow already in this repository. Design happens in chat: no spec file, no plan file.',
    },
    architectural: {
        route: FULL_ROUTE.slice(),
        means: 'a new subsystem, or a change to an interface something else depends on.',
    },
};

// Null for anything unrecognised. Defaulting to the long route would turn a typo
// into six extra stages, and defaulting to the short one would skip the gates.
function routeForClass(name) {
    const found = CLASSES[String(name || '').trim().toLowerCase()];
    return found ? found.route.slice() : null;
}
```

Add both to the exports on the last line:

```js
module.exports = { ALWAYS, STAGES, NAMES, TOKENS, SURVEY_TOKEN, FULL_ROUTE, CLASSES, byName, nextStage, normaliseRoute, positionIn, routeForClass, rulesFor, templateFor };
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test tests/route.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/stages.js tests/route.test.js
git commit -m "feat: name the three task classes and the routes they pick"
```

---

### Task 5: `--class` on `task.js start`

**Files:**
- Modify: `scripts/task.js` — `parseArgs`, `cmdStart`
- Test: `tests/route.test.js`

**Interfaces:**
- Consumes: `routeForClass(name)` and `CLASSES` from Task 4
- Produces: `task.js start --class <spike|bounded|architectural>` writes `class` onto the entry alongside `route`

- [ ] **Step 1: Write the failing test**

Append to `tests/route.test.js`:

```js
test('a class picks the route and is recorded on the entry', () => {
  const dir = root();
  const r = run(dir, ['start', '--session', A, '--task', 'probe the ramp', '--scope', 'lib', '--class', 'spike']);
  assert.equal(r.code, 0, r.out);
  const data = JSON.parse(fs.readFileSync(registry.sessionPath(dir, A), 'utf8'));
  assert.deepEqual(data.route, ['survey', 'build']);
  assert.equal(data.class, 'spike');
  assert.match(r.out, /spike/);
});

test('a class and an explicit route together are refused, not silently ranked', () => {
  const dir = root();
  const r = run(dir, ['start', '--session', A, '--task', 't', '--scope', 'lib',
    '--class', 'spike', '--route', 'survey,design,build']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /--class or --route, not both/);
});

test('an unknown class lists the three rather than guessing', () => {
  const dir = root();
  const r = run(dir, ['start', '--session', A, '--task', 't', '--scope', 'lib', '--class', 'medium']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /spike/);
  assert.match(r.out, /bounded/);
  assert.match(r.out, /architectural/);
});

test('neither given still works, and still records no class', () => {
  const dir = root();
  const r = run(dir, ['start', '--session', A, '--task', 't', '--scope', 'lib']);
  assert.equal(r.code, 0, r.out);
  const data = JSON.parse(fs.readFileSync(registry.sessionPath(dir, A), 'utf8'));
  assert.deepEqual(data.route, FULL_ROUTE);
  assert.equal(data.class, undefined);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/route.test.js`
Expected: FAIL — `--class` is swallowed by the `arg.startsWith('--')` branch, `data.class` is undefined

- [ ] **Step 3: Parse the flag**

In `scripts/task.js` `parseArgs`, extend the first named-value branch at line 118:

```js
        if (arg === '--session' || arg === '--root' || arg === '--task' || arg === '--scope' || arg === '--class') {
            if (argv[i + 1] === undefined) fail(arg + ' needs a value.');
            opts[arg.slice(2)] = argv[++i];
            continue;
        }
```

- [ ] **Step 4: Use it in `cmdStart`**

Add to the requires at line 27: `CLASSES, routeForClass`.

```js
const { byName: stageByName, NAMES: STAGE_NAMES, FULL_ROUTE, CLASSES, normaliseRoute, positionIn, routeForClass } = require('../lib/stages.js');
```

Replace the route block in `cmdStart` (the four lines from `const route = opts.route ?` through the closing brace of the `if (!route)`) with:

```js
    // A class is the route said out loud. Both at once is refused rather than
    // ranked: whichever one lost would be a decision the user made and cannot
    // see, and this is the field the progress indicator is drawn from.
    if (opts.class && opts.route) {
        fail('--class or --route, not both. A class already names a route.');
    }
    let route;
    if (opts.class) {
        route = routeForClass(opts.class);
        if (!route) {
            fail('Not a class: ' + opts.class + NL
                + Object.keys(CLASSES).map((c) => '  ' + c + ' — ' + CLASSES[c].means).join(NL));
        }
    } else {
        route = opts.route ? normaliseRoute(splitScope(opts.route)) : FULL_ROUTE.slice();
    }
    if (!route) {
        fail('--route must be stages from: ' + STAGE_NAMES.join(', ')
            + NL + 'No repeats, and land last if it is there at all.');
    }
```

In the `data` object below it, add the class after `route`:

```js
        route,
        class: opts.class ? String(opts.class).trim().toLowerCase() : undefined,
```

Note: `JSON.stringify` drops a key whose value is `undefined`, so an unclassified task has no `class` key at all rather than a null one.

In the first output line of `cmdStart`, name the class when there is one:

```js
    const lines = ['fankeel — started, at ' + data.stage
        + (data.class ? '   class: ' + data.class : '')
        + '   route: ' + route.join(' → ')];
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/route.test.js tests/task.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/task.js tests/route.test.js
git commit -m "feat: start a task by class, which picks its route"
```

---

### Task 6: The map reaches survey, design, verify and land

**Files:**
- Modify: `lib/stages.js` — rules for `survey`, `design`, `verify`, `land`
- Modify: `lib/render.js` — the `{{MAP}}` substitution
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: `TOKENS.map` from Task 3, `scripts/map.js` from Task 2
- Produces: no new API. `rulesFor('survey', subs)` substitutes `subs.map` into `{{MAP}}`

- [ ] **Step 1: Find where the other tokens are substituted**

Run: `grep -rn "docsCheck\|todoCheck\|survey:" lib/render.js hooks/inject.js hooks/resume.js hooks/brief.js`
Expected: every call site that builds a `subs` object. Every one of them gains a `map:` key in Step 4.

- [ ] **Step 2: Write the failing test**

Append to `tests/stages.test.js`:

```js
// The map is generated at survey and rewritten at land, and read in between. A
// stage that reads it without anything regenerating it is reading a snapshot of
// a project that has since changed.
test('survey generates the map and reads what it says about intent', () => {
  const text = byName('survey').rules.join(' ');
  assert.match(text, /\{\{MAP\}\}/);
  assert.match(text, /planned but not built|design-intent/);
});

test('design is checked against the map rather than only against itself', () => {
  assert.match(byName('design').rules.join(' '), /map\.md/);
});

// Nothing in superpowers has a counterpart for this. A change that is correct and
// leaves three pages describing the old behaviour has been half verified.
test('verify covers the documents the change just falsified', () => {
  const text = byName('verify').rules.join(' ');
  assert.match(text, /\{\{DOCS_CHECK\}\}/);
  assert.match(text, /no longer true/);
});

test('land closes the documents and rewrites the map', () => {
  const text = byName('land').rules.join(' ');
  assert.match(text, /last_verified/);
  assert.match(text, /\{\{MAP\}\}/);
});

test('every stage still fits, with the pointer and the map rules added', () => {
  for (const name of NAMES) {
    const size = rulesFor(name).join('\n').length;
    assert.ok(size < 1800, name + ' rules are ' + size + ' chars');
  }
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `node --test tests/stages.test.js`
Expected: FAIL on all four new assertions

- [ ] **Step 4: Edit the four stages in `lib/stages.js`**

`survey` — replace rule 2 (`'Read whatever documents this area...'`) with two rules:

```js
            'Run `node {{MAP}}` and read what it lists as planned but not built. Those pages are intent, not drift: designing against them as if they described the code is the failure this stage exists to prevent.',
            'Read whatever documents this area. If it disagrees with the code, say so now — a stale document read later becomes a confident wrong answer.',
```

`design` — insert before the `Output:` rule:

```js
            'Check the approach against .fankeel/map.md before presenting it. Contradicting a page marked current is a contradiction that ships; say which page, or say you checked and found none.',
```

`verify` — insert before the `Output:` rule:

```js
            'Run `node {{DOCS_CHECK}}` and name any page this change just made no longer true. A change that is correct and leaves three pages describing the old behaviour is half verified.',
```

`land` — insert before the `Output:` rule:

```js
            'Update last_verified on every page you re-read, then re-run `node {{MAP}}`: the project looks different now and the next task starts from that map.',
```

- [ ] **Step 5: Add the substitution at every call site**

For each site found in Step 1, add a `map` key beside the existing `survey` key, resolved the same way the others are. In `lib/render.js` the existing shape is a `subs` object built from a plugin root; add:

```js
        map: script(root, 'map.js'),
```

using whatever local helper the neighbouring keys already use. If the file builds paths inline rather than through a helper, follow that form exactly rather than introducing one.

- [ ] **Step 6: Run the whole suite**

Run: `node --test`
Expected: PASS. Confirm no `{{MAP}}` survives into rendered output:

```bash
node -e "const r=require('./lib/render.js');const s=require('./lib/stages.js');for(const n of s.NAMES){}" && grep -rn "{{MAP}}" lib/stages.js | wc -l
```
Expected: `3` — the token appears in `TOKENS`, in survey's rule, and in land's rule, and nowhere else.

- [ ] **Step 7: Commit**

```bash
git add lib/stages.js lib/render.js tests/stages.test.js
git commit -m "feat: generate the map at survey, check against it at design, rewrite it at land"
```

---

### Task 7: The build ledger

**Files:**
- Create: `lib/ledger.js`
- Create: `scripts/ledger.js`
- Test: `tests/ledger.test.js`

**Interfaces:**
- Produces:
  - `ledgerPath(root, planFile) -> string` — `<root>/.fankeel/build/<plan-basename>/progress.md`
  - `header(planFile) -> string` — `'# fankeel build ledger — plan: <planFile>'`
  - `owns(text, planFile) -> boolean` — whether this ledger's first line names this plan
  - `completed(text) -> number[]` — task numbers with a completion line
  - `completionLine(n, note) -> string` — `'Task <n>: complete — <note>'`
  - `rulingLine(what, why, cost) -> string` — `'Ruling: <what> — <why> — costs if wrong: <cost>'`

- [ ] **Step 1: Write the failing test**

Create `tests/ledger.test.js`:

```js
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

const ledger = require('../lib/ledger.js');

const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-ledger-'));

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
  fs.appendFileSync(p, '\n' + ledger.completionLine(1, 'done'));
  ledger.init(dir, 'docs/plans/a.md');
  assert.deepEqual(ledger.completed(fs.readFileSync(p, 'utf8')), [1]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ledger.test.js`
Expected: FAIL — `Cannot find module '../lib/ledger.js'`

- [ ] **Step 3: Write `lib/ledger.js`**

```js
'use strict';

// Where the build stage keeps its place.
//
// The stage runs a task loop without stopping to ask, which is the right shape
// and also the shape that loses everything to a compaction. superpowers names
// this as the most expensive failure they observed: a controller that lost its
// place re-dispatched an entire sequence of already-committed tasks. So progress
// goes in a file, and the file says which plan it belongs to on its first line —
// a ledger for a different plan is somebody else's progress, not a head start.

const fs = require('node:fs');
const path = require('node:path');

const HEADER_PREFIX = '# fankeel build ledger — plan: ';
const COMPLETE = /^Task (\d+): complete\b/;

function ledgerPath(root, planFile) {
    const base = path.basename(String(planFile || 'plan'), '.md');
    return path.join(root, '.fankeel', 'build', base, 'progress.md');
}

const header = (planFile) => HEADER_PREFIX + String(planFile || '');

// Exact match on the first line. A ledger whose header names another plan is
// left in place and a fresh one is started beside it; merging two plans' progress
// is how a task gets skipped.
function owns(text, planFile) {
    const first = String(text || '').split(/\r?\n/)[0];
    return first === header(planFile);
}

function completed(text) {
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
        const m = COMPLETE.exec(line.trim());
        if (m) out.push(Number(m[1]));
    }
    return out;
}

const completionLine = (n, note) => 'Task ' + n + ': complete — ' + String(note || '').trim();

// A ruling with no cost attached is an opinion. The third field is what makes it
// reviewable later by somebody who was not here.
const rulingLine = (what, why, cost) =>
    'Ruling: ' + what + ' — ' + why + ' — costs if wrong: ' + cost;

// Creates it if missing, leaves it exactly as it is if it already belongs to this
// plan. Never truncates: the whole point is that it outlives the context.
function init(root, planFile) {
    const file = ledgerPath(root, planFile);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let existing = null;
    try {
        existing = fs.readFileSync(file, 'utf8');
    } catch (e) { /* first run */ }
    if (existing === null || !owns(existing, planFile)) {
        fs.writeFileSync(file, header(planFile) + '\n');
    }
    return file;
}

function append(root, planFile, line) {
    const file = init(root, planFile);
    fs.appendFileSync(file, String(line).replace(/\s+$/, '') + '\n');
    return file;
}

module.exports = { ledgerPath, header, owns, completed, completionLine, rulingLine, init, append, HEADER_PREFIX };
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test tests/ledger.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Write `scripts/ledger.js`**

```js
#!/usr/bin/env node
'use strict';

// The ledger, from the command line. Three verbs, because three is what the build
// loop actually does to it: open it, say a task is done, and — after a compaction
// — ask what it already knows.

const fs = require('node:fs');
const path = require('node:path');

const ledger = require('../lib/ledger.js');

function fail(message) {
    process.stdout.write(message + '\n');
    process.exit(1);
}

function parseArgs(argv) {
    const opts = { positional: [] };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root' || argv[i] === '--plan') {
            if (argv[i + 1] === undefined) fail(argv[i] + ' needs a value.');
            opts[argv[i].slice(2)] = argv[++i];
            i += 0;
            continue;
        }
        if (argv[i].startsWith('--')) continue;
        opts.positional.push(argv[i]);
    }
    return opts;
}

function main(argv) {
    const opts = parseArgs(argv);
    const root = path.resolve(opts.root || process.cwd());
    if (!opts.plan) fail('--plan <path to the plan file> is required.');
    const verb = String(opts.positional[0] || 'show').toLowerCase();

    if (verb === 'init') {
        return 'fankeel ledger — ' + ledger.init(root, opts.plan);
    }

    if (verb === 'complete') {
        const n = Number(opts.positional[1]);
        if (!Number.isInteger(n) || n < 1) fail('complete <task number> "<what landed>"');
        const note = opts.positional.slice(2).join(' ');
        if (!note.trim()) fail('Say what landed. A completion line with no note is a tick nobody can check.');
        ledger.append(root, opts.plan, ledger.completionLine(n, note));
        return 'fankeel ledger — Task ' + n + ' complete.';
    }

    if (verb === 'show') {
        const file = ledger.ledgerPath(root, opts.plan);
        let text = '';
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch (e) {
            return 'fankeel ledger — none yet at ' + file + '\nRun `init` before the first dispatch.';
        }
        if (!ledger.owns(text, opts.plan)) {
            return 'fankeel ledger — ' + file + ' belongs to another plan. Leave it; start your own.';
        }
        const done = ledger.completed(text);
        return 'fankeel ledger — ' + file + '\n'
            + '\n  complete: ' + (done.length ? done.join(', ') : 'nothing yet')
            + '\n\nResume at the first task not listed. Trust this and git log over what you remember.';
    }

    return fail('Verbs: init, complete, show.');
}

if (require.main === module) {
    process.stdout.write(main(process.argv.slice(2)) + '\n');
}

module.exports = { main, parseArgs };
```

- [ ] **Step 6: Add `build/` to the ignore file**

The ledger is scratch for one plan, not a record anybody reviews.

```bash
printf 'build/\n' >> .fankeel/.gitignore
```

Also add it to `keepIgnored` in `scripts/map.js` so a fresh project gets it too — change the function's body so the three lines are kept:

```js
    for (const want of ['sessions/', 'build/', IGNORE_LINE]) {
        if (!lines.includes(want)) lines.push(want);
    }
```

and delete the two individual `if (!lines.includes(...))` lines it replaces. Update `tests/map-cli.test.js`'s ignore test to also assert `/^build\/$/m`.

- [ ] **Step 7: Run the suite**

Run: `node --test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/ledger.js scripts/ledger.js tests/ledger.test.js tests/map-cli.test.js scripts/map.js .fankeel/.gitignore
git commit -m "feat: keep build's place in a ledger that survives compaction"
```

---

### Task 8: Build's rules gain the loop

**Files:**
- Modify: `lib/stages.js` — `TOKENS` gains `ledger`, `build` rules
- Modify: every `subs` call site found in Task 6 Step 1 — add `ledger`
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: `scripts/ledger.js` from Task 7
- Produces: `TOKENS.ledger` is `'{{LEDGER}}'`

- [ ] **Step 1: Write the failing test**

Append to `tests/stages.test.js`:

```js
// Build is the one stage that does not stop at a question, so it is the one
// stage whose place has to be written down somewhere other than the context.
test('build opens a ledger and resumes from it rather than from memory', () => {
  const text = byName('build').rules.join(' ');
  assert.match(text, /\{\{LEDGER\}\}/);
  assert.match(text, /never re-dispatch|already complete/);
});

test('build reviews each task rather than saving it all for the end', () => {
  assert.match(byName('build').rules.join(' '), /reviewer/);
});

// Four things stop the loop and only these. Named in the rules because the
// default when a rule is missing is to stop and ask, which is the failure.
test('build says what stops it, so that nothing else does', () => {
  const text = byName('build').rules.join(' ');
  assert.match(text, /irreversible/);
  assert.match(text, /Ruling:/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/stages.test.js`
Expected: FAIL on all three

- [ ] **Step 3: Edit `build` in `lib/stages.js`**

Add to `TOKENS`:

```js
    ledger: '{{LEDGER}}',
```

`build`'s rules become — the first, third and fourth are unchanged, the loop rules are inserted after the first:

```js
        rules: [
            'Finish what you start. Do not stop where the happy path works and the rest is "later".',
            'Working from a plan: `node {{LEDGER}} --plan <file> show` first, and never re-dispatch a task it lists as complete. `complete <n> "<what landed>"` after each. Trust it and git log over what you remember.',
            'Decide, do not stall — record it as `Ruling: <what> — <why> — costs if wrong: <cost>`. Only four things stop the loop: something irreversible, something security-sensitive, a side effect outside this workspace, or a plan where every path forward is a guess.',
            'After each task, one reviewer against the plan text and the diff. Fix rounds are bounded at five; a finding you overrule is a ruling, not a silence.',
            'Every changed line traces to the ask: follow the patterns already here rather than your own defaults, and do not improve adjacent code, comments or formatting on the way past. Remove what your own change orphaned; dead code you did not create gets mentioned, not deleted.',
            'Anything deferred goes in TODO.md as one line pointing at the detail — never as a comment nobody will find.',
            'A new document is the last resort: put it in an existing page, or write a generator when the content is derivable from code. One that is written carries status, last_verified and source_of_truth — and a plan is not filed as reference.',
            'Output: one line per file as `path +n/-m — what changed`, then the question. Under 80 words. The diff is the output; prose is for what it cannot show.',
        ],
```

- [ ] **Step 4: Check the budget before running anything else**

```bash
node -e "const s=require('./lib/stages.js');for(const n of s.NAMES)console.log(n,s.rulesFor(n).join('\n').length,'own',s.byName(n).rules.join('\n').length)"
```
Expected: `build` under 1800 total. If it is over, the rule to cut is the fourth — reviewer discipline belongs in the `fankeel-build` skill of Task 10, and the injected line can shrink to `After each task, one reviewer. See the fankeel-build skill.`

- [ ] **Step 5: Add the substitution**

Add `ledger:` beside `map:` at every `subs` call site, resolved to `scripts/ledger.js` the same way.

- [ ] **Step 6: Run the suite**

Run: `node --test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/stages.js lib/render.js tests/stages.test.js
git commit -m "feat: give build a ledger, a per-task reviewer and a rule about what stops it"
```

---

### Task 9: The first three stage skills

**Files:**
- Create: `skills/fankeel-survey/SKILL.md`
- Create: `skills/fankeel-design/SKILL.md`
- Create: `skills/fankeel-plan/SKILL.md`
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: nothing at runtime — these are prompt text
- Produces: three skill directories that `tests/skills.test.js` iterates automatically

- [ ] **Step 1: Write the failing test**

Append to `tests/skills.test.js`:

```js
// Seven stages, and the skill layer carries what the injected layer cannot: the
// formats. A rule that is a principle compresses; a rule that is a literal
// template does not, and an abbreviated template produces something that looks
// like the format and is not it.
test('every stage on the full route has a skill', () => {
  const { FULL_ROUTE } = require('../lib/stages.js');
  for (const stage of FULL_ROUTE) {
    const want = stage === 'audit' ? 'fankeel-audit' : 'fankeel-' + stage;
    assert.ok(names.includes(want), 'no skill for ' + stage);
  }
});

test('each stage skill ends at the gate rather than trailing off', () => {
  const { FULL_ROUTE } = require('../lib/stages.js');
  for (const stage of FULL_ROUTE) {
    const want = stage === 'audit' ? 'fankeel-audit' : 'fankeel-' + stage;
    assert.match(read(want), /AskUserQuestion/, want + ' never names the gate');
  }
});

test('the survey skill names the map generator, which is the step that was missing', () => {
  assert.match(read('fankeel-survey'), /scripts\/map\.js/);
  assert.match(read('fankeel-survey'), /design-intent/);
});

test('the plan skill refuses placeholders by listing them', () => {
  const text = read('fankeel-plan');
  assert.match(text, /TBD/);
  assert.match(text, /Global Constraints/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/skills.test.js`
Expected: FAIL — `no skill for survey`

- [ ] **Step 3: Write `skills/fankeel-survey/SKILL.md`**

```markdown
---
name: fankeel-survey
description: The survey stage — read the project's own map before reading its code, classify the work, and report what is already here. Use for the survey stage of a fankeel task, "what is already here", starting work in an unfamiliar repository, or when a task needs classifying as spike, bounded or architectural.
version: 0.24.0
status: current
last_verified: 2026-08-22
source_of_truth: lib/stages.js, scripts/map.js, scripts/survey.js
---

# fankeel-survey

Produces a statement of what already exists, a classification, and the map.

## The six steps

### 1. Locate

Repository root, git state, whether this is a worktree. `node <plugin>/scripts/orient.js` answers all three and says what else is under the root.

### 2. Read the map

```
node <plugin>/scripts/map.js [--root <dir>]
```

It writes `.fankeel/map.md` and prints a summary. Read the file, not only the summary. What it holds that nothing else does: the signpost file's navigation table, the filing declared in `docs.json`, and **every page's declared status**.

### 3. Take stock of the contracts

The section headed **planned, not built** is the one to read first. Those pages describe what the system is *meant* to become. They are not drifting when the code does not match them — they are doing their job, and designing against them as if they described the code is the failure this stage exists to prevent.

**retired, do not follow** is the opposite error: a page that was true once and is being read as if it still were.

**undeclared** pages are dated by git rather than by anyone having read them. A whitespace fix updates a git date and verifies nothing.

### 4. Targeted scan

```
node <plugin>/scripts/survey.js [--root <dir>] <term>...
```

Quote what came back. It reports declarations, not filename matches, for the languages it knows; anything else falls back to filename alone, so say so rather than reporting a clean sweep.

**"Nothing matched" is a finding.** Say which terms were tried — the next person needs to know a synonym was already ruled out.

### 5. Classify, out loud

| Class | Route | What it means |
|---|---|---|
| `spike` | `survey,build` | a feasibility question whose output is an answer. Anything built is labelled throwaway |
| `bounded` | `survey,design,build,verify,land` | a scoped change to a flow already in this repository. Design happens in chat: no spec file, no plan file |
| `architectural` | all seven | a new subsystem, or a change to an interface something else depends on |

**Bounded measures the repository, not your familiarity.** Understanding the kind of application is not enough — bounded means the flow being changed is already here to read. A new project has no existing flow, so it is architectural.

**When in doubt take the heavier one.** Reaching for a lighter label to skip work is itself the doubt.

Say the classification before acting on it, so it can be overridden. A classification made silently is one nobody can disagree with.

### 6. Write it down

```
node <plugin>/scripts/task.js start --session <id> --task "..." --scope "..." --class <class>
```

`--class` picks the route. Never pass both `--class` and `--route`.

## The ratchet

One-way. Hidden complexity found mid-task upgrades the route — stop, say so, and re-route with `task.js route`. Nothing downgrades mid-task.

## Output

```
<the map summary, quoted>
<the scanner block, quoted>

- path:line — what is there
- path:line — what is there

planned, not built: <the pages, or "none">
not found: <terms that matched nothing>
class: <class> — <why>
then AskUserQuestion
```

Under 120 words of your own. Option one on the question is the approval: say what accepting the classification accepts.
```

- [ ] **Step 4: Write `skills/fankeel-design/SKILL.md`**

```markdown
---
name: fankeel-design
description: The design stage — one approach with its trade-offs, a success criterion that can fail, and a check against the project map before anything is built. Use for the design stage of a fankeel task, choosing between approaches, writing a spec, or when an approach needs approving before implementation.
version: 0.24.0
status: current
last_verified: 2026-08-22
source_of_truth: lib/stages.js
---

# fankeel-design

Produces an approach someone agreed to — and for `architectural`, a spec file.

## The gate never scales down

The artefact scales with the task. A bounded change gets a few sentences in chat; an architectural one gets a spec file. **The approval does not scale.** "Too simple to need a design" means a short design, not no design.

Presenting a design and starting work in the same message is skipping the gate.

## The steps

### 1. One question at a time

Purpose, constraints, success criteria. One per message — if a topic needs more, break it up. Prefer multiple choice; open-ended is fine when the answer is not a menu.

If the request describes several independent subsystems, say so **before** spending questions on the details of one. A project too large for a single design gets decomposed first, and each piece gets its own cycle.

### 2. Two or three approaches

With trade-offs. Lead with the recommendation and say why. Cut ruthlessly — no features beyond the ask, no abstraction for single-use code, no configurability nobody requested, no error handling for impossible states.

### 3. The success criterion

**Name the test that fails now and passes after.** "Make it work" is not a criterion — weak criteria are what turn an independent build loop into constant clarification.

If a simpler approach exists, or the ask itself looks wrong, say so before building it.

### 4. Check against the map

Read `.fankeel/map.md`. Does this approach contradict a page listed as current? Does something in it belong under `status: design-intent` rather than being written as though it exists?

This is the step with no counterpart anywhere else: a spec self-review checks the spec against itself. A design that quietly contradicts a page marked current is a contradiction that ships.

### 5. Present in sections

Scale each section to its complexity — a few sentences if straightforward, up to 200–300 words if nuanced. Ask after each whether it holds. Architecture, components, data flow, error handling, testing.

### 6. The spec — `architectural` only

`docs/plans/YYYY-MM-DD-<topic>-design.md`, with `status: design-intent` frontmatter. A design is not filed as reference: it describes what is meant to be, and the sweep grades reference pages as claims about what is.

### 7. Self-review, then a person reads it

1. **Placeholders** — any TBD, incomplete section, or vague requirement. Fix them.
2. **Internal consistency** — do sections contradict each other?
3. **Scope** — focused enough for one plan, or does it need decomposing?
4. **Ambiguity** — could a requirement be read two ways? Pick one and make it explicit.
5. **Against the project** — step 4 again, now against the written text.

Then ask the user to read it. Wait.

## Output

```
<the approach, one sentence>

| file | change |
|---|---|
| path | what happens to it |

proves it done: <the test that fails now and passes after>
against the map: <the page it touches, or "no conflict">
unverified: <the one thing you have not checked>
then AskUserQuestion
```

Under 200 words. One approach, not a catalogue.
```

- [ ] **Step 5: Write `skills/fankeel-plan/SKILL.md`**

```markdown
---
name: fankeel-plan
description: The plan stage — decompose an approved design into tasks someone with no context could execute, with constraints generated from the project rather than remembered. Use for the plan stage of a fankeel task, writing an implementation plan, or breaking a spec into tasks before any code is written.
version: 0.24.0
status: current
last_verified: 2026-08-22
source_of_truth: lib/stages.js, scripts/map.js
---

# fankeel-plan

Produces a decomposition someone with no context could execute.

Write it assuming the engineer is skilled, has never seen this codebase, and will read the tasks out of order.

## Where it goes

`docs/plans/YYYY-MM-DD-<topic>.md`, `status: design-intent` frontmatter, committed.

## The header

Every plan starts with it:

```markdown
# <Feature> Implementation Plan

**Goal:** one sentence.
**Architecture:** two or three sentences on the approach.
**Tech Stack:** the versions and libraries that actually constrain the work.
**Spec:** path to the design this argues from.

## Global Constraints
```

## Global Constraints is generated, not remembered

This is the whole reason the stage exists on its own.

```
node <plugin>/scripts/map.js
```

Then take the constraints from the project itself: the conventions in `CLAUDE.md`, the filing rules in `docs.json`, the version floors and dependency limits that are actually in `package.json`, and the caps that tests already assert. **Copy exact values.** A constraint restated approximately is a constraint that gets violated precisely.

Every task's requirements implicitly include this section, which is why a constraint missing from it never reaches the work.

## File structure before tasks

Map which files are created or modified and what each is responsible for. This is where decomposition gets locked in — one clear responsibility per file, files that change together living together, split by responsibility rather than by technical layer.

In an existing codebase, follow the patterns already there. Do not unilaterally restructure.

## Task right-sizing

A task is **the smallest unit that carries its own test cycle and is worth a fresh reviewer's gate.**

Fold setup, configuration, scaffolding and documentation into the task whose deliverable needs them. Split only where a reviewer could meaningfully reject one task while approving its neighbour. Each task ends with an independently testable deliverable.

Every task carries an **Interfaces** block: what it consumes from earlier tasks with exact signatures, and what later tasks rely on with exact names and types. A task's implementer sees only their own task — this block is how they learn the names their neighbours use.

## Steps are two to five minutes

- Write the failing test
- Run it and watch it fail
- Write the minimal implementation
- Run it and watch it pass
- Commit

## No placeholders

These are **plan failures**, not shorthand:

- `TBD`, `TODO`, "implement later", "fill in details"
- "add appropriate error handling", "add validation", "handle edge cases"
- "write tests for the above" without the test code
- "similar to Task N" — repeat the code; they may be reading out of order
- a step that says what to do without showing how
- a reference to a type or function no task defines

## Self-review before the gate

1. **Spec coverage** — skim each requirement. Point at the task implementing it. List gaps.
2. **Placeholder scan** — the list above.
3. **Type consistency** — `clearLayers()` in Task 3 and `clearFullLayers()` in Task 7 is a bug.

Fix inline. If a requirement has no task, add the task.

## Output

```
docs/plans/<date>-<topic>.md — <n> tasks

1. <name> — path, path
2. <name> — path

constraints: <n> lines, from map.md
then AskUserQuestion
```

Under 100 words of your own. The file is the output. Option one on the question approves the plan and starts `build` — say that.
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/skills.test.js`
Expected: FAIL — build, verify and land skills still missing. The three survey/design/plan assertions pass.

- [ ] **Step 7: Commit**

```bash
git add skills/fankeel-survey skills/fankeel-design skills/fankeel-plan tests/skills.test.js
git commit -m "feat: add the survey, design and plan stage skills"
```

---

### Task 10: The last three stage skills

**Files:**
- Create: `skills/fankeel-build/SKILL.md`
- Create: `skills/fankeel-verify/SKILL.md`
- Create: `skills/fankeel-land/SKILL.md`
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: `scripts/ledger.js` from Task 7 — named by path in `fankeel-build`

- [ ] **Step 1: Write `skills/fankeel-build/SKILL.md`**

```markdown
---
name: fankeel-build
description: The build stage — run the plan's tasks in a loop that does not stop to ask, keeping its place in a ledger and reviewing each task as it lands. Use for the build stage of a fankeel task, implementing an approved plan, resuming build work after a compaction, or when a task loop needs a ledger.
version: 0.24.0
status: current
last_verified: 2026-08-22
source_of_truth: lib/stages.js, lib/ledger.js
---

# fankeel-build

Produces the change. **This stage does not stop at a question until it is done.**

## Setup

### 1. An isolated workspace

Use a worktree. Starting implementation on `main` or `master` needs the user's explicit consent — ask once, then proceed with whichever they chose.

### 2. Open the ledger

```
node <plugin>/scripts/ledger.js --plan docs/plans/<file>.md show
node <plugin>/scripts/ledger.js --plan docs/plans/<file>.md init
```

**Conversation memory does not survive compaction; this does.** A task the ledger lists as complete is done — do not re-dispatch it, resume at the first task without a completion line. After a compaction, trust the ledger and `git log` over your own recollection.

A ledger whose header names a different plan is another plan's progress. Leave it and start your own.

### 3. Scan the plan before the first task

Write down what you check as you check it. **The output is a table, not a verdict:**

- one row for every pair of tasks sharing a file or an interface — what one produces against what the other consumes, and what you found
- one row for every task — whether its own text agrees with itself, the tests it specifies against the code it specifies

"The scan is clean" without those rows is not a scan that was run. Write the table into the ledger, rule on anything it surfaces, and record each ruling.

## The task loop

For each task the ledger does not list as complete:

1. Record `git rev-parse HEAD` as BASE.
2. Implement it. Surgical: **every changed line traces to the plan's task.** Follow the patterns already in this repository. Do not improve adjacent code, comments or formatting. Remove what your own change orphaned; dead code you did not create gets mentioned, not deleted.
3. Test-first where the task says so — if you did not watch the test fail, you do not know it tests the right thing.
4. Commit.
5. Dispatch one reviewer against the task text and the diff from BASE. Give it the diff and the path to `.fankeel/map.md` — never a paste of the session's history.
6. Fix rounds are bounded at **five**. A finding you overrule is a ruling, not a silence.
7. `ledger.js --plan <file> complete <n> "<what landed>"`.

Then one whole-branch review when the last task is done.

## Rulings, not stalls

A running plan does not wait on a person. Conflicts, ambiguities, plan defects — decide them, record them:

```
Ruling: <what you decided> — <why> — costs if wrong: <what it costs>
```

The spec is the binding authority, the plan is its argument, your judgement settles what neither answers. A wrong ruling costs rework the user can see and undo; a session parked on a question costs their whole day and buys nothing.

**Four things stop the loop, and only these:**

1. an irreversible or destructive operation
2. a security-sensitive action
3. a side effect outside this workspace that norms say you ask about first — a merge, a push to a shared branch, a publish
4. a plan so broken that every path forward is a guess

## Delegation costs

Everything pasted into a dispatch prompt stays resident in this context and is re-read on every later turn. **Hand artefacts over as files.** A reviewer gets paths; it does not get the conversation.

## Output

```
- path +12/-3 — what changed
- path (new) — what it is

ledger: <n> of <m> complete
deferred: <TODO.md line, or omit this line>
then AskUserQuestion
```

Under 80 words. The diff is the output.
```

- [ ] **Step 2: Write `skills/fankeel-verify/SKILL.md`**

```markdown
---
name: fankeel-verify
description: The verify stage — evidence before claims, requirements checked line by line, and the documents this change just made false. Use for the verify stage of a fankeel task, before claiming work is complete or passing, before a commit or PR, or when checking whether a change broke the documentation describing it.
version: 0.24.0
status: current
last_verified: 2026-08-22
source_of_truth: lib/stages.js, scripts/docs-check.js
---

# fankeel-verify

Produces evidence, not confidence.

## The iron law

```
NO COMPLETION CLAIM WITHOUT FRESH VERIFICATION EVIDENCE
```

**If you have not run the verification command in this message, you cannot claim it passes.** Violating the letter of this is violating the spirit of it.

Before any claim: identify the command that proves it, run it in full, read the whole output and the exit code, check the output actually confirms the claim, and only then say so — with the evidence.

## What each claim requires

| Claim | Requires | Not sufficient |
|---|---|---|
| Tests pass | the test command's output, 0 failures | a previous run, "should pass" |
| Linter clean | the linter's output, 0 errors | a partial check |
| Build succeeds | the build command, exit 0 | the linter passing |
| Bug fixed | the original symptom retested | the code changed |
| Regression test works | red-green verified: revert the fix, watch it fail, restore | it passes once |
| An agent finished | the VCS diff | the agent's report |
| Requirements met | line by line against the plan | tests passing |

## Red flags — stop

"should", "probably", "seems to". Any expression of satisfaction before the command has run — "Great", "Perfect", "Done". Committing without verifying. Trusting an agent's success report. "Just this once."

## Documentation verification

The step with no counterpart anywhere else, and the reason half-verified changes ship:

```
node <plugin>/scripts/docs-check.js [--root <dir>]
```

Then ask the question the scanner cannot: **which page does this change make false?** A change that is correct and leaves three pages describing the old behaviour has been half verified. Name the page and the line.

A renamed export, a changed default, a removed flag — each of those has a page somewhere that still says the old thing.

## Half-built sends it back

Verify is not where the bar gets lowered. Anything unfinished returns to `build`.

## Output

```
$ <command>
<the line that decided it>
```

```
- <what you claimed> — held / did not hold
- docs: <page:line that is now false, or "none">
then AskUserQuestion
```

Filter the run. Never paste 34,000 characters to report 24.
```

- [ ] **Step 3: Write `skills/fankeel-land/SKILL.md`**

```markdown
---
name: fankeel-land
description: The land stage — a green suite, the documents closed, the map rewritten, and the integration decision left to the user. Use for the land stage of a fankeel task, finishing a development branch, deciding between merge and PR, or cleaning up a worktree when work is complete.
version: 0.24.0
status: current
last_verified: 2026-08-22
source_of_truth: lib/stages.js, scripts/todo-check.js, scripts/map.js
---

# fankeel-land

Produces a repository no dirtier than you found it.

## 1. The full suite, on the tree you are about to integrate

`npm test` / `cargo test` / `pytest` / `go test ./...` — whatever this project uses.

**Red stops everything.** Report the failures and stop; the menu comes after a green run. A green run earlier in the session only proves the tree it ran on.

## 2. Close the documents

```
node <plugin>/scripts/todo-check.js [--root <dir>]
```

Close the `TODO.md` entries this work finished — whoever finishes the work removes the entry in the same change. A plan that just moved is a link that just changed address.

Update `last_verified` on every page you re-read and found true. That date is the difference between "somebody touched this file" and "somebody read it and it was true".

A landed plan leaves a decision record behind — what was decided and why — then is archived, **after asking**. An unarchived plan gets read as current.

## 3. Rewrite the map

```
node <plugin>/scripts/map.js [--root <dir>]
```

The project looks different now. The next task starts from this file.

## 4. Land the notes

Task notes die with the task. Anything still true belongs somewhere durable:

| | |
|---|---|
| a project convention | `CLAUDE.md` |
| a durable fact about the user or repository | the memory directory |
| why a change was made | the commit message |
| work deliberately deferred | `TODO.md`, one line, linking to the detail |

Commit the reason, not the diff. The diff is already in the commit.

## 5. Detect the workspace, confirm the base

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

`GIT_DIR == GIT_COMMON` is a normal repository with no worktree to clean up. Otherwise it is a worktree, and a detached HEAD is externally managed — leave it in place.

The base branch is whatever this work forked from. If it is not already known, ask. Merging into the wrong base is expensive to undo.

## 6. The menu

Present exactly these, and wait. Integration is the user's decision.

```
1. Merge back to <base> locally
2. Push and create a Pull Request
3. Keep the branch as-is
```

**Discarding is not on the menu.** It happens only when the user asks for it in so many words, and then only against the typed word `discard`.

## 7. Execute

**Merge:** from the main repo root, checkout base, pull, merge, **re-run the suite on the merged result**. A failure there stops everything — nothing has been pushed, so it is recoverable. Green, then clean the worktree, then `git branch -d`.

**PR:** push, open it against the base, report the URL. **Keep the worktree** — PR feedback gets fixed there.

**Keep:** say where the branch and worktree are.

Worktree removal refused for uncommitted files never gets `--force` on your own initiative. Show the user `git status --porcelain -uall` and ask.

## Output

```
<sha> <subject>
cost: <what it took>
open: <what is still not done>
then AskUserQuestion
```

Three lines. Not a tour of the diff.
```

- [ ] **Step 4: Run the skills tests**

Run: `node --test tests/skills.test.js`
Expected: PASS. Confirm every description is inside the bounds:

```bash
node -e "const fs=require('fs');for(const d of fs.readdirSync('skills')){const t=fs.readFileSync('skills/'+d+'/SKILL.md','utf8');const m=/description:\s*(.*)/.exec(t);console.log(String(m[1].length).padStart(4),d)}"
```
Expected: every number between 61 and 499.

- [ ] **Step 5: Run the whole suite**

Run: `node --test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add skills/fankeel-build skills/fankeel-verify skills/fankeel-land
git commit -m "feat: add the build, verify and land stage skills"
```

---

### Task 11: The injected rules point at their skill

**Files:**
- Modify: `lib/stages.js` — one rule appended per stage
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: the six skills from Tasks 9 and 10, plus the existing `fankeel-audit`
- Produces: no new API

- [ ] **Step 1: Write the failing test**

Append to `tests/stages.test.js`:

```js
// Two layers. The injected one carries what compresses — the iron law, the red
// flag words, the surgical rule — and rides every prompt. The skill carries what
// does not: the task template, the ledger's header contract, the menus. An
// abbreviated format produces something that looks like the format and is not it.
test('every stage points at the skill holding the part that does not compress', () => {
  for (const name of NAMES) {
    const want = name === 'audit' ? 'fankeel-audit' : 'fankeel-' + name;
    assert.match(byName(name).rules.join(' '), new RegExp(want), name + ' points at no skill');
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/stages.test.js`
Expected: FAIL for all seven

- [ ] **Step 3: Append one rule to each stage**

Insert as the **second-to-last** rule of each stage, so the `Output:` rule stays last:

```js
// survey
            'The full protocol is the fankeel-survey skill; read it once on entering this stage.',
// design
            'The full protocol is the fankeel-design skill; read it once on entering this stage.',
// plan
            'The full protocol is the fankeel-plan skill, including the task template and the placeholder list.',
// build
            'The full protocol is the fankeel-build skill: the ledger contract, the conflict scan and the review loop.',
// verify
            'The full protocol is the fankeel-verify skill, including the claim-to-evidence table.',
// audit
            'The full protocol is the fankeel-audit skill; /fankeel-audit runs it without a task.',
// land
            'The full protocol is the fankeel-land skill, including the integration menu and the cleanup rules.',
```

- [ ] **Step 4: Check the budget**

```bash
node -e "const s=require('./lib/stages.js');let w=0;for(const n of s.NAMES){const c=s.rulesFor(n).join('\n').length;w=Math.max(w,c);console.log(n,c)}console.log('worst',w)"
```
Expected: worst under 1800. If `build` exceeds it, shorten its pointer to `'Protocol: the fankeel-build skill.'` — the stage skills are addressable by name, so the sentence around the name is the compressible part.

- [ ] **Step 5: Run the whole suite**

Run: `node --test`
Expected: PASS, including the render caps raised in Task 3

- [ ] **Step 6: Commit**

```bash
git add lib/stages.js tests/stages.test.js
git commit -m "feat: point each stage's rules at the skill holding its full protocol"
```

---

### Task 12: The documentation says seven

**Files:**
- Modify: `docs/pipeline.md`
- Modify: `docs/README.md`
- Modify: `README.md`
- Modify: `skills/fankeel/SKILL.md`
- Modify: `.claude-plugin/plugin.json` — the description says "six-stage"
- Modify: `.fankeel/docs.json` — nothing; `skills` is already a bucket

**Interfaces:**
- Consumes: everything above

- [ ] **Step 1: Find every place the count is stated**

```bash
grep -rn "six stage\|six-stage\|Six stages\|six of them\|all six" --include=*.md --include=*.json --include=*.js . | grep -v node_modules
```
Expected: a list. Every hit is either updated to seven or, where it describes history, left with the date it described.

- [ ] **Step 2: Update `docs/pipeline.md`**

- The subtitle line 8: `the six stages` becomes `the seven stages`.
- The stage table gains a `plan` row between `design` and `build`: `| `plan` | a decomposition someone with no context could execute |`
- The route section: `Omit --route and it is all six` becomes `all seven`, and gains the class table from Task 4's `CLASSES`.
- Add a section **The project map** describing `.fankeel/map.md`: generated, git-ignored, written at `survey` and rewritten at `land`, and what its `planned, not built` section is for.
- Regenerate the injected-block example. The two blocks in this page come from the renderer; regenerate the first from real output rather than editing it by hand.

- [ ] **Step 3: Update `docs/README.md`**

Add rows to the question table:

Each right-hand cell is a markdown link to `pipeline.md`, relative to `docs/` —
the same form as every row already in that table. Written here without live link
syntax so that `docs-check` does not resolve them from this file's directory:

```
| What the seven stages are and what each produces      | pipeline.md                          |
| Why my task is three stages and not seven             | pipeline.md, italicised "a route per task"      |
| What spike, bounded and architectural mean            | pipeline.md, italicised "the three classes"     |
| What `.fankeel/map.md` holds and why it is generated  | pipeline.md, italicised "the project map"       |
```

Remove the now-wrong `What the six stages are` row. Change `Seven pages, one question each` in the opening paragraph only if the count of reference pages actually changed — it does not.

- [ ] **Step 4: Update `README.md`**

- The mermaid stage-flow diagram gains a `plan` node between `design` and `build`.
- The "Where to find things" table gains a row for the map.
- Regenerate the injected-block example from the renderer.

- [ ] **Step 5: Update `skills/fankeel/SKILL.md`**

- The `description` frontmatter names the stages: add `plan` to the list, and check the result is still under 500 characters.
- The stages table gains the `plan` row.
- The route section gains the three classes and `--class`.
- Add `fankeel-survey`, `fankeel-design`, `fankeel-plan`, `fankeel-build`, `fankeel-verify` and `fankeel-land` to wherever `fankeel-audit` is currently named, so the entry skill points at all seven rather than one.

- [ ] **Step 6: Update `.claude-plugin/plugin.json`**

The `description` says `a six-stage pipeline`. Change to `a seven-stage pipeline`.

- [ ] **Step 7: Run the checkers**

```bash
node --test
node scripts/docs-check.js
node scripts/docs-audit.js
node scripts/todo-check.js
```
Expected: tests pass; `docs-check` reports every reference resolving; `docs-audit` reports 0 defects; `todo-check` reports all links resolving and none over the cap.

- [ ] **Step 8: Commit**

```bash
git add docs README.md skills/fankeel/SKILL.md .claude-plugin/plugin.json
git commit -m "docs: seven stages, the three classes, and the generated map"
```

---

### Task 13: Ship it

**Files:**
- Modify: `package.json`, `.claude-plugin/plugin.json` — version
- Modify: `TODO.md` — close what this work finished
- Modify: `docs/plans/2026-08-22-seven-stage-pipeline.md` — status

**Interfaces:**
- Consumes: every task above

- [ ] **Step 1: Verify against the spec's own criteria**

The spec lists six things that would prove this done. Run each and record the actual output:

```bash
node scripts/task.js start --session 11111111-2222-3333-4444-555555555555 --task "probe" --scope lib --class spike --root "$TMP/fk" --claude-dir "$TMP/fkcfg"
node scripts/map.js --root "F:/ymlab/SBIR/ProjectWorkspace/Trovara"
node scripts/map.js --root "$TMP/empty"
node scripts/ledger.js --plan docs/plans/2026-08-22-seven-stage-implementation.md show
```

Expected, in order: a two-stage route recorded with `class: spike`; Trovara's navigation table named and its `design-intent` pages counted; the empty project's map saying `no CLAUDE.md, AGENTS.md or README.md`; the ledger listing this plan's completed tasks.

**`F:\ymlab\SBIR\ProjectWorkspace` is read-only.** `scripts/map.js` writes `.fankeel/map.md` under its root, so run it against a **copy** of Trovara or with `--root` pointing at a temporary clone. Do not write into that tree.

- [ ] **Step 2: Bump the version in both files**

`package.json` and `.claude-plugin/plugin.json`, both to `0.24.0`. The `version:` frontmatter in each new SKILL.md already says `0.24.0`; check `skills/fankeel/SKILL.md` and `skills/fankeel-audit/SKILL.md` agree.

```bash
grep -rn '"version"\|^version:' package.json .claude-plugin/plugin.json skills/*/SKILL.md
```
Expected: every line reads `0.24.0`.

- [ ] **Step 3: Close the TODO entry this finished**

Remove the `Whether build should dispatch one implementer subagent per task` entry only if Task 8 actually shipped the fleet — **it does not**, so leave it. Instead re-point it at the shipped shape:

```markdown
- Whether `build` should dispatch one implementer subagent per task rather than reviewing after each — [docs/plans/2026-08-22-seven-stage-pipeline.md](docs/archive/2026-08-22-seven-stage-pipeline.md), "build".
```

Run: `node scripts/todo-check.js`
Expected: all links resolve, none over the 200-character cap.

- [ ] **Step 4: Mark the spec landed**

In `docs/plans/2026-08-22-seven-stage-pipeline.md` frontmatter, change `status: design-intent` to `status: current` and `source_of_truth` to `lib/stages.js, lib/map.js, lib/ledger.js`. In this file, change `status:` to `superseded-by docs/plans/2026-08-22-seven-stage-pipeline.md`.

- [ ] **Step 5: Full green before any claim**

```bash
node --test
node scripts/docs-check.js
node scripts/docs-audit.js
node scripts/todo-check.js
```
Expected: **quote the actual output.** Do not claim these pass without running them in the same message as the claim.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: 0.24.0 — seven stages, six stage skills, a generated map and a build ledger"
```

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: the route diagram → 3; three preset routes → 4, 5; the project map → 1, 2; survey/design/verify/land steps → 6; plan steps → 3, 9; build steps → 7, 8, 10; audit → unchanged, already shipped as `fankeel-audit`; the two-layer argument → 11; "what would prove this done" → 13 Step 1; "what is deliberately not being built" → no task, correctly.

**Gaps found and closed while reviewing:**

- The spec's `verify` step 5, *code review requested and received*, has no dedicated task. It is prompt text inside `skills/fankeel-verify/SKILL.md` (Task 10 Step 3) rather than code, which is correct — there is nothing to build.
- `hooks/brief.js` hands a subagent its brief and is where the map's path should be added for Task 10's reviewer dispatch to receive it. Task 6 Step 1's grep covers `hooks/brief.js`, so the `map` substitution lands there; **the brief's text itself is not updated by any task.** Whoever runs Task 8 should check `hooks/brief.js` names `.fankeel/map.md` and add it if not.

**Placeholder scan.** No `TBD`, no "add appropriate error handling", no "similar to Task N". Task 6 Step 5 and Task 12 Steps 2–5 describe edits without pasting the full file — the exact anchor, the exact replacement text and the exact expected result are given for each, which is the most a plan can specify against a file whose surrounding lines it does not control.

**Type consistency.** `buildMap`, `pagesByStatus`, `firstTable`, `signpost` are used in Tasks 1, 2 and 12 under those exact names. `ledgerPath`, `owns`, `completed`, `completionLine`, `rulingLine`, `init`, `append` likewise across Tasks 7, 8 and 10. `routeForClass` and `CLASSES` across 4 and 5. `MAP_REL` is defined in Task 2 and never used elsewhere — it is exported for tests, which is why it exists.

[Back to the index](../README.md) · [Back to the front page](../../README.md)
