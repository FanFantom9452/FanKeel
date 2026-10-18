---
status: design-intent
---

# 判官先列清單、一次派出、長總結 Implementation Plan

**Goal:** fankeel-judge reads in three fixed rounds — a checklist with every reader sent in the same response, one spot-check round, then six fields and a long `## Summary` — and one architecture-level brief measures it beside the two earlier judges.
**Architecture:** The judge's agent file replaces its 300-line threshold with a three-round `## Reading` and a six-field return followed by an unbounded `## Summary`. The fankeel-ask skill's step 2 and the judge paragraph in the subagents reference say the same. A user-run task asks one five-file brief of three judge bodies and files a report. `Workflow` is not used: a subagent's tool list has no `Workflow` (probe, 2026-10-18), so the fan-out is several `Agent` calls in one response.
**Tech Stack:** Node >=22.5 (`package.json` `engines`), `node:test`, no dependencies.
**Spec:** [design-2.md](../../../.fankeel/build/task-20261018T142811/design-2.md)

## Global Constraints

- `package.json` has no `dependencies` or `devDependencies`; add none.
- Tests run with `node --test --require ./tests/subprocess-timeout.js` (`npm test`); a dispatched implementer runs only its own test file, `node --test tests/agents.test.js`.
- Every agent file's frontmatter `tools:` is a bracketed, comma-separated list, and only the agents in `MAY_WRITE` (`tests/agents.test.js:32`) may list `Edit`, `Write` or `NotebookEdit`; `fankeel-judge` is not in it.
- `fankeel-judge`'s pinned effort is `xhigh` (`tests/agents.test.js:249`) and its model `fable`; neither changes.
- `fankeel-judge` stays in `READ_ONLY_AGENTS` (`lib/guard.js:304`).
- Agent and skill pages are filed `reference` and keep `status`, `last_verified`, `source_of_truth` frontmatter; set `last_verified: 2026-10-18` on a page you change.
- A report is `role: report` under `docs/90-agent/reports/` — a dated snapshot, never edited after, 繁體中文, with a row in `docs/README.md` and a row in `docs/90-agent/reference/sources.md` (the sources-doc test fails without it).
- Test files are CommonJS, `'use strict'`, four-space indent, `node:assert/strict`.

## Risks

- A test elsewhere may pin the judge's `description:` wording or its five-field return — Task 1 — run `grep -rn "over 300 lines\|five fields" tests/` first and update any hit in the same task.
- fable may hold readers back for a second round despite the rule — Task 2 — the report counts reader `Agent` calls per assistant message in the new arm's transcript and says so if they are split.

## Task 1: The judge lists, sends every reader at once, and returns a summary

**Files:**
- Modify: `agents/fankeel-judge.md` — description, `## Reading`, `## Return`, Refusals
- Modify: `skills/fankeel-ask/SKILL.md` — step 2's judge sentence
- Modify: `docs/90-agent/reference/subagents.md` — the judge paragraph
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: the three-round `## Reading`, the `checklist:` field and the `## Summary` section in `agents/fankeel-judge.md`, which Task 2 measures

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus one test.

1. Write the failing test. In `tests/agents.test.js`, replace the whole test titled `the judge sends large reads to readers and checks what they return`, with the two comment lines above it, by:

```js
// judge-2: every round the judge takes re-reads its whole context, so it lists
// what it must check, sends every reader in that same response, checks one line
// per reader in one more, and returns a long summary after its six fields.
test('the judge lists its reads, sends every reader at once, and returns a summary', () => {
    const file = path.join(ROOT, 'agents', 'fankeel-judge.md');
    const f = front(file);
    const tools = f.tools.slice(1, -1).split(',').map((s) => s.trim());
    assert.ok(tools.includes('Agent'), 'it dispatches its readers');
    const text = fs.readFileSync(file, 'utf8');
    const reading = text.split('\n## Reading\n')[1].split('\n## ')[0];
    assert.match(reading, /checklist/);
    assert.match(reading, /in the same response/i);
    assert.match(reading, /fankeel:fankeel-reader/);
    assert.match(reading, /model: "sonnet"/);
    assert.match(reading, /model: "opus"/);
    assert.match(reading, /path:line/);
    assert.doesNotMatch(text, /over 300 lines/);
    assert.match(text, /^delegated: /m);
    assert.match(text, /^checklist: /m);
    assert.match(text, /^## Summary$/m);
    const ask = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-ask', 'SKILL.md'), 'utf8');
    assert.doesNotMatch(ask, /over 300 lines/);
    assert.match(ask, /checklist/);
    const ref = fs.readFileSync(path.join(ROOT, 'docs', '90-agent', 'reference', 'subagents.md'), 'utf8');
    assert.doesNotMatch(ref, /over 300 lines/);
    assert.match(ref, /checklist:/);
});
```

2. Run `node --test tests/agents.test.js` and watch this test fail on `/checklist/`.

3. Write the agent file. Replace the whole of `agents/fankeel-judge.md` with:

````md
---
name: fankeel-judge
description: One-shot judgement for a question the session would otherwise put to the user mid-stage — a design clarification, a class, a plan split, a build choice. Lists what it must check, sends every read to a fankeel-reader in one response, spot-checks one line per reader, and answers once in a fixed shape with a long summary after it. Cannot call Edit, Write or NotebookEdit.
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
Then read as below, and decide.

## Reading

Every round you take re-reads your whole context at your model and effort, the
most expensive in this plugin. So you read in three rounds, no more.

1. **List, then send.** Before opening any named file, write a checklist: one
   line per thing you must find out, each naming its path and the one
   question that path answers. Every path the brief names is on it, or under
   `unread:` with why. In the same response, dispatch one
   `subagent_type: fankeel:fankeel-reader` per checklist line — every one of
   them in that response, none held back for a later round. Each goes with
   `model: "sonnet"`, or `model: "opus"` where a single figure or sentence in
   that file decides `pick:` on its own. Ask each to return only the lines
   that decide its question, each with its `path:line`. Read no named file
   whole yourself, at any size.
2. **Check.** A reader's summary is what you judge, so check it. Open one
   `path:line` each reader cited, all of them in one response. Where a span
   does not say what the reader said, say so in `why:` and in the summary.
3. **Return**, as below.

## Return

These six fields, in this order, then the summary, nothing before:

```text
pick: <one option, or the answer in one line>
why: <at most five lines>
would flip if: <at most two lines — the fact that would change the pick>
unread: <what the brief named that you did not open, or "nothing">
delegated: <each path a reader read, with its model, or "nothing">
checklist: <each checklist line, marked answered or not>
```

Then a section headed exactly:

```text
## Summary
```

as long as it needs: what each reader found, with its `path:line`, what the
spot-checks showed, and how those led to `pick:`.

## Refusals

- Do not change a file, by any tool.
- Dispatch only `fankeel:fankeel-reader`, always with `model:` set, never
  `fork`. Never another judge, a reviewer, or an agent that writes.
- Do not ask a question back. If the brief cannot be answered, `pick:` says so
  and `why:` says what is missing.
- Do not pad the six fields; the summary is where length goes.
````

4. Write the skill sentence. In `skills/fankeel-ask/SKILL.md`, step 2, replace these four lines:

```text
   that sends it — one judge, on whatever `judge.model` answered. The judge
   sends any named file over 300 lines to a `fankeel:fankeel-reader` itself,
   on sonnet, or opus where one figure in it decides the pick; its
   `delegated:` line says which.
```

with, in `skills/fankeel-ask/SKILL.md`:

```md
   that sends it — one judge, on whatever `judge.model` answered. The judge
   writes a checklist of what it must find out, sends one
   `fankeel:fankeel-reader` per checklist line in that same response, on
   sonnet, or opus where one figure decides the pick, and returns six fields
   with a `## Summary` of any length after them; `delegated:` says which
   reader read what.
```

5. Write the reference paragraph. In `docs/90-agent/reference/subagents.md`, replace these five lines:

```text
dispatch subagents of your own" (`RETURN_RULES[2]`) for the judge only, because
the judge sends any named file over 300 lines to a `fankeel:fankeel-reader`
(sonnet, or opus when one figure or sentence decides the pick), opens at least
one cited `path:line` itself as a spot-check, and returns a fifth line,
`delegated:`.
```

with, in `docs/90-agent/reference/subagents.md`:

```md
dispatch subagents of your own" (`RETURN_RULES[2]`) for the judge only, because
the judge reads in three rounds: it writes a checklist and, in that same
response, sends one `fankeel:fankeel-reader` per line (sonnet, or opus when one
figure or sentence decides the pick); it opens one cited `path:line` per reader
in one more response; and it returns six fields, `delegated:` and `checklist:`
among them, followed by a `## Summary` of any length. It sends no `Workflow`:
a subagent's tool list has none.
```

Then set that file's frontmatter `last_verified:` to `2026-10-18` if it is not already.

6. Run `node --test tests/agents.test.js` and watch every test pass.

7. Commit: `feat: the judge lists its reads, sends every reader at once, and summarises`.

## Task 2: Measure three judges on one architecture-level brief

**Files:**
- Modify: `docs/90-agent/reports/2026-10-18-judge-checklist.md` — the report, new
- Modify: `.fankeel/build/ask/judge-checklist-brief.md` — the measurement brief, new and ignored
- Read: `agents/fankeel-judge.md` — the new arm's instructions
- Test: none — a measurement, not code

**Interfaces:**
- Consumes: `## Reading`, `checklist:` and `## Summary` from Task 1, in `agents/fankeel-judge.md`
- Produces: `docs/90-agent/reports/2026-10-18-judge-checklist.md`, which Task 3 indexes

**Dispatch:** user — three fable runs are spend the user authorises at this point, and only the main session can dispatch them and read their transcripts.

1. Write the brief to `.fankeel/build/ask/judge-checklist-brief.md` (ignored, under `build/`):

```text
# 量測用 brief — 父 session 沒有登記時，唯讀 agent 還受 guard 管嗎

## 問題
READ_ONLY_AGENTS 裡的 agent，在它的父 session 沒有 active 的 registry 紀錄時，還會被 guard 擋下寫檔嗎？追 hooks/guard.js 怎麼找父 session 的紀錄、lib/registry.js 怎麼回答、lib/guard.js 怎麼判讀唯讀，以及 scripts/task.js 什麼時候寫下或拿掉 active。

## 選項
- A. 會，一律擋
- B. 不會 — 寫出跳過檢查的 path:line，以及什麼情況會落入

## 要讀的路徑
- hooks/guard.js（209 行）
- lib/guard.js（381 行）
- lib/registry.js（1079 行）
- scripts/task.js（1781 行）
- hooks/touch.js（51 行）

## 算回答
pick 是 A 或 B；B 要有 path:line 和落入的情況。
```

2. Dispatch three arms in one response, each `subagent_type: general-purpose`, `model: "fable"`, no `effort`. Arm 1's prompt is the body of `git show e45b3579:agents/fankeel-judge.md` below its frontmatter; arm 2's, the body of `git show 9bce6868:agents/fankeel-judge.md`; arm 3's, the body of `agents/fankeel-judge.md`. Each prompt ends `Brief: .fankeel/build/ask/judge-checklist-brief.md` and, for arms 2 and 3, the line `The rule against dispatching subagents of your own does not apply to this run.` Say it first: three agents, fable.

3. Read the tokens and request counts per transcript, readers included:

```sh
node -e "const fs=require('fs'),p=require('path');const d=process.argv[1];for(const f of fs.readdirSync(d).filter(n=>n.endsWith('.jsonl'))){let m='',t=0,r=0,a=0;for(const l of fs.readFileSync(p.join(d,f),'utf8').split('\n')){if(!l)continue;let j;try{j=JSON.parse(l)}catch{continue}const u=j.message&&j.message.usage;if(!u)continue;r++;m=j.message.model||m;t+=(u.input_tokens||0)+(u.cache_read_input_tokens||0)+(u.cache_creation_input_tokens||0)+(u.output_tokens||0);const c=(j.message.content||[]).filter(x=>x.type==='tool_use'&&x.name==='Agent').length;if(c)a=Math.max(a,c)}console.log(f,m,t,'requests',r,'max-agents-in-one-message',a)}" "C:/Users/user/.claude/projects/F--ymlab-fankeel/65a1bc64-af34-4bee-a429-ad2577882dcc/subagents"
```

A reader belongs to an arm when its agent id appears in that arm's transcript.

4. Write `docs/90-agent/reports/2026-10-18-judge-checklist.md`:

```md
---
status: current
last_verified: 2026-10-18
source_of_truth: agents/fankeel-judge.md
---

# 三版判官，同一份架構級 brief — 2026-10-18

一句話：<三版的判官 token、讀者 token、請求輪數，pick 是否相同>

## 1. 怎麼量

同一份 brief（`.fankeel/build/ask/judge-checklist-brief.md`，五個檔共 3501 行，兩個超過 1000 行），三個 general-purpose agent 都跑 fable、都不指定 effort：e45b3579 的判官（自己讀全部）、9bce6868 的判官（超過 300 行才派讀者）、現在的判官（先列清單、一次派出、長總結）。effort 跟 session 走，不是判官檔的 xhigh，所以絕對數字比真的 ask 低，三版互比才是重點。

## 2. 結果

| arm | 判官 token | 請求輪數 | 讀者 | 讀者 token | 同一則訊息最多讀者 | pick |
|---|---|---|---|---|---|---|
| e45b3579 自己讀 | <n> | <n> | — | 0 | 0 | <A/B> |
| 9bce6868 門檻 | <n> | <n> | <models> | <n> | <n> | <A/B> |
| 現在 清單 | <n> | <n> | <models> | <n> | <n> | <A/B> |

## 3. 清單版有沒有照做

<checklist: 行數與讀者數是否相等；讀者是否都在同一則訊息；Summary 多長>

## 4. 沒量到的

<只跑一次、effort 不是 xhigh>
```

Fill every `<…>` from step 3's output and the three returns; leave none.

5. Commit: `docs: measure three judges on one architecture-level brief`.

## Task 3: Index the report

**Files:**
- Modify: `docs/README.md` — one index row directly above the judge-readers row
- Modify: `docs/90-agent/reference/sources.md` — one row after `JUDGE-READERS-261018`
- Read: `docs/90-agent/reports/2026-10-18-judge-checklist.md` — its one sentence
- Test: none — `tests/sources-doc.test.js` already checks the row

**Interfaces:**
- Consumes: the report from Task 2
- Produces: none

**Dispatch:** in-session — two table rows copied from a report the main session just wrote; a brief would be longer than the edit.

1. In `docs/README.md`, directly above the row that opens 判官派讀者前後量一次（10-18）, add:

```md
| 三版判官同一份架構級 brief（10-18）：自己讀、超過 300 行派讀者、先列清單一次派出，比 token 與請求輪數 | [reports/2026-10-18-judge-checklist.md](90-agent/reports/2026-10-18-judge-checklist.md) — *a dated snapshot, 繁體中文* |
```

2. In `docs/90-agent/reference/sources.md`, directly after the `JUDGE-READERS-261018` row, add one row in that table's seven columns: `JUDGE-CHECKLIST-261018`, the question, the report link `[reports/2026-10-18-judge-checklist.md](../reports/2026-10-18-judge-checklist.md)`, `2026-10-18`, the method, the result from the report's one sentence, and `` `docs/90-agent/plans/2026-10-18-judge-checklist.md`, `docs/README.md` ``.

3. Run `node --test tests/sources-doc.test.js` and `node scripts/docs-check.js`, watch both report nothing for the new page, then commit: `docs: index the three-judge report`.

## Coverage

| promise | task |
|---|---|
| Before opening any named file, the judge writes a checklist: one line per thing it must find out, each naming its path and the one question that path answers. | Task 1 |
| The checklist covers every path the brief names; a path left off appears under `unread:` with why. | Task 1 |
| In the same response as the checklist, the judge dispatches one `fankeel:fankeel-reader` per checklist line, all of them in that one response, none held back for a later round. | Task 1 |
| Every reader goes with `model: "sonnet"`, or `model: "opus"` where one figure or sentence in that file decides `pick:` on its own. | Task 1 |
| The 300-line threshold is gone: the judge reads no named file whole itself, at any size. | Task 1 |
| After the readers return, the judge opens one cited `path:line` per reader, all in one response, before deciding. | Task 1 |
| The return keeps `pick:`, `why:`, `would flip if:`, `unread:`, `delegated:`, adds `checklist:` with each line marked answered or not, and ends with a `## Summary` section of unbounded length that lays out what each reader found and how it led to the pick. | Task 1 |
| Step 2 of the fankeel-ask skill says the judge lists, dispatches every reader at once, and returns a long summary. | Task 1 |
| The judge paragraph in docs/90-agent/reference/subagents.md says the same and drops the 300-line rule. | Task 1 |
| One architecture-level brief (several files, at least one over 1000 lines), asked of the judge before readers (e45b3579), the HEAD judge and the new judge, recorded in docs/90-agent/reports/2026-10-18-judge-checklist.md with each arm's request count, judge tokens, reader tokens, and pick. | Task 2 |
| the judge test fails on HEAD and passes after | Task 1 |
| the new judge's readers all go out in one response | Task 2 |
| request rounds stop growing with file count | Task 2 |
