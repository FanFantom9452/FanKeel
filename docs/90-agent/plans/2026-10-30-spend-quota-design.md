---
status: design-intent
last_verified: 2026-10-30
---

# 花費頁：5h/7d 額度、燒速、依 task — design

花費頁（`#/days`）補上帳號額度這一層，並修兩個讀錯的 KPI。
mockup：`.fankeel/build/2026-10-30-spend-quota/mockup.html`（未提交，block 名稱見下）。

今天的狀態：5h/7d 讀數由 `hooks/pane-limits.ts` 寫進每個 registry 的
`.fankeel/build/limits/<session>.jsonl`，但測站只把最新一筆給手機版
（`scripts/station.js:1068`）；`lib/quota.js:20` 的 `readings()` 只讀 `seven`，
跨 session 沒有去重。

## 1. 額度序列

- 新函式把所有未 `gone` 的 registry 的 limits 檔讀成一條帳號層級序列，每筆 `{at, five, fiveResets, seven, sevenResets}`，`at` 為 epoch ms。
- 平行 session 的重疊讀數依 `at` 取整到分鐘去重，同一分鐘留 `seven` 較大的那筆。
- 序列放進 `serialize` 的資料（與 `C.DAYS` 同一條路），由前端依區間過濾；不新增路由。

## 2. 額度圖 `quota-chart`

- KPI 列下、分項長條上，新增「額度」區塊：7d 與 5h 兩條折線，y 軸 0–100%。
- 沒有取樣的時段斷開，不內插；區間前段整段沒取樣時折成一段灰底，標「MM-DD 至 MM-DD 沒有取樣」。
- 5h 重置以虛線標在有取樣的窗口；7d 下次重置若在區間外，寫在圖例。
- 圖下一行灰字說明只在有 fankeel session 活著時取樣、資料起始日。
- 折線元件放在 `assets/station/chart.js`，與 `histSvg` 並列。

## 3. 燒速與重置 `quota-forecast`

- 7d：目前百分比；以本窗口最近 24 小時的讀數算斜率，預估到 100% 的時刻，早於 `sevenResets` 時寫「照近 24 小時速度，MM-DD HH:mm 用完」（警示色），否則「重置前用不完」。
- 5h：目前百分比，「HH:mm 重置，還有 N 小時 M 分」。
- 每 1% 額度 ≈ `quota.week / 100` 美元，sub-line「依 MM-DD 校準」；沒設 `quota.week` 時這格不顯示。
- 最近讀數超過 6 小時，三格都改顯示讀數時間，不假裝是現在。

## 4. 週額度換算 `kpi-cost`

- 區間長於 7 天時，花費 KPI 不接 `(x%)`，sub-line 改為「≈ N 週額度」（花費 ÷ `quota.week`，一位小數）；7 天以內維持 `(x%)`。
- 只改 KPI 這一格；其餘金額的 `(x%)` 規則照 `docs/90-agent/reference/station.md:184` 不動。

## 5. 依 task `by-task`

- `lib/detail.js` 的 `taskCalls` 也收 `task.js task "<名稱>"` 與 `task.js start --task`，seq 每一步帶 `task`；`daysOf` 每列帶 `task`。
- `assets/station/fmt.js` 的 `dimKey` 加 `task`；分項加「依 task」，放在依專案之後。
- 長條下一張表：task、專案、stage 數、花費，依花費排序，前五列加「其餘 N 個 task」與合計。
- 第一個 task 指令之前的花費歸到「（改名前，未知）」，不猜。

## 6. 最常被換掉 `most-swapped`

- `lib/station.js:829,838` 取關卡標籤當鍵前，先去掉 `(Recommended)`／`(建議)` 後綴，讓帶與不帶後綴的同一選項合併計數。

## 驗收

- 測試：兩個 registry、三個重疊 session 的 limits 檔，合併後筆數等於去重後分鐘數，`five` 有值。
- 測試：近 24 小時斜率預估的時刻，給定讀數下等於手算值；斜率 ≤ 0 時為「重置前用不完」。
- 測試：30 天區間的花費 KPI 不含 `%`，含「週額度」；7 天區間含 `(x%)`。
- 測試：transcript 中途改名，`daysOf` 兩段列的 `task` 分別是兩個名稱，改名前一段為未知。
- 測試：`verify (Recommended)` 與 `verify` 合併成一個 `swapped` 項。
- 成品：渲染後的頁面上，依 task 表的合計等於同區間花費 KPI。

## 對照 map

會改 `docs/90-agent/reference/station.md` 的 quota 一段（184–190 行）與花費頁一節；沒有與 current 頁衝突的地方。

## 未驗證

`quota.week` = $66 與近 7 天全機約 $1138 對不上（約 17 倍）：校準或花費範圍有一個是錯的。§3 的每 1% 美元與 §4 的週額度數都依它而來。
