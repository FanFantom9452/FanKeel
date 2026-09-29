---
status: current
last_verified: 2026-09-29
---

# TODO 全表盤點 Implementation Plan

**Goal:** Close the three test gaps the TODO index names, make a session visible from its `/fankeel` prompt by writing a task-less `init` entry, and settle the five open entries the design names.
**Architecture:** Tests 1-3 pin behaviour that already exists (the station cap, the subagent-model order, the todo read-error paths) and change no source except `--migrate`'s error handling in `lib/todo.js`. Task 4 makes `hooks/inject.js` write `{active: true, stage: 'init'}` with no `task` on a `/fankeel` prompt from a session with no entry, lets `scripts/task.js start` take that entry over, and lets `lib/station.js` label it. Task 5 says it on the reference pages, and Task 6 closes and rewrites entries with `scripts/todo.js`, after the work they name has a commit.
**Tech Stack:** Node, CommonJS with `'use strict'`, no dependencies (`package.json` has none); tests run by `node --test`; `git`; a live `claude -p` for the Task 2 probe.
**Spec:** [2026-09-29-todo-patrol-2-design.md](2026-09-29-todo-patrol-2-design.md)

## Global Constraints

Generated from `CONTRIBUTING.md` (the repository has no `CLAUDE.md` and no `AGENTS.md`: "There is no `CLAUDE.md` and no `AGENTS.md` in this repository"), `.fankeel/map.md`, `package.json`, `lib/plantasks.js` and the test suite. `node scripts/map.js` was not re-run: `.fankeel/map.md` exists.

- Core logic is `lib/*.js`: "Pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction."
- `scripts/*.js` are "Thin wrappers over `lib/`."
- Hooks: "Every hook exits `0` on every path, including its own errors" (`hooks/inject.js` header: "It exits 0 on every path"; a session not in the mode "must stay cheap": no entry and an ordinary prompt reads two files and writes nothing).
- Tests: `node --test` (`package.json` `scripts.test`); "Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it."
- Scratch directories come from `tests/tmp.js` (`const tmp = require('./tmp.js')`), never `os.tmpdir()` directly.
- `TODO.md` is generated: "Never edit `TODO.md` by hand"; entry files under `docs/90-agent/todo/` change only through `node scripts/todo.js new` and `node scripts/todo.js done <id> --sha <sha>`. An entry title is at most `MAX_TITLE_WIDTH` 28 columns (a CJK character counts two), an entry line at most `MAX_ENTRY_CHARS` 200 (`lib/todo.js:25,94`).
- "A new or renamed page gets its index row in the same change" (`docs/README.md`).
- `package.json` has no `dependencies` and no `devDependencies`: no dependency is added.
- `lib/plantasks.js:346-347`: `READ_CAP = 1500` lines across a task's `Modify:` files (a `path:a-b` range counts only its span), `FILE_CAP = 3` `Modify:` files per task. `scripts/task.js` is 1484 lines, `lib/station.js` 896, `hooks/inject.js` 267, `lib/todo.js` 649, `docs/90-agent/reference/registry.md` 568.
- `tests/plantasks-lint-cap.test.js:25,28` hard-code `5174` lines for `assets/station/station.js` (Task 1 removes them); `tests/title-hook.test.js:12` sets `CLAUDE_CODE_SUBAGENT_MODEL: ''` (Task 2 adds the only non-empty use).
- Indentation follows the file being edited: 4 spaces in `lib/`, `hooks/`, `scripts/`, `tests/title-hook.test.js`, `tests/station.test.js`; 2 spaces in `tests/inject.test.js`, `tests/plantasks-lint-cap.test.js`, `tests/todo-check-folder.test.js`, `tests/todo-files.test.js`, and in every new test file below.
- Filing (`.fankeel/map.md`): `docs/90-agent/plans` is role plan (`status: design-intent` until it lands), `docs/90-agent/reports` is role report (a dated snapshot, write-once), `docs/90-agent/reference` is role reference, `docs/90-agent/todo` is role todo.
- Injected block budget: the rule block has a 2400-character cap (`tests/profile.test.js:400`, `room under 2400`); no task here touches `lib/render.js`.
- Commit subjects follow `git log`: `fix:`, `docs:`, `chore:` then a sentence; a commit made by a session ends with that session's attribution lines. Use `git commit -o <paths>` (after `git add` of any new path) so a neighbour's staged change is not swept in.
- Nothing is pushed.

## Risks

- An init entry is `active: true`, so `hooks/brief.js`, `hooks/guard.js`, `hooks/touch.js`, `hooks/resume.js` and `hooks/gate.js` (each returns early only on `!mine || mine.active !== true`) now treat an init session as in the mode, and `hooks/inject.js` would route its ordinary prompts through `render()` with no `route` and stage `init` — Task 4 — checks first that every one of them exits 0 with an init entry on disk and prints no `undefined`, and makes `inject.js` keep an init-only session on the cheap "not in the mode" path.
- A second `/fankeel` prompt from an init session would stop getting the `init` block, because `mine.active === true` skips that branch — Task 4 — its test sends two `/fankeel` prompts and requires the block both times.
- `task.js adopt` copies `source.task` and `source.stage` (`scripts/task.js:1130`); adopting an init entry would produce an active task with no name at stage `init` — Task 4 — refuses an init source before any copy.
- The design's file table names `lib/todo.js` for the `unreadable folder` and `LC_ALL=C` tests, but both live in `scripts/todo-check.js` (`:256`, `:191`) — Task 3 — writes those tests against `scripts/todo-check.js` and edits `lib/todo.js` only for `--migrate`.
- `todo.js` has no edit command, so folding `model-1` into `station-3` means closing both and creating one entry that carries what they left open — Task 6 — reads both files before it writes anything.
- `todo.js done` requires `--sha <commit>`, and a commit cannot name itself — Task 6 — closes each entry with the sha of the commit that delivered it, resolved with `git log -1 --format=%H -- <path>` and pasted into the log.
- A copied `node` binary standing in for `git` (Task 3's `LC_ALL` test) is 80 MB on Windows — Task 3 — copies it once per test file, into a `tests/tmp.js` directory that is removed at exit.

## Task 1: The station cap test reads the file

**Files:**
- Modify: `tests/plantasks-lint-cap.test.js` — lines 24-29, the literal `5174` becomes the length read from disk
- Read: `lib/plantasks.js` — `readSize` (`:330-341`) counts `text.replace(/\r?\n$/, '').split(/\r?\n/).length`; this task copies that count, and does not change it
- Read: `assets/station/station.js` — its line count is what the test measures; step 2 appends a line to it and restores it with `git restore`, and it is not modified
- Test: `tests/plantasks-lint-cap.test.js`

**Interfaces:**
- Consumes: `plantasks.READ_CAP` (1500) and `plantasks.lint(plan, design, root)`, both exported by `lib/plantasks.js`.
- Produces: nothing.

**Dispatch:** implementer, sonnet — the plan carries the edit; transcription plus one mutation run.

- [ ] **Step 1: Write the test that reads the length**

In `tests/plantasks-lint-cap.test.js`, replace lines 24-29 (the first `test(...)`, whose title and assertion both carry `5174`) with:

```js
// The count `readSize` makes, taken from disk: the next edit to station.js must
// not turn this red, and a station.js split below READ_CAP must, because the
// test would then be measuring nothing.
const STATION = path.join(ROOT, 'assets', 'station', 'station.js');
const STATION_LINES = fs.readFileSync(STATION, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/).length;

test('lint flags a task whose Modify: is the whole station.js', () => {
  assert.ok(STATION_LINES > plantasks.READ_CAP, 'station.js is under READ_CAP: this test needs a file that is over it');
  const plan = task(1, ['assets/station/station.js']);
  const out = plantasks.lint(plan, design(), ROOT);
  assert.ok(out.includes('Task 1: reads ' + STATION_LINES + ' lines across its `Modify:` files, over READ_CAP (1500)'), out.join('\n'));
});
```

- [ ] **Step 2: Run it and watch it pass, then move the length by one line**

```sh
node --test tests/plantasks-lint-cap.test.js
printf '// probe\n' >> assets/station/station.js
node --test tests/plantasks-lint-cap.test.js
git show HEAD:tests/plantasks-lint-cap.test.js > tests/zz-old-cap.test.js
node --test tests/zz-old-cap.test.js
rm tests/zz-old-cap.test.js
git restore assets/station/station.js
git diff --stat assets/station/station.js
```

Expected: the first run passes; after the appended line the new file still passes and `tests/zz-old-cap.test.js` (the committed test with the `5174` literal) fails on `reads 5175 lines`; `git diff --stat` prints nothing. `git restore` names the one file this step itself changed. Return `plantasks-lint-cap … — red when: a line is appended to assets/station/station.js` for the new test.

- [ ] **Step 3: Run the file and commit**

```sh
node --test tests/plantasks-lint-cap.test.js
git commit -o tests/plantasks-lint-cap.test.js -m "fix: the station cap test reads station.js instead of hard-coding its length"
```

## Task 2: The subagent-model order has a test, and a probe with only the variable set

**Files:**
- Modify: `tests/title-hook.test.js` — `fire()` takes the variable's value; two new tests
- Modify: `docs/90-agent/reports/2026-09-29-subagent-model-env.md` — a new dated report page holding the probe's result
- Modify: `docs/README.md` — the index row for that report
- Read: `lib/title.js` — `prefixFor` (`:119`, `[input.model, fm.model, env && env.CLAUDE_CODE_SUBAGENT_MODEL]`) and `parseModel`; the mutation below edits and restores it, and it is not left changed
- Test: `tests/title-hook.test.js`

**Interfaces:**
- Consumes: `parseModel(id)` from `lib/title.js`, returning `{ alias, version }` for a full model id.
- Produces: `fire(payload, cwd, subagentModel)` in `tests/title-hook.test.js` (third argument optional, default `''`).

**Dispatch:** implementer, sonnet — the tests are in the plan and the probe is a command sequence. The probe is not `user`: it is a headless `claude -p` run, which needs no interactive terminal and no slash command, so an implementer with Bash runs it; `user` is for a browser, a slash command or an interactive session that `claude -p` cannot stand in for.

- [ ] **Step 1: Write the failing tests**

In `tests/title-hook.test.js`, replace `fire` (lines 10-16) with:

```js
function fire(payload, cwd, subagentModel) {
    const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), cwd, encoding: 'utf8',
        env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(cwd, 'config'), CLAUDE_CODE_SUBAGENT_MODEL: subagentModel || '' } });
    assert.equal(r.status, 0);
    return r.stdout ? JSON.parse(r.stdout) : null;
}
function agentFile(dir, name, model) {
    const file = path.join(dir, '.claude', 'agents', name + '.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '---\nname: ' + name + '\ndescription: probe\n' + (model ? 'model: ' + model + '\n' : '') + '---\nbody\n');
}
```

In `tests/title-hook.test.js`, append at the end of the file:

```js
test('CLAUDE_CODE_SUBAGENT_MODEL alone names the model: it ranks above the session model', () => {
    const f = fixture();
    agentFile(f.dir, 'plain');
    const haiku = parseModel('claude-haiku-4-5');
    assert.ok(haiku, 'parseModel must know claude-haiku-4-5');
    const out = fire({ tool_name: 'Agent', cwd: f.dir, transcript_path: f.transcript,
        tool_input: { subagent_type: 'plain', description: 'look', prompt: 'p' } }, f.dir, 'claude-haiku-4-5');
    assert.equal(out.hookSpecificOutput.updatedInput.description, haiku.alias + ' ' + haiku.version + ' · inherit: look');
});

test('the agent file model: ranks above CLAUDE_CODE_SUBAGENT_MODEL', () => {
    const f = fixture();
    agentFile(f.dir, 'pinned', 'claude-sonnet-4-5');
    const sonnet = parseModel('claude-sonnet-4-5');
    assert.ok(sonnet, 'parseModel must know claude-sonnet-4-5');
    const out = fire({ tool_name: 'Agent', cwd: f.dir, transcript_path: f.transcript,
        tool_input: { subagent_type: 'pinned', description: 'look', prompt: 'p' } }, f.dir, 'claude-haiku-4-5');
    assert.equal(out.hookSpecificOutput.updatedInput.description, sonnet.alias + ' ' + sonnet.version + ' · inherit: look');
});
```

In `tests/title-hook.test.js`, add beside the other requires at the top (after `const tmp = require('./tmp.js');`):

```js
const { parseModel } = require('../lib/title.js');
```

- [ ] **Step 2: Run them, then swap the order in `lib/title.js` and watch each go red**

```sh
node --test tests/title-hook.test.js
```

Expected: pass. Then, with Edit, change `lib/title.js:119` to `[input.model, env && env.CLAUDE_CODE_SUBAGENT_MODEL, fm.model]`, run `node --test tests/title-hook.test.js` (the second new test goes red), then change it to `[input.model, fm.model]` (the first goes red), run again, and reverse the edit so `git diff --stat lib/title.js` prints nothing. Return each new test as `<name> — red when: <that mutation>`.

- [ ] **Step 3: Run the control probe once, with only the variable set**

The probe dispatches one agent whose file has no `model:` line, once with the variable unset and once with it set, and reads the model from the subagent's own transcript.

```sh
P=.fankeel/build/task-20260929T104735/probe-env
mkdir -p "$P/.claude/agents"
printf -- '---\nname: plain\ndescription: probe agent with no model line\n---\nReply with the single word ok.\n' > "$P/.claude/agents/plain.md"
cd "$P"
for arm in control env; do
  SID=$(node -e "console.log(require('crypto').randomUUID())")
  if [ "$arm" = env ]; then export CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5; else unset CLAUDE_CODE_SUBAGENT_MODEL; fi
  claude -p --session-id "$SID" --setting-sources project --allowedTools Agent --max-turns 4 --output-format stream-json --verbose 'Use the Agent tool once with subagent_type "plain", description "probe", prompt "ok". Then say done.' > "$arm.jsonl"
  echo "$arm $SID"
  find "$HOME/.claude/projects" -path "*$SID*" -name 'agent-*.jsonl' -exec grep -oh '"model":"[^"]*"' {} + | sort | uniq -c
done
unset CLAUDE_CODE_SUBAGENT_MODEL
```

Expected: the control arm's subagent transcript names the session's own model; the env arm names `claude-haiku-4-5`. Write down both session ids, the two model strings and the `claude --version`. If the env arm names the session's model, the report says so — that is the finding and the test above is then wrong about the ranking, so stop and return `blocked: env arm did not change the model`.

- [ ] **Step 4: Write the report page**

Create `docs/90-agent/reports/2026-09-29-subagent-model-env.md`, replacing `«control»`, `«env»`, `«control id»`, `«env id»`, `«version»` with what step 3 printed:

```md
---
status: current
last_verified: 2026-09-29
source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新；機制以 lib/title.js 為準
---

# 只設 CLAUDE_CODE_SUBAGENT_MODEL 的對照量測 — 2026-09-29

`lib/title.js` 把 `CLAUDE_CODE_SUBAGENT_MODEL` 排在 agent 檔 `model:` 之後、session 模型之前（[title-probe](2026-09-29-title-probe.md) 量過一次，且是和 agent 檔並存的情況）。這頁補只設這個變數、agent 檔沒有 `model:` 的對照。

## 方法

Claude Code «version»，兩次 headless `claude -p`，`--setting-sources project`，專案裡只有一個沒有 `model:` 的 `plain` agent。第一次不設變數，第二次設 `CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5`。模型讀自 subagent 自己的 transcript。

## 結果

| 臂 | session id | subagent transcript 的 `message.model` |
|---|---|---|
| 不設變數 | «control id» | «control» |
| 設變數 | «env id» | «env» |

## 沒量到的

- 各只跑一次，n=1。
- 只量了 agent 檔沒有 `model:` 的情況；有 `model:` 時的順序是 [title-probe](2026-09-29-title-probe.md) 量的。
- 只量了 «version»。
```

- [ ] **Step 5: Index the report**

In `docs/README.md`, add after the row that names the title-probe report (line 281):

```md
| 只設 `CLAUDE_CODE_SUBAGENT_MODEL`、agent 檔沒有 `model:` 的對照 `claude -p` 量測，和 title-probe 的順序結論互為對照 | [reports/2026-09-29-subagent-model-env.md](90-agent/reports/2026-09-29-subagent-model-env.md) — *a dated snapshot, 繁體中文* |
```

- [ ] **Step 6: Run the checks and commit**

```sh
node --test tests/title-hook.test.js
node scripts/docs-check.js
git add docs/90-agent/reports/2026-09-29-subagent-model-env.md
git commit -o tests/title-hook.test.js docs/90-agent/reports/2026-09-29-subagent-model-env.md docs/README.md -m "docs: title env probe — only CLAUDE_CODE_SUBAGENT_MODEL set, and the order under test"
```

## Task 3: The todo read-error paths go red, and `--migrate` stops swallowing errors

**Files:**
- Modify: `lib/todo.js:566-649` — `completions()` and `commitDay()` report a failure, `migrate()` returns `warned`
- Modify: `scripts/todo.js:54-60` — `migrate` prints each `warned` line
- Read: `scripts/todo-check.js` — `trackedIn` (`:187-200`, `LC_ALL: 'C'` at `:191`) and the `unreadable folder` branch (`:256`); this task tests them and does not change them
- Test: `tests/todo-check-folder.test.js` — four tests appended
- Test: `tests/todo-migrate-errors.test.js` — new

**Interfaces:**
- Consumes: `check.trackedIn(base, folder)` and `check.check(file, now)` from `scripts/todo-check.js`; `lib.COMPLETIONS_PAGE`, `lib.add`, `lib.migrate` from `lib/todo.js`; helpers `root()` and `git()` already in `tests/todo-check-folder.test.js`.
- Produces: `migrate(root, now)` returns `{ open, done, left, warned }`, `warned` an array of `{ sha, why }`; `commitDay(root, sha)` returns `{ day, warn }` (module-private).

**Dispatch:** implementer, sonnet — the code is in the plan; the one judgement is the fake `git`, and the plan carries it.

- [ ] **Step 1: Write the failing tests for `todo-check`**

Append to `tests/todo-check-folder.test.js`:

```js
test('an entry folder that cannot be read is an unreadable folder problem, not a crash', () => {
  const dir = root();
  fs.mkdirSync(path.join(dir, 'docs', 'todo', 'broken.md'));
  const r = check.check(path.join(dir, 'TODO.md'));
  assert.ok(r.problems.some((p) => p.kind === 'unreadable folder'), JSON.stringify(r.problems));
});

test('trackedIn asks git in the C locale, so its nothing-tracked match cannot be translated away', () => {
  const bin = tmp('fankeel-fakegit-');
  fs.copyFileSync(process.execPath, path.join(bin, process.platform === 'win32' ? 'git.exe' : 'git'));
  const stub = path.join(bin, 'stub.js');
  fs.writeFileSync(stub, [
    "process.stderr.write(process.env.LC_ALL === 'C' ? 'fatal: not a git repository\\n' : 'fatal: pas un depot git\\n');",
    'process.exit(128);',
  ].join('\n'));
  const keep = { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS, LC_ALL: process.env.LC_ALL };
  try {
    process.env.PATH = bin + path.delimiter + keep.PATH;
    process.env.NODE_OPTIONS = '--require "' + stub.replace(/\\/g, '/') + '"';
    process.env.LC_ALL = 'fr_FR.UTF-8';
    assert.deepEqual(check.trackedIn(tmp('fankeel-tracked-'), 'docs/todo'), []);
  } finally {
    for (const k of Object.keys(keep)) {
      if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k];
    }
  }
});

test('trackedIn lists only .md files under the folder', () => {
  const dir = root();
  lib.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  fs.writeFileSync(path.join(dir, 'docs', 'todo', 'notes.txt'), 'x\n');
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'x']);
  assert.deepEqual(check.trackedIn(dir, 'docs/todo'), ['docs/todo/a-1.md']);
});

test('trackedIn: a folder with no committed entry is an empty list, and a deleted tracked entry is a problem', () => {
  const dir = root();
  lib.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'x']);
  fs.rmSync(path.join(dir, 'docs', 'todo', 'a-1.md'));
  assert.deepEqual(check.trackedIn(dir, 'docs/todo'), ['docs/todo/a-1.md']);
  assert.ok(check.check(path.join(dir, 'TODO.md')).problems.some((p) => p.kind === 'deleted entry'));
});
```

- [ ] **Step 2: Run them, then mutate and watch each go red**

```sh
node --test tests/todo-check-folder.test.js
```

Expected: pass. Then, with Edit and each reversed before the next: (a) delete the `try { loaded = load(base, at); } catch` wrapper in `scripts/todo-check.js:252-257` so the error propagates — the `unreadable folder` test goes red; (b) delete `env: Object.assign({}, process.env, { LC_ALL: 'C' }),` at `:191` — the `C locale` test goes red; (c) change `.filter((l) => l.endsWith('.md'))` to `.filter(Boolean)` — the `only .md` test goes red; (d) delete `if (NOTHING_TRACKED.test(said)) return [];` — the existing `trackedIn: no repository` test goes red. Each row is `<test> — red when: <mutation>`; those four rows are the `trackedIn` mutation run the design asks for. `git diff --stat scripts/todo-check.js` must print nothing at the end.

- [ ] **Step 3: Write the failing tests for `--migrate`**

Create `tests/todo-migrate-errors.test.js`:

```js
'use strict';

// --migrate reports what it could not read or date (docs/90-agent/todo/todo-2.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const lib = require('../lib/todo.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'todo.js');

function project() {
  const dir = tmp('fankeel-migrate-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  fs.writeFileSync(path.join(dir, 'TODO.md'), '# TODO\n');
  return dir;
}

test('a completions page that cannot be read stops migrate and says which page', () => {
  const dir = project();
  fs.mkdirSync(path.join(dir, lib.COMPLETIONS_PAGE), { recursive: true });
  assert.throws(() => lib.migrate(dir, Date.parse('2026-09-29T00:00:00Z')), (e) => e.message.includes(lib.COMPLETIONS_PAGE));
});

test('a completions record whose commit cannot be dated is reported, and dated today', () => {
  const dir = project();
  const page = path.join(dir, lib.COMPLETIONS_PAGE);
  fs.mkdirSync(path.dirname(page), { recursive: true });
  fs.writeFileSync(page, '- original: shipped the thing\n  disposition: done\n  sha: abcdef1\n');
  const r = lib.migrate(dir, Date.parse('2026-09-29T00:00:00Z'));
  assert.equal(r.done, 1);
  assert.equal(r.warned.length, 1);
  assert.equal(r.warned[0].sha, 'abcdef1');
  assert.ok(r.warned[0].why.length > 0);
  assert.equal(lib.load(dir, Date.parse('2026-09-29T00:00:00Z')).done[0].done.at, '2026-09-29');
});

test('todo.js migrate prints a line for each record it could not date', () => {
  const dir = project();
  const page = path.join(dir, lib.COMPLETIONS_PAGE);
  fs.mkdirSync(path.dirname(page), { recursive: true });
  fs.writeFileSync(page, '- original: shipped the thing\n  disposition: done\n  sha: abcdef1\n');
  const out = execFileSync(process.execPath, [SCRIPT, 'migrate', '--root', dir], { encoding: 'utf8', cwd: dir });
  assert.match(out, /could not date abcdef1/);
});
```

Run `node --test tests/todo-migrate-errors.test.js` and confirm all three are red (the first does not throw, the second and third read `r.warned` of undefined).

- [ ] **Step 4: Make `completions` and `commitDay` report**

In `lib/todo.js`, replace `completions` and `commitDay` (`:572-596`) with:

```js
function completions(root) {
    let text;
    try {
        text = fs.readFileSync(path.join(root, COMPLETIONS_PAGE), 'utf8');
    } catch (e) {
        // No page is no records. A page that is there and cannot be read is not:
        // migrate would go on to write entries from nothing and print success.
        if (e && e.code === 'ENOENT') return [];
        throw new Error('cannot read ' + COMPLETIONS_PAGE + ': ' + (e && e.message));
    }
    const out = [];
    for (const m of text.matchAll(RECORD)) {
        if (!SHA.test(m[3])) continue;
        out.push({ original: m[1].trim(), disposition: m[2].trim(), sha: m[3] });
    }
    return out;
}

// `day` is null when git could not date the commit; `warn` says why, so the
// caller reports the fallback instead of silently using today.
function commitDay(root, sha) {
    try {
        const day = execFileSync('git', ['show', '-s', '--format=%cs', sha], {
            cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
        return { day: day || null, warn: day ? null : 'git printed no date' };
    } catch (e) {
        const said = String((e && e.stderr) || '').trim();
        return { day: null, warn: said || (e && e.message) || 'git failed' };
    }
}
```

In `lib/todo.js`, in `migrate`, replace the `for (const r of records) {` loop and the `return` with:

```js
    const warned = [];
    for (const r of records) {
        const f = fromLine(r.original, linksIn(r.original)[0] || '', 'done');
        const dated = commitDay(root, r.sha);
        if (dated.warn) warned.push({ sha: r.sha, why: dated.warn });
        write(Object.assign(f, {
            group: '', timing: '', stamp: '', body: '',
            done: { at: dated.day || isoDay(at), sha: r.sha, disposition: r.disposition, session: '' },
        }));
    }
    writeIndex(root);
    return { open: made.length - records.length, done: records.length, left, warned };
```

- [ ] **Step 5: Print the warnings**

In `scripts/todo.js`, replace the `migrate` branch body (`:55-59`) with:

```js
            const r = todo.migrate(root, at);
            const lines = ['fankeel todo migrate: ' + r.open + ' open, ' + r.done + ' done, ' + r.left.length
                + ' not migrated' + (r.left.length ? ' — under no known heading; re-add each with todo.js new:' : '')];
            for (const l of r.left) lines.push('  TODO.md:' + l.line + '  ' + l.text);
            for (const w of r.warned) lines.push('  could not date ' + w.sha + ': ' + w.why + ' — used today');
            return { text: lines.join('\n'), ok: true };
```

- [ ] **Step 6: Run, mutate, commit**

```sh
node --test tests/todo-migrate-errors.test.js tests/todo-files.test.js tests/todo-check-folder.test.js
git add tests/todo-migrate-errors.test.js
git commit -o lib/todo.js scripts/todo.js tests/todo-migrate-errors.test.js tests/todo-check-folder.test.js -m "fix: todo migrate reports an unreadable completions page and an undatable commit; the todo-check read-error paths go red when removed"
```

Before the commit, with Edit and each reversed: change the `ENOENT` guard in `completions` to `return []` for every error — the first migrate test goes red; make `commitDay` return `{ day: null, warn: null }` from its `catch` — the second and third go red. Return each as `<test> — red when: <mutation>`.

## Task 4: A `/fankeel` prompt writes an init entry; `start` takes it over; the station labels it

**Files:**
- Modify: `hooks/inject.js` — the not-in-the-mode branch writes the init entry and treats an init-only entry as not in the mode
- Modify: `scripts/task.js:531-1135` — `cmdStart` takes over this session's init entry (`:536`), `cmdAdopt` refuses an init source and takes over its own init entry (`:1124`)
- Modify: `lib/station.js:712-725` — the served row's `stage` for an init entry
- Read: `lib/registry.js` — `writeSession`, `readSession`, `readActive`, `rootFor`, `sessionPath`; `readActive` (`:208`) filters on `data.active === true`
- Read: `lib/render.js` — `taskOf` (`:51`, guards a missing task with `untitled`) and `otherLine` (`:56`), the two readers behind `also in progress:`
- Read: `lib/badge.js` — `writeLead` skips an empty field, which is what guards `title: mine.task` (`hooks/inject.js:249`) and `title: data.task` (`scripts/task.js:153`)
- Test: `tests/init-entry.test.js`

**Interfaces:**
- Consumes: `lib/todo.js` from Task 3 — `lib/station.js:29` and `scripts/task.js:27` require it; its exports are unchanged, only `migrate` gains a `warned` field neither reads, so Task 4 starts after Task 3 lands.
- Consumes: `registry.writeSession(root, sessionId, data)`, `registry.readSession(root, sessionId)`, `registry.readActive(root)`; `live.liveConfigDir()`; `station.gather({ configDir })` and `station.serialize(model).sessions`.
- Produces: an init entry is `{ stage: 'init', active: true, started, updated, configDir? }` with no `task` and no `route`; the predicate is written inline where it is used — `entry.active === true && entry.stage === 'init' && !entry.task` — in `hooks/inject.js` and `scripts/task.js`; `lib/station.js` serves `stage: '初始化中'` for it and keeps `task: ''`.

**Readers of `.task`, by file (grep of `lib/`, `hooks/`, `scripts/`, `assets/station/`):** 36 sites; each one and where it is settled —
- Guarded where read: `lib/guard.js:162`, `lib/render.js:51` (`taskOf`, used at `:57` and `:391`), `scripts/judge.js:104`, `lib/station.js:448`, `scripts/task.js:319,378,439,493,537,1102,1232,1259,1273,1400`.
- Guarded by the callee: `hooks/inject.js:249` and `scripts/task.js:153` hand the value to `badge.writeLead`, which drops an empty field; `lib/station.js:720` passes through the `''` that `:448` made.
- Unguarded and reachable: `scripts/task.js:1130` (`task: source.task` in `cmdAdopt`) — this task refuses an init source before it.
- Unguarded at the site, fed `''` by `lib/station.js:448`, so never `undefined`: `assets/station/station.js:169`, `:834`, `:2552`, `:4143` — this task's station test pins `task === ''` for an init row, and does not edit the asset.
- Guarded with `||` at the site: `assets/station/station.js:721,863,887,1545,1566,2240,2553,2636,2662,2687,2926,2937,3141,4710`.
- Not a read: `scripts/task.js:584,874` write the field (`cmdTask` on an init session turns it into a task at `route[0]`, which is a start by another name and is left alone); `lib/render.js:578`, `lib/stage-registry.js:36` are fixtures; `assets/station/i18n.js:661` is a label string.

**Dispatch:** implementer, sonnet — the plan carries the code; three small edits in three files and one test file, transcription plus tests.

- [ ] **Step 1: Write the failing test file**

Create `tests/init-entry.test.js`:

```js
'use strict';

// A /fankeel prompt makes a session visible before it has a task
// (.fankeel/build/task-20260929T104735/design.md §4).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const HOOKS = path.join(__dirname, '..', 'hooks');
const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const B = 'bbbbbbbb-0000-4000-8000-00000000000b';

function project() {
  const dir = tmp('fankeel-init-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  return { dir, cfg: tmp('fankeel-cfg-') };
}
function hook(name, payload, cfg) {
  const r = spawnSync(process.execPath, [path.join(HOOKS, name)], {
    input: JSON.stringify(payload), encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg, FANKEEL_SERVE: 'off' }),
  });
  assert.equal(r.status, 0, name + ': ' + r.stderr);
  return r.stdout;
}
function task(p, session, args) {
  const r = spawnSync(process.execPath, [TASK, ...args, '--session', session, '--root', p.dir, '--claude-dir', p.cfg], {
    encoding: 'utf8', cwd: p.dir, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: p.cfg }),
  });
  return { out: r.stdout + r.stderr, code: r.status };
}
const fankeel = (p, session, prompt) => hook('inject.js', { session_id: session, cwd: p.dir, prompt: prompt || '/fankeel' }, p.cfg);

test('a /fankeel prompt from a session with no entry writes an init entry with no task', () => {
  const p = project();
  fankeel(p, A);
  const e = registry.readSession(p.dir, A);
  assert.equal(e.active, true);
  assert.equal(e.stage, 'init');
  assert.equal('task' in e, false);
});

test('another session sees the init entry: task.js show lists it, and readActive counts it', () => {
  const p = project();
  fankeel(p, A);
  const r = task(p, B, ['show']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /@ init/);
  assert.deepEqual(registry.readActive(p.dir).map((x) => x.sessionId), [A]);
});

test('B's injected also-in-progress block names A as init', () => {
  const p = project();
  fankeel(p, A);
  assert.equal(task(p, B, ['start', '--task', 'b work', '--route', 'build,land']).code, 0);
  const out = JSON.parse(hook('inject.js', { session_id: B, cwd: p.dir, prompt: 'hello' }, p.cfg));
  assert.match(out.hookSpecificOutput.additionalContext, /also in progress:
 {2}- untitled @ init/);
});

test('an ordinary prompt from an init session says nothing and writes nothing; a second /fankeel still gets the init block', () => {
  const p = project();
  fankeel(p, A);
  const before = fs.readFileSync(path.join(p.dir, '.fankeel', 'sessions', A + '.json'), 'utf8');
  assert.equal(fankeel(p, A, 'hello'), '');
  assert.equal(fs.readFileSync(path.join(p.dir, '.fankeel', 'sessions', A + '.json'), 'utf8'), before);
  assert.ok(JSON.parse(fankeel(p, A)).hookSpecificOutput.additionalContext.includes(A));
});

test('start takes over this session\'s own init entry, and a second start is still refused', () => {
  const p = project();
  fankeel(p, A);
  const r = task(p, A, ['start', '--task', 'real work', '--route', 'build,land']);
  assert.equal(r.code, 0, r.out);
  const e = registry.readSession(p.dir, A);
  assert.equal(e.task, 'real work');
  assert.equal(e.stage, 'build');
  assert.match(task(p, A, ['start', '--task', 'again']).out, /already owns an active task/);
});

test('adopt refuses an init entry as its source and says there is nothing to carry', () => {
  const p = project();
  fankeel(p, A);
  const r = task(p, B, ['adopt', A]);
  assert.equal(r.code, 1);
  assert.match(r.out, /no task to adopt/);
});

test('every hook that reads the entry exits 0 on an init entry and prints no undefined', () => {
  const p = project();
  fankeel(p, A);
  const base = { session_id: A, cwd: p.dir, transcript_path: path.join(p.dir, 'none.jsonl') };
  const payloads = {
    'guard.js': { ...base, tool_name: 'Write', tool_input: { file_path: path.join(p.dir, 'x.txt'), content: 'x' } },
    'touch.js': { ...base, tool_name: 'Write', tool_input: { file_path: path.join(p.dir, 'x.txt') } },
    'brief.js': { ...base, hook_event_name: 'SubagentStart', agent_type: 'general-purpose' },
    'resume.js': { ...base, tool_name: 'AskUserQuestion', tool_input: {} },
    'gate.js': { ...base, tool_name: 'AskUserQuestion', tool_input: { questions: [] } },
    'leave.js': { ...base, hook_event_name: 'SessionEnd', reason: 'other' },
    'carry.js': { ...base, hook_event_name: 'SessionStart', source: 'clear' },
    'title.js': { ...base, tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', description: 'look', prompt: 'p' } },
  };
  for (const [name, payload] of Object.entries(payloads)) {
    const out = hook(name, payload, p.cfg);
    assert.doesNotMatch(out, /undefined|\[object/, name);
  }
});

test('carry offers an init entry a cleared session left behind, and names it untitled', () => {
  const p = project();
  fankeel(p, A);
  fs.mkdirSync(path.join(p.cfg, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(p.cfg, 'sessions', process.pid + '.json'), JSON.stringify({ pid: process.pid, sessionId: B }) + '
');
  const out = hook('carry.js', { session_id: B, cwd: p.dir, source: 'clear', hook_event_name: 'SessionStart' }, p.cfg);
  assert.match(out, /task: {2}untitled/);
  assert.doesNotMatch(out, /undefined|[object/);
});

test('the station serves an init row as 初始化中 with an empty task, and its live rows equal the registry\'s active entries', () => {
  const p = project();
  fankeel(p, A);
  fankeel(p, B);
  const rows = station.serialize(station.gather({ configDir: p.cfg })).sessions;
  const mine = rows.find((s) => s.id === A);
  assert.equal(mine.stage, '初始化中');
  assert.equal(mine.task, '');
  assert.equal(rows.filter((s) => s.state === 'live').length, registry.readActive(p.dir).length);
});
```

- [ ] **Step 2: Run it and watch it fail**

```sh
git add tests/init-entry.test.js
node --test tests/init-entry.test.js
```

Expected: red on the first, second, third and fourth tests (there is no entry today), and on the station test. Record which of the hooks test (seven) and the carry test (eight) pass on an empty registry — they pass vacuously today; step 6 reruns them with an entry present.

- [ ] **Step 3: Write the init entry in `hooks/inject.js`**

In `hooks/inject.js`, replace the two lines at `:93-94`:

```js
    let mine = registry.readSession(root, sessionId);
    if (!mine || mine.active !== true) {
        const starting = startsFankeel(payload.prompt);
```

with, in `hooks/inject.js`:

```js
    let mine = registry.readSession(root, sessionId);
    // A session that has only run `/fankeel` holds an entry with no task. It is
    // visible to its neighbours and it is not yet in the mode: its prompts stay
    // on the cheap path below, and a second `/fankeel` still gets the init block.
    const initOnly = Boolean(mine) && mine.active === true && mine.stage === 'init' && !mine.task;
    if (!mine || mine.active !== true || initOnly) {
        const starting = startsFankeel(payload.prompt);
```

In `hooks/inject.js`, directly after the line `const speaks = Boolean(starting && registry.sessionPath(root, sessionId));` add:

```js
        // The one moment a session with no entry can be made visible. `speaks`
        // has already checked the id has the shape of a session id; the entry
        // carries no task, no route and no claims, and `task.js start` replaces it.
        if (speaks && !mine) {
            const stamp = new Date().toISOString();
            registry.writeSession(root, sessionId, {
                stage: 'init', active: true, configDir: live.liveConfigDir() || undefined, started: stamp, updated: stamp,
            });
        }
```

- [ ] **Step 4: Let `start` take over, and `adopt` refuse an init source**

In `scripts/task.js`, replace the check in `cmdStart` (`:534-538`):

```js
    if (existing && existing.active === true) {
        fail('This session already owns an active task: ' + (existing.task || 'untitled')
            + '\nCarry on, or stand it down first. Starting again would overwrite it.');
    }
```

with, in `scripts/task.js`:

```js
    // This session's own init entry — written by the `/fankeel` prompt, no task
    // on it — is not a task to stand down: `start` is what it was waiting for.
    const initOnly = Boolean(existing) && existing.stage === 'init' && !existing.task;
    if (existing && existing.active === true && !initOnly) {
        fail('This session already owns an active task: ' + (existing.task || 'untitled')
            + '\nCarry on, or stand it down first. Starting again would overwrite it.');
    }
```

In `scripts/task.js`, in `cmdAdopt`, replace `:1119-1124` (`const source = ...` through the `mine.active` check):

```js
    const source = registry.readSession(root, from);
    if (!source) fail('No entry for ' + from + ' under ' + root);

    const mine = registry.readSession(root, id);
    if (mine && mine.active === true) fail('This session already owns an active task. Stand it down first.');
```

with, in `scripts/task.js`:

```js
    const source = registry.readSession(root, from);
    if (!source) fail('No entry for ' + from + ' under ' + root);
    if (source.stage === 'init' && !source.task) fail(from + ' is still at init: it has no task to adopt.');

    const mine = registry.readSession(root, id);
    const mineInit = Boolean(mine) && mine.stage === 'init' && !mine.task;
    if (mine && mine.active === true && !mineInit) fail('This session already owns an active task. Stand it down first.');
```

- [ ] **Step 5: Label the row in `lib/station.js`**

In `lib/station.js`, in the `sessions: flatten(model).map((s) => ({` object (`:720-722`), replace `state: s.state, unknown: s.unknown, stage: s.stage, route: s.route,` with:

```js
            state: s.state, unknown: s.unknown, stage: s.stage === 'init' && !s.task ? INIT_LABEL : s.stage, route: s.route,
```

In `lib/station.js`, add above `function serialize(model, opts) {`:

```js
// What the stage cell says for an entry a `/fankeel` prompt wrote and nothing
// has started yet: no task, no route, stage `init`.
const INIT_LABEL = '初始化中';
```

- [ ] **Step 6: Run the file, then the whole suite, mutate, commit**

```sh
node --test tests/init-entry.test.js
npm test
```

Expected: all nine pass. If the every-hook test prints `undefined` or `[object`, or the carry test finds no `task:  untitled` line, do not edit anything: stop and return `blocked: <hook or lib file> reads <field> of an init entry`, so the plan can give that file its own task. No file beyond this task's three `Modify:` paths is expected to need a change. Then, with Edit and each reversed: delete the `writeSession` block in `hooks/inject.js` (tests one, two, three, four, nine go red); change `!initOnly` to `true` in `cmdStart` (test five goes red); delete the `source.stage === 'init'` line in `cmdAdopt` (test six goes red); delete `|| initOnly` in `hooks/inject.js` (test four goes red); revert `INIT_LABEL` in the row (test nine goes red). Return each as `<test> — red when: <mutation>`. Then render the page from a session that has only run `/fankeel` — `FANKEEL_SERVE=off node scripts/station.js` writes it — and read that row's stage cell in the served data (`grep -c 初始化中` on the written `station-data`), and put the count in the return.

```sh
git commit -o hooks/inject.js scripts/task.js lib/station.js tests/init-entry.test.js -m "fix: a /fankeel prompt writes an init entry so the session is visible, start takes it over, the station says 初始化中"
```

## Task 5: The reference pages say an init session is visible

**Files:**
- Modify: `docs/90-agent/reference/registry.md:556-564` — the inject-hook row says a `/fankeel` prompt also writes an init entry
- Modify: `docs/90-agent/reference/collisions.md:1-20` — one paragraph: a session is visible to its neighbours from its `/fankeel` prompt

**Interfaces:**
- Consumes: Task 4's behaviour, described here and not called.
- Produces: nothing.

**Dispatch:** implementer, sonnet — two prose edits whose text is in the plan.

- [ ] **Step 1: Say the init entry in two reference pages**

In `docs/90-agent/reference/registry.md`, replace the `hooks/inject.js` row at `:562` with:

```text
| `hooks/inject.js` | a `/fankeel` prompt is answered with the `init` block: this session's id — the one that hook is itself holding — and the rules for the step before there is a task. It also writes this session's entry as `{ active: true, stage: 'init' }` with no `task`, so a neighbour's `also in progress:` and `task.js show` list a session that has only run `/fankeel`, and the station shows its row as 初始化中; `task.js start` takes that entry over. |
```

In `docs/90-agent/reference/collisions.md`, after the paragraph that ends at line 12 (`what happens to a claim whose terminal is gone.`), add:

```text
A session is visible from its `/fankeel` prompt, not from its first `task.js start`: the prompt writes an entry with stage `init` and no task, another session's `also in progress:` line and `task.js show` list it as `untitled @ init`, and `start` replaces it. It holds no claims yet, so it collides with nothing.
```

- [ ] **Step 2: Check and commit**

```sh
node scripts/docs-check.js
git commit -o docs/90-agent/reference/registry.md docs/90-agent/reference/collisions.md -m "docs: an init session is visible — registry and collisions say so"
```

## Task 6: Close and rewrite the TODO entries

**Files:**
- Modify: `docs/90-agent/todo/:1-1` — entries closed or created with `node scripts/todo.js done|new`, never by hand; the range counts the directory as one line
- Modify: `TODO.md` — regenerated by `node scripts/todo.js index`, never edited by hand
- Read: `docs/90-agent/reference/todo.md` — the entry contract (`done` needs `--sha`; dispositions are `done`, `measured-no-change`, `abandoned`)
- Read: `docs/90-agent/todo/station-3.md`, `docs/90-agent/todo/model-1.md` — read before writing; the fold goes into `station-3`'s subject
- Read: `docs/90-agent/reference/registry.md` — Task 5's commit on it is the sha that closes the two decisions

**Interfaces:**
- Consumes: Tasks 1-5 committed, so each entry's delivering commit exists.
- Produces: `advisor-1`, `model-1`, `station-3`, `collisions-1`, `station-2`, `tests-2`, `title-1`, `todo-2` closed; one new `station` entry holding what `model-1` and `station-3` left open.

**Dispatch:** in-session — the closing shas come from the commits Tasks 1-5 just made and the fold needs a reading of two entries; both are decided in the session that holds the ledger, and none of it is code.

- [ ] **Step 1: Read the two entries and the contract**

Read `docs/90-agent/todo/station-3.md`, `docs/90-agent/todo/model-1.md` and `docs/90-agent/reference/todo.md`. `station-3.md` is "單次任務臨時拉高 effort", the profile-generated `.claude/agents/` override, and the design folds `model-1` into it. If the reading disagrees, stop and ask before writing.

- [ ] **Step 2: Close what Tasks 1-4 delivered, pinning each sha**

```sh
S1=$(git log -1 --format=%H -- tests/plantasks-lint-cap.test.js)
S2=$(git log -1 --format=%H -- tests/title-hook.test.js)
S3=$(git log -1 --format=%H -- lib/todo.js)
S4=$(git log -1 --format=%H -- hooks/inject.js)
echo "tests-2 $S1 / title-1 $S2 / todo-2 $S3 / collisions-1 and station-2 $S4"
node scripts/todo.js done tests-2 --sha "$S1"
node scripts/todo.js done title-1 --sha "$S2"
node scripts/todo.js done todo-2 --sha "$S3"
node scripts/todo.js done collisions-1 --sha "$S4"
node scripts/todo.js done station-2 --sha "$S4"
```

Paste the `echo` line into the return: a sha that moves (`HEAD~1`) is not evidence, a resolved one is.

- [ ] **Step 3: Close the two decisions and fold `model-1`, pinning the pages commit**

```sh
SD=$(git log -1 --format=%H -- docs/90-agent/reference/registry.md)
echo "advisor-1, model-1, station-3 $SD"
node scripts/todo.js done advisor-1 --sha "$SD" --disposition done
node scripts/todo.js done model-1 --sha "$SD" --disposition abandoned
node scripts/todo.js done station-3 --sha "$SD" --disposition abandoned
node scripts/todo.js new --label station --title "單次拉高 effort 與蓋掉模型" --state ready --link docs/90-agent/reference/model-choice.md --description "effort 已在 8 個 agent 檔釘死；使用者要蓋掉模型或臨時拉高 effort，只能從 profile 產生 .claude/agents/ 覆寫檔（外掛更新不會蓋掉）。先實測同名檔能否蓋過 fankeel: 的 agent，guard／brief 要認得新名稱"
```

`advisor-1` is closed because `/fankeel-ask` is user-invoked by design and the brain must not call an advisor; `model-1` and `station-3` close as `abandoned` because their remaining subject is the one new entry.

- [ ] **Step 4: Regenerate the index, check, commit**

```sh
node scripts/todo.js index
node scripts/todo-check.js
node scripts/docs-check.js
npm test
git status --short
git commit -o TODO.md docs/90-agent/todo -m "docs: close eight entries the todo patrol settled, and fold model-1 into one override entry"
```

`git status --short` must show nothing else modified; a path that appears there and is not this task's is a neighbour's, and is left alone.

## Coverage

| promise | task |
|---|---|
| `tests/plantasks-lint-cap.test.js` reads the line count of `assets/station/station.js` from disk instead of the literal 5174 at lines 25 and 28. | Task 1 |
| A test sets only `CLAUDE_CODE_SUBAGENT_MODEL` and asserts it ranks below the agent file's `model:` and above the session's model (`lib/title.js:119`). | Task 2 |
| An env-only control probe is run once and its result filed as a dated report under `docs/90-agent/reports/`. | Task 2 |
| A test that goes red when the `unreadable folder` branch of `lib/todo.js` is deleted. | Task 3 (the branch is in `scripts/todo-check.js:256`; the test is written against it) |
| A test that goes red when `LC_ALL=C` handling is removed. | Task 3 |
| `trackedIn` gets a mutation run, recorded in the ledger. | Task 3 |
| `--migrate`'s `completions()` and `commitDay` stop swallowing errors: a failure is reported, not dropped. | Task 3 |
| On a `/fankeel` prompt from a session with no entry, `hooks/inject.js` writes `{active: true, stage: 'init'}` with no `task`, through `lib/registry.js`. | Task 4 |
| `task.js start` takes over this session's own init entry instead of refusing it as an already-active task (`scripts/task.js:536`, `:1124`). | Task 4 |
| Every reader of `data.task` copes with its absence — render, station, carry, show, title/brief hooks. | Task 4 (the reader list is in the task; `task.js:1130` guarded, the four `assets/station/station.js` sites pinned by the `task === ''` assertion) |
| Another session's injected `also in progress:` and `task.js show` list an init entry. | Task 4 |
| The station shows an init row as 初始化中. | Task 4 |
| `docs/90-agent/reference/registry.md` and `collisions.md` say an init session is visible. | Task 5 |
| `advisor-1` is closed with `todo.js done`: `/fankeel-ask` is user-invoked by design and the brain must not call an advisor. | Task 6 |
| `model-1` is folded into `station-3`: fixed effort is already pinned in all 8 agent files; the user override comes from profile-generated `.claude/agents/` files that survive plugin updates. | Task 6 |
| `collisions-1` and `station-2` are closed by the init entry. | Task 6 |
| cap test — change station.js length by one line → old literal red, new test green | Task 1 |
| env order — swap env/agent-file order in lib/title.js → new test red | Task 2 |
| todo — delete the unreadable-folder branch → new test red | Task 3 |
| init entry — A has only run `/fankeel`; B's `task.js show` lists A as init — red today, green after | Task 4 |
| station artefact — rendered station page shows A's row as 初始化中 and its live-row count equals the registry's active entries | Task 4 |
