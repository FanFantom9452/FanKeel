---
status: current
last_verified: 2026-10-04
source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新；資料是五個已收尾受控 task 的 transcript 與 handoff
---

# 受控站實跑量測：stage.agents 設全部站時，各站 context、接縫與提交（n=5 個 task）

## 判定

五個 task 的實跑看到：主控每站 context 的量級是「進第一站前約 70k、build 一站增 13k 到 143k、其餘站各增 8k 到 41k」，brain 自己的峰值多半在 33k 到 100k，只有 plan 站的 brain 到 167k。「站 agent 做不到的事」四件裡，同意題、TODO 行都是交給主控（或根本沒發生），worktree 由 brain 派 implementer 時照做，續用同一個 implementer 在九個 build brain 裡出現一次。記帳三題有答案：續用的 agent 一次派工一則 notification（24 個裡 21 個吻合，3 個少一則）、續用不會把 brief 再注入 agent 的 context、transcript 留的標題是派工時的題目。提交都落在主工作樹的 main；project 不是 cwd 的情形在這個 repo 沒有出現過，沒測到。mutation 的專屬 agent 在 commit 7354957538b3f002b31316cf85ea9b008a492e5e 已拆，實跑過 7 次、其中 5 次在這五個 task 內，還原證據都在。沒有受控與非受控的對照，所以「build 兩回合提交省不省 context」只能給出每次提交的增量，判不了省不省。

由這份量測可以收的條目：stage-agents-1（各站 context 已量）、-3（四件事各有記錄）、-6（三題有答案）、-9（已拆、實跑過）；-2 的跨輪對話只看到一次執行中的插話，gate 選 option one 以外再回頭找 design brain 這一種沒出現；-8 的「project 不是 cwd」沒測到；-4、-5、-7 要刻意製造情境，見最後一節。

## 資料

五個 task，`stage.agents` 設全部站。session 與 task 目錄的對應由開始時間與任務名推得（task 目錄名的時間是 UTC）。brain 數是 `agentType` 為 `fankeel:fankeel-brain` 的 meta 檔數；`session bc46cf1c-3fdc-4f2a-96e3-ae600e27ccf3` 另有一個只剩 58 位元組 meta（`stoppedByUser`、沒有 transcript）的 brain，不計入峰值表，它的 agent id 與 `session 6e131cdb-79f2-422b-bb7d-e815f9c5b759` 的一個 verify brain 相同，原因不明。

| session | task 目錄 | brain 數 |
|---|---|---|
| session bc46cf1c-3fdc-4f2a-96e3-ae600e27ccf3 | task-20261004T094519 | 11（10 個有 transcript） |
| session 6e131cdb-79f2-422b-bb7d-e815f9c5b759 | task-20261004T080357 | 10 |
| session 180f8da4-5021-4358-8e91-ca7d3e3b3331 | task-20261003T121202 | 9 |
| session 099dfc40-dff8-4cb4-82a9-f4b0599e58dc | task-20261003T114747 | 12 |
| session e22c11b3-34c0-4712-9761-ad692b11c8fe | task-20261003T112433 | 5 |

`node scripts/ctx.js --by-stage` 與下面所有數字都由這一輪的指令輸出照抄。五個 task 不是每個都走過全部七站：`session 180f8da4` 沒有 design 站，`session e22c11b3` 沒有 plan 站。

## 各站 context

主控每站的 context 起訖（`ctx.js --by-stage`，略去 transcript 路徑那一行與 `each turn:` 行）：

```text
session bc46cf1c
  turns 133   peak 343,147 (turn 133)   last 343,147
  at 11 gates: 74,767 84,254 98,053 109,972 256,350 270,924 285,583 299,171 313,110 327,202 341,076
  subagents 27   tokens 11,742,166
  by stage (woken: a subagent's return since the last request, and no tool result):
    (before)  turns   4   woken  0   gates  1   context 71,208 → 76,892   re-read 295,550
    survey    turns   6   woken  1   gates  1   context 78,034 → 87,389   re-read 488,069
    design    turns  12   woken  2   gates  1   context 88,476 → 102,166   re-read 1,120,366
    plan      turns  10   woken  1   gates  1   context 103,147 → 114,158   re-read 1,067,117
    build     turns  65   woken  6   gates  1   context 115,610 → 258,229   re-read 11,594,745
    verify    turns   6   woken  1   gates  1   context 259,092 → 273,062   re-read 1,588,228
    audit     turns  16   woken  3   gates  3   context 273,908 → 314,984   re-read 4,680,466
    land      turns  14   woken  2   gates  2   context 315,821 → 343,147   re-read 4,613,697
```

```text
session 6e131cdb
  turns 109   peak 214,057 (turn 109)   last 214,057
  at 11 gates: 73,363 82,388 90,380 109,228 128,226 134,620 145,314 159,738 168,081 177,040 185,999
  subagents 17   tokens 5,403,131
  by stage (woken: a subagent's return since the last request, and no tool result):
    (before)  turns   3   woken  0   gates  1   context 69,726 → 75,268   re-read 218,357
    survey    turns   7   woken  1   gates  1   context 76,470 → 84,966   re-read 558,537
    design    turns   6   woken  1   gates  1   context 86,263 → 94,443   re-read 534,084
    plan      turns  13   woken  2   gates  1   context 95,422 → 111,151   re-read 1,326,045
    build     turns  16   woken  3   gates  1   context 112,126 → 129,865   re-read 1,909,431
    verify    turns  13   woken  2   gates  2   context 130,705 → 146,954   re-read 1,795,015
    build     turns  13   woken  3   gates  1   context 148,179 → 161,339   re-read 1,992,308
    verify    turns   6   woken  1   gates  1   context 162,184 → 170,092   re-read 990,925
    audit     turns   6   woken  1   gates  1   context 170,936 → 178,580   re-read 1,043,377
    land      turns  26   woken  3   gates  1   context 179,529 → 214,057   re-read 5,128,694
```

```text
session 180f8da4
  turns 93   peak 240,907 (turn 93)   last 240,907
  at 11 gates: 73,358 87,311 106,689 151,777 159,778 177,063 197,447 208,931 222,158 232,521 238,385
  subagents 33   tokens 16,966,443
  by stage (woken: a subagent's return since the last request, and no tool result):
    (before)  turns   4   woken  0   gates  1   context 71,398 → 77,189   re-read 298,713
    survey    turns   7   woken  1   gates  1   context 78,320 → 93,096   re-read 580,791
    plan      turns  13   woken  2   gates  1   context 95,089 → 108,781   re-read 1,311,310
    build     turns  27   woken  6   gates  1   context 109,737 → 154,037   re-read 3,530,164
    verify    turns   5   woken  1   gates  1   context 154,859 → 164,227   re-read 792,635
    build     turns  15   woken  3   gates  2   context 165,300 → 199,812   re-read 2,704,349
    verify    turns   6   woken  1   gates  1   context 200,636 → 211,237   re-read 1,234,331
    land      turns  16   woken  2   gates  3   context 212,275 → 240,907   re-read 3,636,383
```

```text
session 099dfc40
  turns 183   peak 341,672 (turn 183)   last 341,672
  at 17 gates: 73,557 83,946 96,203 119,421 130,251 156,611 167,768 196,435 216,003 226,782 245,057 268,152 278,125 287,675 298,932 314,906 327,321
  subagents 43   tokens 23,096,255
  by stage (woken: a subagent's return since the last request, and no tool result):
    (before)  turns   4   woken  0   gates  1   context 71,810 → 76,293   re-read 297,212
    survey    turns   7   woken  1   gates  1   context 77,682 → 86,943   re-read 568,396
    design    turns   7   woken  1   gates  1   context 89,138 → 98,345   re-read 648,434
    build     turns  22   woken  4   gates  1   context 99,311 → 121,647   re-read 2,401,840
    verify    turns   7   woken  1   gates  1   context 122,482 → 134,994   re-read 887,603
    build     turns  17   woken  4   gates  1   context 136,882 → 158,945   re-read 2,488,974
    verify    turns   7   woken  1   gates  1   context 159,784 → 169,460   re-read 1,144,779
    build     turns  31   woken  7   gates  2   context 170,594 → 217,939   re-read 5,948,228
    verify    turns   7   woken  1   gates  1   context 218,970 → 228,951   re-read 1,561,157
    build     turns  35   woken  9   gates  3   context 229,953 → 280,311   re-read 8,856,115
    verify    turns  21   woken  2   gates  3   context 281,149 → 317,643   re-read 6,254,565
    land      turns  18   woken  1   gates  1   context 318,592 → 341,672   re-read 5,975,348
```

```text
session e22c11b3
  turns 58   peak 153,621 (turn 58)   last 153,621
  at 7 gates: 73,524 84,814 92,649 120,098 129,195 140,928 150,389
  subagents 15   tokens 5,533,643
  by stage (woken: a subagent's return since the last request, and no tool result):
    (before)  turns   4   woken  0   gates  1   context 71,873 → 76,848   re-read 298,238
    survey    turns   7   woken  1   gates  1   context 78,138 → 87,609   re-read 570,227
    design    turns   6   woken  1   gates  1   context 88,509 → 96,620   re-read 547,113
    build     turns  21   woken  5   gates  1   context 97,611 → 122,053   re-read 2,268,757
    verify    turns   6   woken  1   gates  1   context 122,869 → 130,871   re-read 755,570
    land      turns  14   woken  2   gates  2   context 131,783 → 153,621   re-read 1,986,158
```

每個 brain 自己的峰值（`ctx.js <agent 檔>` 的第二行；brain 的 `description` 是派工時的題目）：

| session | brain | 峰值 |
|---|---|---|
| session bc46cf1c | opus 5.5 · medium: plan stage agent | peak 121,454 (turn 28) |
| session bc46cf1c | sonnet 5.5 · medium: build close stage agent | peak 62,216 (turn 21) |
| session bc46cf1c | sonnet 5.5 · medium: survey stage agent | peak 60,601 (turn 8) |
| session bc46cf1c | sonnet 5.5 · medium: audit stage agent | peak 63,928 (turn 19) |
| session bc46cf1c | sonnet 5.5 · medium: verify stage agent | peak 46,005 (turn 12) |
| session bc46cf1c | sonnet 5.5 · medium: build group 3 stage agent | peak 58,355 (turn 13) |
| session bc46cf1c | sonnet 5.5 · medium: build group 4 stage agent | peak 58,722 (turn 15) |
| session bc46cf1c | opus 5.5 · medium: design stage agent | peak 53,371 (turn 11) |
| session bc46cf1c | sonnet 5.5 · medium: build group 1 stage agent | peak 73,323 (turn 14) |
| session bc46cf1c | sonnet 5.5 · medium: land stage agent | peak 53,968 (turn 24) |
| session 6e131cdb | sonnet 5.5 · medium: build close | peak 33,552 (turn 6) |
| session 6e131cdb | sonnet 5.5 · medium: land stage agent | peak 45,482 (turn 18) |
| session 6e131cdb | sonnet 5.5 · medium: verify stage agent | peak 43,850 (turn 12) |
| session 6e131cdb | sonnet 5.5 · medium: survey stage agent | peak 40,398 (turn 9) |
| session 6e131cdb | sonnet 5.5 · medium: verify stage agent | peak 36,149 (turn 5) |
| session 6e131cdb | sonnet 5.5 · medium: build group 1 | peak 57,196 (turn 13) |
| session 6e131cdb | sonnet 5.5 · medium: audit stage agent | peak 39,962 (turn 5) |
| session 6e131cdb | opus 5.5 · medium: plan stage agent | peak 76,989 (turn 26) |
| session 6e131cdb | opus · medium: design stage agent | peak 36,985 (turn 6) |
| session 6e131cdb | sonnet 5.5 · medium: build stage agent | peak 33,056 (turn 10) |
| session 180f8da4 | opus 5.5 · medium: plan stage agent | peak 167,394 (turn 52) |
| session 180f8da4 | sonnet 5.5 · medium: land stage agent | peak 61,058 (turn 22) |
| session 180f8da4 | sonnet 5.5 · medium: build close stage agent | peak 60,427 (turn 13) |
| session 180f8da4 | sonnet 5.5 · medium: verify stage agent | peak 44,890 (turn 11) |
| session 180f8da4 | sonnet 5.5 · medium: survey stage agent | peak 64,741 (turn 10) |
| session 180f8da4 | sonnet 5.5 · medium: build group 1 rework stage agent | peak 59,644 (turn 13) |
| session 180f8da4 | sonnet 5.5 · medium: build close stage agent | peak 61,298 (turn 13) |
| session 180f8da4 | sonnet 5.5 · medium: build group 2 stage agent | peak 64,270 (turn 18) |
| session 180f8da4 | sonnet 5.5 · medium: build group 1 stage agent | peak 102,286 (turn 34) |
| session 180f8da4 | sonnet 5.5 · medium: verify stage agent | peak 43,052 (turn 8) |
| session 099dfc40 | sonnet 5.5 · medium: build stage agent | peak 79,909 (turn 34) |
| session 099dfc40 | sonnet 5.5 · medium: verify stage agent, round 4b | peak 80,589 (turn 38) |
| session 099dfc40 | sonnet 5.5 · medium: verify stage agent | peak 50,536 (turn 14) |
| session 099dfc40 | sonnet 5.5 · medium: build stage agent, round 4 | peak 86,910 (turn 42) |
| session 099dfc40 | sonnet 5.5 · medium: survey stage agent | peak 50,924 (turn 8) |
| session 099dfc40 | sonnet 5.5 · medium: verify stage agent, round 2 | peak 43,775 (turn 13) |
| session 099dfc40 | sonnet 5.5 · medium: verify stage agent, round 3 | peak 57,164 (turn 12) |
| session 099dfc40 | opus 5.5 · medium: design stage agent | peak 49,282 (turn 11) |
| session 099dfc40 | sonnet 5.5 · medium: land stage agent | peak 40,484 (turn 6) |
| session 099dfc40 | sonnet 5.5 · medium: build stage agent, round 3 | peak 82,512 (turn 37) |
| session 099dfc40 | sonnet 5.5 · medium: build stage agent, round 2 | peak 75,582 (turn 21) |
| session 099dfc40 | sonnet 5.5 · medium: verify stage agent, round 4 | peak 47,484 (turn 12) |
| session e22c11b3 | sonnet 5.5 · medium: build stage agent | peak 67,445 (turn 22) |
| session e22c11b3 | sonnet 5.5 · medium: survey stage agent | peak 54,246 (turn 9) |
| session e22c11b3 | sonnet 5.5 · medium: verify stage agent | peak 45,730 (turn 12) |
| session e22c11b3 | sonnet 5.5 · medium: land stage agent | peak 64,038 (turn 32) |
| session e22c11b3 | opus 5.5 · medium: design stage agent | peak 42,056 (turn 10) |

上表只抄每個 brain 的 `peak` 那一欄；`session bc46cf1c` 另有一個沒有 transcript 的 brain 不在表內。

主控在進第一站（survey）前就已在 69,726 到 71,873，之後每站只增：survey 約 8k 到 15k，design、plan 約 8k 到 16k；build 一站從 13,160（`session 6e131cdb` 第二次）到 50,358（`session 099dfc40` 第四次），`session bc46cf1c` 的 build 只有一站，增了 142,619。build 是最大的一站的有四個 task，`session 6e131cdb` 最大的是 land 的 34,528。brain 自己的峰值最大在 plan（167,394、121,454、76,989），其次是 build 的 102,286；其餘各站都在 33k 到 87k。

## design 跨輪與 build 的兩回合提交

design 跨輪：有 `design-answer.md` 的四個 task（`session bc46cf1c`、`session 6e131cdb`、`session 099dfc40`、`session e22c11b3`）每個的 gate 都選了 option one（進 plan 或 build），主控在 design 站沒有再 SendMessage 回 design brain 要它改。只有 `session bc46cf1c` 的主控 SendMessage 給過 design brain 一次（summary 是 `relay commit.js output to design agent`，內容是 `99d3fc85…..a75043dd…` 的提交範圍）：那時 brain 還在跑，transcript 裡它收到的是 `The coordinator sent a message while you were working`，16 秒後 brain 交回 `design.md`。所以「brain 在跑時主控插話、brain 吸收後照常交回」通；「gate 選 option one 以外，主控 SendMessage 已交回的 design brain 再來一輪、brain 再交回路徑」沒有出現過，沒測到。`ctx.js --by-stage` 的 design 列 `woken` 是 2、1、1、1（依上面的 session 順序）；那個 2 與插話是否有關，我沒有查證。

build 每次提交主控增多少 context：用上面 build 各站起訖相減，除以那個 task 的 `build-*commit*.md` 數（`ls` 的輸出：`session bc46cf1c` 5 份、`session 6e131cdb` 2 份、`session 180f8da4` 3 份、`session 099dfc40` 10 份、`session e22c11b3` 1 份）。

| session | build 各站增量加總 | 提交檔數 | 每次提交主控約增 |
|---|---|---|---|
| session bc46cf1c | 142,619 | 5 | 28,523 token |
| session 6e131cdb | 30,899 | 2 | 15,449 token |
| session 180f8da4 | 78,812 | 3 | 26,270 token |
| session 099dfc40 | 142,102 | 10 | 14,210 token |
| session e22c11b3 | 24,442 | 1 | 24,442 token |

這是上限，不是提交本身的成本：build 站的增量還包含 brain 的交回、gate、使用者那一步與主控讀 handoff。沒有同一批工作在非受控下的對照，所以「兩回合提交省不省 context」判不了：能說的只是每次提交主控約增 14k 到 29k token，brain 自己的 context 沒有進主控。

## 站 agent 做不到的事

取 `session bc46cf1c` 與 `session 180f8da4` 的每個 build brain（共 9 個：前者 4 個、後者 5 個）。`isolation` 次數每次 Agent 派工寫兩次（tool_use 與它的回聲），所以 2 次是一個 implementer。

| 事 | 做了／沒做 | 依據 |
|---|---|---|
| 開工前先問同意 | 沒做（brain）；設計上交給主控，plan gate 兼任 | 9 個 brain 的 `AskUserQuestion` 次數全是 0。`build-answer.md` 在兩個 task 都是 build 收尾的 gate（進入驗證／收尾），不是開工前的同意題。開工前主控在 plan gate 問了「可以開始 build 嗎」（`session bc46cf1c`：「mod 探測第四輪的四個 task 已排好 … 可以開始 build 嗎？」；`session 180f8da4`：「六個 task 的計畫要照這樣進 build 嗎？」）。沒有單獨一題「要不要在 main 上 build」。 |
| 開 worktree | 做了 | 7 個有派 implementer 的 brain 的 `isolation` 次數是 2、2、2、2、2、6、12（即 1、1、1、1、1、3、6 個 implementer）；兩個 build close brain 是 0（它們不派 implementer）。`session bc46cf1c` 的 5 個 build 提交都落在 main，沒有留下 worktree；`session 180f8da4` 見「在哪提交」。 |
| 加 TODO 行 | 沒做；本來要的 `TODO.md` 已不存在 | `git log --format='%h %s' 0601153e^..6f05aaf5 -- docs/90-agent/todo` 沒有輸出（`session bc46cf1c` 的 build 提交範圍裡沒有動 TODO）。`session 180f8da4` 的 build 提交裡只有 `commit 6e71cc0c`（close mod-1、spend-1 改 ready）動了 `docs/90-agent/todo/`，那是計畫排定的 task，不是 brain 自己加一行。條目現在由 `node scripts/todo.js new` 開，brain 有 Bash，沒有被禁；skill 與 `subagents.md` 的字眼還寫 `TODO.md`；簡報有沒有要 brain 加 TODO 行，我沒有查。 |
| 續用同一個 implementer | 做了一次（9 個 brain 中的 1 個） | 8 個 brain 的 `SendMessage` 次數是 0；`session 180f8da4` 的 build group 2 brain 是 1，對象是它自己的 implementer `a16fb22e2e988248d`，內容是「Ruling … close mod-1 with --sha」，那個 worktree 至今還在（見下）。`agents/fankeel-brain.md` 的 `tools` 列的是 `Read, Grep, Glob, Bash, Write, Agent`，沒列 SendMessage，而 transcript 裡它呼叫成功了，所以 `subagents.md` 寫的「It has no `SendMessage`」與實跑不符。九個 brain 只有一個需要續用，其餘不是沒有修正輪就是另派新 brain（`build group 1 rework`），沒看到「該續用而做不到」。 |

沒做的三件裡，同意題與 TODO 行是設計上交給主控（或不需要），沒有查到因此出錯的實例；續用 implementer 是能做，只是 `subagents.md` 的描述過時，這由 Task 12 改寫接縫一節處理。

## 記帳

對五個 session 主控 transcript 裡每個被 SendMessage 的 agent（共 24 個），數它收到的 `enqueue` 型 task-notification（主控 transcript 裡同一則 notification 寫五行，所以不能直接數 `<task-id>` 出現次數）、它自己 transcript 裡 brief 以 `hook_additional_context` 注入的次數、以及 `SubagentStart` hook 的執行紀錄數：

```text
bc46cf1c a068d49614631505d sendmsg=1 notifications=1 brief_context=1 subagentstart_runs=2
bc46cf1c a07459f0ef6b61807 sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=4
bc46cf1c a50e8f404eb631268 sendmsg=2 notifications=3 brief_context=1 subagentstart_runs=6
bc46cf1c aad473205a7f48ab4 sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=4
bc46cf1c ac3b54323bb46f1f7 sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=4
bc46cf1c acb877892e5ffcf06 sendmsg=1 notifications=1 brief_context=1 subagentstart_runs=1
bc46cf1c afd0f232ef99b2443 sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=4
bc46cf1c afe0622eb9ac55f85 sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=6
6e131cdb a40b698269756bc9e sendmsg=2 notifications=3 brief_context=1 subagentstart_runs=5
6e131cdb a44b7856677026eca sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=3
6e131cdb a743920ab79dd7531 sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=4
6e131cdb ad5d2b3fa75dc345d sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=3
6e131cdb af5568e18aa86b330 sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=3
180f8da4 a020bbca7daa8ef8e sendmsg=1 notifications=1 brief_context=1 subagentstart_runs=2
180f8da4 a274b6d8c3c6f2a83 sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=4
180f8da4 ab660fd5e7f1f2095 sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=5
180f8da4 ae480f5260f18ada3 sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=5
180f8da4 ae498e7be9cf1ee3d sendmsg=2 notifications=3 brief_context=1 subagentstart_runs=11
099dfc40 a1989aeea9ff186fa sendmsg=2 notifications=3 brief_context=1 subagentstart_runs=10
099dfc40 a5857f85af6c06d1c sendmsg=5 notifications=6 brief_context=1 subagentstart_runs=10
099dfc40 ae3a92af4d460775a sendmsg=4 notifications=5 brief_context=1 subagentstart_runs=11
099dfc40 af3e65940310d3034 sendmsg=2 notifications=3 brief_context=1 subagentstart_runs=5
e22c11b3 a48319a4ff33a990b sendmsg=2 notifications=3 brief_context=1 subagentstart_runs=6
e22c11b3 ab11bc04145a9e7e1 sendmsg=1 notifications=2 brief_context=1 subagentstart_runs=4
```

- 續用的 agent 是否一次派工一則 notification：是，24 個裡 21 個的 notification 數等於 SendMessage 次數加一（原派工一則、每次續用一則）。3 個例外是 `session bc46cf1c` 的 design 與 plan brain、`session 180f8da4` 的 plan brain，各 SendMessage 一次、只有一則 notification。design 那個已確認是插話落在 brain 還在跑的時候（見上一節），沒有第二次派工所以沒有第二則；兩個 plan brain 我沒有逐一查是不是同一種情形。
- 續用會不會重發 brief：對 agent 的 context 不會。24 個 agent 的 `hook_additional_context` 都剛好 1 次（開頭那次）。`SubagentStart` hook 本身在 transcript 裡執行了 1 到 11 次，次數比 SendMessage 多；多出來的是否來自這個 brain 又派出去的 implementer，我沒有查證。
- transcript 留的標題：是派工時的題目，不是佔位字。24 個 agent 的 meta `description` 都是派工時的題目，例如 `sonnet 5.5 · medium: build stage agent, round 4`、`sonnet 5.5 · medium: land stage agent`；SendMessage 的 `summary` 不進 meta。

## 在哪提交

`git log --format='%h %an %s' 0601153e^..6f05aaf5`（`session bc46cf1c` 的 build 提交範圍）列出 5 個提交，全部在 main，作者都是 FanFantom9452：`commit 6f05aaf5`、`commit 75edc2d4`、`commit 44b99525`、`commit a66ad590`、`commit 0601153e`。這個 task 的 build 提交沒有留下 worktree：它的 handoff 記的 worktree `agent-a057ef8684d126b0e` 不在 `git worktree list`。

`git worktree list` 另有 4 個 `.claude/worktrees/agent-*` 是 `session 180f8da4` 的 implementer（由 `subagents/agent-<id>.meta.json` 所在的 session 對得出）：`agent-a16fb22e2e988248d`（HEAD 是 `commit e2509faa`）、`agent-a8dafb86a7313462c`（`commit e2509faa`）、`agent-aa7a9fe8be5e2a068`（`commit 96db2dad`）、`agent-ab6cce974278788a3`（`commit 6e71cc0c`）。`git branch --merged main | grep -i worktree` 都列了它們：每個分支的 HEAD 就是 main 上已有的一個提交，裡面沒有未併入的東西。`commit.js` 本該移除它們，留下就是發現；這四個沒有出現在那個 task 的任何 `*-commit.done.md`（那些檔只記了兩個已移除的 worktree），為什麼沒被移除，從現有紀錄看不出來。另外 3 個 worktree 屬於正在跑的 `session 106c6f2b-ec35-4261-9bfe-0a40eba1459d`，不是留下的。

`grep -n "cwd\|project" scripts/commit.js` 只有 `main(argv, cwd)` 與以 `cwd` 跑 `git rev-parse --show-toplevel` 的幾行，沒有讀 task 的 `project`；`commit.js` 依控制者的工作目錄提交。這個 registry 的 task `project` 一律等於工作目錄（計畫的說法，這份報告沒有另外查 registry），所以「task 的 `project` 不是 cwd」這一種在本 repo 沒有出現過，沒測到。

## mutation 要不要專屬 agent

`git log --diff-filter=A --format='%h %ad %s' --date=short -- agents/fankeel-mutator.md` 的輸出是 `73549575 2026-10-02 feat: add fankeel-mutator and fankeel-mover agents`，完整 sha 是 7354957538b3f002b31316cf85ea9b008a492e5e。`fankeel-mutator` 的 frontmatter 是 `tools: [Read, Edit, Bash]`、`model: sonnet`、`effort: low`；`fankeel-brain` 是 `tools: [Read, Grep, Glob, Bash, Write, Agent]`、`effort: medium`，所以工具、effort 都與 brain 不同，符合 stage-agents-9 的拆的條件。

實跑：`grep -l '"agentType":"fankeel:fankeel-mutator"'` 在所有 session 的 subagents 找到 7 個 meta：`session 099dfc40` 3 個、`session 180f8da4` 1 個、`session e22c11b3` 1 個（五個 task 內共 5 個），另有 `session 5cd1d1c5-716d-4bb8-85af-d2ff9d354f0c` 2 個（不在這五個之內）。`session bc46cf1c` 與 `session 6e131cdb` 的 verify 沒有 mutator，為什麼沒有，這份報告沒有查。

還原證據，各取一個 transcript，`grep -o 'diff --stat[^"]*' <file> | tail -1`：

```text
session 099dfc40 agent-a072881684732cfbe (sonnet 5.5 · low: Mutate quotaWeek project check)
diff --stat unchanged (printed nothing before and after)\nchanged: F:/ymlab/fankeel/assets/station/station.js:60 (`=== 'project'` to `!== 'project'`, then put back)
session e22c11b3 agent-a64231c239685cc14 (sonnet 5.5 · low: Mutate otherLine from-check)
diff --stat unchanged (printed nothing before and after)\nchanged: F:/ymlab/fankeel/lib/render.js:74
session 180f8da4 agent-a9f8a293e5bcb831c (sonnet 5.5 · low: Mutate envSession to null)
diff --stat lib/live.js printed nothing, same as the pre-mutation run (the file had no uncommitted changes)\nAfter restore, rerun: ℹ pass 53 ℹ fail 0
```

結論：已拆、實跑過、還原證據在。stage-agents-9 可關。

## 實跑觀察（使用者親手）

（由這個 task 的使用者親手 task 補上：第二個 agent、profile 中途翻轉、claims。）
