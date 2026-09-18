---
status: design-intent
last_verified: 2026-09-18
---

# TODO 十九條 Implementation Plan

**Goal:** 把 `TODO.md` `## Needs a decision` 的十九條照已批准的設計各自落地並關掉。
**Architecture:** 十九節各成一個 task，按共用檔案分組；程式類 task 先寫紅的測試再實作，文件類 task 以 grep、`docs-check`、`docs-audit`、`todo-check` 的輸出為證。station 的三個畫面照 `.fankeel/build/2026-09-18-todo-nineteen/mockup.html` 做。
**Tech Stack:** Node 內建模組，CommonJS，`node --test`；沒有任何依賴。
**Spec:** [2026-09-18-todo-nineteen-design.md](2026-09-18-todo-nineteen-design.md)

## Global Constraints

- `package.json` 沒有 `dependencies` 也沒有 `devDependencies`，`test` 是 `node --test`。不得新增依賴，只用 Node 內建模組。
- 模組是 CommonJS，開頭 `'use strict';`。縮排跟著檔案本身：`lib/`、`scripts/` 四格，`tests/` 兩格。
- `tests/source.test.js:92`：every exported name is imported by something。它讀 `git ls-files`，新檔要 `git add` 之後才被檢查。
- `tests/contract.test.js:262`：every file that carries the version carries the same one。
- `tests/render.test.js:548`、`:559`：`init` 區塊（有沒有 station 行都一樣）在參考根目錄下要小於 1400 字元；`:559` 用 `$` 結尾的 regex 釘住 station 行。要加規則就擠掉一句理由搬進 skill，不調高上限。
- 各站規則區塊的上限在 `lib/stages.js`（`budget: 2400`／`2500`）；`skills/registry.json` 由 `scripts/stage-registry.js` 產生，改到站規則就要重產。
- `node scripts/docs-check.js` exit 0；搬動程式碼會讓文件的 `path:line` 位移，docs-check 會印出每一條，在同一個 task 裡修掉。
- `node scripts/todo-check.js` exit 0。
- `CONTRIBUTING.md:21`：`station.js serve` 寫出的檔案永遠不手改。
- `docs/improvement-brief.md` 是 `status: design-intent`；`docs/archive/` 已退役；`docs/reports/`、`docs/judgements/` 寫一次不改。
- 實作者只跑自己的測試檔；整套 `npm test` 由主 session 在 commit 一組之前跑。多個實作者共用工作樹，commit 一律 `git commit -o <paths>`。
- Windows：含反斜線的內容走 Write／Edit，不走 shell heredoc；不跑 `find /`。

## File structure

| file | modified by | read by | tested by |
|---|---|---|---|
| `.claude-plugin/plugin.json` | T7 | — | — |
| `.fankeel/map.md` | — | T12 | — |
| `.ignore` | T18 | — | — |
| `assets/station/station.css` | T12, T13 | — | — |
| `assets/station/station.js` | T11, T12, T13 | — | — |
| `docs/decisions/2026-09-18-caveman-absorb-none.md` | T16 | — | — |
| `docs/development.md` | T15 | — | — |
| `docs/documents.md` | T14, T18 | — | — |
| `docs/improvement-brief.md` | T8, T16 | — | — |
| `docs/judgements/2026-09-10-pattern-skill.md` | — | T16 | — |
| `docs/pipeline.md` | T3, T15 | — | — |
| `docs/README.md` | T12, T16 | — | — |
| `docs/registry.md` | T8, T9, T10 | T15 | — |
| `docs/reports/2026-09-09-design-axis-inventory.md` | — | T16 | — |
| `docs/sources.md` | T17 | — | — |
| `docs/station.md` | T11, T12, T13, T15 | T16 | — |
| `docs/subagents.md` | — | T16 | — |
| `hooks/resume.js` | T8 | — | — |
| `hooks/size.js` | T7 | — | — |
| `lib/context.js` | T8 | T13 | — |
| `lib/detail.js` | T13 | — | — |
| `lib/gates.js` | T10 | — | — |
| `lib/guard.js` | T5 | — | — |
| `lib/ledger.js` | T6 | — | — |
| `lib/live.js` | T4 | — | — |
| `lib/registry.js` | T4 | — | — |
| `lib/render.js` | T8, T11 | — | — |
| `lib/skill-overlap.js` | T3 | — | — |
| `lib/skills.js` | — | T1 | — |
| `lib/stages.js` | T11 | — | — |
| `lib/station.js` | T12 | — | — |
| `lib/usage.js` | T4 | T16 | — |
| `scripts/docs-check.js` | T14 | — | — |
| `scripts/judge.js` | T1 | — | — |
| `scripts/ledger.js` | T6 | T1 | — |
| `scripts/orient.js` | T3 | — | — |
| `scripts/sessions.js` | T7 | — | — |
| `scripts/station.js` | T2 | T1 | — |
| `scripts/survey.js` | — | T1 | — |
| `scripts/task.js` | T9 | T1 | — |
| `scripts/version.js` | — | T15 | — |
| `skills/fankeel-audit/rationale.md` | — | T15 | — |
| `skills/fankeel-build/SKILL.md` | T6 | — | — |
| `skills/fankeel/SKILL.md` | T8, T9 | T11, T16 | — |
| `skills/registry.json` | — | T16 | — |
| `tests/context.test.js` | — | — | T8 |
| `tests/contract.test.js` | — | T15 | — |
| `tests/detail-cache.test.js` | T13 | — | — |
| `tests/detail.test.js` | — | — | T13 |
| `tests/docs-check.test.js` | T14 | — | T14 |
| `tests/guard.test.js` | — | — | T5 |
| `tests/leave.test.js` | — | — | T10 |
| `tests/ledger.test.js` | — | — | T6 |
| `tests/orient.test.js` | T3 | — | — |
| `tests/pipeline-doc.test.js` | T3 | — | — |
| `tests/render.test.js` | — | — | T11 |
| `tests/resume.test.js` | T7 | — | T8 |
| `tests/size.test.js` | T7 | — | — |
| `tests/skills.test.js` | — | — | T1 |
| `tests/sources-doc.test.js` | T17 | — | T17 |
| `tests/station-cli.test.js` | — | — | T2 |
| `tests/station-view.test.js` | — | — | T12, T13 |
| `tests/station.test.js` | — | — | T12 |
| `tests/task.test.js` | — | — | T9 |
| `TODO.md` | T3, T7, T19 | — | — |

# Plan part A — Tasks 1-6

Spec: [docs/plans/2026-09-18-todo-nineteen-design.md](../../../docs/plans/2026-09-18-todo-nineteen-design.md)

## Global Constraints

- `package.json` has no `dependencies` and no `devDependencies`; `test` is
  `node --test`. No dependency may be added. Node built-ins only.
- Modules are CommonJS with `'use strict';`. Match each file's own indentation
  (lib and scripts use 4 spaces; tests use 2).
- `tests/source.test.js:92` — every exported name must be imported by something.
  It reads `git ls-files`, so a new file is only checked once it is added.
- `tests/contract.test.js:262` — every file that carries the version carries the
  same one.
- `tests/render.test.js:548` and `:559` — the `init` block, with and without the
  station line, stays under 1400 characters at the reference root; `:559` asserts
  the station line with a regex ending in `$`. A rule is gained by displacing one
  (move a rationale sentence into a skill), never by raising the cap.
- Stage rule blocks carry a byte budget in `lib/stages.js` (`budget: 2400` /
  `2500`); `skills/registry.json` is generated by `scripts/stage-registry.js` and
  must be regenerated if stage text changes.
- `node scripts/docs-check.js` must exit 0. Docs cite code as `path:line`,
  often with a quote; code moved by a task shifts those citations, and
  docs-check prints each one that moved — fix them in the same task.
- `node scripts/todo-check.js` must exit 0.
- `CONTRIBUTING.md:21` — never hand-edit a file `station.js serve` writes.
- `docs/improvement-brief.md` is `status: design-intent`; `docs/archive/` is retired.
- Windows: file content containing backslashes goes through the Write/Edit tools,
  never a shell heredoc. Never run `find /`.

---

## Task 1: judge.js 的旗標改成 acceptedFlags 認得的形狀

**Files:**
- Modify: `scripts/judge.js` — flag table rewritten from a `FLAGS` name-array
  plus a runtime loop into a literal `OPTIONS` object, the parseArgs-options-
  table shape `lib/skills.js`'s `acceptedFlags()` reads.
- Read: `lib/skills.js` — `acceptedFlags(source)`, and the three source shapes
  it recognises (`LITERAL`, `OPTION`, `STRING_FLAGS`).
- Read: `scripts/ledger.js` — one of the five CLIs the new test checks; its
  `STRING_FLAGS` table is one of the three shapes `acceptedFlags` reads.
- Read: `scripts/task.js` — one of the five CLIs the new test checks.
- Read: `scripts/station.js` — one of the five CLIs the new test checks. Task 2
  rewrites this file's own flag table separately; this task only reads the
  shape as it stands before that (already non-empty via literal `'--flag'`
  comparisons, so the new test in this task passes for it either way).
- Read: `scripts/survey.js` — one of the five CLIs the new test checks.
- Test: `tests/skills.test.js` — new test asserting `acceptedFlags()` is
  non-empty for all five CLIs.

**Interfaces:**
- Consumes: `acceptedFlags(source)` from `lib/skills.js` — unchanged by this task.
- Produces: none.

**Dispatch:** implementer, sonnet — rewrite one script's flag table into a shape an existing reader already parses.

1. Write the failing test — in `tests/skills.test.js`, right after the
   `acceptedFlags() reads all three parse shapes off their own real source`
   test and before the `// classify() — six tags, four fail:true` comment
   block, add:

File: `tests/skills.test.js`
```js
test('acceptedFlags() is non-empty for every CLI a skill\'s Bash line can name a flag on', () => {
  const { acceptedFlags } = require('../lib/skills.js');
  const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const rel of ['scripts/judge.js', 'scripts/ledger.js', 'scripts/task.js', 'scripts/station.js', 'scripts/survey.js']) {
    assert.ok(acceptedFlags(src(rel)).size > 0, rel + '\'s acceptedFlags() came back empty');
  }
});
```

2. Run it and watch it fail:

    node --test tests/skills.test.js

   Today this prints `ℹ tests 95`, `ℹ pass 94`, `ℹ fail 1`, with:

    ✖ acceptedFlags() is non-empty for every CLI a skill's Bash line can name a flag on
      AssertionError [ERR_ASSERTION]: scripts/judge.js's acceptedFlags() came back empty

   `acceptedFlags()` returns an empty `Set` for `scripts/judge.js` only — its
   `FLAGS` array plus a `for` loop that builds `options` at runtime matches
   none of the three shapes `lib/skills.js` reads off source text. The other
   four already pass (`ledger.js` via `STRING_FLAGS`, `task.js`/`station.js`/
   `survey.js` via literal `'--flag'` comparisons).

3. Write the minimal implementation — in `scripts/judge.js`, replace this:

```js
const FLAGS = ['session', 'brief', 'answer', 'slug', 'model', 'root', 'project'];

function fail(msg) {
    process.stdout.write(msg + '\n');
    process.exit(1);
}

function parse(argv) {
    const options = {};
    for (const f of FLAGS) options[f] = { type: 'string' };
    const { values, positionals } = parseArgv({ args: argv, strict: false, allowPositionals: true, options });
    for (const f of FLAGS) if (values[f] !== undefined && typeof values[f] !== 'string') fail('--' + f + ' needs a value.');
    return { verb: positionals[0], opts: values };
}
```

   In `scripts/judge.js`, replace it with this:

```js
// A literal options table, the same shape `scripts/docs-check.js` already
// writes its own in. `lib/skills.js`'s `acceptedFlags()` reads this shape (and
// two others) straight off the source text, so a flag table built from a name
// array at runtime — the previous shape here — reads as no table at all, and
// every flag on a line naming this script then fails the unknown-flag gate.
const OPTIONS = {
    session: { type: 'string' },
    brief: { type: 'string' },
    answer: { type: 'string' },
    slug: { type: 'string' },
    model: { type: 'string' },
    root: { type: 'string' },
    project: { type: 'string' },
};

function fail(msg) {
    process.stdout.write(msg + '\n');
    process.exit(1);
}

function parse(argv) {
    const { values, positionals } = parseArgv({ args: argv, strict: false, allowPositionals: true, options: OPTIONS });
    for (const f of Object.keys(OPTIONS)) if (values[f] !== undefined && typeof values[f] !== 'string') fail('--' + f + ' needs a value.');
    return { verb: positionals[0], opts: values };
}
```

4. Run it and watch it pass:

    node --test tests/skills.test.js

   Now prints `ℹ tests 95`, `ℹ pass 95`, `ℹ fail 0`.

5. Commit:

    git commit -o scripts/judge.js tests/skills.test.js -m "refactor: judge.js 的旗標表改成 acceptedFlags 認得的形狀" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"

---

## Task 2: station.js 改用 node:util 的 parseArgs

**Files:**
- Modify: `scripts/station.js` — the hand-written `for`/`if`-`else` argv loop
  replaced by `node:util`'s `parseArgs`; `--root` and `--scan` declared
  `multiple: true`; an unrecognised flag still exits 2 with the same
  `station: unknown argument <flag>` message.
- Test: `tests/station-cli.test.js` — new test proving `--root`/`--scan`
  repeat and the unknown-flag exit shape.

**Interfaces:**
- Consumes: `acceptedFlags` from `lib/skills.js` is unchanged by this task,
  but Task 1's new test in `tests/skills.test.js` calls
  `acceptedFlags(source)` on `scripts/station.js`'s own text and asserts the
  `Set` it returns is non-empty. This task's rewrite keeps that true: the
  literal `options: { root: { type: 'string', multiple: true }, ... }` table
  below matches `acceptedFlags`'s `OPTION` shape the same way
  `scripts/docs-check.js`'s own table already does.
- Produces: `parseArgs(argv)` — same exported name and return shape as
  before: `{ verb: string|null, roots: string[], scan: string[], open:
  boolean, port: number, portWasExplicit: boolean, idleMs: number, forget:
  string|null, json: boolean, detach: boolean }`.

**Dispatch:** implementer, sonnet — swap one hand-rolled argv loop for `node:util`'s `parseArgs`, behaviour unchanged.

This is a mechanism swap, not a behaviour change: `--root`/`--scan` already
repeated (the old loop `.push()`ed each occurrence) and an unrecognised flag
already exited 2 naming itself, so there is no failing state to start from.
The design's own proof table lists this task (§15) under "`npm test` 前後都
綠", the same row as Task 3 (§17) and Task 4 (§18) — the test below exists to
pin both properties against a regression, not to turn red first.

1. The check that proves it — in `tests/station-cli.test.js`, right after the
   `--detach is parsed, and portWasExplicit only when --port was given` test,
   add:

```js
test('--root and --scan repeat, and an unknown flag exits 2 with the old message shape', () => {
  const { parseArgs } = require('../scripts/station.js');
  const a = parseArgs(['--root', 'one', '--root', 'two', '--scan', 'x', '--scan', 'y']);
  assert.deepEqual(a.roots, ['one', 'two']);
  assert.deepEqual(a.scan, ['x', 'y']);
  const r = spawnSync(process.execPath, [CLI, '--bogus'], { encoding: 'utf8' });
  assert.equal(r.status, 2, 'an unknown flag exits 2');
  assert.match(r.stderr, /^station: unknown argument --bogus$/m, 'the message names the flag, same shape as before');
});
```

   Run it now, before touching `scripts/station.js`:

    node --test tests/station-cli.test.js

   It passes — `ℹ tests 37`, `ℹ pass 37`, `ℹ fail 0` — against the hand-rolled
   loop already in the file. That is the baseline this task's rewrite must
   not move.

2. Write the minimal implementation — in `scripts/station.js`, replace this:

```js
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const station = require('../lib/station.js');
```

   with this:

File: `scripts/station.js`
```js
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { parseArgs: parseArgv } = require('node:util');
const station = require('../lib/station.js');
```

   In `scripts/station.js`, replace this:

```js
function parseArgs(argv) {
    const out = { verb: null, roots: [], scan: [], open: false, port: 7817, idleMs: 0, forget: null, json: false, detach: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === 'serve' && out.verb === null) out.verb = 'serve';
        else if (a === '--open') out.open = true;
        else if (a === '--root' && argv[i + 1]) out.roots.push(argv[++i]);
        else if (a === '--scan' && argv[i + 1]) out.scan.push(argv[++i]);
        else if (a === '--forget' && argv[i + 1]) out.forget = argv[++i];
        else if (a === '--port' && argv[i + 1]) { out.port = Number(argv[++i]) || 0; out.portWasExplicit = true; }
        else if (a === '--idle' && argv[i + 1]) out.idleMs = (Number(argv[++i]) || 10) * 60e3;
        else if (a === '--detach') out.detach = true;
        else if (a === '--json') out.json = true;
        else {
            process.stderr.write('station: unknown argument ' + a + '\n');
            process.exit(2);
        }
    }
    return out;
}
```

   with this:

File: `scripts/station.js`
```js
// `--root`/`--scan` are `multiple: true`: `values.root`/`values.scan` come
// back as an array of every occurrence, in order, rather than a hand-rolled
// `.push()` per token. `strict: true` is what refuses an unrecognised flag;
// the shapes it throws for — an unknown option, or a declared flag given no
// value — are caught below and turned into the same
// `station: unknown argument <flag>` message and exit code this file has
// always used, so a script piping this CLI's stderr sees no difference.
// `serve` is the one positional this file reads; any other bare word is the
// same unknown-argument refusal.
const OPTIONS = {
    open: { type: 'boolean' },
    root: { type: 'string', multiple: true },
    scan: { type: 'string', multiple: true },
    forget: { type: 'string' },
    port: { type: 'string' },
    idle: { type: 'string' },
    detach: { type: 'boolean' },
    json: { type: 'boolean' },
};

function parseArgs(argv) {
    let values;
    let positionals;
    try {
        ({ values, positionals } = parseArgv({ args: argv, options: OPTIONS, allowPositionals: true, strict: true }));
    } catch (e) {
        const bad = /'(--?[a-zA-Z0-9-]+)/.exec(e.message);
        process.stderr.write('station: unknown argument ' + (bad ? bad[1] : String(e.message)) + '\n');
        process.exit(2);
    }
    const extra = positionals.filter((p) => p !== 'serve');
    if (extra.length) {
        process.stderr.write('station: unknown argument ' + extra[0] + '\n');
        process.exit(2);
    }
    return {
        verb: positionals.includes('serve') ? 'serve' : null,
        roots: values.root || [],
        scan: values.scan || [],
        open: Boolean(values.open),
        port: values.port !== undefined ? (Number(values.port) || 0) : 7817,
        portWasExplicit: values.port !== undefined,
        idleMs: values.idle !== undefined ? (Number(values.idle) || 10) * 60e3 : 0,
        forget: values.forget !== undefined ? values.forget : null,
        json: Boolean(values.json),
        detach: Boolean(values.detach),
    };
}
```

3. Run it and watch it pass — same test file, same command:

    node --test tests/station-cli.test.js

   Still `ℹ tests 37`, `ℹ pass 37`, `ℹ fail 0` — the other 35 tests in this
   file (the default write path, `serve()`, `--json`, `--forget`, the
   first-run scan) are unaffected.

4. Commit:

    git commit -o scripts/station.js tests/station-cli.test.js -m "refactor: station.js 改用 node:util 的 parseArgs，--root/--scan 可重複" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"

---

## Task 3: lib/skill-overlap.js 折進 scripts/orient.js

**Files:**
- Modify: `scripts/orient.js` — gains the `OVERLAPS` table and
  `overlapsIn(configDir)` (moved verbatim from `lib/skill-overlap.js`),
  exports them, and `report()` calls `overlapsIn()` directly instead of
  `skillOverlap.overlapsIn()`.
- Modify: `lib/skill-overlap.js` — deleted; every export it carried now lives
  in `scripts/orient.js`.
- Modify: `tests/orient.test.js` — its `OVERLAPS` import repointed from
  `lib/skill-overlap.js` to `scripts/orient.js`.
- Modify: `tests/pipeline-doc.test.js` — same repoint, plus one comment line
  that names the old path.
- Modify: `docs/pipeline.md` — `source_of_truth` line and one prose sentence
  repointed from `lib/skill-overlap.js` to `scripts/orient.js`.
- Modify: `TODO.md` — remove the `〔lib〕` bullet about `lib/skill-overlap.js`: its link dies with the file, and `todo-check` fails on a dead link
  (its `source_of_truth` line and one prose sentence).

**Interfaces:**
- Consumes: none.
- Produces: `OVERLAPS: Array<{ plugin: string, skill: string, stage: string
  }>` and `overlapsIn(configDir: string) => Array<{ plugin: string, skill:
  string, stage: string }>`, now exported from `scripts/orient.js` instead
  of `lib/skill-overlap.js`.

**Dispatch:** implementer, sonnet — move one module's contents into its one caller and repoint four references.

`tests/overlap.test.js` also has "overlap" in its name — it is `lib/overlap.js`'s
own suite (file-path overlap for the ledger's `conflict()` check), an unrelated
module, and needs no change. Do not edit it.

1. The check that proves it — before any edit, run:

    git grep -n "skill-overlap" -- '*.js' '*.md' ':(exclude)docs/archive/**' ':(exclude)docs/decisions/**' ':(exclude)docs/plans/**'

   It prints seven lines: `scripts/orient.js:32`, `tests/orient.test.js:13`,
   `tests/pipeline-doc.test.js:15`, `tests/pipeline-doc.test.js:64`,
   `docs/pipeline.md:4`, `docs/pipeline.md:301`, and the `TODO.md` bullet.
   (`docs/archive/`, `docs/decisions/` and `docs/plans/` are excluded on
   purpose: a decision record is written once and may name code that has since
   gone — `docs/decisions/2026-09-18-needs-decision-all.md` keeps saying
   `lib/skill-overlap.js` because that was true the day it was written, and
   `docs-check` does not check paths in the decision role. Do not edit it.)

2. Write the minimal implementation.

   In `scripts/orient.js`, replace this:

```js
const { firstTable } = require('../lib/map.js');
const { orderByEdit } = require('../lib/blame.js');
const { human } = require('../lib/report.js');
const skillOverlap = require('../lib/skill-overlap.js');
// `require.main === module` guards its CLI body, so requiring it here does not
// run `todo-check`'s own report — only `entries` gets used.
const todoCheck = require('./todo-check.js');
```

   with this:

File: `scripts/orient.js`
```js
const { firstTable } = require('../lib/map.js');
const { orderByEdit } = require('../lib/blame.js');
const { human } = require('../lib/report.js');
// `require.main === module` guards its CLI body, so requiring it here does not
// run `todo-check`'s own report — only `entries` gets used.
const todoCheck = require('./todo-check.js');
```

   In `scripts/orient.js`, replace this:

```js
// A workspace with more children than this is not being read row by row, and a
// listing nobody finishes is a listing nobody acts on. The count of what was
// dropped still gets said — a silent cap reads as "that is all there is".
const MAX_ROWS = 40;
```

   with this:

File: `scripts/orient.js`
```js
// Which of this session's stages already have a competing "how to do this
// step" skill installed from another plugin, so this can name the collision
// once instead of every run finding out the hard way. Moved in from
// `lib/skill-overlap.js`, which had exactly one production caller — this file.
//
// `OVERLAPS` is the table N27 asks for: known collisions between a
// superpowers skill and a fankeel stage, kept here rather than duplicated in
// `docs/pipeline.md`, which points at this module as the one to trust.
const OVERLAPS = [
    { plugin: 'superpowers', skill: 'brainstorming', stage: 'design' },
    { plugin: 'superpowers', skill: 'writing-plans', stage: 'plan' },
    { plugin: 'superpowers', skill: 'executing-plans', stage: 'build' },
    { plugin: 'superpowers', skill: 'subagent-driven-development', stage: 'build' },
    { plugin: 'superpowers', skill: 'verification-before-completion', stage: 'verify' },
    { plugin: 'superpowers', skill: 'finishing-a-development-branch', stage: 'land' },
];

// The rows whose plugin is actually installed under `configDir` and whose
// skill file is really there — not every row the table lists. A plugin's
// installs are keyed `<name>@<marketplace>`, so the name is read off the
// part before the `@` rather than matched against the whole key, and every
// scope (user, project, ...) that name is installed under is checked in
// turn: the first one whose `installPath` holds the skill file is enough
// to report the row.
//
// A missing or unparsable `installed_plugins.json` is not an error — most
// machines running this plugin have never heard of the other one — so it
// answers `[]` the same way `docs.read()` answers an empty tree for a
// repository with no `docs.json`.
function overlapsIn(configDir) {
    const file = path.join(String(configDir == null ? '' : configDir), 'plugins', 'installed_plugins.json');
    let data;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return [];
    }
    const plugins = data && typeof data === 'object' ? data.plugins : null;
    if (!plugins || typeof plugins !== 'object') return [];

    const installsByName = new Map();
    for (const key of Object.keys(plugins)) {
        const name = String(key).split('@')[0];
        const list = Array.isArray(plugins[key]) ? plugins[key] : [];
        if (!installsByName.has(name)) installsByName.set(name, []);
        installsByName.get(name).push(...list);
    }

    return OVERLAPS.filter((row) => {
        const installs = installsByName.get(row.plugin) || [];
        return installs.some((inst) => {
            const installPath = inst && typeof inst.installPath === 'string' ? inst.installPath : '';
            if (!installPath) return false;
            try {
                return fs.statSync(path.join(installPath, 'skills', row.skill, 'SKILL.md')).isFile();
            } catch (e) {
                return false;
            }
        });
    });
}

// A workspace with more children than this is not being read row by row, and a
// listing nobody finishes is a listing nobody acts on. The count of what was
// dropped still gets said — a silent cap reads as "that is all there is".
const MAX_ROWS = 40;
```

   In `scripts/orient.js`, replace this:

```js
    const overlaps = skillOverlap.overlapsIn(result.configDir);
```

   with this:

File: `scripts/orient.js`
```js
    const overlaps = overlapsIn(result.configDir);
```

   In `scripts/orient.js`, replace this:

```js
module.exports = { scan, report, main, parseArgs, stateText, topLevel, recent, signposts, ageText };
```

   with this:

File: `scripts/orient.js`
```js
module.exports = { scan, report, main, parseArgs, stateText, topLevel, recent, signposts, ageText, OVERLAPS, overlapsIn };
```

   Delete `lib/skill-overlap.js`:

```sh
rm lib/skill-overlap.js
```

   In `tests/orient.test.js`, replace this:

```js
const { OVERLAPS } = require('../lib/skill-overlap.js');
```

   with this:

File: `tests/orient.test.js`
```js
const { OVERLAPS } = require('../scripts/orient.js');
```

   In `tests/pipeline-doc.test.js`, replace this:

```js
const { byName } = require('../lib/stages.js');
const { OVERLAPS } = require('../lib/skill-overlap.js');
```

   with this:

File: `tests/pipeline-doc.test.js`
```js
const { byName } = require('../lib/stages.js');
const { OVERLAPS } = require('../scripts/orient.js');
```

   In `tests/pipeline-doc.test.js`, replace this:

```js
// docs/pipeline.md's overlap table defers to lib/skill-overlap.js rather than
// carrying its own copy of the collisions — this is what keeps the two from
// drifting apart the way the stage diagrams above did.
```

   with this:

File: `tests/pipeline-doc.test.js`
```js
// docs/pipeline.md's overlap table defers to scripts/orient.js rather than
// carrying its own copy of the collisions — this is what keeps the two from
// drifting apart the way the stage diagrams above did.
```

   In `docs/pipeline.md`, replace this:

```md
source_of_truth: lib/stages.js, lib/render.js, lib/profile.js, skills/fankeel-survey/SKILL.md, skills/fankeel-design/SKILL.md, skills/fankeel-plan/SKILL.md, skills/fankeel-build/SKILL.md, skills/fankeel-verify/SKILL.md, skills/fankeel-audit/SKILL.md, skills/fankeel-land/SKILL.md, scripts/residue.js, hooks/carry.js, lib/skill-overlap.js
```

   with this:

File: `docs/pipeline.md`
```md
source_of_truth: lib/stages.js, lib/render.js, lib/profile.js, skills/fankeel-survey/SKILL.md, skills/fankeel-design/SKILL.md, skills/fankeel-plan/SKILL.md, skills/fankeel-build/SKILL.md, skills/fankeel-verify/SKILL.md, skills/fankeel-audit/SKILL.md, skills/fankeel-land/SKILL.md, scripts/residue.js, hooks/carry.js, scripts/orient.js
```

   In `docs/pipeline.md`, replace this:

```md
`lib/skill-overlap.js`'s `OVERLAPS` is the source of truth for which skills
these are; `scripts/orient.js` prints an `overlap:` line naming whichever of
them the config directory's own `plugins/installed_plugins.json` actually
has installed.
```

   with this:

File: `docs/pipeline.md`
```md
`scripts/orient.js`'s `OVERLAPS` is the source of truth for which skills
these are; it also prints an `overlap:` line naming whichever of them the
config directory's own `plugins/installed_plugins.json` actually has
installed.
```

   In `TODO.md`, under `## Needs a decision`, delete this bullet and the blank
   line after it (this task delivers it; `todo-check` would otherwise fail on
   its dead link):

```md
- 〔lib〕`lib/skill-overlap.js` 只有一個 production caller，折進 `scripts/orient.js` 既不多帶依賴也不會把測試推到 spawn 後面 — [lib/skill-overlap.js](lib/skill-overlap.js). 待決：折進去、還是留著。（audit 2026-09-18，8 行）
```

3. Run it and watch it pass:

    node --test tests/orient.test.js tests/pipeline-doc.test.js
    node scripts/docs-check.js
    node scripts/todo-check.js
    git grep -n "skill-overlap" -- '*.js' '*.md' ':(exclude)docs/archive/**' ':(exclude)docs/decisions/**' ':(exclude)docs/plans/**'

   The two test files stay green; `docs-check` and `todo-check` exit 0; the
   `git grep` prints nothing (exits 1 with no output — grep's own "no match"
   shape).

4. Commit:

    git commit -o scripts/orient.js lib/skill-overlap.js tests/orient.test.js tests/pipeline-doc.test.js docs/pipeline.md TODO.md -m "refactor: lib/skill-overlap.js 折進 scripts/orient.js" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"

---

## Task 4: 三處重複都收 — lib/usage.js、lib/registry.js、lib/live.js

**Files:**
- Modify: `lib/usage.js` — `summarise()` and `spanOf()` call `entriesOf()`
  instead of each re-implementing its own read-split-parse loop.
- Modify: `lib/registry.js` — two predicates, `isRecord` and `isPair`,
  replace five repeated three-line `? … : …` expressions across `touch()`
  (`clock`, `clock`'s first sighting, `burn`, `burn`'s first sighting) and
  `gateClose()` (`waited`).
- Modify: `lib/live.js` — `runningIds()`'s hand-built `Set` loop becomes
  `new Set(rows.map(...))`.

**Interfaces:**
- Consumes: none.
- Produces: none — every name these three modules already export keeps its
  signature; this changes only what runs inside them.

**Dispatch:** implementer, sonnet — collapse three confirmed, mechanical, behaviour-preserving duplications; the proof is the existing suites staying green.

`lib/registry.js` note: the design's own count is four ("四個三行三元式"),
citing lines 445, 449, 475 and 609. Reading `touch()` finds a fifth,
identical-shape ternary at what is currently lines 471-473 — `burn`'s own
object-check, the same pattern as `clock`'s at 445 and `waited`'s at 609 —
that citation skipped. Since the fix is naming the shared check once, leaving
that one instance in its old three-line form beside two others that changed
would be inconsistent, so this task collapses all five. Behaviour is
unchanged either way.

1. The check that proves it — run the suites these three files already have,
   before any edit:

    node --test tests/usage.test.js tests/usage-series.test.js tests/registry.test.js tests/live.test.js

   Prints `ℹ tests 126`, `ℹ pass 126`, `ℹ fail 0` (15 + 5 + 88 + 18). This is
   the baseline the edits below must not move.

2. Write the minimal implementation.

   In `lib/usage.js`, replace this:

```js
function summarise(transcriptPath, opts) {
    const sidechain = Boolean(opts && opts.sidechain);
    let text;
    try {
        text = fs.readFileSync(transcriptPath, 'utf8');
    } catch (e) {
        return null;
    }
    const byRequest = new Map();
    let anonymous = 0;
    let wakes = 0;
    for (const raw of text.split('\n')) {
        if (!raw) continue;
        let entry;
        try {
            entry = JSON.parse(raw);
        } catch (e) {
            continue;
        }
        if (!entry) continue;
```

   with this:

File: `lib/usage.js`
```js
function summarise(transcriptPath, opts) {
    const sidechain = Boolean(opts && opts.sidechain);
    const entries = entriesOf(transcriptPath);
    if (!entries) return null;
    const byRequest = new Map();
    let anonymous = 0;
    let wakes = 0;
    for (const entry of entries) {
        if (!entry) continue;
```

   In `lib/usage.js`, replace this:

```js
function spanOf(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
    let first = null;
    let last = null;
    for (const raw of text.split('\n')) {
        if (!raw) continue;
        let entry;
        try {
            entry = JSON.parse(raw);
        } catch (e) {
            continue;
        }
        const t = entry && typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN;
```

   with this:

File: `lib/usage.js`
```js
function spanOf(file) {
    const entries = entriesOf(file);
    if (!entries) return null;
    let first = null;
    let last = null;
    for (const entry of entries) {
        const t = entry && typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN;
```

   `entriesOf` is declared later in the same file (function declarations are
   hoisted), so both call sites above see it fine.

   In `lib/registry.js`, replace this:

```js
function touch(projectRoot, sessionId, used) {
```

   with this:

File: `lib/registry.js`
```js
// The two checks below are what made every one of `clock`, `burn` and
// `waited` a three-line `? … : …` at its own call site — five of them
// before this. Named once, each collapses to one line, and the check
// cannot drift between one call and the next the way five hand-copies could.
const isRecord = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const isPair = (v) => Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]);

function touch(projectRoot, sessionId, used) {
```

   In `lib/registry.js`, replace this:

```js
        if (data.stage) {
            const at = Date.parse(data.updated);
            const clock = (data.clock && typeof data.clock === 'object' && !Array.isArray(data.clock))
                ? data.clock
                : {};
            const seen = clock[data.stage];
            const first = (Array.isArray(seen) && seen.length === 2 && Number.isFinite(seen[0]))
                ? seen[0]
                : at;
            clock[data.stage] = [first, at];
```

   with this:

File: `lib/registry.js`
```js
        if (data.stage) {
            const at = Date.parse(data.updated);
            const clock = isRecord(data.clock) ? data.clock : {};
            const seen = clock[data.stage];
            const first = isPair(seen) ? seen[0] : at;
            clock[data.stage] = [first, at];
```

   In `lib/registry.js`, replace this:

```js
        if (Number.isFinite(used) && used > 0 && data.stage) {
            const burn = (data.burn && typeof data.burn === 'object' && !Array.isArray(data.burn))
                ? data.burn
                : {};
            const seen = burn[data.stage];
            const first = (Array.isArray(seen) && seen.length === 2 && Number.isFinite(seen[0]))
                ? seen[0]
                : used;
            burn[data.stage] = [first, used];
            data.burn = burn;
        }
```

   with this:

File: `lib/registry.js`
```js
        if (Number.isFinite(used) && used > 0 && data.stage) {
            const burn = isRecord(data.burn) ? data.burn : {};
            const seen = burn[data.stage];
            const first = isPair(seen) ? seen[0] : used;
            burn[data.stage] = [first, used];
            data.burn = burn;
        }
```

   In `lib/registry.js`, replace this:

```js
        const held = Date.now() - opened;
        if (held < 0) return true;
        const waited = (data.waited && typeof data.waited === 'object' && !Array.isArray(data.waited))
            ? data.waited
            : {};
        const had = Number.isFinite(waited[data.stage]) ? waited[data.stage] : 0;
```

   with this:

File: `lib/registry.js`
```js
        const held = Date.now() - opened;
        if (held < 0) return true;
        const waited = isRecord(data.waited) ? data.waited : {};
        const had = Number.isFinite(waited[data.stage]) ? waited[data.stage] : 0;
```

   In `lib/live.js`, replace this:

```js
function runningIds(configDir) {
    const rows = runningSessions(configDir);
    if (!rows) return null;
    const ids = new Set();
    for (const row of rows) ids.add(row.sessionId);
    return ids;
}
```

   with this:

File: `lib/live.js`
```js
function runningIds(configDir) {
    const rows = runningSessions(configDir);
    if (!rows) return null;
    return new Set(rows.map((row) => row.sessionId));
}
```

3. Run it and watch it pass — same command:

    node --test tests/usage.test.js tests/usage-series.test.js tests/registry.test.js tests/live.test.js

   Still `ℹ tests 126`, `ℹ pass 126`, `ℹ fail 0` — same total, same pass count.

4. Commit:

    git commit -o lib/usage.js lib/registry.js lib/live.js -m "refactor: 收斂三處重複 — entriesOf、registry.js 的三行三元式、live.js 的 hand-built Set" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"

---

## Task 5: guard.js 補上 node -e／python -c 的 fs 寫入 pattern

**Files:**
- Modify: `lib/guard.js` — `WRITE_PATTERNS` gains two entries:
  `NODE_EVAL_WRITE` (a `node -e`/`--eval` script calling an fs write
  function) and `PYTHON_WRITE` (a `python -c` script calling `open(...)` in
  a write mode, `write_text`, `os.remove`, or naming `shutil`).
- Test: `tests/guard.test.js` — two new red-first test cases.

**Interfaces:**
- Consumes: none.
- Produces: none — `writesFiles(command)`'s signature and return type are
  unchanged; only what it recognises as a write grows.

**Dispatch:** implementer, sonnet — extend one regex-driven write-pattern list with two new entries.

1. Write the failing tests — in `tests/guard.test.js`, right after the
   `writesFiles does not mistake =>, ->, >&, a quoted > or >> /dev/null for a
   redirect` test, add:

```js
// §12: a `node -e`/`--eval` script's own fs writes were invisible to every
// pattern above — this closes it — and a read-only `node -e` (`readFileSync`,
// `require`) still passes, same as before.
test('writesFiles catches a node -e/--eval script that writes a file, and still allows a read-only one', () => {
  for (const cmd of [
    "node -e \"require('fs').writeFileSync('x', 'y')\"",
    "node --eval \"require('fs').appendFileSync('x', 'y')\"",
    "node -e \"fs.createWriteStream('x')\"",
    "node -e \"require('fs').renameSync('a', 'b')\"",
    "node -e \"require('fs').unlinkSync('x')\"",
    "node -e \"require('fs').rmSync('x')\"",
    "node -e \"require('fs').mkdirSync('x')\"",
    "node -e \"require('fs').copyFileSync('a', 'b')\"",
  ]) {
    assert.equal(guard.writesFiles(cmd), true, cmd);
  }
  for (const cmd of [
    "node -e \"console.log(require('fs').readFileSync('x', 'utf8'))\"",
    "node -e \"console.log(require('./x.js'))\"",
  ]) {
    assert.equal(guard.writesFiles(cmd), false, cmd);
  }
});

// §12: same shape for `python -c` — `open(..., 'w'|'a'|'x')`, `write_text`,
// `os.remove`, and any use of `shutil` all count as a write.
test('writesFiles catches a python -c script that writes a file', () => {
  for (const cmd of [
    "python -c \"open('f.txt', 'w').write('y')\"",
    "python3 -c \"open('f.txt', 'a').write('y')\"",
    "python -c \"open('f.txt', 'x').write('y')\"",
    "python -c \"import pathlib; pathlib.Path('f.txt').write_text('y')\"",
    "python -c \"import os; os.remove('f.txt')\"",
    "python -c \"import shutil; shutil.rmtree('f')\"",
  ]) {
    assert.equal(guard.writesFiles(cmd), true, cmd);
  }
  assert.equal(guard.writesFiles("python -c \"print(open('f.txt').read())\""), false);
});
```

2. Run it and watch it fail:

    node --test tests/guard.test.js

   Prints `ℹ tests 39`, `ℹ pass 37`, `ℹ fail 2`, with:

    ✖ writesFiles catches a node -e/--eval script that writes a file, and still allows a read-only one
      AssertionError [ERR_ASSERTION]: node -e "require('fs').writeFileSync('x', 'y')"
      false !== true
    ✖ writesFiles catches a python -c script that writes a file
      AssertionError [ERR_ASSERTION]: python -c "open('f.txt', 'w').write('y')"
      false !== true

3. Write the minimal implementation — in `lib/guard.js`, replace this:

```js
const WRITE_PATTERNS = [
    /\btee\b/,
    /\b(?:rm|mv|cp)\b/,
    /\bsed\b[^\n]*(?:-i\b|--in-place\b)/,
    /\bgit\s+(?:add|commit|checkout|switch|restore|reset|stash|clean|apply|am|merge|rebase|cherry-pick|revert|pull)\b/,
    /\b(?:Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Copy-Item|Move-Item|Rename-Item)\b/i,
];
```

   with this:

File: `lib/guard.js`
```js
// A `node -e`/`--eval` script is a shell command like any other, so its own fs
// writes are invisible to every pattern above — none of them look inside a
// quoted argument for a call rather than a command name. Scoped to the shape
// a real invocation takes: `node`, then `-e` or `--eval` somewhere before the
// write call. A read-only `node -e` — `readFileSync`, `require` — matches
// none of these and stays allowed, same as before.
const NODE_EVAL_WRITE = /\bnode\b[^\n]*(?:-e\b|--eval\b)[^\n]*\b(?:fs\.)?(?:writeFile|appendFile|createWriteStream|rename|unlink|rm|mkdir|copyFile)(?:Sync)?\s*\(/;

// Same reasoning, for `python -c`: `open(...)` given a write mode, `write_text`
// (pathlib's), `os.remove`, or any use of `shutil` at all — that module has no
// read-only entry point worth telling apart from the rest of it. The mode
// quote must follow a comma, so a bare `open('x')` read is never mistaken for
// a write because its filename happens to spell one of the mode letters.
const PYTHON_WRITE = /\bpython3?\b[^\n]*-c\b[^\n]*(?:\bopen\s*\([^)]*,\s*['"][wax]['"]|\.write_text\s*\(|\bos\.remove\b|\bshutil\b)/;

const WRITE_PATTERNS = [
    /\btee\b/,
    /\b(?:rm|mv|cp)\b/,
    /\bsed\b[^\n]*(?:-i\b|--in-place\b)/,
    /\bgit\s+(?:add|commit|checkout|switch|restore|reset|stash|clean|apply|am|merge|rebase|cherry-pick|revert|pull)\b/,
    /\b(?:Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Copy-Item|Move-Item|Rename-Item)\b/i,
    NODE_EVAL_WRITE,
    PYTHON_WRITE,
];
```

4. Run it and watch it pass:

    node --test tests/guard.test.js

   Now `ℹ tests 39`, `ℹ pass 39`, `ℹ fail 0`.

5. Commit:

    git commit -o lib/guard.js tests/guard.test.js -m "fix: guard.js 補上 node -e／python -c 的 fs 寫入 pattern" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"

---

## Task 6: ledger.js init 記下 plan 階段的範圍

**Files:**
- Modify: `lib/ledger.js` — a new line shape, `Plan: [<range>]`, beside
  `Fix:`'s: `planLine(range)` writes it, `planRange(text)` reads the first
  one back, or `null`.
- Modify: `scripts/ledger.js` — `init` takes an optional `--range <a>..<b>`,
  refused the same way `complete`/`fix` refuse an unreadable one, and
  appends one `Plan:` line the first time it is given (a second `init
  --range` on an already-recorded ledger leaves the first one); `LEDGER_LINE`
  gains `Plan: ` so `scan`'s block-boundary search still recognises it as an
  ordinary ledger line; `ranges` lists the plan row first, ahead of the
  tasks and fixes, and folds it into the same overlap check.
- Modify: `skills/fankeel-build/SKILL.md` — the "2. Open the ledger" step's
  `init` example carries `--range`, with a short paragraph saying why.
- Test: `tests/ledger.test.js` — the round-trip (`planLine`/`planRange`) and
  `ranges` cases.

**Interfaces:**
- Consumes: none.
- Produces: `lib/ledger.js` exports `planLine(range: string) => string` and
  `planRange(text: string) => string|null`.

**Dispatch:** implementer, sonnet — one new ledger line shape, wired through `init` and `ranges`.

Leave the separate Waiting entry about `--range x ranges` exiting 0 alone:
the `ranges` verb never reads `opts.range` today, and this task does not
change that — only `init`'s own handling of `--range` is touched.

1. Write the failing tests — in `tests/ledger.test.js`, right after the
   `the short shas the build loop records are accepted` test (and before the
   `function git(dir, args) {` helper that follows it), add:

```js
test('a plan line carries its range and parses back', () => {
  const line = ledger.planLine('a1b2c3d..e4f5a6b');
  assert.equal(line, 'Plan: [a1b2c3d..e4f5a6b]');
  assert.equal(ledger.planRange(line), 'a1b2c3d..e4f5a6b');
  assert.equal(ledger.planRange('no plan line here'), null);
});

test('init --range records the plan stage\'s own range, and ranges lists it before any task completes', () => {
  const dir = root();
  execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', '--range', 'aaaaaaa..bbbbbbb', 'init'], { cwd: dir, encoding: 'utf8' });
  const contents = fs.readFileSync(ledger.ledgerPath(dir, 'p.md'), 'utf8');
  assert.equal(ledger.planRange(contents), 'aaaaaaa..bbbbbbb');
  const out = execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', 'ranges'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /plan aaaaaaa\.\.bbbbbbb/);
  assert.equal(/nothing complete yet/.test(out), false);
});

test('a second init --range does not duplicate the plan row', () => {
  const dir = root();
  execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', '--range', 'aaaaaaa..bbbbbbb', 'init'], { cwd: dir, encoding: 'utf8' });
  execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', '--range', 'ccccccc..ddddddd', 'init'], { cwd: dir, encoding: 'utf8' });
  const contents = fs.readFileSync(ledger.ledgerPath(dir, 'p.md'), 'utf8');
  assert.equal((contents.match(/^Plan: /gm) || []).length, 1);
  assert.equal(ledger.planRange(contents), 'aaaaaaa..bbbbbbb');
});

test('init --range is refused the same way complete and fix refuse an unreadable range', () => {
  const dir = root();
  let out = '';
  let code = 0;
  try {
    execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', '--range', 'HEAD~1..HEAD', 'init'], { cwd: dir, encoding: 'utf8' });
  } catch (e) {
    out = String(e.stdout || '');
    code = e.status;
  }
  assert.equal(code, 1);
  assert.match(out, /--range wants two commit shas/);
});
```

2. Run it and watch it fail:

    node --test tests/ledger.test.js

   Prints `ℹ tests 60`, `ℹ pass 56`, `ℹ fail 4`, with:

    ✖ a plan line carries its range and parses back
      TypeError: ledger.planLine is not a function
    ✖ init --range records the plan stage's own range, and ranges lists it before any task completes
      TypeError: ledger.planRange is not a function
    ✖ a second init --range does not duplicate the plan row
      AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 0 !== 1
    ✖ init --range is refused the same way complete and fix refuse an unreadable range
      AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 0 !== 1

   (The last two fail on an assertion rather than a `TypeError`: `--range` on
   `init` is silently ignored by the CLI today, so no `Plan:` line is ever
   written and the refusal never fires.)

3. Write the minimal implementation.

   In `lib/ledger.js`, replace this:

```js
const fixLine = (what, range) => 'Fix:'
    + (range ? ' [' + range + ']' : '')
    + ' — ' + String(what || '').trim();
```

   with this:

File: `lib/ledger.js`
```js
const fixLine = (what, range) => 'Fix:'
    + (range ? ' [' + range + ']' : '')
    + ' — ' + String(what || '').trim();

// The plan stage's own commit range, recorded once by `init --range` before
// any task runs. It has no task number and no note — `Fix:`'s shape without
// the `— what` half, because there is nothing a range this early could be
// reporting other than "this range is the plan." `ranges` lists it beside
// the tasks and fixes so verify never reads the plan stage's own commits as
// a range nobody claimed.
const PLAN_RANGE = new RegExp('^Plan: \\[(' + RANGE + ')\\]$');

const planLine = (range) => 'Plan: [' + range + ']';

// The recorded range, or null when `init` was never given one — the same
// "real answer, not a failure" reading `completions()` gives a task with no
// range. At most one is ever written; the first is the one `init` wrote.
function planRange(text) {
    for (const line of String(text || '').split(/\r?\n/)) {
        const m = PLAN_RANGE.exec(line.trim());
        if (m) return m[1];
    }
    return null;
}
```

   In `lib/ledger.js`, replace this:

```js
module.exports = { ledgerPath, header, owns, completed, completions, completionLine, isRange, rulingLine, fixLine, fixes, init, append };
```

   with this:

File: `lib/ledger.js`
```js
module.exports = { ledgerPath, header, owns, completed, completions, completionLine, isRange, rulingLine, fixLine, fixes, planLine, planRange, init, append };
```

   In `scripts/ledger.js`, replace this:

```js
const LEDGER_LINE = /^(Task \d+: complete\b|Ruling: |Fix: |## )/;
```

   with this:

File: `scripts/ledger.js`
```js
const LEDGER_LINE = /^(Task \d+: complete\b|Ruling: |Fix: |Plan: |## )/;
```

   In `scripts/ledger.js`, replace this:

```js
        const ledgerFile = ledger.init(root, opts.plan);
        const planFile = path.resolve(root, opts.plan);
        let planText = null;
        try {
            planText = fs.readFileSync(planFile, 'utf8');
        } catch (e) {
            // Not a refusal: a `bounded` or `spike` route reaches the build
            // stage with no plan file at all, and opening a ledger anyway is
            // this verb's whole job for that route. Refusing here would break
            // the one route that legitimately has nothing to be wrong about.
        }
        if (planText === null) {
            return 'fankeel ledger — ' + ledgerFile
                + '\n\nNo file at ' + planFile + '. The ledger is open regardless.';
        }
        const tasks = plantasks.parseTasks(planText);
        if (!tasks.length) {
            return 'fankeel ledger — ' + ledgerFile
                + '\n\nNo task headings found in ' + planFile + '. ' + CONFORMING_HEADING;
        }
        return 'fankeel ledger — ' + ledgerFile
            + '\n\n' + tasks.length + ' tasks in ' + planFile;
    }
```

   with this:

File: `scripts/ledger.js`
```js
        const ledgerFile = ledger.init(root, opts.plan);
        // `--range` is optional and, when given, is the plan stage's own
        // commit range — refused on the way in, the same as `complete` and
        // `fix` refuse one, so a typo never reaches the file and reads back
        // as no range at all. Written once: a ledger that already carries a
        // `Plan:` line keeps it, the same way `ledger.init` itself leaves an
        // existing ledger alone rather than opening a second one.
        let rangeNote = '';
        if (opts.range !== undefined) {
            if (!ledger.isRange(opts.range)) {
                fail('--range wants two commit shas: <base>..<head>, 7 to 40 hex each. '
                    + '"' + opts.range + '" would reach the file and read back as no range at all.');
            }
            const already = ledger.planRange(fs.readFileSync(ledgerFile, 'utf8'));
            if (already === null) {
                ledger.append(root, opts.plan, ledger.planLine(opts.range));
                rangeNote = '\n\nPlan range recorded: ' + opts.range;
            } else {
                rangeNote = '\n\nPlan range already recorded: ' + already;
            }
        }
        const planFile = path.resolve(root, opts.plan);
        let planText = null;
        try {
            planText = fs.readFileSync(planFile, 'utf8');
        } catch (e) {
            // Not a refusal: a `bounded` or `spike` route reaches the build
            // stage with no plan file at all, and opening a ledger anyway is
            // this verb's whole job for that route. Refusing here would break
            // the one route that legitimately has nothing to be wrong about.
        }
        if (planText === null) {
            return 'fankeel ledger — ' + ledgerFile
                + '\n\nNo file at ' + planFile + '. The ledger is open regardless.' + rangeNote;
        }
        const tasks = plantasks.parseTasks(planText);
        if (!tasks.length) {
            return 'fankeel ledger — ' + ledgerFile
                + '\n\nNo task headings found in ' + planFile + '. ' + CONFORMING_HEADING + rangeNote;
        }
        return 'fankeel ledger — ' + ledgerFile
            + '\n\n' + tasks.length + ' tasks in ' + planFile + rangeNote;
    }
```

   In `scripts/ledger.js`, replace this:

```js
        const rows = ledger.completions(contents);
        const fixed = ledger.fixes(contents);
        if (!rows.length && !fixed.length) return 'fankeel ledger — nothing complete yet at ' + file;
        const lines = rows.map((r) => '  ' + r.n + ' ' + (r.range || '(no range recorded)'))
            .concat(fixed.map((r) => '  fix ' + (r.range || '(no range recorded)') + ' — ' + r.what));
```

   with this:

File: `scripts/ledger.js`
```js
        const plan = ledger.planRange(contents);
        const rows = ledger.completions(contents);
        const fixed = ledger.fixes(contents);
        if (!plan && !rows.length && !fixed.length) return 'fankeel ledger — nothing complete yet at ' + file;
        const lines = (plan ? ['  plan ' + plan] : [])
            .concat(rows.map((r) => '  ' + r.n + ' ' + (r.range || '(no range recorded)')))
            .concat(fixed.map((r) => '  fix ' + (r.range || '(no range recorded)') + ' — ' + r.what));
```

   In `scripts/ledger.js`, replace this:

```js
        const entries = rows.filter((r) => r.range).map((r) => ({ label: 'Task ' + r.n + ' (' + r.range + ')', range: r.range }))
            .concat(fixed.filter((r) => r.range).map((r) => ({ label: 'the fix (' + r.range + ')', range: r.range })));
```

   with this:

File: `scripts/ledger.js`
```js
        const entries = (plan ? [{ label: 'the plan (' + plan + ')', range: plan }] : [])
            .concat(rows.filter((r) => r.range).map((r) => ({ label: 'Task ' + r.n + ' (' + r.range + ')', range: r.range })))
            .concat(fixed.filter((r) => r.range).map((r) => ({ label: 'the fix (' + r.range + ')', range: r.range })));
```

   In `skills/fankeel-build/SKILL.md`, replace this:

````md
### 2. Open the ledger

```
node <plugin>/scripts/ledger.js --plan docs/plans/<file>.md show
node <plugin>/scripts/ledger.js --plan docs/plans/<file>.md init
```
````

   with this:

File: `skills/fankeel-build/SKILL.md`
````md
### 2. Open the ledger

```
node <plugin>/scripts/ledger.js --plan docs/plans/<file>.md show
node <plugin>/scripts/ledger.js --plan docs/plans/<file>.md --range <the sha before the plan was written>..<the sha init is run at, before Task 1's BASE> init
```

**Pass the plan stage's own range on `init`.** `--range` is optional and records
the commits that wrote the plan itself — `ranges` then lists that row beside
the tasks, and verify no longer reads the plan's own commit as a change
nobody reviewed. Written once: a second `init --range` on the same ledger
leaves the first recording in place.
````

4. Run it and watch it pass:

    node --test tests/ledger.test.js
    node scripts/docs-check.js

   `ℹ tests 60`, `ℹ pass 60`, `ℹ fail 0`; `docs-check` exits 0 (this SKILL.md
   edit adds prose, not a `path:line` citation, so nothing to check moves).

5. Commit:

    git commit -o lib/ledger.js scripts/ledger.js skills/fankeel-build/SKILL.md tests/ledger.test.js -m "feat: ledger.js init 記下 plan 階段的範圍" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"

## Task 7: 拿掉 `hooks/size.js`

`hooks/size.js` 是 09-11 上線的 PostToolUse 提醒（單次工具輸出超過 20,000 字元就提醒改
用 pipe 或派 reader）。上線時訂下的規則：再量沒降就拿掉。09-18 用
`--since 2026-09-11` 再量，`bigPerSession` 從改前的 0.3846 升到 0.6136——升不是降，照
規則拿掉。

**Files:**
- Modify: `hooks/size.js` — 整個刪除
- Modify: `tests/size.test.js` — 整個刪除
- Modify: `.claude-plugin/plugin.json` — `hooks.PostToolUse` 陣列拿掉沒有 `matcher` 的
  那一筆（跑 `hooks/size.js` 的那筆，目前是第三筆）
- Modify: `tests/resume.test.js` — `'the drift hook runs on writes and on nothing else'`
  裡驗 `hooks/size.js` 的那一段拿掉，`post.length` 的期望值從 3 改成 2
- Modify: `TODO.md` — `## Needs a decision` 底下〔session〕`hooks/size.js` 留不留那一條
  整條拿掉（不拿掉的話，`hooks/size.js` 被刪之後這條的連結變成死連結，
  `scripts/todo-check.js` 會報 `dead link`，違反 `node scripts/todo-check.js` 必須
  exit 0 的全域限制）
- Modify: `scripts/sessions.js` — 三處點名 `hooks/size.js` 的註解（第 6、16、123 行）
  改寫成不再點名一個已經不存在的檔案，行為不變（`BIG = 20000` 這個門檻常數本身不動）

**Interfaces:**
- Consumes: none
- Produces: none —這個 batch 的其他三個 task 不依賴這個 task 的產出。`docs/sources.md`
  的 `Cited by` 欄（另一個 task 管，這裡不碰）要等這個 task 落地才能把 `hooks/size.js`
  的格子清乾淨，但那不在這份 part 裡。

**Dispatch:** implementer, sonnet — 一次刪除加五處文字修改，沒有新行為要測。

這是刪除／文件類 task，沒有新測試要寫；步驟 1-2 換成「先跑一次證明還沒做完，再跑
一次證明做完了」的檢查。

1. 跑這個檢查，看現在的樣子（六個真命中，`hooks/size.js` 帶 `hooks/` 前綴這個更精準
   的樣式才不會誤中 `tests/reference-size.js`、`docs/pipeline.md` 裡點名它的句子這種
   無關的巧合命中——這兩個字串本來就長得像但沒關係）：

```sh
git grep -n "hooks/size\.js" -- . ':!docs/archive' ':!docs/reports' ':!docs/judgements' ':!docs/sources.md' ':!docs/plans'
```

   現在應該印出六行：`.claude-plugin/plugin.json:64`、`TODO.md:83`、
   `scripts/sessions.js:6`、`scripts/sessions.js:16`、`scripts/sessions.js:123`、
   `tests/resume.test.js:229`。（`docs/plans/2026-09-18-todo-nineteen-design.md` 點名
   `hooks/size.js` 的地方本來就排除在外——那是這一整份設計的來源文件，記錄的是「做過
   什麼決定」，不是這個 task 要更新的現況文件，不要動它。）

2. 依序做六處變更：

   a. 刪除 `hooks/size.js`。

   b. 刪除 `tests/size.test.js`。

   c. 在 `.claude-plugin/plugin.json` 裡，把：

```json
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/touch.js\"",
            "timeout": 5,
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

   `.claude-plugin/plugin.json` 換成（拿掉整個沒有 `matcher` 的區塊，`touch.js` 那筆
   的逗號跟著拿掉）：

```json
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/touch.js\"",
            "timeout": 5,
            "statusMessage": "Noting where the work went..."
          }
        ]
      }
    ],
```

   d. 在 `tests/resume.test.js` 裡，把：

```js
test('the drift hook runs on writes and on nothing else', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const post = plugin.hooks.PostToolUse;
  assert.equal(post.length, 3, 'an unreviewed fourth PostToolUse entry has appeared');
  const touch = post.filter((e) => e.hooks.some((h) => /hooks\/touch\.js/.test(h.command)));
  assert.equal(touch.length, 1);
  assert.equal(touch[0].matcher, 'Edit|Write|NotebookEdit');
  assert.equal(touch[0].hooks.length, 1);
  assert.equal(touch[0].hooks[0].timeout, 5);

  // hooks/size.js: reviewed in — no matcher, so it runs on every tool in every
  // session, which is the point (the reminder has to see every tool result to
  // measure it).
  const size = post.filter((e) => e.hooks.some((h) => /hooks\/size\.js/.test(h.command)));
  assert.equal(size.length, 1);
  assert.equal(size[0].matcher, undefined);
  assert.equal(size[0].hooks.length, 1);
  assert.equal(size[0].hooks[0].timeout, 5);
});
```

   `tests/resume.test.js` 換成：

```js
test('the drift hook runs on writes and on nothing else', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const post = plugin.hooks.PostToolUse;
  assert.equal(post.length, 2, 'an unreviewed third PostToolUse entry has appeared');
  const touch = post.filter((e) => e.hooks.some((h) => /hooks\/touch\.js/.test(h.command)));
  assert.equal(touch.length, 1);
  assert.equal(touch[0].matcher, 'Edit|Write|NotebookEdit');
  assert.equal(touch[0].hooks.length, 1);
  assert.equal(touch[0].hooks[0].timeout, 5);
});
```

   e. 在 `TODO.md` 裡，把：

```
- 〔session〕堆疊手段：subagent 佔 token 從 30.7% 升到 53%，但回傳只佔工具輸出 7.6%、叫醒只佔主回合 7% — [docs/improvement-brief.md](docs/improvement-brief.md). 待決：§6.2 四個候選挑哪個。

- 〔session〕`hooks/size.js` 留不留：「十個 session 帶著 hook 跑完」已過（21 個），改前 bigPerSession 0.3846，09-18 用 `--since 2026-09-11` 再量是 0.6136，升不是降 — [hooks/size.js](hooks/size.js). 待決：拿掉、留著，還是換量法。

- 〔station〕profile 卡使用者兩次沒找到：只在 `serve` 模式改得了，靜態頁只給指令而且排在首頁最後 — [docs/station.md](docs/station.md). 待決：移到首頁頂端、`/fankeel` 的 station 行直接給 `serve --open`，還是兩者。
```

   `TODO.md` 換成（整條〔session〕`hooks/size.js` 留不留連同前後各一個空行一起拿掉）：

```
- 〔session〕堆疊手段：subagent 佔 token 從 30.7% 升到 53%，但回傳只佔工具輸出 7.6%、叫醒只佔主回合 7% — [docs/improvement-brief.md](docs/improvement-brief.md). 待決：§6.2 四個候選挑哪個。

- 〔station〕profile 卡使用者兩次沒找到：只在 `serve` 模式改得了，靜態頁只給指令而且排在首頁最後 — [docs/station.md](docs/station.md). 待決：移到首頁頂端、`/fankeel` 的 station 行直接給 `serve --open`，還是兩者。
```

   f. 在 `scripts/sessions.js` 裡，把：

```js
// 升格自 .fankeel/build/ask/measure-sessions.js（09-11 一次性量測腳本）。09-11 的
// 那張表——峰值中位數與 p90、subagent 回傳佔比、倒退次數——現在是這支腳本的輸出，
// 而不是一次跑完就丟的手稿：第 6 節 `hooks/size.js` 要不要留，就是靠這支腳本改
// 前跑一次、改後跑一次比較。
```

   `scripts/sessions.js` 換成：

```js
// 升格自 .fankeel/build/ask/measure-sessions.js（09-11 一次性量測腳本）。09-11 的
// 那張表——峰值中位數與 p90、subagent 回傳佔比、倒退次數——現在是這支腳本的輸出，
// 而不是一次跑完就丟的手稿：09-18 拿掉主 session 大輸出提醒的那個 PostToolUse hook
// 前，就是靠這支腳本改前跑一次、改後跑一次比較，量出 bigPerSession 不降反升。
```

   在 `scripts/sessions.js` 裡，再把：

```js
// hooks/size.js 的 THRESHOLD，同一個數：改前改後量的就是那支 hook 提醒的那一種輸出。
```

   `scripts/sessions.js` 換成：

```js
// 拿掉的那個提醒 hook 用的同一個門檻：改前改後量的就是它曾經提醒的那一種輸出。
```

   在 `scripts/sessions.js` 裡，再把：

```js
            // hooks/size.js 提醒的就是這一種：主 session 自己的一次工具輸出超過 20,000 字元。
```

   `scripts/sessions.js` 換成：

```js
            // 已拿掉的那個提醒 hook 盯的就是這一種：主 session 自己的一次工具輸出超過 20,000 字元。
```

3. 跑一次證明做完了：

```sh
git grep -n "hooks/size\.js" -- . ':!docs/archive' ':!docs/reports' ':!docs/judgements' ':!docs/sources.md' ':!docs/plans'
node --test tests/resume.test.js
node --test tests/sessions.test.js
node scripts/todo-check.js
```

   期望：`git grep` 什麼都不印（exit 1，沒有命中就是這樣）；兩個 `node --test` 全線
   通過；`todo-check` 印出的訊息以 `fankeel todo-check:` 開頭且行程 exit 0。

4. Commit：

```sh
git commit -o hooks/size.js tests/size.test.js .claude-plugin/plugin.json tests/resume.test.js TODO.md scripts/sessions.js -m "chore: 拿掉 hooks/size.js — 09-11 訂的規則再量沒降就拿掉，bigPerSession 0.3846 升到 0.6136" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

## Task 8: 關卡上接手——`context:` 行接到 gate 的第四個選項

候選 2 中選：`lib/context.js` 的 `contextLine` 在 `BUSY`（400000 tokens）以上、或已經
掉過 token 給 compaction 時，除了報數字，還要告訴這個 session：這一站的 gate 該加第
四個選項——接手，設好 `next`、開新終端機、`/fankeel` → Adopt。這行今天只在
`hooks/inject.js` 送出的整塊（`render()`）裡出現；`hooks/resume.js` 送出的短版
（`renderResume()`）沒有，但 gate 本身就是一個 `AskUserQuestion`，回答完全靠自己問題
驅動的 session 反而永遠看不到這行。這個 task 把同一行接到 `renderResume()`，讀法跟
`render()` 一樣：都是從 hook payload 的 `transcript_path` 讀。

**Files:**
- Modify: `lib/context.js` — `contextLine` 裡共用的 `carry` 文字改寫
- Modify: `lib/render.js` — `renderResume({ mine, profile })` 多收一個 `transcript`
  參數，帶出同一行 `context:`
- Modify: `hooks/resume.js` — 呼叫 `renderResume` 時多傳 `transcript: payload.transcript_path`
- Modify: `skills/fankeel/SKILL.md` — `context:` 行那段（「Say it once when the line
  first appears...」開頭那段）與「`AskUserQuestion` caps `options` at four...no stage
  ships one today」那句改寫
- Modify: `docs/registry.md` — 「When compaction has already cost something」的範例區塊逐字引了舊的 `carry` 句，換成新的
- Modify: `docs/improvement-brief.md` — §6.2 候選手段清單後面補一段，記下選了候選 2、
  候選 1 已拿掉（Task 7）、候選 4 已是現行做法、候選 3 不採用
- Test: `tests/context.test.js` — 兩個既有斷言各加一行、新增一個測 `renderResume` 的
  case
- Test: `tests/resume.test.js` — 新增兩個 case，測整條 hook 真的把 `transcript_path`
  接到輸出

**Interfaces:**
- Consumes: `contextLine(info, sessionId)` 與 `inspect(transcriptPath)`（都是
  `lib/context.js` 既有的，簽名不變）；`renderResume({ mine, profile })`
  （`lib/render.js` 既有的，這裡擴充它）
- Produces: `renderResume({ mine, profile, transcript })`——`transcript` 是新的第三個
  欄位，可省略；省略或讀不到內容時，輸出跟這個 task 之前完全一樣。`contextLine` 回的
  字串（不管走哪個分支）現在都以「This stage's gate gets a fourth option, hand off:
  set next, then a new terminal and /fankeel → Adopt.」收尾——任何要逐字引用它的地方
  都要對得上這句。

**Dispatch:** implementer, sonnet — 改一句共用文字、接一條既有管線到第二個 hook，沒有
新演算法。

1. 寫失敗的測試。先在 `tests/context.test.js` 裡，把：

```js
test('the line names what was lost and how to carry the task over', () => {
  const line = ctx.contextLine({ dropped: 326893, used: 287578 });
  assert.match(line, /327k tokens dropped/);
  assert.match(line, /288k in play/);
  assert.match(line, /\/fankeel → Adopt/);
  // Not yet the stronger wording: one compaction is a fact, not an emergency.
  assert.doesNotMatch(line, /Start a fresh session before the next one/);
});
```

   `tests/context.test.js` 換成：

```js
test('the line names what was lost and how to carry the task over', () => {
  const line = ctx.contextLine({ dropped: 326893, used: 287578 });
  assert.match(line, /327k tokens dropped/);
  assert.match(line, /288k in play/);
  assert.match(line, /fourth option, hand off: set next/);
  assert.match(line, /\/fankeel → Adopt/);
  // Not yet the stronger wording: one compaction is a fact, not an emergency.
  assert.doesNotMatch(line, /Start a fresh session before the next one/);
});
```

   在 `tests/context.test.js` 裡，再把：

```js
test('a busy session is warned before it loses anything', () => {
  assert.equal(ctx.contextLine({ dropped: 0, used: 308000 }), null);
  const line = ctx.contextLine({ dropped: 0, used: ctx.BUSY });
  assert.match(line, /400k in play, nothing dropped yet/);
  assert.match(line, /\/fankeel → Adopt/);
});
```

   `tests/context.test.js` 換成：

```js
test('a busy session is warned before it loses anything', () => {
  assert.equal(ctx.contextLine({ dropped: 0, used: 308000 }), null);
  const line = ctx.contextLine({ dropped: 0, used: ctx.BUSY });
  assert.match(line, /400k in play, nothing dropped yet/);
  assert.match(line, /fourth option, hand off: set next/);
  assert.match(line, /\/fankeel → Adopt/);
});
```

   再在 `tests/context.test.js` 裡找到這段（`render()` 那個測試的結尾與下一個測試之間）：

```js
  // No transcript at all is the ordinary case for anything calling render
  // directly, and it must not change what comes out.
  assert.doesNotMatch(render(base), /context:/);
});

// Waiting for the first compaction means the warning always arrives after the
```

   `tests/context.test.js` 換成（中間插入新的一個測試）：

```js
  // No transcript at all is the ordinary case for anything calling render
  // directly, and it must not change what comes out.
  assert.doesNotMatch(render(base), /context:/);
});

// The other half of the same block-carrying question: the post-answer block
// gets the line too now, from the same transcript, threaded through the same
// way render() already was.
test('renderResume carries the line only when there is one', () => {
  const { renderResume } = require('../lib/render.js');
  const mine = { sessionId: 'a', data: { task: 'x', stage: 'build', active: true, updated: new Date().toISOString() } };

  const quiet = renderResume({ mine, transcript: transcript([usage(1000)]) }) || '';
  assert.doesNotMatch(quiet, /context:/);

  const loud = renderResume({ mine, transcript: transcript([usage(1000), compaction(500000)]) }) || '';
  assert.match(loud, /context: 500k tokens dropped/);

  // No transcript at all must not change what comes out.
  assert.doesNotMatch(renderResume({ mine }) || '', /context:/);
});

// Waiting for the first compaction means the warning always arrives after the
```

   最後在 `tests/resume.test.js` 裡找到這段：

```js
  assert.match(ctx, /output shape:/);
});

// It is the short form on purpose. Everything the full block carries that cannot
```

   `tests/resume.test.js` 換成（中間插入兩個新測試）：

```js
  assert.match(ctx, /output shape:/);
});

// The one thing only this block is placed to see: the gate itself is an
// AskUserQuestion, so a session driven entirely by its own answers would
// otherwise never see a busy or compacted context reported at all.
test('a busy transcript rides the resume block the same way it rides the prompt block', () => {
  const root = tmp('fankeel-resume-');
  seed(root, MINE);
  const dir = tmp('fankeel-transcript-');
  const file = path.join(dir, 'session.jsonl');
  fs.writeFileSync(file, '{"type":"assistant","message":{"usage":{"input_tokens":2,'
    + '"cache_creation_input_tokens":2362,"cache_read_input_tokens":397636,"output_tokens":275}}}\n');
  const ctx = context(run({ session_id: MINE, cwd: root, transcript_path: file }));
  assert.match(ctx, /context: 400k in play, nothing dropped yet\. This stage's gate gets a fourth option, hand off: set next/);
});

test('with no transcript_path the resume block still says nothing about context', () => {
  const root = tmp('fankeel-resume-');
  seed(root, MINE);
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.doesNotMatch(ctx, /context:/);
});

// It is the short form on purpose. Everything the full block carries that cannot
```

2. 跑它們，看它們紅：

```sh
node --test tests/context.test.js
node --test tests/resume.test.js
```

   兩個檔都要紅：`tests/context.test.js` 裡兩個舊測試因為 `carry` 文字還沒變而在新加
   的那行斷言上失敗，新測試因為 `renderResume` 還不認得 `transcript` 參數而輸出裡沒有
   `context:`；`tests/resume.test.js` 裡新測試因為 `hooks/resume.js` 還沒把
   `transcript_path` 傳下去而輸出裡沒有 `context:`。

3. 寫最小實作。在 `lib/context.js` 裡，把：

```js
    const carry = 'A new terminal and /fankeel → Adopt carries this task over with its notes and its route.';
```

   `lib/context.js` 換成：

```js
    const carry = "This stage's gate gets a fourth option, hand off: set next, then a new terminal and /fankeel → Adopt.";
```

   在 `lib/render.js` 裡，把：

```js
function renderResume({ mine, profile }) {
    const data = mine && mine.data;
    if (!data) return null;
    const lines = whereLines(data);
    if (!Number.isFinite(data.gateAt)) lines.push(GATE_UNSTAMPED);
    const prof = profileLine(profile);
    if (prof) lines.push(prof);
    return lines.concat(rulesLines(data, profile)).join('\n');
}
```

   `lib/render.js` 換成（`contextLine` 與 `inspectContext` 已經在檔案頂端
   require('./context.js') 進來了，不用加 import）：

```js
function renderResume({ mine, profile, transcript }) {
    const data = mine && mine.data;
    if (!data) return null;
    const lines = whereLines(data);
    if (!Number.isFinite(data.gateAt)) lines.push(GATE_UNSTAMPED);
    const prof = profileLine(profile);
    if (prof) lines.push(prof);
    const ctx = contextLine(inspectContext(transcript), mine && mine.sessionId);
    if (ctx) lines.push(ctx);
    return lines.concat(rulesLines(data, profile)).join('\n');
}
```

   在 `hooks/resume.js` 裡，把：

```js
    const context = renderResume({ mine: { sessionId, data: mine }, profile });
```

   `hooks/resume.js` 換成：

```js
    const context = renderResume({ mine: { sessionId, data: mine }, profile, transcript: payload.transcript_path });
```

   在 `skills/fankeel/SKILL.md` 裡，把：

```md
A `context:` line means this session has already lost work to compaction, and
says how much. Pass it on rather than ignoring it: the statusline shows a
percentage, but only this knows there is a task in flight and that `/fankeel` →
**Adopt** carries it — task, project, claims, stage, route, notes, `next` and what
the stages have cost in wall-clock — into a fresh session in one step. Not `burn`:
that measures a session's own context, and the session is the thing changing. Say it once when the line first appears, and again when its
wording hardens. Repeating it every turn is nagging, and nagging gets ignored
exactly when it stops being nagging.
```

   `skills/fankeel/SKILL.md` 換成：

```md
A `context:` line means this session is busy or has already lost work to
compaction, and says which. It rides both blocks now, the one before a prompt
and the one after an answered question — because the gate itself is an
`AskUserQuestion`, and a session doing nothing but answer it would otherwise
never see the line at all. Pass it on rather than ignoring it: the statusline
shows a percentage, but only this knows there is a task in flight, and that
this stage's gate should offer a fourth option — hand off — that sets `next`,
then a new terminal and `/fankeel` → **Adopt** carries it — task, project,
claims, stage, route, notes, `next` and what the stages have cost in
wall-clock — into a fresh session in one step. Not `burn`: that measures a
session's own context, and the session is the thing changing. Say it once when
the line first appears, and again when its wording hardens. Repeating it every
turn is nagging, and nagging gets ignored exactly when it stops being nagging.
```

   再在 `skills/fankeel/SKILL.md` 裡，把：

```md
`AskUserQuestion` caps `options` at four, and the fourth is free for a decision
that genuinely has one; no stage ships one today. `survey` used to, and what it
carried — asking whether to read further — is dispatched now rather than asked.
```

   `skills/fankeel/SKILL.md` 換成：

```md
`AskUserQuestion` caps `options` at four, and the fourth is free for a decision
that genuinely has one. A busy or compacted stage gets one: hand off, offered
whenever the `context:` line has appeared this stage — its description sets
`next`, then a new terminal and `/fankeel` → **Adopt**. Nothing else ships a
fourth; `survey` used to for a different reason, asking whether to read
further, and that is dispatched now rather than asked.
```

   最後在 `docs/improvement-brief.md` 裡，把：

```md
4. 串接的 fan-out 改走 Workflow，中間結果留在 script 裡，回主 session 的只有 join。

### 6.3 station 單 session
```

   `docs/improvement-brief.md` 換成：

```md
4. 串接的 fan-out 改走 Workflow，中間結果留在 script 裡，回主 session 的只有 join。

**定案（09-18，TODO 十九條）**：選候選 2——`lib/context.js` 的 `contextLine` 在
`BUSY` 以上時，把接手（設 `next`、開新終端機、`/fankeel` → Adopt）接到這一站的 gate
當第四個選項，回答後的區塊（`renderResume`）也帶這行。候選 1（`hooks/size.js`）已依
09-11 訂的規則拿掉——再量沒降就拿掉，改後 bigPerSession 從 0.3846 升到 0.6136。候選 4
（串接的 fan-out 走 Workflow）已經是現行做法。候選 3（把 verify 的檢查往 build 搬）不
做——它處理的是倒退，不是堆疊。

### 6.3 station 單 session
```

   在 `docs/registry.md` 的「When compaction has already cost something」底下，範例區塊逐字引了舊的 `carry` 句。把區塊裡這四行：

```text
context: 1.1M tokens dropped to compaction so far, 308k in play now,
--session 302790e6-e652-4cab-af1c-e45d239516cc. Start a fresh session before the
next one. A new terminal and /fankeel → Adopt carries this task over with its
notes and its route.
```

   換成（`carry` 的新文字，逐字）：

```text
context: 1.1M tokens dropped to compaction so far, 308k in play now,
--session 302790e6-e652-4cab-af1c-e45d239516cc. Start a fresh session before the
next one. This stage's gate gets a fourth option, hand off: set next, then a new
terminal and /fankeel → Adopt.
```

   同一節底下若有散文轉述「說一次就好」的舊做法，一併改成關卡上的第四個選項。

4. 跑它們，看它們綠：

```sh
node --test tests/context.test.js
node --test tests/resume.test.js
node scripts/docs-check.js
```

   `tests/resume.test.js` 裡既有的 `'renderResume stays a readable size across every
   route and profile'`（cap `< 2600` 字元）不受影響也要留在綠——它從沒傳 `transcript`
   ，`contextLine(null, ...)` 回 `null`，輸出跟這個 task 之前一樣。

5. Commit：

```sh
git commit -o lib/context.js lib/render.js hooks/resume.js skills/fankeel/SKILL.md docs/improvement-brief.md docs/registry.md tests/context.test.js tests/resume.test.js -m "feat: 關卡加第四個選項——接手，context: 行接到 gate 上，回答後的區塊也帶這行" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

## Task 9: registry entry 記 `version`

`task.js start` 與 `task.js adopt` 各自寫入 `version`：寫的那個 process 所在外掛根目錄
`package.json` 的 `version`。只記版本號，不記 commit sha——安裝的 cache 沒有 `.git`。
`adopt` 記的是自己這個新 session 的版本，不是從舊 session 抄過來的（`configDir` 也是
同一個道理：一個 process 啟動時就釘住外掛路徑，這個 session 寫下的版本只可能是它自己
的）。`task.js task`（改名）不碰這個欄位。

**Files:**
- Modify: `scripts/task.js` — 新增 `pluginVersion()`，`cmdStart` 與 `cmdAdopt` 的
  `data` 物件各多一個 `version` 欄位
- Modify: `docs/registry.md` — `.fankeel/sessions/{session_id}.json` 那一列的寫入者
  清單補上 `version`
- Modify: `skills/fankeel/SKILL.md` — 「Thirteen more」段落與「A fourteenth,
  `gateAt`」那句改成對得上新欄位數
- Test: `tests/task.test.js` — 兩個新 case：`start` 寫的 `version` 等於
  `package.json` 的、`adopt` 寫的是自己的版本而不是來源 session 的

**Interfaces:**
- Consumes: none（只用 `scripts/task.js` 自己既有的 `PLUGIN` 根目錄常數與
  `registry.replace`）
- Produces: 之後每一筆 `task.js start` 或 `task.js adopt` 寫出的 entry 都帶
  `version`（字串，寫入當下 `package.json` 的 `version`）；`task.js task`（改名）
  留著它不動；這個欄位上線前寫的舊 entry 沒有這個鍵，讀的人當它是未知，不回填。

**Dispatch:** implementer, sonnet — 一個小 helper 加兩處欄位插入，沒有分支邏輯。

1. 寫失敗的測試。在 `tests/task.test.js` 裡找到這段：

```js
  // Nothing has been edited, so nothing is held. An empty list written here
  // would be the declaration this replaced, spelled differently.
  assert.equal('claims' in data, false);
});

// The reason this script exists at all. Hand-writing the JSON left this file out
```

   `tests/task.test.js` 換成（中間插入新測試）：

```js
  // Nothing has been edited, so nothing is held. An empty list written here
  // would be the declaration this replaced, spelled differently.
  assert.equal('claims' in data, false);
});

test('start writes the plugin\'s own package.json version onto the entry', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(entry(dir, A).version, pkg.version);
});

// The reason this script exists at all. Hand-writing the JSON left this file out
```

   再在 `tests/task.test.js` 裡找到這段（`adopt inherits the start time rather than
   re-stamping it` 測試的結尾）：

```js
  run(dir, ['adopt', A, '--session', B]);
  assert.equal(entry(dir, B).started, source.started);
  assert.ok(Date.parse(entry(dir, B).updated) > Date.parse(source.started));
});

// `burn` is two sightings of one session's context and `clock` is two of the
```

   `tests/task.test.js` 換成（中間插入新測試）：

```js
  run(dir, ['adopt', A, '--session', B]);
  assert.equal(entry(dir, B).started, source.started);
  assert.ok(Date.parse(entry(dir, B).updated) > Date.parse(source.started));
});

// `version` records which process wrote the entry, not which task it is — a
// session started under an older plugin and adopted here must show this
// process's own version, not the one it inherited.
test('adopt writes this process\'s own version, not the source\'s', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint');
  const source = entry(dir, A);
  source.version = '0.1.0';
  registry.writeSession(dir, A, source);

  run(dir, ['adopt', A, '--session', B]);
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(entry(dir, B).version, pkg.version);
});

// `burn` is two sightings of one session's context and `clock` is two of the
```

2. 跑它，看它紅：

```sh
node --test tests/task.test.js
```

   兩個新 case 都紅：`entry(dir, A).version` 與 `entry(dir, B).version` 都是
   `undefined`，跟 `pkg.version` 對不上。

3. 寫最小實作。在 `scripts/task.js` 裡，把：

```js
const PLUGIN = path.resolve(__dirname, '..');

// Minutes, rounded, with hours above sixty of them. Seconds are not offered: a
```

   `scripts/task.js` 換成：

```js
const PLUGIN = path.resolve(__dirname, '..');

// The plugin's own package.json version — not a commit sha, because the
// installed cache has no .git and scripts/version.js does not bake one in at
// release time.
function pluginVersion() {
    try {
        return JSON.parse(fs.readFileSync(path.join(PLUGIN, 'package.json'), 'utf8')).version;
    } catch (e) {
        return undefined;
    }
}

// Minutes, rounded, with hours above sixty of them. Seconds are not offered: a
```

   在 `scripts/task.js` 的 `cmdStart` 裡，把：

```js
        configDir: live.liveConfigDir() || undefined,
        stage: route[0],
        active: true,
        started: stamp,
        updated: stamp,
    };
```

   `scripts/task.js` 換成：

```js
        configDir: live.liveConfigDir() || undefined,
        // The plugin's own package.json version at the moment this ran. Only
        // the version number: the installed cache has no .git for a commit
        // sha, and scripts/version.js does not bake one in at release time.
        version: pluginVersion(),
        stage: route[0],
        active: true,
        started: stamp,
        updated: stamp,
    };
```

   在 `scripts/task.js` 的 `cmdAdopt` 裡，把：

```js
        configDir: live.liveConfigDir() || undefined,
        active: true,
        // The source's, not this stamp. `started` is the tie-break, and adopting
```

   `scripts/task.js` 換成：

```js
        configDir: live.liveConfigDir() || undefined,
        // This session's own, matching `configDir` above — not copied from
        // `source`, because the version records which process wrote the
        // record and a fresh session may be running a different one.
        version: pluginVersion(),
        active: true,
        // The source's, not this stamp. `started` is the tie-break, and adopting
```

   在 `docs/registry.md` 裡，把：

```md
| `.fankeel/sessions/{session_id}.json` | No — `.fankeel/.gitignore` excludes it | `task.js`; `start` for `guard`, read from the effective profile whenever it is not the builtin default `ask` — a `guard` set later by hand overwrites it the same way any other write does; `inject.js` / `resume.js` for `updated` and `clock`; `inject.js` for `burn`; `touch.js` and `inject.js` for `claims`; `gate.js` and `resume.js` for `gateAt` and `waited`; `leave.js` for `ended`, `model`, `usage`, `spend` and `gates`, once, at `SessionEnd`; `task.js land` for `land`, once per invocation — first seen from the hooks 2026-09-01 (a `gateAt`, in a neighbouring project's registry) and 2026-09-02 (a `waited`, here), both in processes started after the manifest carried `gate.js` |
```

   `docs/registry.md` 換成：

File: `docs/registry.md`
```md
| `.fankeel/sessions/{session_id}.json` | No — `.fankeel/.gitignore` excludes it | `task.js`; `start` and `adopt` for `version`, the plugin's own `package.json` version at the moment either ran — `task` (the rename) leaves it, and an entry written before this field existed reads as unknown rather than being backfilled; `start` for `guard`, read from the effective profile whenever it is not the builtin default `ask` — a `guard` set later by hand overwrites it the same way any other write does; `inject.js` / `resume.js` for `updated` and `clock`; `inject.js` for `burn`; `touch.js` and `inject.js` for `claims`; `gate.js` and `resume.js` for `gateAt` and `waited`; `leave.js` for `ended`, `model`, `usage`, `spend` and `gates`, once, at `SessionEnd`; `task.js land` for `land`, once per invocation — first seen from the hooks 2026-09-01 (a `gateAt`, in a neighbouring project's registry) and 2026-09-02 (a `waited`, here), both in processes started after the manifest carried `gate.js` |
```

   在 `skills/fankeel/SKILL.md` 裡，把：

File: `skills/fankeel/SKILL.md`
```md
Thirteen more are written without anyone typing them. Five of those —
`ended`, `model`, `usage`, `spend` and `gates` — arrive once, from
`hooks/leave.js` when the session ends, and
[docs/registry.md](../../docs/registry.md) has their shape; the eight below
are the ones every session carries. `route` and `class` come from
the class picked at `start`, `configDir` records which config directory this
session runs under, so another session can look for its liveness in the right
place, and `burn` is what each stage cost — two token counts per stage, written
by the same prompt hook that refreshes `updated`.
```

   `skills/fankeel/SKILL.md` 換成：

```md
Fourteen more are written without anyone typing them. Five of those —
`ended`, `model`, `usage`, `spend` and `gates` — arrive once, from
`hooks/leave.js` when the session ends, and
[docs/registry.md](../../docs/registry.md) has their shape; the nine below
are the ones every session carries. `route` and `class` come from
the class picked at `start`, `configDir` records which config directory this
session runs under, so another session can look for its liveness in the right
place, `version` is the plugin's own `package.json` version, fixed at `start`
or `adopt` and left alone when `task` renames the task, and `burn` is what
each stage cost — two token counts per stage, written by the same prompt hook
that refreshes `updated`.
```

   再在 `skills/fankeel/SKILL.md` 裡，把：

```md
A fourteenth, `gateAt`, is deliberately not below. It exists only between a
question going out and its answer arriving — and a record that lacks it when the
answer arrives is what the `gate:` line under **While the mode is on** reports.
```

   `skills/fankeel/SKILL.md` 換成：

```md
A fifteenth, `gateAt`, is deliberately not below. It exists only between a
question going out and its answer arriving — and a record that lacks it when the
answer arrives is what the `gate:` line under **While the mode is on** reports.
```

4. 跑它，看它綠：

```sh
node --test tests/task.test.js
```

5. Commit：

```sh
git commit -o scripts/task.js docs/registry.md skills/fankeel/SKILL.md tests/task.test.js -m "feat: registry entry 記外掛的 package.json version，start 與 adopt 各記自己的" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

## Task 10: `gates` 多存問題本文與選項 description

每筆 gate 記錄（`lib/gates.js` 的 `gatesFrom` 從 transcript 找出的每一個
`AskUserQuestion`）多存兩個欄位：`question`（字串，問題本文）與
`descriptions`（字串陣列，和 `labels` 同長、同順序，每個選項的 description）。兩個都
是新增的兄弟欄位，照 `labels`／`picked` 現在用 `PICK_LEN`（120）截斷的同一個做法截
斷，各自的上限另外定名常數。`labels` 本身的形狀不變，`lib/station.js` 裡讀
`labels` 的兩處（`gateSummary()`）不用動。

**Files:**
- Modify: `lib/gates.js` — 新增 `QUESTION_LEN`、`DESCRIPTION_LEN` 兩個常數，
  `gatesFrom` 推進 `out` 的物件多帶 `question` 與 `descriptions`
- Modify: `docs/registry.md` — `gates` 那條項目符號的欄位形狀與截斷規則補上這兩個
  欄位
- Test: `tests/leave.test.js` — 新增一個紅測試證明兩個欄位有截斷；既有那個把整筆
  `gates` 記錄 `deepEqual` 出來的測試補上這兩個新欄位（不補的話這個 task 一實作完，
  這個既有測試就會紅）

**Interfaces:**
- Consumes: `clip(s, max)`（`lib/gates.js` 自己既有的 helper，簽名不變）
- Produces: `gatesFrom(entries, moves, answerOf)` 回傳的每一列現在是
  `{ at, stage, header, question, labels, descriptions, picked }`——`labels` 形狀
  沒變，`descriptions` 是跟 `labels` 同長同順序、各自截斷過的字串陣列，`question` 是
  截斷過的問題本文。`lib/station.js` 的 `gateSummary()` 兩處讀 `.labels` 的地方不用
  改。

**Dispatch:** implementer, sonnet — 兩個常數加兩個欄位，沿用既有的截斷寫法。

1. 寫失敗的測試。在 `tests/leave.test.js` 裡找到這段（`gatesFrom clips a label and
   an answer at PICK_LEN` 測試結尾與下一個測試之間）：

```js
    const out = gates.gatesFrom(entries, [['design', askedAt - 1]], replay.answerOf);
    assert.equal(out[0].labels[0].length, 120);
    assert.equal(out[0].picked.length, 120);
    assert.equal(out[0].labels[1], 'B', 'a short label beside it is untouched');
});

test('a session with no AskUserQuestion writes no gates field', () => {
```

   `tests/leave.test.js` 換成（中間插入新測試）：

```js
    const out = gates.gatesFrom(entries, [['design', askedAt - 1]], replay.answerOf);
    assert.equal(out[0].labels[0].length, 120);
    assert.equal(out[0].picked.length, 120);
    assert.equal(out[0].labels[1], 'B', 'a short label beside it is untouched');
});

// `TODO.md:77`: each gate row also carries the question text and a parallel
// `descriptions` array, one per option, clipped the same way labels are but
// at their own caps.
test('gatesFrom carries the question and each option\'s description, clipped at their own caps', () => {
    const askedAt = Date.parse('2026-09-18T00:00:00.000Z');
    const longQuestion = 'q '.repeat(150);
    const longDescription = 'd '.repeat(150);
    const entries = [
        {
            type: 'assistant', timestamp: '2026-09-18T00:00:00.000Z',
            message: { content: [{
                type: 'tool_use', id: 'a1', name: 'AskUserQuestion',
                input: { questions: [{
                    question: longQuestion, header: 'design',
                    options: [{ label: 'A', description: longDescription }, { label: 'B' }],
                }] },
            }] },
        },
        {
            type: 'user', timestamp: '2026-09-18T00:00:01.000Z',
            message: { content: [{ type: 'tool_result', tool_use_id: 'a1' }] },
            toolUseResult: { answers: { [longQuestion]: 'A' } },
        },
    ];
    const out = gates.gatesFrom(entries, [['design', askedAt - 1]], function (a) { return a; });
    assert.equal(out[0].question.length, 200);
    assert.equal(out[0].descriptions.length, 2);
    assert.equal(out[0].descriptions[0].length, 200);
    assert.equal(out[0].descriptions[1], '', 'a missing description keeps its slot, same as an empty label');
});

test('a session with no AskUserQuestion writes no gates field', () => {
```

   再在 `tests/leave.test.js` 裡找到這段（既有的整筆記錄 `deepEqual`）：

```js
test('leave writes gates from the transcript\'s AskUserQuestion calls, with the stage moves says was in force', () => {
    const askedAt = Date.now() - 60000;
    const moves = [['survey', askedAt - 120000], ['design', askedAt - 30000]];
    const f = fixtureWithGate(moves, askedAt, 'survey', '進 design');
    const out = run({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, f.cfg);
    assert.equal(out, '');
    const d = registry.readSession(f.root, SID);
    assert.deepEqual(d.gates, [{ at: askedAt, stage: 'design', header: 'survey', labels: ['進 design', '留在 survey'], picked: '進 design' }]);
});
```

   `tests/leave.test.js` 換成（`fixtureWithGate` 的 ask 物件本來就有
   `question: 'Which way?'`，選項沒有 `description`，所以截斷後的 `descriptions` 是
   兩個空字串）：

```js
test('leave writes gates from the transcript\'s AskUserQuestion calls, with the stage moves says was in force', () => {
    const askedAt = Date.now() - 60000;
    const moves = [['survey', askedAt - 120000], ['design', askedAt - 30000]];
    const f = fixtureWithGate(moves, askedAt, 'survey', '進 design');
    const out = run({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, f.cfg);
    assert.equal(out, '');
    const d = registry.readSession(f.root, SID);
    assert.deepEqual(d.gates, [{ at: askedAt, stage: 'design', header: 'survey', question: 'Which way?', labels: ['進 design', '留在 survey'], descriptions: ['', ''], picked: '進 design' }]);
});
```

2. 跑它，看它紅：

```sh
node --test tests/leave.test.js
```

   新測試紅：`out[0].question` 是 `undefined`，`.length` 對不上 200。既有的
   `deepEqual` 測試這一步還是綠的（`gates` 記錄還沒多欄位），紅的只有新測試。

3. 寫最小實作。在 `lib/gates.js` 裡，把：

```js
const MAX_GATES = 60;
const PICK_LEN = 120;
```

   `lib/gates.js` 換成：

```js
const MAX_GATES = 60;
const PICK_LEN = 120;
const QUESTION_LEN = 200;
const DESCRIPTION_LEN = 200;
```

   在 `lib/gates.js` 裡，再把：

```js
                out.push({
                    at: ask.at,
                    stage: stageWhen(moves, ask.at),
                    header: typeof q.header === 'string' ? q.header : '',
                    labels: (Array.isArray(q.options) ? q.options : [])
                        .map((o) => clip(o && o.label, PICK_LEN)),
                    picked: answer === null ? null : clip(answer, PICK_LEN),
                });
```

   `lib/gates.js` 換成：

```js
                out.push({
                    at: ask.at,
                    stage: stageWhen(moves, ask.at),
                    header: typeof q.header === 'string' ? q.header : '',
                    question: typeof q.question === 'string' ? clip(q.question, QUESTION_LEN) : '',
                    labels: (Array.isArray(q.options) ? q.options : [])
                        .map((o) => clip(o && o.label, PICK_LEN)),
                    descriptions: (Array.isArray(q.options) ? q.options : [])
                        .map((o) => clip(o && o.description, DESCRIPTION_LEN)),
                    picked: answer === null ? null : clip(answer, PICK_LEN),
                });
```

   在 `docs/registry.md` 裡，把：

```md
- `gates` — an array of `{ at, stage, header, labels, picked }`, one entry
  per `AskUserQuestion` `lib/gates.js` finds in the transcript: `stage` is
  read off `moves` at that point, `labels` is every option's text in the
  order `AskUserQuestion` declared them — each capped at 120 characters, an
  empty one kept in place rather than filtered out, since dropping it would
  shift every later index — and `picked` is the chosen option's label, the
  same cap, the text typed when it was Other, and `null` when the question
  was never answered.
```

   `docs/registry.md` 換成：

```md
- `gates` — an array of `{ at, stage, header, question, labels, descriptions,
  picked }`, one entry per `AskUserQuestion` `lib/gates.js` finds in the
  transcript: `stage` is read off `moves` at that point, `question` is the
  question text itself, capped at `QUESTION_LEN` (200) characters, `labels`
  is every option's text in the order `AskUserQuestion` declared them — each
  capped at 120 characters, an empty one kept in place rather than filtered
  out, since dropping it would shift every later index — `descriptions` is
  each option's description text, the same length and order as `labels`,
  capped at `DESCRIPTION_LEN` (200) the same way, an empty slot kept for the
  same reason — and `picked` is the chosen option's label, the same cap as
  `labels`, the text typed when it was Other, and `null` when the question
  was never answered. `question` and `descriptions` are new sibling fields;
  `labels` itself did not change shape, so both of [station.md](station.md)'s
  `gateSummary()` readers of it are untouched.
```

4. 跑它，看它綠：

```sh
node --test tests/leave.test.js
```

   確認整個檔案綠，包括那個被改過的 `deepEqual` 測試（步驟 3 的實作一落地，它原本會
   因為記錄多了兩個欄位而紅，前一步已經把期望值改好了）。

5. Commit：

```sh
git commit -o lib/gates.js docs/registry.md tests/leave.test.js -m "feat: gate 記錄多存 question 與 descriptions，照 labels 的方式截斷" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

## Task 11: profile 卡移到首頁頂端，station 行加 `serve --open` 指引

**Files:**
- Modify: `lib/render.js` — `renderInit`'s `station:` line gains a sentence pointing at editing the profile.
- Modify: `lib/stages.js` — `INIT[0]` drops its second sentence to pay for the new text; `skills/fankeel/SKILL.md:691-693` already carries the same point in full, so nothing is lost.
- Modify: `assets/station/station.js` — `homePage()` calls `profileCard(...)` first instead of last.
- Modify: `docs/station.md` — the profile-card section says the card opens the page, not closes it.
- Test: `tests/render.test.js` — the station-line regex at `:561`, still `$`-anchored.
- Read: `skills/fankeel/SKILL.md` — confirms the displaced sentence's content is already there (open it before deleting anything, do not edit it).

**Interfaces:**
- Consumes: `renderInit`, `INIT`, `profileCard` — unchanged signatures.
- Produces: `homePage()`'s return value opens with the machine profile card and carries no `profileCard(...)` call after it — Task 12 anchors its own `assets/station/station.js` edit on that shape, so this task lands first.

**Dispatch:** implementer, sonnet — a byte-budgeted text change plus a page-composition reorder.

### Steps

1. Change the existing station-line assertion so it expects the new sentence — this is the red step, since `renderInit` does not produce it yet. In `tests/render.test.js`, replace:

```js
test('the init block carries the station line when it is given one, and stays under the cap with it', (t) => {
  const out = renderInit({ sessionId: MINE, station: { file: 'C:/Users/you/.claude/fankeel/station.html', live: 2, stale: 8, down: 131 } });
  assert.match(out, /^station: 8 stale, 2 live — C:\/Users\/you\/\.claude\/fankeel\/station\.html$/m);
  const size = sizeAtReference(out);
  t.diagnostic('init+st'.padEnd(7) + size + ' chars at a ' + REFERENCE_ROOT + '-char root  (' + out.length + ' here)');
  assert.ok(size < 1400, 'init block with a station line is ' + size + ' chars');
  assert.doesNotMatch(renderInit({ sessionId: MINE }), /^station:/m, 'no page, no line');
  assert.match(out, /<the station line, if any>/, 'the shape has a slot for it');
});
```

with (still in `tests/render.test.js`):

```js
test('the init block carries the station line when it is given one, and stays under the cap with it', (t) => {
  const out = renderInit({ sessionId: MINE, station: { file: 'C:/Users/you/.claude/fankeel/station.html', live: 2, stale: 8, down: 131 } });
  assert.match(out, /^station: 8 stale, 2 live — C:\/Users\/you\/\.claude\/fankeel\/station\.html\. Edit the profile with station\.js serve --open\.$/m);
  const size = sizeAtReference(out);
  t.diagnostic('init+st'.padEnd(7) + size + ' chars at a ' + REFERENCE_ROOT + '-char root  (' + out.length + ' here)');
  assert.ok(size < 1400, 'init block with a station line is ' + size + ' chars');
  assert.doesNotMatch(renderInit({ sessionId: MINE }), /^station:/m, 'no page, no line');
  assert.match(out, /<the station line, if any>/, 'the shape has a slot for it');
});
```

2. Run `node --test tests/render.test.js`. It fails on this one test: `assert.match` throws because the rendered line still ends at `station.html` — the new sentence is not in the string yet. (The other two `init` tests still pass; they do not check the exact suffix.)

3. In `lib/render.js`, inside `renderInit`, replace the station-line push:

```js
    if (station && typeof station.file === 'string') {
        lines.push('station: ' + station.stale + ' stale, ' + station.live + ' live — ' + station.file);
    }
```

with (still in `lib/render.js`):

```js
    if (station && typeof station.file === 'string') {
        lines.push('station: ' + station.stale + ' stale, ' + station.live + ' live — ' + station.file
            + '. Edit the profile with station.js serve --open.');
    }
```

4. The line above costs 48 characters at any root — `sizeAtReference` counts it once, since it names no `<plugin>` root. Pay for it by trimming `INIT[0]` in `lib/stages.js`, which currently states its own rationale for a rule `skills/fankeel/SKILL.md:691-693` ("**If the user named a place** — an `@` path, a directory in the prompt, "the frontend" — pass it through and work from there. They have already answered the question; asking again is the thing this is here to stop.") already carries in full — `SKILL.md:738-741` calls `INIT` "the short form" of that section and itself "the long form, not the only copy," so nothing is lost by shortening the copy that gets restated every prompt. Replace:

```js
const INIT = [
    'Run `{{ORIENT}}` and show what came back. If the user named a place — an `@` path, a directory, "the frontend" — work from there rather than asking for it again.',
    'Read `TODO.md` at the root if there is one. Its headings are the clustering: `## Ready` is one task for the whole section, and more than one bullet needs `plan` on the route; `## Needs a decision` offers what `orient`\'s `todo:` lists, one option each, the rest through Other; `## Waiting` stays out; any other heading, or none, means clustering by hand — never one option per bullet; no `TODO.md` means guessing from the commits.',
    'Ask with AskUserQuestion, never in prose: the project only when the root holds more than one, then the task. Never ask for a file list.',
    'Then `{{TASK}} start`, and begin the first stage on the route in the same turn — `--route` can make that something other than `survey`.',
];
```

with (still in `lib/stages.js`):

```js
const INIT = [
    'Run `{{ORIENT}}` and show what came back.',
    'Read `TODO.md` at the root if there is one. Its headings are the clustering: `## Ready` is one task for the whole section, and more than one bullet needs `plan` on the route; `## Needs a decision` offers what `orient`\'s `todo:` lists, one option each, the rest through Other; `## Waiting` stays out; any other heading, or none, means clustering by hand — never one option per bullet; no `TODO.md` means guessing from the commits.',
    'Ask with AskUserQuestion, never in prose: the project only when the root holds more than one, then the task. Never ask for a file list.',
    'Then `{{TASK}} start`, and begin the first stage on the route in the same turn — `--route` can make that something other than `survey`.',
];
```

The removed clause is 120 characters; the new sentence is 48. Net change at the reference root: −72. The block with a station line was 1383 chars at the 59-char reference root (17 of room under the 1400 cap); it lands at 1311. The block with no station line was 1314; it lands at 1194. Both comfortably clear the cap, and the test's own diagnostic line confirms the real figure.

5. Run `node --test tests/render.test.js` again. All three `init` tests pass, and `t.diagnostic` prints the two sizes above.

6. `homePage()` in `assets/station/station.js` cannot be driven from `node --test` — it is defined below the file's own `if (!doc) return;` guard, the line the file's top comment calls out as the boundary between what is unit tested and what is "checked against the served page." Move the card by two anchored edits. First, prepend the call before the hero panel. Replace:

```js
        return (isFinite(S.cleared) ? '<p class="cleared">cleared ' + S.cleared + ' stale rows</p>' : '')
            + '<section class="panel hero"><div class="hero-top"><div class="hero-title"><div class="eyebrow">'
```

with (still in `assets/station/station.js`):

```js
        return (isFinite(S.cleared) ? '<p class="cleared">cleared ' + S.cleared + ' stale rows</p>' : '')
            + profileCard('machine profile', 'machine', null, S.profiles && S.profiles.machine)
            + '<section class="panel hero"><div class="hero-top"><div class="hero-title"><div class="eyebrow">'
```

7. Then, in `assets/station/station.js`, drop the call from the end. This text is unique because of the trailing `;\n    }` that closes the function — the copy just inserted above is followed by `\n            + '<section class="panel hero">'` instead, so the two do not collide. Replace:

```js
            + profileCard('machine profile', 'machine', null, S.profiles && S.profiles.machine);
    }
```

with (still in `assets/station/station.js`):

```js
    }
```

Applied together, the end of `homePage()`'s return statement now reads `... + '<section class="panel">' + recentHtml(recent, o) + '</section></div>';` — Task 12 anchors its own edit on that exact text.

8. Sanity-check the reorder without a DOM: `grep -n "profileCard('machine profile'\|class=\\\\\"panel hero\\\\\"" assets/station/station.js` — the `profileCard` line number must be lower than the `panel hero` line number (it was the other way around before this task). Then run `node --test tests/station-view.test.js` — nothing in it calls `homePage()`, but the existing `profileCard` tests (around `:291-323`) still pass unchanged, confirming the function itself was not touched.

9. In `docs/station.md`, replace:

```
No session view carries a **profile** card. 首頁 ends with the machine defaults' card, after its projects and recent sessions; each registry's card —
```

with (still in `docs/station.md`):

```
No session view carries a **profile** card. 首頁 opens with the machine defaults' card, before its projects and recent sessions; each registry's card —
```

10. `node scripts/docs-check.js` must exit 0. Nothing in this task moves a line another document cites by number — `lib/render.js` and `lib/stages.js` change in place (no lines added or removed net across the file, since one sentence is deleted and none is added elsewhere), and `assets/station/station.js` gains a line at the top of `homePage()` and loses one at the bottom, a net wash — but run the check anyway and fix anything it reports moved before committing, since `docs/station.md` itself cites `lib/station.js` and `assets/station/station.js` by line number in the sections this task does not touch.

11. Commit:

```
git commit -o lib/render.js lib/stages.js assets/station/station.js docs/station.md tests/render.test.js -m "feat: 首頁 profile 卡移到最前，station 行加 serve --open 指引"
git commit -o lib/render.js lib/stages.js assets/station/station.js docs/station.md tests/render.test.js -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git commit -o lib/render.js lib/stages.js assets/station/station.js docs/station.md tests/render.test.js -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

(Written as one `git commit` with three `-m` flags in the same call, not three separate commits.)

---

## Task 12: 首頁「文件」卡 — 讀各專案已生成的 `.fankeel/map.md`

**Files:**
- Modify: `lib/station.js` — a pure parser for one `map.md`'s already-computed figures, a disk-read helper, and `gather()`/`serialize()` wiring so each registry (and each project under it) carries its card's data.
- Modify: `assets/station/station.js` — `docsCardHtml()` and its helpers render the card; `homePage()` is wired to call it.
- Modify: `assets/station/station.css` — the card's layout rules.
- Modify: `docs/station.md` — a new `**文件**` paragraph describing the card.
- Modify: `docs/README.md` — one line near the top pointing at the card.
- Read: `.fankeel/map.md` — this project's generated map, the text the test fixture is trimmed from and the file the card parses; never written by this task.
- Test: `tests/station.test.js` — `parseMapCard`, and `gather()` picking up a registry's and a project's `map.md`.
- Test: `tests/station-view.test.js` — `docsCardHtml`.

**Interfaces:**
- Consumes: Task 11's `homePage()` — the profile card already moved to the top, and the grid2 block's second section ending `+ '<section class="panel">' + recentHtml(recent, o) + '</section></div>';` with nothing after it. This task's `assets/station/station.js` edit only applies once Task 11 has landed.
- Produces: `parseMapCard(text)` and `mapSection(lines, at)` in `lib/station.js`; `docsCardHtml(list, o)` in `assets/station/station.js`; a `docs` array on every registry `gather()` returns and on every entry of `serialize()`'s `projects`.

**Dispatch:** implementer, sonnet — a markdown parser against a fixed, already-generated format, wired through two files.

### Steps

1. Write the failing tests for the parser. In `tests/station.test.js`, add near the top (after the existing `const tmp = require('./tmp.js');` line) a fixture built from this project's own `.fankeel/map.md`, trimmed to a few rows so the test stays short but every section is real:

```js
const SAMPLE_MAP = [
    '---',
    'status: generated',
    'source_of_truth: generated-by scripts/map.js',
    '---',
    '',
    '# fankeel — map',
    '',
    'Generated. Do not edit; re-run `node scripts/map.js` instead.',
    '',
    'read first: README.md',
    '',
    '| | |',
    '|---|---|',
    '| `node scripts/docs-check.js` | Every reference still resolves. |',
    '',
    'filing: index: docs/README.md',
    '  docs/judgements — report',
    '  .claude/agents — reference',
    '  docs/archive — archive',
    '  docs/plans — plan',
    '',
    'documents: 201 markdown files — 89 current, 2 planned, 102 retired, 8 undeclared',
    'a page named nowhere below is current.',
    '',
    'planned, not built — 2:',
    '  docs/improvement-brief.md',
    '  docs/plans/2026-09-09-design-class-prompt.md',
    '',
    'retired, do not follow — 102:',
    '  docs/archive — 102, the whole archive bucket',
    '',
    'undeclared — 8, dated by git rather than by anyone reading them:',
    '  docs/judgements/2026-09-10-exception-cases.md',
    '  docs/judgements/2026-09-11-todo-split.md',
    '',
].join('\n');
```

then, in `tests/station.test.js`, anywhere after that (near the other standalone-function tests is fine):

```js
test('parseMapCard reads map.js\'s own generated figures, quoted rather than re-derived', () => {
    const card = station.parseMapCard(SAMPLE_MAP);
    assert.equal(card.total, 201);
    assert.deepEqual(card.buckets, [{ label: 'current', count: 89 }, { label: 'planned', count: 2 },
        { label: 'retired', count: 102 }, { label: 'undeclared', count: 8 }]);
    assert.deepEqual(card.plannedNotBuilt, ['docs/improvement-brief.md', 'docs/plans/2026-09-09-design-class-prompt.md']);
    assert.deepEqual(card.undeclared, {
        count: 8, note: 'dated by git rather than by anyone reading them',
        paths: ['docs/judgements/2026-09-10-exception-cases.md', 'docs/judgements/2026-09-11-todo-split.md'],
    });
    assert.deepEqual(card.filing, {
        index: 'docs/README.md',
        rows: [
            { bucket: 'docs/judgements', role: 'report', note: null },
            { bucket: '.claude/agents', role: 'reference', note: null },
            { bucket: 'docs/archive', role: 'archive', note: '102, the whole archive bucket' },
            { bucket: 'docs/plans', role: 'plan', note: null },
        ],
    });
});

test('parseMapCard returns null with no documents line, and empty lists with no filing when a section is missing', () => {
    assert.equal(station.parseMapCard('nothing here'), null);
    assert.deepEqual(station.parseMapCard('documents: 3 markdown files\n'),
        { total: 3, buckets: [], plannedNotBuilt: [], undeclared: { count: 0, note: null, paths: [] }, filing: null });
});

test('gather reads each registry root\'s own map.md, and each named project\'s under it', () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.r1, '.fankeel', 'map.md'), SAMPLE_MAP);
    const m = station.gather({ configDir: f.cfg });
    const one = m.registries.find((r) => r.root === path.resolve(f.r1));
    const two = m.registries.find((r) => r.root === path.resolve(f.r2));
    assert.equal(one.docs.length, 1, 'r1 has a map.md at its root; its one session\'s project dir does not exist on disk');
    assert.equal(one.docs[0].pkey, path.resolve(f.r1));
    assert.equal(one.docs[0].total, 201);
    assert.equal(two.docs.length, 0, 'r2 has no map.md anywhere, so no card for it');
});
```

2. Run `node --test tests/station.test.js`. The first two tests fail with `TypeError: station.parseMapCard is not a function`; the third fails the same way once it reaches `station.gather`, since `gather()` does not yet put anything under `.docs`.

3. In `lib/station.js`, add the parser and the disk-read helper. Anchor on the function right above `function gather(opts) {`. Replace:

```js
function mapDate(root) {
    try {
        return fs.statSync(path.join(root, '.fankeel', 'map.md')).mtime.toISOString();
    } catch (e) {
        return null;
    }
}
```

with (still in `lib/station.js`):

```js
function mapDate(root) {
    try {
        return fs.statSync(path.join(root, '.fankeel', 'map.md')).mtime.toISOString();
    } catch (e) {
        return null;
    }
}

// The file itself, for `parseMapCard` — read once per registry write, the
// same file `mapDate` already stats for the footer's own line.
function mapDoc(dir) {
    try {
        const file = path.join(dir, '.fankeel', 'map.md');
        return { text: fs.readFileSync(file, 'utf8'), mtimeMs: fs.statSync(file).mtimeMs };
    } catch (e) {
        return null;
    }
}

// The indented lines under one of `map.js`'s own headers, each with its
// leading two spaces stripped, stopping at the first line that is not
// indented — a blank line included, since `map.js` always leaves one after
// a section.
function mapSection(lines, at) {
    if (at < 0) return [];
    const out = [];
    for (let i = at + 1; i < lines.length && lines[i].startsWith('  '); i++) out.push(lines[i].slice(2));
    return out;
}

// What `map.js` already computed for one project, quoted rather than
// re-derived — this reads `.fankeel/map.md`'s own text and never re-runs a
// docs scan. A section this does not recognise is simply left out of the
// card, so a `map.js` change that adds one shows up here only once this is
// taught to read it too. `null` means the text has no `documents:` line at
// all — the caller reads that as "no card," the same as a missing file.
function parseMapCard(text) {
    const lines = String(text == null ? '' : text).split('\n');
    const docLine = lines.find((l) => l.startsWith('documents: '));
    if (!docLine) return null;
    const dm = /^documents: (\d+) markdown files(?: — (.+))?$/.exec(docLine);
    if (!dm) return null;
    const total = Number(dm[1]);
    const buckets = (dm[2] || '').split(', ').filter(Boolean).map((part) => {
        const bm = /^(\d+) (\S+)$/.exec(part);
        return bm ? { label: bm[2], count: Number(bm[1]) } : null;
    }).filter(Boolean);

    const plannedAt = lines.findIndex((l) => /^planned, not built — \d+:$/.test(l));
    const plannedNotBuilt = mapSection(lines, plannedAt);

    const undeclaredAt = lines.findIndex((l) => /^undeclared — \d+, /.test(l));
    const um = undeclaredAt < 0 ? null : /^undeclared — (\d+), (.+):$/.exec(lines[undeclaredAt]);
    const undeclared = um ? { count: Number(um[1]), note: um[2], paths: mapSection(lines, undeclaredAt) }
        : { count: 0, note: null, paths: [] };

    // The whole-bucket notes from "retired, do not follow" — `map.js` writes
    // one such line per archive bucket ("docs/archive — 102, the whole
    // archive bucket"), and a loose individual retired page's own line has no
    // ` — ` in it, so it never matches here and is simply not surfaced by
    // this card, the same as it is not by the mockup this card follows.
    const retiredAt = lines.findIndex((l) => /^retired, do not follow — \d+:$/.test(l));
    const retiredNotes = {};
    for (const l of mapSection(lines, retiredAt)) {
        const rm = /^(\S.*?) — (.+)$/.exec(l);
        if (rm) retiredNotes[rm[1]] = rm[2];
    }

    const filingAt = lines.findIndex((l) => l.startsWith('filing: index: '));
    const filing = filingAt < 0 ? null : {
        index: lines[filingAt].slice('filing: index: '.length),
        rows: mapSection(lines, filingAt).map((l) => {
            const rm = /^(\S+) — (\S+)$/.exec(l);
            return rm ? { bucket: rm[1], role: rm[2], note: retiredNotes[rm[1]] || null } : null;
        }).filter(Boolean),
    };

    return { total, buckets, plannedNotBuilt, undeclared, filing };
}
```

4. In `lib/station.js`, wire it into `gather()`, where `projectDirs` is already the list this needs — the registry root plus every project a session under it named. Replace:

```js
        const projectDirs = [root].concat([...new Set(sessions.map((s) => s.project).filter(Boolean))]
            .map((p) => path.join(root, p)).filter((p) => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }));
        const profiles = {};
        for (const p of projectDirs) profiles[p] = profile.read(p, configDir);
        registries.push({ root, gone: false, unreadable: all.unreadable, build: buildDirs(root), mapAt: mapDate(root), sessions, profiles });
    }
    for (const root of found.gone) {
        registries.push({ root, gone: true, unreadable: 0, build: [], mapAt: null, sessions: [], profiles: {} });
    }
```

with (still in `lib/station.js`):

```js
        const projectDirs = [root].concat([...new Set(sessions.map((s) => s.project).filter(Boolean))]
            .map((p) => path.join(root, p)).filter((p) => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }));
        const profiles = {};
        for (const p of projectDirs) profiles[p] = profile.read(p, configDir);
        // One card per project directory that has a map.md — the registry
        // root's own plus every project under it, the same set `profiles`
        // just walked. A directory with none is simply not in this list.
        const docs = [];
        for (const dir of projectDirs) {
            const doc = mapDoc(dir);
            const card = doc && parseMapCard(doc.text);
            if (!card) continue;
            const rel = dir === root ? '' : path.relative(root, dir).split(path.sep).join('/');
            docs.push(Object.assign({ pkey: rel ? root + '/' + rel : root, generatedAt: new Date(doc.mtimeMs).toISOString() }, card));
        }
        registries.push({ root, gone: false, unreadable: all.unreadable, build: buildDirs(root), mapAt: mapDate(root), sessions, profiles, docs });
    }
    for (const root of found.gone) {
        registries.push({ root, gone: true, unreadable: 0, build: [], mapAt: null, sessions: [], profiles: {}, docs: [] });
    }
```

5. In `lib/station.js`, carry it through `serialize()`, filtered the same way `profiles.projects` already is — a hidden project's docs card must disappear with the rest of it. Replace:

```js
        projects: model.registries.map((r) => ({
            root: r.root, gone: Boolean(r.gone), unreadable: r.unreadable,
            build: r.build, mapAt: r.mapAt,
        })),
```

with (still in `lib/station.js`):

```js
        projects: model.registries.map((r) => ({
            root: r.root, gone: Boolean(r.gone), unreadable: r.unreadable,
            build: r.build, mapAt: r.mapAt,
            docs: (r.docs || []).filter((d) => !hidden.has(d.pkey)),
        })),
```

6. In `lib/station.js`, export the parser. Replace:

```js
module.exports = { discover, gather, render, serialize, serializeDetail, write, scanRoots, readRoots, rootsPath, rememberRoots, EMITTED, hiddenPkeys };
```

with (still in `lib/station.js`):

```js
module.exports = { discover, gather, render, serialize, serializeDetail, write, scanRoots, readRoots, rootsPath, rememberRoots, EMITTED, hiddenPkeys, parseMapCard };
```

7. Run `node --test tests/station.test.js`. All three new tests pass.

8. Write the failing tests for the card's own HTML, in `tests/station-view.test.js` (near the other standalone-fragment tests, such as `profileCard`'s):

```js
const DOC_A = {
    pkey: 'F:\\ws\\alpha', generatedAt: '2026-09-18T16:16:00.000Z', total: 201,
    buckets: [{ label: 'current', count: 89 }, { label: 'planned', count: 2 }, { label: 'retired', count: 102 }, { label: 'undeclared', count: 8 }],
    plannedNotBuilt: ['docs/improvement-brief.md'],
    undeclared: { count: 2, note: 'dated by git rather than by anyone reading them', paths: ['docs/a.md', 'docs/b.md'] },
    filing: { index: 'docs/README.md', rows: [
        { bucket: 'docs/archive', role: 'archive', note: '102, the whole archive bucket' },
        { bucket: 'docs/plans', role: 'plan', note: null },
    ] },
};

test('docsCardHtml quotes one project\'s map.md into a section: counts, both lists, the filing table with its retired note, and when it was generated', () => {
    const o = { names: { 'F:\\ws\\alpha': 'alpha' }, pkeys: ['F:\\ws\\alpha'] };
    const html = V.docsCardHtml([DOC_A], o);
    assert.match(html, /<div class="h2">文件 /);
    assert.match(html, />alpha</);
    assert.match(html, /201 markdown files/);
    assert.match(html, /current <b>89<\/b>/);
    assert.match(html, /docs\/improvement-brief\.md/);
    assert.match(html, /docs\/a\.md/);
    assert.match(html, /dated by git rather than by anyone reading them/);
    assert.match(html, /docs\/archive[\s\S]*archive[\s\S]*retired — 102, the whole archive bucket/);
    assert.match(html, /docs\/plans[\s\S]*plan/);
    assert.match(html, /2026-09-18 16:16/);
});

test('docsCardHtml is empty with no project map, so the whole card is left out', () => {
    assert.equal(V.docsCardHtml([], { names: {}, pkeys: [] }), '');
});
```

9. Run `node --test tests/station-view.test.js`. Both new tests fail with `TypeError: V.docsCardHtml is not a function`.

10. In `assets/station/station.js`, add the renderer above the `module.exports` guard, next to `recentHtml` (which is the last function in that region before `// ---- the project page`). Replace:

```js
    function recentHtml(list, o) {
        return '<div class="h2">最近 sessions <small>依最後動作，最新在上</small><span class="spacer"></span>'
            + '<a class="btn" href="#/list">看全部 →</a></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th>任務</th><th>專案</th><th>stage</th><th class="r">花費</th>'
            + '<th class="r">token</th><th>狀態</th></tr></thead><tbody>'
            + list.map(function (s) {
                var t = sessionTotals(s);
                return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td class="task"><a href="' + sessionHash(s.id) + '">'
                    + esc(s.task || '（未命名）') + '</a></td><td><span class="pchip"><i class="sw" style="background:'
                    + colorOf('project', s.pkey, o.pkeys) + '"></i>' + esc(o.names[s.pkey] || s.pkey) + '</span></td>'
                    + '<td>' + routeDots(s) + '</td><td class="r">' + usd(t.usd) + '</td><td class="r muted">' + tokens(t.tokens) + '</td>'
                    + '<td>' + statePill(s) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
    }
```

with (still in `assets/station/station.js`):

```js
    function recentHtml(list, o) {
        return '<div class="h2">最近 sessions <small>依最後動作，最新在上</small><span class="spacer"></span>'
            + '<a class="btn" href="#/list">看全部 →</a></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th>任務</th><th>專案</th><th>stage</th><th class="r">花費</th>'
            + '<th class="r">token</th><th>狀態</th></tr></thead><tbody>'
            + list.map(function (s) {
                var t = sessionTotals(s);
                return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td class="task"><a href="' + sessionHash(s.id) + '">'
                    + esc(s.task || '（未命名）') + '</a></td><td><span class="pchip"><i class="sw" style="background:'
                    + colorOf('project', s.pkey, o.pkeys) + '"></i>' + esc(o.names[s.pkey] || s.pkey) + '</span></td>'
                    + '<td>' + routeDots(s) + '</td><td class="r">' + usd(t.usd) + '</td><td class="r muted">' + tokens(t.tokens) + '</td>'
                    + '<td>' + statePill(s) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
    }
    // The 文件 card: one section per project whose `.fankeel/map.md` was
    // found, quoting `parseMapCard`'s own reading of it rather than
    // recomputing anything here. `d.label` colours and `o.names` name it the
    // same way every other project-keyed row on this page does.
    var DOC_STATUS_COLOUR = { current: 'var(--good)', planned: 'var(--p-0)', generated: 'var(--m-haiku)', undeclared: 'var(--stale)' };
    var DOC_HATCH = 'var(--hatch-bg) repeating-linear-gradient(45deg,var(--hatch) 0 1.3px,transparent 1.3px 4.5px)';
    function docSplitHtml(d) {
        if (!d.buckets.length || !d.total) return '';
        var swatch = function (label) {
            return label === 'retired' ? DOC_HATCH : 'background:' + (DOC_STATUS_COLOUR[label] || 'var(--muted)');
        };
        var legend = d.buckets.map(function (b) {
            return '<span><i class="sw" style="' + (b.label === 'retired' ? 'background:' + swatch(b.label) : swatch(b.label)) + '"></i>'
                + esc(b.label) + ' <b>' + b.count + '</b><em>' + Math.round(b.count / d.total * 100) + '%</em></span>';
        }).join('');
        var bar = d.buckets.map(function (b) {
            return '<i title="' + esc(b.label) + ' ' + b.count + '" style="flex:' + b.count + ' 1 0;' + swatch(b.label) + '"></i>';
        }).join('');
        return '<div class="split"><div class="split-h"><span>狀態</span><span class="num mono">' + d.total + ' markdown files</span></div>'
            + '<div class="split-bar" role="img">' + bar + '</div><div class="split-leg">' + legend + '</div></div>';
    }
    function docPathList(paths) {
        return '<div class="claims">' + paths.map(function (p) { return '<div title="' + esc(p) + '">' + esc(p) + '</div>'; }).join('') + '</div>';
    }
    function docFilingHtml(filing) {
        if (!filing || !filing.rows.length) return '';
        return '<table class="t"><thead><tr><th>bucket</th><th>role</th><th></th></tr></thead><tbody>'
            + filing.rows.map(function (r) {
                return '<tr><td class="mono">' + esc(r.bucket) + '</td><td><span class="chip">' + esc(r.role) + '</span></td>'
                    + '<td class="muted mono" style="font-size:11px;white-space:normal;line-height:1.35">'
                    + (r.note ? esc('retired — ' + r.note) : '') + '</td></tr>';
            }).join('') + '</tbody></table>';
    }
    function docProjectHtml(d, o, open) {
        return '<details class="dproj"' + (open ? ' open' : '') + '><summary><span class="nm"><i class="sw" style="background:'
            + colorOf('project', d.pkey, o.pkeys) + '"></i>' + esc(o.names[d.pkey] || d.pkey) + '</span>'
            + '<span class="mono muted">.fankeel/map.md</span><span class="spacer"></span>'
            + '<span class="when">生成於 <span class="mono">' + stamp(Date.parse(d.generatedAt)) + '</span></span></summary>'
            + docSplitHtml(d)
            + '<div class="dgrid"><div>'
            + (d.plannedNotBuilt.length ? '<div class="dsub">還沒建 <span class="n">planned, not built — ' + d.plannedNotBuilt.length + '</span></div>'
                + docPathList(d.plannedNotBuilt) : '')
            + (d.undeclared.count ? '<div class="dsub">沒宣告狀態 <span class="n">undeclared — ' + d.undeclared.count + '</span></div>'
                + (d.undeclared.note ? '<div class="dnote">' + esc(d.undeclared.note) + '</div>' : '') + docPathList(d.undeclared.paths) : '')
            + '</div><div>'
            + (d.filing ? '<div class="dsub">歸檔位置 <span class="n">filing · index: ' + esc(d.filing.index) + '</span></div>' + docFilingHtml(d.filing) : '')
            + '</div></div></details>';
    }
    function docsCardHtml(list, o) {
        if (!list.length) return '';
        return '<section class="panel docs"><div class="h2">文件 <small>各專案已生成的 <span class="mono">.fankeel/map.md</span>，找不到的不列</small></div>'
            + list.map(function (d, i) { return docProjectHtml(d, o, i === 0); }).join('') + '</section>';
    }
```

11. In `assets/station/station.js`, add `docsCardHtml` to the exports. Replace:

```js
            timelineModel: timelineModel, timelineSvg: timelineSvg, costModel: costModel, costHtml: costHtml,
            sessionHeadHtml: sessionHeadHtml, tabsHtml: tabsHtml, serveLost: serveLost,
            heroEyebrow: heroEyebrow,
        };
```

with (still in `assets/station/station.js`):

```js
            timelineModel: timelineModel, timelineSvg: timelineSvg, costModel: costModel, costHtml: costHtml,
            sessionHeadHtml: sessionHeadHtml, tabsHtml: tabsHtml, serveLost: serveLost,
            heroEyebrow: heroEyebrow, docsCardHtml: docsCardHtml,
        };
```

12. Run `node --test tests/station-view.test.js`. Both new tests pass, and the pre-existing `profileCard` tests are unaffected.

13. Wire it into `homePage()` — this depends on Task 11 having already moved the profile card, per this task's `Interfaces: Consumes`. First, build the flat list `docsCardHtml` reads, next to where `recent` is already built the same way. Replace:

File: `assets/station/station.js`
```js
        var recent = R.slice().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }).slice(0, 12);
```

with (still in `assets/station/station.js`):

```js
        var recent = R.slice().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }).slice(0, 12);
        var docsList = [].concat.apply([], S.projects.map(function (p) { return p.docs || []; }));
```

14. Then, in `assets/station/station.js`, put the card under 最近 sessions, both inside a new `.rcol` column so the two stack in the grid2's second slot. This is the post-Task-11 text — if Task 11 has not landed yet, this exact string is not there and the edit must wait. Replace:

```js
            + '<div class="grid2"><section class="panel">' + projectsHtml(projectRows(R, DAYS), o) + '</section>'
            + '<section class="panel">' + recentHtml(recent, o) + '</section></div>';
    }
```

with (still in `assets/station/station.js`):

```js
            + '<div class="grid2"><section class="panel">' + projectsHtml(projectRows(R, DAYS), o) + '</section>'
            + '<div class="rcol"><section class="panel">' + recentHtml(recent, o) + '</section>' + docsCardHtml(docsList, o) + '</div></div>';
    }
```

15. Sanity-check: `grep -n "docsList\|docsCardHtml(docsList" assets/station/station.js` should show both the new `var docsList` line and its use inside `homePage()`'s return.

16. Add the card's CSS. `.split`, `.split-h`, `.split-bar` and `.split-leg` already exist (the day panel uses them); `.claims` and `table.t` already exist too. Anchor on `.grid2`'s own rule, right before `.hero-top`. In `assets/station/station.css`, replace:

```css
.grid2{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:14px;align-items:start}
.grid2>.panel{margin-bottom:0}
.hero-top{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap}
```

with (still in `assets/station/station.css`):

```css
.grid2{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:14px;align-items:start}
.grid2>.panel{margin-bottom:0}
.rcol>.panel:last-child{margin-bottom:0}
.docs .dproj{border-top:1px solid var(--rule);margin-top:12px;padding-top:2px}
.docs .dproj:first-child{border-top:0;margin-top:0;padding-top:0}
.docs summary{list-style:none;cursor:pointer;display:flex;align-items:baseline;gap:10px;padding:12px 2px 10px;border-radius:6px}
.docs summary::-webkit-details-marker{display:none}
.docs summary::before{content:"";flex:0 0 auto;align-self:center;width:6px;height:6px;border-right:1.5px solid var(--muted);
  border-bottom:1.5px solid var(--muted);transform:rotate(-45deg);margin:0 3px 0 1px;transition:transform .15s ease-out}
.docs details[open]>summary::before{transform:rotate(45deg) translate(-1px,-1px)}
.docs summary:hover{background:var(--wash)}
.docs .nm{font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:8px}
.docs .when{color:var(--muted);font-size:12px;white-space:nowrap}
.dgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:26px;padding-bottom:6px}
.dsub{font-size:12px;color:var(--ink2);display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin:0 0 5px;font-weight:600}
.dsub .n{font:400 11px var(--f-mono);color:var(--muted)}
.hero-top{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap}
```

17. In `docs/station.md`, add the `**文件**` paragraph right after the stage-ledger paragraph and before `**清單**`. Replace:

```
and every group's heading says how many such sessions it has
and how many backward steps between them.

**清單** is the sortable table and a detail pane. Clicking a row fills the pane
```

with (still in `docs/station.md`):

```
and every group's heading says how many such sessions it has
and how many backward steps between them.

**文件** is a card on 首頁, one section per project whose `.fankeel/map.md`
exists: the registry root's own, plus `<root>/<project>/.fankeel/map.md` for
each project a session under that registry names — one section per file
found, and a project with none gets no section. It quotes what `map.js`
already computed rather than reading the tree itself (`lib/station.js`'s
`parseMapCard`): the document counts and their split by status,
`planned, not built`, `undeclared`, the filing table with each bucket's
role, and when the file was generated. It never runs a docs scan of its own,
and a registry with no project's map anywhere gets no card at all.

**清單** is the sortable table and a detail pane. Clicking a row fills the pane
```

18. In `docs/README.md`, add one line pointing at the card. Replace:

```
Eleven pages, one question each. The front page has install, update and
uninstall, the two diagrams and a short introduction to each of these;
everything that needs more than a paragraph is here.
```

with (still in `docs/README.md`):

```
Eleven pages, one question each. The front page has install, update and
uninstall, the two diagrams and a short introduction to each of these;
everything that needs more than a paragraph is here. For a person who is not
running a session, the station's home page turns each project's own
`.fankeel/map.md` into a 文件 card; see [station.md](station.md).
```

19. `node scripts/docs-check.js` must exit 0 — fix every citation it prints as having moved, in `docs/station.md` or any other page that cites `lib/station.js` or `assets/station/station.js` by line number.

20. Commit:

```
git commit -o lib/station.js assets/station/station.js assets/station/station.css docs/station.md docs/README.md tests/station.test.js tests/station-view.test.js -m "feat: 首頁新增「文件」卡，讀各專案已生成的 map.md"
git commit -o lib/station.js assets/station/station.js assets/station/station.css docs/station.md docs/README.md tests/station.test.js tests/station-view.test.js -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git commit -o lib/station.js assets/station/station.js assets/station/station.css docs/station.md docs/README.md tests/station.test.js tests/station-view.test.js -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

---

## Task 13: session 頁每一站多一列主迴圈

**Files:**
- Modify: `lib/detail.js` — `loopsOf(series, seq)`, a pure per-stage tally of the session's own requests, wired into `extract()`'s return as `.loops`; the cache `VERSION` bumps so every session is read once more to pick it up.
- Modify: `assets/station/station.js` — `costHtml` gains a second, optional `x` (the session's detail) and a 主迴圈 row per stage plus one in the footer; `sessionPage`'s cost tab passes `x` through.
- Modify: `assets/station/station.css` — the row's layout rules.
- Modify: `docs/station.md` — the 花費 paragraph gains a sentence about the row.
- Modify: `tests/detail-cache.test.js` — three assertions pin the cache `VERSION` literally; the bump in this task moves them from 3 to 4.
- Test: `tests/detail.test.js` — `loopsOf`.
- Test: `tests/station-view.test.js` — `costHtml`'s loop rows, and the artefact check: turn counts sum, and no stage's BUSY-and-over cost exceeds that stage's own total.
- Read: `lib/context.js` — `BUSY`, consumed rather than retyped.

**Interfaces:**
- Consumes: `BUSY` from `lib/context.js` (`400000`); `stageWhen`, `costSplit`, `KINDS` already defined in `lib/detail.js`.
- Produces: `loopsOf(series, seq)` exported from `lib/detail.js`; `extract()`'s return (and so `station/detail/<id>.js`, and `x` wherever a session's detail is loaded) carries `.loops`, an array of `{ stage, turns, over, overUsd }`.

**Dispatch:** implementer, sonnet — arithmetic already described by the design, wired through two files with a cache-version bump.

### Steps

1. Write the failing tests for the pure function, in `tests/detail.test.js`:

```js
test('loopsOf sums each stage\'s own requests, its BUSY-and-over turns and what they cost; a request before the first stage lands under stage null', () => {
    const { BUSY } = require('../lib/context.js');
    const seq = [{ stage: 'design', at: 0, source: 'cmd' }, { stage: 'build', at: 100, source: 'cmd' }];
    const tok = (n) => ({ input: n, output: n / 10, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
    const series = [
        { at: -10, model: 'claude-sonnet-5', context: 500, tokens: tok(10) },
        { at: 10, model: 'claude-sonnet-5', context: 1000, tokens: tok(20) },
        { at: 150, model: 'claude-sonnet-5', context: BUSY, tokens: tok(1000) },
        { at: 160, model: 'claude-sonnet-5', context: BUSY + 1, tokens: tok(2000) },
    ];
    const out = detail.loopsOf(series, seq);
    assert.deepEqual(out.map((r) => [r.stage, r.turns, r.over]), [[null, 1, 0], ['design', 1, 0], ['build', 2, 2]]);
    const build = out.find((r) => r.stage === 'build');
    assert.ok(build.overUsd > 0 && build.overUsd < 1, 'the two BUSY-and-over turns are priced, not zero and not runaway: ' + build.overUsd);
    assert.equal(out.reduce((n, r) => n + r.turns, 0), series.length, 'every request lands in exactly one row');
});

test('loopsOf prices nothing for a model the price table does not know, rather than crediting it as free', () => {
    const { BUSY } = require('../lib/context.js');
    const seq = [{ stage: 'build', at: 0, source: 'cmd' }];
    const out = detail.loopsOf(
        [{ at: 10, model: 'claude-nope', context: BUSY, tokens: { input: 1, output: 1, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } }],
        seq,
    );
    assert.deepEqual([out[0].over, out[0].overUsd], [1, 0]);
});
```

2. Run `node --test tests/detail.test.js`. Both new tests fail with `TypeError: detail.loopsOf is not a function`.

3. In `lib/detail.js`, add the `BUSY` import. Replace:

```js
const prices = require('./prices.js');
const registry = require('./registry.js');
```

with (still in `lib/detail.js`):

```js
const prices = require('./prices.js');
const { BUSY } = require('./context.js');
const registry = require('./registry.js');
```

4. In `lib/detail.js`, add `loopsOf`, right after `rowCost` and before `daysOf` — both `stageWhen` and `costSplit`/`KINDS` are already defined above this point in the file. Replace:

```js
// A dispatch row's cost per token kind, its priced models summed; null when
// none of them is priced.
function rowCost(models) {
    let out = null;
    for (const [id, m] of Object.entries(models || {})) {
        const c = costSplit(id, m);
        if (!c) continue;
        if (!out) out = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
        for (const k of KINDS) out[k] += c[k];
    }
    return out;
}

// One row per (day, stage, model, who), summed from single requests, so a
// session that runs past midnight is spent on both days. `calls` is every
```

with (still in `lib/detail.js`):

```js
// A dispatch row's cost per token kind, its priced models summed; null when
// none of them is priced.
function rowCost(models) {
    let out = null;
    for (const [id, m] of Object.entries(models || {})) {
        const c = costSplit(id, m);
        if (!c) continue;
        if (!out) out = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
        for (const k of KINDS) out[k] += c[k];
    }
    return out;
}

// One row per stage: how many of the session's own requests it held, how
// many already carried `BUSY` tokens or more, and what those turns cost — the
// same `series` `daysOf` folds by day, grouped by stage alone this time, so a
// session page can show stage by stage where the context-handoff gate
// (`lib/context.js`'s `contextLine`) would have fired. `series` and `seq` are
// `extract()`'s own, so nothing here reads the transcript a second time, and
// no new field is recorded on the entry — this is derived, the way `days` is.
function loopsOf(series, seq) {
    const by = new Map();
    for (const r of series || []) {
        const stage = stageWhen(seq, r.at);
        if (!by.has(stage)) by.set(stage, { stage, turns: 0, over: 0, overUsd: 0 });
        const row = by.get(stage);
        row.turns += 1;
        if (r.context >= BUSY) {
            row.over += 1;
            const c = costSplit(r.model, r.tokens);
            row.overUsd += c ? KINDS.reduce((n, k) => n + c[k], 0) : 0;
        }
    }
    return [...by.values()];
}

// One row per (day, stage, model, who), summed from single requests, so a
// session that runs past midnight is spent on both days. `calls` is every
```

5. In `lib/detail.js`, wire it into `extract()`'s return, and bump the cache version so every existing cache is read once more to pick up the new field. Replace:

```js
        days: daysOf(calls, seq), spans, waits,
```

with (still in `lib/detail.js`):

```js
        days: daysOf(calls, seq), spans, waits,
        loops: loopsOf(series, seq),
```

Then, in `lib/detail.js`, replace:

```js
const VERSION = 3;
```

with (still in `lib/detail.js`):

```js
const VERSION = 4;
```

6. In `lib/detail.js`, export `loopsOf`. Replace:

```js
module.exports = {
    statements, taskCalls, stageCommands, stageSequence, backtracksOf, largestRemainder,
    contextPoints, arrivals, risesOf, tasksOf, cachePath, transcriptOf, keyOf, detailOf, dayOf,
};
```

with (still in `lib/detail.js`):

```js
module.exports = {
    statements, taskCalls, stageCommands, stageSequence, backtracksOf, largestRemainder,
    contextPoints, arrivals, risesOf, tasksOf, cachePath, transcriptOf, keyOf, detailOf, dayOf,
    loopsOf,
};
```

7. Run `node --test tests/detail.test.js`. Both new tests pass.

8. The `VERSION` bump reddens three existing, unrelated assertions. Run `node --test tests/detail-cache.test.js`. Two tests fail: `'a cache from an older VERSION is read again while the transcript is there...'` (expects `got.detail.v` to be `3`, it is now `4`) and `'a VERSION 2 cache, written before gate questions carried their labels, is read again even when its key still matches'` (same). A third assertion in the first test, `assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).v, 3, ...)`, fails the same way.

9. In `tests/detail-cache.test.js`, fix the three literals. Replace:

```js
    const got = detail.detailOf(f.cfg, SID, ended);
    assert.deepEqual([got.fresh, got.detail.v, Array.isArray(got.detail.days)], [true, 3, true]);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).v, 3, 'the cache is rewritten at the new version');
```

with (still in `tests/detail-cache.test.js`):

```js
    const got = detail.detailOf(f.cfg, SID, ended);
    assert.deepEqual([got.fresh, got.detail.v, Array.isArray(got.detail.days)], [true, 4, true]);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).v, 4, 'the cache is rewritten at the new version');
```

and, in `tests/detail-cache.test.js`, replace:

```js
test('a VERSION 2 cache, written before gate questions carried their labels, is read again even when its key still matches', () => {
    const f = setup();
    oldCache(f, { v: 2, key: detail.keyOf(f.t), at: Date.parse(T(30)) });
    const got = detail.detailOf(f.cfg, SID, f.data);
    assert.deepEqual([got.fresh, got.detail.v], [true, 3]);
});
```

with (still in `tests/detail-cache.test.js`):

```js
test('a VERSION 2 cache, written before gate questions carried their labels, is read again even when its key still matches', () => {
    const f = setup();
    oldCache(f, { v: 2, key: detail.keyOf(f.t), at: Date.parse(T(30)) });
    const got = detail.detailOf(f.cfg, SID, f.data);
    assert.deepEqual([got.fresh, got.detail.v], [true, 4]);
});
```

10. Run `node --test tests/detail-cache.test.js`. All pass.

11. Write the failing tests for the row and the artefact check, in `tests/station-view.test.js` (`dayRow` is already defined near the top of this file, reused as-is):

```js
test('costHtml gains a 主迴圈 row per stage from x.loops, and the row rendered proves two things: turns sum to the page\'s total, and no stage\'s BUSY-and-over cost exceeds that stage\'s own total', () => {
    const days = [
        dayRow('2026-09-14', 'survey', 'claude-sonnet-5', 'main', 1, 100),
        dayRow('2026-09-14', 'build', 'claude-sonnet-5', 'main', 2, 1000),
        dayRow('2026-09-14', 'build', 'claude-opus-5', 'agent', 1, 500),
        dayRow('2026-09-14', 'verify', 'claude-sonnet-5', 'main', 2, 800),
    ];
    const m = V.costModel(days);
    const x = { loops: [
        { stage: 'survey', turns: 4, over: 0, overUsd: 0 },
        { stage: 'build', turns: 5, over: 2, overUsd: 0.5 },
        { stage: 'verify', turns: 3, over: 3, overUsd: 1.2 },
    ] };
    const html = V.costHtml(m, x);
    const blocks = html.split('<tfoot>')[0].split('<tr class="sub">').slice(1);
    assert.equal(blocks.length, 3, 'one block per stage in m.stages, survey/build/verify in route order');
    const toNum = (s) => (s === '—' ? 0 : Number(s.replace(/[$,]/g, '')));
    let sumTurns = 0;
    blocks.forEach((b) => {
        const subRow = b.slice(0, b.indexOf('</tr>'));
        const cells = [...subRow.matchAll(/<td class="r[^"]*">(\$[\d.,]+|—)<\/td>/g)];
        const stageUsd = toNum(cells[cells.length - 1][1]);
        const turns = Number(b.match(/<span><b>(\d+)<\/b>回合<\/span>/)[1]);
        const overUsd = toNum(b.match(/<b>(\$[\d.,]+|—)<\/b>那些回合/)[1]);
        sumTurns += turns;
        assert.ok(overUsd <= stageUsd + 1e-9, 'a stage\'s BUSY-and-over cost does not exceed its own total: ' + overUsd + ' vs ' + stageUsd);
    });
    const foot = html.split('<tfoot>')[1];
    const footTurns = Number(foot.match(/<span><b>(\d+)<\/b>回合<\/span>/)[1]);
    assert.equal(sumTurns, footTurns, 'the per-stage turn counts sum to the page\'s total main-loop turn count');
    assert.equal(footTurns, 4 + 5 + 3);
    assert.match(blocks[0], /<span class="zero"><b>0<\/b>回合 ≥ 400k<\/span>/, 'a stage with no BUSY-and-over turn is styled zero');
    assert.match(blocks[0], /<span class="zero"><b>—<\/b>那些回合<\/span>/, 'and its dollar figure is a dash, not $0.00');
});

test('costHtml with no detail loaded yet renders no 主迴圈 row and no stray NaN or undefined', () => {
    const m = V.costModel([dayRow('2026-09-14', 'build', 'claude-sonnet-5', 'main', 1, 100)]);
    const html = V.costHtml(m);
    assert.doesNotMatch(html, /主迴圈|NaN|undefined/);
});
```

12. Run `node --test tests/station-view.test.js`. The first new test fails — the `回合` span match returns `null` because no loop row exists yet, so reading `[1]` off it throws `TypeError: Cannot read properties of null`. The second new test already passes (there is no `主迴圈` text to find either way), which is expected — it exists to stay green through the next step, not to redden now.

13. In `assets/station/station.js`, add the row-rendering helpers and change `costHtml`'s signature. Replace:

```js
    function costHtml(m) {
        var KINDS = [['input', 'input', '--t-in'], ['output', 'output', '--t-out'], ['cacheRead', 'cache read', '--t-cr'],
            ['cacheWrite', 'cache write', '--t-cw']];
        var cells = function (a, cls) {
            return KINDS.map(function (k) {
                return '<td class="r muted">' + tokens(a.tokens[k[0]]) + '</td><td class="r">' + usd(a.cost[k[0]]) + '</td>';
            }).join('') + '<td class="r' + (cls ? ' ' + cls : '') + '">' + usd(a.usd) + '</td>';
        };
        var share = function (v) { return m.total.usd ? Math.round(v / m.total.usd * 1000) / 10 + '%' : '—'; };
        var allTok = KINDS.reduce(function (n, k) { return n + m.total.tokens[k[0]]; }, 0);
        return '<div class="sumline"><div>合計花費<b>' + usd(m.total.usd) + '</b></div><div>主 session<b>' + usd(m.main.usd) + '</b></div>'
            + '<div>派工（agent + workflow）<b>' + usd(m.agent.usd) + '</b></div><div>output 佔花費<b>' + share(m.total.cost.output) + '</b></div>'
            + '<div>cache read 佔 token<b>' + (allTok ? Math.round(m.total.tokens.cacheRead / allTok * 1000) / 10 + '%' : '—') + '</b></div></div>'
            + '<div class="h2">stage × model <small>token 與各自的 USD；stage 列是小計</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th rowspan="2">stage</th><th rowspan="2">model · 佔 session</th>'
            + KINDS.map(function (k) { return '<th colspan="2"><i class="sw" style="background:var(' + k[2] + ')"></i> ' + k[1] + '</th>'; }).join('')
            + '<th rowspan="2" class="r">USD</th></tr><tr>'
            + KINDS.map(function () { return '<th class="r">token</th><th class="r">USD</th>'; }).join('') + '</tr></thead><tbody>'
            + m.stages.map(function (g) {
                return '<tr class="sub"><td><span class="pchip"><i class="sw" style="background:' + colorOf('stage', g.stage) + '"></i>'
                    + esc(g.stage === 'none' ? '第一步之前' : g.stage) + '</span></td><td class="muted">' + share(g.sub.usd) + '</td>'
                    + cells(g.sub, '') + '</tr>' + g.models.map(function (x) {
                        return '<tr class="child"><td></td><td><span class="pchip"><i class="sw" style="background:var(--m-' + family(x.model)
                            + ')"></i>' + esc(String(x.model).replace(/^claude-/, '')) + '</span></td>' + cells(x.cell, '') + '</tr>';
                    }).join('');
            }).join('') + '</tbody><tfoot>'
            + '<tr><td>主 session</td><td></td>' + cells(m.main, 'total') + '</tr>'
            + '<tr><td>agent</td><td></td>' + cells(m.agent, 'total') + '</tr>'
            + '<tr><td>合計</td><td></td>' + cells(m.total, 'total') + '</tr></tfoot></table></div>';
    }
```

with (still in `assets/station/station.js`):

```js
    // One 主迴圈 row's arithmetic: how many of the session's own requests a
    // stage held, how many already carried `BUSY` tokens or more, what those
    // turns cost, and their share of the stage's own total (main and agents
    // alike — the same total the sub row's own last cell already prints).
    // `lp` is one row of `x.loops`, or `null` for a stage no main request
    // landed in; `usd()` already prints a dash for a zero dollar figure.
    function loopRow(lp, stageUsd) {
        lp = lp || { turns: 0, over: 0, overUsd: 0 };
        var pct = stageUsd ? lp.overUsd / stageUsd * 100 : 0;
        var z = lp.over === 0;
        return '<tr class="loop"><td></td><td><span class="lp">主迴圈</span></td><td colspan="8"><div class="lf">'
            + '<span><b>' + lp.turns + '</b>回合</span>'
            + '<span' + (z ? ' class="zero"' : '') + '><b>' + lp.over + '</b>回合 ≥ 400k</span>'
            + '<span' + (z ? ' class="zero"' : '') + '><b>' + usd(lp.overUsd) + '</b>那些回合</span>'
            + '<span' + (z ? ' class="zero"' : '') + '><i class="mini" style="display:inline-flex;width:72px;vertical-align:middle;margin-right:8px">'
            + '<span style="width:' + Math.round(pct) + '%"></span></i><b>' + Math.round(pct) + '%</b>佔這一站</span>'
            + '</div></td><td class="r"></td></tr>';
    }
    function sumLoops(loops) {
        return (loops || []).reduce(function (a, r) {
            return { turns: a.turns + r.turns, over: a.over + r.over, overUsd: a.overUsd + r.overUsd };
        }, { turns: 0, over: 0, overUsd: 0 });
    }
    // `x` is the session's detail (as everywhere else on this page — see
    // `sessionHeadHtml(s, x)`, `ctxSection(s, x)`) — optional, since the cost
    // tab answers before the detail script has loaded. With none, no 主迴圈
    // row is drawn: `x.loops` is what `lib/detail.js`'s `loopsOf` computed,
    // and there is nothing to show before it arrives.
    function costHtml(m, x) {
        var KINDS = [['input', 'input', '--t-in'], ['output', 'output', '--t-out'], ['cacheRead', 'cache read', '--t-cr'],
            ['cacheWrite', 'cache write', '--t-cw']];
        var cells = function (a, cls) {
            return KINDS.map(function (k) {
                return '<td class="r muted">' + tokens(a.tokens[k[0]]) + '</td><td class="r">' + usd(a.cost[k[0]]) + '</td>';
            }).join('') + '<td class="r' + (cls ? ' ' + cls : '') + '">' + usd(a.usd) + '</td>';
        };
        var share = function (v) { return m.total.usd ? Math.round(v / m.total.usd * 1000) / 10 + '%' : '—'; };
        var allTok = KINDS.reduce(function (n, k) { return n + m.total.tokens[k[0]]; }, 0);
        var loops = x && Array.isArray(x.loops) ? x.loops : null;
        var loopBy = {};
        (loops || []).forEach(function (r) { loopBy[r.stage === null ? 'none' : r.stage] = r; });
        return '<div class="sumline"><div>合計花費<b>' + usd(m.total.usd) + '</b></div><div>主 session<b>' + usd(m.main.usd) + '</b></div>'
            + '<div>派工（agent + workflow）<b>' + usd(m.agent.usd) + '</b></div><div>output 佔花費<b>' + share(m.total.cost.output) + '</b></div>'
            + '<div>cache read 佔 token<b>' + (allTok ? Math.round(m.total.tokens.cacheRead / allTok * 1000) / 10 + '%' : '—') + '</b></div></div>'
            + '<div class="h2">stage × model <small>token 與各自的 USD；stage 列是小計</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th rowspan="2">stage</th><th rowspan="2">model · 佔 session</th>'
            + KINDS.map(function (k) { return '<th colspan="2"><i class="sw" style="background:var(' + k[2] + ')"></i> ' + k[1] + '</th>'; }).join('')
            + '<th rowspan="2" class="r">USD</th></tr><tr>'
            + KINDS.map(function () { return '<th class="r">token</th><th class="r">USD</th>'; }).join('') + '</tr></thead><tbody>'
            + m.stages.map(function (g) {
                return '<tr class="sub"><td><span class="pchip"><i class="sw" style="background:' + colorOf('stage', g.stage) + '"></i>'
                    + esc(g.stage === 'none' ? '第一步之前' : g.stage) + '</span></td><td class="muted">' + share(g.sub.usd) + '</td>'
                    + cells(g.sub, '') + '</tr>' + g.models.map(function (mm) {
                        return '<tr class="child"><td></td><td><span class="pchip"><i class="sw" style="background:var(--m-' + family(mm.model)
                            + ')"></i>' + esc(String(mm.model).replace(/^claude-/, '')) + '</span></td>' + cells(mm.cell, '') + '</tr>';
                    }).join('') + (loops ? loopRow(loopBy[g.stage], g.sub.usd) : '');
            }).join('') + '</tbody><tfoot>'
            + '<tr><td>主 session</td><td></td>' + cells(m.main, 'total') + '</tr>'
            + '<tr><td>agent</td><td></td>' + cells(m.agent, 'total') + '</tr>'
            + '<tr><td>合計</td><td></td>' + cells(m.total, 'total') + '</tr>'
            + (loops ? loopRow(sumLoops(loops), m.total.usd) : '') + '</tfoot></table></div>';
    }
```

14. Run `node --test tests/station-view.test.js`. Both new tests pass, and the four pre-existing `costModel`/`costHtml` tests (which call `V.costHtml(m)` with no second argument) still pass unchanged — `loops` is `null` there, so no 主迴圈 row is drawn and nothing in their assertions depended on one.

15. Wire `x` through to the one call site, in `sessionPage()` — below the file's `if (!doc) return;` guard, so this cannot be driven from `node --test`; verify it by reading the diff and by `grep -n "costHtml(costModel" assets/station/station.js`, which must show the two-argument form. Replace:

File: `assets/station/station.js`
```js
        var body = r.tab === 'cost' ? costHtml(costModel(s.days))
```

with (still in `assets/station/station.js`):

```js
        var body = r.tab === 'cost' ? costHtml(costModel(s.days), x)
```

16. Add the row's CSS, anchored next to the other `.t tr.*` rules. `.mini` already exists (the progress-bar class `routeLedger` and the detail panel already use) and is reused here inline. In `assets/station/station.css`, replace:

```css
.t tr.sub td{background:var(--wash);font-weight:600}
.t tr.child td:first-child{padding-left:26px}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:1px 7px 1px 5px;border-radius:5px;background:var(--inset);color:var(--ink2);white-space:nowrap}
```

with (still in `assets/station/station.css`):

```css
.t tr.sub td{background:var(--wash);font-weight:600}
.t tr.child td:first-child{padding-left:26px}
.t tr.loop td{background:var(--wash);padding-top:6px;padding-bottom:6px}
.t tr.loop td:first-child{box-shadow:inset 2px 0 0 var(--ind)}
.t tfoot tr.loop td{border-top:1px solid var(--rule2)}
.lp{font:600 11.5px var(--f-ui);color:var(--ind);white-space:nowrap}
.lf{display:flex;flex-wrap:wrap;gap:4px 18px;align-items:center;font-size:12px;color:var(--ink2);font-weight:400}
.lf b{font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums;margin-right:4px}
.lf .zero b{color:var(--muted);font-weight:400}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:1px 7px 1px 5px;border-radius:5px;background:var(--inset);color:var(--ink2);white-space:nowrap}
```

17. In `docs/station.md`, add a sentence to the 花費 paragraph. Replace:

```
A model the price table does not know gives
its rows `cost: null` and `usd: null`: no figure, rather than a zero.
```

with (still in `docs/station.md`):

```
A model the price table does not know gives
its rows `cost: null` and `usd: null`: no figure, rather than a zero. Each
stage also carries a 主迴圈 row: how many of the session's own requests it
held, how many already carried `BUSY` tokens or more (`lib/context.js`, not
retyped here), what those turns cost, and their share of the stage's own
total — from `lib/detail.js`'s `loopsOf()`, computed from the same
per-request series `days` is folded from rather than a new recorded field. A
stage with no such turn shows the count and a dash rather than a zero dollar
figure.
```

18. `node scripts/docs-check.js` must exit 0 — fix every citation it prints as moved, in `docs/station.md` or elsewhere, before committing.

19. Commit:

```
git commit -o lib/detail.js assets/station/station.js assets/station/station.css docs/station.md tests/detail.test.js tests/detail-cache.test.js tests/station-view.test.js -m "feat: session 頁每站加主迴圈列：回合數、400k 以上回合的花費與佔比"
git commit -o lib/detail.js assets/station/station.js assets/station/station.css docs/station.md tests/detail.test.js tests/detail-cache.test.js tests/station-view.test.js -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git commit -o lib/detail.js assets/station/station.js assets/station/station.css docs/station.md tests/detail.test.js tests/detail-cache.test.js tests/station-view.test.js -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

## Task 14: `docs-check` validates a link's `#fragment` against the target's headings

**Files:**
- Modify: `scripts/docs-check.js` — the `LINK` regex captures the fragment; the
  link-checking loop in `checkDoc` resolves it against the target file's
  headings when the target is markdown; a new `headingSlugs(root, rel)`
  helper computes GitHub-style slugs
- Modify: `tests/docs-check.test.js` — three new fixtures this task adds
- Modify: `docs/documents.md` — the *A path that needs checking goes in a
  link* paragraph gains one sentence on fragment checking
- Test: `tests/docs-check.test.js`

**Interfaces:**
- Consumes: none
- Produces: `headingSlugs(root, rel)` in `scripts/docs-check.js`, returning a
  `Set<string>` of every heading's slug in that file, memoised per
  `root + '\0' + rel` the same way `linesOf` is — not consumed by any other
  task in this plan

**Dispatch:** implementer, sonnet — a regex change, a slug algorithm, three
fixtures and one doc sentence.

Today, `docs-check.js:37`'s `LINK` regex is
`/\[[^\]]*\]\(([^)\s#]+)(?:#[^)\s]*)?\)/g` — the fragment after `#` is matched
by a *non-capturing* group and thrown away, so a link's anchor is never
checked at all; only whether the path before `#` resolves. The task is to
capture that fragment, and — where the target resolves and is itself a `.md`
file — check it against the target's own headings, slugged the way GitHub
does it: lowercase; punctuation dropped, but CJK characters and any other
letters or digits kept, along with `-` and `_`; each space becomes its own
`-` (not collapsed — two adjacent spaces make two hyphens, confirmed below
against a citation already in this repository); a heading repeated in the
same document gets `-1`, `-2`, `-3` in the order it appears; heading markup —
backticks, a link's own `[text](url)`, `*`/`_`-style emphasis — is reduced to
its plain text before slugging.

A failure is reported exactly like an existing dead link — same `tag: 'gone'`,
same line — so it shows or hides under the same `--role` rule other dead
links already do.

### Step 1 — the failing tests

In `tests/docs-check.test.js`, after the last existing `test(...)` block
(the range-citation tests at the end of the file), add:

```js
test('a fragment into a CJK heading resolves', () => {
  const root = repoWith('fankeel-docscheck-frag-cjk-', {
    'docs/README.md': '# index\n',
    'docs/target.md': '# 索引\n\n## 你好，世界\n\ntext\n',
    'docs/page.md': 'See [target](target.md#你好世界).\n',
  });
  const gone = scan(root, []).findings.filter((f) => f.tag === 'gone');
  assert.equal(gone.length, 0);
});

test('a bad fragment into a real page is reported the same way a dead link is', () => {
  const root = repoWith('fankeel-docscheck-frag-bad-', {
    'docs/README.md': '# index\n',
    'docs/target.md': '# index\n\n## Real Heading\n\ntext\n',
    'docs/page.md': 'See [target](target.md#not-a-real-heading).\n',
  });
  const gone = scan(root, []).findings.filter((f) => f.tag === 'gone');
  assert.equal(gone.length, 1);
  assert.equal(gone[0].tag, 'gone');
  assert.match(gone[0].what, /links to target\.md#not-a-real-heading/);
});

test('a heading repeated in one document resolves its second copy at -1', () => {
  const root = repoWith('fankeel-docscheck-frag-dup-', {
    'docs/README.md': '# index\n',
    'docs/target.md': '# index\n\n## Notes\n\nfirst\n\n## Notes\n\nsecond\n',
    'docs/page.md': 'See [again](target.md#notes-1).\n',
  });
  const gone = scan(root, []).findings.filter((f) => f.tag === 'gone');
  assert.equal(gone.length, 0);
});
```

These use the file's own `repoWith(prefix, files)` helper (already defined
above the range-citation tests), which `git init`s a fixture repo with a
`flat` tree declaring `docs` as `reference`.

### Step 2 — run it and watch it fail

```
node --test tests/docs-check.test.js
```

The second test (`a bad fragment...`) fails: `gone.length` is `0`, not `1`,
because today nothing reads the fragment at all. The first and third pass
already — with no fragment check, a resolving link is never reported wrong,
which is exactly why the middle case is the one carrying the assertion this
task exists for.

### Step 3 — the implementation

In `scripts/docs-check.js`, the `LINK` regex declaration:

```js
const LINK = /\[[^\]]*\]\(([^)\s#]+)(?:#[^)\s]*)?\)/g;
```

becomes, capturing the fragment as group 2 (including its leading `#`):

File: `scripts/docs-check.js`
```js
const LINK = /\[[^\]]*\]\(([^)\s#]+)(#[^)\s]*)?\)/g;
```

Directly below `function lineCount(root, rel) { ... }` and above the
`// Resolve a reference the way a reader would...` comment, add:

File: `scripts/docs-check.js`
```js
// A link's `#fragment` into another `.md` file, checked the way GitHub slugs
// a heading: lowercase, punctuation dropped (CJK and other letters and
// digits kept, along with `-` and `_`), each space becoming its own `-` —
// not collapsed, which is why `docs/documents.md:288`'s own citation carries
// a double hyphen (an em dash between two words drops, leaving both spaces
// around it) — and a heading repeated in the same document getting `-1`,
// `-2` in the order it appears. Heading markup — backticks, a link's own
// `[text](url)`, emphasis — is reduced to its text first, so a heading like
// `` `todo-check.js` — whether `TODO.md` is still an index `` slugs the same
// as the plain words would.
const HEADINGS = new Map();
function headingSlugs(root, rel) {
    const key = root + '\0' + rel;
    if (HEADINGS.has(key)) return HEADINGS.get(key);
    const text = readFile(root, rel);
    const slugs = new Set();
    if (text !== null) {
        const blanked = withoutFences(text).text;
        const seen = new Map();
        for (const line of blanked.split('\n')) {
            const h = /^#{1,6}\s+(.*)$/.exec(line);
            if (!h) continue;
            const raw = h[1].replace(/\s+#+\s*$/, '').trim();
            const stripped = raw
                .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
                .replace(/`+/g, '')
                .replace(/(\*\*\*|\*\*|\*|___|__|_)/g, '');
            let slug = '';
            for (const ch of stripped.toLowerCase()) {
                if (ch === ' ') slug += '-';
                else if (/[\p{L}\p{N}_-]/u.test(ch)) slug += ch;
            }
            const n = seen.get(slug) || 0;
            seen.set(slug, n + 1);
            slugs.add(n === 0 ? slug : slug + '-' + n);
        }
    }
    HEADINGS.set(key, slugs);
    return slugs;
}
```

Then, in `checkDoc`, the link-checking loop:

File: `scripts/docs-check.js`
```js
    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(linkText)) !== null) {
        const ref = m[1];
        if (external(ref)) continue;
        if (resolveRef(root, rel, ref) === null) {
            out.push({ file: rel, line: linkLineOf(m.index), tag: 'gone', what: 'links to ' + ref });
        }
    }
```

becomes:

File: `scripts/docs-check.js`
```js
    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(linkText)) !== null) {
        const ref = m[1];
        const fragment = m[2];
        if (external(ref)) continue;
        const target = resolveRef(root, rel, ref);
        if (target === null) {
            out.push({ file: rel, line: linkLineOf(m.index), tag: 'gone', what: 'links to ' + ref + (fragment || '') });
            continue;
        }
        if (fragment && isMarkdown(target) && !headingSlugs(root, target).has(fragment.slice(1))) {
            out.push({ file: rel, line: linkLineOf(m.index), tag: 'gone', what: 'links to ' + ref + fragment });
        }
    }
```

Finally, the export line:

File: `scripts/docs-check.js`
```js
module.exports = { scan, report, parseArgs, resolveRef, LINK, CODE, PATHISH, external, readFile, isMarkdown };
```

becomes:

File: `scripts/docs-check.js`
```js
module.exports = { scan, report, parseArgs, resolveRef, headingSlugs, LINK, CODE, PATHISH, external, readFile, isMarkdown };
```

### Step 4 — run it and watch it pass

```
node --test tests/docs-check.test.js
```

All three new tests pass, and none of the file's existing tests changed
verdict — `LINK`'s group-1 capture (`ref`) is unchanged, only a second group
was added, and the `'gone'`-on-`target === null` branch is the same check the
old code made before the `continue` was added.

### Step 5 — the ten links already in this repository

Before writing the doc sentence, confirm the fragment check does not turn
green code red across the tree. List every markdown-to-markdown fragment link
outside `docs/archive/`:

```bash
git ls-files '*.md' | xargs grep -no '\]([^)]*\.md#[^)]*)' | grep -v '^docs/archive/'
```

This prints exactly ten lines:

```
TODO.md:133:](docs/improvement-brief.md#27-多平台交付sepia-的做法便宜得多)
TODO.md:135:](docs/improvement-brief.md#41-design-階段的-mockup-步驟前端任務)
docs/decisions/2026-09-05-skill-split-design.md:43:](https://code.claude.com/docs/en/skills.md#add-supporting-files)
docs/decisions/fankeel-shell.md:341:](../improvement-brief.md#65-ponytail-去依賴)
docs/documents.md:288:](development.md#todo-checkjs--whether-todomd-is-still-an-index)
docs/judgements/2026-09-11-todo-split.md:98:](docs/improvement-brief.md#64-caveman-去依賴)
docs/judgements/2026-09-11-todo-split.md:99:](docs/improvement-brief.md#61-memory-清理)
docs/judgements/2026-09-11-todo-split.md:100:](docs/improvement-brief.md#62-session-堆疊)
docs/judgements/2026-09-11-todo-split.md:101:](docs/improvement-brief.md#63-station-單-session)
docs/judgements/2026-09-11-todo-split.md:105:](docs/improvement-brief.md#65-ponytail-去依賴)
```

Judge each by hand against `headingSlugs()`'s rule:

- The `decisions/2026-09-05-skill-split-design.md:43` one targets
  `https://code.claude.com/…` — an external URL, already skipped by
  `external()` before the fragment is ever read. Not a repo-internal link;
  out of scope for this check either way.
- The other nine all target headings inside `docs/improvement-brief.md` or
  `docs/development.md`. Slugging each target heading by hand (lowercase,
  drop `.`/`（`/`）`/`—`/`` ` ``, keep CJK, spaces to `-`) reproduces the
  fragment already written on every one of the nine — including
  `docs/documents.md:288`'s `todo-checkjs--whether-todomd-is-still-an-index`,
  whose double hyphen is the em dash between `` `todo-check.js` `` and
  `whether` dropping out from between two un-collapsed spaces, and
  `TODO.md:135`'s `41-design-階段的-mockup-步驟前端任務`, whose full-width
  parentheses around `前端任務` drop without leaving a hyphen since neither
  had a space next to it.

All nine resolve. Nothing here is genuinely broken and no link needs fixing —
this step is a record that the rule was checked against real citations before
being declared done, not a set of fixes.

Run the full check once fragment-checking is live:

```
node scripts/docs-check.js
```

Expect exit 0, "Every reference resolves."

### Step 6 — the doc sentence

In `docs/documents.md`, the *What a document says about itself* section's
paragraph beginning `**A path that needs checking goes in a link.**`:

```
unchanged. What is never read is a bare path, in either place, and the markup
rather than the place is the whole of it. How much of a link or a span is acted
on is the role's again: a reference page has both checked;
```

becomes:

```
unchanged. What is never read is a bare path, in either place, and the markup
rather than the place is the whole of it. A link into another `.md` file that
carries a `#fragment` is checked against that file's own headings, slugged the
way GitHub does it — lowercase, punctuation dropped (CJK and other letters and
digits kept, along with `-` and `_`), each space its own `-`, and a heading
repeated in the same document getting `-1`, `-2`. How much of a link or a span
is acted on is the role's again: a reference page has both checked;
```

### Step 7 — commit

```
git commit -o scripts/docs-check.js tests/docs-check.test.js docs/documents.md -m "feat: docs-check 驗 path#fragment 的錨點"
git commit -o scripts/docs-check.js tests/docs-check.test.js docs/documents.md -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git commit -o scripts/docs-check.js tests/docs-check.test.js docs/documents.md -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

---

## Task 15: three facts each get one source page instead of two

**Files:**
- Modify: `docs/development.md` — the *release number* paragraph's disputed
  count is dropped, replaced by a link to the test that counts it
- Modify: `docs/pipeline.md` — the duplicated `design-intent` clause is
  replaced by a link to the page that keeps it
- Modify: `docs/station.md` — the duplicated bucketing-tie-break definition
  is replaced by a link to the page that keeps it
- Read: `tests/contract.test.js` — the true count this task establishes and
  leaves alone
- Read: `scripts/version.js` — what actually enforces the count, read to
  confirm the true population before touching either page
- Read: `skills/fankeel-audit/rationale.md` — keeps the `design-intent`
  clause; not edited
- Read: `docs/registry.md` — keeps the bucketing tie-break definition; not
  edited
- Test: none — no code changes; `docs-check` and a set of greps are the gate

**Interfaces:**
- Consumes: none
- Produces: nothing

**Dispatch:** implementer, sonnet — three small prose edits and the greps
that prove each fact stopped being stated twice.

`git show 728dd76` is the commit that filed all three (message: "development.md:79
的十 vs contract.test.js:256 的十二、pipeline.md:985 與 fankeel-audit/rationale.md:65
一段 25 字逐字複製、registry.md:246 與 station.md:287 都講完整 spend 的分桶規則").
`docs/decisions/2026-09-18-todo-six.md`'s §五 is the fuller record: the
`development.md` vs `contract.test.js` pair is "同一則軼事兩套算法（skills−1 對
檔案數−1，差兩份 manifest）" — two different counting bases for the same
miss-one-edit anecdote, not one side simply wrong.

**A correction to the proof this task was assigned with, found while drafting
it — read before writing the steps below.** `node scripts/docs-audit.js`'s
"pairs" list is built from files each page *names* (`source_of_truth`, a
link, a code span) — `scripts/docs-audit.js:541-559`'s `pairs` map keys on
`holders[i] + holders[j]` and pushes onto `pair.shared` every `target` (a code
file) both pages name; nothing there reads sentences. Running
`node -e "require('./scripts/docs-audit.js').sweep(process.cwd())"` and
filtering its `.overlaps` for these three pages today shows:

```
docs/registry.md  x  docs/station.md  (lib/detail.js, lib/live.js, hooks/leave.js, lib/station.js, scripts/station.js, lib/usage.js)
docs/pipeline.md  x  skills/fankeel-audit/rationale.md  (scripts/residue.js)
```

— `docs/development.md` × `tests/contract.test.js` is not in that list at
all, because `tests/contract.test.js` is not a documented page `sweep()` ever
looks at; `git show 728dd76`'s wording only says this pair was noticed while
a reader read `development.md` against its real pairs. And the two pairs that
are real ones share files (`scripts/residue.js`; six files including
`lib/usage.js`) that have nothing to do with the one duplicated sentence each
pair actually was — `scripts/residue.js` is named in both pages'
`source_of_truth` for unrelated reasons, and the six shared files between
`registry.md`/`station.md` cover the whole `spend`/`usage` topic, not just
the bucketing tie-break. **Editing prose never changes `source_of_truth` or
removes a code citation, so none of this task's edits removes any of these
three pairs from `docs-audit`'s output — that list will print the same shared
files before and after.** The proof below checks what this task actually
changes instead: that the duplicated fact is gone from the linking page and
still stated once on the source page, and that `docs-check` still resolves
every link. Say this plainly to whoever reviews the task so "pairs still
listed" is not read as a failed fix.

### Step 1 — the check that proves the current state

```bash
grep -n "right in ten places" docs/development.md
grep -n "twelve" tests/contract.test.js
```

Expect: `docs/development.md:79` (or wherever the line has moved to since
`51e4a5f` — anchor on the text, not the number) prints `the plugin is not —
right in ten places, which is how it went unnoticed.`; `tests/contract.test.js`
prints its own comment naming `twelve`. Two different counts for one
miss-one-edit anecdote — that mismatch, not a wrong number on either side, is
what this task removes.

```bash
grep -n "is not judged at all" docs/pipeline.md skills/fankeel-audit/rationale.md
grep -n "holding its \*\*last\*\* line" docs/registry.md docs/station.md
```

Expect both greps to print a near-identical clause in both named files —
confirming the duplication before editing.

### Step 2 — pair (a): `docs/development.md`

`tests/contract.test.js:262`'s test (`'every file that carries the version
carries the same one'`) is what enforces the count — `found.size === 13` at
line 280 — and `scripts/version.js`'s `MANIFESTS` (2 entries) plus
`skillFiles()` (globbed, currently 11) is what `readAll()` sums to reach it.
The count stays there; `docs/development.md` stops repeating it.

In `docs/development.md`, the `` `version.js` `` section:

```
`chore: <x.y.z>`, which is what a release contains. `npm test` fails when the thirteen
disagree, so the script is what makes them agree rather than what notices. A
release used to be eleven edits, and missing one left a skill announcing a version
the plugin is not — right in ten places, which is how it went unnoticed.
```

becomes:

```
`chore: <x.y.z>`, which is what a release contains. `npm test` fails when the thirteen
disagree, so the script is what makes them agree rather than what notices. A
release used to be eleven edits, and missing one left a skill announcing a version
the plugin is not, unnoticed until [`tests/contract.test.js`](../tests/contract.test.js)
started running — its comment carries the count now, not this page.
```

### Step 3 — pair (b): `docs/pipeline.md`

`skills/fankeel-audit/rationale.md:65-67` is the rule's home — it is the
`fankeel-audit` rationale explaining the `landed` check's own exemption, and
`docs/documents.md`'s "conflicts" table (§对照地图) already names
`docs/pipeline.md` as one of the pages that has to follow rationale.md's
rule, not the other way round. `docs/pipeline.md` links to it instead of
repeating it.

In `docs/pipeline.md`:

```
settle period, and it is three days. A plan that declares itself `design-intent`
is not judged at all — it is a statement of work not yet done, and the files it
names are what it tells the reader to go read, not evidence the work happened.
Sharing one number made the landed check unable to fire on a repository younger
```

becomes:

```
settle period, and it is three days. A plan that declares itself `design-intent`
is not judged at all — why, and what a reader does with its named files
instead, is in [`skills/fankeel-audit/rationale.md`](../skills/fankeel-audit/rationale.md).
Sharing one number made the landed check unable to fire on a repository younger
```

(`docs/development.md:144` already links to
`../skills/fankeel-audit/rationale.md` the same way, for a different
sentence — this is the established relative path from `docs/`.)

### Step 4 — pair (c): `docs/station.md`

`docs/registry.md:246` is the `spend` field's own schema entry — the
bucketing tie-break belongs where the field itself is defined. `docs/station.md`'s
"Where per-stage spend comes from" section links to it instead of restating
the rule.

In `docs/station.md`:

```
`summariseTree` hands the windows to both halves. Each request lands in the
window holding its **last** line's timestamp — the same "last line winning"
rule the `requestId` de-duplication already uses, so a request whose lines
straddle a boundary is decided by one rule and not two.
```

becomes:

```
`summariseTree` hands the windows to both halves. Which window a request lands
in is the same tie-break [registry.md](registry.md) states for `spend`, so a
request whose lines straddle a boundary is decided by one rule and not two.
```

### Step 5 — run it and watch it pass

```bash
grep -c "right in ten places" docs/development.md
grep -c "is not judged at all — it is a statement of work not yet done" docs/pipeline.md
grep -c "holding its \*\*last\*\* line's timestamp — the same \"last line winning\"" docs/station.md
node scripts/docs-check.js
```

Expect: all three `grep -c` calls print `0` (the duplicated wording is gone
from the linking page); `docs-check` exits 0, "Every reference resolves." —
the three new links (to `tests/contract.test.js`, `rationale.md`,
`registry.md`) all point at real files.

```bash
node -e "const {sweep}=require('./scripts/docs-audit.js'); const r=sweep(process.cwd()); for(const p of r.overlaps){if((p.a+p.b).includes('registry.md')&&(p.a+p.b).includes('station.md')){console.log(p.a,p.b,p.shared.length)}}"
```

Expect this still prints the `registry.md`/`station.md` pair with 6 shared
files — unchanged, exactly as reasoned above, and not a sign the fix failed.

### Step 6 — commit

```
git commit -o docs/development.md docs/pipeline.md docs/station.md -m "docs: 三處兩頁同一件事，各自指定來源頁"
git commit -o docs/development.md docs/pipeline.md docs/station.md -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git commit -o docs/development.md docs/pipeline.md docs/station.md -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

---

## Task 16: decision record — none of caveman's three absorbable groups gained a fankeel rule

**Files:**
- Modify: `docs/decisions/2026-09-18-caveman-absorb-none.md` — new file
- Modify: `docs/improvement-brief.md` — §6.4 gains one line pointing at it
- Modify: `docs/README.md` — the decisions index gains one row
- Read: `lib/usage.js` — what fankeel measures real token usage with, in
  place of `caveman-stats`
- Read: `docs/station.md` — the 花費 tab's per-stage × model breakdown
- Read: `skills/registry.json` — every stage's `entry_condition` /
  `stop_condition` pair
- Read: `skills/fankeel/SKILL.md` — the "Dispatch by default, never the
  filtering" section, in place of `cavecrew`'s delegation guide
- Read: `docs/subagents.md` — "When to dispatch one", the measured cost
  backing that section
- Read: `docs/reports/2026-09-09-design-axis-inventory.md` — the caveman
  1.0.1 feature scan this decision draws its three items from
- Read: `docs/judgements/2026-09-10-pattern-skill.md` — already ruled on the
  Native Core skills' class
- Test: none — a decision record; `docs-check` is the gate

**Interfaces:**
- Consumes: none
- Produces: `docs/decisions/2026-09-18-caveman-absorb-none.md` — Task 17 must
  run after this task lands, because that page cites
  `docs/reports/2026-09-09-design-axis-inventory.md` by path and Task 17's
  new test requires that citation to already be findable

**Dispatch:** implementer, sonnet — one new decision page in the established
shape, plus two one-line pointers to it.

`docs/decisions/fankeel-shell.md` and `docs/decisions/2026-09-18-todo-six.md`
are the shape to follow: frontmatter with `status`, `last_verified` (and
`source_of_truth` naming what it compares, following `fankeel-shell.md`'s
convention rather than leaving it out), a title, and `##` sections each
carrying one piece of reasoning. `TODO.md:73` is the entry this closes (Task
19 removes it); `docs/reports/2026-09-09-design-axis-inventory.md` and
`docs/improvement-brief.md` §1.5/§6.4 are what it draws its material from —
the caveman 1.0.1 feature scan lists the three groups this decision covers:
`caveman-stats` (a Commands-group item, hook-computed real token usage and
estimated savings, model does no computing), `cavecrew` (the delegation
decision guide — separate from the `cavecrew-builder`/`-investigator`/
`-reviewer` agents, which already have fankeel counterparts and are not part
of this decision), and the six Native Core skills
(`investigate-first`, `lean-build`, `migration`, `safe-refactor`,
`surgical-patch`, `verify-and-stop`), already classed by
`docs/judgements/2026-09-10-pattern-skill.md`.

### Step 1 — the check that proves the source material

```bash
grep -n "caveman-stats\|cavecrew\|Native Core" docs/plans/2026-09-18-todo-nineteen-design.md
```

Confirms the three items and their fankeel counterparts as design §1 states
them: `caveman-stats` → `lib/usage.js` and station's 花費 tab; Native Core's
six skills → the seven `fankeel-<stage>` skills and `skills/registry.json`'s
per-stage `entry_condition`/`stop_condition`; `cavecrew`'s delegation guide →
"Dispatch by default" and `docs/subagents.md`.

```bash
grep -c "entry_condition" skills/registry.json
```

Expect `7` — confirms every stage already carries the paired condition the
survey said Native Core's skills lack.

### Step 2 — write `docs/decisions/2026-09-18-caveman-absorb-none.md`

```md
---
status: decision
last_verified: 2026-09-18
source_of_truth: lib/usage.js, docs/station.md, skills/registry.json, skills/fankeel/SKILL.md, docs/subagents.md
---

# caveman：一樣都不吸收 — 決策紀錄

`TODO.md`〔caveman〕條問的是 caveman 1.0.1 二十個 skill 裡要吸收哪些。盤點見
[docs/reports/2026-09-09-design-axis-inventory.md](../reports/2026-09-09-design-axis-inventory.md)
與 `docs/improvement-brief.md` §1.5、§6.4：三項候選——`caveman-stats`、Native
Core 六個流程 skill（`investigate-first`、`lean-build`、`migration`、
`safe-refactor`、`surgical-patch`、`verify-and-stop`）、`cavecrew` 的委派決策
指南——每項都已經有 fankeel 自己的對應，而且更強或至少一樣。三項都不吸收。

## caveman-stats → `lib/usage.js` 與 station 的花費分頁

`caveman-stats` 由 hook 在 session 內算好注入：本 session 的真實 token 用量與估計
節省，模型不參與計算。`lib/usage.js` 的 `addUsage()` 對每個 `requestId` 只算最後
一份 `usage`，跨 input/output/cache-read/兩種 cache-write 五個欄位分開算，不是
只看一個 session——station 的花費分頁把它按 stage × model 攤開，`usd`、
`cost: null` 分開表示「沒有價目表」與「零元」。caveman-stats 只能看見它注入的
那一次提示；花費分頁是每個登記過的 session 都能事後打開看，一樣是量到的而不是
模型估的，多了跨 session 與按階段兩層。

## Native Core 六個流程 skill → 七個 `fankeel-<stage>` skill 與 `entry_condition`／`stop_condition`

Native Core 的六個 skill 是六份各自獨立的流程樣板，使用者依任務形狀挑一份；
`docs/judgements/2026-09-10-pattern-skill.md` 判過這一類。fankeel 的七站
（survey、design、plan、build、verify、audit、land）是同一條路線依 class 選
子集，不是六份互斥樣板；`skills/registry.json` 每一站都有 `entry_condition`
與 `stop_condition` 兩個機械可讀欄位，這正是這輪 survey 說 Native Core 缺的
「進入／停止條件成對」，fankeel 已經有。

## cavecrew 的委派指南 → 「Dispatch by default」一節與 `docs/subagents.md`

`cavecrew` 是一份「什麼時候該 delegate」的決策指南；cavecrew-builder、
cavecrew-investigator、cavecrew-reviewer 三個 agent 已經個別對到
`fankeel-fixer`、`fankeel-reader`、`fankeel-reviewer`，不在這條待決之列。指南
本身對到 `skills/fankeel/SKILL.md` 的「Dispatch by default, never the
filtering」一節：預設派工，例外只有兩種——一個管線已經濾掉殘留，或者只是一次
工具呼叫——不必先判斷「這件事夠不夠大」。`docs/subagents.md` 的「When to
dispatch one」接著給量測支持這條規則：具名搜尋一支殘留只差 2.55×，不具名搜尋
差到 9.23×。cavecrew 的指南是散文判斷；fankeel 這邊是規則加量測。

## 不吸收，不是沒看

三項都讀過，都有機械可查的對應：`lib/usage.js`、`skills/registry.json`、
`skills/fankeel/SKILL.md` 三個原始碼位置與 `docs/subagents.md` 一份量測頁。
`TODO.md`〔caveman〕解除安裝那條的 `lifts when:` 是這條定案，這條一落地它就從
`## Waiting` 移到 `## Ready`——解除安裝本身不在這一輪做，因為那改的是使用者
自己的 Claude Code 設定，不是這個 repo。
```

### Step 3 — point `docs/improvement-brief.md` §6.4 at it

```
**要盤點的是裝著的外掛**：caveman 1.0.1，20 個 skill、3 個 agent、6 個 command、2 個
hook（SessionStart 啟動它的模式，UserPromptSubmit 追蹤模式）。本檔第一部掃過一次：§1.5
列了六個可搬項目，`docs/judgements/2026-09-10-pattern-skill.md` 判過 pattern skill 那一類。
使用者的立場是不用、不重裝，要的功能改寫成 fankeel 自己的規則。

**fankeel 這邊的耦合很少**，沒有一處是功能上的依賴：
```

becomes:

```
**要盤點的是裝著的外掛**：caveman 1.0.1，20 個 skill、3 個 agent、6 個 command、2 個
hook（SessionStart 啟動它的模式，UserPromptSubmit 追蹤模式）。本檔第一部掃過一次：§1.5
列了六個可搬項目，`docs/judgements/2026-09-10-pattern-skill.md` 判過 pattern skill 那一類。
使用者的立場是不用、不重裝，要的功能改寫成 fankeel 自己的規則。

**三項候選都定案為不吸收**：`caveman-stats`、Native Core 六個流程 skill、
`cavecrew` 的委派指南，每項對到的 fankeel 現有機制與理由都在
[docs/decisions/2026-09-18-caveman-absorb-none.md](decisions/2026-09-18-caveman-absorb-none.md)。

**fankeel 這邊的耦合很少**，沒有一處是功能上的依賴：
```

### Step 4 — index it in `docs/README.md`

Find:
```
| The one task: ten entries and one rewrite into `TODO.md`, with the red-green control run on `todo-check.js` itself because a document carries no test | `docs/archive/2026-09-18-skill-improvements.md` — *built, 繁體中文* |
```
replace with the same row followed by a new one:
```
| The one task: ten entries and one rewrite into `TODO.md`, with the red-green control run on `todo-check.js` itself because a document carries no test | `docs/archive/2026-09-18-skill-improvements.md` — *built, 繁體中文* |
| Why none of caveman's three absorbable groups — `caveman-stats`, Native Core's six process skills, `cavecrew`'s delegation guide — gained a fankeel rule, and what already covers each one instead | [decisions/2026-09-18-caveman-absorb-none.md](decisions/2026-09-18-caveman-absorb-none.md) — *繁體中文* |
```

(Task 12 separately adds a line near this file's top, in the profile-card
paragraph — a different region of the same file. Anchor this edit on the
`skill-improvements.md` row text above, not on a line number, so the two
tasks' edits do not collide however the file has shifted by the time this
runs.)

### Step 5 — the check that proves it

```
node scripts/docs-check.js
```

Expect exit 0. The new page's two `.md` links (to the design-axis report, and
`improvement-brief.md`'s own link to the new page) resolve; its several
backtick paths with no line number are existence-checked only, and all name
real files.

### Step 6 — commit

```
git commit -o docs/decisions/2026-09-18-caveman-absorb-none.md docs/improvement-brief.md docs/README.md -m "docs: caveman 三項候選定案為都不吸收"
git commit -o docs/decisions/2026-09-18-caveman-absorb-none.md docs/improvement-brief.md docs/README.md -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git commit -o docs/decisions/2026-09-18-caveman-absorb-none.md docs/improvement-brief.md docs/README.md -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

---

## Task 17: `docs/sources.md`'s Cited by column, filled and tested

**Files:**
- Modify: `docs/sources.md` — ten rows' `Cited by` cells gain the citing
  pages a mechanical grep finds and did not list; one loses `hooks/size.js`,
  deleted by Task 7
- Modify: `tests/sources-doc.test.js` — the new test this task adds
- Test: `tests/sources-doc.test.js`

**Interfaces:**
- Consumes: `docs/decisions/2026-09-18-caveman-absorb-none.md` from Task 16, and the deletion of `hooks/size.js` from Task 7.
  Task 7 must have already landed — it deletes `hooks/size.js`,
  named in the `HOOK-PAYLOAD-260911` row's `Cited by` cell, and this task's
  new reverse-direction test would otherwise fail on that stale name forever.
  Task 16 must have already landed — its new
  `docs/decisions/2026-09-18-caveman-absorb-none.md` cites
  `docs/reports/2026-09-09-design-axis-inventory.md` by path, so the
  forward-direction test requires that page to already exist and be listed
  in the `DESIGN-AXIS-260909` row's `Cited by` cell
- Produces: `tests/sources-doc.test.js` Cited-by checks, both directions — Task 19 closes the entry only after they pass

**Dispatch:** implementer, sonnet — ten table-cell edits and one test that
reads the whole `docs/` tree twice.

"Cites" is defined the way `docs/sources.md:4`'s own convention already
reads a citation by hand: a page's text contains the row's own `` `ID` ``
string, or the basename of its report file (`2026-09-02-process-state-review.md`,
say) — either is enough, and both are true of most real citations. The
survey that flagged this as red on thirteen rows had one wrong claim in it:
`docs/judgements/2026-09-10-shell-whitelist.md` does not cite
`DISPATCH-VS-INLINE-260903` — it cites `docs/reports/2026-09-07-join-pair.md`
(`DISPATCH-JOIN-DIFF-260907`'s report) at its own `:83`. Trust the grep below,
not that earlier survey sentence.

### Step 1 — the failing test

In `tests/sources-doc.test.js`, after the existing `test(...)` block, add:

```js
// "Cites" means the page's text holds the row's own ID or the basename of
// its report file — the same thing `sources.md:4`'s "filled by hand from
// grep" convention already means. Both directions: a citing page not listed
// is a `Cited by` cell that has not been filled; a listed path that does not
// exist is a name nothing points at any more (this is what catches
// `hooks/size.js` the day it is deleted).
const REPORT_ROW = /^\|\s*`([A-Z0-9-]+)`\s*\|/;

function reportRows(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const m = REPORT_ROW.exec(line);
    if (!m) continue;
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
    const linkMatch = /\]\(reports\/([^)]+\.md)\)/.exec(cells[2] || '');
    const citedByCell = cells[cells.length - 1];
    rows.push({
      id: m[1],
      reportBase: linkMatch ? linkMatch[1] : null,
      citedBy: (citedByCell.match(/`([^`]+)`/g) || []).map((s) => s.slice(1, -1)),
    });
  }
  return rows;
}

// Every `docs/` markdown file outside `docs/archive/`, `docs/sources.md`
// itself excluded.
function citablePages(dir, base) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (rel === 'docs/archive' || rel.startsWith('docs/archive/')) continue;
    if (fs.statSync(full).isDirectory()) { out.push(...citablePages(full, base)); continue; }
    if (rel.endsWith('.md') && rel !== 'docs/sources.md') out.push(rel);
  }
  return out;
}

test('every docs/ page that cites a sources.md report is in that row\'s Cited by, and every Cited by path exists', () => {
  const rows = reportRows(fs.readFileSync(path.join(ROOT, 'docs', 'sources.md'), 'utf8'));
  const pages = citablePages(path.join(ROOT, 'docs'), ROOT);
  const texts = new Map(pages.map((p) => [p, fs.readFileSync(path.join(ROOT, p), 'utf8')]));

  for (const row of rows) {
    const citing = pages.filter((p) => {
      const t = texts.get(p);
      return t.includes(row.id) || (row.reportBase && t.includes(row.reportBase));
    });
    const missing = citing.filter((p) => !row.citedBy.includes(p));
    assert.deepEqual(missing, [], row.id + ' cites-but-not-listed: ' + missing.join(', '));

    const gone = row.citedBy.filter((p) => !fs.existsSync(path.join(ROOT, p)));
    assert.deepEqual(gone, [], row.id + ' Cited by names a path that does not exist: ' + gone.join(', '));
  }
});
```

### Step 2 — run it and watch it fail

```
node --test tests/sources-doc.test.js
```

Fails on (at least) these ten rows' `missing` assertion:
`DISPATCH-VS-INLINE-260903`, `DISPATCH-NAMED-260903`,
`CHAINS-AS-WORKFLOWS-260904`, `BRIEF-PROBE-260904`,
`STAGE-DIVISION-MEAS-260905`, `BRIEF-PROBE-260907`,
`DISPATCH-JOIN-DIFF-260907`, `DESIGN-AXIS-260909`, and
`STYLE-TO-SUBAGENT-260907` (second table). It does **not** yet fail on
`HOOK-PAYLOAD-260911`'s `gone` assertion — `hooks/size.js` still exists at
this point in the build, since Task 7 (which deletes it) is a prerequisite
already landed by the time this task runs; that half only turns red if Task 7
is skipped, which is exactly why it is named in Interfaces above.

### Step 3 — the implementation: ten `Cited by` cells

In `docs/sources.md`, each `Find` below is the row's exact current `Cited by`
cell content (the backtick-wrapped, comma-separated list between the last two
`|`); each `Replace` is that same list with one change.

**`DISPATCH-VS-INLINE-260903`** — find:
```
`docs/archive/2026-09-04-ready-and-decisions.md`, `docs/improvement-brief.md`, `docs/archive/2026-09-07-todo-thirteen.md`, `docs/README.md`, `docs/reports/2026-09-03-dispatch-vs-inline-named.md`, `docs/reports/2026-09-04-agent-wakeups.md`, `docs/reports/2026-09-05-stage-division-measurements.md`, `docs/subagents.md`, `skills/fankeel/SKILL.md`
```
replace with (adds `docs/reports/2026-09-18-seventeen-items.md`, which cites
`docs/reports/2026-09-03-dispatch-vs-inline.md` by path in its own frontmatter
`source_of_truth`):
```
`docs/archive/2026-09-04-ready-and-decisions.md`, `docs/improvement-brief.md`, `docs/archive/2026-09-07-todo-thirteen.md`, `docs/README.md`, `docs/reports/2026-09-03-dispatch-vs-inline-named.md`, `docs/reports/2026-09-04-agent-wakeups.md`, `docs/reports/2026-09-05-stage-division-measurements.md`, `docs/subagents.md`, `skills/fankeel/SKILL.md`, `docs/reports/2026-09-18-seventeen-items.md`
```

**`DISPATCH-NAMED-260903`** — find:
```
`docs/archive/2026-09-04-ready-and-decisions.md`, `docs/archive/2026-09-07-todo-thirteen-design.md`, `docs/archive/2026-09-07-todo-thirteen.md`, `docs/subagents.md`, `skills/fankeel/SKILL.md`
```
replace (adds `docs/README.md`, whose report table links this report by
path):
```
`docs/archive/2026-09-04-ready-and-decisions.md`, `docs/archive/2026-09-07-todo-thirteen-design.md`, `docs/archive/2026-09-07-todo-thirteen.md`, `docs/subagents.md`, `skills/fankeel/SKILL.md`, `docs/README.md`
```

**`CHAINS-AS-WORKFLOWS-260904`** — find:
```
`docs/archive/2026-09-04-ready-and-decisions.md`, `docs/archive/2026-09-07-backlog-eight.md`, `docs/subagents.md`, `skills/fankeel/SKILL.md`, `skills/fankeel-build/rationale.md`
```
replace (adds `docs/README.md`, and `docs/judgements/2026-09-10-verifier-agent.md`
which names `docs/reports/2026-09-04-chains-as-workflows.md` at its own
`:46`):
```
`docs/archive/2026-09-04-ready-and-decisions.md`, `docs/archive/2026-09-07-backlog-eight.md`, `docs/subagents.md`, `skills/fankeel/SKILL.md`, `skills/fankeel-build/rationale.md`, `docs/README.md`, `docs/judgements/2026-09-10-verifier-agent.md`
```

**`BRIEF-PROBE-260904`** — find:
```
`docs/reports/2026-09-07-brief-probe.md`, `docs/subagents.md`
```
replace:
```
`docs/reports/2026-09-07-brief-probe.md`, `docs/subagents.md`, `docs/README.md`
```

**`STAGE-DIVISION-MEAS-260905`** — find:
```
`docs/archive/2026-09-05-anchor-remaining.md`, `docs/archive/2026-09-05-anchor-tiers.md`, `docs/decisions/2026-09-04-stage-division-design.md`, `docs/decisions/2026-09-05-anchor-remaining-design.md`, `docs/decisions/2026-09-05-anchor-tiers-design.md`, `docs/archive/2026-09-08-ready-and-station-serve.md`
```
replace:
```
`docs/archive/2026-09-05-anchor-remaining.md`, `docs/archive/2026-09-05-anchor-tiers.md`, `docs/decisions/2026-09-04-stage-division-design.md`, `docs/decisions/2026-09-05-anchor-remaining-design.md`, `docs/decisions/2026-09-05-anchor-tiers-design.md`, `docs/archive/2026-09-08-ready-and-station-serve.md`, `docs/README.md`
```

**`BRIEF-PROBE-260907`** — find:
```
`docs/archive/2026-09-07-ready-fourteen-design.md`, `docs/archive/2026-09-07-ready-fourteen.md`
```
replace:
```
`docs/archive/2026-09-07-ready-fourteen-design.md`, `docs/archive/2026-09-07-ready-fourteen.md`, `docs/README.md`
```

**`DISPATCH-JOIN-DIFF-260907`** — find:
```
`docs/archive/2026-09-07-todo-thirteen.md`
```
(this exact single-item cell appears only in this row) replace (adds
`docs/README.md`, and `docs/judgements/2026-09-10-shell-whitelist.md` which
names `docs/reports/2026-09-07-join-pair.md` at its own `:83`):
```
`docs/archive/2026-09-07-todo-thirteen.md`, `docs/README.md`, `docs/judgements/2026-09-10-shell-whitelist.md`
```

**`DESIGN-AXIS-260909`** — find:
```
`docs/README.md`, `docs/improvement-brief.md`
```
replace (adds `docs/judgements/2026-09-11-todo-split.md`, which names
`docs/reports/2026-09-09-design-axis-inventory.md` at its own `:46`, and
`docs/decisions/2026-09-18-caveman-absorb-none.md` from Task 16, which links
the same report path):
```
`docs/README.md`, `docs/improvement-brief.md`, `docs/judgements/2026-09-11-todo-split.md`, `docs/decisions/2026-09-18-caveman-absorb-none.md`
```

**`HOOK-PAYLOAD-260911`** — find:
```
`docs/collisions.md`, `docs/archive/2026-09-11-backlog-all.md`, `docs/README.md`, `hooks/size.js`, `lib/guard.js`
```
replace (`hooks/size.js` no longer exists — Task 7 deleted it):
```
`docs/collisions.md`, `docs/archive/2026-09-11-backlog-all.md`, `docs/README.md`, `lib/guard.js`
```

**`STYLE-TO-SUBAGENT-260907`** (second table, *Consulted with no usable
numbers*) — find:
```
`docs/archive/2026-09-07-todo-thirteen.md`
```
(the only cell in the second table shaped this way) replace:
```
`docs/archive/2026-09-07-todo-thirteen.md`, `docs/README.md`
```

### Step 4 — run it and watch it pass

```
node --test tests/sources-doc.test.js
```

### Step 5 — commit

```
git commit -o docs/sources.md tests/sources-doc.test.js -m "test: docs/sources.md 的 Cited by 補齊，加雙向測試"
git commit -o docs/sources.md tests/sources-doc.test.js -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git commit -o docs/sources.md tests/sources-doc.test.js -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

---

## Task 18: root `.ignore` excludes `docs/archive/`; two documents.md sentences state decisions

**Files:**
- Modify: `.ignore` — new file, one line
- Modify: `docs/documents.md` — one sentence where the role table discusses
  `archive`; one sentence closing the `.fankeel/build/` bucket question
- Test: none — a ripgrep count and `docs-check` are the gate

**Interfaces:**
- Consumes: none
- Produces: `.ignore` — Task 19 closes the entry only after it lands

**Dispatch:** in-session — one one-line file and two sentences; the dispatch
round-trip costs more than the work.

Two unrelated design sections land together because both are stated
decisions inside `docs/documents.md` and neither touches code: §9 (`.ignore`)
and §13 (`.fankeel/build/` stays out of `docs.json`, closed rather than left
open — `:97`'s "只寫進 documents.md" option is already true of the
`.fankeel/` 各區的壽命 table at `docs/documents.md:121-159`; what is missing
is saying plainly that this is the decided answer, not an omission).

### Step 1 — the check, before

Pick a term that exists only under `docs/archive/` across the whole tracked
tree:

```bash
git grep -c "REQUIRED SUB-SKILL"
```

Prints exactly:
```
docs/archive/2026-08-22-seven-stage-implementation.md:1
docs/archive/2026-08-23-registry-staleness-implementation.md:1
docs/archive/2026-08-24-observed-scope-implementation.md:1
docs/archive/2026-08-25-injected-layer.md:1
```

Four files, one match each, all under `docs/archive/`. Now search with the
`Grep` tool (ripgrep) for the same term over the whole repository — the same
four hits, since no `.ignore` exists yet.

### Step 2 — write `.ignore`

```
docs/archive/
```

### Step 3 — the check, after

Search with the `Grep` tool for `REQUIRED SUB-SKILL` again, with no path
given: **0** matches — ripgrep now skips everything under `docs/archive/` by
default. Then search again naming `docs/archive` explicitly as the path: the
same **4** matches as before — naming the path overrides the skip.

### Step 4 — the two sentences

In `docs/documents.md`, the role table's closing:

```
| `fixture` | a test's own input — describes nothing about the system, checked for links and line numbers only | n/a |

The two shapes that ship — `flat` and `phased` — and what happens to a markdown
file in no bucket are stated in [the skill](../skills/fankeel/SKILL.md), under
```

becomes:

```
| `fixture` | a test's own input — describes nothing about the system, checked for links and line numbers only | n/a |

A root `.ignore` holding `docs/archive/` keeps ripgrep-based tools — the
`Grep` and `Glob` tools here — from searching it by default; naming
`docs/archive` explicitly still searches it, and `docs-check`, `docs-audit`
and `survey.js` read `git ls-files` directly, so neither is affected either
way.

The two shapes that ship — `flat` and `phased` — and what happens to a markdown
file in no bucket are stated in [the skill](../skills/fankeel/SKILL.md), under
```

And the `.fankeel/` 各區的壽命 section's closing:

```
`--exclude-standard` 套用 `.gitignore`，所以宣告出來的 bucket 會
永遠列出零個檔。這張表是這幾區唯一的說明，`node scripts/residue.js` 是它們當下
的清單——表格給角色，`residue.js` 給有哪些與多大。
```

becomes:

```
`--exclude-standard` 套用 `.gitignore`，所以宣告出來的 bucket 會
永遠列出零個檔。這張表是這幾區唯一的說明，`node scripts/residue.js` 是它們當下
的清單——表格給角色，`residue.js` 給有哪些與多大。

`.fankeel/build/` 不進 `docs.json` 當 bucket 是定案，不是漏掉沒做：宣告一個被
`.gitignore` 擋住的路徑當 bucket，列檔那層永遠回零個檔，宣告了也沒有作用。
```

### Step 5 — the checks

```
node scripts/docs-check.js
```

Expect exit 0.

### Step 6 — commit

```
git commit -o .ignore docs/documents.md -m "chore: 根目錄 .ignore 排除 docs/archive/，documents.md 記下兩條定案"
git commit -o .ignore docs/documents.md -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git commit -o .ignore docs/documents.md -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

---

## Task 19: `TODO.md`'s nineteen close; `〔caveman〕解除安裝` moves to `## Ready`

**Files:**
- Modify: `TODO.md` — remove all nineteen `## Needs a decision` bullets;
  move the `〔caveman〕解除安裝` bullet from `## Waiting` to `## Ready`
- Test: none — `node scripts/todo-check.js` is the gate

**Interfaces:**
- Consumes: `.ignore` from Task 18, `tests/sources-doc.test.js` from Task 17, and every other task in this plan having landed.
  This task only
  removes a bullet once the change it names has actually happened. By
  design section and the task that builds it: Task 1 (§16, `judge.js`'s
  flags), Task 2 (§15, `station.js` → `parseArgs`), Task 3 (§17,
  `lib/skill-overlap.js` folded into `orient.js`), Task 4 (§18, three
  duplications collapsed), Task 5 (§12, `guard.js`'s write-pattern list),
  Task 6 (§19, `ledger.js init --range`), Task 7 (§6, `hooks/size.js`
  removed), Task 8 (§5, the `context:` line's fourth option), Task 9 (§2,
  registry entries record `version`), Task 10 (§3, `gates` records `question`
  and `descriptions`), Task 11 (§7, the profile card moves and `station:`
  gains a line), Task 12 (§8, station's 文件 card), Task 13 (§4, the
  session-page main-loop breakdown), Task 14 (§14, `docs-check`'s
  `#fragment` check), Task 15 (§10, the three source-page pairs), Task 17
  (§11, `docs/sources.md`'s `Cited by`), Task 16 (§1, the caveman
  absorb-none decision, whose landing is also what makes `〔caveman〕解除
  安裝`'s `lifts when:` true), Task 18 (§9 and §13, `.ignore` and the
  `.fankeel/build/` decision)
- Produces: nothing

**Dispatch:** in-session — two edits to one file and one check; the dispatch
round-trip costs more than the work.

`TODO.md` is the one file every other task in this plan would otherwise also
have to touch, which is why closing it is a task of its own and why it runs
last, exactly as `docs/archive/2026-09-01-six-decisions.md`'s own "close the
eight entries" task did for a smaller batch.

### Step 1 — the check, before

```
node scripts/todo-check.js
```

At `HEAD` `51e4a5f` this printed: `fankeel todo-check: 32 entries — 0 ready,
19 needs a decision, 13 waiting. All links resolve, no stale citations, none
over the cap.` When this task runs, Task 3 and Task 7 have each removed one,
so expect `30 entries — 0 ready, 17 needs a decision, 13 waiting`.

### Step 2 — remove all nineteen `## Needs a decision` bullets

At `HEAD` `51e4a5f`, `TODO.md:73-109` holds all nineteen, one per bullet,
each separated by a blank line. Match each by its `〔prefix〕` and first
words — a line number is stale by the time this task runs. Two are already
gone when this task runs: Task 7 removed #6 and Task 3 removed #17, because
each deletes the file its bullet links and `todo-check` fails on a dead link.
Delete the seventeen still present; if #6 or #17 is somehow still there,
stop and say so rather than deleting it — it means Task 3 or Task 7 did not
land:

| # | prefix | first words |
|---|---|---|
| 1 | 〔caveman〕 | 20 skill 裡要吸收哪些 |
| 2 | 〔registry〕 | 136 筆 entry 沒有任何版本欄位 |
| 3 | 〔gates〕 | gate 記錄要當標註資料還缺兩樣 |
| 4 | 〔station〕 | 主迴圈成本分解 |
| 5 | 〔session〕 | 堆疊手段 |
| 6 | 〔session〕 | `hooks/size.js` 留不留 |
| 7 | 〔station〕 | profile 卡使用者兩次沒找到 |
| 8 | 〔docs〕 | 沒有給人讀的文件層 |
| 9 | 〔docs〕 | `docs/archive/` 會被 Grep 搜到 |
| 10 | 〔docs〕 | 三處同一件事寫在兩頁 |
| 11 | 〔docs〕 | `docs/sources.md` 的 Cited by 欄 |
| 12 | 〔skill〕 | 唯讀 agent 的 Bash 寫檔只擋一部分 |
| 13 | 〔docs〕 | `.fankeel/build/` 不在 `docs.json` 任何 bucket |
| 14 | 〔docs〕 | `docs-check` 不驗 `path#fragment` 的錨點 |
| 15 | 〔scripts〕 | `scripts/station.js` 手寫 argv 迴圈 |
| 16 | 〔scripts〕 | `lib/skills.js` 的 `acceptedFlags` |
| 17 | 〔lib〕 | `lib/skill-overlap.js` 只有一個 production caller |
| 18 | 〔lib〕 | 三處重複 |
| 19 | 〔ledger〕 | plan 階段的 commit 不在 ledger 任何一列 |

Delete them all, each bullet's blank line included, leaving the `##
Needs a decision` heading directly followed by one blank line and then the
`## Waiting` heading — the same shape the (currently empty) `## Ready`
section directly above already has.

### Step 3 — move `〔caveman〕解除安裝`

Under `## Waiting`, find:
```
- 〔caveman〕解除安裝：程式碼零硬依賴，`settings.json` 的 `enabledPlugins` 09-15 已設 false，兩個反向測試守著 — [tests/badge.test.js](tests/badge.test.js). lifts when: 〔caveman〕挑功能那條定案. 09-18.
```
Remove this line from `## Waiting` (its neighbours' blank lines close up
normally), and add, under `## Ready`, dropping the `lifts when:` clause and
the `MM-DD` stamp — `## Ready` entries carry neither:
```
- 〔caveman〕解除安裝：程式碼零硬依賴，`settings.json` 的 `enabledPlugins` 09-15 已設 false，兩個反向測試守著 — [tests/badge.test.js](tests/badge.test.js).
```

### Step 4 — the check, after

```
node scripts/todo-check.js
```

Expect: `fankeel todo-check: 13 entries — 1 ready, 0 needs a decision, 12
waiting. All links resolve, no stale citations, none over the cap.` Exit 0.

### Step 5 — commit

```
git commit -o TODO.md -m "docs: TODO 十九條 Needs a decision 全部關掉，caveman 解除安裝移到 Ready"
git commit -o TODO.md -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git commit -o TODO.md -m "Claude-Session: https://claude.ai/code/session_01DXakDsvAQbCy3wzHsBVqDu"
```

## Coverage

| promise | task |
|---|---|
| 新增 `docs/decisions/2026-09-18-caveman-absorb-none.md`：三項各對到 fankeel 已有的 東西——`caveman-stats` 對 `lib/usage.js` 與 station 的花費分頁，Native Core 六個流程 skill 對七個 `fankeel-<stage>` skill 與 `skills/registry.json` 的進入／停止條件， `cavecrew` 的委派指南對 fankeel skill 的「Dispatch by default」一節與 `docs/subagents.md`。每一對寫一句 fankeel 那邊比較強或一樣的理由。 | Task 16 |
| `docs/improvement-brief.md` §6.4 補一行指向這份 decision。 | Task 16 |
| `TODO.md:119`（caveman 解除安裝）的 lifts when 是「挑功能那條定案」，這條落地就成立， 所以它從 `## Waiting` 移到 `## Ready`。**解除安裝本身不在這一輪做**：它改的是 使用者自己的 Claude Code 設定，不是這個 repo。 | Task 19 |
| `task.js start` 與 `task.js adopt` 寫 `version`：外掛根目錄 `package.json` 的 `version`。只記版本號，不記 commit sha——安裝的 cache 沒有 `.git`，要 sha 得在 發版時另外烤進去，`scripts/version.js` 現在不做這件事。 | Task 9 |
| 一個 process 啟動時就釘住外掛路徑，所以 start 當下的版本就是這個 session 所有 hook 的版本；adopt 開的是新 session，記它自己的版本。 | Task 9 |
| `task` 改名不動它。舊 entry 沒有這個鍵，讀的人當成未知，不回填。 | Task 9 |
| `docs/registry.md` 的欄位清單與 `skills/fankeel/SKILL.md` 的「Thirteen more」計數 一起改。 | Task 9 |
| 每筆 gate 記錄多兩個欄位：`question`（字串）與 `descriptions`（和 `labels` 同長、 同順序的字串陣列）。兩樣都存，但都是**新增的兄弟欄位**，`labels` 維持字串陣列， `lib/station.js` 讀 `labels` 的兩處不用動。 | Task 10 |
| 兩個欄位照 `labels` 的方式截斷，上限在 plan 定，寫進 `docs/registry.md`。 | Task 10 |
| session 頁每一站多一列主迴圈：回合數、其中 context 在 400k 以上的回合數、那些回合的 花費與佔該站花費的比例。只放 session 頁——十七項報告 §Q 的第 ① 步就是這樣定範圍的， 首頁彙總沒人要。 | Task 13 |
| 資料從 station 已有的逐回合資料算，不新增記錄欄位。 | Task 13 |
| 畫面見 mockup。 | Task 13 |
| 選候選 2。候選 1 就是 `hooks/size.js`，已量過沒用（§6）；候選 4 已經是現行做法 （串接的 fan-out 走 Workflow）；候選 3 不做——它處理的是倒退，不是堆疊。 | Task 8 |
| `lib/context.js` 的 `contextLine` 在 `BUSY` 以上時改說：**這一站的關卡加第四個選項—— 接手**：設好 `next`，開新終端機，`/fankeel` → Adopt。取代現在「說一次就好」的提醒。 | Task 8 |
| 回答後回傳的區塊（`renderResume`）也帶這一行。現在只有 prompt 的區塊帶，而關卡是在 回答之間問的。 | Task 8 |
| `skills/fankeel/SKILL.md` 講 `context:` 行的那段、以及「第四個選項沒有一站在用」那句 一起改。`docs/improvement-brief.md` §6.2 記下選了哪一個。 | Task 8 |
| 照 09-11 上線時訂下的規則：再量沒降就拿掉。改前 `bigPerSession` 0.3846，改後 0.6136。 | Task 7 |
| 刪 `hooks/size.js`、`tests/size.test.js`，manifest 拿掉那一筆，`tests/resume.test.js` 裡針對它的斷言一起拿掉，點名它的文件改掉。 | Task 7 |
| `docs/sources.md` 裡它出現的 Cited by 格子一起更新（§11 的測試會抓）。 | Task 17 |
| 首頁的 profile 卡從最後移到最前面。 | Task 11 |
| `/fankeel` 區塊的 `station:` 行多說一句：要改 profile，用 `station.js serve --open`。 | Task 11 |
| 兩樣都做：使用者兩次都沒找到，一次是位置，一次是不知道要開 serve。 | Task 11 |
| 首頁多一張「文件」卡，讀各專案已經生成的 `.fankeel/map.md`：文件總數與狀態、 planned-not-built、undeclared、各 bucket 的 role，附上 map.md 的生成時間。 | Task 12 |
| 讀哪幾份：每個 registry 根目錄自己的 `.fankeel/map.md`，加上它的 entry 在 `project` 欄點名的每個專案底下的 `.fankeel/map.md`。一份一段，找不到的不列。 | Task 12 |
| 不翻譯、不另寫一份內容。reference 頁仍然是寫給 session 的；人拿到的是入口與現況， 不是第二份會漂移的內容。新增 `guide` role 與擴充 README 都等於手寫第二份，`:91` 已經示範了兩份會怎麼分岔。 | Task 12 |
| 不在 hook 裡掃 docs：只讀 map.md，沒有就不顯示這張卡。 | Task 12 |
| `docs/README.md` 開頭加一行，指向這張卡。 | Task 12 |
| 新增 `.ignore`，一行 `docs/archive/`。ripgrep（`Grep`／`Glob` 工具）從此不搜 archive； 明確給 `docs/archive` 當路徑時照搜。`survey.js`、`docs-check`、`docs-audit` 讀的是 `git ls-files`，不受影響。 | Task 18 |
| `docs/documents.md` 講 archive 的地方補一句。 | Task 18 |
| 版本號同步的次數：`tests/contract.test.js:256` 旁邊就是強制它的程式，數字留在那裡； `docs/development.md:79` 拿掉數字改連過去。十與十二哪個對，build 時實查再寫。 | Task 15 |
| 「design-intent 的 plan 不判」那句：`skills/fankeel-audit/rationale.md:65` 是這條 規則的主人，`docs/pipeline.md:985` 改連過去。 | Task 15 |
| request 落在哪個時窗：這是 `usage` 的歸屬規則，`docs/registry.md:246` 留著， `docs/station.md:287` 改連過去。 | Task 15 |
| 一次補齊 archive 以外、grep 找得到的 `docs/` 頁。 | Task 17 |
| `tests/sources-doc.test.js` 加一條：每一列的報告，grep `docs/`（不含 `docs/archive/` 與 `sources.md` 本身）找得到的引用頁，都要出現在那列的 Cited by；反過來，Cited by 列的每個路徑都要存在——§6 刪掉 `hooks/size.js` 之後，留在格子裡的名字靠這半條抓。 | Task 17 |
| `sources.md:4` 那句「filled by hand from grep」保留，現在有測試守著它。 | Task 17 |
| `lib/guard.js` 的寫入 pattern 補兩類：`node -e`／`--eval` 裡的 `fs` 寫入呼叫 （`writeFile`、`appendFile`、`createWriteStream`、`rename`、`unlink`、`rm`、`mkdir`、 `copyFile`），與 `python -c` 裡的 `open(..., 'w'\|'a'\|'x')`、`write_text`、 `os.remove`、`shutil`。 | Task 5 |
| 只讀的 `node -e`（`readFileSync`、`require`）照樣放行。 | Task 5 |
| 不拿掉 Bash：拿掉就連 `npm test` 和 plugin 的 scripts 都跑不了。 | Task 5 |
| 關掉這條。進 docs.json 沒有作用：列檔走 `git ls-files --exclude-standard`， gitignored 的 bucket 永遠是空的。 | Task 18 |
| `docs/documents.md` 把「為什麼不是 bucket」寫成一句明講的決定，而不是讓人去推。 | Task 18 |
| 連到 repo 內 `.md` 的連結，片段照 GitHub 的 slug 規則比對目標檔的標題：轉小寫、 去掉標點（CJK 字留著）、空白換 `-`、重複的標題加 `-1`、`-2`。 | Task 14 |
| 對照組就在 repo 裡：archive 以外現有 10 個帶片段的連結。每一個都要解析得到， 解析不到的要嘛真的壞了，要嘛是 slug 規則錯了，build 時逐一判。 | Task 14 |
| 報告格式和現有的 dead link 一樣，照 role 決定要不要查。 | Task 14 |
| `--root`、`--scan` 用 `multiple: true`；未知旗標照舊 exit 2。 | Task 2 |
| 改完 `acceptedFlags(station.js)` 走的是 options 表那條路，要仍然非空（§16 的測試會看）。 | Task 2 |
| 只改 `judge.js`：它是五支裡唯一還回空集合的。 | Task 1 |
| `tests/skills.test.js` 加一條：這五支的 `acceptedFlags()` 都不是空集合。 | Task 1 |
| `OVERLAPS` 與 `overlapsIn` 搬進 `orient.js` 並匯出，刪掉 lib 檔；兩個測試改 require 路徑。點名 `lib/skill-overlap.js` 的文件一起改。 | Task 3 |
| `lib/usage.js` 兩個函式改呼叫 `entriesOf()`；`lib/registry.js` 四個三行三元式抽一個 小 helper；`lib/live.js` 改成 `new Set(...)`。行為不變。 | Task 4 |
| `ledger.js init` 多一個選填的 `--range <a>..<b>`，寫一行 plan 範圍；`ranges` 把它當 一列列出，verify 就不會把 plan 的 commit 報成沒人審。 | Task 6 |
| `skills/fankeel-build/SKILL.md` 叫 `init` 的那一步寫明要帶 plan 的範圍。 | Task 6 |
| 十九條都從 `## Needs a decision` 移除；`:119` 移到 `## Ready`（§1）。 | Task 19 |
| `todo-check` exit 0。 | Task 19 |
| `tests/skills.test.js`：五支 CLI 的 `acceptedFlags()` 都非空 | Task 1 |
| `tests/guard.test.js`：`node -e` 寫檔、`python -c` 寫檔被擋；只讀的放行 | Task 5 |
| `tests/docs-check.test.js`：壞片段被報；CJK 標題的片段解析得到 | Task 14 |
| `tests/sources-doc.test.js`：Cited by 與 grep 比對 | Task 17 |
| task 的測試：`start` 寫的 `version` 等於 `package.json` | Task 9 |
| gates 的測試：記錄帶 `question` 與 `descriptions` | Task 10 |
| context 與 render 的測試：`BUSY` 以上的那行講關卡接手，回答後的區塊也帶它 | Task 8 |
| `tests/ledger.test.js`：`init --range` 那列出現在 `ranges` | Task 6 |
| station view 的測試：profile 卡在第一張；有 map.md 才有文件卡；主迴圈列 | Task 13, Task 11, Task 12 |
| `npm test` 前後都綠 | Task 2, Task 3, Task 4, Task 7 |
| `Grep` 搜一個只在 archive 出現的詞：之前有檔、之後 0；給 `docs/archive` 路徑仍找得到 | Task 18 |
| 三句重複的話各 grep 一次，只剩來源頁那一處；連過去的新連結 `docs-check` exit 0。（`docs-audit` 的 pairs 按兩頁共用的原始檔配對，不按句子，這兩對改完仍會列出） | Task 15 |
| `todo-check` exit 0，`## Needs a decision` 0 條，`:119` 在 `## Ready` | Task 19 |
| 產出物：渲染後的 session 頁，各站主迴圈回合數加總等於頁上的總回合數；400k 以上回合的花費不超過該站花費 | Task 13 |
