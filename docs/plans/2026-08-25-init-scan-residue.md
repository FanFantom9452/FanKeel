---
status: current
last_verified: 2026-08-25
source_of_truth: this is a plan; the code it describes is the source of truth once it lands
---

# Three Silences Implementation Plan

**Goal:** the statusline says fankeel is running from the moment the prompt lands, the survey gate can be asked for more depth, and one scanner reports what nobody decided about.

**Architecture:** Three independent changes plus one refactor that two of them depend on. `hooks/inject.js` learns to read `payload.prompt` so it can raise an `init` badge before any registry entry exists. `scripts/survey.js` gains `--max`, `--all` and `--tree`, and `survey`'s own rules gain a fourth gate option. A new `scripts/residue.js` reports untracked-and-unignored paths, spent worktrees, the weight of ignored directories, and empty directories. Underneath, `trackedFiles` moves to `lib/tracked.js` so every tool in the plugin counts the same files.

**Tech Stack:** Node's standard library only. `node:test`. git, shelled out to and allowed to fail.

**Spec:** [2026-08-25-init-scan-residue-design.md](2026-08-25-init-scan-residue-design.md)

## Global Constraints

Generated from this project, not remembered. Every task's requirements include this section.

- **No dependencies.** `package.json` has no `dependencies` and no `devDependencies`. `node --test` is the whole harness. Adding a package is out of scope, not a judgement call.
- **Every hook exits 0 on every path.** `hooks/inject.js:7` — a `UserPromptSubmit` hook that throws blocks the prompt it was called for.
- **A session not in the mode must stay cheap.** `hooks/inject.js:11-13` currently promises "reads one file that is not there and exits". This plan makes it two. The comment is updated to say two; it must not become three.
- **Stage rules cap: `rulesFor(name).join('\n').length < 2000`,** asserted in `tests/stages.test.js:84`. `ALWAYS` is 655 characters of every stage's budget. Headroom today: survey 563, design 535, plan 485, **build 82**, verify 747, audit 721, land 663. Anything added to `ALWAYS` is spent seven times and `build` is where it runs out.
- **Every `TOKENS` key needs a `SCRIPTS` entry**, asserted in `tests/render.test.js:192-193`.
- **`templateFor(stage)` must equal the fenced block under the stage skill's `## Output`**, asserted in `tests/skills.test.js`. No template changes in this plan, so no skill `## Output` block may change either.
- **Badge word:** at most 16 characters, `[a-z0-9-]` only — `lib/badge.js:19,23-27`. `init` is 4.
- **Lead file:** keys are exactly `word, step, steps, title, where, guard, others` and each value is capped at 160 characters — `lib/badge.js:69-70`. `word` is mandatory; `writeLead` returns false without it.
- **TokenBar refuses `steps` outside 1..12** and this plan does not change that — `statusline.ps1:628`.
- **`TODO.md` entries are capped at 200 characters** — `scripts/todo-check.js:28`.
- **Indentation:** four spaces in `lib/`, `scripts/` and `hooks/`; two spaces in `tests/`. LF endings throughout.
- **Version:** 0.27.0 today. This lands as 0.28.0 in `package.json`, `.claude-plugin/plugin.json`, and the `version:` frontmatter of all eight `skills/*/SKILL.md`.
- **Baseline:** 576 tests, 0 failures, before any of this. `node --test "tests/*.test.js"`.

## Two corrections to the spec

Both are narrowings found while writing this plan. They are here rather than applied silently.

**1. The spec's fourth residue section is dropped.** It was "directories the walk enters that `git ls-files` never names" — the 75-versus-30 gap. Task 2 closes that gap by construction: once `lib/map.js` reads `trackedFiles`, no tool in the plugin walks past git any more, so a scanner reporting the gap would be reporting a bug that can no longer occur. It is replaced by **empty directories**, which git cannot represent at all and therefore nothing else can see.

**2. The tree is not indented by depth.** A directory holding no files of its own has no line to hang children under, so depth indentation would silently drop levels. Each directory gets one line carrying its full path, sorted, with its files under it. Same information, no missing rungs.

## File structure

| File | Responsibility |
|---|---|
| `lib/tracked.js` | **new.** The one answer to "what files are under this root": git first, a walk second. Nothing else in the plugin enumerates files. |
| `lib/badge.js` | gains `readBadge`. Still the only module that touches `modes/<session>/`. |
| `hooks/inject.js` | gains the `init` branch. Still the only writer of the badge on a prompt. |
| `scripts/survey.js` | keeps the scan and the report; the file walk leaves for `lib/tracked.js`. Gains `--max`, `--all`, `--tree`. |
| `lib/map.js` | keeps the map; loses its private enumerator. |
| `scripts/residue.js` | **new.** Four questions about the working tree, all answered by git. Reports, never deletes. |
| `lib/stages.js` | the rules. `ALWAYS[0]` and `survey`'s rules change; a `residue` token is added. |

## Task order

1 is independent. 2 must precede 3, 4 and 5. 6 is independent of all of them. 7 is a different repository.

---

### Task 1: the `init` badge

**Files:**
- Modify: `lib/badge.js` — add `readBadge`, export it
- Modify: `hooks/inject.js:11-13, 22, 49-65`
- Modify: `docs/statusline.md:19, 38`
- Test: `tests/badge.test.js`, `tests/inject.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `readBadge(claudeDir, sessionId) -> string|null`, exported from `lib/badge.js`.

- [ ] **Step 1: Write the failing test for `readBadge`**

In `tests/badge.test.js`, add `readBadge` to the require on line 9, then append:

```js
test('readBadge returns the word on disk, and null for everything else', () => {
  const dir = tmpdir();
  assert.equal(readBadge(dir, SID), null, 'no file yet');
  writeBadge(dir, SID, 'init');
  assert.equal(readBadge(dir, SID), 'init');
  writeBadge(dir, SID, 'survey');
  assert.equal(readBadge(dir, SID), 'survey');
  assert.equal(readBadge(dir, 'not-a-session-id'), null, 'a rejected id is not a read');
});
```

The helper that makes a temp directory in that file is at line 14; use whatever name it already has rather than adding a second one.

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/badge.test.js
```
Expected: `TypeError: readBadge is not a function`.

- [ ] **Step 3: Add `readBadge`**

In `lib/badge.js`, directly after `writeBadge`:

```js
// The word on disk, or null. One caller: `hooks/inject.js` has to know whether a
// badge belonging to no task is one it wrote itself, because clearing somebody
// else's flag is worse than leaving a stale one of your own.
//
// The same shape as every other reader here — it never throws, never creates, and
// answers null for a file that is missing, unreadable or empty.
function readBadge(claudeDir, sessionId) {
    const file = badgePath(claudeDir, sessionId);
    if (!file) return null;
    try {
        return fs.readFileSync(file, 'utf8').trim() || null;
    } catch (e) {
        return null;
    }
}
```

Add `readBadge` to `module.exports`, between `writeBadge` and `clearBadge`.

- [ ] **Step 4: Run it and watch it pass**

```
node --test tests/badge.test.js
```
Expected: all pass.

- [ ] **Step 5: Write the failing tests for the hook**

In `tests/inject.test.js`, append:

```js
const badgeOf = (cfg, sid) => path.join(cfg, 'modes', sid, 'fankeel');

test('a /fankeel prompt with no entry raises the init badge', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  assert.equal(run({ session_id: MINE, cwd: root, prompt: '/fankeel @Waypoint' }, cfg), '');
  assert.equal(fs.readFileSync(badgeOf(cfg, MINE), 'utf8').trim(), 'init');
  const lead = leadOf(cfg, MINE);
  assert.match(lead, /^word=init$/m);
  assert.match(lead, /^step=0$/m);
  assert.match(lead, /^steps=7$/m);
});

test('the plugin-qualified form raises it too, and fankeel-audit does not', () => {
  const root = tmp('fankeel-hook-');
  const yes = tmp('fankeel-cfg-');
  run({ session_id: MINE, cwd: root, prompt: '/fankeel:fankeel look at this' }, yes);
  assert.equal(fs.readFileSync(badgeOf(yes, MINE), 'utf8').trim(), 'init');

  const no = tmp('fankeel-cfg-');
  run({ session_id: MINE, cwd: root, prompt: '/fankeel-audit' }, no);
  assert.equal(fs.existsSync(path.join(no, 'modes', MINE)), false, 'audit starts no task');
});

test('an ordinary prompt with no entry writes nothing at all', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  run({ session_id: MINE, cwd: root, prompt: 'what does this repository do' }, cfg);
  assert.equal(fs.existsSync(path.join(cfg, 'modes', MINE)), false);
});

test('an init badge is taken down by the next ordinary prompt', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  run({ session_id: MINE, cwd: root, prompt: '/fankeel' }, cfg);
  assert.equal(fs.existsSync(badgeOf(cfg, MINE)), true);
  run({ session_id: MINE, cwd: root, prompt: 'never mind' }, cfg);
  assert.equal(fs.existsSync(badgeOf(cfg, MINE)), false);
  assert.equal(fs.existsSync(badgeOf(cfg, MINE) + '.lead'), false);
});

test('a badge another plugin owns is not cleared by this one', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  const dir = path.join(cfg, 'modes', MINE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'fankeel'), 'survey\n');
  run({ session_id: MINE, cwd: root, prompt: 'unrelated' }, cfg);
  assert.equal(fs.readFileSync(path.join(dir, 'fankeel'), 'utf8').trim(), 'survey',
    'no entry and no init word means leave it alone');
});
```

- [ ] **Step 6: Run them and watch them fail**

```
node --test tests/inject.test.js
```
Expected: the first four fail — nothing is written, so `readFileSync` throws `ENOENT`. The fifth passes already; it is there to pin the behaviour the new branch must not break.

- [ ] **Step 7: Change the hook**

In `hooks/inject.js`, extend the require on line 22:

```js
const { positionIn, FULL_ROUTE } = require('../lib/stages.js');
```

After `claudeConfigDir` (line 31), add:

```js
// The one prompt trying to turn the mode on. Everything else in this hook keys
// off the registry, and at this moment there is nothing in it: `/fankeel` runs
// orient, reads the map and runs the scanner before it writes an entry, and on a
// large project that is minutes of a statusline saying nothing at all.
//
// `/fankeel-audit` deliberately does not match. It starts no task, so a badge for
// it would have nothing to become.
const startsFankeel = (prompt) =>
    /^[/@$]fankeel(:fankeel)?(\s|$)/i.test(String(prompt == null ? '' : prompt).trim());
```

Replace the whole block at lines 49-65 with:

```js
    const mine = registry.readSession(root, sessionId);
    if (!mine || mine.active !== true) {
        const dir = claudeConfigDir();
        if (dir) {
            try {
                if (!mine && startsFankeel(payload.prompt)) {
                    // Step 0 of a route nobody has chosen. Seven is the default
                    // `task.js start` uses when no class is given, and the real
                    // route replaces it the moment one is picked.
                    badge.writeBadge(dir, sessionId, 'init');
                    badge.writeLead(dir, sessionId, { word: 'init', step: 0, steps: FULL_ROUTE.length });
                } else if (mine || badge.readBadge(dir, sessionId) === 'init') {
                    // An entry that exists but is stood down means this session
                    // *was* in the mode and its badge still says otherwise. An
                    // `init` with no entry behind it is one this hook raised for a
                    // `/fankeel` that never started anything. Only those two.
                    badge.clearBadge(dir, sessionId);
                    badge.clearLead(dir, sessionId);
                }
            } catch (e) { /* housekeeping */ }
        }
        return;
    }
```

Update the header comment at lines 11-13 to say two files rather than one:

```js
// A session not in the mode must stay cheap. No entry and an ordinary prompt, and
// the process reads two files that are not there and exits — the registry entry
// and its own statusline flag — with no directories created, no flags written and
// no output.
```

- [ ] **Step 8: Run them and watch them pass**

```
node --test tests/inject.test.js tests/badge.test.js
```
Expected: all pass, including every test that was already there.

- [ ] **Step 9: Say it in the documentation**

In `docs/statusline.md`, extend the badge list on line 19 with `[FANKEEL:INIT]` at the front, and after the paragraph at line 38 add:

```markdown
`init` is the exception that proves it. It is not a stage — it is the moment
between `/fankeel` being submitted and a task existing, which on a large project
is minutes of orienting, mapping and scanning. The hook raises it from
`payload.prompt` before there is any registry entry to read, and `task.js start`
overwrites it with `survey`. It has no colour in TokenBar's palette on purpose:
neutral is the correct colour for "not yet a stage", and giving it a stage colour
would claim it is one.
```

- [ ] **Step 10: Commit**

```
git add lib/badge.js hooks/inject.js docs/statusline.md tests/badge.test.js tests/inject.test.js
git commit -m "feat: the badge appears when the prompt does, not when the task does"
```

---

### Task 2: one enumerator

**Files:**
- Create: `lib/tracked.js`
- Modify: `scripts/survey.js:104-224, 376` — the walk leaves, the require arrives
- Modify: `scripts/docs-check.js:24`, `scripts/orient.js:24`, `scripts/docs-audit.js:30`
- Modify: `lib/map.js:17-19, 65-88`
- Test: `tests/map.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `lib/tracked.js` exporting `trackedFiles(root) -> {files: string[], repos: string[], walked: boolean, truncated: boolean} | null`, plus `isRepo(dir) -> boolean`, `gitFiles(dir) -> string[]|null`, and the constants `SKIP_DIRS`, `SKIP_EXT`, `MAX_WALK_FILES`.

- [ ] **Step 1: Write the failing test**

In `tests/map.test.js`, append:

```js
test('a worktree checked out under a dot-directory is not the project', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-map-git-'));
  const run = (args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  run(['init', '-q']);
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 'T']);
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'real.md'), '# real\n');
  run(['add', '-A']);
  run(['commit', '-qm', 'first']);

  // Untracked, unignored, and full of markdown — the shape that made this
  // project's own map count 75 documents where docs-check counted 30.
  const stale = path.join(root, '.claude', 'worktrees', 'old', 'docs');
  fs.mkdirSync(stale, { recursive: true });
  fs.writeFileSync(path.join(stale, 'ghost.md'), '# ghost\n');
  fs.writeFileSync(path.join(stale, 'ghost2.md'), '# ghost2\n');

  const found = markdownUnder(root);
  assert.deepEqual(found, ['docs/real.md']);
});
```

Add `markdownUnder` to what `tests/map.test.js` requires from `../lib/map.js`, and `execFileSync` from `node:child_process` if it is not already imported. If `lib/map.js` does not export `markdownUnder`, export it — this test is the reason it becomes worth exporting.

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/map.test.js
```
Expected: FAIL, three files found where one was expected.

- [ ] **Step 3: Create `lib/tracked.js`**

Move **lines 95 to 214 of `scripts/survey.js`** verbatim, comments and all. That
is one contiguous block — the comment above `gitFiles` down to the closing brace
of `trackedFiles` — holding, in order:

| symbol | starts at |
|---|---|
| `gitFiles` | 103, with its comment from 95 |
| `SKIP_DIRS` | 132, with its comment from 122 |
| `SKIP_EXT` | 144 |
| `MAX_WALK_FILES` | 155 |
| `isRepo` | 157 |
| `walk` | 163 |
| `trackedFiles` | 206, ending at 214 |

Nothing above or below moves. `MAX_PER_SECTION` and `MAX_FILE_BYTES` (lines
25-26), `isDoc` (line 93), `declPatterns`, `matches`, `scan`, `section`,
`report` and `parseArgs` all stay where they are: they are about terms and
declarations, not about which files exist.

Head the new file:

```js
'use strict';

// What files are under this root, and where the answer came from.
//
// It lived in `scripts/survey.js` because the scanner was the first thing to need
// it. Then docs-check needed it, then orient, then docs-audit — and `lib/map.js`,
// which could not reach into `scripts/` from `lib/`, grew a second walk of its
// own instead. The two then disagreed: on this repository the map counted 75
// markdown files where docs-check counted 30, and six of the difference were
// filed as the project's own intent.
//
// So it lives here, where everything can reach it, and there is one answer.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
```

End it:

```js
module.exports = { trackedFiles, isRepo, gitFiles, SKIP_DIRS, SKIP_EXT, MAX_WALK_FILES };
```

- [ ] **Step 4: Point the callers at it**

In `scripts/survey.js`, delete the moved code and add after the existing requires:

```js
const { trackedFiles, isRepo, gitFiles, MAX_WALK_FILES } = require('../lib/tracked.js');
```

Leave `module.exports` on line 376 as it is. It still re-exports `trackedFiles`, `isRepo` and `gitFiles`, so `tests/survey.test.js` needs no change and neither does anything else importing from there today.

In `scripts/docs-check.js:24`, `scripts/orient.js:24` and `scripts/docs-audit.js:30`, change `require('./survey.js')` to `require('../lib/tracked.js')`, keeping each file's existing destructuring exactly as it is.

- [ ] **Step 5: Switch the map**

In `lib/map.js`, add to the requires:

```js
const { trackedFiles } = require('./tracked.js');
```

Delete the `SKIP` constant (line 69) and replace `markdownUnder` (lines 71-88) with:

```js
// Every markdown file under the root, repo-relative, forward-slashed — the same
// list docs-check and docs-audit read. Three tools counting three different
// numbers is how an abandoned worktree ended up filed as this project's intent.
//
// The walk this replaced was here so that a project which is not a repository
// still gets a map. `trackedFiles` is git first and a walk second, so that reason
// is still met — and met better, because its walk skips every dot-directory
// rather than a fixed list of seven names.
function markdownUnder(root) {
    const found = trackedFiles(root);
    if (!found) return [];
    return found.files.filter((rel) => /\.md$/i.test(rel)).sort();
}
```

Add `markdownUnder` to `lib/map.js`'s `module.exports`.

- [ ] **Step 6: Run everything**

```
node --test "tests/*.test.js"
```
Expected: 577 or more tests, 0 failures. Every existing test must still pass — this task changes no behaviour except the map's file list.

- [ ] **Step 7: Check it by hand on this repository**

```
node scripts/map.js --root . && node scripts/docs-check.js --root .
```
Expected: both say **30 markdown files**. Before this task the first said 75.

- [ ] **Step 8: Commit**

```
git add lib/tracked.js lib/map.js scripts/survey.js scripts/docs-check.js scripts/orient.js scripts/docs-audit.js tests/map.test.js
git commit -m "refactor: one answer to which files are under this root"
```

---

### Task 3: `--max` and `--all`

**Files:**
- Modify: `scripts/survey.js:25, 288-297, 299-348, 352-371`
- Modify: `TODO.md:14` — delete the entry
- Test: `tests/survey.test.js`

**Interfaces:**
- Consumes: `lib/tracked.js` from Task 2.
- Produces: `parseArgs(argv) -> {root, terms, max, tree}`; `report(result, terms, opts)` where `opts` is `{max, tree, root}` and every field is optional.

- [ ] **Step 1: Write the failing test**

In `tests/survey.test.js`, append:

```js
test('--max sets the per-section cap and says what it dropped', () => {
  const { parseArgs } = require('../scripts/survey.js');
  assert.equal(parseArgs(['--max', '2', 'badge']).max, 2);
  assert.deepEqual(parseArgs(['--max', '2', 'badge']).terms, ['badge']);
  assert.equal(parseArgs(['--all']).max, Infinity);
  assert.equal(parseArgs(['badge']).max, 25, 'the default is unchanged');
  assert.equal(parseArgs(['--max', 'nonsense']).max, 25, 'a bad value keeps the default');
});

test('the cap actually caps, and --all lifts it', () => {
  const { scan, report } = require('../scripts/survey.js');
  const root = path.join(__dirname, '..');
  const result = scan(root, ['function']);
  const capped = report(result, ['function'], { max: 2 });
  assert.match(capped, /\.\.\. and \d+ more, not listed/);
  const all = report(result, ['function'], { max: Infinity });
  assert.equal(/more, not listed/.test(all), false);
  assert.match(all, /cap: none/);
});
```

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/survey.test.js
```
Expected: FAIL — `parseArgs(...).max` is `undefined`.

- [ ] **Step 3: Make the cap an argument**

In `scripts/survey.js`, rename the constant on line 25:

```js
// The default, not the law. `--max N` and `--all` move it, because a report that
// silently stops at 25 answers a different question than the one that was asked —
// and on a large repository the tail it cuts is where the answer usually is.
const DEFAULT_MAX = 25;
```

Change `section` to take the cap:

```js
function section(title, rows, render, max) {
    if (!rows.length) return [];
    const out = [title];
    for (const row of rows.slice(0, max)) out.push('  ' + render(row));
    if (rows.length > max) {
        out.push('  ... and ' + (rows.length - max) + ' more, not listed');
    }
    out.push('');
    return out;
}
```

`Array.prototype.slice(0, Infinity)` returns the whole array and `rows.length > Infinity` is false, so `--all` needs no special case.

Change `report`'s signature and its three `section` calls:

```js
function report(result, terms, opts) {
    const max = (opts && opts.max) || DEFAULT_MAX;
```

and each call gains `, max` as its fourth argument. In the `note` array, after the `source:` line:

```js
    if (max !== DEFAULT_MAX) note.push('cap: ' + (max === Infinity ? 'none' : max) + ' per section');
```

- [ ] **Step 4: Teach `parseArgs` the flags**

```js
function parseArgs(argv) {
    let root = process.cwd();
    let max = DEFAULT_MAX;
    const terms = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root') {
            if (argv[i + 1]) root = argv[++i];
            continue;
        }
        // A value that is not a positive number leaves the default in place
        // rather than erroring. The header line says which cap was used, so a
        // typo is visible in the report instead of in a stack trace.
        if (argv[i] === '--max') {
            const n = parseInt(argv[i + 1], 10);
            if (Number.isFinite(n) && n > 0) { max = n; i++; }
            continue;
        }
        if (argv[i] === '--all') { max = Infinity; continue; }
        if (argv[i].startsWith('--')) continue;
        const term = String(argv[i]).toLowerCase().trim();
        if (term && !terms.includes(term)) terms.push(term);
    }
    return { root, terms, max };
}

function main(argv) {
    const { root, terms, max } = parseArgs(argv);
    return report(scan(root, terms), terms, { max });
}
```

- [ ] **Step 5: Run it and watch it pass**

```
node --test tests/survey.test.js
```
Expected: all pass, including everything already there — `report(result, terms)` with no third argument still uses 25.

- [ ] **Step 6: Close the TODO entry**

Delete line 14 of `TODO.md` — *"The declarations cap in scripts/survey.js..."*. Then:

```
node scripts/todo-check.js
```
Expected: exit 0.

- [ ] **Step 7: Commit**

```
git add scripts/survey.js tests/survey.test.js TODO.md
git commit -m "feat: the cap on the scanner is a default, not the law"
```

---

### Task 4: `--tree`

**Files:**
- Modify: `scripts/survey.js` — add `human`, `treeLines`, wire `--tree` through `parseArgs`, `main` and `report`
- Test: `tests/survey.test.js`

**Interfaces:**
- Consumes: `parseArgs` and `report(result, terms, opts)` from Task 3; `trackedFiles` from Task 2.
- Produces: `treeLines(root, files, max) -> string[]`, exported for the test.

- [ ] **Step 1: Write the failing test**

In `tests/survey.test.js`, append:

```js
test('--tree lists every directory with its files and their sizes', () => {
  const { treeLines, parseArgs } = require('../scripts/survey.js');
  assert.equal(parseArgs(['--tree']).tree, true);
  assert.equal(parseArgs([]).tree, false);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-tree-'));
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'a.js'), 'x'.repeat(2048));
  fs.writeFileSync(path.join(root, 'lib', 'b.js'), 'y'.repeat(10));
  fs.writeFileSync(path.join(root, 'top.md'), 'z');

  const out = treeLines(root, ['lib/a.js', 'lib/b.js', 'top.md'], 25).join('\n');
  assert.match(out, /^tree — 3 files/m);
  assert.match(out, /lib\/\s+2 files/);
  assert.match(out, /a\.js\s+2\.0K/);
  assert.match(out, /top\.md\s+1B/);

  const capped = treeLines(root, ['lib/a.js', 'lib/b.js', 'top.md'], 1).join('\n');
  assert.match(capped, /\.\.\. and 1 more, not listed/);
});
```

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/survey.test.js
```
Expected: FAIL — `treeLines is not a function`.

- [ ] **Step 3: Write it**

In `scripts/survey.js`, before `report`:

```js
const human = (n) => (n < 1024 ? n + 'B'
    : n < 1024 * 1024 ? (n / 1024).toFixed(1) + 'K'
    : (n / (1024 * 1024)).toFixed(1) + 'M');

// The shape of the tree rather than what is declared in it — for the case the
// scanner cannot serve, which is a project big enough that no set of search terms
// tells you where anything lives.
//
// One line per directory, carrying its full path, then its files under it.
// Indenting by depth was the alternative and it drops rungs: a directory holding
// no files of its own has no line for its children to hang under, so the level
// vanishes and the reader is not told.
//
// This is the one section that costs a stat per file, and it runs only when asked.
function treeLines(root, files, max) {
    const dirs = new Map();
    let total = 0;
    for (const rel of files) {
        const cut = rel.lastIndexOf('/');
        const dir = cut === -1 ? '.' : rel.slice(0, cut);
        let size = 0;
        try {
            size = fs.statSync(path.join(root, rel)).size;
        } catch (e) {
            size = 0;
        }
        total += size;
        if (!dirs.has(dir)) dirs.set(dir, []);
        dirs.get(dir).push({ name: rel.slice(cut + 1), size });
    }

    const out = ['tree — ' + files.length + ' files, ' + human(total), ''];
    for (const dir of [...dirs.keys()].sort()) {
        const list = dirs.get(dir);
        const bytes = list.reduce((sum, f) => sum + f.size, 0);
        out.push('  ' + (dir === '.' ? './' : dir + '/') + '   ' + list.length + ' files  ' + human(bytes));
        for (const f of list.slice(0, max)) out.push('    ' + f.name + '  ' + human(f.size));
        if (list.length > max) out.push('    ... and ' + (list.length - max) + ' more, not listed');
    }
    out.push('');
    return out;
}
```

In `report`, after the three existing `section` calls:

```js
    if (opts && opts.tree && opts.root) lines.push(...treeLines(opts.root, result.files, max));
```

`scan` must return the file list for this to work. Add `files` to the object it returns on line 285:

```js
    return { total: files.length, files, repos, walked, truncated, decls, docs, named };
```

In `parseArgs`, add `let tree = false;` and:

```js
        if (argv[i] === '--tree') { tree = true; continue; }
```

returning `{ root, terms, max, tree }`. In `main`:

```js
function main(argv) {
    const { root, terms, max, tree } = parseArgs(argv);
    return report(scan(root, terms), terms, { max, tree, root });
}
```

Add `treeLines` and `human` to `module.exports`.

- [ ] **Step 4: Run it and watch it pass**

```
node --test tests/survey.test.js
```
Expected: all pass.

- [ ] **Step 5: Check it by hand**

```
node scripts/survey.js --root . --tree --all badge
```
Expected: the usual three sections uncapped, then a `tree — 89 files, ...` section listing every directory in this repository.

- [ ] **Step 6: Commit**

```
git add scripts/survey.js tests/survey.test.js
git commit -m "feat: the scanner can show the shape as well as the declarations"
```

---

### Task 5: `scripts/residue.js`

**Files:**
- Create: `scripts/residue.js`
- Modify: `lib/stages.js:240-247` — a `residue` token; the `audit` rules — one line
- Modify: `lib/render.js:22-30` — a `RESIDUE_SCRIPT` and its `SCRIPTS` entry
- Modify: `skills/fankeel-audit/SKILL.md` — the third scanner
- Modify: `docs/documents.md` — what the third scanner asks
- Test: `tests/residue.test.js` (new)

**Interfaces:**
- Consumes: `trackedFiles` and `isRepo` from `lib/tracked.js` (Task 2).
- Produces: `scan(root) -> {repo, undecided, worktrees, weight, empty, branch} | null`, `report(result) -> string`, `defects(result) -> number`, `main(argv) -> string`, `parseArgs(argv) -> {root}`. Exit code is `defects(result) > 0 ? 1 : 0`.

- [ ] **Step 1: Write the failing test**

Create `tests/residue.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { scan, report, defects } = require('../scripts/residue.js');

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-residue-'));
  const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'T']);
  fs.writeFileSync(path.join(root, 'kept.txt'), 'kept\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'first']);
  return { root, git };
}

test('a clean repository is clean', () => {
  const { root } = repo();
  const result = scan(root);
  assert.equal(result.repo, true);
  assert.deepEqual(result.undecided, []);
  assert.equal(defects(result), 0);
});

test('untracked and unignored is a defect; ignored is not', () => {
  const { root, git } = repo();
  fs.mkdirSync(path.join(root, 'scratch'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scratch', 'note.txt'), 'x\n');
  fs.writeFileSync(path.join(root, '.gitignore'), 'heavy/\n');
  fs.mkdirSync(path.join(root, 'heavy'), { recursive: true });
  fs.writeFileSync(path.join(root, 'heavy', 'blob.bin'), 'z'.repeat(4096));
  git(['add', '.gitignore']);
  git(['commit', '-qm', 'ignore heavy']);

  const result = scan(root);
  assert.ok(result.undecided.includes('scratch/'), 'scratch/ is undecided');
  assert.equal(result.undecided.includes('heavy/'), false, 'ignored is not undecided');
  assert.ok(result.weight.some((w) => w.path === 'heavy/' && w.bytes >= 4096));
  assert.equal(defects(result) > 0, true);
  assert.match(report(result), /nobody has decided/);
});

test('an empty directory is context, not a defect', () => {
  const { root } = repo();
  fs.mkdirSync(path.join(root, 'hollow'), { recursive: true });
  const result = scan(root);
  assert.ok(result.empty.includes('hollow'));
  assert.equal(defects(result), 0, 'git cannot represent it, so nobody chose it');
});

test('outside a repository it says so and judges nothing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-norepo-'));
  const result = scan(root);
  assert.equal(result.repo, false);
  assert.equal(defects(result), 0);
  assert.match(report(result), /not a git repository/);
});
```

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/residue.test.js
```
Expected: `Cannot find module '../scripts/residue.js'`.

- [ ] **Step 3: Write the scanner**

Create `scripts/residue.js`:

```js
#!/usr/bin/env node
'use strict';

// What nobody decided about.
//
// docs-check asks whether a reference still resolves. docs-audit asks whether a
// page is still true. Neither looks at the tree those files live in, and a
// directory whose fate nobody chose stays invisible until somebody notices it is
// 73 GB.
//
// Everything here comes from git, and that is the whole design. There is no
// heuristic for "unused" and no list of suspicious filenames: a path is undecided
// because nobody committed it and nobody ignored it, which is a fact about the
// repository rather than a guess about intent.
//
// It reports. It never deletes, never moves and never writes a .gitignore — the
// audit gate offers the cleanup and the user chooses, exactly as it does for a
// document.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { isRepo } = require('../lib/tracked.js');

const MAX_PER_SECTION = 25;

// Best effort, like every other shell-out in this plugin. A git that is missing,
// too old for a flag, or refusing for a reason of its own gives back null, and
// the section it feeds is simply absent from the report.
function git(root, args) {
    try {
        return execFileSync('git', args, {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            maxBuffer: 32 * 1024 * 1024,
        }).split(/\r?\n/).filter(Boolean);
    } catch (e) {
        return null;
    }
}

// Recursive, and capped. A `release/` directory of 73 GB is the case this exists
// for, and walking it fully to add up bytes would cost more than the answer.
const MAX_SIZE_ENTRIES = 20000;

function sizeOf(dir) {
    let bytes = 0;
    let seen = 0;
    const stack = [dir];
    while (stack.length && seen < MAX_SIZE_ENTRIES) {
        // Held in a binding rather than read back off the entry. `Dirent.parentPath`
        // only exists from Node 20.12, this package declares no engine floor, and
        // the wrong parent silently sizes the wrong directory.
        const here = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(here, { withFileTypes: true });
        } catch (e) {
            continue;
        }
        for (const entry of entries) {
            seen++;
            const full = path.join(here, entry.name);
            if (entry.isDirectory()) stack.push(full);
            else if (entry.isFile()) {
                try {
                    bytes += fs.statSync(full).size;
                } catch (e) { /* vanished mid-walk */ }
            }
        }
    }
    return { bytes, partial: seen >= MAX_SIZE_ENTRIES };
}

// Directories holding no files at any depth. Git cannot represent one, so it is
// the one kind of residue no other scanner here can see — and the reason it is
// context rather than a defect is the same fact: nobody chose it, because there
// was never anything to choose.
function emptyDirs(root) {
    const found = [];
    const walk = (rel) => {
        const full = rel ? path.join(root, rel) : root;
        let entries;
        try {
            entries = fs.readdirSync(full, { withFileTypes: true });
        } catch (e) {
            return false;
        }
        let hasFile = false;
        for (const entry of entries) {
            if (entry.name === '.git') continue;
            const sub = rel ? rel + '/' + entry.name : entry.name;
            if (entry.isDirectory()) {
                if (walk(sub)) hasFile = true;
            } else {
                hasFile = true;
            }
        }
        if (!hasFile && rel) found.push(rel);
        return hasFile;
    };
    walk('');
    return found.sort();
}

function worktreesOf(root) {
    const lines = git(root, ['worktree', 'list', '--porcelain']);
    if (!lines) return [];
    const all = [];
    let current = null;
    for (const line of lines) {
        if (line.startsWith('worktree ')) {
            current = { path: line.slice('worktree '.length), branch: null };
            all.push(current);
        } else if (line.startsWith('branch ') && current) {
            current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
        }
    }
    // The first entry is the main working tree — the one you are standing in.
    return all.slice(1);
}

function scan(root) {
    if (!isRepo(root)) {
        return { repo: false, branch: null, undecided: [], worktrees: [], weight: [], empty: [] };
    }

    const branch = ((git(root, ['rev-parse', '--abbrev-ref', 'HEAD']) || [])[0] || 'HEAD').trim();
    const undecided = git(root, ['ls-files', '--others', '--exclude-standard', '--directory']) || [];
    const ignored = git(root, ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory']) || [];

    // Merged into what you are on, not into a guessed default. Which branch is
    // "the" branch is a question this cannot answer without inventing an answer,
    // and the report names the one it used.
    const merged = new Set((git(root, ['branch', '--merged', 'HEAD', '--format=%(refname:short)']) || [])
        .map((s) => s.trim()).filter(Boolean));

    const worktrees = worktreesOf(root)
        .filter((w) => w.branch && merged.has(w.branch))
        .map((w) => ({ path: w.path, branch: w.branch }));

    const weight = ignored
        .map((rel) => {
            const full = path.join(root, rel);
            let stat;
            try {
                stat = fs.statSync(full);
            } catch (e) {
                return null;
            }
            if (!stat.isDirectory()) return { path: rel, bytes: stat.size, partial: false };
            const size = sizeOf(full);
            return { path: rel, bytes: size.bytes, partial: size.partial };
        })
        .filter(Boolean)
        .sort((a, b) => b.bytes - a.bytes);

    return { repo: true, branch, undecided, worktrees, weight, empty: emptyDirs(root) };
}

const human = (n) => (n < 1024 ? n + 'B'
    : n < 1024 * 1024 ? (n / 1024).toFixed(1) + 'K'
    : n < 1024 * 1024 * 1024 ? (n / (1024 * 1024)).toFixed(1) + 'M'
    : (n / (1024 * 1024 * 1024)).toFixed(1) + 'G');

const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

function section(lines, title, rows) {
    if (!rows.length) return;
    lines.push('', title);
    for (const row of rows.slice(0, MAX_PER_SECTION)) lines.push('  ' + row);
    if (rows.length > MAX_PER_SECTION) {
        lines.push('  ... and ' + (rows.length - MAX_PER_SECTION) + ' more, not listed');
    }
}

// Only the first two sections fail the run. A command that always exits non-zero
// has an exit code that means nothing, and the weight of a build directory is a
// fact about the project rather than a fault in it.
function defects(result) {
    return result.undecided.length + result.worktrees.length;
}

function report(result) {
    if (!result.repo) {
        return 'fankeel residue — not a git repository.\n'
             + 'Every judgement here comes from what is committed and what is ignored, and\n'
             + 'without those there is nothing to compare against. Nothing is reported.';
    }

    const lines = ['fankeel residue — on ' + result.branch];

    section(lines, plural(result.undecided.length, 'path', 'paths') + ' nobody has decided about — not committed, not ignored:',
        result.undecided);
    section(lines, plural(result.worktrees.length, 'worktree is', 'worktrees are') + ' already merged into ' + result.branch + ':',
        result.worktrees.map((w) => w.path + '  (' + w.branch + ')'));
    section(lines, plural(result.weight.length, 'ignored path carries', 'ignored paths carry') + ' weight:',
        result.weight.map((w) => w.path + '  ' + human(w.bytes) + (w.partial ? '  (at least)' : '')));
    section(lines, plural(result.empty.length, 'directory holds', 'directories hold') + ' no files at any depth:',
        result.empty);

    if (!defects(result)) lines.push('', 'Nothing undecided and no spent worktrees.');
    lines.push('', 'Undecided paths and merged worktrees are defects: somebody has to commit,');
    lines.push('ignore or delete each one. Weight and empty directories are context. Nothing');
    lines.push('here is deleted by this command — the audit gate offers the cleanup.');
    return lines.join('\n');
}

function parseArgs(argv) {
    let root = process.cwd();
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root' && argv[i + 1]) root = argv[++i];
    }
    return { root };
}

function main(argv) {
    const { root } = parseArgs(argv);
    return report(scan(root));
}

if (require.main === module) {
    const { root } = parseArgs(process.argv.slice(2));
    const result = scan(root);
    process.stdout.write(report(result) + '\n');
    process.exit(defects(result) > 0 ? 1 : 0);
}

module.exports = { scan, report, defects, parseArgs, main, human };
```

- [ ] **Step 4: Run it and watch it pass**

```
node --test tests/residue.test.js
```
Expected: four tests, 0 failures.

- [ ] **Step 5: Run it on this repository**

```
node scripts/residue.js --root .
```
Expected: `.claude/worktrees/` under undecided, `worktree-registry-staleness` under merged worktrees, `.superpowers/` and `.fankeel/sessions/` under weight. Exit code 1.

- [ ] **Step 6: Wire the token**

In `lib/stages.js`, add to `TOKENS` (line 240):

```js
    residue: '{{RESIDUE}}',
```

In `lib/render.js`, beside the other script paths (lines 22-30):

```js
const RESIDUE_SCRIPT = path.join(__dirname, '..', 'scripts', 'residue.js');
```

and add `residue: RESIDUE_SCRIPT` to the `SCRIPTS` object on line 30.

In `lib/stages.js`, add to the `audit` stage's `rules`, immediately after the `docs-check` rule:

```js
            'Run `node {{RESIDUE}}` and quote it. Untracked and unignored is a decision nobody made; a merged worktree is one already spent. Weight and empty directories are context.',
```

That rule is 169 characters against 721 of headroom, taking `audit` to 1459.

- [ ] **Step 7: Run everything**

```
node --test "tests/*.test.js"
```
Expected: 0 failures. `tests/render.test.js:192` proves the new token has a script; `tests/stages.test.js:84` proves `audit` still fits under 2000.

- [ ] **Step 8: Say it in the skill and the documentation**

In `skills/fankeel-audit/SKILL.md`, under `## Run both` — retitled `## Run all three` — add the command and a sentence:

```markdown
node <plugin>/scripts/residue.js [--root <dir>]
```

> The third question, and the only one that is not about documents: what is in
> this tree that nobody decided about? Untracked and unignored means somebody has
> to commit it, ignore it or delete it and nobody has. A worktree whose branch is
> already merged is one that has been spent. Weight and empty directories are
> context — a 73 GB build directory is not a bug, but not knowing about it is.
>
> It never deletes. Offer the cleanup at the gate, name the paths, and let the
> user choose — the same contract every scanner here has.

In `docs/documents.md`, add a row to the table of scanners naming `residue.js` and what it asks.

- [ ] **Step 9: Commit**

```
git add scripts/residue.js tests/residue.test.js lib/stages.js lib/render.js skills/fankeel-audit/SKILL.md docs/documents.md
git commit -m "feat: a scanner for what nobody decided about"
```

---

### Task 6: the fourth gate option

**Files:**
- Modify: `lib/stages.js:53` — `ALWAYS[0]`; `lib/stages.js:85-90` — the `survey` rules
- Modify: `skills/fankeel/SKILL.md:286-291` — the option table
- Modify: `skills/fankeel-survey/SKILL.md` — the fourth option, and step 0
- Modify: `docs/pipeline.md:115, 195` — two copies of the rule
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: `--all` and `--tree` from Tasks 3 and 4 — the rule names them, so they must exist first.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the failing test**

In `tests/stages.test.js`, append:

```js
test('the three options are a floor, and survey alone has a fourth', () => {
  const { ALWAYS, rulesFor, NAMES } = require('../lib/stages.js');
  assert.match(ALWAYS[0], /at least/, 'three is the floor, not the list');

  const survey = rulesFor('survey').join(' ');
  assert.match(survey, /read wider/);
  assert.match(survey, /--all --tree/);

  for (const name of NAMES) {
    if (name === 'survey') continue;
    assert.equal(/read wider/.test(rulesFor(name).join(' ')), false, name + ' has no fourth option');
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/stages.test.js
```
Expected: FAIL on the first assertion.

- [ ] **Step 3: Make three a floor**

In `lib/stages.js`, `ALWAYS[0]` becomes:

```js
    'Never end a step silently or in prose. Ask with AskUserQuestion — next stage, stay, and pause at least, never dropping the pause. Option one is the approval: say what it approves.',
```

Ten characters more, spent on all seven stages. `build` goes from 82 characters of headroom to 72, measured.

- [ ] **Step 4: Give `survey` the fourth**

In `lib/stages.js`, add to the `survey` stage's `rules`, immediately before its `Read the fankeel-survey skill` rule:

```js
            'A fourth option belongs here and nowhere else: read wider — re-run the scanner with `--all --tree`, read what it names, ask again. Four is the AskUserQuestion ceiling.',
```

- [ ] **Step 5: Run it and watch it pass**

```
node --test tests/stages.test.js
```
Expected: all pass, including the 2000-character cap on every stage.

- [ ] **Step 6: Update the two skills**

In `skills/fankeel/SKILL.md`, the option table at lines 286-291 gains a row between option 1 and option 2:

```markdown
| option 2 (`survey` only) | read wider. Re-run the scanner uncapped and with the tree, read what it names, and come back to this same question. The stage does not change. | one sentence |
```

and options 2 and 3 become 3 and 4. Add below the table:

> Four is the ceiling, not a target. `AskUserQuestion` caps `options` at four, so
> a fifth does not exist — and three is the floor, because dropping the pause is
> how a gate stops being one. The fourth is `survey`'s alone until some other
> stage has a use for one.

In `skills/fankeel-survey/SKILL.md`, add a `### 0. Say it started` before step 1:

> The badge is already up. `hooks/inject.js` raises `[FANKEEL:INIT]` the moment a
> `/fankeel` prompt is submitted, before there is any registry entry to read, so
> the minutes this stage spends orienting and scanning are not minutes of silence.
> Nothing to run — it is there before you are.

and a section after step 4 describing the fourth option: what `--all --tree` costs, and that reading wide with a narrow answer is what a subagent is for.

Do not touch that file's `## Output` block. `tests/skills.test.js` pins it against `templateFor('survey')`, and the template does not change in this plan.

- [ ] **Step 7: Update the two copies in the documentation**

`docs/pipeline.md:115` and `:195` each quote `ALWAYS[0]` verbatim. Replace both with the new text, exactly as it now reads in `lib/stages.js`.

- [ ] **Step 8: Run everything**

```
node --test "tests/*.test.js"
```
Expected: 0 failures.

- [ ] **Step 9: Commit**

```
git add lib/stages.js skills/fankeel/SKILL.md skills/fankeel-survey/SKILL.md docs/pipeline.md tests/stages.test.js
git commit -m "feat: survey can be asked for more, and three is the floor"
```

---

### Task 7: TokenBar accepts a zero

**Files:**
- Modify: `F:\ymlab\TokenBar\statusline.ps1:622-628`
- Modify: `F:\ymlab\TokenBar\statusline.sh:468-474`

A different repository, with its own commit and its own version bump. Nothing under `~/.claude/` is edited by hand — `tokenbar-update.ps1` overwrites those from a release.

**Interfaces:**
- Consumes: the `step=0` written by Task 1. Without Task 1 there is nothing that sends a zero.
- Produces: nothing this repository reads.

- [ ] **Step 1: Check the current behaviour by hand**

```
printf 'word=init\nstep=0\nsteps=7\n' > "$HOME/.claude/modes/<this-session-id>/fankeel.lead"
```
Expected today: the lead line renders with no dots at all.

- [ ] **Step 2: PowerShell**

`statusline.ps1:628` becomes:

```powershell
    if ($of -lt 1 -or $of -gt 12 -or $n -lt 0 -or $n -gt $of) { return '' }
```

and the comment above it gains a sentence:

```powershell
# Filled to the current step, hollow after it. Only when the plugin said how many
# there are — inventing a denominator would draw a progress bar out of nothing.
#
# Zero is a legal step and means all hollow: a plugin that has started and not yet
# chosen a route. A denominator of zero is still nothing to draw.
```

- [ ] **Step 3: sh**

`statusline.sh:474` becomes:

```sh
       [ "$step" -ge 0 ] && [ "$step" -le "$steps" ]; then
```

with the same sentence added to the comment above it.

- [ ] **Step 4: Check both ports render the same thing**

```
powershell -NoProfile -File F:\ymlab\TokenBar\statusline.ps1 < payload.json
sh F:/ymlab/TokenBar/statusline.sh < payload.json
```
Expected: both show seven hollow circles for a lead file carrying `step=0 steps=7`.

- [ ] **Step 5: Commit in that repository**

```
git -C F:/ymlab/TokenBar add statusline.ps1 statusline.sh
git -C F:/ymlab/TokenBar commit -m "feat: step zero is all hollow, not no dots at all"
```

Ask before tagging or releasing. Installing it here is `tokenbar-update.ps1`, and that is the user's call rather than this task's.

---

## Self-review

**Spec coverage.** Section 1 of the spec is Task 1. Section 2's cap is Task 3, its tree is Task 4, its fourth option is Task 6. Section 3 is Task 5. Section 4 is Task 2. Section 5 is Task 7. Nothing in the spec has no task; two things in the spec were narrowed, and both are recorded at the top of this plan rather than dropped quietly.

**Placeholders.** None. Every code step carries the code. The one instruction that is not literal code is Task 6 step 6's "a section after step 4 describing the fourth option" — that is prose in a skill file, and its content is specified: what `--all --tree` costs, and that a wide read with a narrow answer is what a subagent is for.

**Type consistency.** `trackedFiles` keeps its exact signature and return shape across the move in Task 2. `readBadge(claudeDir, sessionId)` matches the argument order of `writeBadge`, `clearBadge` and `badgePath` in the same file. `report(result, terms, opts)` in `scripts/survey.js` and `report(result)` in `scripts/residue.js` are different functions in different modules and neither imports the other. `human` is defined twice — once in each script — and deliberately not shared: `residue.js` needs a `G` suffix that `survey.js` has no use for, and one shared formatter with an unused branch is worse than two short ones.

**One thing this plan does not decide.** Whether `.claude/worktrees/registry-staleness/` should be removed once `residue.js` names it. That is a deletion, it is the user's call, and `audit` is the stage where it gets offered.

---

## What it measured

Recorded here rather than in `docs/decisions/fankeel-shell.md`, which is written
once and not maintained. These are the numbers this work produced.

**Three of nine pairs were one sentence, copied.** `docs-audit`'s pairs section
matched `README.md`, `skills/fankeel-audit/SKILL.md` and `skills/fankeel/SKILL.md`
on `lib/badge.js`. None of the three describes that file — all three quote the
same illustrative sentence about what the pairs feature is *for*. The detector
counts a path appearing in prose as a page describing it, so a page that uses a
filename as an example is indistinguishable from one that documents it. That is
the first real evidence against the `TODO.md` entry asking whether the pairs are
the ones worth reading: a third of them were not.

The other six held. `hooks/touch.js` is described by three pages that agree with
each other and with the code — `PostToolUse` on `Edit|Write|NotebookEdit`, the
same matcher the guard uses.

**Two of seven tasks were sent back.** `verify` bounced four false documentation
claims this change had created, and then a real defect: `emptyDirs` reported every
level of a hollow branch while the comment above it claimed only the topmost, and
its own test asserted `includes('hollow')` — which passes either way. The rule
that sends half-built work back to `build` is what caught both.

**The rule budget after this**: survey 1615, design 1475, plan 1525, build 1928,
verify 1263, audit 1459, land 1347. The cap is 2000 and `build` has 72 characters
left, which is the number that decided the fourth gate option belongs to `survey`
alone rather than to `ALWAYS`.
