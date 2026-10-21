---
judged: 2026-10-21T04:17:48.155Z
model: fable
agent: fankeel-judge
task: "分析 PLAN 站為何寫很久，評估 brain 派多個 agent 平行寫 plan"
session: 4907a1ed-c140-4a6b-a2d9-debc550d17d0
stage: survey
---

# Brief — why does the plan stage take 40+ minutes, and would one brain + parallel plan writers be faster?

## Question

# Brief — why does the plan stage take 40+ minutes, and would one brain + parallel plan writers be faster?

## The question

The user asks (verbatim, Traditional Chinese): 「幫我分析看看那些長任務 為甚麼這麼多 PLAN 階段可以寫這麼久? 是中間 TOOL CALLING 還是怎麼樣嗎? 如果今天 SPEC 有定義好 那寫 PLAN 不是很快嗎? 然後 PROFILE 再新增一個好了 你先幫我評估 因為現在 FAST MODE 要吃 API 額度 所以我們現在只能透過平行處理 因為我有看到那種 PLAN 寫了 40 多分鐘的 你先分析看看到底是哪部分難寫 如果今天 SPEC 切割的夠好 那我是不是可以改成 一個 BRAIN 然後派好幾個 AGENT 下去寫 PLAN 檔案 你覺得這樣有比較好嗎? 或是我們先做? 拿來測試效果? 先給我建議」

In English: across recent long tasks, where does the plan stage's wall clock actually go — model output (writing the plan's tokens), tool calls / reads, reviewer or reader dispatches, rewrites after lint/review, gate waits, the user being away? Given a well-cut spec, should plan become "one brain dispatches several agents that each write part of the plan file in parallel", and should that be a new profile key? Fast mode costs API credit, so speed has to come from parallelism, not a faster model. The user wants a recommendation first: do it now, run a trial first, or not worth it.

## Options to weigh

A. Plan time is dominated by something parallel writers would not fix (e.g. coverage/lint/reviewer loops, gate waits, user away, serial reads) — fix that instead; no new profile key.
B. Plan time is dominated by the single model generating a long plan file (many tasks × full code fences) — parallel part-writers under one brain would cut it; add a profile key (e.g. `plan.writers` / `plan.parallel`), default off, and trial it.
C. Middle path: move plan into `stage.agents` (brain in clean context) and/or have the brain split by the spec's file table into parts written in parallel only above some task count; trial on one or two tasks before shipping a key.
D. Some mix — name which dominates, with numbers.

## Background

- Profile today: `stage.agents survey,build,verify` — plan is NOT a stage agent, so plan runs in the main session's growing context. `dispatch.inflight 8`, `dispatch.floor sonnet`, `judge.model fable`, `compact.at 350000`.
- Plan stage rules: `skills/fankeel-plan/SKILL.md` (397 lines; sections: Global Constraints generated, file structure, task right-sizing, steps 2–5 min, every code fence names its file, no placeholders, "Coverage, then lint, then a reviewer — before the gate" at ~line 323) and `skills/fankeel-plan/rationale.md`.
- Plans land in `docs/90-agent/plans/*.md`; long plans have many tasks with full code.
- Registry entries `.fankeel/sessions/*.json` (414 files) carry `clock` (per-stage wall clock), `moves`, `waited` (gate wait).
- Session transcripts: `C:/Users/user/.claude/projects/F--ymlab-fankeel/*.jsonl` (131). Note `.fankeel/build/ask/measure-sessions.js` from an earlier judgement hard-codes `C:/Users/Owner/...` — wrong user dir on this machine; copy it and fix the path if used. `scripts/conversation.js` reads one transcript. Subagent transcripts are under `<session>/subagents/agent-<id>.jsonl`; `.fankeel/build/agents-<session>.json` holds per-agent start/ended stamps.
- A live session (66a6563a…) is at plan now and its build dir `.fankeel/build/task-20261021T024539/` already contains a `plan-part.md` and `relay-*.md` files — check whether some plan-splitting already exists in practice (grep of skills/agents/lib/scripts found no "plan-part" mechanism).
- Earlier judgement on build parallelism: `.fankeel/build/ask/14-plan-parallelism-answer.md` (found the parent's single-threaded loop, gate waits and serial suite dominate build — useful for method and comparison).
- Plan task grouping logic: `lib/plantasks.js`; `scripts/ledger.js --plan <plan> groups`.

## What to find out

1. For the longest recent plan stages (say the top 8–10 by plan clock), break wall clock into: gate wait (`waited`), assistant output time (long Write/Edit of the plan file — token counts of those tool inputs), tool calls (count and time of Read/Grep/Bash), subagent dispatches during plan (readers, reviewer) and their durations, rewrite cycles (how many times the plan file was rewritten/edited after lint or review), idle gaps (user away), compactions.
2. How large are these plans (lines, tasks, code fences) and does duration track size?
3. Whether the plan reviewer / lint loop is a major share.
4. Feasibility of parallel part-writers: what in a plan is cross-task (Global Constraints, file structure, Consumes:/interfaces, numbering) that a split must fix first; merge/lint cost; risk of inconsistency; API spend vs time saved.
5. Whether moving plan into `stage.agents` alone helps (clean context = faster generation, less cache churn).

## What counts as an answer

A pick among A–D, backed by a measurement table of real sessions (session id, plan clock, gate wait, output-writing share, tool-call share, subagent share, rewrites, plan size). Then a concrete recommendation: what to change, whether a profile key is warranted (name and default), and a trial design (which next task, what to measure, what result would mean adopt / drop).

## Answer shape

The judge's usual six fields with `pick:` first, then `## Summary` in Traditional Chinese (繁體中文).

## Answer

pick: D — 工作時間主要是「寫 plan 的模型本身」（主 session 思考＋輸出，或委派 writer 的讀碼＋300k relay），不是 tool call；但「一個 brain 派多個 writer」已在 4 場 session 實際用過，牆鐘沒贏（36–54 分 vs 主 session 單人 33–35 分）且 cacheRead 多 5–7 倍 → 現在不加 profile key；先修 relay 串接與 writer 讀碼下限，要試就照下面的 trial 做一次再決定
why: 主 session 單人寫：plan 檔輸出只 2–9 分（1835L/19T 的 Write 8.6 分），前面思考/讀 5–23 分，lint 迴圈 3–8 分，reviewer 1–3 分；淨 33–35 分
why: 40 分以上的工作時間全來自委派：單一 opus writer 23–55 分、撞 300k 後 relay 再來一次（cd62ad07 36m、8846548c 84m、66a6563a 45m 只寫完 4/15 task）
why: 已有的平行 part-writer（45487ab9 四份、9f451488 六份、94618e2b 六份、66a6563a 三份）每份 opus 仍要 10–41 分（中位 ~15）；父 session 等最慢那份＋merge lint 3–5 次＋reviewer 2–10 分
why: 另一大塊是 gate／閒置：1b483aed gate 61 分、5e181f59 閒置 64 分、8846548c 27 分、f0a58f35 離開 850 分 — 平行無解
why: 跨 task 元素（Global Constraints、檔案結構、Files/Consumes 簽名、≥3 task 同檔 lint、Coverage）全要 brain 先寫；lint/groups 只吃單一檔，拆了得先串回
would flip if: 一次 trial 顯示 brain 先寫 header＋介面表、writer 用 sonnet 且只拿 path:line 事實，≥8 task 的 plan 淨時間 ≤20 分且 cacheRead ≤2× 單人 → 加 `plan.writers`
would flip if: 使用者接受 sonnet 派工的 task 不放滿版 code（SKILL:194）— 那 plan 體積縮 2–3 倍，單人就快，更不需要 writer
unread: `scripts/ledger.js` 的 `lint` verb handler（R2 只開 `groups`）；`lib/conversation.js`；9e59e535／5e181f59 的 lint 到底報什麼（10–11 輪）沒看；46 場沒本機 transcript 的 plan session（186 場有 plan 時鐘，僅 48 場有 jsonl）只用 registry 數字
delegated: `skills/fankeel-plan/SKILL.md`＋`skills/fankeel-plan/rationale.md`（sonnet）；`lib/plantasks.js`＋`scripts/ledger.js`＋`docs/90-agent/plans/*.md`（sonnet）；`.fankeel/build/task-20261021T024539/*`＋66a6563a transcript/subagents＋`agents-66a6563a*.json`＋grep skills/agents/lib/scripts/hooks（sonnet）；`.fankeel/build/ask/14-plan-parallelism-answer.md`＋`measure-sessions.js`＋`scripts/conversation.js:1-80`（sonnet）；`agents/fankeel-brain.md`＋`lib/profile.js`＋`docs/01-guide/profile.md`＋`.fankeel/profile.json`＋`lib/stages.js`（sonnet）。Transcript 量測（14 場 plan 視窗）由我以 node 腳本跑，未派 reader
checklist: 1 registry 最長 plan 時鐘與 gate 份額 — answered（本人腳本）；2 SKILL.md 流程與跨 task 元素 — answered（R1）；3 rationale.md 單人理由 — answered：沒寫任何理由（R1）；4 plantasks/ledger/lint 與 plan 大小 — answered（R2）；5 live session plan-part 拆法 — answered（R3＋本人 grep）；6 判決 14＋measure-sessions.js＋conversation.js — answered：14 號只量 build，腳本不量時間（R4）；7 brain 能否跑 plan／key 放哪 — answered（R5）；8 top session transcript 分解 — answered（本人腳本 A/B/C）；9 plan 大小 vs 時長 — answered（Write payload 行數／task／fence）

## Summary

### 一、量測方法與限制

- 來源：`.fankeel/sessions/*.json` 的 `clock.plan=[start,end]`、`waited.plan`、`spend.plan`；對應 `C:/Users/user/.claude/projects/F--ymlab-fankeel/<id>.jsonl` 與 `<id>/subagents/agent-*.jsonl`。186 場有 plan 時鐘，但只有 48 場的 transcript 在這台機器（舊的在 `C:\Users\Owner`），所以排名取「有 transcript 的淨 plan 時間（plan−waited）前 14 名」。整體中位：plan 20.0 分、淨 14.3 分；淨超過 40 分的 25 場。
- 分解法：plan 視窗內每筆紀錄到前一筆的間隔，歸給結束它的那筆：assistant 紀錄 → 模型生成（含 Write plan 檔的紀錄另標 `gen:plan`）；tool_result → 依工具（AskUserQuestion=gate、Agent=前景 subagent、Bash、Read）；「Another Claude session sent a message」與 `<task-notification>` → 等背景 subagent（bgWait）；真人文字 → human；`<system-reminder>` → notify（閒置）；compact_boundary → compact。
- 限制：f0a58f35（1142 分，使用者離開 854 分、視窗混進 build 的 implementer）、65a1bc64（視窗混進 build brain）、77c02dd9（與 1b483aed 同一筆登記重複）三場排除。part-writer 的 subagent transcript 裡 output_tokens 明顯少記（958 行 plan 只記 721 tokens），所以 writer 用 span 不用 token；`planLines` 累加了同檔重寫。先前判決的 `.fankeel/build/ask/measure-sessions.js` 完全不量時間（R4：它沒讀 `timestamp`，只數字元與 stage 順序，`:6` 硬編 Owner 路徑），本次沒沿用。

### 二、量測表（單位：分鐘；淨 = plan 時鐘 − gate 等待）

| session | 任務 | plan | gate | 淨 | 寫 plan 檔輸出 | 其他生成（思考/讀） | bash/read | subagent 份額 | lint / edit | plan 大小 | 寫法 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 91cb51ef | 10-09 工作流評審 | 33 | 0 | 33 | 8.6（1 次 Write） | 23.2（thinking 78k tok） | 0.6 | reviewer 1.3 | 6 / 0 | 1835L／19T／47 fence | 主 session 一次寫（fable） |
| 9e59e535 | TODO 盤點 10-16 | 37 | 1.6 | 35 | 4.4（2 次 Write） | 17.0 | 4.9 | judge 3.5、reviewer 0.2 | 10 / 9 | 1032L／6T／61 fence | 主 session（opus） |
| 1b483aed | TODO 盤點 10-10 | 72 | 33 | 39 | 2.3 | 4.8 | 0.8 | reviewer 0.1 | 3 / 0 | 645L／5T／19 fence | 主 session（opus）；3 次 gate 合計 61.5 |
| 5e181f59 | suite lock | 89 | 7 | 83 | 2.1 | 7.3 | 1.5 | 7.2 | 11 / 8 | 515L／5T／14 fence | 主 session（opus）；閒置 64.1（system-reminder 前的空檔） |
| e2d126e8 | render reviewer | 36 | 0.5 | 36 | 0 | 1.0 | 0 | 34.6＝writer（implementer/opus）22.9＋reviewer 11.6 | 0 / 0 | 1163L／12T | 委派單一 writer（前景） |
| cd62ad07 | station gate 頁 | 39 | 0.7 | 38 | 0.1 | 1.3 | 0.1 | 36.1＝writer 19.8 → relay 14.4＋reviewer 2.0 | 2 / 3 | 1407L／6T | 委派單一 opus 背景＋relay |
| 8846548c | Haiku 角色 | 92 | 2.6 | 89 | 0 | 6.0 | 13.0 | bgWait 43＋human 27（「好了」）；plan brain 55 → relay 29＋reviewer 2.7 | 1 / 0 | 3051L／14T 再重寫 | plan 站 agent（brain opus xhigh）＋relay |
| 66a6563a（live） | station 遠端 | 59+ | 0 | 59+ | 0 | 1.4 | 0.1 | 57.1＝writer 23.1 → relay 21.6（只到 T4／1198L）→ 三份 part writer 15.6／14.0／12.7 | 0 / 0 | 規劃 15T，目前約 2960L | 單一委派、兩次 relay 後才拆三份 |
| 45487ab9 | TODO 盤點 10-19 | 54 | 1.8 | 52 | 0 | 7.4 | 0.8 | 43.8＝4 個 fragment writer（opus）33.5／27.0／41.1／27.6＋reviewer 6.0 | 5 / 0 | 4 份 fragment | 一開始就平行 4 份 |
| 9f451488 | TODO 盤點 10-20 | 37 | 1.6 | 36 | 0 | 6.4 | 0.7 | 28.1＝6 個 draft writer（opus）4.8–18.8（中位 ~13）＋reviewer 10.4 | 4 / 0 | ~18T，每份 944–1175L | 一開始就平行 6 份 |
| 94618e2b | TODO 盤點 10-19 第三輪 | 55 | 1.1 | 54 | 0.4 | 7.3 | 1.4 | bgWait 29.1＋gate 10.4＋judge 2.9；6 個 part writer 3.1–29.5 | 5 / 1（＋2 次 append） | 以 append 組裝 | 平行 6 份 |

`spend.plan`（registry）：主 session 單人 91cb51ef cacheRead 7.4M（sub 0.2M）、9e59e535 26.8M（sub 1.2M）；委派單一 e2d126e8 sub 23.1M、cd62ad07 sub 22.6M；平行 writer 45487ab9 sub 51.3M＋cacheWrite 2.2M（338 requests）、9f451488 sub 56.8M＋1.5M（377 requests）。平行寫法的 cacheRead 是單人的 5–7 倍；這就是使用者說的額度。

### 三、時間到底花在哪（回答「SPEC 定義好了，寫 PLAN 不是很快嗎」）

1. 「寫」本身確實快：主 session 把整份 plan 一次 Write 出來只要 2–9 分（1835 行 8.6 分、1075 行 3.2 分、645 行 2.3 分）。慢的是：寫之前的思考與讀碼（gen:other 5–23 分，91cb51ef thinking 78k tokens），以及寫之後的 lint 迴圈（9e59e535 10 次 lint＋9 次 Edit、5e181f59 11 次＋8 次，各約 5–8 分）。reviewer 平常 1–3 分，但 9f451488（66 次 tool）與 e2d126e8（77 次 tool、30 次 Read）各跑 10–12 分——它們把整棵樹讀了一遍，而 `SKILL.md:362-365` 只要它答兩個問題。
2. 40 分以上的「工作時間」沒有一場是主 session 單人造成的，全是委派：把整份 plan 丟給一個背景 opus agent（general-purpose／implementer／brain），它要從零讀 design、skill、code，寫 1000–3000 行滿版 code，20–55 分後撞 300k 軟預算寫 relay，下一個 agent 再從零讀（`relay-a02fd8d792c2f8c13.md:1-14` 就是第二次 relay：1195 行只完成 Task 1–4，剩 5–15 要「cat part >> plan」）。relay 機制是內建的（`agents/fankeel-brain.md:118`、`lib/handoff.js:123`、`lib/stages.js:723`），plan-part 不是——grep skills/agents/lib/scripts/hooks 無此機制，是 session 臨場發明（66a6563a 主 transcript line 447–449：三個 general-purpose/opus 被叫去寫 plan-part-A/B/C，「Do not touch the plan file」）。
3. 使用者提議的「一個 brain 派多個 agent 寫 plan」其實已經跑過 4 次（45487ab9、9f451488、94618e2b，與 66a6563a 的後半），結果：每份 part 的 opus writer 自己就要 10–41 分（64–107 次 tool call，大多在讀 repo），父 session 等最慢那份，再 lint 3–5 輪、reviewer 2–10 分，淨 36–54 分——沒有贏過主 session 單人的 33–35 分（而且 91cb51ef 單人寫的是 19 task，比任何平行場次都大）。原因是 Amdahl：每個 writer 的固定成本（讀 design＋397 行 skill＋相關 code 再想清楚）10–15 分不會因為切更細而消失，而且各自重讀讓 cacheRead 翻 5–7 倍。
4. gate／閒置佔長 session 的三分之一以上（1b483aed 61 分、5e181f59 64 分、8846548c 27 分、94618e2b 10 分、f0a58f35 850 分）。這部分和 build 判決（`14-plan-parallelism-answer.md:16-17`）一致：平行處理解不了人不在。
5. 大小 vs 時長：plan 都是 500–1800 行、5–19 task，fence 佔大半（1032 行裡 61 個 fence、1835 行裡 47 個）。同樣寫法下時長隨行數線性（輸出約 200 行／分），但寫法差異（委派／relay／閒置）遠大於大小差異。

### 四、plan 移進 `stage.agents`（乾淨 context）有沒有幫助

證據說沒有：唯一一場 plan 站 agent（8846548c，brain opus xhigh）55 分撞預算 relay，再 29 分，合計 84 分；委派單一 writer 的三場也都 23–36 分起跳再 relay。乾淨 context 省下的是主 session 的 compaction（本次 14 場 plan 視窗裡 compaction 幾乎為 0，只有 f0a58f35 兩次），換來的是 writer 從零重讀一切。brain 本身允許跑 plan（`agents/fankeel-brain.md:28-29`、`:126-128` 它自己 Write plan 檔、`:157` 沒有 Edit；`lib/stages.js:484` FULL_ROUTE 含 plan；`lib/profile.js:184-196` parseStageAgents 接受逗號清單），所以「單獨把 plan 放進 stage.agents」技術上一行就好，但不會更快，只會把主 session 的 33 分變成 brain 的 50–80 分。

### 五、平行 part-writer 的可行性清單（拆之前 brain 必須先寫好的東西）

- `## Global Constraints`（`SKILL.md:65`、`:77-95`；`rationale.md:15`「每個 task 的需求都隱含這一節」）。
- 檔案結構節（`SKILL.md:97-106`）。
- 每個 task 的標題 `## Task N:` 必須用冒號（`SKILL.md:118-122`；`lib/plantasks.js:21` 正規式），編號由 brain 統一；lint 不檢查連號（R2），但 `groups()` 以檔內順序貪婪分組（`plantasks.js:203-215`），順序即相依順序。
- Files 區塊：Modify 上限 3（`plantasks.js:354`、lint `:667-669`）；同一檔被 ≥3 個 task 寫會被 lint 抓（`plantasks.js:599`、`SKILL.md:169-172`）——writer 彼此看不到，所以 Files 區塊要由 brain 先分配。
- Interfaces 的 Consumes／Produces 要精確簽名（`SKILL.md:174-186`），`conflict()` 以反引號名字比對（`plantasks.js:190`）——要 brain 先給一張介面表。
- 每個 fence 必須在上方 3 行內點名 Files 區塊裡的檔（`SKILL.md:289-305`、lint `:647-658`）、不得「similar to Task N」（`SKILL.md:314`）、型別跨 task 一致（`:345-347`）、`## Coverage` 表逐條引用 design（`:325-343`、lint `:639-646`）——Coverage 只能 merge 後寫。
- lint 與 groups 都吃一份 plan 文字（`plantasks.js:57-62`、`:144`；R2 INFERRED），所以 part 檔必須先串回同一檔再 lint；現場做法是 `cat part >> plan`（relay 2）或 append（94618e2b 2 次）。
- 結論：brain 要先做掉 plan 約四成的「想」（header、介面表、Files 分配、task 清單），writer 只填 code fence＋steps＋test。這和現在「給 writer 一段 prompt 叫它自己去讀」完全不同，也是唯一可能壓低每份 10–15 分固定成本的做法——但沒有任何現有資料證明它成立。

### 六、建議

**現在不要加 `plan.writers`／`plan.parallel`。** 理由是上面第三節：同一個做法已跑 4 場，牆鐘沒贏、額度多 5–7 倍，而額度正是使用者的限制。

**先做三件不用 key 的事（有數據的）：**
1. 不要把整份 plan 交給一個背景 agent 寫。`SKILL.md:14-19` 本來就是主 session 自己寫；四場委派（e2d126e8、cd62ad07、8846548c、66a6563a）全部 23–84 分，三場 relay。若為保護主 context 非委派不可，先拆再派，不要等 45 分鐘撞預算後才拆（66a6563a 正是這樣）。
2. 收窄 reviewer 的輸入：只給 design、plan、lint 輸出與 `SKILL.md:362-365` 的兩個問題，不要給 worktree 整棵樹——9f451488／e2d126e8 的 reviewer 各吃掉 10–12 分。
3. lint 迴圈 10–11 輪（9e59e535、5e181f59）值得看一下是哪類 finding 反覆出現（本次未查）；若是 fence 點名或 Modify 上限，寫在 brief 前面比事後修快。

**效益最大但不在選項內的決定（請使用者另案拍板）：** plan 體積的主因是滿版 code（`SKILL.md:194`「the plan carries the code; transcription plus tests」）。`SKILL.md:233-237` 只有 haiku 派工才真的需要每個 Write 步驟對應一個真 fence。若 sonnet 派工的 task 允許「簽名＋測試＋步驟」而非整段 code，plan 行數估縮 2–3 倍，單人寫就快，也不必 writer。

**若仍想測「一個 brain 派多個 writer」——trial 設計：**
- 對象：下一個 ≥8 task 的 plan（live 的 station-remote 15 task，或下一輪 TODO 全表盤點）。
- 做法（不加 key，手動照 brain 流程做一次）：`stage.agents` 暫加 plan；brain 自己先寫 header、Global Constraints、檔案結構、介面表（每個 Produces 的精確簽名）、全部 task 標題＋Files 區塊（先確認沒有檔被 ≥3 task 寫）；再派 part writer——`fankeel-reader` 不能寫，所以用 implementer 或 general-purpose 但 **model: sonnet**、3–4 task 一份、≤8 同時（`dispatch.inflight`）、brief 內貼 header 與該 task 要讀的 path:line，明令不得讀 skill 全文、只寫 `plan-part-N.md`；brain 串接 → `node scripts/ledger.js --plan <plan> lint` → `groups` → 一個 reviewer（只給兩個問題）。
- 量：registry `clock.plan−waited.plan`；writer 最長 span 與聯集忙碌時間（本次腳本的 unionBusy）；merge 後 lint 次數；reviewer 回傳行數；`spend.plan` 的 subagents cacheRead。
- 採用：淨 plan ≤20 分、merge 後 lint ≤3 次、reviewer 回傳不多於單人基線（91cb51ef／9e59e535）、cacheRead ≤2× 單人（≈ ≤30M）。放棄：淨 ≥30 分、任何一次 relay、cacheRead ≥3×。
- 若採用才加 key：`plan.writers`（整數，builtin 0＝關），放 `lib/profile.js` KEYS（`:19-95`），parser 比照 `dispatch.inflight`（`:227-236`），`docs/01-guide/profile.md:40` 旁加一列；且必須同時把 plan 放進 `stage.agents`——由主 session 直接派 writer 會把每份 part 的 hand-back 塞回主 context（66a6563a／45487ab9 的「Another Claude session sent a message」就是這樣來的），brain 派才不會。

### 七、抽查結果

- `skills/fankeel-plan/SKILL.md:360-367`：一個 reviewer、sonnet、兩個問題、「Fix what it finds inline」——與 R1 相符。
- `lib/plantasks.js:203-215`：`groups()` 貪婪、依檔內順序、`conflict()` 即開新組——與 R2 相符。
- `.fankeel/build/task-20261021T024539/relay-a02fd8d792c2f8c13.md:1-14`：第二次 relay、1195 行只到 Task 4、要求 append——與 R3 相符；主 transcript `grep plan-part-A` 命中 line 447，「Write your part to …plan-part-A.md ONLY」三份——與 R3 相符。
- `.fankeel/build/ask/14-plan-parallelism-answer.md:14-17`：卡點排名為 parent 單線迴圈與 gate 等待，只談 build——與 R4 相符。
- `lib/profile.js:57-62`：`stage.agents` values 僅 false/true/all、逗號清單交 parseStageAgents；`compact.at` builtin 450000（此 repo 設 350000）——與 R5 相符。
- 沒有任何一處 reader 的引文與原文不符。

### 八、沒查到的

- 9e59e535／5e181f59 的 10–11 輪 lint 各報什麼。
- `scripts/ledger.js` 的 `lint` handler 是否在 `plantasks.js:635-694` 之外再加檢查（R2 只開 groups）。
- part-writer 的 output token 為何少記（可能與 bridge-session 紀錄方式有關），因此 writer 的「輸出速度」無法算，只能用 span。
- 46 場沒本機 transcript 的 plan session（含淨 427 分的 49e93c6c、124 分的 22e0a006）只知道 registry 的時鐘與 waited，無法分解。
