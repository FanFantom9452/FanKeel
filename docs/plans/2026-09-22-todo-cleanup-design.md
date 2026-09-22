---
status: design-intent
last_verified: 2026-09-22
---

# 清 TODO：Ready 11 項 + 三個待決定項

這頁記下 `清 TODO：Ready 11 項小修 + 3 個待決定項` 這個 task 的 design 產出。survey 階段
派了 4 個 `fankeel-reader`（design.mockup 缺口、build/verify 接縫、lock 測試時序、Ready
段 11 項各自的 path:line）；三個「需要決定」的項目已經跟使用者逐一確認，這頁記下決定與
每個決定要改的檔案。Ready 段本身不需要決定，照 TODO 所述做，只是修正了兩處 survey 時發現
已經歪掉的敘述。

## 1. design.mockup 缺口 — 濾掉規則，不補 implementer

`agentsFor('design')`（`lib/stages.js:645-646`）落到預設 `BRAIN_AGENTS`
（`lib/stages.js:638`）＝`[reader, reviewer]`，沒有能 Write/Edit 的 agent；而
`design.mockup` 的規則（`lib/stages.js:258`）不看受控與否，一律進 brain 的 brief。決定：
在該規則的 `when` 條件加 `controlling('design', values)`，受控 design 站直接跳過這條規則，
不再告訴 brain 一件它做不到的事。implementer 路徑留給「下一個前端任務」那個 Waiting 項目，
真的有前端任務出現、且跑在受控 design 下時再補。

- `lib/stages.js` — `design.mockup` 的 `when` 規則加上 `controlling('design', values)` 條件。
- `docs/subagents.md` — 補一句：受控 design 站目前不觸發 `design.mockup`，因為
  `agentsFor('design')` 沒有能寫頁的 agent；implementer 路徑待補。（不改
  `docs/decisions/2026-09-10-design-mockup.md`——decision 頁寫一次不維護，這是新狀態，屬於
  reference 頁的職責。）

## 2. build/verify 接縫 — 先記錄不修

`docs/subagents.md` 列的十來個接縫（缺 AskUserQuestion/Edit/SendMessage、插話會起第二個
brain、profile 中途翻轉、accounting／claims／commit 位置）都還沒有真的發生過事故。比照
TODO 其餘 Waiting 項目「等一次事故再動手」的慣例，這次不改程式碼，只把文件裡已經過期或遺漏
的敘述補齊。

- `docs/subagents.md` — 補齊 accounting 段：`scripts/ctx.js` 現在已經能印單一 agent 檔的
  per-agent series，那句「還缺 per-agent series」要改；其餘接縫（插話、profile 翻轉、
  claims、commit 位置）保留現有敘述，不新增程式碼修法。

## 3. lock 測試複測 — 放寬時序

`tests/registry.test.js:722` 的子行程持鎖 300ms，`lib/registry.js:321-323` 的
`LOCK_ATTEMPTS=200 × LOCK_DELAY_MS=5ms`＝1s 等待上限、`LOCK_STALE_MS=5000`＝5s 才判過期
（純看 mtime，沒有 pid 檢查）。兩次紅掉的 commit（3784eb7、40e3e12）都沒碰到鎖碼或測試本身。
決定：這是並行負載下時序過緊，不是 pid 重用，放寬子行程持鎖時間與等待上限之間的餘裕。

- `tests/registry.test.js` — `a writer waits out a lock somebody else is holding` 的持鎖
  時間或等待上限之間的餘裕加大，註解說明原因（並行整套下量到過緊）。

## 4. Ready 段 11 項

11 項都照 TODO.md 所述做；survey 發現兩處敘述已經歪掉，一併修正：

- `scripts/station.js` — `/station/station.js`、`/station/station.css` 的 handler 加
  `cache-control: no-store`，跟 `/`、`station-data.js`、detail 三條一致。
- `assets/station/station.js` — `colorOf`／`legendHtml` 讓「依版本」比照「依 project」收攏
  第 7 個以後的顏色，圖例印「其他 N 個」。
- `lib/plantasks.js` 相關文件 — `docs/subagents.md`、`docs/collisions.md`、
  `docs/pipeline.md` 各自補上 `conflict()` 的第 4 個 predicate（`read`，`lib/plantasks.js:129`）。
- `tests/station-hide.test.js`、`tests/station-view.test.js` — 修正 code-comment 裡歪掉的
  `path:line`：實查是 4 條不是 3 條（含 `station-hide.test.js:10`），只有
  `scripts/station.js:766` 真的不存在，其餘 3 條指到錯誤行號，一併修正。
- `docs/reports/2026-09-21-quota-calibration.md`（或其定錨邏輯實際所在的
  `docs/reports/evidence/2026-09-21-quota-calibration/basis.js`）— TODO Ready#5 的連結指到
  `scripts/spend.js`，但該檔沒有 `quotaLimits`；build 時先讀 `basis.js` 找到真正該改的地方，
  再把 13 筆定錨改成取一次 `five_hour`、一次 `seven_day` 被拒時刻的兩點定錨法，同時把
  TODO.md 的連結改指對地方。
- `scripts/task.js` — session record 除了 `guard`，start 時把其餘 profile 值一併存一份快照。
- `docs/registry.md` — 「files written」表補上 `build/task-<time>/` 的交接檔（`<stage>.md`、
  `-answer.md`、`-commit.md`）、`serve.json`、`station/detail/`、`station/cache/` 四列。
- `docs/development.md`、`skills/fankeel-land/SKILL.md` — `last_verified` 更新到重讀後的
  日期；`tests/render.test.js:489`、`scripts/task.js:712,722` 的行號改成今天量到的數字
  （`design 2396`／`land 2396` 等，不是舊的 `2397`／`2393`）。
- `scripts/ctx.js` — `stageRows` 的 `isSidechain === true` skip 補一個 fixture 釘住，刪掉
  多餘的 `t === null` return；`isAgentFile` 改用 `summarise` 是否為 null 判斷；改正
  約 96 行「每行都複製」的註解，改成只有 sidechain 行被改寫。
- `TODO.md` — 每項完成後在同一個 commit 移除對應 bullet。

## 不是前端工作

`scripts/station.js`／`assets/station/station.js` 的改動是修正既有渲染邏輯（cache header、
顏色收攏），不是新增畫面，判斷不需要 mockup。

## 對照 map

檢查過 `.fankeel/map.md`：`docs/decisions/2026-09-10-design-mockup.md` 是 decision 頁，寫一次
不維護，所以「受控 design 跳過此規則」這個新狀態改寫進 `docs/subagents.md`（reference 頁）
而不是那份 decision 頁，避免改動一份不該再維護的頁面。`docs/plans/2026-09-19-stage-agents-design.md`
是 design-intent，這次的 build/verify 決定（先記錄不修）不牴觸它——沒有把它當已完成的東西
處理。沒有發現其他牴觸。

## proves it done

- `node --test` 全綠（before/after）。
- `tests/registry.test.js` 的 lock 測試整套（`node --test`）連續跑 3 次不紅（目前偶爾紅）。
- `assets/station/station.js` 的「依版本」在 8 個以上版本下，legend 印出「其他 N 個」而非
  三段同色（渲染後人眼核對，不只是 unit test 綠）。
- `curl -I` 對 `/station/station.js`、`/station/station.css` 看得到
  `cache-control: no-store`。
- `node scripts/docs-check.js` 綠，`node scripts/todo-check.js` 對已關閉的 TODO 項目不再
  報告。

## unverified

Ready#5（quota 定錨）目前只知道 TODO 的連結指錯檔案，還沒讀過
`docs/reports/evidence/2026-09-21-quota-calibration/basis.js` 的實際邏輯，build 時第一步
要先讀它才能定案要改哪裡、怎麼改。

## spec

本檔：`docs/plans/2026-09-22-todo-cleanup-design.md`
