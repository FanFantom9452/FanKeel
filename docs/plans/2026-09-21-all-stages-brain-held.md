---
status: design-intent
last_verified: 2026-09-22
---

# All-stages brain: tasks 2 to 9

**Promoted 2026-09-22.** Tasks 2 to 6 are the rest of [the plan](../archive/2026-09-21-all-stages-brain.md), cut off at its gate, where the user chose to build only that plan's Task 1, `ctx.js --by-stage`, and measure first. The user has now opened the run: they asked for every stage to go under a Sonnet stage agent (spec §6). So the measurement is taken after the release, not before it: it is the user-opened run in the spec's last §6 bullet, read afterwards with `ctx.js --by-stage` and `modelUsage`, and a report that shows the commit round trip too dear still moves `COMMIT_RULE` (Task 4). A `fankeel-reviewer` read Tasks 2 to 6 against the spec once and its four gaps were fixed; Tasks 7 to 9 are new and have had no review; nothing here has run. The file keeps its `-held` name so that the links to it hold.

**Task numbers 2 to 6 stay as they were**, so a `Task 2` written inside a task below is the task of this file, and Task 1 is the one already built. Tasks 7 to 9 are new: 7 puts the brain on Sonnet and Opus back on design and plan, 8 is the permission change the user approves, 9 is the release. **Run order: 2, 3, 4, 5, 7, 8, 6, 9.** Task 7 rewrites the dispatch line Task 4 writes, Task 6 documents what 7 and 8 land, and Task 9 releases all of it.

**Goal:** with `stage.agents` at `all`, every stage runs under a stage agent, on Sonnet except design and plan, and the release goes out before the user turns the key.
**Architecture:** the controller stays a dispatcher; handoff files are numbered per lap, each brain is told what to read first, design and plan write one `docs/plans/` file and commit through the controller, audit and land send their changes to an implementer.
**Tech Stack:** Node with no dependencies, `node --test`, Claude Code plugin hooks and agent files.
**Spec:** [2026-09-21-all-stages-brain-design.md](2026-09-21-all-stages-brain-design.md) — it stays in `docs/plans/` until these tasks land, and so does this file.

## Global Constraints

Generated from `node scripts/map.js` (238 markdown files, 5 planned, not built, 115 retired, 8 undeclared), `CONTRIBUTING.md`, `package.json` and the suite.

- There is no `CLAUDE.md` and no `AGENTS.md`; conventions are in `CONTRIBUTING.md`.
- `lib/*.js` are pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction.
- Every hook exits `0` on every path, including its own errors. This plan adds no hook.
- Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it.
- Zero dependencies: `package.json` lists none. Tests run with `npm test` = `node --test`.
- Indentation is per file: 4 spaces in `lib/`, `scripts/`, `hooks/`, `tests/ctx.test.js` and `tests/agents.test.js`; 2 spaces in `tests/handoff.test.js`, `tests/brief.test.js`, `tests/stages.test.js` and `tests/task.test.js`.
- A brain brief stays under 10,000 characters (`tests/brief.test.js:249`, `:385`); an ordinary subagent brief under 1,400 (`:145`, `:292`, `:309`).
- A controlled block stays under 2,400 characters at a real plugin root (`tests/render.test.js:690`, `sizeAtReference(out) < 2400`). Measured 2026-09-22 with all seven stages on the list: a controlled `build` block is 1,505 characters from `render` and 1,693 from `renderResume`, the larger; `design` and `plan` 1,302 and 1,293 from `render`.
- `tests/brief.test.js:371-378` pins three phrases in `agents/fankeel-brain.md`: `/on a build\s+stage, the commit\s+file it names/` in `## Tools`, `/on a build\s+stage the commit file/` in `## Refusals`, and `` /`commit <path>` for a task to commit/ `` in `## Return`. A rewording keeps all three.
- `docs-check` cites `path:line`. Do not add a line to `lib/stages.js` above line 643 or to `lib/render.js` above line 397 in a way that moves a cited line without running `node scripts/docs-check.js` afterwards; it prints the fixes.
- `moves` keeps the newest 60 entries (`MAX_MOVES`, `lib/registry.js:51`).
- A commit subject is `feat:`, `fix:`, `test:` or `docs:` and one line of Chinese; the body ends with the attribution lines the session was given. The parent commits, one task at a time; an implementer returns the paths it changed.
- Task 7 changes the `Dispatch one Agent:` line of `controlRules` in place, on the one line, so no cited line in `lib/stages.js` moves (the rule two lines above).
- No agent writes a settings file (spec §6). `.claude/settings.local.json` is per machine, is written by the parent session only after the user has answered a gate (Task 8), and is never committed.
- A page under `docs/decisions/` opens with `status: decision` and `last_verified`, is written in Traditional Chinese, and needs a row in `docs/README.md`.
- A release number is the user's claim: `node scripts/version.js <x.y.z>` runs on their say-so, and `git push` only when they ask for that alone (`docs/development.md`, `Releasing`, steps 3 and 7).

## File Structure

| file | responsibility after this plan |
|---|---|
| `scripts/ctx.js` | what one session's main thread did, turn by turn, now also cut by stage |
| `lib/handoff.js` | where a stage agent's report, answer and commit file live, per lap, and where a renamed task's laps start; what a report says to read next; which earlier report is the newest |
| `scripts/task.js` | a rename records the laps the old task used (`lapped`); an adopt carries it |
| `lib/render.js` | `renderBrainBrief`: read first, artifact, implementer route |
| `lib/stages.js` | which stages relay a commit; which agents audit and land may dispatch; which model a dispatch names |
| `agents/fankeel-brain.md` | what the brain may write, and the model it runs on |
| `.claude/settings.local.json`, `.gitignore` | the per-machine permission that lets a handoff be written, and the line that keeps that file out of git |
| `docs/decisions/2026-09-22-brain-on-sonnet.md` | why the brain is on Sonnet and design and plan are not |
| `docs/subagents.md`, `skills/fankeel/SKILL.md`, the spec, `TODO.md`, `docs/README.md` | say all of the above |
| `package.json`, `.claude-plugin/plugin.json`, the eleven `skills/*/SKILL.md` | the release number, written by `scripts/version.js` |

## Coverage

| promise | task |
|---|---|
| 用 `claude --plugin-dir F:/ymlab/fankeel` 開新終端機，或重裝；確認 `controlling('build', …)` 為真才開始。profile 用 | built or struck in the plan: struck — a person opens a terminal and runs a real task; Task 1 builds the script that reads it afterwards |
| 量的是一個有 plan 的真實 task，不是 fixture。跑完用 `node scripts/ctx.js` 取主控每站的 turn 數、被叫醒次數、 | built or struck in the plan: Task 1 — the `--by-stage` view is what "取主控每站的 turn 數" needs; the run itself is the user's |
| 結果落成一份 dated report（`docs/reports/`），至少回答三件事：主控每個 task 的提交來回實際佔幾個 turn；build brain | built or struck in the plan: struck — written from a real run, which only a person can start; verify records it as unverified |
| 這個 task 只加量測工具、不改任何行為：`node scripts/ctx.js <session> --by-stage` 印出每站的主控 turn 數、 | built or struck in the plan: Task 1 — amended: the task adds `ctx.js --by-stage` and no other code; the spec sentence is rewritten in the plan-gate commit, not in a task |
| 等量測：§1 若顯示主控的提交來回太貴，`COMMIT_RULE` 的位置要重審，這一節的提交那條跟著改。 | built or struck in the plan: struck — conditional on a measurement no task can produce |
| 一條對成品：§1 之後的第二次真實受控跑，取一個 brain 的 transcript（`subagents/agent-<id>.jsonl`）的第一則訊息， | built or struck in the plan: struck — needs a real controlled run in a new terminal; verify names it unverified |
| 量的門檻：同類的完整 route，主控 ≤ 60 turn、最後一個 gate < 200k（session 4f52fd18：454 turn、952k）。門檻是作者提的， | built or struck in the plan: struck — read off a real run; Task 1 supplies the reader |
| 一站的第一次進場沿用現在的檔名（`build.md`、`build-answer.md`、`build-commit.md`）；第 n 次進場（n ≥ 2，數法是 | Task 2 |
| `handoffPath`、`answerPath`、`commitPath` 三個函式是唯一算圈號的地方；`hooks/gate.js:47` 讀 gate、`hooks/resume.js` | Task 2 |
| 上一圈的 gate 不會被當成這一圈的：這一圈的檔還沒寫，`readGate` 讀不到就回 null，gate hook 照舊放行主控自己的問題。 | Task 2 |
| `task.js stage` 經 `stampEntry`（`lib/registry.js:510`）在派 brain 之前就蓋好這一次進場的戳，而且只在這一站與上一筆 | Task 2 — relies on it and says so in `lapOf`'s comment; nothing to build |
| `moves` 只留最近 60 筆（`MAX_MOVES`，`lib/registry.js:51`），同一站進場次數超過保留窗時圈號可能重複；已知的上限，不處理。 | Task 2 — written down in `lapOf`'s comment, not handled |
| 改任務名的 `cmdTask`（`scripts/task.js`）刪掉 `moves` 卻保留 | Task 2 — ruled at its top: a rename keeps the directory and records `lapped`, Step 5 |
| 每份 handoff 在 `json gate` 區塊之前多一個 `reads:` 區塊：每行 `<路徑> — <為什麼>`，最多 8 行。寫的是剛讀完內容的 | Task 3 |
| `renderBrainBrief` 印一段 `read first:`：從 `moves` 找上一次進場的那一站，取它那一圈的 handoff 路徑，加上該檔 | Task 3 |
| 讀 `reads:` 的是 `hooks/brief.js`（SubagentStart），不是主控；主控一份 handoff 也不打開。 | Task 3 — `hooks/brief.js` already passes `root` and the record to `renderBrief`; the read happens there |
| 主控派工的 prompt 除了站名可以再加一行（使用者剛給的新指示）。那一行本來就在 brain 的第一則訊息裡，brief 不轉印： | Task 4 — `controlRules` says the prompt is the stage name plus one line when the user just gave a new instruction; the brief still does not print it |
| `read first:` 最多印 12 行、1000 字元，超過的寫「另有 N 行未列」，不默默截掉；整份 brief 仍在 Claude Code 對單一 | Task 3 — the phrase is `N more not listed`; Task 6 amends the spec's wording |
| brief 在 design（架構級）與 plan 站多一行 `artifact:`，指向 `docs/plans/`：brain 除了 handoff 只准 Write 那裡的一個檔， | Task 4 |
| design 與 plan 站的提交走 commit 檔，跟 build 今天一樣：兩站的 `controlRules` 也帶 `COMMIT_RULE` | Task 4 |
| audit 與 land：brain 沒有 Edit、也不做 git 寫入；audit 要改的頁面、land 的搬檔、merge 與清理，都交給 | Task 5 |
| builtin 維持 `false`。七站全拆只是 profile 的 `stage.agents: all`，`parseStageAgents` 已經接受。 | Task 6 — documented; no code changes the builtin |
| `docs/subagents.md` 的「A stage agent」一節與 skill 的「Delegate a job inside a stage; never the stage itself」把例外改寫成 | Task 6 |
| `docs/subagents.md`「What a controlled `build` and `verify` have not been run through」裡「A stale gate」那條，§2 落地後刪掉。 | Task 6 |
| `tests/handoff.test.js`：`moves` 為 `[build, verify, build]` 時 build 的 `handoffPath` 以 `build-2.md` 結尾；`moves` 為 | Task 2 |
| `tests/brief.test.js`：seed 一份帶 `reads:` 的 verify handoff、`moves` 以 verify、build 結尾，build brain 的 brief 在 | Task 3 |
| `tests/stages.test.js`：design、plan 的 `controlRules` 含 `commit <file>` 那條，audit、land 不含。 | Task 4 |
| brain 的模型：`agents/fankeel-brain.md` 改成 `model: sonnet`；主控派 design 與 plan 時指定 `model: opus`，其餘五站不傳 model。 | Task 7 — the agent file, the dispatch line, the decision record; Task 6 says it in `docs/subagents.md` |
| handoff 寫入不再被分類器擋：`.claude/settings.local.json`（每台機器，不進版控）放 `permissions.allow: ["Edit(/.fankeel/build/**)"]`。 | Task 8 — the file, the `.gitignore` line, a before and after probe; Task 6 says it in `docs/subagents.md` and removes the TODO entry |
| design 與 plan 由 brain 完成：held Task 2 至 4 照原文，brain 能寫一個 `docs/plans` 檔並走 `commit <file>`。 | Tasks 2, 3 and 4 as written; Task 7 puts the two stages on Opus |
| audit 與 land 進 `STAGE_AGENTS`：held Task 5 照原文，帶 implementer 做移檔、merge 與清理，整合方式仍在關卡問。 | Task 5 as written |
| 改名不留舊圈：`task.js task` 改名之後，新一圈的 `readGate` 在目錄仍留舊圈檔案時回 null；補 held Task 2 缺的一步，`scripts/task.js` 列入 `Files:`。 | Task 2 — Steps 2, 4, 5 and 6 |
| 發版在前、翻開關在後：安裝版 0.74.0 沒有 `STAGE_AGENTS`，`profile show` 也把清單讀成 `false`，所以先發版，再由使用者把 `stage.agents` 設成 `all`；成本門檻沿用本 spec 的 controller 至多 60 turns、最後一關低於 200k。 | Task 9 — the release, then the user's own flip as its last step; the threshold read from the run that follows is struck: no task can produce it, and verify names it unverified |

## Task 2: Handoff files per lap

**The rename case, ruled (spec §6, fifth bullet).** `cmdTask` in `scripts/task.js` deletes `moves` but keeps `started`, and `started` is the handoff directory's key (`dirFor` in `lib/handoff.js`), so a renamed task would restart at lap 1 in a directory that still holds the old task's laps, and would read the old gate as its own. The ruling: a rename keeps the directory and keeps forgetting `moves`, and it writes `lapped` on the record, the highest lap number the old task used (`lapsUsed`, below). The new task's laps are numbered from there, so its first lap of any stage is a file no earlier task wrote and `readGate` finds nothing at it. `cmdAdopt` copies `lapped`, so a renamed task another session adopts keeps counting past the old laps. `cmdTask` still does not stamp `moves`: `stampEntry` also writes `clock`, which the test `renaming the task forgets the clock, the wait, the per-stage spend and any open gate` requires gone, and the `## Needs a decision` entry about stamping stays open. A task that was never renamed has no `lapped` and is numbered as before; the first rename of a fresh task starts its first lap at `<stage>-2.md`, which is harmless because every reader goes through the path functions.

**Files:**
- Modify: `lib/handoff.js` — `handoffPath`, `commitPath` and `answerPath` number a stage's second and later visits and a renamed task's laps; `lapsUsed` is new
- Modify: `scripts/task.js` — `cmdTask` stores `lapped` before it drops `moves`, `cmdAdopt` copies it, and the `require` of `lib/handoff.js` takes `lapsUsed`
- Modify: `TODO.md` — the `## Ready` bullet that begins `〔stage-agents〕圈號要先處理改名的 task` is delivered by this task, so it goes
- Read: `hooks/gate.js` — line 47 calls `handoffPath(root, mine, mine.stage)` with the record, which carries `moves` and `lapped`
- Read: `hooks/resume.js` — line 75 calls `answerPath(root, mine, mine.stage)` the same way
- Test: `tests/handoff.test.js`
- Test: `tests/task.test.js`

**Interfaces:**
- Consumes: the registry record's `moves` — `[[stage, at], …]`, one entry per change of stage, stamped by `task.js stage` through `stampEntry` before anything is dispatched (`lib/registry.js:510`) — and its `lapped`, an integer written by `cmdTask` below (absent means 0).
- Produces: `handoffPath(root, data, stage)`, `commitPath(root, data, stage)` and `answerPath(root, data, stage)` keep their signatures. With `lapped` = L (0 when absent) and V the number of times `stage` is in `moves` (at least 1), the lap is L + V: lap 1 returns `<stage>.md`, `<stage>-commit.md`, `<stage>-answer.md`; lap n ≥ 2 returns `<stage>-<n>.md`, `<stage>-<n>-commit.md`, `<stage>-<n>-answer.md`. A record with no `moves` and no `lapped` is on the first lap of every stage. One new export, `lapsUsed(data)` → the highest lap number the record has used (L plus the most visits to any one stage, at least 1); `scripts/task.js` imports it. Task 3's `previousHandoff` builds a record by hand and must pass `lapped` on, as it does below.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing tests**

In `tests/handoff.test.js`, change the `require` of the handoff module to also take `commitPath` and `lapsUsed`:

```js
const { handoffPath, commitPath, answerPath, readGate, writeAnswer, lapsUsed } = require('../lib/handoff.js');
```

In `tests/handoff.test.js`, after the `gateOf` helper, add the `moved` helper:

```js
const moved = (...stages) => Object.assign({}, DATA, { moves: stages.map((s, i) => [s, 1000 + i]) });
```

In `tests/handoff.test.js`, after the last test, append four:

```js
test('a stage keeps its file names on the first visit and numbers each return', () => {
  const dir = '/r/.fankeel/build/task-20260919T093012/';
  assert.equal(handoffPath('/r', moved('build'), 'build'), dir + 'build.md');
  const back = moved('build', 'verify', 'build');
  assert.equal(handoffPath('/r', back, 'build'), dir + 'build-2.md');
  assert.equal(answerPath('/r', back, 'build'), dir + 'build-2-answer.md');
  assert.equal(commitPath('/r', back, 'build'), dir + 'build-2-commit.md');
  assert.equal(handoffPath('/r', back, 'verify'), dir + 'verify.md');
});

test('a record with no moves is on the first visit of every stage', () => {
  assert.equal(handoffPath('/r', DATA, 'build'), '/r/.fankeel/build/task-20260919T093012/build.md');
});

test('the gate of an earlier lap is not the gate of this one', () => {
  const root = tmp('fankeel-handoff-');
  const first = moved('build');
  const second = moved('build', 'verify', 'build');
  const file = handoffPath(root, first, 'build');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, block(gateOf('lap one')));
  assert.equal(readGate(handoffPath(root, first, 'build')).questions[0].question, 'lap one');
  assert.equal(readGate(handoffPath(root, second, 'build')), null);
});

test('a renamed task numbers its laps past the ones the old task used', () => {
  const dir = '/r/.fankeel/build/task-20260919T093012/';
  const renamed = (...stages) => Object.assign(moved(...stages), { lapped: 2 });
  assert.equal(handoffPath('/r', renamed(), 'build'), dir + 'build-3.md');
  assert.equal(handoffPath('/r', renamed('build'), 'build'), dir + 'build-3.md');
  assert.equal(handoffPath('/r', renamed('build', 'verify', 'build'), 'build'), dir + 'build-4.md');
  assert.equal(lapsUsed(DATA), 1);
  assert.equal(lapsUsed(moved('build', 'verify', 'build')), 2);
  assert.equal(lapsUsed(renamed('build')), 3);
});
```

- [ ] **Step 2: Write the failing tests in `tests/task.test.js`**

In `tests/task.test.js`, after the test named `renaming the task forgets the moves, as it forgets the clock`, add:

```js
test('renaming the task numbers its laps past the old task\'s, so an old gate is not the new task\'s', () => {
  const { handoffPath, readGate } = require('../lib/handoff.js');
  const dir = root();
  started(dir, A, 'rework the colour ramp');
  const old = entry(dir, A);
  old.moves = [['survey', 1000], ['build', 2000], ['verify', 3000], ['build', 4000]];
  registry.writeSession(dir, A, old);
  // What an unfixed rename would read: the first lap of the first stage, still on disk.
  const stale = handoffPath(dir, { started: old.started }, 'survey');
  fs.mkdirSync(path.dirname(stale), { recursive: true });
  const fence = '`'.repeat(3);
  fs.writeFileSync(stale, fence + 'json gate\n' + JSON.stringify({ questions: [{ question: 'the old task' }] }) + '\n' + fence + '\n');
  assert.equal(readGate(stale).questions[0].question, 'the old task');

  assert.equal(run(dir, ['task', 'something else entirely', '--session', A]).code, 0);
  const after = entry(dir, A);
  assert.equal(readGate(handoffPath(dir, after, after.stage)), null);
  assert.equal(after.lapped, 2);
  assert.ok(handoffPath(dir, after, after.stage).endsWith('/survey-3.md'));

  assert.equal(run(dir, ['stage', 'build', '--session', A]).code, 0);
  assert.ok(handoffPath(dir, entry(dir, A), 'build').endsWith('/build-3.md'));
});

test('adopt carries lapped, so a renamed task adopted elsewhere keeps counting past the old laps', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint');
  const source = entry(dir, A);
  source.updated = new Date(Date.now() - 16 * DAY).toISOString();
  source.lapped = 3;
  registry.writeSession(dir, A, source);
  assert.equal(run(dir, ['adopt', A, '--session', B]).code, 0);
  assert.equal(entry(dir, B).lapped, 3);
});
```

- [ ] **Step 3: Run them and watch them fail**

```sh
node --test tests/handoff.test.js tests/task.test.js
```

Expected: in `tests/handoff.test.js` the first, third and fourth new tests fail (`build.md` where `build-2.md` was expected; `readGate` returns lap one's gate where `null` was expected; `build.md` where `build-3.md` was expected). The second passes now: it is an invariant the change has to keep. In `tests/task.test.js` the rename test fails on its first assertion after the rename, `readGate` returning `the old task`'s gate (the unfixed rename lands on `survey.md`), and the adopt test fails on `lapped` being `undefined`.

- [ ] **Step 4: Implement `lib/handoff.js`**

In `lib/handoff.js`, replace the three functions `handoffPath`, `commitPath` and `answerPath` with:

```js
// A rename keeps `started`, so the new task's files sit in the old task's directory.
// `lapped` is the highest lap the old task used, written by `task.js task`; the new
// task's laps are numbered from there. 0 for a task that was never renamed.
const lappedOf = (data) => (data && Number.isInteger(data.lapped) && data.lapped > 0 ? data.lapped : 0);

// How many times a task has entered `stage`, counted from the registry's `moves` — the
// order it entered stages in, stamped by `task.js stage` before anything is dispatched,
// so the visit in progress is already in it.
const visitsOf = (data, stage) => (data && Array.isArray(data.moves) ? data.moves : [])
    .filter((m) => Array.isArray(m) && m[0] === stage).length;

// The lap of a stage: `lapped` plus its visits, and at least the first. `moves` keeps the
// newest 60, so a stage entered more often than that within them repeats a number: a
// known limit, not handled.
function lapOf(data, stage) {
    return lappedOf(data) + Math.max(1, visitsOf(data, stage));
}

// The highest lap number this record has used, for `task.js task` to store as `lapped`
// before it forgets `moves`. At least 1: a record with no moves may still have written
// the first lap of its stage.
function lapsUsed(data) {
    const moves = data && Array.isArray(data.moves) ? data.moves : [];
    const most = Math.max(0, ...moves.filter(Array.isArray).map((m) => visitsOf(data, m[0])));
    return lappedOf(data) + Math.max(1, most);
}

// The first visit keeps the name a stage has always had; the n-th, n >= 2, is
// `<stage>-<n>`, so a return to a stage is a file of its own and never the last lap's.
function fileFor(root, data, stage, suffix) {
    const dir = dirFor(root, data);
    if (!dir || !stage) return null;
    const lap = lapOf(data, stage);
    return dir + '/' + stage + (lap > 1 ? '-' + lap : '') + suffix;
}

function handoffPath(root, data, stage) {
    return fileFor(root, data, stage, '.md');
}

function commitPath(root, data, stage) {
    return fileFor(root, data, stage, '-commit.md');
}

function answerPath(root, data, stage) {
    return fileFor(root, data, stage, '-answer.md');
}
```

In `lib/handoff.js`, replace the export line with:

```js
module.exports = { handoffPath, commitPath, answerPath, readGate, writeAnswer, lapsUsed };
```

- [ ] **Step 5: Implement `scripts/task.js`**

In `scripts/task.js`, change the `require` of the handoff module (line 37) to:

```js
const { handoffPath, readGate, lapsUsed } = require('../lib/handoff.js');
```

In `scripts/task.js`, in `cmdTask`, inside the `registry.update` callback, directly above the comment that begins `// The order of stages, for the same reason`, add:

```js
        // The handoff directory is keyed by `started`, which a rename keeps, so the new
        // task's files land beside the old task's. `lapped` is how many laps the old
        // task used, and `lib/handoff.js` numbers this task's laps from there: its first
        // lap of any stage is a file nothing wrote, so `readGate` finds no old gate.
        // It reads `moves`, so it comes before the `delete d.moves` below.
        d.lapped = lapsUsed(d);
```

In `scripts/task.js`, in `cmdAdopt`, directly after the line `if (source.guard) data.guard = source.guard;`, add:

```js
    // The rename's lap base goes with the task. `moves` crosses over below, and without
    // this a renamed task adopted here would number its laps from the old task's again.
    if (Number.isInteger(source.lapped) && source.lapped > 0) data.lapped = source.lapped;
```

- [ ] **Step 6: Close the TODO entry this task delivers**

In `TODO.md`, under `## Ready`, delete the whole bullet that begins

```
- 〔stage-agents〕圈號要先處理改名的 task：`cmdTask` 刪 `moves` 卻保留 `started`
```

It is one line. The `## Needs a decision` entry that begins `〔registry〕` and asks whether to stamp `moves` on a rename stays: this task did not settle it.

- [ ] **Step 7: Run the tests and watch them pass**

```sh
node --test tests/handoff.test.js tests/task.test.js
```

Expected: every test in both files passes, including the older path tests that use a record without `moves`, and `renaming the task forgets the moves, as it forgets the clock`, which still finds `moves` gone.

- [ ] **Step 8: Commit** (the parent does this)

Paths: `lib/handoff.js`, `scripts/task.js`, `TODO.md`, `tests/handoff.test.js`, `tests/task.test.js`. Message: `feat: handoff 檔名按圈編號，改名的 task 接著舊圈往下數，回頭的那一站不覆蓋也不讀到舊 gate`.

## Task 3: `read first:` and the `reads:` block

**Files:**
- Modify: `lib/handoff.js` — add `readsOf(file)` and `previousHandoff(root, data)`, and export them
- Modify: `lib/render.js` — `renderBrainBrief` prints `read first:` and asks each report to end with `reads:`
- Read: `hooks/brief.js` — lines 38-52: it reads the record with `registry.readSession` and calls `renderBrief({ mine: { sessionId, data }, agentType, root, profile })`, so `root` and `data.moves` reach `renderBrainBrief` with no change to the hook
- Test: `tests/handoff.test.js`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: Task 2's `handoffPath(root, data, stage)` lap semantics, `lapped` included (`previousHandoff` passes it on when it builds a record by hand), Task 2's `lapsUsed` export, which the export line keeps, and Task 2's `moved(...stages)` test helper in `tests/handoff.test.js`; the `block` and `gateOf` helpers there; `seed`, `seedProfile`, `run`, `start`, `contextOf`, `tmp` in `tests/brief.test.js`.
- Produces: `readsOf(file)` → an array of `<path> — <why>` strings (`[]` for a missing file or a report without the block); `previousHandoff(root, data)` → the path of the newest earlier stage's report that exists on disk, or `null`. `renderBrainBrief` output gains a `read first:` rule and a rule telling the brain to end its report with `reads:`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing tests**

In `tests/handoff.test.js`, change the `require` of the handoff module to take the two new names (it keeps Task 2's `lapsUsed`):

```js
const { handoffPath, commitPath, answerPath, readGate, writeAnswer, lapsUsed, readsOf, previousHandoff } = require('../lib/handoff.js');
```

In `tests/handoff.test.js`, append:

```js
const report = (reads) => '# report\n\nbody\n\n' + (reads ? 'reads:\n' + reads.map((r) => '- ' + r).join('\n') + '\n\n' : '') + block(gateOf('q'));

test('readsOf returns the lines under the last reads: line and stops at the blank line', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'r.md');
  fs.writeFileSync(file, 'reads:\n- old — superseded\n\nprose\n\n' + report(['lib/a.js — the caller', 'docs/b.md — the contract']));
  assert.deepEqual(readsOf(file), ['lib/a.js — the caller', 'docs/b.md — the contract']);
  fs.writeFileSync(file, report(null));
  assert.deepEqual(readsOf(file), []);
  assert.deepEqual(readsOf(path.join(path.dirname(file), 'missing.md')), []);
});

test('previousHandoff walks moves back to the newest earlier stage that left a report', () => {
  const root = tmp('fankeel-handoff-');
  const write = (data, stage) => {
    const file = handoffPath(root, data, stage);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'x');
    return file;
  };
  const now = moved('build', 'verify', 'build');
  assert.equal(previousHandoff(root, now), null);
  const buildOne = write(moved('build'), 'build');
  assert.equal(previousHandoff(root, now), buildOne);
  const verifyOne = write(moved('build', 'verify'), 'verify');
  assert.equal(previousHandoff(root, now), verifyOne);
  assert.equal(previousHandoff(root, moved('build')), null);
  // A renamed task's laps start past the old task's: `verify.md` above is not its report.
  const renamed = Object.assign({}, now, { lapped: 2 });
  assert.equal(previousHandoff(root, renamed), null);
  const later = write(Object.assign({}, moved('build', 'verify'), { lapped: 2 }), 'verify');
  assert.equal(previousHandoff(root, renamed), later);
});
```

In `tests/brief.test.js`, append:

```js
test('a brain is told what to read first: the last stage\'s report and the lines it left under reads:', () => {
  const { handoffPath } = require('../lib/handoff.js');
  const started = '2026-09-19T09:30:12.345Z';
  const moves = [['build', 1], ['verify', 2], ['build', 3]];
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started, moves });
  const verifyFile = handoffPath(root, { started, moves: moves.slice(0, 2) }, 'verify');
  fs.mkdirSync(path.dirname(verifyFile), { recursive: true });
  fs.writeFileSync(verifyFile, 'report\n\nreads:\n- lib/a.js — the row that failed\n- docs/b.md — the contract it broke\n\n');
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(text, /read first: \S+\/\.fankeel\/build\/task-20260919T093012\/verify\.md/);
  assert.ok(text.includes('lib/a.js — the row that failed'));
  assert.ok(text.includes('docs/b.md — the contract it broke'));
  assert.ok(text.includes('The next brief copies them for it'), 'the brain is told to write the block');
  assert.ok(text.length < 10000, 'brain brief is ' + text.length + ' chars');
});

test('read first says none when no earlier stage left a report, and says how many lines it left out', () => {
  const { handoffPath } = require('../lib/handoff.js');
  const started = '2026-09-19T09:30:12.345Z';
  const brief = (reads) => {
    const moves = [['verify', 1], ['build', 2]];
    const root = tmp();
    seedProfile(root, { 'stage.agents': ['build'] });
    seed(root, { stage: 'build', started, moves });
    if (reads) {
      const file = handoffPath(root, { started, moves: moves.slice(0, 1) }, 'verify');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'reads:\n' + reads.map((r) => '- ' + r).join('\n') + '\n\n');
    }
    return contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  };
  assert.match(brief(null), /read first: none — the map \(\.fankeel\/map\.md\) and the task line/);
  const many = brief(Array.from({ length: 30 }, (_, i) => 'f' + i + '.js — why'));
  assert.ok(many.includes('f11.js — why') && !many.includes('f12.js — why'), 'twelve lines are shown');
  assert.ok(many.includes('18 more not listed'));
  const long = brief(['x'.repeat(600) + ' — a', 'y'.repeat(600) + ' — b']);
  assert.ok(long.includes('x'.repeat(600)) && !long.includes('y'.repeat(600)), 'the character budget stops the second');
  assert.ok(long.includes('1 more not listed'));
});
```

- [ ] **Step 2: Run them and watch them fail**

```sh
node --test tests/handoff.test.js tests/brief.test.js
```

Expected: `readsOf` and `previousHandoff` are not exported (`TypeError: readsOf is not a function`), and the two brief tests fail because the brief has no `read first:` line.

- [ ] **Step 3: Implement**

In `lib/handoff.js`, directly above `writeAnswer`, add:

```js
// The `reads:` block a report ends with: one `<path> — <why>` per line, from the last
// line that is exactly `reads:` to the next blank line or fence. The last, for the reason
// `readGate` reads the last block: a rewritten report can carry an older one above it.
function readsOf(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
    const marks = [...text.matchAll(/^reads:[ \t]*$/gm)];
    if (!marks.length) return [];
    const out = [];
    for (const raw of text.slice(marks[marks.length - 1].index).split(/\r?\n/).slice(1)) {
        const l = raw.trim();
        if (!l || l.startsWith('`')) break;
        out.push(l.replace(/^[-*]\s+/, ''));
    }
    return out;
}

// The newest report an earlier stage left for the stage being entered: walk `moves` back
// from the entry before the current one and take the first stage whose report is on disk.
// Each entry is judged as of its own lap, so `moves` is cut at that entry. Null when
// nothing exists — a route whose earlier stages ran in the session itself.
function previousHandoff(root, data) {
    const moves = (data && Array.isArray(data.moves) ? data.moves : []).filter((m) => Array.isArray(m) && typeof m[0] === 'string');
    for (let i = moves.length - 2; i >= 0; i--) {
        const file = handoffPath(root, { started: data.started, lapped: data.lapped, moves: moves.slice(0, i + 1) }, moves[i][0]);
        if (file && fs.existsSync(file)) return file;
    }
    return null;
}
```

In `lib/handoff.js`, replace the export line with:

```js
module.exports = { handoffPath, commitPath, answerPath, readGate, writeAnswer, lapsUsed, readsOf, previousHandoff };
```

In `lib/render.js`, change the `require` of the handoff module (line 20) to:

```js
const { handoffPath, commitPath, answerPath, readsOf, previousHandoff } = require('./handoff.js');
```

In `lib/render.js`, directly above `function renderBrainBrief`, add:

```js
// What the brain opens first: the newest earlier report and the lines it left under
// `reads:`, copied here so the controller opens neither. A budget, not a silent cut —
// what is left out is counted.
const READ_LINES = 12;
const READ_CHARS = 1000;
function readFirst(before, reads) {
    if (!before) return ['  - read first: none — the map (.fankeel/map.md) and the task line.'];
    const out = ['  - read first: ' + before + ' — the last stage\'s report' + (reads.length ? ', then:' : '.')];
    let used = 0;
    let shown = 0;
    for (const r of reads) {
        if (shown === READ_LINES || used + r.length > READ_CHARS) break;
        out.push('      ' + r);
        used += r.length;
        shown++;
    }
    if (shown < reads.length) out.push('      … ' + (reads.length - shown) + ' more not listed');
    return out;
}
```

In `lib/render.js`, inside `renderBrainBrief`, directly after the line that pushes `Before anything else, Read`, add:

```js
    const before = previousHandoff(root, data);
    for (const l of readFirst(before, before ? readsOf(before) : [])) lines.push(l);
```

In `lib/render.js`, inside `renderBrainBrief`, directly after the line that pushes `Write your report to`, add:

```js
    lines.push('  - End the report, above the gate block, with a line `reads:`, under it at most 8 lines `<path> — <why>`, then a blank line: what the next stage\'s agent should open first, and why. The next brief copies them for it.');
```

- [ ] **Step 4: Run the tests and watch them pass**

```sh
node --test tests/handoff.test.js tests/brief.test.js
```

Expected: every test in both files passes, including the older brain-brief tests (the 10,000-character cap holds).

- [ ] **Step 5: Commit** (the parent does this)

Paths: `lib/handoff.js`, `lib/render.js`, `tests/handoff.test.js`, `tests/brief.test.js`. Message: `feat: brain 的 brief 帶 read first，清單由上一站的報告寫、hook 抄`.

## Task 4: `artifact:` and a commit relay for design and plan

**Files:**
- Modify: `lib/stages.js` — `controlRules` puts `COMMIT_RULE` on design and plan as well as build, and lets the dispatch prompt carry one line of the user's new instruction after the stage name
- Modify: `lib/render.js` — `renderBrainBrief` gets an `artifact:` rule and a commit rule for design and plan
- Modify: `agents/fankeel-brain.md` — `## Job`, `## Tools`, `## Refusals` and `## Return` name the one file a design or plan brain may write
- Test: `tests/stages.test.js`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: Task 3's `renderBrainBrief` (this task adds to the same function), `commitPath(root, data, stage)` from Task 2, and `COMMIT_RULE` in `lib/stages.js`.
- Produces: `controlFor('design'|'plan'|'build', values, subs).rules` contains the `commit <file>` rule; audit, land, survey and verify do not. Every controlled stage's dispatch rule allows one line of the user's new instruction after the stage name. The design and plan brain briefs carry an `artifact:` line and a `You cannot commit` line naming `<stage>-commit.md`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing tests**

In `tests/stages.test.js`, append:

```js
test('a controlled design and plan relay a commit like build; the other controlled stages do not', () => {
  const { controlFor } = require('../lib/stages.js');
  const values = { 'stage.agents': ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'] };
  const carries = (stage) => controlFor(stage, values, {}).rules.some((r) => r.includes('commit <file>'));
  for (const stage of ['design', 'plan', 'build']) assert.equal(carries(stage), true, stage);
  for (const stage of ['survey', 'verify', 'audit', 'land']) assert.equal(carries(stage), false, stage);
});

test('a controlled stage\'s dispatch prompt is the stage name, plus one line when the user just gave a new instruction', () => {
  const { controlFor } = require('../lib/stages.js');
  const values = { 'stage.agents': ['survey', 'design', 'build', 'land'] };
  for (const stage of ['survey', 'design', 'build', 'land']) {
    const dispatch = controlFor(stage, values, {}).rules.find((r) => r.startsWith('Dispatch one Agent'));
    assert.ok(dispatch.includes('prompt `' + stage + '`, plus one line only when the user has just given a new instruction for it; no model.'), stage + ': ' + dispatch);
  }
});
```

In `tests/brief.test.js`, append:

```js
test('a design and a plan brain may write one file under docs/plans/ and commit it through a commit file; the other stages may not', () => {
  const brief = (stage) => {
    const root = tmp();
    seedProfile(root, { 'stage.agents': [stage] });
    seed(root, { stage, started: '2026-09-19T09:30:12.345Z' });
    return contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  };
  const design = brief('design');
  assert.match(design, /artifact: besides your report you may Write one file, docs\/plans\/<date>-<topic>-design\.md, and only where the design skill calls for a spec/);
  assert.match(design, /\(the architectural class\)\. Put its path on the report's `spec:` line\./);
  assert.match(design, /You cannot commit: `git commit` and `git add` are refused to you\. When that file is written, write [^\n]*design-commit\.md/);
  assert.ok(design.length < 10000, 'design brief is ' + design.length + ' chars');
  const plan = brief('plan');
  assert.match(plan, /artifact: besides your report you may Write one file, docs\/plans\/<date>-<topic>\.md\. Its path is the first line of your report\./);
  assert.doesNotMatch(plan, /Put its path on the report's/);
  assert.match(plan, /write [^\n]*plan-commit\.md/);
  assert.ok(plan.length < 10000, 'plan brief is ' + plan.length + ' chars');
  for (const stage of ['survey', 'build', 'verify']) assert.doesNotMatch(brief(stage), /artifact: besides your report/, stage);
});
```

- [ ] **Step 2: Run them and watch them fail**

```sh
node --test tests/stages.test.js tests/brief.test.js
```

Expected: the three new tests fail (design and plan carry no commit rule; the dispatch rule has no `plus one line` clause; the briefs have no `artifact:` line).

- [ ] **Step 3: Implement**

In `lib/stages.js`, replace the three comment lines above `COMMIT_RULE` and the `...(stage === 'build' ...)` line **in place, keeping the line count** (a citation elsewhere points past them). The comment becomes:

```js
// The one thing a build, design or plan agent asks of its controller: it may not commit, so it
// writes a commit file and returns `commit <file>` where a stage's end returns a
// report path. scripts/commit.js does the commit and prints the range.
```

In `lib/stages.js`, inside `controlRules`, replace `...(stage === 'build' ? [COMMIT_RULE] : []),` with:

```js
    ...(['build', 'design', 'plan'].includes(stage) ? [COMMIT_RULE] : []),
```

In `lib/stages.js`, inside `controlRules`, in the line that begins `'Dispatch one Agent:`, replace the four words `, no model. Its file` with the clause below, so the line count does not change:

```js
, plus one line only when the user has just given a new instruction for it; no model. Its file
```

In `lib/stages.js`, that line then reads:

```js
    'Dispatch one Agent: `subagent_type: fankeel:fankeel-brain`, prompt `' + stage + '`, plus one line only when the user has just given a new instruction for it; no model. Its file pins one and its brief carries the rules.',
```

In `lib/render.js`, inside `renderBrainBrief`, directly after the closing brace of the `if (stage === 'build') { ... }` block, add:

```js
    if (stage === 'design' || stage === 'plan') {
        const commit = commitPath(root, data, stage);
        const file = stage === 'plan' ? 'docs/plans/<date>-<topic>.md' : 'docs/plans/<date>-<topic>-design.md, and only where the design skill calls for a spec (the architectural class)';
        lines.push('  - artifact: besides your report you may Write one file, ' + file + '. ' + (stage === 'plan' ? 'Its path is the first line of your report.' : 'Put its path on the report\'s `spec:` line.') + ' Nothing else outside the report is yours to write.');
        lines.push('  - You cannot commit: `git commit` and `git add` are refused to you. When that file is written, write ' + commit + ' — its path, a blank line, then the commit message — and return `commit ' + commit + '` and nothing else. The controller commits and messages you `<base>..<sha>` or one line `commit.js: <why>`. If <why> is about your file or the path you listed: fix it and ask again, and the same error twice means the stage is blocked. Anything else: the stage is blocked, so say so in the report. Return the report path when the stage is done or blocked.');
    }
```

In `agents/fankeel-brain.md`, in `## Job`, replace

```
Do the stage, write the report to that file with its
`json gate` block, and return the path — on a build stage, a
`commit <path>` first for each task.
```

with

```
Do the stage, write the report to that file with its
`json gate` block, and return the path — on a build, design or plan stage, a
`commit <path>` first for each task or file.
```

In `agents/fankeel-brain.md`, in `## Tools`, replace

```
for the handoff file named in your brief — and, on a build stage, the commit
file it names — and nothing else.
```

with

```
for the handoff file named in your brief — and, on a build stage, the commit
file it names, and on a design or plan stage the one `docs/plans/` file its
brief names and its commit file — and nothing else.
```

In `agents/fankeel-brain.md`, in `## Refusals`, replace

```
- Do not write outside the handoff file its brief names, and on a build
  stage the commit file — not a source file, not a test, not `.fankeel/sessions/*.json`. That
```

with

```
- Do not write outside the handoff file its brief names, and on a build
  stage the commit file, and on a design or plan stage its `docs/plans/` file and commit file — not a source file, not a test, not `.fankeel/sessions/*.json`. That
```

In `agents/fankeel-brain.md`, in `## Return`, replace

```
`commit <path>` for a task to commit.
```

with

```
`commit <path>` for a task to commit; on a design or plan stage, `commit <path>` for its file.
```

- [ ] **Step 4: Run the tests and watch them pass**

```sh
node --test tests/stages.test.js tests/brief.test.js tests/render.test.js
```

Expected: all pass. `tests/render.test.js:683-695` still holds: a controlled survey and verify carry no `commit <file>`; a controlled build's block stays under 2,400 characters (1,693 before this task; the clause adds 74, and design and plan gain the commit rule, which makes a `build` block 201 characters longer than a `survey` one in `render`, so no block passes about 1,800). If it goes red, shorten the clause; never raise the cap.

- [ ] **Step 5: Commit** (the parent does this)

Paths: `lib/stages.js`, `lib/render.js`, `agents/fankeel-brain.md`, `tests/stages.test.js`, `tests/brief.test.js`. Message: `feat: design 與 plan 的 brain 能寫 docs/plans 的一個檔並經主控提交`.

## Task 5: Audit and land send their changes to an implementer

**Files:**
- Modify: `lib/stages.js` — `STAGE_AGENTS` gains `audit` and `land`
- Modify: `lib/render.js` — `renderBrainBrief` tells an audit or land brain how its changes get made
- Test: `tests/stages.test.js`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: `agentsFor(stage)` and `BRAIN_AGENTS` in `lib/stages.js`; `profile.values['dispatch.floor']` in `renderBrainBrief`.
- Produces: `agentsFor('audit')` = readers, reviewers, `fankeel:fankeel-fixer` and an implementer; `agentsFor('land')` = readers, reviewers and an implementer. The audit and land briefs carry a `You cannot edit a page or run a git write` rule.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing tests**

In `tests/stages.test.js`, append:

```js
test('audit may dispatch a fixer and an implementer, land only an implementer', () => {
  const { agentsFor } = require('../lib/stages.js');
  assert.ok(agentsFor('audit').includes('fankeel:fankeel-fixer'));
  assert.ok(agentsFor('audit').some((a) => a.startsWith('an implementer')));
  assert.equal(agentsFor('land').includes('fankeel:fankeel-fixer'), false);
  assert.ok(agentsFor('land').some((a) => a.startsWith('an implementer')));
});
```

In `tests/brief.test.js`, append:

```js
test('an audit brain sends page corrections to the fixer, a land brain sends moves and git to an implementer', () => {
  const brief = (stage, values) => {
    const root = tmp();
    seedProfile(root, Object.assign({ 'stage.agents': [stage] }, values));
    seed(root, { stage, started: '2026-09-19T09:30:12.345Z' });
    return contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  };
  assert.match(brief('audit'), /You cannot edit a page or run a git write\. Send one change at a time to `fankeel:fankeel-fixer` \(a page correction\) or an implementer on model `sonnet` \(a move, a merge, a cleanup\), and read what it returns before you send the next\./);
  const land = brief('land', { 'dispatch.floor': 'opus' });
  assert.match(land, /You cannot edit a page or run a git write\. Send one change at a time to an implementer on model `opus` \(a move, a merge, a cleanup\)/);
  assert.doesNotMatch(land, /fankeel-fixer` \(a page correction\)/);
  assert.ok(land.length < 10000, 'land brief is ' + land.length + ' chars');
  for (const stage of ['survey', 'build']) assert.doesNotMatch(brief(stage), /You cannot edit a page or run a git write/, stage);
});
```

In `tests/brief.test.js`, in the test named `the brain's own ## Tools names every plugin agent its stage table lets it dispatch`, widen the stage list so the agent file is held to the two new tables:

```js
  for (const stage of ['survey', 'build', 'verify', 'audit', 'land']) {
```

- [ ] **Step 2: Run them and watch them fail**

```sh
node --test tests/stages.test.js tests/brief.test.js
```

Expected: `agentsFor('audit')` has no fixer (it falls back to `BRAIN_AGENTS`), and the audit and land briefs have no such rule.

- [ ] **Step 3: Implement**

In `lib/stages.js`, inside the `STAGE_AGENTS` object, after the `verify:` entry, add:

```js
    audit: BRAIN_AGENTS.concat(['fankeel:fankeel-fixer', 'an implementer (`general-purpose`, on the `dispatch.floor` model, sent to move a file or run a git write)']),
    land: BRAIN_AGENTS.concat(['an implementer (`general-purpose`, on the `dispatch.floor` model, sent to move a file, merge or clean up)']),
```

In `lib/render.js`, inside `renderBrainBrief`, directly after the line that pushes `You cannot edit or restore a file` (the verify rule), add:

```js
    if (stage === 'audit' || stage === 'land') {
        const fixer = stage === 'audit' ? '`fankeel:fankeel-fixer` (a page correction) or ' : '';
        lines.push('  - You cannot edit a page or run a git write. Send one change at a time to ' + fixer + 'an implementer on model `' + profile.values['dispatch.floor'] + '` (a move, a merge, a cleanup), and read what it returns before you send the next.');
    }
```

- [ ] **Step 4: Run the tests and watch them pass**

```sh
node --test tests/stages.test.js tests/brief.test.js
```

Expected: all pass, including the widened `## Tools` test (the agent file already names the fixer and permits an implementer).

- [ ] **Step 5: Commit** (the parent does this)

Paths: `lib/stages.js`, `lib/render.js`, `tests/stages.test.js`, `tests/brief.test.js`. Message: `feat: audit 與 land 的 brain 把改動交給 fixer 或 implementer`.

## Task 7: The brain on Sonnet, Opus for design and plan

**Files:**
- Modify: `agents/fankeel-brain.md` — the frontmatter's `model: opus` becomes `model: sonnet`, and `last_verified` moves to 2026-09-22
- Modify: `lib/stages.js` — the `Dispatch one Agent:` line of `controlRules` names `model: opus` for design and plan, and no model for the other five
- Modify: `docs/decisions/2026-09-22-brain-on-sonnet.md` — a new file, the decision record; `plantasks` parses `Modify:` and not `Create:`, and a `Create:` block declares nothing and serialises the task, so a new file is listed here
- Modify: `docs/README.md` — the decision record's index row
- Read: `docs/decisions/2026-09-20-survey-brain.md` — line 22 is the row whose choice of model this supersedes, and only that choice
- Read: `tests/render.test.js` — lines 683-695 pin a controlled build block under 2,400 characters
- Test: `tests/stages.test.js`
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: Task 4's dispatch line in `controlRules` — `…plus one line only when the user has just given a new instruction for it; no model. Its file pins one and its brief carries the rules.` — and its test in `tests/stages.test.js` named `a controlled stage's dispatch prompt is the stage name, plus one line when the user just gave a new instruction`; both are in the tree when this task starts (run order: Task 4 first). `controlFor(stage, values, subs).rules` in `lib/stages.js`.
- Produces: `controlFor('design'|'plan', values, subs).rules` holds a dispatch rule that contains `` `model: opus` `` and not `no model`; the other five stages' rule contains `no model` and not `opus`. `agents/fankeel-brain.md` says `model: sonnet`. No new export and no new signature.

**Dispatch:** implementer, sonnet — the plan carries the code and the record's text; transcription plus tests.

- [ ] **Step 1: Write the failing tests**

In `tests/stages.test.js`, in Task 4's test named `a controlled stage's dispatch prompt is the stage name, plus one line when the user just gave a new instruction`, change the loop line so it covers only the stages that keep `no model` (design's tail is pinned by the new test below):

```js
  for (const stage of ['survey', 'build', 'land']) {
```

In `tests/stages.test.js`, append:

```js
test('the controller passes model opus for design and plan and no model for the other five stages', () => {
  const { controlFor } = require('../lib/stages.js');
  const all = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
  const values = { 'stage.agents': all };
  for (const stage of all) {
    const dispatch = controlFor(stage, values, {}).rules.find((r) => r.startsWith('Dispatch one Agent'));
    const opus = stage === 'design' || stage === 'plan';
    assert.ok(dispatch.includes('plus one line only when the user has just given a new instruction for it; '), stage + ': ' + dispatch);
    assert.equal(dispatch.includes('`model: opus`'), opus, stage + ': ' + dispatch);
    assert.equal(dispatch.includes('no model'), !opus, stage + ': ' + dispatch);
    assert.equal(dispatch.includes('opus'), opus, stage + ': ' + dispatch);
  }
});
```

In `tests/agents.test.js`, replace the title line of the test `the stage agent writes its handoff and dispatches readers, on opus` with:

```js
test('the stage agent writes its handoff and dispatches readers, on sonnet', () => {
```

In `tests/agents.test.js`, in that test, replace `assert.equal(f.model, 'opus');` with:

```js
    // Design and plan run on opus: the controller's dispatch passes `model: opus`, which replaces this pin.
    assert.equal(f.model, 'sonnet');
```

- [ ] **Step 2: Run them and watch them fail**

```sh
node --test tests/stages.test.js tests/agents.test.js
```

Expected: the new stages test fails at `design` (the dispatch rule still says `no model`), and the agents test fails on `'opus' !== 'sonnet'`. Task 4's narrowed test passes: it now covers only the stages that stay on `no model`.

- [ ] **Step 3: Implement**

In `agents/fankeel-brain.md`, in the frontmatter, replace

```
model: opus
effort: medium
status: current
last_verified: 2026-09-21
```

with

```
model: sonnet
effort: medium
status: current
last_verified: 2026-09-22
```

In `lib/stages.js`, inside `controlRules`, replace the line that begins `'Dispatch one Agent:` with the line below. It is one line before and after, so no cited line in the file moves:

```js
    'Dispatch one Agent: `subagent_type: fankeel:fankeel-brain`, prompt `' + stage + '`, plus one line only when the user has just given a new instruction for it; ' + (['design', 'plan'].includes(stage) ? '`model: opus`, which replaces the one its file pins. Its brief carries the rules.' : 'no model. Its file pins one and its brief carries the rules.'),
```

- [ ] **Step 4: Run the tests and watch them pass**

```sh
node --test tests/stages.test.js tests/agents.test.js tests/brief.test.js tests/render.test.js
```

Expected: all pass. `tests/render.test.js:683-695` still holds: a controlled `build` block keeps its `no model` branch byte for byte as Task 4 wrote it, and design and plan gain 21 characters over what Task 4 left them (their blocks were 1,302 and 1,293 characters from `render` before Task 4), nowhere near 2,400. If it goes red, shorten the clause; never raise the cap.

- [ ] **Step 5: A control for the five that stay on no model**

In `lib/stages.js`, change `['design', 'plan'].includes(stage)` to `true` in the line above, run `node --test tests/stages.test.js`, and expect the new test to fail at `survey` (`opus` found in its dispatch rule); then put the condition back and run the file again, expecting it green. This is the only step that shows the test can tell the five from the two.

- [ ] **Step 6: The decision record and its index row**

Write `docs/decisions/2026-09-22-brain-on-sonnet.md`, a new file, with:

```md
---
status: decision
last_verified: 2026-09-22
---

# 站 agent 改用 Sonnet，design 與 plan 留給 Opus — 決策紀錄

使用者 2026-09-22 開了跑：每一站都交給 Sonnet 的站 agent，Opus 只留給判官與關鍵處。
設計見 [../plans/2026-09-21-all-stages-brain-design.md](../plans/2026-09-21-all-stages-brain-design.md) 的 §6，
計畫見 [../plans/2026-09-21-all-stages-brain-held.md](../plans/2026-09-21-all-stages-brain-held.md)。
這份只取代 [2026-09-20-survey-brain.md](2026-09-20-survey-brain.md) 第一節第二列（「主控與站 agent 怎麼分工」）裡
站 agent 用 Opus 的那個**模型**選擇；分工本身——判斷留在讀了整站的那一邊，主控只照檔案執行——不動。

## 一、定案

| 問題 | 定案 | 為什麼 |
|---|---|---|
| 站 agent 用哪個模型 | `agents/fankeel-brain.md` 釘 `model: sonnet` | 使用者的要求：Opus 只用在關鍵處。七站全拆之後，每一站都開一個 Opus 站 agent，就是把最貴的模型放在多數站最不需要它的地方 |
| 哪兩站例外 | design 與 plan：主控派工時傳 `model: opus`；其餘五站不傳 model | 這兩站的產出就是判斷（要做什麼、拆成哪些 task），後面每一站都吃它們的輸出 |
| 例外放在哪 | 主控的派工規則（`lib/stages.js` 的 `controlRules`），不放在 agent 檔 | agent 檔只能釘一個模型；派工時傳的 `model` 蓋過它，一站一條規則，`tests/stages.test.js` 釘住 |

## 二、沒量過的

- **Sonnet 站 agent 沒有量過。**2026-09-20 的 A/B 與之後所有量測用的都是 Opus 站 agent；換了模型，`docs/subagents.md` 裡的成本與品質數字都不能直接套用。
- 量測在發版之後：使用者把 `stage.agents` 設成 `all` 跑一個真實 task，用 `node scripts/ctx.js <session> --by-stage` 與該 session 的 `modelUsage` 讀；門檻沿用設計的主控至多 60 turns、最後一關低於 200k。這一份不預設結果。
- 要回頭：把 `agents/fankeel-brain.md` 的 `model` 改回 `opus`，並拿掉 `controlRules` 那一行的 `model: opus` 分支；`tests/agents.test.js` 與 `tests/stages.test.js` 各有一個測試釘住現在的樣子，會跟著紅。
```

In `docs/README.md`, directly below the row whose link target is `decisions/2026-09-22-ctx-by-stage.md`, add this row:

```
| What that settled — the stage agent runs on Sonnet, design and plan on Opus through the controller's dispatch line, the choice supersedes only the model in the 2026-09-20 decision and not its division of labour, and no Sonnet stage agent has been measured yet | [decisions/2026-09-22-brain-on-sonnet.md](decisions/2026-09-22-brain-on-sonnet.md) — *繁體中文* |
```

- [ ] **Step 7: Commit** (the parent does this)

Paths: `agents/fankeel-brain.md`, `lib/stages.js`, `docs/decisions/2026-09-22-brain-on-sonnet.md`, `docs/README.md`, `tests/stages.test.js`, `tests/agents.test.js`. Message: `feat: 站 agent 改用 Sonnet，主控派 design 與 plan 時傳 model opus`.

## Task 8: Let a stage agent write its handoff

**Files:**
- Modify: `.claude/settings.local.json` — a new file, per machine and never committed: the allow rule (listed under `Modify:` for the reason Task 7's decision record is)
- Modify: `.gitignore` — one line, `.claude/settings.local.json`, if `git check-ignore` says the file is not ignored
- Modify: `docs/decisions/2026-09-22-brain-on-sonnet.md` — a third section, the probe's two outcomes

**Interfaces:**
- Consumes: the user's approval, asked at Step 3 as a gate; Task 7's decision record, which this task appends to (run order: Task 7 first).
- Produces: `.claude/settings.local.json` holding `{"permissions": {"allow": ["Edit(/.fankeel/build/**)"]}}`, and the probe's before and after in the third section of `docs/decisions/2026-09-22-brain-on-sonnet.md`. No code and no signature.

**Dispatch:** in-session — a permission change the user approves at this task; no agent may write settings. The main thread's Edit and Write here follow the `Ruling 2026-09-22` at the top of Task 6.

- [ ] **Step 1: See whether the file is ignored**

```sh
git check-ignore -v .claude/settings.local.json
```

Expected: on 2026-09-22 this printed nothing and exited 1, because `.gitignore` names `.claude/worktrees/` and nothing else under `.claude/`; Step 5 then adds the line. If it exits 0 now, the file is already ignored and Step 5 is skipped. Read the exit code from this run, unpiped.

- [ ] **Step 2: The before probe**

Dispatch one Agent: `subagent_type: general-purpose`, `model: sonnet`, and this prompt with the current time for `<HHMMSS>`:

```
Use the Write tool to create .fankeel/build/probe-<HHMMSS>.md containing the single line `probe`. Return the Write tool's result text exactly, or the refusal exactly if it was refused. Do nothing else.
```

Run it in the session's real permission mode, the auto mode in which the classifier answered "no verdict" on 2026-09-22: a probe in another mode measures nothing. Write down the mode, the time, and what the agent returned, word for word. If the file was written, stop and tell the user: the rule is unproven on this machine now, and nothing below runs until they answer.

- [ ] **Step 3: Ask the user**

Put one `AskUserQuestion`: add the allow rule that Step 4 shows to `permissions.allow` in this project's `.claude/settings.local.json`, on this machine, uncommitted. Option one adds it. Nothing below runs on any other answer, and no dispatched agent writes the file: the parent session does, after the answer.

- [ ] **Step 4: Write the file**

If `.claude/settings.local.json` already exists, add the one entry to its `permissions.allow` and change nothing else in it. Otherwise, in `.claude/settings.local.json`, write:

```json
{"permissions": {"allow": ["Edit(/.fankeel/build/**)"]}}
```

- [ ] **Step 5: Keep it out of git**

In `.gitignore`, add as a new last line, only if Step 1 exited 1:

```
.claude/settings.local.json
```

Then run `git check-ignore .claude/settings.local.json` again and expect it to print the path and exit 0.

- [ ] **Step 6: The after probe**

Run Step 2's probe again in the same session and the same mode, with a new time: the only thing that changed is the settings file. Record the outcome the same way. If it is refused or gives no verdict again, the setting may be read only at process start: say so to the user, who relaunches, and run the probe once more after that. Do not record a success the run did not show.

- [ ] **Step 7: Delete the two probe files**

```sh
rm .fankeel/build/probe-<first HHMMSS>.md .fankeel/build/probe-<second HHMMSS>.md
```

Name exactly the files the two probes were told to write; a probe that was refused wrote none, so `rm` only what exists, and run `ls .fankeel/build` to confirm no `probe-` file is left.

- [ ] **Step 8: Record both outcomes**

In `docs/decisions/2026-09-22-brain-on-sonnet.md`, append a section headed `## 三、探測`. It opens with one sentence saying the two probes ran in one session and one permission mode (name the mode) and that the settings file was the only difference, then a table whose header row is `| test | before the rule | after the rule |`, whose separator row follows it, and whose one body row names the probe and gives each outcome as the tool returned it, word for word. Then say in one sentence whether the after probe wrote its file.

- [ ] **Step 9: Commit** (the parent does this)

Paths: `.gitignore` if Step 5 changed it, and `docs/decisions/2026-09-22-brain-on-sonnet.md`. Not `.claude/settings.local.json`: `git status --short` must not list it. Message: `docs: .gitignore 加 .claude/settings.local.json，決策紀錄記放行前後的探測`.

## Task 6: Say it in the documents

**Ruling 2026-09-22.** This task and Task 8 are `in-session`: the main thread runs Edit and Write. `hooks/guard.js` (the block that reads `controlling(mine.stage, values)`) denies exactly that while the task's stage is listed in `stage.agents`, and this repository's `.fankeel/profile.json` lists `build` and `verify`. This build runs on the installed 0.74.0 hooks, whose `hooks/guard.js` has no stage-agent check (verified 2026-09-22: no `controlling` and no `stage.agents` in it), so the main thread's edits are allowed here. A session on a version that does have the guard runs `node scripts/task.js profile set stage.agents false` first and restores the list afterwards, and never routes a write through Bash to get past the guard.

**Files:**
- Modify: `docs/subagents.md` — four rows of the stage-agent table (controller's block, the stage agent, the handoff, a commit), the stage agent's model in its row, the `Write` sentence, the sentence under the table, two new subsections (what a brain reads and writes; its model, the allow rule and the release order), the stale-gate bullet removed
- Modify: `skills/fankeel/SKILL.md` — the parenthesis in the one-exception paragraph that says which stage relays a commit
- Modify: `skills/fankeel-survey/SKILL.md` — its `scripts/task.js:1147` citation (quote `classForRoute(given)`), which Task 2's inserts in `cmdTask` and `cmdAdopt` move down by about nine lines; `docs-check` prints the fix
- Modify: `docs/plans/2026-09-21-all-stages-brain-design.md` — the `另有 N 行` phrase in two places, the paragraph that says the other tasks wait for the measurement, and its `lib/render.js:397` and `:409` citations, which Tasks 3 to 5 move (Step 4 rewrites them; `docs-check` will not)
- Modify: `TODO.md` — one bullet loses a seam that Task 2 closed, and the `## Needs a decision` entry that begins `〔stage-agents〕auto mode 分類器` goes: this task is the one that settles it
- Modify: `docs/README.md` — the spec's and this plan's index rows say the tasks were promoted rather than held, and Task 7's decision row is checked

**Interfaces:**
- Consumes: as landed, each named as its task's `Produces` names it — `measure(file).stages` (Task 1), `handoffPath(root, data, stage)` and `lapsUsed(data)` (Task 2), `readsOf(file)` and `previousHandoff(root, data)` (Task 3), `controlFor('design'|'plan'|'build', values, subs).rules` (Task 4), `agentsFor('audit')` (Task 5), the decision record `docs/decisions/2026-09-22-brain-on-sonnet.md` and the dispatch line's `model: opus` clause (Task 7), and `.claude/settings.local.json` with the probe's two outcomes in the decision record's third section (Task 8). The documents describe them, so this task runs after Tasks 2 to 5, 7 and 8 are committed and before Task 9 releases them.
- Produces: nothing another task calls.

**Dispatch:** in-session — prose across six pages, and a citation checker that prints its own fixes; splitting it across contexts costs more than the reading saves.

- [ ] **Step 1: `docs/subagents.md`**

Read the file first; the replacements below are exact.

In `docs/subagents.md`, in the table row that begins `| controller's block |`, replace

```
(on `build`, first relay each `commit <file>`)
```

with

```
(on `build`, `design` and `plan`, first relay each `commit <file>`)
```

In `docs/subagents.md`, in the table row that begins `| the stage agent |`, replace

```
opus at `effort: medium`;
```

with

```
sonnet at `effort: medium` (the controller's dispatch passes `model: opus` for `design` and `plan`);
```

In `docs/subagents.md`, in the same row, replace

```
`Write` for its handoff (and, on build, its commit file), `Agent` for its readers and reviewers, and on build a fixer and implementers, on verify a verifier, a fixer and an implementer —
```

with

```
`Write` for its handoff (and, on build, design and plan, its commit file; on design and plan also one `docs/plans/` file), `Agent` for its readers and reviewers, and on build a fixer and implementers, on verify a verifier, a fixer and an implementer, on audit a fixer and an implementer, on land an implementer —
```

In `docs/subagents.md`, in the table row that begins `| a commit (`build` only) |`, replace `| a commit (`build` only) |` with `| a commit (`build`, `design`, `plan`) |`, and replace `.fankeel/build/task-<started>/build-commit.md` with `.fankeel/build/task-<started>/<stage>-commit.md`.

In `docs/subagents.md`, in the paragraph under that table that begins `The agents a stage agent dispatches`, replace

```
and on `build` also a fixer and implementers, on `verify` a verifier, a fixer and an implementer —
```

with

```
and on `build` also a fixer and implementers, on `verify` a verifier, a fixer and an implementer, on `audit` a fixer and an implementer, on `land` an implementer —
```

In `docs/subagents.md`, in the table row that begins `| the handoff |`, replace

```
the answer beside it as `<stage>-answer.md` — `survey.md` and `survey-answer.md` when `survey` is the stage on the list |
```

with

```
the answer beside it as `<stage>-answer.md` — `survey.md` and `survey-answer.md` when `survey` is the stage on the list; a stage's n-th visit (n ≥ 2, counted from the record's `moves`) is `<stage>-<n>.md`, `<stage>-<n>-answer.md` and `<stage>-<n>-commit.md`, so a return to `build` never overwrites its first lap; a renamed task keeps the directory and numbers on from the laps the old task used (`lapped` on the record, written by `task.js task`), so it never reads the old task's gate |
```

In `docs/subagents.md`, in the paragraph that begins `` `fankeel-verifier` is no longer the only agent carrying `Write` ``, replace

```
and on `build` its commit file:
```

with

```
and on `build` its commit file, and on `design` and `plan` the one `docs/plans/` file its brief names and that file's commit file:
```

In `docs/subagents.md`, delete the bullet

```
- **A stale gate.** `readGate` has no freshness check, so a handoff file left by an
  earlier lap of the same task is shown as the gate if the controller asks before a
  fresh report exists.
```

In `docs/subagents.md`, directly above the paragraph that begins `The agents a stage agent dispatches`, insert:

```
### What a stage agent is told to read, and what it may write

`renderBrainBrief` prints a `read first:` rule: the newest earlier stage's report
(`previousHandoff` in `lib/handoff.js` walks the record's `moves` back to the first
stage whose report is on disk) and the lines that report left under its `reads:`
block, at most 12 lines and 1,000 characters, with what was left out counted. The
report's own author wrote that block — it is the agent that had read the content —
and `hooks/brief.js` copies it, so the controller opens neither file. A stage with no
earlier report gets `read first: none`. Every brain is told to end its report with
that block.

A `design` or `plan` brain may also write one file under `docs/plans/`, named in an
`artifact:` rule, and commits it through a commit file as `build` does; an `audit`
or `land` brain has no Edit and no git write, so `STAGE_AGENTS` gives them
`fankeel-fixer` (audit only) and an implementer. Whether `land` works this way has
not been run.
```

In `docs/subagents.md`, directly above the heading that begins `## What a controlled`, insert:

```
### Which model a stage agent runs on, what lets it write, and what comes before the switch

`agents/fankeel-brain.md` pins `model: sonnet`. The controller's dispatch rule
(`controlRules` in `lib/stages.js`) passes `model: opus` for `design` and `plan`, the
two stages whose product is a judgement, and no model for the other five, so Opus is
spent where the user asked for it and nowhere else. Every measurement in this
repository before 2026-09-22 ran an Opus stage agent; a Sonnet one has not been
measured. [decisions/2026-09-22-brain-on-sonnet.md](decisions/2026-09-22-brain-on-sonnet.md)
records the choice.

On 2026-09-22 the auto mode classifier answered "no verdict" to a stage agent's and an
implementer's Write and Edit into `.fankeel/build/`, six times or more in one session,
so a handoff file could not be written. The remedy is a permission and not code:
`.claude/settings.local.json`, per machine and ignored by git, holds
`{"permissions": {"allow": ["Edit(/.fankeel/build/**)"]}}`, and the user puts it
there. No stage agent and no implementer writes any settings file. The probe that
tested the rule — a dispatched Sonnet subagent writing a file under `.fankeel/build/`,
once before the rule and once after — and its two outcomes are in the decision record's
third section. The fallback the TODO entry asked about, a report returned in the message
when the write fails, is not built.

The installed 0.74.0 has no `STAGE_AGENTS`, and `profile show` reads the list as `false`
there, so the order is a release first and the switch after: the user releases (see
`Releasing` in [development.md](development.md)), and only once the installed copy
carries `STAGE_AGENTS` sets the profile with
`node scripts/task.js profile set stage.agents all`, which writes the project's profile.
The builtin stays `false`.
What the switch costs is read afterwards from the run it enables, with
`node scripts/ctx.js <session> --by-stage` and that run's `modelUsage`, against the
thresholds in [the spec](plans/2026-09-21-all-stages-brain-design.md): a controller of
at most 60 turns and a last gate below 200k. That run has not happened.
```

- [ ] **Step 2: `skills/fankeel/SKILL.md`**

Run `grep -n 'One exception, behind a profile key' skills/fankeel/SKILL.md` and read the paragraph: its first sentence already covers every stage `stage.agents` names, so that sentence needs no edit. What is stale is the parenthesis on the commit relay. In that paragraph replace

```
(on `build`, a commit request
```

with

```
(on `build`, `design` and `plan`, a commit request
```

(one line in the repository's copy, `skills/fankeel/SKILL.md:1103`; match the phrase, not the line break after it). Leave the rest of the paragraph as it is.

- [ ] **Step 3: the spec**

The spec's other two sentences (the `--by-stage` bullet under `## 1.` and the wake-up count under `## 現況`) were amended at the plan gate, in the commit that carried the plan; do not replay them. In `docs/plans/2026-09-21-all-stages-brain-design.md`, replace both occurrences of the phrase `另有 N 行未列` and `另有 18 行` — the first in `## 3.`'s last bullet, the second in `## 完成的判準` — with `N more not listed` and `18 more not listed`.

In the same spec, the paragraph that opens `## 檔案與派工` says the rest waits for the measurement, which the user's run of 2026-09-22 overtook. In `docs/plans/2026-09-21-all-stages-brain-design.md`, replace

```
分期（plan 關卡，2026-09-22，使用者決定）：先只做第一列，其餘等 §1 的量測。計畫在
[2026-09-21-all-stages-brain.md](../archive/2026-09-21-all-stages-brain.md)，沒做的五個 task 在
[2026-09-21-all-stages-brain-held.md](2026-09-21-all-stages-brain-held.md)。
```

with

```
分期（plan 關卡，2026-09-22，使用者決定）：先只做第一列。同日使用者開了跑（§6），其餘不再等 §1 的量測：Task 2 到 6，加上新增的 Task 7 到 9（brain 改 Sonnet、放行 handoff 寫入、發版）。第一列的計畫在
[2026-09-21-all-stages-brain.md](../archive/2026-09-21-all-stages-brain.md)，其餘在
[2026-09-21-all-stages-brain-held.md](2026-09-21-all-stages-brain-held.md)。
```

- [ ] **Step 4: The spec's two `lib/render.js` citations**

Tasks 3 to 5 add lines to `lib/render.js` above the two places the spec cites, and `docs-check` will not say so (Step 6 gives the reason). Find where they are now:

```sh
grep -n 'function renderBrainBrief' lib/render.js
```

```sh
grep -n 'Before anything else, Read' lib/render.js
```

The first prints the line the spec's `lib/render.js:397` now sits at; the second prints the line of the spec's `lib/render.js:409` (each pattern appears once in the file). In `docs/plans/2026-09-21-all-stages-brain-design.md`, in the `## 現況` bullet that begins `` - `renderBrainBrief` ``, replace `lib/render.js:397` with `lib/render.js:` and the first line number, and `lib/render.js:409` with `lib/render.js:` and the second. Both are on that one bullet; touch nothing else on it, and no other citation in the spec.

- [ ] **Step 5: `TODO.md`**

In `TODO.md`, in the bullet that begins `- 〔stage-agents〕受控 build／verify 還有十來個接縫沒實跑過`, replace

```
、profile 中途翻轉、gate 檔沒有新鮮度 —
```

with

```
、profile 中途翻轉 —
```

In `TODO.md`, under `## Needs a decision`, delete the whole bullet that begins

```
- 〔stage-agents〕auto mode 分類器
```

It is one line, the last entry of that section. This task is where it is settled: the allow rule of Task 8, written up in `docs/subagents.md` above, is the answer, and the fallback it asked about is recorded there as not built.

- [ ] **Step 6: Run the checks and fix what they print**

```sh
node scripts/docs-check.js
```

```sh
node scripts/todo-check.js
```

```sh
node scripts/docs-audit.js
```

Expected: `docs-check` exits 0. Tasks 3 to 5 add lines to `lib/render.js` above line 397 and to `lib/stages.js` at line 642, and Task 2 adds lines to `scripts/task.js` above line 1147, so the citations that point past those lines move: `docs/subagents.md`'s, and `skills/fankeel-survey/SKILL.md`'s `scripts/task.js:1147`, which `docs-check` names as `moved` with the line it is at now (Task 7 adds none: it edits one line in place). The spec's own `lib/render.js` citations are not on that list: it is role `plan`, and `docs-check` checks a quoted line only on a `reference` page, which is why Step 4 moved them by hand. `docs-check` prints the fix for each citation it does report, apply it to the page it names and to nothing else on that page. `todo-check` exits 0. `docs-audit` lists nothing unindexed: Task 7 added the decision record's row, and the rows below already exist.

In `docs/README.md`, the two rows that say the rest was held are stale. In the row for the spec, replace

```
built first and the rest held until a real controlled run has been measured
```

with

```
built first and, from 2026-09-22, the rest built without waiting for the measurement: the brain on Sonnet with design and plan on Opus, the permission for handoff writes, and the release before the switch
```

In the row for this plan, replace

```
The five tasks of that design held back until a real controlled run is measured: lap-numbered handoff files, `read first:`, `artifact:` and the design and plan commit relay, the implementer route for audit and land, and the documents that say so
```

with

```
Tasks 2 to 9 of that design, promoted 2026-09-22: lap-numbered handoff files that a rename cannot confuse, `read first:`, `artifact:` and the design and plan commit relay, the implementer route for audit and land, the brain on Sonnet, the permission for handoff writes, the documents that say so, and the release
```

- [ ] **Step 7: Run the whole suite, unpiped, and read the exit code**

```sh
npm test
```

Expected: exit 0. Report the `ℹ pass` and `ℹ fail` lines from the run, not from memory.

- [ ] **Step 8: Commit** (the parent does this)

Paths: `docs/subagents.md`, `skills/fankeel/SKILL.md`, `skills/fankeel-survey/SKILL.md`, `docs/plans/2026-09-21-all-stages-brain-design.md`, `TODO.md`, `docs/README.md`. The plan file is not edited here. Message: `docs: 全部 stage 交給 brain 的文件，brain 改 Sonnet、放行寫入與發版順序，spec 的分期與三處修正`.

## Task 9: Release, and the user's own switch

**Files:**
- Modify: `package.json` — `version`, written by `scripts/version.js`
- Modify: `.claude-plugin/plugin.json` — `version`, likewise
- Modify: `skills/fankeel/SKILL.md` — the `version:` frontmatter line; the ten other skills (`skills/fankeel-ask/SKILL.md`, `-audit`, `-build`, `-design`, `-explain`, `-land`, `-plan`, `-station`, `-survey`, `-verify`) carry the same line, and `scripts/version.js` writes all thirteen files in one run
- Read: `docs/development.md` — its `Releasing` section, eight steps, which the steps below follow

**Interfaces:**
- Consumes: Tasks 2 to 8 committed, `docs/subagents.md` as Task 6 leaves it, and the suite green, and the number the user names.
- Produces: the new version on `main` and, once the user reinstalls, in the installed copy. Nothing another task calls.

**Dispatch:** in-session — outward-facing and user-run.

The steps are the ones `docs/development.md` records for 0.70.0, which the 0.75.0 commit (`63ef833`, thirteen files) followed. The next number is 0.76.0 unless the user names another: it carries `feat:` commits, and the number is theirs.

**0.75.0 was committed and never released** (checked 2026-09-22): `package.json` reads 0.75.0 from `63ef833`, but `git merge-base --is-ancestor 63ef833 origin/main` exits 1 (it was never pushed, and neither was 0.74.0's `df21334`) and the plugin cache on this machine stops at 0.74.0. No tag helps: `git tag` stops at `v0.45.0`. The number still cannot be reused for this release: `version.js 0.75.0` writes no file when the thirteen already say 0.75.0, so Step 3's thirteen and Step 4's commit would not exist, and `version.js --changes` already counts back to the `chore: 0.75.0` subject. So this release is a second commit above it, 0.76.0, and the push in Step 7 ships both; the installed copy goes from 0.74.0 straight to 0.76.0.

- [ ] **Step 1: Everything is green first**

Run each of these on its own, unpiped, and read its exit code; every one exits 0 on the tree about to be released:

```sh
npm test
```

```sh
node scripts/docs-check.js
```

```sh
node scripts/todo-check.js
```

```sh
node scripts/docs-audit.js
```

```sh
node scripts/skills-check.js
```

```sh
node scripts/memory-check.js
```

```sh
node scripts/residue.js
```

- [ ] **Step 2: List what the release contains**

```sh
node scripts/version.js --changes
```

It prints the commits since the last `chore: <x.y.z>`. Put that list in front of the user with the proposal of 0.76.0.

- [ ] **Step 3: The number, on the user's say-so**

```sh
node scripts/version.js 0.76.0
```

Run it only after the user has agreed to the number, with the number they agreed to. It says how many files it changed; expect thirteen.

- [ ] **Step 4: Commit it as the release**

Paths: the thirteen files above. Message: `chore: 0.76.0 — 全部 stage 可交給站 agent，brain 改 Sonnet，改名 task 的圈號不撞舊檔`. That subject is the marker `--changes` counts back to; a release committed under any other subject makes the next one list these commits again.

- [ ] **Step 5: The suite again**

```sh
npm test
```

Expected: exit 0. `tests/contract.test.js` compares the thirteen, so the bump is proven only by a run made after it.

- [ ] **Step 6: Integrate**

`land.push` is `false` in this project's profile, so a local merge to `main` is where the release stops unless the user says otherwise. If the tasks were done on a branch, merge it into `main` locally; if they were done on `main`, there is nothing to merge.

- [ ] **Step 7: Push only when asked, and ask separately**

The plugin is installed from the GitHub marketplace `FanFantom9452/FanKeel`, so nothing off this machine sees the release until `main` is pushed. Ask for that alone, as its own question; the profile's standing answer is not consent for the one step that publishes. Push `main` only: the local backup branch that carries the old address is never pushed.

- [ ] **Step 8: A new terminal, and the installed copy**

The terminal that pushed still holds the old copy: Claude Code reads `plugins/installed_plugins.json`'s `installPath` and its hook list once per process, and `/clear` does not read either again. The user opens a new terminal and updates the plugin so the cache holds 0.76.0; a task in flight comes across with `/fankeel`, then Adopt.

- [ ] **Step 9: The user's own act — the switch**

No session runs this step. It is the user's, and it comes last: the installed 0.74.0 has no `STAGE_AGENTS`, and `profile show` there reads the list as `false`, so a `stage.agents` set before the installed copy is new changes nothing. In the installed copy named by `installPath` for `fankeel@fankeel` in `plugins/installed_plugins.json`, check that it carries this release:

```sh
grep -c lapsUsed "<installPath>/lib/handoff.js"
```

It prints a number of 1 or more (a copy without Task 2 prints 0). `lapsUsed` is the word because only this release has it: `STAGE_AGENTS` came in at `1cbc396`, after 0.75.0 and before Task 2, so an install cut part-way through the release would pass a `STAGE_AGENTS` grep without Tasks 2 to 8. Only then, from the repository:

```sh
node scripts/task.js profile set stage.agents all
```

`--project` is not passed: it is a string flag that wants a directory, and `profile set` writes the project's `.fankeel/profile.json` by default (`--default` is the machine file). Then `node scripts/task.js profile show` lists `stage.agents` as `survey,design,plan,build,verify,audit,land`, the seven stages `all` expands to and the way `display` in `lib/profile.js` prints an array, not the word `all`. The next real task runs with every stage under a stage agent, and its cost is read afterwards with `node scripts/ctx.js <session> --by-stage` and that session's `modelUsage`, against the spec's 60 turns and 200k; that reading is the user's run, and `verify` records it as unverified until it exists.
