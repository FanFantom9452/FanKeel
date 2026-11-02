fankeel map — 1400 markdown files, 4 planned, not built, 419 retired, 101 undeclared（map.js 摘要）

這次是 TODO 全表盤點（patrol）。結論：33 條都逐條重查過，兩條可以現在做（land-11、registry-1），三條要你決定（entry-4、handoff-2、test-18），其餘都還在等條件或事件。沒有任何 Watch 的 stamp 滿 60 天（最早的 stamp 都是 2026-11-01），所以不需要問「要不要保留」。

entries: 33 listed, 33 in TODO

## Ready
- entry-4 — 開 todo/entry-4.md:1-15 與 git log 1b2999ed：第 1 步（拖曳截圖）10-27 已做，第 2 步要真 gate 上標記再走 hooks/gate.js 一輪；10-30 的空白 gate 頁已被 1b2999ed 修掉但條目沒提到，近四次 verify 都沒有「標記：」行 — needs the user
- land-11 — 開 scripts/commit.js:184-185：`git worktree remove` 失敗仍只回 `kept`，沒有清理也沒有重試，問題仍成立，一個 session 做得完 — do now
- registry-1 — 開 todo/registry-1.md、docs/90-agent/reference/registry.md，lib/ 與 scripts/ 沒有 `node:sqlite`：仍未建，11-02 的註記說這次只做本機集中歸檔加索引，量大可能要拆 — do now

## Needs a decision
- handoff-2 — 開 lib/registry.js:821、828 仍寫 SPIKE (throwaway)：hand-off 記 HEAD 的 handoffSha 要轉正還是刪除，仍成立 — needs the user
- test-18 — 跑 node scripts/test-audit.js：仍把 bench/ 報成重複（15 條裡 10 條），scripts/test-audit.js 沒有跳過 bench 的邏輯 — needs the user

## Blocked
- audit-1 — 開 todo/audit-1.md:1-20、git log scripts/docs-move.js（499df36f 後只有 37b0c26a 小改）：等使用者換新機器且其餘功能落地，條件未到 — waiting on 新機器與功能落地
- build-1 — 開 todo/build-1.md:1-16，`npm view knip version` 仍是 6.44.1，與 11-01 相同：等 knip 認得 CJS namespace 屬性存取 — waiting on knip upstream
- docs-1 — 開 todo/docs-1.md:1-14：等使用者在別的專案做完流程圖生成，無法在此 repo 驗證，沒有成立的跡象 — waiting on 使用者在別的專案完成流程圖生成
- foreign-1 — 開 todo/foreign-1.md（最後記錄 11-01），reports/ 沒有 foreign-week 報告：RH 還缺 clone、Lumos X、Remote X、Datapath 與 NAS sync — waiting on RH 在 fankeel 上跑滿一週
- model-4 — 開 todo/model-4.md 與 reference/model-choice.md，最後檢查 10-16（未重抓上游頁）：等 Sonnet 支援 fast 或 fast 可逐 agent — waiting on upstream fast mode
- security-1 — 開 todo/security-1.md，`git -C F:/ymlab/sec-test log -1` 為 2026-09-02 沒動：等 AI CODING SECURITY 定出共用弱點清單 — waiting on 該專案
- spend-6 — 開 todo/spend-6.md、scripts/usage-compare.js 存在：`on: 11-03` 還沒到，到時跑 usage-compare.js 重量 — waiting on 11-03
- station-70 — 開 todo/station-70.md：`on: 11-07` 還沒到，需滿一週額度資料 — waiting on 11-07 與一週資料

## Watch（全部 keep，皆未滿 60 天）
- await-15 — 開 tests/await.test.js:547 測試還在，最後紅燈記錄 10-25 — keep
- design-2 — 開 lib/stages.js:498 CLASSES 仍只有三類，design-axes.md 不存在，事件（下一個前端任務）未到 — keep
- entry-1 — 開 docs/03-decisions 只有 controller-host-list，沒有第二個主機使用者 — keep
- explain-2 — 開 todo/explain-2.md，沒有需要講解影片的發版 — keep
- flaky-1 — 開 todo/flaky-1.md，最後記錄 10-16 三次全套綠 — keep
- flaky-3 — 開 todo/flaky-3.md，最後記錄 10-16 無重現 — keep
- flaky-4 — 開 todo/flaky-4.md，最後記錄 10-16 無重現 — keep
- flaky-5 — 開 todo/flaky-5.md，最後記錄 10-16 — keep
- flaky-6 — 開 todo/flaky-6.md，斷言訊息已改成印出原因，等下次紅燈 — keep
- model-3 — 開 lib/stages.js:735 與 agents/fankeel-brain.md:5，brain 仍是 sonnet，事件未到 — keep
- notify-3 — 開 todo/notify-3.md，九個 notify-gone 測試都在，沒有使用者要求 — keep
- pane-18 — 開 hooks/stop.js:12、55，只有寫 background_tasks，hooks/pane.ts 沒有 tasks API — keep
- ponytail-1 — 開 todo/ponytail-1.md，候選 1、2 已做，3 仍觀察 — keep
- render-2 — 開 agents/fankeel-render-reviewer.md:5 仍是 sonnet，成本事件未到 — keep
- stage-agents-10 — 開 todo/stage-agents-10.md，最後再現 10-14 — keep
- survey-1 — 開 todo/survey-1.md，沒有需要第十一種語言的 repo — keep
- survey-2 — 開 todo/survey-2.md，沒有大到 grep 加 read 不夠的專案 — keep
- test-1 — 開 todo/test-1.md，最後紅燈 10-21，e8971b21 已修，未重跑 suite — keep
- test-8 — 開 todo/test-8.md，最後記錄 10-18，未重跑 suite — keep
- test-14 — 開 todo/test-14.md，d33bc9f4 只加診斷，與 test-1 部分重疊但含 chartroom 那半，不算重複 — keep
- flaky 系列與 test 系列都沒有重跑 suite，所以「無新紅燈」只是條目上沒有新記錄。

planned, not built: map 列有 4 頁 design-intent，與本次盤點無關，未逐頁讀
not found: none（本次是逐條盤點，沒有掃描詞）
unknown: entry-4 的空白頁修復是否真的解了第 2 步的阻礙，未實際開 gate 頁驗證；RH 環境實況、knip 與 fast mode 上游頁未重抓；flaky-1 到 flaky-6 自 10-16 之後的 git log 未能檢查
skipped: 未跑 survey.js 掃描，因為這是 TODO 條目盤點而非找碼；掃描器的 skipped 行不適用
class: bounded — land-11、registry-1 都是既有流程裡的範圍明確修改；registry-1 若拆開可能升級
route: unchanged（survey,plan,build,verify,land）。本次共派 4 個 fankeel-reader（sonnet）分讀 33 條，並自行開了 commit.js:184、registry.js:821、stages.js:735 核對

reads:
F:/ymlab/fankeel/scripts/commit.js — land-11 要改的 worktree remove 失敗路徑（約 184 行）
F:/ymlab/fankeel/docs/90-agent/todo/land-11.md — land-11 完成條件與要跳過桌面 app worktree 的規則
F:/ymlab/fankeel/docs/90-agent/todo/registry-1.md — registry-1 範圍與 11-02 註記，判斷是否要拆
F:/ymlab/fankeel/docs/90-agent/reference/registry.md — registry-1 的既有設計

```json gate
{"questions":[{"header":"Survey→Plan","question":"Survey -> Plan | fankeel : TODO 全表盤點","options":[{"label":"Go to Plan (Recommended)","description":"接受 bounded 分類，並把 「worktree remove 失敗堆積」與 「session 與 build 集中歸檔」當作這次要做的兩條；其餘 Blocked 與 Watch 維持原狀。"},{"label":"Stay in Survey","description":"先留在盤點，等你回答下面三條需要決定的條目，再決定哪些一併排進 plan。"},{"label":"暫停","description":"盤點結果已寫入 survey.md，先不進 plan，之後再繼續。"}],"multiSelect":false},{"header":"station 圖","question":"「station 圖需要真瀏覽器驗證」第 2 步要在真 gate 上標記，現在怎麼處理？","options":[{"label":"下個 gate 我來標記 (Recommended)","description":"空白頁已被 commit 1b2999ed 修掉，下一次 gate 你在頁面上標記一個節點，我再驗證 hooks/gate.js 一輪。"},{"label":"關掉第 2 步","description":"第 1 步截圖已完成，真 gate 標記改成看到問題再補，條目結案。"},{"label":"移到 Watch","description":"等下次有人實際在 gate 上標記時再驗證，條目降成觀察。"}],"multiSelect":false},{"header":"hand-off","question":"「hand-off 記 HEAD 留或刪」：hand-off 記 HEAD 的 SPIKE（lib/registry.js:821、828）要留還是刪？","options":[{"label":"轉正保留 (Recommended)","description":"把 handoffSha 當正式功能，移除 SPIKE (throwaway) 標記並補測試，task.js 與 tests/handoff-sha.test.js 一併整理。"},{"label":"刪除","description":"把 SPIKE 的 handoffSha 與相關程式、測試一起移除，條目結案。"},{"label":"再觀察","description":"先不動，條目留在 Needs a decision。"}],"multiSelect":false},{"header":"test-audit","question":"「test-audit 跳不跳 bench/」：test-audit.js 要不要跳過 bench/ 的重複報告？","options":[{"label":"跳過 bench/ (Recommended)","description":"在 scripts/test-audit.js 排除 bench/，目前 15 條重複裡 10 條是 bench 造成的噪音。"},{"label":"照實報告","description":"維持現狀，bench 的重複也算真重複，條目結案。"},{"label":"只標註不計入","description":"仍列出 bench/ 的重複，但不計入最後的 duplicate 總數。"}],"multiSelect":false}],"next":"進 plan：做 worktree 清理與集中歸檔兩條，並依你的回答處理其餘三條決定。"}
```
