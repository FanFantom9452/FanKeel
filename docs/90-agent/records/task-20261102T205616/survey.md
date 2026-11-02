# TODO 全表盤點 — survey

fankeel map：1459 份 markdown，4 份 planned not built，424 份 retired，134 份 undeclared（`.fankeel/map.md`）。這是盤點，不是新功能，所以不跑 `survey.js` 找詞，也沒有 skipped 的程式碼。

entries: 33 listed, 33 in TODO（`node scripts/todo.js list` 最後一行 `33 open`，沒有缺漏）

結論先說：三條 Ready 都還成立，都是使用者的決定或明確指定、各自要先 design，可以 do now；到期的只有 `spend-6`（今天 11-03），已重量，要使用者拍板；其餘 29 條不是等外部事件就是等再紅，今天沒有一條可以結案。沒有任何 Watch 戳記超過 60 天（最舊 11-01），所以沒有 Watch 要問留不留。

## Ready

- worktree-1 — 讀 docs/90-agent/todo/worktree-1.md，使用者 11-03 指定「很重要、優先做」；`git worktree list` 與 `.claude/worktrees` 現況證實殘骸已搬到 fankeel-worktrees-parked，卻仍登記著 — do now（要先 design：worktree 放哪、marketplace 來源、殘骸誰清）
- gate-22 — 讀 docs/90-agent/todo/gate-22.md；`hooks`、`lib`、`scripts` grep 不到 `preanswered`，所以還沒做；使用者 11-02 選重開 — do now（要先 design，四個待決點寫在條目裡）
- record-2 — 讀 docs/90-agent/todo/record-2.md；`.fankeel/.gitignore` 與 `.gitignore` grep 不到 `imports`，import 只收有 manifest 的 ZIP 的缺口仍在 — do now（要先 design，設計方向已寫在條目）

## Needs a decision

- spend-6 — 重量結果（`usage-compare.js --before 2026-10-13..2026-10-19 --after 2026-10-27..2026-11-02`）：1h cache write 佔比 28% → 15%、總花費 $2705 → $921、subagent 佔比 33% → 59%，但 session 數 4307 → 89，分母仍不同；閒置壓縮 CC 已自帶，剩下要決定離開前壓縮與回報長度上限（回報上限 10-20 已落地）— needs the user

## Blocked

- audit-1 — 條件是換到新機器測 Trovara；讀條目與 git log，無新進展 — waiting on 使用者換新機器，維持原樣、不重戳
- build-1 — `npm view knip version` 仍是 6.44.1，與 11-01 重跑的是同一版，沒有新版可試 — waiting on knip 新版，restamp 今天
- docs-1 — 使用者 10-05 決定流程圖先在另一個專案做；無新進展 — waiting on 另一個專案
- foreign-1 — 條目寫 RH 要先 clone、裝 Lumos X／Remote X、同步 NAS，沒有證據已開始 — waiting on 一個非 fankeel 專案跑滿一週
- model-4 — 條目 10-05 查證 fast mode 只支援 Opus；我沒有重查上游說明，這一點未驗證 — waiting on 上游支援 Sonnet 或可依 agent 設定
- security-1 — `git -C F:/ymlab/sec-test log -1` 最後 commit 仍是 2026-09-02 — waiting on AI CODING SECURITY 定案
- station-70 — `on: 11-07` 還沒到 — waiting on 11-07 再累積一週額度資料

## Watch

- await-15 — 讀條目，無新紅燈記錄 — keep
- design-2 — `lib/stages.js` 的 CLASSES 仍只有三類（條目 10-09 查證，沒有新前端任務）— keep
- entry-1 — 沒有第二個 host 的使用者或 issue — keep
- entry-4 — 條目 11-02 前最後一次記錄，第二步仍沒人在真 gate 上標記 — keep
- explain-2 — 沒有發版或對外展示需求 — keep
- flaky-1 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep- flaky-3 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep- flaky-4 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep- flaky-5 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep- flaky-6 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep- test-1 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep- test-14 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep
- flaky-3 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep
- flaky-4 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep
- flaky-5 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep
- flaky-6 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep
- test-1 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep
- test-14 — 讀條目，同一事件「整套再紅一次」，這輪沒跑整套、沒有新證據 — keep
- model-3 — 沒有一次受控 task 的 brain 來回次數明顯偏高的記錄 — keep
- notify-3 — `tests/notify-gone-lib.test.js` 仍鎖著，沒有人要手機通知 — keep
- pane-18 — 引擎仍沒有 `$.tasks.list()`，我沒有重查上游 — keep
- ponytail-1 — 候選 1、2 已落地，3、4 無對應事故 — keep
- render-2 — 沒有 sonnet 花費瓶頸或離線需求 — keep
- stage-agents-10 — 沒有新的 no verdict 記錄 — keep
- survey-1 — 沒有專案需要第十一種語言 — keep
- survey-2 — 沒有專案大到 grep 加 read 找不到跨檔關係 — keep
- test-8 — 沒有新的 VirtualAlloc／0xC0000409 記錄 — keep
- tour-2 — 11-02 才移除，使用者還沒提出對外展示 — keep

do now: worktree-1, gate-22, record-2
needs the user: spend-6
waiting on: audit-1, build-1（restamp）, docs-1, foreign-1, model-4, security-1, station-70（11-07）
keep: await-15, design-2, entry-1, entry-4, explain-2, flaky-1, flaky-3, flaky-4, flaky-5, flaky-6, model-3, notify-3, pane-18, ponytail-1, render-2, stage-agents-10, survey-1, survey-2, test-1, test-8, test-14, tour-2

planned, not built: 4 份 design-intent 頁（map.md 列出），與這次盤點無關
not found: 無
unknown: model-4 與 pane-18 的上游現況我沒有重查；audit-1、docs-1、foreign-1 靠使用者回報
skipped: 無程式碼掃描；整套 suite 這輪沒跑，所以 Watch 的偶發紅沒有新證據
class: bounded — 盤點加三條各自獨立的 Ready，route 沿用 `survey,plan,build,verify,land`
route: unchanged（三條各要先 design，到 plan 關卡再決定是否加 design）

reads:
docs/90-agent/todo/worktree-1.md — 使用者指定優先，先定做法
docs/90-agent/todo/gate-22.md — 四個待決點，影響 hooks/gate.js
docs/90-agent/todo/record-2.md — 設計方向與缺口清單
docs/90-agent/todo/spend-6.md — 11-03 重量結果要記進去

```json gate
{"questions":[{"header":"Survey→Plan","question":"Survey -> Plan | fankeel : TODO 全表盤點","options":[{"label":"Go to Plan (Recommended)","description":"接受 bounded 路線，下一站 plan 先排「worktree 不放在 repo 裡」（你指定優先），再排「先問完、剩下自己跑」與「跨機回顧：專案卡與來源分級」，兩者各要先 design；順手把 knip unused exports 未開 這條 restamp，並把本次重量結果寫回花費那條"},{"label":"Stay in Survey","description":"先決定三條 do now 要做幾條、順序，或要不要把 design 放進路線再往下走"},{"label":"暫停","description":"這次盤點先停在 survey，所有條目維持原樣，下次再接"}]},{"header":"spend-6","question":"主對話 1h cache write 佔 29%：1h cache write 28% → 15%，但 session 數 4307 → 89；剩下的離開前壓縮與回報長度上限怎麼處理？","options":[{"label":"改 Watch，再量 (Recommended)","description":"閒置壓縮 CC 已自帶、回報上限 10-20 已落地，佔比已降；分母仍變，改 Watch 條件為下次花費再升高才處理"},{"label":"結案","description":"以 28% → 15% 當作選定的方案，寫入條目後 todo.js done"},{"label":"再量一週","description":"維持 Blocked，on: 改 11-10，用同一指令再量"}]}],"next":"盤點完：三條 do now，花費那條待拍板，其餘 29 條維持等待或 keep"}
```
