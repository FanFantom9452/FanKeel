---
judged: 2026-10-12T04:33:38.563Z
model: fable
agent: fankeel-judge
task: "自動 compact 到 629K 沒觸發的原因（任何階段都該能壓縮）+ TODO 全表盤點"
session: d30737d7-6879-4929-a2f1-014b801208ef
stage: plan
---

# Brief: 該不該在 build 之前問使用者要不要先 compact，以及 build 途中 context 堆高怎麼辦

## Question

# Brief: 該不該在 build 之前問使用者要不要先 compact，以及 build 途中 context 堆高怎麼辦

## 使用者的問題（原話）

「那我們的設計如果改為 BUILD 之前 問使用者要不要先 COMPACT 呢? 就是這個機制 如果今天 PLAN 檔案的 TASK 任務很多 有可能會連續造成大量堆疊 或是 BUILD 過程中 也產生大量堆疊要怎麼辦」

## 背景

fankeel 是一個 Claude Code plugin，repo 在 F:/ymlab/fankeel。任務走 survey、design、plan、build、verify、audit、land 這些站，每站結束用 AskUserQuestion 問一個 gate。

這個任務在處理「主 session 的 context 到 629k 都沒有自動壓縮」。量到的事實：

- 那個 session（SBIR 專案 9916350f，Claude Desktop 2.1.295，build 站）在 450k 到 629k 之間 turn 結束了 16 次，沒有任何一次壓縮，最後使用者手動 `/compact`。
- 自動壓縮只有一條路：`hooks/compact.ts` 這支 mod，在主 session 的 `turn.complete`、context >= 450000（`HARD`）、有進行中任務時呼叫 `$.session.compact`。它不看站別。
- mod 要使用者每個 session 在 `/plugin` 按一次 Enable for this session 才載入；沒載入時沒有任何提示。command hook 沒有能力觸發壓縮（`docs/03-decisions/2026-10-07-mod-reopen.md`）。
- 引擎拒絕在 turn 進行中壓縮（型別檔：`rejects while a turn runs`）。build 是「不停下來問的迴圈」，一個 turn 可以很長：fankeel 專案 session 91cb51ef 有一個 488 分鐘的 turn，context 在一個 turn 內從 72k 長到 359k。
- 這個專案的 profile `stage.agents` 只有 `survey`，所以 design、plan、build、verify 都在主 session 跑，context 在主 session 累積。`stage.agents` 若包含 build，build 會交給一個 stage agent 在乾淨 context 裡跑，主 session 只轉路徑；stage agent 自己有 300k 提醒、450k 拒絕並交接的預算（`hooks/budget.js`）。
- 每站的 gate 在 context 過 400k（`BUSY`）或曾經壓縮過時，已經有第四個選項「交接」：`task.js next --handoff --from-gate`，然後新終端 `/fankeel` → Adopt（`lib/context.js` 的 `contextLine`）。
- 使用者的限制（`docs/90-agent/todo/compact-2.md`）：不可用交接、要能手機操作、少打指令。

目前寫好、尚未核准的設計與計畫：

- `docs/90-agent/plans/2026-10-12-compact-beat-design.md`
- `docs/90-agent/plans/2026-10-12-compact-beat.md`

它做的是：mod 每次 turn 結束寫心跳檔；context 行在過 400k 時說出 mod 沒載入（absent）、上次被拒（failed）、或在等 turn 結束（waiting，請模型在下一個 task 邊界結束這個 turn 讓壓縮跑）。使用者在 plan 的 gate 選了「留在 plan：改『請結束這個 turn』那一句」，接著提出上面的問題。

## 要判斷的事

1. 「進 build 之前問使用者要不要先 compact」值不值得做成機制？如果值得，它應該長什麼樣：
   - (a) plan 的 gate 多一個選項或多一句（command hook 做得到，因為 gate 是模型依規則寫的；但 command hook 與模型都不能自己執行 `/compact`，只能請使用者打，或由 mod 的 `$.session.compact` 在 turn 結束時做）
   - (b) mod 在「stage 從 plan 變成 build」後的第一個 turn 結束時無條件壓一次（不問，或依 profile 的一個 key）
   - (c) 不做 build 前的壓縮，改成依 plan 的 task 數與目前 context 估算，超過就建議把 build 交給 stage agent（`stage.agents` 加 build）或交接
   - (d) 其他
2. build 途中 context 持續堆高（task 很多、一個 turn 很長）該怎麼處理，在「引擎不准在 turn 進行中壓縮」「使用者不想用交接、想少打指令、要能手機操作」這些限制下：
   - 目前設計的 waiting 那一句（請模型在 task 邊界結束 turn，壓完要使用者說繼續）該留、該改、還是該拿掉？
   - build 迴圈該不該有固定的壓縮點（例如每個 group commit 之後結束 turn 一次），而不是等到 450k？
   - 壓縮後由誰讓 build 繼續：使用者說一聲、背景 agent 的回報喚醒、還是 mod 用 `$.prompt.submit` 自己送一句（真機沒量過）？
   - 還是結論應該是「task 多的 build 一律交給 stage agent，主 session 的壓縮只當保險」？
3. 以上哪些該進這一次的計畫（三個 task，bounded），哪些該開成 TODO。

## 要讀的檔

- docs/90-agent/plans/2026-10-12-compact-beat-design.md
- docs/90-agent/plans/2026-10-12-compact-beat.md
- hooks/compact.ts
- lib/context.js
- hooks/budget.js
- docs/03-decisions/2026-10-07-mod-reopen.md
- docs/90-agent/todo/compact-2.md
- skills/fankeel-build/SKILL.md（build 迴圈、ledger、壓縮後怎麼接回來）
- .claude-plugin/types/claude-code/index.d.ts 第 2836-2905 行（`compact`、`append`、`turn.abort`）與 `prompt.submit` 的說明

先 grep 再讀，只讀需要的範圍。

## 什麼算答案

對 1、2、3 各給一個明確的選擇與理由，不要列選項讓人再選。引用你讀到的 `path:line`。分清楚「程式碼裡讀到的」與「推論、沒量過的」。

## 回覆的形狀

```
1. build 前：<做什麼>——<為什麼，兩三句>
2. build 途中：<做什麼>——<為什麼，兩三句>
3. 這次做：<條列>
   開成 TODO：<條列>
風險：<最可能錯的一點，以及怎麼驗>
```

三百字以內，繁體中文，程式概念用程式裡的名字。

## Answer

1. build 前：不在 plan 的 gate 問，改成不問就壓——plan 站規則加一句「`task.js stage build` 之後只回一行、結束這個 turn」；mod 的心跳多記 `stage`，`turn.complete` 看到 stage 由非 build 變 build 就呼叫 `$.session.compact` 一次，不看 tokens。為什麼：模型與 command hook 都執行不了 `/compact`，gate 選項只能叫使用者打字；而且 `turn.complete` 要等 gate 答完才來（`docs/03-decisions/2026-10-07-mod-reopen.md:29`，量過），答完後模型照 `skills/fankeel-build/SKILL.md:43` 不停地進 build，plan 與 build 之間沒有任何 turn 結束（推論），`hooks/compact.ts:87` 根本沒機會跑。壓的代價小：build 從 plan 檔與 ledger 接手（`SKILL.md:84-94`），一次約 55 秒（`docs/90-agent/todo/compact-2.md:18`）；代價是使用者多說一聲「繼續」，手機可做，不是指令。

2. build 途中：waiting 句留，改成「build：下一個 `ledger.js complete` 之後結束 turn，回一行說是壓縮點；其他站：gate 答完、`stage <next>` 之後結束 turn」，門檻維持 HARD——低於 HARD 結束 turn 只讓使用者白按一次。不做無條件每 group 結束 turn。壓完這次由使用者說一聲接回；`$.prompt.submit`（型別檔 2911-2912：session idle 後自成一個 turn）是對的接續機制，沒量過。讀到的盲點：context 行只在 UserPromptSubmit 注入（`hooks/inject.js`），主 session 沒有 tool-call 級的提醒（`hooks/budget.js:4` 只管子代理），所以一個 turn 內 72k 長到 359k 的情況這一句永遠看不到；只有 `turn.step` 的 usage（型別檔 4653）配 `$.session.append`（2862-2868）或 `$.turn.abort`（2892-2903）加 `$.prompt.submit` 能補，全是型別檔推論。task 多的 build 交給 stage agent 是對的而且現成：controller 每次 dispatch 後結束 turn（`lib/stages.js:672`），mod 有 turn 結束可壓，主 session 只堆路徑，build agent 自己有 `hooks/budget.js:57,79` 的預算與 relay 重派（`lib/stages.js:691`），不經使用者交接；主 session 壓縮當保險。但這專案 `.fankeel/profile.json:6-8` 只有 survey，且 compact-2.md:22 壓縮中背景回報會不會丟沒等到答案。

3. 這次做：
   - Task 1：心跳多 `stage`；stage 變 build 的 turn 結束無條件壓一次；`lib/stages.js` plan 站加「`stage build` 後結束 turn」一句與 `tests/stages.test.js`（Task 1 只有一個 Modify，放得下）。
   - Task 2：waiting 句改成第 2 點那句，門檻不動。
   - Task 3：`compact-5` 正文擴成三個探測（turn.step usage→session.append 提醒；turn.abort；prompt.submit 接續）；`profile.md` 多一句 task 多時把 build 加進 `stage.agents`。
   開成 TODO：
   - `$.prompt.submit` 壓完自動接續，免「繼續」。
   - turn 中偵測與提醒（turn.step + session.append）。
   - command hook 的 Stop 事件回 block，讓低於 HARD 的固定壓縮點不耗使用者一次（注意 stop_hook_active 迴圈；Stop 在 turn.complete 之前，壓縮那次不能 block）。
   - stage agent 模式下壓縮進行中 await.js 的回報會不會丟。
風險：最可能錯的是「核准後結束 turn」那次 `turn.complete` 在 Desktop 真機會不會來、模型會不會照做。驗法：Desktop 開一個任務走到 plan gate 核准，看 transcript 的 `compact_boundary`（trigger manual）緊跟在 `stage build` 之後、心跳 `last.result` 為 done。沒看的：`hooks/budget.js` 與 SKILL.md 只 grep 與讀片段；型別檔只讀 2836-2921 與 prompt.submit 的 grep；真機行為全是推論。
