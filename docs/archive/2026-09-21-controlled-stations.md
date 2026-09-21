---
status: archived
last_verified: 2026-09-21
---

# 受控站推到 build／verify Implementation Plan

**Goal:** build 與 verify 兩站可以交給站 agent 在乾淨 context 裡跑、量得出主控 context 有沒有因此變小、station 首頁的 profile 卡能一鍵套用開發習慣。
**Architecture:** brain 的 brief 依站讀一張「可派 agent」的表（`lib/stages.js`），不再寫死 reader 與 reviewer；量測是一支薄殼腳本，讀 transcript 全用 `lib/usage.js` 現成的函式；profile 的說明、預設與清除都放在 `lib/profile.js` 一處，`POST /profile` 與首頁卡都從它讀。先發版，是為了讓正在跑的 hook 與這些程式一致。
**Tech Stack:** Node（內建 `node --test`、`node:util` 的 `parseArgs`）、零依賴、瀏覽器端是不經打包的單一 `assets/station/station.js`。
**Spec:** [design](2026-09-21-controlled-stations-design.md)

## Global Constraints

Generated from `node scripts/map.js` (232 markdown files, 4 planned, not built), `CONTRIBUTING.md`, `package.json` and the tests. This repository has no `CLAUDE.md`.

- **No dependencies.** `package.json` has no `dependencies` and no `devDependencies`; `CONTRIBUTING.md` — "no new dependency, no new file under `hooks/`, no new generated name."
- **Tests run with `node --test`** (`package.json` `scripts.test`). A dispatched implementer runs only its own test file; the parent runs the whole suite before committing a group.
- **Injection caps stay put.** `tests/render.test.js:527` `size < 2400` per stage, `:552` `size < 1400` for init, `:479` `worst < 3000`. `design` and `land` sit at 2396 of 2400: **no task may change the text of a stage rule or of `ALWAYS`.** Task 2 changes only the brain's brief, which is not one of those blocks.
- **A new file under `scripts/` or `lib/` is exported and used** — knip flags an export nothing imports; `scripts/spend.js` (`module.exports` at its end, used by `tests/spend.test.js`) is the pattern.
- **A test never touches the real profile.** `.fankeel/profile.json` in this checkout holds the experiment's `stage.agents` and is uncommitted; tests write under `tmp('fankeel-…-')` from `tests/tmp.js` only.
- **`TODO.md`:** one bullet per deferred thing under `## Ready`, `## Needs a decision` or `## Waiting`; a line is at most 200 characters (`scripts/todo-check.js`); a Waiting timing is a `### <timing>` heading, then `lifts when: <event>. MM-DD.`, then the bullets.
- **`.fankeel/map.md` is regenerated, never edited** (`.fankeel/.gitignore` lists it). A wrong row in it is fixed in the page it was read from.
- **Match the file you edit:** four-space indentation and single-quoted strings in `lib/`, `scripts/` and `assets/`; `'use strict';` first line in every `.js` file.
- **Commit subjects** are `type: one line` (`docs:`, `fix:`, `chore:`, `merge:`) as in `git log`; a dispatched implementer does not commit.

**Execution note.** `ledger.js groups` puts Tasks 1-4 in one group (surface `workflow`) and Tasks 5-6 in a second (`agents`). Task 1 is in-session, so three of the four go out; it runs first because its commit must not carry the others' files. When the build stage runs under a stage agent (`fankeel-brain`), that agent has no `Workflow` tool: it sends Tasks 2, 3 and 4 as three `Agent` calls in one response, inside the four-a-response ceiling. Tasks 5 and 6 go out together once Task 4 has landed (both read `lib/profile.js`); Task 6 does not wait for Task 5, because its tests set `profilePresets` by hand.

## Coverage

| promise | task |
|---|---|
| 發布的是**已經在 `main` 上的東西**（自上一個 `chore:` 之後 159 個 commit），不是這個任務的成果； | Task 1 |
| 照 `docs/development.md` 的八步：先跑全部檢查為 0，`version.js --changes` 列出內容， | Task 1 |
| push 另外問。現況：裝機版標的 `a6a3da7` 是本地 merge、不在 origin 上，所以先前有一條本地安裝路， | Task 1 |
| 完成的判準：`diff -rq <裝機版>/lib lib` 為空，而且新開的 terminal 裡 `controlling('build', …)` 為真。 | Task 1 |
| `lib/stages.js` 加一張 `STAGE_AGENTS`：survey → reader、reviewer；build → reader、reviewer、fixer， | Task 2 |
| `renderBrainBrief` 讀這張表，不再寫死兩個名字；`controlRules` 不動（§5 之後 build 的 `controlRules` 多一條提交規則）。 | Task 2 (and Task 7 for the commit rule) |
| build 的組在 brain 裡用 Agent 分回合派（一回合最多四個），**不開 Workflow**。 | Task 2 (the brief line, and the brain's own Tools section, which has to permit it) |
| `scripts/ctx.js <transcript\|session-id>` 印主 session 每回合的 context（input＋cache read＋cache | Task 3 (a session id is turned into its transcript by the finder in lib/detail.js; the turns print on one line) |
| `scripts/ctx.js --compare <a> <b>` 並排兩個 session。 | Task 3 |
| 實跑 A/B 是 bypassPermissions 的腳本，**build 站不自己跑**，跑之前停下來問。 | Task 3 (the script only; nothing in this plan runs an A/B) |
| `lib/profile.js` 的 `KEYS[key]` 加 `desc`（一句話）；`profile show` 與站上都印它，`lib/station.js` | Task 4 (`desc`, `showLines`), Task 6 (the page); the serializer already passes `KEYS` whole, so it needs no change |
| `POST /profile` 改用 `profile.parseValue` 驗；預設「手動」要把鍵清回 (ask)，所以新增 `profile.unset`，不做逐列的清除按鈕。 | Task 4 (`unset`), Task 5 (the route) |
| 三個習慣預設（手動／平衡／省 context），一次 POST 全套用，先驗全部再寫（現有行為）。 | Task 4 (`PRESETS`), Task 5 (`profilePresets`), Task 6 (the cards) |
| 預設寫進**這張卡自己的那一層**：專案卡寫 `.fankeel/profile.json`，machine 卡寫機器層。專案層蓋過機器層（`lib/profile.js` 的 `read`） | Task 6 (each preset form carries its own card's `scope`); Task 5 already writes to the layer the form names |
| `stage.agents` 維持 `<select>`，現值不在三個固定值時當額外選項（現有行為）；送出改由 `parseValue` 驗，所以不再 400。七站 toggle 不做。 | Task 5 |
| `profile show` 的表格欄寬跟著最長的值，不再把 `survey,build,verify` 與來源層黏在一起。 | Task 4 |
| 畫面只取 mockup 上方的「快速設定」三張卡與「套用」；mockup 在 .fankeel/build/2026-09-21-controlled-stations/mockup.html | Task 6 (three cards, each a form with its own apply button) |
| `POST /profile` 送 `stage.agents=survey,build,verify` 得 200；現在是 400（`tests/station-cli.test.js`）。 | Task 5 (this route answers 303 on success, as its neighbours' tests assert) |
| 每個 `KEYS` 都有非空 `desc`；現在沒有（`tests/profile.test.js`）。 | Task 4 |
| **產出物那一列**：把站頁 render 出來，DOM 裡有說明的列數等於 `Object.keys(KEYS).length`， | Task 6 (the card's HTML string, since `node --test` has no DOM); the verify stage renders the served page with Playwright |
| `scripts/ctx.js` 對一份手算過的 fixture，峰值等於手算值。 | Task 3 |
| 受控的 build 由 controller 提交：brain 寫一個 commit 檔（每行一個路徑、一個空行、訊息）並回傳 `commit <檔>`， | Task 7 |
| `scripts/commit.js` 只提交檔內列的路徑（`git commit -o`），其餘已暫存或未提交的留在原處； | Task 7 |
| controller 每個 task 因此多一次 Bash 與一次 SendMessage，會吃掉一部分 context 回收； | Task 7 (nothing to build; the cost is what `scripts/ctx.js` measures in the A/B) |
| verify 的 brain 也不能編輯或還原檔案，所以 `STAGE_AGENTS` 的 verify 多一個 implementer， | Task 7 |

## Task 1: Release what is already on main

Design §1. The number is the user's to choose and pushing is a separate ask, so this task is not dispatched. What it releases is the 159 commits already on `main`; none of this plan's own changes are in it.

**Files:**
- Modify: `package.json` — `version`, written by `node scripts/version.js`
- Modify: `.claude-plugin/plugin.json` — `version`, written by the script
- Modify: `skills/fankeel/SKILL.md` — the `version:` line, written by the script
- Modify: `skills/fankeel-ask/SKILL.md` — the `version:` line
- Modify: `skills/fankeel-audit/SKILL.md` — the `version:` line
- Modify: `skills/fankeel-build/SKILL.md` — the `version:` line
- Modify: `skills/fankeel-design/SKILL.md` — the `version:` line
- Modify: `skills/fankeel-explain/SKILL.md` — the `version:` line
- Modify: `skills/fankeel-land/SKILL.md` — the `version:` line
- Modify: `skills/fankeel-plan/SKILL.md` — the `version:` line
- Modify: `skills/fankeel-station/SKILL.md` — the `version:` line
- Modify: `skills/fankeel-survey/SKILL.md` — the `version:` line
- Modify: `skills/fankeel-verify/SKILL.md` — the `version:` line
- Read: `scripts/version.js` — run, not edited; it writes the number into the two manifests and the eleven skill files above, thirteen in all

**Interfaces:**
- Consumes: none
- Produces: one commit `chore: <x.y.z> — <one line>` on `main`; the number `<x.y.z>` in thirteen files, which `tests/contract.test.js` compares

**Dispatch:** in-session — the version number is a claim about what shipped and is the user's to make, and pushing is a separate ask; a dispatched implementer could do neither.

- [ ] **Step 1: The checks are green on the tree about to be released**

```sh
npm test
node scripts/docs-check.js
node scripts/todo-check.js
node scripts/docs-audit.js
node scripts/skills-check.js
node scripts/memory-check.js
node scripts/residue.js
```

Every one exits 0, unpiped. A red check is reported to the user and the task stops there.

- [ ] **Step 2: List the release and ask for the number**

```sh
node scripts/version.js --changes
```

Put the list in front of the user with one `AskUserQuestion`: which `<x.y.z>`. Recommend the next minor after `0.74.0`, `0.75.0`, and say why: the list holds new behaviour, not only fixes.

- [ ] **Step 3: Write the number, commit, test again**

```sh
node scripts/version.js <x.y.z>
git add -A
git commit -m "chore: <x.y.z> — <one line naming what the list holds>"
npm test
```

`git status --porcelain` before the commit must show only the thirteen version files, plus the `.fankeel/profile.json` the experiment already changed — leave that one out of the commit (`git add` the thirteen by name if it is in the way).

- [ ] **Step 4: Do not push. Say what is unresolved.**

Tell the user: the installed copy is pinned in `installed_plugins.json` to `gitCommitSha a6a3da7`, a local merge that is not on `origin`, so the copy was not installed by `claude plugin update` from GitHub, and this plan did not find what installed it. Ask whether to push (`docs/development.md` step 7 asks separately) and how they install locally. Until an installed copy carries the new code — `diff -rq "$HOME/.claude/plugins/cache/fankeel/fankeel/<x.y.z>/lib" lib` prints nothing — and a terminal has been restarted (a hook list is read once per process), `stage.agents` naming `build` or `verify` has no effect on the running hooks. If the user declines, this task ends at Step 3 and the rest of the plan still builds; the measurement in Task 3 then has nothing controlled to measure, and the report says so.

- [ ] **Step 5: Prove the installed copy is the new code, once the user has installed it**

```sh
diff -rq "$HOME/.claude/plugins/cache/fankeel/fankeel/<x.y.z>/lib" lib
node -e "const p = require('path').join(require('os').homedir(), '.claude/plugins/cache/fankeel/fankeel/<x.y.z>/lib/stages.js'); console.log(require(p).controlling('build', { 'stage.agents': ['build'] }))"
```

The first prints nothing and the second prints `true`; together they are the design's done-criterion for this section. If the user has not installed anything yet, neither is run and the report says the criterion is open. A fresh `node` process proves the code; whether the hooks of a running terminal use it is what a restarted terminal shows, and this task does not claim it.

## Task 2: The brain's brief names each stage's agents

Design §2. Today `lib/render.js:412` tells every stage agent it may dispatch a reader or a reviewer and nothing else; a build agent has no way to be told about its fixer or its implementers, and a verify agent none about its verifiers.

**Files:**
- Modify: `lib/stages.js` — `STAGE_AGENTS`, `agentsFor`, and its export
- Modify: `lib/render.js` — the brief's dispatch line reads `agentsFor(stage)`
- Modify: `README.md` — the `gate.js` row of the tree (line 207) is half of what the hook does
- Modify: `agents/fankeel-brain.md` — its description and its `## Tools`, which today permit a reader and a reviewer and nothing else
- Modify: `docs/subagents.md` — the stage-agent row of the table (line 477) says the same as that section
- Modify: `docs/plans/2026-09-19-stage-agents-design.md` — one sentence the design of this plan replaces
- Modify: `TODO.md` — the build-workflow-script entry moves from `## Ready` to `## Waiting`
- Test: `tests/brief.test.js`
- Read: `tests/render.test.js` — the caps at lines 479, 527 and 552 must stay green

**Interfaces:**
- Consumes: none
- Produces: `agentsFor(stage) → string[]`, exported from `lib/stages.js`; the strings are plugin agent types written `fankeel:fankeel-<name>`, plus one prose entry for the implementer

**Dispatch:** implementer, sonnet — the plan carries the code; a table, one changed line, and text edits to five files.

The design's promise for this task, kept verbatim so the reader can find it: build 的組在 brain 裡用 Agent 分回合派（一回合最多四個），**不開 Workflow**。 The Workflow script the 2026-09-19 design wanted is not built; the reason is in the design's section 2.

- [ ] **Step 1: Write the failing test**

At the end of `tests/brief.test.js` (two-space indentation, as that file has it), using its own helpers `tmp`, `seed`, `seedProfile`, `run`, `start` and `contextOf`, add two tests. The first is the brief; the second is the brain's own contract, checked against the same table, so a brief cannot permit what `## Tools` forbids:

```js
test('a build brain may dispatch a fixer and an implementer, a verify brain a verifier, a survey brain neither', () => {
  const dispatchLine = (stage) => {
    const root = tmp();
    seedProfile(root, { 'stage.agents': [stage] });
    seed(root, { stage, started: '2026-09-19T09:30:12.345Z' });
    const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
    return text.match(/You cannot run Workflow\. Dispatch[^\n]*/)[0];
  };
  const build = dispatchLine('build');
  assert.match(build, /fankeel:fankeel-fixer/);
  assert.match(build, /implementer/);
  assert.match(dispatchLine('verify'), /fankeel:fankeel-verifier/);
  const survey = dispatchLine('survey');
  assert.match(survey, /fankeel:fankeel-reader/);
  assert.doesNotMatch(survey, /fankeel-fixer|fankeel-verifier|implementer/);
});

test('the brain\'s own ## Tools names every plugin agent its stage table lets it dispatch', () => {
  const { agentsFor } = require('../lib/stages.js');
  const agentFile = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
  const tools = agentFile.split(/^## /m).find((s) => s.startsWith('Tools'));
  for (const stage of ['survey', 'build', 'verify']) {
    for (const agent of agentsFor(stage).filter((a) => a.startsWith('fankeel:'))) {
      assert.ok(tools.includes(agent), '## Tools must name ' + agent + ', which the ' + stage + ' brief lists');
    }
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```sh
node --test tests/brief.test.js
```

Expected: both new tests fail. The first fails on `fankeel:fankeel-fixer`: the build line names only a reader and a reviewer. The second fails on `## Tools must name fankeel:fankeel-fixer`.

- [ ] **Step 3: The table**

In `lib/stages.js`, directly after the function `controlFor` (the one ending `return { rules: substitute(substitute(controlRules(name), subs), subs, CONTROL_TOKENS), template: CONTROL_TEMPLATE };` and a closing brace), add:

```js
// The agents a stage agent may dispatch. It has no Workflow tool, so a stage that
// fans out does it with the Agent tool, at most four in one response. An
// implementer is not a plugin agent: it is `general-purpose`, on the model the
// task's own Dispatch line names.
const BRAIN_AGENTS = ['fankeel:fankeel-reader', 'fankeel:fankeel-reviewer'];
const STAGE_AGENTS = {
    build: BRAIN_AGENTS.concat(['fankeel:fankeel-fixer', 'an implementer (`general-purpose`, on the model named in the task Dispatch line)']),
    verify: BRAIN_AGENTS.concat(['fankeel:fankeel-verifier', 'fankeel:fankeel-fixer']),
};
function agentsFor(stage) {
    return STAGE_AGENTS[String(stage || '').trim().toLowerCase()] || BRAIN_AGENTS;
}
```

- [ ] **Step 4: Export it**

In `lib/stages.js`, replace the last line, the `module.exports`, with:

```js
module.exports = { ALWAYS, ALWAYS_WHEN, holds, INIT, INIT_TEMPLATE, initRules, STAGES, NAMES, TOKENS, SCRIPT_TOKENS, RENDER_TOKENS, SURVEY_TOKEN, FULL_ROUTE, CLASSES, byName, nextStage, normaliseRoute, positionIn, routeForClass, classForRoute, rulesFor, templateFor, controlFor, controlling, agentsFor };
```

- [ ] **Step 5: The brief reads it**

In `lib/render.js`, replace line 18, the line that imports from `stages`, with:

```js
const { rulesFor, templateFor, initRules, INIT_TEMPLATE, normaliseRoute, positionIn, nextStage, FULL_ROUTE, CLASSES, controlFor, controlling, agentsFor } = require('./stages.js');
```

Also in `lib/render.js`, in `renderBrainBrief`, replace line 412, the `lines.push` line that begins `  - You cannot run Workflow`, with:

```js
    lines.push('  - You cannot run Workflow. Dispatch ' + agentsFor(stage).map((a) => (a.startsWith('fankeel:') ? '`' + a + '`' : a)).join(', ') + ' with the Agent tool, at most four in one response, and open every path:line one cites before you keep it: this replaces "one workflow" below.');
```

- [ ] **Step 6: Run it and watch it pass, then the neighbours**

```sh
node --test tests/brief.test.js tests/render.test.js tests/stages.test.js tests/agents.test.js
```

All pass. `tests/render.test.js` is the cap check: a failure there means a stage rule's text was touched, which this task must not do.

- [ ] **Step 7: The agent file, and the pages that describe what it does**

In `agents/fankeel-brain.md`, in the `description:` line, replace "dispatches fankeel-reader and fankeel-reviewer for the reading and the reviewing" with "dispatches fankeel-reader and fankeel-reviewer for the reading and the reviewing, and on a build or verify stage its fixer, verifier and implementers".

In `agents/fankeel-brain.md`, in `## Tools`, replace the opening sentence — from "`Agent` is for" to "not this section's." — with:

```md
`Agent` is for `fankeel:fankeel-reader` or `fankeel:fankeel-reviewer`, at most
four in one response — and, on the stages whose brief lists them,
`fankeel:fankeel-fixer`, `fankeel:fankeel-verifier` and an implementer
(`general-purpose`, on the model the task's Dispatch line names): the raw
reading happens in their contexts, and what reaches yours is what they return.
Which of them, and when, is the stage's own rules' business, not this
section's. The agents you dispatch may edit and run tests; you do not.
```

The rest of that section (from "Open every `path:line`") stays. `tests/agents.test.js` pins `Agent` in `tools:`, `Write` and no `Edit`, and `` `sed -n` `` in `## Tools`; none of that moves.

In `docs/subagents.md`, in the stage-agent row (line 477), replace "`Agent` for its readers and its reviewers — which of the two, and when, its stage's own rules decide" with "`Agent` for its readers and reviewers, and on build and verify its fixer, verifier and implementers — which of them, and when, its stage's own rules decide".

In `README.md`, line 207, replace the words `stamps when a gate opened, so the wait can be timed` with `stamps when a gate opened, so the wait can be timed; on a controlled stage it also swaps the controller's placeholder question for the one in the handoff`. (hooks/gate.js:47-52 is the code; docs/subagents.md:480 already says it.)

In `docs/plans/2026-09-19-stage-agents-design.md`, in the section 未決, replace the line `  所以 build 的 workflow 由 script 產生、主控用 \`scriptPath\` 開。` (two leading spaces; the backticks are literal) with `  所以 build 站在 brain 裡用 Agent 分回合派、一回合最多四個；由 script 產生 workflow 這條被 [2026-09-21-controlled-stations-design.md](2026-09-21-controlled-stations-design.md) 取代，留在 TODO 的 Waiting。`

In `TODO.md`, delete the bullet at line 83 (the one beginning `- 〔stage-agents〕站 agent 拿不到 \`Workflow\` 工具`) from `## Ready`, and append it unchanged to the end of `## Waiting`, after the last `###` block, under:

```md
### brain 的 context 撐不住
lifts when: `scripts/ctx.js` 量到 build 或 verify 的站 agent 自己的 context 過 400k（`lib/context.js` 的線）. 09-21.
```

(that block is a TODO.md edit, not code; the fence is the two lines to write, then a blank line, then the moved bullet.)

Also in `TODO.md`, replace the bullet that begins `- 〔stage-agents〕受控站要不要推到 build／verify：` with the line below. That question is the one this plan answers, and the measurement it waited on is now a script; the three gaps it lists are not touched by this plan, so they stay. Find it by that beginning, because the move above shifted the line numbers.

```md
- 〔stage-agents〕受控站還有三個缺口沒動：design 要能跨輪存活來回對話、station 第二層仍平鋪、插話沒人接；build／verify 有沒有省 context，要等 scripts/ctx.js 實跑一次 A/B 才知道 — [lib/stages.js](lib/stages.js).
```

The bullet that begins `- 〔stage-agents〕量 Sonnet 主控` stays as it is: this plan writes the tool and does not run the A/B.

- [ ] **Step 8: The documents still agree**

```sh
node scripts/docs-check.js
node scripts/todo-check.js
node scripts/map.js
```

`docs-check` and `todo-check` exit 0. Report the return as a status line: the files changed, the test line, the two exit codes.

## Task 3: A script that measures a session's context

Design §3. The one measurement made so far (`docs/reports/2026-09-20-survey-brain-ab.md:9`) came from an unversioned script hard-coded to five session ids under `.fankeel/build/`; nothing in the repository can say what the controller's context did in an arbitrary session.

**Files:**
- Modify: `scripts/ctx.js` — new file, the whole script
- Test: `tests/ctx.test.js` — new file
- Read: `lib/usage.js` — `entriesOf`, `summarise` (`{series: true}`), `turnIndex`, `agentsOf`, `splitOf`, `tokensOf`; this task parses no transcript line itself
- Read: `lib/detail.js` — `transcriptOf(configDir, sessionId)`, the one place a session id becomes its transcript path

**Interfaces:**
- Consumes: `usage.entriesOf(file) → object[] | null`; `usage.summarise(file, { series: true }) → { series: [{ id, at, model, context, output, tokens }], … } | null`; `usage.turnIndex(entries) → (i) => turn | null`; `usage.agentsOf(file) → { agents: number, models, … } | null`; `usage.splitOf(models)`; `usage.tokensOf(split) → number`; `detail.transcriptOf(configDir, sessionId) → string | null`
- Produces: `measure(file) → { turns, perTurn: number[], peak, peakTurn, last, gates: number[], agents, agentTokens } | null`; `main(argv) → { text, code? }`

**Dispatch:** implementer, sonnet — the plan carries the code; a thin wrapper and its fixture.

The design's promise, kept verbatim: `scripts/ctx.js <transcript|session-id>` 印主 session 每回合的 context（input＋cache read＋cache creation，同一個 requestId 只算一次）、峰值、每個關卡當下的值、與各 subagent 的 token 合計。 An argument ending `.jsonl` is a transcript path; anything else is a session id, and `detail.transcriptOf` turns it into the path by asking every project directory under the config directory for that one file name. `usage.agentsOf` finds `subagents/` beside the transcript, so the subagent totals need nothing more. The per-turn figures print on one line, so a long session does not flood whoever ran the script — which would defeat the point of measuring context.

- [ ] **Step 1: Write the failing test**

In `tests/ctx.test.js`, write:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ctx = require('../scripts/ctx.js');
const tmp = require('./tmp.js');

const line = (o) => JSON.stringify(o) + '\n';
const assistant = (requestId, usage, content) => line({
    type: 'assistant', requestId, timestamp: '2026-09-21T00:00:00.000Z',
    message: { model: 'claude-sonnet-5', usage, content: content || [] },
});

// Three requests, counted by hand. A request's context is input + cache read +
// cache write:  r1 10 + 1000 + 500 = 1510   r2 20 + 3000 = 3020   r3 30 + 2000 + 100 = 2130.
// r2 is written on two lines, as a real response is, and it asks a question.
function session(dir, name) {
    const file = path.join(dir, name || 's.jsonl');
    const ask = [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }];
    fs.writeFileSync(file, [
        assistant('r1', { input_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 500, output_tokens: 5 }),
        assistant('r2', { input_tokens: 20, cache_read_input_tokens: 3000, output_tokens: 7 }, ask),
        assistant('r2', { input_tokens: 20, cache_read_input_tokens: 3000, output_tokens: 7 }, ask),
        assistant('r3', { input_tokens: 30, cache_read_input_tokens: 2000, cache_creation_input_tokens: 100, output_tokens: 9 }),
    ].join(''));
    return file;
}

test('measure counts each request once: peak, last, and the context at a gate', () => {
    const file = session(tmp('fankeel-ctx-'));
    const m = ctx.measure(file);
    assert.equal(m.turns, 3);
    assert.deepEqual(m.perTurn, [1510, 3020, 2130]);
    assert.match(ctx.main([file]).text, /each turn: 1510 3020 2130/);
    assert.equal(m.peak, 3020);
    assert.equal(m.peakTurn, 2);
    assert.equal(m.last, 2130);
    assert.deepEqual(m.gates, [3020]);
    assert.equal(m.agents, 0);
});

test('measure puts the subagents beside the session, never into it', () => {
    const dir = tmp('fankeel-ctx-');
    const file = session(dir);
    const sub = path.join(dir, 's', 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'agent-ab12.jsonl'), line({
        type: 'assistant', isSidechain: true, requestId: 'a1', timestamp: '2026-09-21T00:00:01.000Z',
        message: { model: 'claude-sonnet-5', usage: { input_tokens: 100, output_tokens: 50 } },
    }));
    const m = ctx.measure(file);
    assert.equal(m.peak, 3020);
    assert.equal(m.agents, 1);
    assert.equal(m.agentTokens, 150);
});

test('a session id is looked up under every project directory of the config directory', () => {
    const cfg = tmp('fankeel-ctx-');
    const dir = path.join(cfg, 'projects', 'some-slug');
    fs.mkdirSync(dir, { recursive: true });
    session(dir, '11111111-2222-4333-8444-555555555555.jsonl');
    assert.match(ctx.main(['11111111-2222-4333-8444-555555555555', '--claude-dir', cfg]).text, /peak 3,020/);
    assert.match(ctx.main(['22222222-2222-4333-8444-555555555555', '--claude-dir', cfg]).text, /unreadable/);
});

test('measure is null for a file that cannot be read', () => {
    assert.equal(ctx.measure(path.join(tmp('fankeel-ctx-'), 'missing.jsonl')), null);
});

test('--compare prints both sessions and the difference in peak', () => {
    const a = session(tmp('fankeel-ctx-'));
    const b = path.join(tmp('fankeel-ctx-'), 's.jsonl');
    fs.writeFileSync(b, assistant('r1', { input_tokens: 1000, output_tokens: 1 }));
    const { text } = ctx.main(['--compare', a, b]);
    assert.match(text, /3,020/);
    assert.match(text, /1,000/);
    assert.match(text, /-2,020/);
});

test('a wrong number of paths is a usage line and a non-zero code', () => {
    assert.equal(ctx.main([]).code, 2);
    assert.equal(ctx.main(['--compare', 'only-one.jsonl']).code, 2);
});
```

- [ ] **Step 2: Run it and watch it fail**

```sh
node --test tests/ctx.test.js
```

Expected: fails at the first `require` — `scripts/ctx.js` does not exist.

- [ ] **Step 3: Write the script**

In `scripts/ctx.js`, write:

```js
#!/usr/bin/env node
'use strict';

// What one session's own context did, turn by turn — the number a stage agent
// exists to keep down. It reads a transcript with the readers `lib/usage.js`
// already has and parses no line itself.
//
//   node scripts/ctx.js <transcript.jsonl | session-id> [--claude-dir <dir>]
//   node scripts/ctx.js --compare <a> <b>
//
// An argument ending `.jsonl` is a transcript; anything else is a session id,
// which `transcriptOf` in `lib/detail.js` finds under every project directory
// of the config directory.
//
// `context` is one request's input plus cache reads plus cache writes, the
// figure `lib/usage.js` calls `contextOf`. A gate is a request whose reply calls
// AskUserQuestion; its figure is the context that question went out with.
const os = require('node:os');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');
const detail = require('../lib/detail.js');
const usage = require('../lib/usage.js');

const OPTIONS = { compare: { type: 'boolean' }, 'claude-dir': { type: 'string' } };

function asksAQuestion(entry) {
    const content = entry && entry.message && entry.message.content;
    return Boolean(entry && entry.type === 'assistant' && entry.isSidechain !== true && Array.isArray(content)
        && content.some((c) => c && c.type === 'tool_use' && c.name === 'AskUserQuestion'));
}

function measure(file) {
    const entries = usage.entriesOf(file);
    const summary = entries && usage.summarise(file, { series: true });
    if (!summary || !summary.series) return null;
    const contexts = summary.series.map((row) => row.context);
    const turn = usage.turnIndex(entries);
    const gates = [];
    entries.forEach((entry, i) => {
        const n = asksAQuestion(entry) ? turn(i) : null;
        if (n && !gates.includes(n)) gates.push(n);
    });
    const peak = contexts.reduce((a, b) => Math.max(a, b), 0);
    const agents = usage.agentsOf(file);
    return {
        turns: contexts.length,
        perTurn: contexts,
        peak,
        peakTurn: contexts.indexOf(peak) + 1,
        last: contexts.length ? contexts[contexts.length - 1] : 0,
        gates: gates.map((n) => contexts[n - 1]),
        agents: agents ? agents.agents : 0,
        agentTokens: agents ? usage.tokensOf(usage.splitOf(agents.models)) : 0,
    };
}

const n = (v) => v.toLocaleString('en-US');
const signed = (v) => (v > 0 ? '+' : '') + n(v);

function describe(label, m) {
    if (!m) return label + '\n  unreadable';
    return [
        label,
        '  turns ' + n(m.turns) + '   peak ' + n(m.peak) + ' (turn ' + m.peakTurn + ')   last ' + n(m.last),
        '  at ' + m.gates.length + ' gates: ' + (m.gates.length ? m.gates.map(n).join(' ') : '—'),
        '  each turn: ' + m.perTurn.join(' '),
        '  subagents ' + n(m.agents) + '   tokens ' + n(m.agentTokens),
    ].join('\n');
}

function main(argv) {
    const { values, positionals } = parseArgv({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
    if (positionals.length !== (values.compare ? 2 : 1)) {
        return { text: 'usage: node scripts/ctx.js <transcript.jsonl|session-id>  |  --compare <a> <b>   [--claude-dir <dir>]', code: 2 };
    }
    const claudeDir = values['claude-dir'] || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const files = positionals.map((p) => (p.endsWith('.jsonl') ? p : detail.transcriptOf(claudeDir, p)));
    const ms = files.map((file) => (file ? measure(file) : null));
    const out = positionals.map((file, i) => describe(file, ms[i]));
    if (values.compare && ms[0] && ms[1]) {
        out.push('b minus a   peak ' + signed(ms[1].peak - ms[0].peak) + '   subagent tokens ' + signed(ms[1].agentTokens - ms[0].agentTokens));
    }
    return { text: out.join('\n\n') };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { measure, main };
```

- [ ] **Step 4: Run it and watch it pass, then run it on a real transcript**

```sh
node --test tests/ctx.test.js
node scripts/ctx.js "$(ls -t "$HOME/.claude/projects/F--ymlab-fankeel/"*.jsonl | sed -n '1p')"
node scripts/ctx.js <session-id>
```

The test passes. `<session-id>` is the one in the `FANKEEL ACTIVE` block, and the third command resolves it to the same transcript as the second. Each prints five lines with a non-zero `turns`, the `each turn:` one holding every turn's context; report `turns`, `peak` and `last` in the status line, not the whole output.

## Task 4: Descriptions, presets and a way to clear a key, in one place

Design §4, the library half. Everything the page and the route will read about a key — what it means, what a habit sets it to, how to remove it from one file, how to print it — is written once in `lib/profile.js`.

**Files:**
- Modify: `lib/profile.js` — `desc` on every key, `PRESETS`, `unset`, `display`, `showLines`, and the export line
- Modify: `scripts/task.js` — `profile show` prints through `showLines`
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: none
- Produces: `KEYS[key].desc: string`; `PRESETS: { manual|balanced|lean: { label, blurb, set: { [key]: string | null } } }` (`null` clears the key); `unset(file, key) → { ok: true, file, key } | { ok: false, reason }`; `display(value) → string`; `showLines(values, sources) → string[]`

**Dispatch:** implementer, sonnet — the plan carries the code; data, two small functions and a formatter.

- [ ] **Step 1: Write the failing tests**

At the end of `tests/profile.test.js`, using its `dir`, `profile`, `fs` and `path`, add:

```js
test('every key carries a one-line description', () => {
    for (const [key, spec] of Object.entries(profile.KEYS)) {
        assert.equal(typeof spec.desc, 'string', key);
        assert.ok(spec.desc.length > 0 && !spec.desc.includes('\n'), key + ' needs a one-line desc');
    }
});

test('a preset only sets keys that exist, to values the table accepts', () => {
    assert.deepEqual(Object.keys(profile.PRESETS), ['manual', 'balanced', 'lean']);
    for (const [id, preset] of Object.entries(profile.PRESETS)) {
        assert.ok(preset.label && preset.blurb, id + ' needs a label and a blurb');
        for (const [key, value] of Object.entries(preset.set)) {
            assert.ok(profile.KEYS[key], id + ' sets an unknown key: ' + key);
            if (value !== null) assert.ok(!profile.parseValue(key, value).error, id + ' sets ' + key + ' to a value the table refuses: ' + value);
        }
    }
});

test('unset removes one key from one file and leaves the rest', () => {
    const file = path.join(dir(), 'profile.json');
    profile.write(file, 'land.push', 'false');
    profile.write(file, 'guard', 'deny');
    assert.equal(profile.unset(file, 'land.push').ok, true);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { guard: 'deny' });
    assert.equal(profile.unset(file, 'class.default').ok, true, 'a key that is not there is not an error');
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { guard: 'deny' });
});

test('unset never creates a file, refuses an unknown key, and names a file that does not parse', () => {
    const file = path.join(dir(), 'profile.json');
    assert.equal(profile.unset(file, 'land.push').ok, true);
    assert.equal(fs.existsSync(file), false);
    assert.equal(profile.unset(file, 'nope').ok, false);
    fs.writeFileSync(file, '{ not json');
    assert.equal(profile.unset(file, 'land.push').ok, false);
});

test('display is the one text a value prints as', () => {
    assert.equal(profile.display(undefined), '(ask)');
    assert.equal(profile.display([]), 'false');
    assert.equal(profile.display(['survey', 'build', 'verify']), 'survey,build,verify');
    assert.equal(profile.display(false), 'false');
    assert.equal(profile.display('merge'), 'merge');
});

test('showLines pads each column to its longest cell and ends every line with the description', () => {
    const lines = profile.showLines({ 'stage.agents': ['survey', 'build', 'verify'], guard: 'ask' }, { 'stage.agents': 'project', guard: 'builtin' });
    const keys = Object.keys(profile.KEYS);
    assert.equal(lines.length, keys.length);
    const agents = lines[keys.indexOf('stage.agents')];
    const wideKey = Math.max(...keys.map((k) => k.length));
    assert.ok(agents.startsWith('  ' + 'stage.agents'.padEnd(wideKey) + '  survey,build,verify  project  '), 'each column is as wide as its longest cell: ' + JSON.stringify(agents));
    assert.ok(agents.endsWith(profile.KEYS['stage.agents'].desc));
    const starts = new Set(lines.map((l, i) => l.length - profile.KEYS[keys[i]].desc.length));
    assert.equal(starts.size, 1, 'every description starts in the same column');
});
```

- [ ] **Step 2: Run them and watch them fail**

```sh
node --test tests/profile.test.js
```

Expected: the six new tests fail (`desc` is undefined, `PRESETS`, `unset`, `display` and `showLines` do not exist).

- [ ] **Step 3: A description on every key**

In `lib/profile.js`, replace the `KEYS` object, lines 17–32 (from `const KEYS = {` to its closing `};`), with:

```js
const KEYS = {
    'land.integration': { values: ['merge', 'pr', 'keep'], builtin: null, desc: '收尾時怎麼整合：merge、pr 或 keep' },
    'land.push': { values: ['true', 'false'], builtin: null, desc: '收尾時要不要 push' },
    'land.archivePlan': { values: ['true', 'false'], builtin: null, desc: '計畫落地後直接封存，還是先問' },
    'class.default': { values: ['spike', 'bounded', 'architectural'], builtin: null, desc: '起任務沒指定類別時的預設（spike／bounded／architectural）' },
    guard: { values: ['ask', 'deny', 'off'], builtin: 'ask', desc: '別的 session 佔了檔案時：ask 問、deny 擋、off 只警告' },
    'dispatch.floor': { values: ['sonnet', 'opus', 'fable', 'haiku'], builtin: 'sonnet', desc: '派給實作者的最低模型' },
    'judge.model': { values: ['sonnet', 'opus', 'fable', 'haiku'], builtin: 'fable', desc: '判官（/fankeel-ask）用哪個模型' },
    'design.mockup': { values: ['false', 'sonnet', 'opus', 'fable'], builtin: false, desc: '有前端的專案，design 站先做頁面時用哪個模型；false 不做' },
    'station.hide': { values: ['true', 'false'], builtin: 'false', desc: '這個專案要不要從監控站隱藏' },
    // `values` here is only the three fixed forms a station <select> lists —
    // `false`, `true`, `all`. The fourth form, a comma-separated stage list,
    // is validated and normalized by `parseStageAgents` below rather than by
    // this array, because it is not a small enumerable set.
    'stage.agents': { values: ['false', 'true', 'all'], builtin: 'false', desc: '哪幾站交給站 agent 在乾淨 context 裡跑，主控只轉路徑' },
};
```

- [ ] **Step 4: The presets, `unset`, `display` and `showLines`**

In `lib/profile.js`, directly above the line `function landClause(values) {`, add:

```js
// The habits the station's home page offers as one card each. `set` is what a
// preset writes: a value is written as if typed at `profile set`, and `null`
// clears the key from the file it is applied to, so the layer below answers.
const PRESETS = {
    manual: {
        label: '手動',
        blurb: '每個關卡都問我。不熟的 repo，或不想讓它替你決定的時候用這組。',
        set: { 'land.integration': null, 'land.push': null, 'land.archivePlan': null, 'class.default': null, guard: 'ask', 'stage.agents': 'false' },
    },
    balanced: {
        label: '平衡',
        blurb: '這個 repo 今天的習慣：收尾照現在的做法走，只在值得停的地方停。',
        set: { 'land.integration': 'merge', 'land.push': 'false', 'land.archivePlan': 'true', guard: 'ask', 'stage.agents': 'survey' },
    },
    lean: {
        label: '省 context',
        blurb: '主控只轉路徑。在「平衡」之上，把 survey、build、verify 三站交給站 agent 在自己的乾淨 context 裡跑。',
        set: { 'land.integration': 'merge', 'land.push': 'false', 'land.archivePlan': 'true', guard: 'ask', 'stage.agents': 'survey,build,verify' },
    },
};

// Removes one key from one file. A key that is not there is not an error, and
// nothing is written for it: a file is never created just to say it is empty.
function unset(file, key) {
    if (!KEYS[key]) return { ok: false, reason: 'unknown key: ' + key };
    const current = readOne(file);
    if (current.unreadable) return { ok: false, reason: file + ' does not parse; fix it by hand first' };
    if (!current.values || !Object.prototype.hasOwnProperty.call(current.values, key)) return { ok: true, file, key };
    const next = Object.assign({}, current.values);
    delete next[key];
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
    return { ok: true, file, key };
}

// The one text form of a value: what `profile show` prints and what the
// station's <select> matches its options against. `stage.agents` is the array;
// String([]) is '', which would read as blank rather than as the off it means.
function display(v) {
    if (v === undefined) return '(ask)';
    if (Array.isArray(v)) return v.length ? v.join(',') : 'false';
    return String(v);
}

// One line per key for `task.js profile show`: the key, its value and the layer
// it came from, each column as wide as its longest cell, then what the key means.
function showLines(values, sources) {
    const rows = Object.keys(KEYS).map((key) => [key, display(values[key]), sources[key] || '', KEYS[key].desc]);
    const wide = [0, 1, 2].map((c) => Math.max(...rows.map((r) => r[c].length)));
    return rows.map((r) => '  ' + [0, 1, 2].map((c) => r[c].padEnd(wide[c])).join('  ') + '  ' + r[3]);
}
```

- [ ] **Step 5: Export them**

In `lib/profile.js`, replace the last line, the `module.exports`, with:

```js
module.exports = { KEYS, PRESETS, projectFile, machineFile, configDirOf, read, write, unset, suggest, landClause, summary, parseValue, display, showLines };
```

- [ ] **Step 6: `profile show` prints through it**

In `scripts/task.js`, in `cmdProfile`, replace the whole `if (verb === 'show') { … }` block (lines 846–858, from `if (verb === 'show') {` to its closing brace, including the `shown` helper and its three-line comment) with:

```js
    if (verb === 'show') {
        const { values, sources, unreadable } = profile.read(projectRoot, cfg);
        const lines = ['fankeel — profile for ' + projectRoot].concat(profile.showLines(values, sources));
        for (const f of unreadable) lines.push('  unreadable: ' + f);
        return lines.join('\n');
    }
```

- [ ] **Step 7: Run it and watch it pass, then the neighbours**

```sh
node --test tests/profile.test.js tests/task.test.js tests/skills.test.js
```

All pass. If a test in `tests/task.test.js` asserted the old column layout of `profile show`, update it to the new layout and say so in the status line; that is the one change to an existing test this task may make.

## Task 5: The route takes a stage list and a clear, and the page is given the presets

Design §4, the server half. Today `POST /profile` validates against `spec.values.includes()`, and `stage.agents` lists only `false`, `true` and `all` — while the page offers the current `survey,build,verify` back as the selected option. Submitting the form unchanged is a 400.

**Files:**
- Modify: `scripts/station.js` — validate with `profile.parseValue`, and an empty value clears the key
- Modify: `lib/station.js` — the served data carries `profilePresets`
- Test: `tests/station-cli.test.js`
- Read: `lib/profile.js` — `parseValue`, `unset` and `PRESETS`, which Task 4 writes

**Interfaces:**
- Consumes: `profile.parseValue(key, raw) → { value } | { error }`; `profile.unset(file, key)`; `profile.PRESETS`
- Produces: `POST /profile` accepts `value=` (empty) as "clear this key from the file this scope names"; the data script `station/station-data.js` carries `"profilePresets"`

**Dispatch:** implementer, sonnet — the plan carries the code; one validation loop, one write loop, one field.

- [ ] **Step 1: Write the failing test**

At the end of `tests/station-cli.test.js`, using its `fixture`, `request`, `serve`, `fs` and `path`, add:

```js
test('POST /profile takes a stage list and an empty value clears a key; the data carries the presets', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        assert.match(data.text, /"profilePresets":\{"manual":/);
        const file = path.join(f.r1, '.fankeel', 'profile.json');
        const post = (pairs) => request(s.url + 'profile', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
            new URLSearchParams([['nonce', nonce], ['scope', 'project'], ['project', f.r1]].concat(pairs)).toString());
        // The page offers a project's own stage list back as the selected option,
        // so sending it back unchanged has to be accepted.
        assert.equal((await post([['key', 'stage.agents'], ['value', 'survey,build,verify']])).status, 303);
        assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { 'stage.agents': ['survey', 'build', 'verify'] });
        // A preset is several pairs in one request; an empty value removes that key from this file.
        assert.equal((await post([['key', 'land.push'], ['value', 'false'], ['key', 'stage.agents'], ['value', '']])).status, 303);
        assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { 'land.push': false });
        assert.equal((await post([['key', 'stage.agents'], ['value', 'survey,nope']])).status, 400);
    } finally {
        s.close();
    }
});
```

- [ ] **Step 2: Run it and watch it fail**

```sh
node --test tests/station-cli.test.js
```

Expected: the new test fails at `"profilePresets"` — the data does not carry it yet.

- [ ] **Step 3: The data carries the presets**

In `lib/station.js`, in the object the serializer returns, directly after the line `        profileKeys: profile.KEYS,` add:

```js
        profilePresets: profile.PRESETS,
```

- [ ] **Step 4: The route validates with the one parser and clears on an empty value**

In `scripts/station.js`, in the `POST /profile` handler, replace the two loops that follow `const values = form.getAll('value');` and its pairing check — the validation loop (from the comment `// Validate every pair before writing any, so a bad second key` to its closing brace) and the write loop (from `for (let i = 0; i < keys.length; i++) {` with `profile.write(` to its closing brace) — with:

```js
            // Validate every pair before writing any, so a bad second key
            // does not leave the first one applied. An empty value clears the key.
            for (let i = 0; i < keys.length; i++) {
                if (!profile.KEYS[keys[i]] || (values[i] !== '' && profile.parseValue(keys[i], values[i]).error)) {
                    fail(400, 'not a profile key/value: ' + keys[i] + '=' + values[i]);
                    return;
                }
            }
            for (let i = 0; i < keys.length; i++) {
                const out = values[i] === '' ? profile.unset(file, keys[i]) : profile.write(file, keys[i], values[i]);
                if (!out.ok) {
                    fail(409, out.reason);
                    return;
                }
            }
```

The two lines after it — `res.writeHead(303, { location: '/' });` and `res.end();` — stay.

- [ ] **Step 5: Run it and watch it pass, then the neighbours**

```sh
node --test tests/station-cli.test.js tests/station.test.js tests/station-view.test.js
```

All pass. The existing POST tests (`430`, `552`, `564`, `576`) still pass, which shows the wrong-key, wrong-value and no-pair answers did not move.

## Task 6: The home page's profile card gets its descriptions and its three habits

Design §4, the page half. Only the top of the mockup is built: three cards that each apply one habit, and a description under each key. The per-row markers, the per-row clear button and the seven-stage toggle stay in TODO.

**Files:**
- Modify: `assets/station/station.js` — `presetStrip`, a description in each row, `profileCard` places the strip, the export
- Modify: `assets/station/station.css` — four rules after `.pf`
- Modify: `TODO.md` — the 〔profile〕 entry asking whether the keys get a sentence on the card is answered here and is removed
- Test: `tests/station-view.test.js`
- Read: `lib/profile.js` — `KEYS[key].desc` and `PRESETS`, the shapes Task 4 writes

**Interfaces:**
- Consumes: `S.profilePresets` (`{ id: { label, blurb, set } }`, the shape of Task 4's `PRESETS`; the data script delivers it at run time, and this task's tests set it by hand); `S.profileKeys[key].desc`
- Produces: `presetStrip(scope, projectPath) → string`, exported as `V.presetStrip`; an HTML string that is `''` when the page is not served or has no presets

**Dispatch:** implementer, sonnet — the plan carries the code; one function, one changed row, one changed card, four CSS rules, one deleted TODO bullet.

- [ ] **Step 1: Write the failing tests**

At the end of `tests/station-view.test.js`, using its `V`, `profile` and `global.window.STATION`, add:

```js
test('presetStrip is one form per preset, each carrying every key it sets, and clears with an empty value', () => {
    global.window.STATION.serve = true;
    global.window.STATION.nonce = 'tok-1';
    global.window.STATION.profilePresets = profile.PRESETS;
    const out = V.presetStrip('project', '/proj');
    assert.equal((out.match(/<form /g) || []).length, Object.keys(profile.PRESETS).length);
    assert.match(out, /name="key" value="land\.push"><input type="hidden" name="value" value="">/, 'the manual preset clears land.push with an empty value, not the text null');
    assert.match(out, /name="key" value="stage\.agents"><input type="hidden" name="value" value="survey,build,verify">/);
    assert.match(out, /name="project" value="\/proj"/);
    assert.match(out, /name="scope" value="project"/);
});

test('presetStrip is empty on a static page', () => {
    global.window.STATION.serve = false;
    global.window.STATION.profilePresets = profile.PRESETS;
    assert.equal(V.presetStrip('machine', null), '');
});

test('the card prints a description for every key, and each value it shows is the one profile.display gives', () => {
    const values = { 'land.push': false, 'stage.agents': ['survey', 'build', 'verify'], guard: 'ask' };
    const sources = { 'land.push': 'project', 'stage.agents': 'project', guard: 'builtin' };
    global.window.STATION.profileKeys = profile.KEYS;
    global.window.STATION.serve = false;
    const out = V.profileCard('t', 'project', '/proj', { values, sources, unreadable: [] });
    const rows = out.match(/<tr><td class="mono">[\s\S]*?<\/tr>/g);
    const keys = Object.keys(profile.KEYS);
    assert.equal(rows.length, keys.length);
    keys.forEach((key, i) => {
        assert.ok(rows[i].includes(profile.KEYS[key].desc), key + ' row carries its description');
        assert.ok(rows[i].includes('<td>' + profile.display(values[key]) + '</td>'), key + ' row shows ' + profile.display(values[key]));
    });
});
```

- [ ] **Step 2: Run them and watch them fail**

```sh
node --test tests/station-view.test.js
```

Expected: the three new tests fail — `V.presetStrip` is not a function, and the rows carry no description.

- [ ] **Step 3: The strip**

In `assets/station/station.js`, directly above the line `    function profileCard(title, scope, projectPath, prof) {`, add:

```js
    // The habits `lib/profile.js` calls PRESETS, one form each: a card that says what
    // it sets and one button that sends every key of it in a single POST. An empty
    // value means "clear this key from this card's own file". Only when served: a
    // static page has nothing to post to.
    function presetStrip(scope, projectPath) {
        var presets = S.profilePresets || {};
        var ids = Object.keys(presets);
        if (!S.serve || !ids.length) return '';
        return '<div class="presets">' + ids.map(function (id) {
            var p = presets[id];
            var keys = Object.keys(p.set);
            return '<form method="post" action="/profile" class="preset">'
                + '<input type="hidden" name="nonce" value="' + esc(S.nonce || '') + '">'
                + '<input type="hidden" name="scope" value="' + scope + '">'
                + (projectPath ? '<input type="hidden" name="project" value="' + esc(projectPath) + '">' : '')
                + keys.map(function (k) {
                    return '<input type="hidden" name="key" value="' + esc(k) + '"><input type="hidden" name="value" value="' + esc(p.set[k] === null ? '' : p.set[k]) + '">';
                }).join('')
                + '<b>' + esc(p.label) + '</b><div class="mute">' + esc(p.blurb) + '</div>'
                + '<div class="mono changes">' + keys.map(function (k) { return esc(k) + ' → ' + (p.set[k] === null ? '(ask)' : esc(p.set[k])); }).join('<br>') + '</div>'
                + '<button class="ctl" type="submit">套用「' + esc(p.label) + '」</button></form>';
        }).join('') + '</div>';
    }
```

- [ ] **Step 4: The card places it, and each row carries its description**

In `assets/station/station.js`, in `profileCard`, replace the line that begins `+ bad + '<table><thead>` with:

```js
            + bad + presetStrip(scope, projectPath) + '<table><thead><tr><th>key</th><th>value</th><th>source</th><th></th></tr></thead><tbody>'
```

And in `assets/station/station.js`, in `profileRows`, replace the line beginning `out += '<tr><td class="mono">' + esc(key) + '</td>` with:

```js
            out += '<tr><td class="mono">' + esc(key) + '<div class="mute desc">' + esc(spec.desc || '') + '</div></td><td>' + esc(shown) + '</td><td class="mute">' + esc(src) + '</td><td>' + ctl + '</td></tr>';
```

- [ ] **Step 5: Export it**

In `assets/station/station.js`, in the `module.exports` object, replace the line `            profileCard: profileCard,` with:

```js
            profileCard: profileCard, presetStrip: presetStrip,
```

- [ ] **Step 6: Four CSS rules**

In `assets/station/station.css`, directly after the line `.pf{display:inline-flex;gap:6px;align-items:center}`, add:

```css
.presets{display:flex;gap:10px;margin:8px 0}
.preset{flex:1;display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel)}
.preset .changes{font-size:11px;line-height:1.5}
.profile .desc{font:11px system-ui,sans-serif;margin-top:2px}
```

- [ ] **Step 7: Close the TODO entry this page answers**

In `TODO.md`, delete the bullet that begins `- 〔profile〕使用者看不出那十個鍵在做什麼` — find it by that beginning, because earlier tasks moved the line numbers. Its question, one sentence per key on the card or another page, is answered by the card. The per-row markers and the whole-page layout stay in the 〔station〕 entry under `## Needs a decision`.

```sh
node scripts/todo-check.js
```

Exit 0.

- [ ] **Step 8: Run it and watch it pass, then the neighbours**

```sh
node --test tests/station-view.test.js tests/station-cli.test.js tests/station.test.js
```

All pass. Then the whole suite once, unpiped, because this group changed the served page:

```sh
npm test
```

The parent reads the exit code, not a tail of the output.

What this task cannot do is render the page: `node --test` has no DOM, so the tests above match the card's HTML string against `profile.display`. The design's artefact row — the rendered page, its described rows counted against `Object.keys(KEYS).length`, each value compared with what `task.js profile show` prints — is the verify stage's, run against the served page with Playwright.

## Task 7: A controlled build's commits go through its controller

Design §5. Added at the end of build, after the whole-branch review found that a controlled build had nobody who could commit, and the user chose the controller. Not part of the approved six.

**Files:**
- Modify: `scripts/commit.js` — new file, `main(argv, cwd)`: reads a commit file, `git add` then `git commit -o` of the listed paths, prints `<base>..<sha>`
- Modify: `lib/handoff.js` — `commitPath(root, data, stage)` beside `handoffPath`
- Modify: `lib/stages.js` — `SCRIPT_TOKENS.commit`, `COMMIT_RULE` in `controlRules` for `build` only, an implementer in `STAGE_AGENTS.verify`
- Modify: `lib/render.js` — `SCRIPTS.commit`, and in `renderBrainBrief` the build line (write the commit file, return `commit <path>`) and the verify line (send an implementer for a mutation)
- Modify: `agents/fankeel-brain.md` — Tools, Refusals and Return name the commit file
- Modify: `docs/subagents.md` — the protocol table gains the commit row, the `build` paragraph says what is and is not run
- Modify: `TODO.md` — the 〔stage-agents〕 entry loses the commit gap
- Test: `tests/commit.test.js` — new file
- Test: `tests/brief.test.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: `handoffPath`'s directory rule in `lib/handoff.js`; `agentsFor(stage)` and `controlRules(stage)` in `lib/stages.js`
- Produces: `commit.main(argv, cwd) → { text, code? }`; `commitPath(root, data, stage) → string | null`; the commit file's shape, paths one per line, a blank line, then the message

**Dispatch:** in-session — the script, the controller's rule and the brain's brief line are one protocol, and splitting it across contexts costs more than the reading saves.

Done as one red-then-green pass: `tests/commit.test.js` written first and run red (`Cannot find module`), then the script; the two render tests and the brief tests pin the wording on both sides of the protocol. The controller commits with `git commit -o`, so a commit made this way carries no `Co-Authored-By` trailer; that is accepted rather than fixed here.
