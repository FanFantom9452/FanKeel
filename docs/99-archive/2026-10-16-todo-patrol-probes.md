---
status: current
---

# TODO 全表盤點 2026-10-16 Implementation Plan

**Goal:** 六個 todo 條目檔寫回 10-16 盤點的結果：兩份真機探測清單、兩條改 ready、兩條 Blocked 的查證。
**Architecture:** 只改 `docs/90-agent/todo/` 下的條目檔，不動程式。每個 task 改一或兩個檔，彼此不共用檔案，跑 `todo-check.js` 驗。
**Tech Stack:** node，`scripts/todo.js`、`scripts/todo-check.js`；條目格式見 `docs/90-agent/reference/todo.md`。
**Spec:** ../../../.fankeel/build/task-20261015T155848/design.md

## Global Constraints

- 條目 frontmatter 欄位與允許值照 `docs/90-agent/reference/todo.md:31-35`：`state` 是 `ready`、`decision`、`blocked`、`watch` 或 `done`；`group`、`timing`、`stamp` 只給 `blocked` 與 `watch`。
- 移到 `ready` 時拿掉 `group`、`timing` 與 `stamp`（`docs/90-agent/reference/todo.md:77-79`）。
- `stamp` 是 `YYYY-MM-DD`，是有人最後讀過 timing 並同意它仍成立的那天（`docs/90-agent/reference/todo.md:35`）。
- 正文原有的段落不改寫，只在檔尾加新段落；新段落以日期開頭，與既有的「2026-10-14：」「2026-10-15 盤點：」同一寫法。
- 條目正文用中文；程式概念照原名寫（`stage.agents`、`session.append`），不翻譯。
- 每個 task 結束時 `node scripts/todo-check.js` exit 0。
- commit 訊息用 `docs:` 開頭，與 `git log` 近期的 docs commit 一致。

## Risks

- `todo-check.js` 可能拒絕 ready 條目帶 `stamp` — Task 3 — 先跑一次 `node scripts/todo-check.js` 看改完的輸出，拒絕就照它的訊息拿掉欄位。
- 清單裡引用的 `path:line` 可能已移動 — Task 1、Task 2 — 寫入前 `grep -n` 確認每個引用的行仍是所述內容。

## Task 1: 「子代理 brief 改走 spawn」的探測步驟

**Files:**
- Modify: `docs/90-agent/todo/brief-3.md` — 檔尾加「探測步驟」一節
- Read: `docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/hooks/probe.ts` — 確認 `:7` 是 LOG、`:116` 是 `agent.spawn` 監聽

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus one check.

1. 確認引用仍在原處：`grep -n "LOG\|agent.spawn\|mod-probe b" docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/hooks/probe.ts | head`，`:7` 應是 LOG、`:116` 附近是 `agent.spawn`。不符就把下面文字裡的行號改成實際行號。
2. Write：在 `docs/90-agent/todo/brief-3.md` 檔尾，空一行後加：

In `docs/90-agent/todo/brief-3.md`, append:

```md
## 探測步驟（2026-10-16 盤點寫成）

前提：mod 要在互動式 session 載入；Desktop 外掛頁沒有 Enable for this session（compact-6 的 10-14 紀錄），所以在終端跑。

1. 重用 `docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/hooks/probe.ts`：把 `:7` 的 LOG 改到一個新的 `.fankeel/build/<日期>-spawn-probe/records`。這支 probe 只在 dispatch 的 description 含 `mod-probe b` 時改寫 prompt（`:116`），改寫方式是在 prompt 尾端加 `MOD-PROBE-SPAWN-<nonce>`。
2. 終端執行 `claude --plugin-dir docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod --debug-file <log>`，在 session 裡 `/plugin` → Enable for this session。debug log 要有 `hooks module … loaded`；沒有就是 rollout 旗標 `tengu_plugin_hooks_modules` 關著，停在這步並記下。
3. 派三個 description 含 `mod-probe b` 的子代理，prompt 各不相同。
4. 每一個：看 `<session 目錄>/subagents/agent-<agentId>.jsonl` 第 1 行是否以 `MOD-PROBE-SPAWN-<nonce>` 結尾。互動式 session 的 jsonl 可能不落地（mod-probe-3 只見 `.meta.json`），不在就改看 records 裡的 `agent.spawn` 紀錄，並記下「transcript 未落地」。
5. `session.append`：repo 裡沒有呼叫它的程式。先讀 `docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/.claude-plugin/types/claude-code/index.d.ts` 裡 `SessionAppendArgs` 的欄位名，再在 probe 加一段，於第二個子代理執行中帶它的 agentId 呼叫一次，記下回傳或 `{deny}`。
6. 三個都成立，就另開 design 決定 `hooks/brief.js` 哪一部分搬到 `agent.spawn`；任一不成立，就把結果寫進本條並關閉。
```

3. 跑 `node scripts/todo-check.js`，exit 0。
4. Commit：`docs: brief-3 gets its probe steps`。

## Task 2: 「接縫『profile 中途翻轉』」的探測步驟

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-5.md` — 檔尾加「探測步驟」一節
- Read: `hooks/gate.js` — 確認 `:234` 與 `:252` 的兩則訊息
- Read: `hooks/guard.js` — 確認 `:159` 與 `:186` 的兩則訊息

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus one check.

1. 確認引用仍在原處：`grep -n "gate not confirmed\|cannot be asked" hooks/gate.js` 與 `grep -n "is a controlled stage\|is not on stage.agents" hooks/guard.js`。行號不同就改下面文字裡的行號。
2. Write：在 `docs/90-agent/todo/stage-agents-5.md` 檔尾，空一行後加：

In `docs/90-agent/todo/stage-agents-5.md`, append:

```md
## 探測步驟（2026-10-16 盤點寫成）

10-04 那次的翻轉保留了 survey，所以 inject、brief、gate 分不出新舊；這次要把在跑的站整個移出 `stage.agents`。每個 hook 每次呼叫都重讀 profile（`lib/profile.js:359`），session 紀錄則在 `task.js start` 時抄下一份 `stage.agents`，比對兩者就知道讀的是哪一份。

1. 開一個用完即丟的 task，先 `node scripts/task.js profile set stage.agents all --project`，讓 brain 跑一個不是 survey 的站（例如 `--route "design,land"` 的 design）。記下 `.fankeel/profile.json` 與 session 紀錄裡的 `stage.agents`。
2. brain 還在跑時，打開站頁 `#/settings`，到 context 步驟點「不在意，全部自己跑」（`stage.agents=false`），在確認步驟送出（`assets/station/station.js:1987`，寫入 `<專案>/.fankeel/profile.json`）。
3. 逐項看新舊：
   - inject：下一個 prompt 的區塊還有沒有 `You are the controller for <stage>`。有是舊，沒有、換成一般站規則是新。
   - brief：SendMessage 給 brain，讓它重新觸發 SubagentStart；brief 開頭是 `you are the stage agent for` 是舊，`you are a subagent of` 是新。
   - gate：brain 交回後問 gate；出現 `fankeel: the gate in <handoff> cannot be asked`（`hooks/gate.js:252`）或照常驗過是舊，出現 `fankeel: gate not confirmed`（`hooks/gate.js:234`）是新。
   - resume：回答後 `.fankeel/build/<task>/<stage>-answer.md` 有寫出是舊，沒寫是新。
   - guard：controller 自己 Edit 一個檔，被擋下 `is a controlled stage`（`hooks/guard.js:159`）是舊，放行是新；再派一次 `fankeel:fankeel-brain`，被擋下 `is not on stage.agents`（`hooks/guard.js:186`）是新。
4. `node scripts/task.js profile set stage.agents survey --project` 還原，把五項結果寫進 `docs/90-agent/reference/subagents.md` 的「The profile moves under a running stage」一節，然後關閉本條。
```

3. 跑 `node scripts/todo-check.js`，exit 0。
4. Commit：`docs: stage-agents-5 gets its probe steps`。

## Task 3: 兩條解除改 ready

**Files:**
- Modify: `docs/90-agent/todo/pane-8.md` — frontmatter 改 ready
- Modify: `docs/90-agent/todo/stage-agents-16.md` — frontmatter 改 ready，檔尾加 10-16 段落

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus one check.

1. 跑 `node scripts/todo.js list | grep -E "pane-8|stage-agents-16"`，兩條都在 blocked。
2. Write：`docs/90-agent/todo/pane-8.md` 的 frontmatter，把 `state: blocked` 改成 `state: ready`，刪掉 `group:`、`timing:`、`stamp:` 三行。改完的 frontmatter：

In `docs/90-agent/todo/pane-8.md`, the frontmatter becomes:

```md
---
label: pane
title: Desktop 看路線圓點呼吸
description: 發 0.111.0 後在真正的 Claude Desktop 上看 band 與 Pane 的路線圓點有沒有擴散的圈、重畫會不會跳 — [hooks/pane-svg.ts](hooks/pane-svg.ts).
state: ready
link: hooks/pane-svg.ts
---
```

   並在檔尾空一行後加：

In `docs/90-agent/todo/pane-8.md`, append:

```md
2026-10-16 盤點：`~/.claude/plugins/cache/fankeel/fankeel/` 已有 0.111.0、0.111.1、0.111.2，installed_plugins.json 記 0.111.2（10-15 更新），after 條件已滿足，改標 ready。注意：band 與 Pane 要 mod 載入才會畫，Desktop 外掛頁沒有 Enable for this session（見「實測安裝版 mod 啟動就載入」），所以先在終端 `claude` 的 `/plugin` 按 Enable 再看。
```

3. Write：`docs/90-agent/todo/stage-agents-16.md` 的 frontmatter，`state: blocked` 改 `state: ready`，刪掉 `group:`、`timing:`、`stamp:` 三行；其餘欄位不動。檔尾空一行後加：

In `docs/90-agent/todo/stage-agents-16.md`, append:

```md
2026-10-16 盤點：`scripts/ctx.js` 量到 `C:/Users/user/.claude/projects/F--ymlab-fankeel/8846548c-26e8-4b4a-a6cd-c8d649c9de33/subagents/agent-a45b1252f91424483.jsonl`（10-09，「擴大 Haiku 角色測試與飄移」的 plan 站 brain）turn peak 439,419，過了 `lib/context.js` 的 400k 線。原條件只看 build 或 verify 的站 agent；使用者在 10-16 的 design gate 決定改為任一站 agent 過 400k 即算，因此改標 ready。另有 338,010（5045b7f4…/agent-acbe2b924f5b29f45.jsonl，站別未查）與 313,597（同一個 8846548c 的 plan 站）。完成條件的後半——一份真實 plan 經新函式產出的 script 能跑完、測試先紅後綠——不變。
```

4. 跑 `node scripts/todo.js list | grep -E "pane-8|stage-agents-16"`，兩條都在 ready；跑 `node scripts/todo-check.js`，exit 0。
5. Commit：`docs: pane-8 and stage-agents-16 move to ready`。

## Task 4: 兩條 Blocked 記 10-16 查證

**Files:**
- Modify: `docs/90-agent/todo/model-4.md` — stamp 改 2026-10-16，檔尾加段落
- Modify: `docs/90-agent/todo/security-1.md` — stamp 改 2026-10-16，檔尾加段落

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus one check.

1. 兩個檔的 frontmatter 都把 `stamp: 2026-10-15` 改成 `stamp: 2026-10-16`；其餘欄位不動。
2. Write：

In `docs/90-agent/todo/model-4.md`, append:

```md
2026-10-16 的盤點重讀 https://code.claude.com/docs/en/fast-mode：仍寫明不支援 Sonnet 與 Haiku，只支援 Opus 5.5、Opus 5 與 Opus 4.8；仍是 `/fast` 或 `fastMode` 的整個 session 開關，頁面沒有依 agent 設定的欄位。條件未滿足，維持 blocked。
```

In `docs/90-agent/todo/security-1.md`, append:

```md
2026-10-16 盤點：查了 `F:/ymlab/sec-test`（README 自稱 ai-code-security，判斷就是 AI CODING SECURITY 專案）：最後一次 commit 是 2026-09-02，README、TODO.md、docs/ 與 ai-code-security/SKILL.md 都沒有定案的共用漏洞清單或掃描模型，它的 TODO.md 仍有 Needs a decision 的項目。沒查的：GitHub 上的 FanFantom9452/AI-Coding-Security 與 sec-test 的其他分支。條件未滿足，維持 blocked。
```

3. 跑 `node scripts/todo-check.js`，exit 0。
4. Commit：`docs: model-4 and security-1 rechecked 10-16`。

## Coverage

| promise | task |
|---|---|
| 「子代理 brief 改走 spawn」加「探測步驟」一節：重用 10-03 probe、Enable、派三個子代理、看 transcript 第 1 行、試 session.append、寫回結果。 | Task 1 |
| 「接縫『profile 中途翻轉』」加「探測步驟」一節：stage.agents=all 起站、站頁 context 步驟翻成 false、逐 hook 看新舊、還原並寫進 subagents.md。 | Task 2 |
| 「Desktop 看路線圓點呼吸」改 ready：0.111.2 已裝，after 條件已滿足。 | Task 3 |
| 「brain 的 context 撐不住」改 ready：使用者 10-16 決定條件改為任一站，10-09 的 plan 站 brain 量到 439,419。 | Task 3 |
| 「fast 可依 agent 設定」記 10-16 重讀官方說明 | Task 4 |
| 「AI CODING SECURITY 定案」記 10-16 查了 F:/ymlab/sec-test | Task 4 |
| `node scripts/todo.js list` 把兩條解除的列在 ready | Task 3 |
| `node scripts/todo-check.js` | Task 1, Task 2, Task 3, Task 4 |
