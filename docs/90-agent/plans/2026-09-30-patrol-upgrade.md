---
status: design-intent
last_verified: 2026-09-30
---

# Patrol upgrade Implementation Plan

**Goal:** Land the 2026-09-30 patrol's do-now items: the `titledIds` fallback, six moved citations, the build-section patrol assertion, `version.js --since`, and a `scripts/upgrade.js` with its `fankeel-upgrade` skill.
**Architecture:** Four independent code areas (`scripts/task.js`, `tests/skills.test.js`, `scripts/version.js`, the new `scripts/upgrade.js` and skill) grouped by `ledger.js groups` rather than ordered by hand. `upgrade.js` is a thin script over `lib/docs.js`, `lib/todo.js`, `scripts/todo-check.js` and `scripts/version.js`; it detects by the project's shape and writes one report. The citation fix runs after every task that moves a cited line, and the station render check is the user's, last.
**Tech Stack:** Node v24.9.0, CommonJS, zero npm dependencies, `node --test`; `git` on the path for the `--since` and report tests.
**Spec:** [2026-09-30-patrol-upgrade-design.md](2026-09-30-patrol-upgrade-design.md)

## Global Constraints

Generated from `node scripts/map.js` (428 markdown files, 3 planned-not-built, 190 retired, 9 undeclared), `.fankeel/map.md`, `package.json`, `.fankeel/profile.json`, `.fankeel/docs.json` and the tests. This repository has no `CLAUDE.md`.

- `package.json` has `"scripts": { "test": "node --test", "clean": "node scripts/tmp-clean.js" }`, version `0.84.0`, and no `"dependencies"`. Add none.
- CommonJS, `'use strict';` at the top of every module. Four-space indent in `lib/`, `scripts/`, `hooks/`, `assets/`; a test keeps the indent of the file it is in (two spaces in `tests/task-todo.test.js`, `tests/version.test.js`, `tests/upgrade.test.js`, `tests/contract.test.js`; four in `tests/inventory.test.js`).
- `lib/` reaches nothing in `scripts/` or `hooks/` (README tree, `lib/` row); scripts are thin wrappers over `lib/`, and `scripts/todo-check.js` already requires `scripts/docs-check.js`, so a script requiring a script is precedent.
- Every scratch directory in a test comes from `tests/tmp.js` (`tmp(prefix)`), which removes it at exit; a test that spawns a script passes `cwd: <fixture>` so it never reads this machine's registry (`tests/task-todo.test.js:19`).
- Skill frontmatter is pinned: the `name` equals the directory, `description` is over 60 and under 500 characters and says `Use for` or `Use when` (`tests/skills.test.js:77-83`); a skill named `fankeel-*` that mentions dispatching must say how many and on which model (`tests/skills.test.js:920`), so the new skill does not use the word.
- A skill marked `disable-model-invocation: true` names no other such skill, and only `fankeel-station` may name `/fankeel-station` (`tests/skills.test.js:96-108`, `:1351-1362`).
- `skills/` holds exactly the directories `tests/inventory.test.js` lists (`SKILLS`, hardcoded), and `tests/contract.test.js:280` counts the files carrying the version (13 now: two manifests and eleven skills); a twelfth skill makes it 14. The `rationale.md` split is only `fankeel-build`, `fankeel-plan`, `fankeel-audit` (`SPLIT`, `tests/skills.test.js:251`); `REQUIRED_CORE` is twelve real files under `scripts/` (`tests/skills.test.js:1103`) and is not extended.
- `tests/source.test.js` reads `git ls-files`: `git add` a new file before running it, and every export of a new script needs an importer that binds it.
- Plan limits: `FILE_CAP = 3` `Modify:` entries and `READ_CAP = 1500` lines per task (`lib/plantasks.js`), so a large file is written as `path:a-b`.
- The injected block cap `BLOCK_CAP = 2400` (`lib/render.js`) is never raised; none of these tasks touches an injected string.
- Commit subjects are `feat:` / `fix:` / `docs:` / `chore:` / `style:` / `test:` plus a lower-case sentence (git log). Land is a local merge, no push (`.fankeel/profile.json`: `land.integration: merge`, `land.push: false`).
- An implementer runs only its own test command; the parent runs `npm test` before committing a group (`scripts/ledger.js` brief footer).
- Never `git stash`, `git checkout`, `git reset`, `git clean` in this tree; never `find /`.
- The TODO entries these tasks deliver (`todo-4`, `test-2`) are closed by land with `todo.js done`, not edited by a task.

## Risks

- Task 2 puts `survey,build,land` into `skills/fankeel-build/SKILL.md` on disk until it reverts it; a neighbour running `tests/skills.test.js` in that window sees red — Task 2, and Task 5 which edits a skill list — Task 2 checks `git status --short` on both files first and ends with an empty `git diff --stat` on the skill.
- Task 1 adds 8 lines above `scripts/task.js:553` and the other cited lines, so the line numbers Task 7 writes are not the ones docs-check prints today — Task 7 — it runs docs-check first and copies what it prints.
- `upgrade.js` calls `todoCheck.main(['--migrate', '--root', root])`, which also runs `check()` on the migrated file — Task 4 — it runs its own test file first, where the fixtures are not in a git repository.
- `todo.js migrate` throws on a second run (`lib/todo.js:612`); `upgrade.js` must only print it — Task 4 — its test asserts the todo folder was not created by `--apply`.
- `version.js` is read by `upgrade.js` through `version.main(argv, pluginRoot)`, which also reads the plugin manifests — Task 4 — its fixtures carry both manifests.
- The three count tests and the prose in Task 6 move together; a miss is a red `tests/contract.test.js` or a page saying thirteen — Task 5 and Task 6 — Task 5 greps for `13` in the three test files first.
- docs-check may list a moved reference on a page other than the three named — Task 7 — it names the page, edits it, and says so in its return.

## Task 1: titledIds prints bare ids when the todo folder cannot be read

**Files:**
- Modify: `scripts/task.js:317-324` — `titledIds()` catches a failed `todoFiles.load` and returns the ids bare
- Read: `lib/todo.js` — `load()` and `readFolder()` throw on an unreadable folder or entry file
- Test: `tests/task-todo.test.js`

**Interfaces:**
- Consumes: none
- Produces: `titledIds(dir, ids)` in `scripts/task.js` returns `ids.slice()` when the folder cannot be read; `null` in TODO.md mode and `id：title` strings otherwise, as before

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus a red-green test.

Both callers (`describe()` and `todoLines()`) already handle a list of strings, so no caller changes. A directory named `broken-1.md` inside the todo folder is listed by `readdir` and throws `EISDIR` when read, which is the unreadable folder the test needs.

- [ ] **Step 1: Write the failing test.** In `tests/task-todo.test.js`, after the test named `a titled entry prints id：title, above its done line at land and under todo: in the description` and before `with no entry folder stage land prints no todo.js line`, add:

```js
test('an entry folder that cannot be read prints bare ids at start and at land instead of throwing', () => {
  const dir = root(true);
  // A directory where an entry file belongs: readdir lists it and reading it throws EISDIR.
  fs.mkdirSync(path.join(dir, 'docs', 'todo', 'broken-1.md'));
  const started = task(dir, ['start', '--task', 'close demo', '--route', 'build,land', '--todo', 'demo-1']);
  assert.match(started, /^ {2}todo:\n {4}demo-1$/m);
  const lines = task(dir, ['stage', 'land']).split('\n');
  const at = lines.findIndex((l) => l.includes('todo.js done demo-1'));
  assert.ok(at > 0, 'the done line is printed');
  assert.equal(lines[at - 1], '  demo-1');
});
```

- [ ] **Step 2: Run it and watch it fail.**

```sh
node --test tests/task-todo.test.js
```

Expected: the new test fails with a stack ending in `code: 'EISDIR'` from `readFolder`; the others pass.

- [ ] **Step 3: Write the minimal implementation.** In `scripts/task.js`, replace the comment and function `titledIds` (lines 317-324) with:

```js
// `id：title` for each entry id, where the project keeps entry files; null in
// TODO.md mode, which has no ids to title. An id whose file is gone prints bare,
// and so does every id when the folder cannot be read: a title is a courtesy, and
// `start` and `stage land` have work to do whether or not it can be printed.
function titledIds(dir, ids) {
    if (!todoFiles.folderOf(dir)) return null;
    let loaded;
    try {
        loaded = todoFiles.load(dir);
    } catch (e) {
        return ids.slice();
    }
    const titles = new Map(loaded.entries.concat(loaded.done).map((e) => [e.id, e.title]));
    return ids.map((t) => (titles.get(t) ? t + '：' + titles.get(t) : t));
}
```

- [ ] **Step 4: Run it and watch it pass.**

```sh
node --test tests/task-todo.test.js
```

Expected: every test passes, `ℹ fail 0`.

- [ ] **Step 5: Commit.**

```sh
git add scripts/task.js tests/task-todo.test.js
git commit -o scripts/task.js tests/task-todo.test.js -m "fix: titledIds prints bare ids when the todo folder cannot be read"
```

## Task 2: the build patrol section asserts no survey,build,land

**Files:**
- Modify: `tests/skills.test.js:1331-1332` — one `doesNotMatch` beside the build section's other assertions
- Modify: `skills/fankeel-build/SKILL.md:600-602` — mutated for the red run and reverted; no net change
- Read: none

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code and the exact mutation commands; the proof is the recorded red and green.

The survey and fankeel sections already assert `doesNotMatch(/survey,build,land/)` (`tests/skills.test.js:1325`, `:1339`); the build section holds the route string `survey,plan,build,verify,land` and has no such assertion, so a regression to the old three-stage route there would pass. The mutation adds one line under the `## The patrol` heading and keeps `survey,plan,build,verify,land` in place, so the only assertion that can fail is the new one.

- [ ] **Step 1: Confirm both files are clean.**

```sh
git status --short tests/skills.test.js skills/fankeel-build/SKILL.md
```

Expected: no output. If there is output, stop and say which file another task holds.

- [ ] **Step 2: Write the assertion.** In `tests/skills.test.js`, in the test `survey and build each carry their own half of the patrol; fankeel points at both`, directly after the line `assert.match(buildSection[0], /survey,plan,build,verify,land/);` (line 1331), add:

```js
  assert.doesNotMatch(buildSection[0], /survey,build,land/);
```

- [ ] **Step 3: Run it against the real skill and watch it pass.**

```sh
node --test tests/skills.test.js 2>&1 | grep -E "^✖|^ℹ (pass|fail)"
```

Expected: `ℹ fail 0` and no `✖` line. Record the output.

- [ ] **Step 4: Mutate the skill and watch the new assertion fail.**

```sh
mkdir -p .fankeel/build/2026-09-30-patrol-upgrade
cp skills/fankeel-build/SKILL.md .fankeel/build/2026-09-30-patrol-upgrade/fankeel-build.SKILL.md.orig
node -e "const fs=require('fs');const f='skills/fankeel-build/SKILL.md';const NL=String.fromCharCode(10);const t=fs.readFileSync(f,'utf8');const h=t.indexOf(NL+'## The patrol'+NL);if(h<0)process.exit(2);const e=t.indexOf(NL,h+1);fs.writeFileSync(f,t.slice(0,e+1)+'survey,build,land'+NL+t.slice(e+1));"
git diff --stat skills/fankeel-build/SKILL.md
node --test tests/skills.test.js 2>&1 | grep -E "^✖|^ℹ (pass|fail)"
```

Expected: `git diff --stat` shows `1 insertion(+)`; the test run prints exactly one `✖` line, `✖ survey and build each carry their own half of the patrol; fankeel points at both`, and `ℹ fail 1`. If more than one test fails, the red is not attributable: say which, revert, and stop. Record the output.

- [ ] **Step 5: Revert the skill and watch it pass again.**

```sh
cp .fankeel/build/2026-09-30-patrol-upgrade/fankeel-build.SKILL.md.orig skills/fankeel-build/SKILL.md
git diff --stat skills/fankeel-build/SKILL.md
node --test tests/skills.test.js 2>&1 | grep -E "^✖|^ℹ (pass|fail)"
```

Expected: `git diff --stat` prints nothing, and the run is `ℹ fail 0`. Record the output; put the three recorded outputs (steps 3, 4, 5) in your return.

- [ ] **Step 6: Commit.**

```sh
git add tests/skills.test.js
git commit -o tests/skills.test.js -m "test: the build patrol section asserts no survey,build,land"
```

## Task 3: version.js --since

**Files:**
- Modify: `scripts/version.js` — `changes(root, since)`, the unknown-release report, the `--since` argument, the header comment
- Test: `tests/version.test.js`

**Interfaces:**
- Consumes: none
- Produces: `version.changes(root, since)` returns `{ since, commits }` for a known release, `{ since: null, commits: [], unknown: since }` for one no commit names; `version.main(['--changes', '--since', '<x.y.z>'], root)` returns `{ text, code }` with code 1 for an unknown or malformed release

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests over a real throwaway git repository.

- [ ] **Step 1: Write the failing tests.** In `tests/version.test.js`, directly after the line `const path = require('node:path');`, add:

```js
const { execFileSync } = require('node:child_process');
```

Then append at the end of `tests/version.test.js`:

```js

// `--since <x.y.z>`: what upgrade.js needs to say what landed since a project's
// last upgrade, which may be several releases back. A real repository, oldest
// commit first, because the report reads `git log`.
function repo(subjects) {
  const root = tree();
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a],
    { cwd: root, stdio: 'ignore' });
  git('init', '-q');
  for (const s of subjects) git('commit', '-q', '--allow-empty', '-m', s);
  return root;
}
const TWO = ['chore: 0.33.0 — first', 'feat: middle work', 'chore: 0.34.0 — second', 'fix: after both'];

test('--since lists every commit after that release, releases between included', () => {
  const root = repo(TWO);
  const found = version.changes(root, '0.33.0');
  assert.equal(found.since.subject, 'chore: 0.33.0 — first');
  assert.deepEqual(found.commits.map((c) => c.subject), ['fix: after both', 'chore: 0.34.0 — second', 'feat: middle work']);
  const r = version.main(['--changes', '--since', '0.33.0'], root);
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /3 commit\(s\) since chore: 0\.33\.0/);
});

test('without --since the cut is still the newest release commit', () => {
  const r = version.main(['--changes'], repo(TWO));
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /1 commit\(s\) since chore: 0\.34\.0/);
  assert.match(r.text, /fix: after both/);
});

// A number that is only a prefix of a real one is not that release: 0.3.0 must not match 0.33.0.
test('a release no commit names exits 1 with a message, and a prefix is not a match', () => {
  const root = repo(TWO);
  for (const unknown of ['9.9.9', '0.3.0']) {
    const r = version.main(['--changes', '--since', unknown], root);
    assert.equal(r.code, 1, unknown);
    assert.match(r.text, new RegExp('no release commit for ' + unknown.replace(/\./g, '\\.')));
  }
});

test('--since with no release number, or with a bad one, is refused', () => {
  const root = repo(TWO);
  for (const args of [['--changes', '--since'], ['--changes', '--since', 'v1'], ['--changes', '--since', '1.2']]) {
    const r = version.main(args, root);
    assert.equal(r.code, 1, args.join(' '));
    assert.match(r.text, /--since takes a release number/);
  }
});

test('--since in a directory with no git history is the same exit 1 as --changes', () => {
  const r = version.main(['--changes', '--since', '0.33.0'], tree());
  assert.equal(r.code, 1);
  assert.match(r.text, /no git history here/);
});
```

- [ ] **Step 2: Run it and watch it fail.**

```sh
node --test tests/version.test.js
```

Expected: the five new tests fail (`--since` is ignored today, so the first reports the wrong commit count); the older tests pass.

- [ ] **Step 3: Write the minimal implementation.** In `scripts/version.js`, replace the line `function changes(root) {` with:

```js
// `since` is a release number: the commits after the one whose subject is
// `chore: <since>`, however many releases came in between. A number no commit
// in reach names is `unknown`, not an empty list — "nothing since" and "cannot
// tell" must not read the same.
function changes(root, since) {
```

In `scripts/version.js`, in `changes()`, directly above the line `const at = rows.findIndex((r) => RELEASE.test(r.subject));`, add:

```js
    if (since) {
        const want = new RegExp('^chore: ' + since.replace(/\./g, '\\.') + '\\b');
        const hit = rows.findIndex((r) => want.test(r.subject));
        if (hit === -1) return { since: null, commits: [], unknown: since };
        return { since: rows[hit], commits: rows.slice(0, hit) };
    }
```

In `scripts/version.js`, in `changeReport()`, directly above the line `const { since, commits } = found;`, add:

```js
    if (found.unknown) {
        return { text: 'fankeel version — no release commit for ' + found.unknown + ' in the last 400 commits.', code: 1 };
    }
```

In `scripts/version.js`, in `main()`, replace the line `return changeReport(changes(at), versions.length === 1 ? versions[0] : 'the version');` with:

```js
        const from = args.indexOf('--since');
        const since = from === -1 ? null : args[from + 1];
        if (from !== -1 && !SEMVER.test(since || '')) {
            return { text: '--since takes a release number: x.y.z.', code: 1 };
        }
        return changeReport(changes(at, since), versions.length === 1 ? versions[0] : 'the version');
```

And in the header comment of `scripts/version.js`, directly under the line `//   node version.js --changes    what has landed since the last release commit`, add:

```js
//   node version.js --changes --since 0.33.0    what has landed since that release commit
```

- [ ] **Step 4: Run it and watch it pass.**

```sh
node --test tests/version.test.js
```

Expected: every test passes, `ℹ fail 0`.

- [ ] **Step 5: Commit.**

```sh
git add scripts/version.js tests/version.test.js
git commit -o scripts/version.js tests/version.test.js -m "feat: version.js --changes --since <x.y.z> lists the commits after that release"
```

## Task 4: scripts/upgrade.js

**Files:**
- Modify: `scripts/upgrade.js` — new: detects pending steps from the project's shape, `--apply` runs the migration and writes the report
- Read: `scripts/version.js` — `main(argv, root)` returns `{ text, code }`; `--since` is Task 3's
- Read: `scripts/todo-check.js` — `main(argv, now)` with `--migrate` and `--root`, returns `{ text, ok }`
- Read: `lib/todo.js` — `RETIRED`, `entries(text)`, `isoDay(ms)`, `add()`
- Read: `lib/docs.js` — `read(root)`, `frontmatter(text)`, `PRESETS`
- Test: `tests/upgrade.test.js`

**Interfaces:**
- Consumes: `version.main(['--changes', '--since', '<x.y.z>'], pluginRoot)` from Task 3; `todoCheck.main(['--migrate', '--root', root])`
- Produces: `steps(root, plugin)` returns `[{ id, auto, what, next(applied), run }]`; `lastStamp(root)` returns the newest report's `fankeel:` or null; `run(root, { plugin, apply, now })` and `main(argv, opts)` return `{ text, code, report }`; the CLI `node scripts/upgrade.js [--apply] [--root <dir>]` exits 1 while a step is pending, 0 when none is

**Dispatch:** implementer, sonnet — the plan carries both files; transcription plus fixtures for pending, empty folder, and already-upgraded projects.

`--apply` runs only step (a); step (b) is printed and step (c) is a hint that never counts toward the exit code. The old `scope` field needs nothing, and the output says so once instead of listing a step.

- [ ] **Step 1: Write the failing test.** Create `tests/upgrade.test.js`:

```js
'use strict';

// scripts/upgrade.js: what a project needs when fankeel has moved since it last
// looked, read from the project's own shape and never from a recorded version.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const upgrade = require('../scripts/upgrade.js');
const lib = require('../lib/todo.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'upgrade.js');
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 8, 30, 12, 0, 0).getTime();
const TODAY = (() => {
  const t = new Date();
  return String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
})();

// A `## Waiting` file with one typed timing, which todo-check --migrate can place.
const WAITING = ['# TODO', '', '## Ready', '', '- r', '', '## Waiting', '', '### a release lands',
  'after: the 1.0 release. ' + TODAY + '.', '', '- a', ''].join('\n');

// `todoBucket: false` leaves TODO.md mode, where the folder step cannot apply.
function project(todoText, todoBucket) {
  const dir = tmp('fankeel-upgrade-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'reports'), { recursive: true });
  const buckets = [{ path: 'docs/reports', role: 'report' }];
  if (todoBucket !== false) buckets.push({ path: 'docs/todo', role: 'todo' });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ preset: 'flat', buckets }));
  if (todoText !== null) fs.writeFileSync(path.join(dir, 'TODO.md'), todoText);
  return dir;
}

// A stand-in plugin root: the two manifests version.js reads, and no .git.
function plugin(v) {
  const dir = tmp('fankeel-upgrade-plugin-');
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'fankeel', version: v }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: v }, null, 2) + '\n');
  return dir;
}

function pluginRepo(v, subjects) {
  const dir = plugin(v);
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a],
    { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  for (const s of subjects) git('commit', '-q', '--allow-empty', '-m', s);
  return dir;
}

const reports = (dir) => fs.readdirSync(path.join(dir, 'docs', 'reports')).sort();
const readReport = (dir, name) => fs.readFileSync(path.join(dir, 'docs', 'reports', name), 'utf8');

test('check reports a ## Waiting section, exits 1 and touches nothing', () => {
  const dir = project(WAITING, false);
  const r = upgrade.run(dir, { plugin: plugin('1.2.3'), now: NOW });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /pending:\n {2}TODO\.md still has a ## Waiting section/);
  assert.match(r.text, /changes unavailable: no git history here/);
  assert.equal(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), WAITING);
  assert.deepEqual(reports(dir), []);
});

test('--apply runs todo-check --migrate, writes the report with the plugin version, and the next run finds nothing', () => {
  const dir = project(WAITING, false);
  const p = plugin('1.2.3');
  const first = upgrade.run(dir, { plugin: p, apply: true, now: NOW });
  assert.equal(first.code, 0, first.text);
  const after = fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8');
  assert.match(after, /## Blocked/);
  assert.doesNotMatch(after, /## Waiting/);
  assert.match(first.text, /ran:\n {2}TODO\.md still has a ## Waiting section — fankeel todo-check --migrate: 1 timing to ## Blocked, 0 to ## Watch, 0 left under ## Waiting\./);
  assert.deepEqual(reports(dir), ['2026-09-30-fankeel-upgrade.md']);
  const body = readReport(dir, '2026-09-30-fankeel-upgrade.md');
  assert.match(body, /^---\nstatus: current\nfankeel: 1\.2\.3\n---\n/);
  assert.match(body, /## Ran\n- TODO\.md still has a ## Waiting section/);
  assert.match(body, /## Still needs a human\n- nothing/);
  assert.match(body, /old `scope` field/);
  assert.equal(upgrade.lastStamp(dir), '1.2.3');

  const second = upgrade.run(dir, { plugin: p, apply: true, now: NOW + DAY });
  assert.equal(second.code, 0, second.text);
  assert.match(second.text, /nothing pending/);
  assert.equal(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), after, 'a second run rewrote TODO.md');
  assert.match(readReport(dir, '2026-10-01-fankeel-upgrade.md'), /## Ran\n- nothing: no step was pending/);
});

test('an empty todo folder with entries in TODO.md is printed for a person and never run', () => {
  const text = '# TODO\n\n## Ready\n\n- one\n';
  const dir = project(text);
  const r = upgrade.run(dir, { plugin: plugin('1.2.3'), apply: true, now: NOW });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /node .*todo\.js migrate --root /);
  assert.equal(fs.existsSync(path.join(dir, 'docs', 'todo')), false, '--apply ran todo.js migrate');
  assert.equal(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), text);
  assert.match(readReport(dir, '2026-09-30-fankeel-upgrade.md'), /## Still needs a human\n- .*todo\.js migrate --root /);
});

// The control for the test above: the same project once the folder holds an entry.
test('a project already on entry files has nothing pending', () => {
  const dir = project(null);
  fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
  lib.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  assert.match(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), /one/, 'the fixture has entries in TODO.md');
  const r = upgrade.run(dir, { plugin: plugin('1.2.3'), now: NOW });
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /nothing pending/);
  assert.deepEqual(upgrade.steps(dir, plugin('1.2.3')), []);
});

test('a project whose docs.json names no shape gets the docs-move hint, which is not a step', () => {
  const bare = tmp('fankeel-upgrade-');
  const r = upgrade.run(bare, { plugin: plugin('1.2.3'), now: NOW });
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /docs-move\.js plan --to <flat\|phased\|audience>/);
  assert.doesNotMatch(upgrade.run(project('# TODO\n'), { plugin: plugin('1.2.3'), now: NOW }).text, /docs-move/);
});

test('--apply with no report bucket still runs the steps and says no report was written', () => {
  const dir = tmp('fankeel-upgrade-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ preset: 'flat', buckets: [{ path: 'docs', role: 'reference' }] }));
  fs.writeFileSync(path.join(dir, 'TODO.md'), WAITING);
  const r = upgrade.run(dir, { plugin: plugin('1.2.3'), apply: true, now: NOW });
  assert.equal(r.report, null);
  assert.match(r.text, /no report bucket in \.fankeel\/docs\.json/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), /## Waiting/);
});

test('the changes listed start after the newest report\'s release, and a stamp the log lacks is unavailable, not an error', () => {
  const p = pluginRepo('0.2.0', ['chore: 0.1.0 — first', 'feat: middle', 'chore: 0.2.0 — second', 'fix: latest']);
  const dir = project('# TODO\n');
  fs.writeFileSync(path.join(dir, 'docs', 'reports', '2026-09-01-fankeel-upgrade.md'), '---\nstatus: current\nfankeel: 0.1.0\n---\n\n# earlier\n');
  const since = upgrade.run(dir, { plugin: p, now: NOW });
  assert.match(since.text, /3 commit\(s\) since chore: 0\.1\.0/);
  assert.match(since.text, /fix: latest/);

  const fresh = upgrade.run(project('# TODO\n'), { plugin: p, now: NOW });
  assert.match(fresh.text, /1 commit\(s\) since chore: 0\.2\.0/, 'no report means plain --changes');

  fs.writeFileSync(path.join(dir, 'docs', 'reports', '2026-09-02-fankeel-upgrade.md'), '---\nstatus: current\nfankeel: 9.9.9\n---\n');
  const lost = upgrade.run(dir, { plugin: p, now: NOW });
  assert.match(lost.text, /changes unavailable: no release commit for 9\.9\.9/);
  assert.equal(lost.code, 0, 'unavailable changes do not fail the run');
});

function cli(dir, args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir], { encoding: 'utf8', cwd: dir }) };
  } catch (e) {
    return { code: e.status, out: String(e.stdout) };
  }
}

test('the CLI exits 1 while a step is pending and 0 when none is', () => {
  const pending = cli(project(WAITING, false), []);
  assert.equal(pending.code, 1, pending.out);
  assert.match(pending.out, /^fankeel upgrade — /);
  const clean = cli(project('# TODO\n'), []);
  assert.equal(clean.code, 0, clean.out);
});
```

- [ ] **Step 2: Run it and watch it fail.**

```sh
node --test tests/upgrade.test.js
```

Expected: the file fails to load with `Cannot find module '../scripts/upgrade.js'`.

- [ ] **Step 3: Write the minimal implementation.** Create `scripts/upgrade.js`:

```js
#!/usr/bin/env node
'use strict';

// What a project needs when fankeel has moved since it last looked.
//
//   node upgrade.js [--root <dir>]            what is pending; exits 1 when anything is
//   node upgrade.js --apply [--root <dir>]    runs the steps a script may run, writes the report
//
// Detected from the project's own shape, never from a recorded version: a
// version stamp says what was true when it was written, and a project that
// skipped a release or moved a file by hand would read as upgraded and not be.
// The report this writes carries `fankeel: <version>` only so the next run can
// say what landed since — it is never what decides a step.
//
// Steps a script may run: `todo-check --migrate` (idempotent, writes TODO.md).
// Steps it only prints: `todo.js migrate` throws on a second run, and moving a
// docs tree is a table for a person to read first.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const docs = require('../lib/docs.js');
const todo = require('../lib/todo.js');
const { resolveRoot } = require('../lib/registry.js');
const todoCheck = require('./todo-check.js');
const version = require('./version.js');

const PLUGIN = path.join(__dirname, '..');
const REPORT = /^\d{4}-\d{2}-\d{2}-fankeel-upgrade\.md$/;
const WAITING = new RegExp('^##\\s+' + todo.RETIRED + '\\s*$', 'm');
const RELEASE = /^\d+\.\d+\.\d+$/;

function readTodo(root) {
    try {
        return fs.readFileSync(path.join(root, 'TODO.md'), 'utf8');
    } catch (e) {
        return null;
    }
}

function holdsEntries(dir) {
    try {
        return fs.readdirSync(dir).some((n) => n.endsWith('.md'));
    } catch (e) {
        return false;
    }
}

// The bucket a report goes in: the report-role one named `reports` where there
// are several (this repository has `judgements` too, and longer paths sort
// first), else the first.
function reportBucket(root) {
    const { tree } = docs.read(root);
    if (!tree) return null;
    const all = tree.buckets.filter((b) => b.role === 'report');
    return all.find((b) => path.posix.basename(b.path) === 'reports') || all[0] || null;
}

// The `fankeel:` of the newest report this script wrote, or null.
function lastStamp(root) {
    const bucket = reportBucket(root);
    if (!bucket) return null;
    let names;
    try {
        names = fs.readdirSync(path.join(root, bucket.path));
    } catch (e) {
        return null;
    }
    const newest = names.filter((n) => REPORT.test(n)).sort().pop();
    if (!newest) return null;
    const fm = docs.frontmatter(fs.readFileSync(path.join(root, bucket.path, newest), 'utf8')) || {};
    return RELEASE.test(fm.fankeel || '') ? fm.fankeel : null;
}

// Pending steps, each `{ id, auto, what, next(applied), run }`.
function steps(root, plugin) {
    const out = [];
    const text = readTodo(root);
    if (text !== null && WAITING.test(text)) {
        out.push({
            id: 'waiting', auto: true, what: 'TODO.md still has a ## Waiting section', run: null,
            next: (applied) => (applied
                ? 'todo-check --migrate ran; what it could not place has no typed condition, file each by hand'
                : 'run with --apply (todo-check --migrate)'),
        });
    }
    const { tree } = docs.read(root);
    const bucket = tree ? tree.buckets.find((b) => b.role === 'todo') : null;
    if (bucket && text !== null && todo.entries(text).length && !holdsEntries(path.join(root, bucket.path))) {
        const run = 'node ' + path.join(plugin, 'scripts', 'todo.js') + ' migrate --root ' + root;
        out.push({
            id: 'todo-folder', auto: false, run,
            what: bucket.path + ' holds no entry file and TODO.md has entries',
            next: () => 'for a person, it runs once: ' + run,
        });
    }
    return out;
}

// A hint, not a step: it never counts toward the exit code and is never run.
function hint(root, plugin) {
    const { tree } = docs.read(root);
    if (tree && tree.preset !== 'custom') return null;
    return 'docs shape: .fankeel/docs.json names none; to file by a preset, `node '
        + path.join(plugin, 'scripts', 'docs-move.js') + ' plan --to <' + Object.keys(docs.PRESETS).join('|')
        + '> --out <moves.tsv> --root ' + root + '` prints a table and moves nothing';
}

// `--changes`, from the newest report's release when there is one. version.js
// answers for the plugin's own git history, so an installed copy with no .git
// says so here and the run carries on.
function changesOf(root, plugin) {
    const since = lastStamp(root);
    const r = version.main(['--changes'].concat(since ? ['--since', since] : []), plugin);
    if (r.code !== 0) return ['changes unavailable: ' + r.text.replace(/^fankeel version — /, '').split('\n')[0]];
    return r.text.split('\n');
}

function writeReport(root, plugin, day, ran, left) {
    const bucket = reportBucket(root);
    if (!bucket) return { file: null, note: 'no report bucket in .fankeel/docs.json; no report written' };
    const dir = path.join(root, bucket.path);
    const file = path.join(dir, day + '-fankeel-upgrade.md');
    const v = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8')).version;
    const body = [
        '---', 'status: current', 'fankeel: ' + v, '---', '',
        '# fankeel upgrade — ' + day, '',
        '## Ran', ...(ran.length ? ran.map((r) => '- ' + r) : ['- nothing: no step was pending']), '',
        '## Still needs a human', ...(left.length ? left.map((s) => '- ' + s.what + ' — ' + s.next(true)) : ['- nothing']), '',
        'Nothing to do for the old `scope` field: `claims` reads it where it needs to.', '',
    ].join('\n');
    fs.mkdirSync(dir, { recursive: true });
    try {
        fs.writeFileSync(file, body, { flag: 'wx' });
    } catch (e) {
        if (e && e.code === 'EEXIST') return { file: null, note: file + ' already exists; not overwritten' };
        throw e;
    }
    return { file, note: null };
}

function run(root, opts) {
    const o = opts || {};
    const plugin = o.plugin || PLUGIN;
    const day = todo.isoDay(o.now === undefined ? Date.now() : o.now);
    const lines = ['fankeel upgrade — ' + root, ''].concat(changesOf(root, plugin), ['']);
    let found = steps(root, plugin);
    const ran = [];
    if (o.apply) {
        for (const s of found.filter((x) => x.auto)) {
            ran.push(s.what + ' — ' + todoCheck.main(['--migrate', '--root', root]).text.split('\n')[0]);
        }
        found = steps(root, plugin);
        lines.push('ran:', ...(ran.length ? ran.map((r) => '  ' + r) : ['  nothing']), '');
    }
    if (found.length) lines.push('pending:', ...found.map((s) => '  ' + s.what + ' — ' + s.next(o.apply === true)));
    else lines.push('nothing pending.');
    const h = hint(root, plugin);
    if (h) lines.push('', h);
    lines.push('', 'scope → claims needs no step: lib/registry.js reads the old field where it needs to.');
    let file = null;
    if (o.apply) {
        const w = writeReport(root, plugin, day, ran, found);
        file = w.file;
        lines.push('', w.file ? 'report: ' + w.file : w.note);
    }
    return { text: lines.join('\n'), code: found.length ? 1 : 0, report: file };
}

function main(argv, opts) {
    const { values } = parseArgs({
        args: argv, strict: false, allowPositionals: true,
        options: { root: { type: 'string' }, apply: { type: 'boolean' } },
    });
    const root = resolveRoot(typeof values.root === 'string' ? values.root : undefined);
    return run(root, Object.assign({ apply: values.apply === true }, opts));
}

module.exports = { steps, lastStamp, run, main };

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.code);
}
```

- [ ] **Step 4: Run it and watch it pass.**

```sh
node --test tests/upgrade.test.js
```

Expected: eight tests pass, `ℹ fail 0`.

- [ ] **Step 5: Check the exports have importers, then commit.** `tests/source.test.js` reads `git ls-files`, so add the files first:

```sh
git add scripts/upgrade.js tests/upgrade.test.js
node --test tests/source.test.js
git commit -o scripts/upgrade.js tests/upgrade.test.js -m "feat: upgrade.js finds what a project still needs and applies the safe step"
```

Expected: `tests/source.test.js` reports `ℹ fail 0`; `steps`, `lastStamp`, `run` and `main` are each bound by `tests/upgrade.test.js`.

## Task 5: the fankeel-upgrade skill

**Files:**
- Modify: `skills/fankeel-upgrade/SKILL.md` — new: run the check, show the changes, ask per pending step, then `--apply`
- Modify: `skills/fankeel/SKILL.md:914-919` — the user-invoked rule names both skills
- Read: `scripts/upgrade.js` — the CLI and its output lines the skill quotes
- Test: `tests/inventory.test.js`
- Test: `tests/contract.test.js`
- Test: `tests/version.test.js`

**Interfaces:**
- Consumes: the CLI `node scripts/upgrade.js [--apply] [--root <dir>]` from Task 4, and `pending:`, `run with --apply` and `changes unavailable:` in its output
- Produces: the skill directory `fankeel-upgrade`, which makes the counts 12 skills and 14 version places

**Dispatch:** implementer, sonnet — the plan carries the file and the count edits; transcription plus keeping four count tests green.

Three tests count skills and stay green only if they move with the directory: `tests/inventory.test.js` (the hardcoded `SKILLS` list), `tests/contract.test.js:280` (`found.size`) and the real-repository test in `tests/version.test.js`. No `rationale.md` is needed and `REQUIRED_CORE` is unchanged (design section 6).

- [ ] **Step 1: Grep the counts first.**

```sh
git grep -n -E "13|thirteen|eleven" -- tests/inventory.test.js tests/contract.test.js tests/version.test.js
```

Expected: `tests/contract.test.js:280` (`found.size, 13`), `tests/version.test.js:101` (`rows.length, 13`) and prose lines; nothing in `tests/inventory.test.js` (it lists names). Change only the two assertions and the comment lines given below.

- [ ] **Step 2: Watch the count tests go red.** Create the skill directory first, with the file from Step 3, then:

```sh
node --test tests/inventory.test.js tests/contract.test.js tests/version.test.js
```

Expected before the test edits: `skills/ holds exactly the known directories` fails naming `fankeel-upgrade` as extra, `every file that carries the version carries the same one` fails with `the count moved`, and `the real repository has the thirteen places` fails on 14 rows.

- [ ] **Step 3: Write the skill.** Create `skills/fankeel-upgrade/SKILL.md`:

````md
---
name: fankeel-upgrade
description: Bring a project up to what the installed fankeel expects — what changed since the last upgrade, which migrations are pending, and each one asked about before it runs. Use for /fankeel-upgrade, "升級 fankeel", or after updating the plugin.
disable-model-invocation: true
version: 0.84.0
status: current
last_verified: 2026-09-30
source_of_truth: scripts/upgrade.js, scripts/version.js
---

# fankeel-upgrade

After the plugin has been updated, this brings one project up to it. What is
pending is read from the project's own files, never from a version number kept
somewhere, so a project that skipped a release reads the same as one that did
not. Run, adding `--root <dir>` when the project is not the working directory:

    node <plugin>/scripts/upgrade.js

`<plugin>` is two directories up from this file. It exits 1 while a step is
pending and 0 when none is.

1. **Say what changed.** The first lines list what landed in fankeel since the
   newest upgrade report in the project's report bucket, or everything the log
   holds when there is none. `changes unavailable: …` is an installed copy with
   no git history: say so in one line and go on, it is not a failure.
2. **Say each pending step.** The check names them under `pending:` and prints
   the command for the ones a script does not run. Never run a printed command
   yourself; read it to the user and stop there.
3. **Ask once per step marked `run with --apply`.** One `AskUserQuestion` per
   step, options `run it` and `leave it`, naming the step in the question.
4. **On yes to every one, run** `node <plugin>/scripts/upgrade.js --apply` and
   say the report path it prints. On any no, do not run `--apply` — it runs
   every such step at once — and say which step was left.
5. **Say what still needs a person.** `--apply` writes the report with what ran
   and what is left; name what is left in one line and stop.

The old `scope` field needs no step: the registry reads it where it needs to,
and the script says so on every run.
````

- [ ] **Step 4: Update the three count tests and the inventory.** In `tests/inventory.test.js`, in the `SKILLS` list, add a line between `'fankeel-survey',` and `'fankeel-verify',`:

```js
    'fankeel-upgrade',
```

In `tests/contract.test.js`, replace the comment lines above the test `every file that carries the version carries the same one` (five lines starting `// Thirteen files carry the version`) with the same five lines, so no cited line moves:

```js
// Fourteen files carry the version and nothing kept them together: two manifests
// and one line of frontmatter in each of the twelve skills. A release that missed
// one left a skill announcing a version the plugin is not, which is the kind of
// wrong nobody reads carefully enough to catch — the number is right in thirteen
// places.
```

In `tests/contract.test.js`, replace the line `assert.equal(found.size, 13, 'the count moved: ' + [...found.keys()].join(', '));` with:

```js
  assert.equal(found.size, 14, 'the count moved: ' + [...found.keys()].join(', '));
```

In `tests/version.test.js`, replace the two lines `// script and \`tests/contract.test.js\` cannot disagree about what thirteen means.` and `test('the real repository has the thirteen places the contract test counts', () => {` with:

```js
// script and `tests/contract.test.js` cannot disagree about what fourteen means.
test('the real repository has the fourteen places the contract test counts', () => {
```

and in `tests/version.test.js` replace the line `assert.equal(rows.length, 13, rows.map((r) => r.file).join(', '));` with:

```js
  assert.equal(rows.length, 14, rows.map((r) => r.file).join(', '));
```

- [ ] **Step 5: Update the user-invoked rule in the fankeel skill.** In `skills/fankeel/SKILL.md`, the three lines starting `A skill marked \`disable-model-invocation: true\` — today` read:

```md
A skill marked `disable-model-invocation: true` — today
`fankeel-station` — is reachable only when a person types it, so no other
skill routes to it and no model reaches for it. Two questions to the user, one
```

Replace them in `skills/fankeel/SKILL.md` with:

```md
A skill marked `disable-model-invocation: true` — today `fankeel-station`
and `fankeel-upgrade` — is reachable only when a person types it, so no other
skill routes to it and no model reaches for it. Two questions to the user, one
```

- [ ] **Step 6: Run the own tests and watch them pass.**

```sh
node --test tests/inventory.test.js tests/contract.test.js tests/version.test.js tests/skills.test.js
```

Expected: `ℹ fail 0`. This includes the new skill's frontmatter, description-length, `disable-model-invocation` and no-dispatch-word tests in `tests/skills.test.js`.

- [ ] **Step 7: Commit.**

```sh
git add skills/fankeel-upgrade/SKILL.md skills/fankeel/SKILL.md tests/inventory.test.js tests/contract.test.js tests/version.test.js
git commit -o skills/fankeel-upgrade/SKILL.md skills/fankeel/SKILL.md tests/inventory.test.js tests/contract.test.js tests/version.test.js -m "feat: the fankeel-upgrade skill runs upgrade.js and asks before --apply"
```

## Task 6: the counts in prose say fourteen and twelve

**Files:**
- Modify: `docs/01-guide/development.md:132-164` — the version section and the release steps
- Modify: `skills/fankeel-land/SKILL.md:100-112` — the release-number section
- Modify: `scripts/version.js:4-16` — the header comment

**Interfaces:**
- Consumes: the skill directory `fankeel-upgrade` from Task 5 (it makes the counts 12 skills and 14 version places), and `--since` from Task 3
- Produces: none

**Dispatch:** implementer, sonnet — a set of exact wording replacements; the floor.

Three pages say thirteen places and eleven skills; Task 5 made both false. Each `used to be eleven edits` and `right in ten places` is history and stays. The edits, by line at the time of writing:

- `docs/01-guide/development.md`: line 132 `in thirteen files` becomes `in fourteen files`; line 134 `the thirteen files that carry it` becomes `the fourteen files`; line 135 `each of the eleven skills` becomes `each of the twelve skills`; line 137 `fails when the thirteen` becomes `fails when the fourteen`; line 156 `writes the thirteen places` becomes `writes the fourteen places`; line 162 `reads all thirteen` becomes `reads all fourteen`. After line 136's sentence ending `which is what a release contains.` add: ``With `--changes --since <x.y.z>` it lists the commits since that release instead.``
- `skills/fankeel-land/SKILL.md`: line 103 `what the thirteen places say` becomes `what the fourteen places say`; line 108 `Thirteen files carry it` becomes `Fourteen files carry it`; line 109 `eleven skills` becomes `twelve skills`.
- `scripts/version.js`: line 4 `in the thirteen places` becomes `in the fourteen places`; line 7 `set all thirteen` becomes `set all fourteen`; line 10 `each of the eleven skills` becomes `each of the twelve skills`; line 16 `when the thirteen disagree` becomes `when the fourteen disagree` and `without thirteen edits` becomes `without fourteen edits`.

- [ ] **Step 1: List what is there.**

```sh
git grep -n -i -w "thirteen" -- docs/01-guide/development.md skills/fankeel-land/SKILL.md scripts/version.js
```

Expected: the eleven lines above containing `thirteen` (line 16 of `scripts/version.js` holds two). If a line differs, edit the wording it has to the same effect.

- [ ] **Step 2: Make the replacements** listed above with the edit tool, one at a time.

- [ ] **Step 3: Check none is left and nothing else moved.**

```sh
git grep -n -i -w "thirteen" -- docs/01-guide/development.md skills/fankeel-land/SKILL.md scripts/version.js
git grep -n "eleven skills" -- docs/01-guide/development.md skills/fankeel-land/SKILL.md scripts/version.js
git diff --stat
node --test tests/version.test.js
```

Expected: the two greps print nothing; `git diff --stat` names only the three files; `tests/version.test.js` reports `ℹ fail 0`.

- [ ] **Step 4: Commit.**

```sh
git add docs/01-guide/development.md skills/fankeel-land/SKILL.md scripts/version.js
git commit -o docs/01-guide/development.md skills/fankeel-land/SKILL.md scripts/version.js -m "docs: the version places are fourteen and the skills twelve"
```

## Task 7: the six moved citations

**Files:**
- Modify: `docs/02-architecture/pipeline.md:245-254` — two `tests/render.test.js` line references
- Modify: `docs/90-agent/reference/subagents.md:784-790` — two `scripts/task.js` line references
- Modify: `skills/fankeel-survey/SKILL.md:288-298` — two `scripts/task.js` line references
- Read: `scripts/task.js` — where the quoted lines are now, after Task 1
- Read: `tests/render.test.js` — where its two quoted lines are
- Read: `tests/skills.test.js` — Task 2 edits it and shifts nothing docs-check quotes
- Read: `skills/fankeel-upgrade/SKILL.md` — docs-check runs over a tree with Task 5 in it
- Read: `docs/01-guide/development.md` — Task 6 edits it and docs-check reads it

**Interfaces:**
- Consumes: the files the earlier tasks finished, which is why the reads are listed
- Produces: none

**Dispatch:** implementer, sonnet — the numbers come from docs-check's output after Task 1 and are not in the plan; the floor.

At the commit `fed438fc` docs-check reports six references that no longer resolve. What each quoted line is at that commit: `tests/render.test.js:533` holds `assert.ok(size < 2400` and `:485` holds `assert.ok(worst < 3000`; `scripts/task.js:1065` holds `set anyway; this is a warning, not a refusal`, `:1058` holds `const n = estimateTokens('\n  - ' + out.value);`, `:553` holds `already owns an active task` and `:1374` holds `classForRoute(given)`. Task 1 adds 8 lines above all four `scripts/task.js` lines, so after it they are 1073, 1066, 561 and 1382; docs-check's own output is what to copy.

- [ ] **Step 1: List what no longer resolves.**

```sh
node scripts/docs-check.js
```

Expected: the section `6 references that no longer resolve` with six `moved:` lines, in `docs/02-architecture/pipeline.md` (249, 253), `docs/90-agent/reference/subagents.md` (786, 789) and `skills/fankeel-survey/SKILL.md` (290, 297). If there are more, each names its page: fix it too and say so in your return. If there are fewer, say which already resolves.

- [ ] **Step 2: Find each quoted text's line.** For each `moved:` line, take the number docs-check prints after `it is at :` when it prints one; for the three it prints none for, run the search and take the first hit:

```sh
grep -n "assert.ok(size < 2400" tests/render.test.js
grep -n "already owns an active task" scripts/task.js
grep -n "classForRoute(given)" scripts/task.js
```

Expected at `fed438fc` before Task 1: 533, 553 and 1374, matching the list above (`assert.ok(size < 2400` also appears at later lines of `tests/render.test.js`; the first hit is the one the page means, the stage-preamble test).

- [ ] **Step 3: Edit each reference.** In each page, change only the number after the file name to the line found in step 2 (`tests/render.test.js:528` becomes `:533`, `:480` becomes `:485`, and the four `scripts/task.js` numbers to what docs-check now prints), and touch nothing else in the sentence.

- [ ] **Step 4: Run docs-check again.**

```sh
node scripts/docs-check.js
```

Expected: no `moved:` line and no section listing references that no longer resolve. If the exit code is still non-zero for another reason, say what it is in your return.

- [ ] **Step 5: Commit.**

```sh
git add docs/02-architecture/pipeline.md docs/90-agent/reference/subagents.md skills/fankeel-survey/SKILL.md
git commit -o docs/02-architecture/pipeline.md docs/90-agent/reference/subagents.md skills/fankeel-survey/SKILL.md -m "docs: six cited lines follow the code they quote"
```

## Task 8: the station page renders the todo-done block

**Files:**
- Read: `assets/station/station.js` — the `todo-done` block at `station.js:2390-2406`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — open the station page in your own browser and say what the `todo-done` block shows; no subagent can look at a rendered page for you, and the block has never been rendered and looked at.

`ledger.js hands` lists this task; build runs it with the user after every dispatched task and before build's gate.

- [ ] **Step 1: Start the station and read its URL.**

```sh
node scripts/station.js serve --open
```

Expected: it prints the station URL and opens it.

- [ ] **Step 2: Open this repository's project page and the todo section.** The block is the `Done` group under the open entries, headed `已完成` or `Done` with `newest first` beside it, one row per closed entry.

- [ ] **Step 3: Confirm it is on the page.** In the browser console:

```console
document.querySelector('[data-block="todo-done"]') !== null
```

Expected: `true`, and the group visibly lists the closed entries. Tell the session which of three it is: renders as designed, renders wrong (say what is on screen), or absent.

- [ ] **Step 4: If it is wrong or absent,** the session files what you saw as a TODO entry; this task does not fix it, so the edit range above stays untouched and nothing is committed.

## Coverage

| promise | task |
|---|---|
| `titledIds` in `scripts/task.js:319` calls `todoFiles.load` (`lib/todo.js:535`) unguarded; when the todo folder cannot be read it must fall back to printing bare ids instead of throwing, for both callers (`describe()` near `scripts/task.js:338` and `todoLines()` near `:780`). | Task 1 |
| `node scripts/docs-check.js` reports 6 moved `path:line` references: `docs/02-architecture/pipeline.md:249` and `:253`, `docs/90-agent/reference/subagents.md:786` and `:789`, `skills/fankeel-survey/SKILL.md:290` and `:297`. Each is fixed to the line docs-check says now holds the quoted text, and docs-check reports none of the six afterwards. | Task 7 |
| `tests/skills.test.js` (about 1312-1340): the survey and fankeel sections assert `doesNotMatch(/survey,build,land/)`; the build section (`buildSection`) has none. Add it, and prove it red-green: put `survey,build,land` into the patrol section of `skills/fankeel-build/SKILL.md`, see the test fail, revert, see it pass, with the commands and output recorded in the task's steps. | Task 2 |
| The station project page's `todo-done` block has never been rendered and looked at. A `user`-dispatch task, last in the plan: the user opens the station page and confirms the block renders. | Task 8 |
| `node scripts/version.js --changes --since <x.y.z>` lists the commits after the release commit whose subject matches `chore: <x.y.z>`, where the current cut (`scripts/version.js:100-134`) is the newest `/^chore: \d+\.\d+\.\d+\b/`. An unknown version exits 1 with a message; without `--since` the behaviour is unchanged; no git keeps the existing exit 1. | Task 3 |
| It detects by the project's current shape, never by a recorded version. Step (a): `TODO.md` still has a `## Waiting` section, so check reports it and `--apply` runs `todo-check --migrate` (`scripts/todo-check.js:551-684`, writes, idempotent). | Task 4 |
| Step (b): a `todo`-role bucket exists in `.fankeel/docs.json`, its folder has no `.md` and `TODO.md` has entries, so it prints `node <plugin>/scripts/todo.js migrate --root <dir>` for a person, because that command throws on a second run (`lib/todo.js:612`). Step (c), docs-move: only a printed hint to `docs-move.js plan --to <preset>` when `docs.json` names no shape, never run. The `scope` to `claims` rename needs nothing (`lib/registry.js:709-717` reads the old field lazily), and the output says so instead of listing a step. | Task 4 |
| Exit: check mode exits 1 when any step is pending and 0 when none is; `--root <dir>` is taken like the other scripts. | Task 4 |
| `--apply` writes `<report bucket>/YYYY-MM-DD-fankeel-upgrade.md` (the report-role bucket `lib/docs.js` resolves) with frontmatter `fankeel: <plugin package.json version>` and a body listing what ran and what still needs a person. | Task 4 |
| Before listing changes it finds the newest such report's `fankeel:` and runs `version.js --changes --since <that>`; with no report it runs plain `--changes`; when version.js exits 1 (no `.git` in an installed copy) it prints `changes unavailable: <reason>` and continues. | Task 4 |
| `skills/fankeel-upgrade/SKILL.md` with `disable-model-invocation: true` (like `skills/fankeel-station/SKILL.md:4`) and `version:` equal to `package.json`'s: run `upgrade.js` check, show the changes, ask per pending step before `--apply`. It needs no `rationale.md` (the split is only `fankeel-build`, `fankeel-plan`, `fankeel-audit`, `tests/skills.test.js:251`) and does not touch `REQUIRED_CORE` (`tests/skills.test.js:1107`); the tests that do count skills (`tests/inventory.test.js`, `tests/contract.test.js:262`, `tests/version.test.js`) move from eleven skills and thirteen version places to twelve and fourteen. | Task 5 |
| `start --todo` and `stage land` print bare ids when the todo folder holds an unreadable entry file | Task 1 |
| `node scripts/docs-check.js` lists none of the six moved references | Task 7 |
| `tests/skills.test.js` fails when the build patrol section holds `survey,build,land` | Task 2 |
| the station project page renders the `todo-done` block | Task 8 |
| `version.js --changes --since` lists the commits after that release, and exits 1 for an unknown one | Task 3 |
| `upgrade.js` exits 1 with a `## Waiting` section, runs the migration on `--apply`, and exits 0 on an already upgraded project | Task 4 |
| `--apply` writes the report with `fankeel:` and the next run reads it back | Task 4 |
| the twelfth skill keeps the skill, contract, inventory and version tests green | Task 5, and Task 6 for the prose counts |
