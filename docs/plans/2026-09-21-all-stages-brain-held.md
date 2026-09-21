---
status: design-intent
last_verified: 2026-09-22
---

# All-stages brain: held tasks 2 to 6

**Held, not built.** These five tasks are the rest of [the plan](../archive/2026-09-21-all-stages-brain.md). They were cut off at its gate (2026-09-22), where the user chose to build only that plan's Task 1, `ctx.js --by-stage`, and measure before anything else. A `fankeel-reviewer` read them against the spec once and its four gaps were fixed; nothing here has run. Read them again against the measurement report before building any of them: a report that shows the controller's commit round trip too dear moves `COMMIT_RULE` (Task 4), and one that shows a build brain past 400k moves the ledger relay the spec leaves out.

**Task numbers stay as they were** (2 to 6), so a `Task 2` written inside a task below is the task of this file, and Task 1 is the one already built.

**To promote it:** in the spec, take the `scripts/ctx.js` row out of the `file` table (Task 1 built it) and rename the `held file` table's header to `file`, then run `node scripts/ledger.js --plan <this file> lint`. Until then that lint reads red on exactly `scripts/ctx.js` and `tests/ctx.test.js` (written 2026-09-22: those two findings and no others), which is expected and not a defect of these tasks.
**Spec:** [2026-09-21-all-stages-brain-design.md](2026-09-21-all-stages-brain-design.md) — it stays in `docs/plans/` until these tasks land, and so does this file.

## Global Constraints

Generated from `node scripts/map.js` (235 markdown files, 4 planned, not built, 114 retired, 8 undeclared), `CONTRIBUTING.md`, `package.json` and the suite.

- There is no `CLAUDE.md` and no `AGENTS.md`; conventions are in `CONTRIBUTING.md`.
- `lib/*.js` are pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction.
- Every hook exits `0` on every path, including its own errors. This plan adds no hook.
- Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it.
- Zero dependencies: `package.json` lists none. Tests run with `npm test` = `node --test`.
- Indentation is per file: 4 spaces in `lib/`, `scripts/`, `hooks/` and `tests/ctx.test.js`; 2 spaces in `tests/handoff.test.js`, `tests/brief.test.js` and `tests/stages.test.js`.
- A brain brief stays under 10,000 characters (`tests/brief.test.js:249`, `:385`); an ordinary subagent brief under 1,400 (`:145`, `:292`, `:309`).
- A controlled block stays under 2,400 characters at a real plugin root (`tests/render.test.js:690`, `sizeAtReference(out) < 2400`). Measured 2026-09-22 with all seven stages on the list: a controlled `build` block is 1,505 characters from `render` and 1,693 from `renderResume`, the larger; `design` and `plan` 1,302 and 1,293 from `render`.
- `tests/brief.test.js:371-378` pins three phrases in `agents/fankeel-brain.md`: `/on a build\s+stage, the commit\s+file it names/` in `## Tools`, `/on a build\s+stage the commit file/` in `## Refusals`, and `` /`commit <path>` for a task to commit/ `` in `## Return`. A rewording keeps all three.
- `docs-check` cites `path:line`. Do not add a line to `lib/stages.js` above line 643 or to `lib/render.js` above line 397 in a way that moves a cited line without running `node scripts/docs-check.js` afterwards; it prints the fixes.
- `moves` keeps the newest 60 entries (`MAX_MOVES`, `lib/registry.js:51`).
- A commit subject is `feat:`, `fix:`, `test:` or `docs:` and one line of Chinese; the body ends with the attribution lines the session was given. The parent commits, one task at a time; an implementer returns the paths it changed.

## File Structure

| file | responsibility after this plan |
|---|---|
| `scripts/ctx.js` | what one session's main thread did, turn by turn, now also cut by stage |
| `lib/handoff.js` | where a stage agent's report, answer and commit file live, per lap; what a report says to read next; which earlier report is the newest |
| `lib/render.js` | `renderBrainBrief`: read first, artifact, implementer route |
| `lib/stages.js` | which stages relay a commit; which agents audit and land may dispatch |
| `agents/fankeel-brain.md` | what the brain may write |
| `docs/subagents.md`, `skills/fankeel/SKILL.md`, the spec, `TODO.md` | say all of the above |

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
| 改任務名的 `cmdTask`（`scripts/task.js`）刪掉 `moves` 卻保留 | Task 2 — NOT yet planned: see the note at the top of Task 2 |
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

## Task 2: Handoff files per lap

**Before this task, decide the rename case.** The spec's last bullet in section 2 records that `cmdTask` in `scripts/task.js` deletes `moves` but keeps `started`, and `started` is the handoff directory's key (`dirFor` in `lib/handoff.js`), so a renamed task would restart at lap 1 in a directory that still holds the earlier laps, and `moves` is empty right after `cmdTask` (it sets `stage` without `stampEntry`). No step below handles that: either give it a step in `scripts/task.js` (stamp `moves` when `cmdTask` sets `stage`, and decide whether a rename starts a new directory) or record a ruling that a renamed task's first lap may reuse the earlier directory.

**Files:**
- Modify: `lib/handoff.js` — `handoffPath`, `commitPath` and `answerPath` number a stage's second and later visits
- Read: `hooks/gate.js` — line 47 calls `handoffPath(root, mine, mine.stage)` with the record, which carries `moves`
- Read: `hooks/resume.js` — line 75 calls `answerPath(root, mine, mine.stage)` the same way
- Test: `tests/handoff.test.js`

**Interfaces:**
- Consumes: the registry record's `moves` — `[[stage, at], …]`, one entry per change of stage, stamped by `task.js stage` through `stampEntry` before anything is dispatched (`lib/registry.js:510`).
- Produces: `handoffPath(root, data, stage)`, `commitPath(root, data, stage)` and `answerPath(root, data, stage)` keep their signatures. The first visit to a stage returns `<stage>.md`, `<stage>-commit.md`, `<stage>-answer.md`; the n-th visit, n ≥ 2, returns `<stage>-<n>.md`, `<stage>-<n>-commit.md`, `<stage>-<n>-answer.md`. A record with no `moves` is on the first visit of every stage. No new export.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing tests**

In `tests/handoff.test.js`, change the `require` of the handoff module to also take `commitPath`:

```js
const { handoffPath, commitPath, answerPath, readGate, writeAnswer } = require('../lib/handoff.js');
```

In `tests/handoff.test.js`, after the `gateOf` helper, add the `moved` helper:

```js
const moved = (...stages) => Object.assign({}, DATA, { moves: stages.map((s, i) => [s, 1000 + i]) });
```

In `tests/handoff.test.js`, after the last test, append three:

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
```

- [ ] **Step 2: Run them and watch them fail**

```sh
node --test tests/handoff.test.js
```

Expected: the first and third new tests fail (`build.md` where `build-2.md` was expected; `readGate` returns lap one's gate where `null` was expected). The second passes now: it is an invariant the change has to keep.

- [ ] **Step 3: Implement**

In `lib/handoff.js`, replace the three functions `handoffPath`, `commitPath` and `answerPath` with:

```js
// The n-th time a task has entered `stage`, counted from the registry's `moves` — the
// order it entered stages in, stamped by `task.js stage` before anything is dispatched,
// so the visit in progress is already in it. 1 for a record with no moves. `moves` keeps
// the newest 60, so a stage entered more often than that within them repeats a number: a
// known limit, not handled.
function lapOf(data, stage) {
    const moves = data && Array.isArray(data.moves) ? data.moves : [];
    return Math.max(1, moves.filter((m) => Array.isArray(m) && m[0] === stage).length);
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

- [ ] **Step 4: Run the tests and watch them pass**

```sh
node --test tests/handoff.test.js
```

Expected: every test in the file passes, including the older path tests that use a record without `moves`.

- [ ] **Step 5: Commit** (the parent does this)

Paths: `lib/handoff.js`, `tests/handoff.test.js`. Message: `feat: handoff 檔名按圈編號，回頭的那一站不覆蓋上一圈也不讀到舊 gate`.

## Task 3: `read first:` and the `reads:` block

**Files:**
- Modify: `lib/handoff.js` — add `readsOf(file)` and `previousHandoff(root, data)`, and export them
- Modify: `lib/render.js` — `renderBrainBrief` prints `read first:` and asks each report to end with `reads:`
- Read: `hooks/brief.js` — lines 38-52: it reads the record with `registry.readSession` and calls `renderBrief({ mine: { sessionId, data }, agentType, root, profile })`, so `root` and `data.moves` reach `renderBrainBrief` with no change to the hook
- Test: `tests/handoff.test.js`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: Task 2's `handoffPath(root, data, stage)` lap semantics, and Task 2's `moved(...stages)` test helper in `tests/handoff.test.js`; the `block` and `gateOf` helpers there; `seed`, `seedProfile`, `run`, `start`, `contextOf`, `tmp` in `tests/brief.test.js`.
- Produces: `readsOf(file)` → an array of `<path> — <why>` strings (`[]` for a missing file or a report without the block); `previousHandoff(root, data)` → the path of the newest earlier stage's report that exists on disk, or `null`. `renderBrainBrief` output gains a `read first:` rule and a rule telling the brain to end its report with `reads:`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing tests**

In `tests/handoff.test.js`, change the `require` of the handoff module to take the two new names:

```js
const { handoffPath, commitPath, answerPath, readGate, writeAnswer, readsOf, previousHandoff } = require('../lib/handoff.js');
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
        const file = handoffPath(root, { started: data.started, moves: moves.slice(0, i + 1) }, moves[i][0]);
        if (file && fs.existsSync(file)) return file;
    }
    return null;
}
```

In `lib/handoff.js`, replace the export line with:

```js
module.exports = { handoffPath, commitPath, answerPath, readGate, writeAnswer, readsOf, previousHandoff };
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
- Modify: `agents/fankeel-brain.md` — `## Tools`, `## Refusals` and `## Return` name the one file a design or plan brain may write
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
  assert.match(design, /You cannot commit: `git commit` and `git add` are refused to you\. When that file is written, write [^\n]*design-commit\.md/);
  assert.ok(design.length < 10000, 'design brief is ' + design.length + ' chars');
  const plan = brief('plan');
  assert.match(plan, /artifact: besides your report you may Write one file, docs\/plans\/<date>-<topic>\.md\. Put its path/);
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
        lines.push('  - artifact: besides your report you may Write one file, ' + file + '. Put its path on the report\'s `spec:` line. Nothing else outside the report is yours to write.');
        lines.push('  - You cannot commit: `git commit` and `git add` are refused to you. When that file is written, write ' + commit + ' — its path, a blank line, then the commit message — and return `commit ' + commit + '` and nothing else. The controller commits and messages you `<base>..<sha>` or one line `commit.js: <why>`. If <why> is about your file or the path you listed: fix it and ask again, and the same error twice means the stage is blocked. Anything else: the stage is blocked, so say so in the report. Return the report path when the stage is done or blocked.');
    }
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

## Task 6: Say it in the documents

**Files:**
- Modify: `docs/subagents.md` — four rows of the stage-agent table (controller's block, the stage agent, the handoff, a commit), the `Write` sentence, the sentence under the table, one new subsection, the stale-gate bullet removed
- Modify: `skills/fankeel/SKILL.md` — the parenthesis in the one-exception paragraph that says which stage relays a commit
- Modify: `docs/plans/2026-09-21-all-stages-brain-design.md` — the `另有 N 行` phrase in two places, and its `lib/render.js:397` citation if Task 3 moved that line
- Modify: `TODO.md` — one bullet loses a seam that Task 2 closed
- Modify: `docs/README.md` — an index row for the spec and one for this plan, when `docs-audit` lists them unindexed

**Interfaces:**
- Consumes: as landed, each named as its task's `Produces` names it — `measure(file).stages` (Task 1), `handoffPath(root, data, stage)` (Task 2), `readsOf(file)` and `previousHandoff(root, data)` (Task 3), `controlFor('design'|'plan'|'build', values, subs).rules` (Task 4), `agentsFor('audit')` (Task 5). The documents describe them, so this task runs after all five are committed.
- Produces: nothing another task calls.

**Dispatch:** in-session — prose across four pages, and a citation checker that prints its own fixes; splitting it across contexts costs more than the reading saves.

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
the answer beside it as `<stage>-answer.md` — `survey.md` and `survey-answer.md` when `survey` is the stage on the list; a stage's n-th visit (n ≥ 2, counted from the record's `moves`) is `<stage>-<n>.md`, `<stage>-<n>-answer.md` and `<stage>-<n>-commit.md`, so a return to `build` never overwrites its first lap |
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

- [ ] **Step 4: `TODO.md`**

In `TODO.md`, in the bullet that begins `- 〔stage-agents〕受控 build／verify 還有十來個接縫沒實跑過`, replace

```
、profile 中途翻轉、gate 檔沒有新鮮度 —
```

with

```
、profile 中途翻轉 —
```

- [ ] **Step 5: Run the checks and fix what they print**

```sh
node scripts/docs-check.js
```

```sh
node scripts/todo-check.js
```

```sh
node scripts/docs-audit.js
```

Expected: `docs-check` exits 0. Tasks 3 to 5 add lines to `lib/render.js` above line 397 and to `lib/stages.js` at line 642, so the spec's `lib/render.js:397` and `docs/subagents.md`'s citations move if they point past those lines; `docs-check` prints the fix for each citation, apply them to the page it names and to nothing else on that page. `todo-check` exits 0. `docs-audit` may list the new plan and spec as unindexed: add a row for each to `docs/README.md` under the heading that already lists `docs/plans/` files, in that table's own column shape.

- [ ] **Step 6: Run the whole suite, unpiped, and read the exit code**

```sh
npm test
```

Expected: exit 0. Report the `ℹ pass` and `ℹ fail` lines from the run, not from memory.

- [ ] **Step 7: Commit** (the parent does this)

Paths: `docs/subagents.md`, `skills/fankeel/SKILL.md`, `docs/plans/2026-09-21-all-stages-brain-design.md`, `TODO.md`, and `docs/README.md` if Step 5 touched it. The plan file was committed at the plan gate and is not edited here. Message: `docs: 全部 stage 交給 brain 的 plan 與文件，spec 的三處修正`.
