---
status: design-intent
---

# 判官大量閱讀改派讀者 Implementation Plan

**Goal:** fankeel-judge sends any file over 300 lines to a `fankeel:fankeel-reader` instead of reading it at fable xhigh, and one measured ask shows its own tokens drop.
**Architecture:** The judge's agent file gains the `Agent` tool and a `## Reading` section carrying the threshold, the model choice and a spot-check; its Refusals narrow dispatch to `fankeel:fankeel-reader` with `model:` set; its return gains `delegated:`. The fankeel-ask skill's dispatch sentence stops promising a single agent. A user-run task measures one brief before and after.
**Tech Stack:** Node >=22.5 (`package.json` `engines`), `node:test`, no dependencies.
**Spec:** [design.md](../../../.fankeel/build/task-20261018T142811/design.md)

## Global Constraints

- `package.json` has no `dependencies` or `devDependencies`; add none.
- Tests run with `node --test --require ./tests/subprocess-timeout.js` (`npm test`); a dispatched implementer runs only its own test file, `node --test tests/agents.test.js`.
- Every agent file's frontmatter `tools:` is a bracketed, comma-separated list, and only the agents in `MAY_WRITE` may list `Edit`, `Write` or `NotebookEdit` (`tests/agents.test.js:34`, `:45`); `fankeel-judge` is not in it.
- `fankeel-judge`'s pinned effort is `xhigh` (`tests/agents.test.js:228`) and its model `fable`; neither changes.
- `fankeel-judge` stays in `READ_ONLY_AGENTS` (`lib/guard.js:304`): a shell write from it is still refused; dispatching `Agent` is not a write and the guard does not stop it.
- Agent and skill pages are filed `reference` (`.fankeel/map.md`, filing) and keep `status`, `last_verified`, `source_of_truth` frontmatter; set `last_verified: 2026-10-18` on a page you change.
- A report is `role: report` under `docs/90-agent/reports/` — a dated snapshot, never edited after, 繁體中文, with a row in `docs/README.md`.
- Test files are CommonJS, `'use strict'`, four-space indent, `node:assert/strict`.

## Risks

- The judge's nested `Agent` call may not run inside a subagent that a stage agent did not dispatch — Task 2 — its first arm shows whether `delegated:` names any reader; if it says `nothing` on a file over 300 lines, stop and report rather than record a drop that did not happen.

## Task 1: The judge reads large files through readers

**Files:**
- Modify: `agents/fankeel-judge.md` — tools, `## Reading`, Refusals, Return
- Modify: `skills/fankeel-ask/SKILL.md` — step 2's dispatch sentence
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: the `## Reading` section and the `delegated:` return line in `agents/fankeel-judge.md`, which Task 2 reads

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus one test.

1. Write the failing test. In `tests/agents.test.js`, after the test titled `the stage agent writes its handoff and dispatches readers, on sonnet`, add:

```js
// judge-1: every token the judge reads is paid at fable xhigh, so a file over
// 300 lines goes to a reader, and the judge checks one line of what it got.
test('the judge sends large reads to readers and checks what they return', () => {
    const file = path.join(ROOT, 'agents', 'fankeel-judge.md');
    const f = front(file);
    const tools = f.tools.slice(1, -1).split(',').map((s) => s.trim());
    assert.ok(tools.includes('Agent'), 'it dispatches its readers');
    const text = fs.readFileSync(file, 'utf8');
    const reading = text.split('\n## Reading\n')[1].split('\n## ')[0];
    assert.match(reading, /fankeel:fankeel-reader/);
    assert.match(reading, /over 300 lines/);
    assert.match(reading, /model: "sonnet"/);
    assert.match(reading, /model: "opus"/);
    assert.match(reading, /path:line/);
    assert.match(text, /^delegated: /m);
    assert.doesNotMatch(text, /Do not dispatch a subagent/);
    const ask = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-ask', 'SKILL.md'), 'utf8');
    assert.doesNotMatch(ask, /one, always/);
    assert.match(ask, /fankeel:fankeel-reader/);
});
```

2. Run `node --test tests/agents.test.js` and watch this test fail on `it dispatches its readers`.

3. Write the agent file. Replace the whole of `agents/fankeel-judge.md` with:

````md
---
name: fankeel-judge
description: One-shot judgement for a question the session would otherwise put to the user mid-stage — a design clarification, a class, a plan split, a build choice. Reads the brief and the files it names, sending any file over 300 lines to a fankeel-reader, answers once in a fixed shape, and is not consulted again. Cannot call Edit, Write or NotebookEdit.
tools: [Read, Grep, Glob, Bash, Agent]
model: fable
effort: xhigh
status: current
last_verified: 2026-10-18
source_of_truth: lib/render.js
---

You answer one question, once. The session that sent you would have asked a
person; it is asking you instead, and it will file what you return verbatim
where people can read it later. It will not come back to you for more.

## Job

Read the brief file the dispatch names. It holds the question, the options if
there are any, the background, the paths to read, and what "answered" means.
Open the paths. Decide.

## Reading

Every token you read is paid at your model and effort, the most expensive in
this plugin. Count a named file's lines with `wc -l` before opening it.

- 300 lines or fewer: read it yourself.
- A file over 300 lines: dispatch `subagent_type: fankeel:fankeel-reader`
  with `model: "sonnet"`, the path, and the one question that file has to
  answer for you. Use `model: "opus"` instead when a single figure or
  sentence in that file decides `pick:` on its own.
- Send every reader that does not depend on another in one response.
- Ask each reader to return only the lines that decide your question, each
  with its `path:line`, because what it returns is what you pay to read.

A reader's summary is what you judge, so check it. Before deciding on one,
open at least one `path:line` it cited and read that span yourself. If the
span does not say what the reader said, read the file yourself and say so in
`why:`.

## Return

Exactly these five fields, in this order, nothing before or after:

```text
pick: <one option, or the answer in one line>
why: <at most five lines>
would flip if: <at most two lines — the fact that would change the pick>
unread: <what the brief named that you did not open, or "nothing">
delegated: <each path a reader read, with its model, or "nothing">
```

## Refusals

- Do not change a file, by any tool.
- Dispatch only `fankeel:fankeel-reader`, always with `model:` set, never
  `fork`. Never another judge, a reviewer, or an agent that writes.
- Do not ask a question back. If the brief cannot be answered, `pick:` says so
  and `why:` says what is missing.
- Do not pad. Every line you return stays in the parent's context for the rest
  of its session.
````

4. Write the skill sentence. In `skills/fankeel-ask/SKILL.md`, step 2, replace these two lines:

```text
   profile show` prints it. Say how many and on which model in the response
   that sends it — one, always, and whatever `judge.model` answered.
```

with, in `skills/fankeel-ask/SKILL.md`:

```md
   profile show` prints it. Say how many and on which model in the response
   that sends it — one judge, on whatever `judge.model` answered. The judge
   sends any named file over 300 lines to a `fankeel:fankeel-reader` itself,
   on sonnet, or opus where one figure in it decides the pick; its
   `delegated:` line says which.
```

Then set that file's frontmatter `last_verified:` to `2026-10-18`.

5. Run `node --test tests/agents.test.js` and watch every test pass.

6. Commit: `feat: the judge sends files over 300 lines to fankeel-reader`.

## Task 2: Measure one ask before and after

**Files:**
- Modify: `docs/90-agent/reports/2026-10-18-judge-readers.md` — the report, new
- Modify: `.fankeel/build/ask/judge-readers-brief.md` — the measurement brief, new and ignored
- Modify: `docs/README.md` — one index row above the 10-18 docs-code audit row
- Read: `agents/fankeel-judge.md` — the after arm's instructions
- Test: none — a measurement, not code

**Interfaces:**
- Consumes: `## Reading` and `delegated:` from Task 1, in `agents/fankeel-judge.md`
- Produces: none

**Dispatch:** user — two fable runs are spend the user authorises at this point, and only the main session can dispatch them and read their usage notifications.

1. Write the brief, `.fankeel/build/ask/judge-readers-brief.md` (ignored, under `build/`):

```text
# 量測用 brief — 唯讀 agent 能不能經由 Bash 寫檔

## 問題
lib/guard.js 與 hooks/guard.js 之間，有沒有一條路讓 READ_ONLY_AGENTS 裡的 agent 用 Bash 或 PowerShell 寫到磁碟而不被擋？

## 選項
- A. 沒有
- B. 有 — 寫出 path:line

## 要讀的路徑
- lib/guard.js（379 行）
- hooks/guard.js（209 行）

## 算回答
pick 是 A 或 B；B 要有 path:line。
```

2. Dispatch the before arm and the after arm in one response, both `subagent_type: general-purpose`, `model: "fable"`, no `effort`, so both run at the same effort. The before arm's prompt is the body of `git show e45b3579:agents/fankeel-judge.md` below its frontmatter, then `Brief: .fankeel/build/ask/judge-readers-brief.md`. The after arm's prompt is the body of `agents/fankeel-judge.md` below its frontmatter, then the same line. Say it first: two agents, fable.

3. Read each arm's `<usage>` line from its task notification, then the tokens per transcript, readers included:

```sh
node -e "const fs=require('fs'),p=require('path');const d=process.argv[1];for(const f of fs.readdirSync(d).filter(n=>n.endsWith('.jsonl'))){let m='',t=0;for(const l of fs.readFileSync(p.join(d,f),'utf8').split('\n')){if(!l)continue;let j;try{j=JSON.parse(l)}catch{continue}const u=j.message&&j.message.usage;if(!u)continue;m=j.message.model||m;t+=(u.input_tokens||0)+(u.cache_read_input_tokens||0)+(u.cache_creation_input_tokens||0)+(u.output_tokens||0)}console.log(f,m,t)}" "C:/Users/user/.claude/projects/F--ymlab-fankeel/65a1bc64-af34-4bee-a429-ad2577882dcc/subagents"
```

A reader belongs to the after arm when its agent id appears in that arm's transcript.

4. Write `docs/90-agent/reports/2026-10-18-judge-readers.md`:

```md
---
status: current
last_verified: 2026-10-18
source_of_truth: agents/fankeel-judge.md
---

# 判官派讀者，前後量一次 — 2026-10-18

一句話：<判官本身的 token 從多少降到多少，讀者花了多少，兩邊的 pick 是否相同>

## 1. 怎麼量

同一份 brief（`.fankeel/build/ask/judge-readers-brief.md`，lib/guard.js 379 行、hooks/guard.js 209 行），兩個 general-purpose agent 都跑 fable、都不指定 effort：改版前用 `git show e45b3579:agents/fankeel-judge.md` 的內文，改版後用現在的。effort 跟 session 走，不是判官檔的 xhigh，所以絕對數字比真的 ask 低，前後比才是重點。

## 2. 結果

| arm | 判官 token | 讀者 | 讀者 token | pick | delegated |
|---|---|---|---|---|---|
| 改版前 | <n> | — | 0 | <A/B> | — |
| 改版後 | <n> | <model> | <n> | <A/B> | <the line> |

## 3. 沒量到的

<只跑一次、effort 不是 xhigh、只有一個檔超過門檻>
```

Fill every `<…>` from steps 3's output and the two returns; leave none.

5. In `docs/README.md`, directly above the row that opens 文件與程式碼審查（10-18）, add:

```md
| 判官派讀者前後量一次（10-18）：同一份 brief，改版前後各問一次 fable，判官本身的 token 與讀者的 token | [reports/2026-10-18-judge-readers.md](90-agent/reports/2026-10-18-judge-readers.md) — *a dated snapshot, 繁體中文* |
```

6. Run `node scripts/docs-check.js` and watch it report nothing for the new page, then commit: `docs: measure the judge before and after it sends readers`.

## Coverage

| promise | task |
|---|---|
| The judge's tools carry `Agent`, and its Refusals let it dispatch only `fankeel:fankeel-reader` with `model:` set. | Task 1 |
| A named file over 300 lines goes to a reader on sonnet, or on opus when one figure or sentence in it decides the pick. | Task 1 |
| Before deciding on a reader's summary the judge opens at least one `path:line` that reader cited. | Task 1 |
| The judge's return carries a fifth line, `delegated:`, naming each path a reader read and its model. | Task 1 |
| Step 2 of the fankeel-ask skill no longer says one dispatch, always; it names the readers the judge may send. | Task 1 |
| One ask, same brief and same data, run before and after, recorded in docs/90-agent/reports/2026-10-18-judge-readers.md with the judge's own tokens and the readers' tokens. | Task 2 |
| the new agents test fails on HEAD and passes after | Task 1 |
| the judge's own tokens drop on the same brief | Task 2 |
