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

## 0. 帳號

這台機器兩個帳號共用一個 config dir（`C:\Users\user\.claude`），limits 紀錄裡 7d
重置時刻分成 04:00 與 19:00 兩組（2026-10-30 使用者確認是兩個帳號）。

- `hooks/pane-limits.ts` 每筆讀數多記 `account`：寫入當下 config dir 的 `.claude.json` 裡 `oauthAccount.accountUuid`；不記 email 或姓名。
- 帳號鍵：有 `account` 用它；沒有的舊讀數，依 `sevenResets` 的時與分（週內固定）歸到同一重置時刻的那組。兩者矛盾時以重置時刻為準，並在該讀數記一次不符。
- 帳號在頁面上叫「帳號 · 週四 04:00 重置」，不顯示 uuid。
- session 的帳號是它 limits 讀數裡最多的那個；沒有讀數的 session 歸「未知」。registry 不加欄位。

## 1. 額度序列

- 新函式把所有未 `gone` 的 registry 的 limits 檔讀成依帳號分開的序列，每筆 `{at, account, five, fiveResets, seven, sevenResets}`，`at` 為 epoch ms。
- 同一帳號內平行 session 的重疊讀數依 `at` 取整到分鐘去重，同一分鐘留 `seven` 較大的那筆。
- 序列放進 `serialize` 的資料（與 `C.DAYS` 同一條路），由前端依區間過濾；不新增路由。

## 2. 額度圖 `quota-chart`

- KPI 列下、分項長條上，新增「額度」區塊：每個帳號一張小圖，各有 7d 與 5h 兩條折線，y 軸 0–100%；區間內沒有讀數的帳號不畫。
- 沒有取樣的時段斷開，不內插；區間前段整段沒取樣時折成一段灰底，標「MM-DD 至 MM-DD 沒有取樣」。
- 5h 重置以虛線標在有取樣的窗口；7d 下次重置若在區間外，寫在圖例。
- 圖下一行灰字說明只在有 fankeel session 活著時取樣、資料起始日。
- 折線元件放在 `assets/station/chart.js`，與 `histSvg` 並列。

## 3. 燒速與重置 `quota-forecast`

每個帳號一列，三格：

- 7d：目前百分比；以本窗口最近 24 小時的讀數算斜率，預估到 100% 的時刻，早於 `sevenResets` 時寫「照近 24 小時速度，MM-DD HH:mm 用完」（警示色），否則「重置前用不完」。
- 5h：目前百分比，「HH:mm 重置，還有 N 小時 M 分」。
- 每 1% 額度 ≈ 該帳號在一個 7d 窗口內的花費 ÷ 該窗口 `seven` 的漲幅；只用歸到該帳號的 session 的花費，窗口取最近一個漲幅 ≥ 10 點的。sub-line「依 MM-DD–MM-DD 窗口」。不夠資料時寫「資料不足」，不退回 `quota.week`。
- 最近讀數超過 6 小時，三格都改顯示讀數時間，不假裝是現在。

## 4. 花費依帳號 `kpi-cost`

- 花費 KPI 不再接 `(x%)`（一個全機金額除以單一帳號的額度沒有意義）；sub-line 列出各帳號與未知的金額，「04:00 帳號 $X · 19:00 帳號 $Y · 未知 $Z」。
- `quota.week` 與 `scripts/quota.js` 的校準不再被花費頁讀；其餘頁面的 `(x%)`、`quota.week` 本身與校準腳本的去留另開 TODO，這次不動。

## 5. 依 task `by-task`

- `lib/detail.js` 的 `taskCalls` 也收 `task.js task "<名稱>"` 與 `task.js start --task`，seq 每一步帶 `task`；`daysOf` 每列帶 `task`。
- `assets/station/fmt.js` 的 `dimKey` 加 `task`；分項加「依 task」，放在依專案之後。
- 長條下一張表：task、專案、stage 數、花費，依花費排序，前五列加「其餘 N 個 task」與合計。
- 第一個 task 指令之前的花費歸到「（改名前，未知）」，不猜。

## 6. 最常被換掉 `most-swapped`

- `lib/station.js:829,838` 取關卡標籤當鍵前，先去掉 `(Recommended)`／`(建議)` 後綴，讓帶與不帶後綴的同一選項合併計數。

## 驗收

- 測試：兩個 registry、三個重疊 session 的 limits 檔，合併後每帳號筆數等於去重後分鐘數，`five` 有值。
- 測試：沒有 `account` 的讀數依 `sevenResets` 歸組，04:00 與 19:00 兩組分成兩個帳號；`account` 與重置時刻矛盾時以重置時刻為準。
- 測試：`pane-limits` 寫出的讀數帶 `.claude.json` 的 `accountUuid`，不含 email。
- 測試：近 24 小時斜率預估的時刻，給定讀數下等於手算值；斜率 ≤ 0 時為「重置前用不完」。
- 測試：每 1% 美元 = 該帳號窗口內花費 ÷ 漲幅；漲幅不足 10 點時為「資料不足」。
- 測試：花費 KPI 不含 `%`；sub-line 各帳號加未知等於總額。
- 測試：transcript 中途改名，`daysOf` 兩段列的 `task` 分別是兩個名稱，改名前一段為未知。
- 測試：`verify (Recommended)` 與 `verify` 合併成一個 `swapped` 項。
- 成品：渲染後的頁面上，依 task 表的合計等於同區間花費 KPI。

## 對照 map

會改 `docs/90-agent/reference/station.md` 的 quota 一段（184–190 行，花費 KPI 不再接 `(x%)`）與花費頁一節，以及 `docs/90-agent/reference/registry.md` 或 pane 的 limits 欄位說明（多一個 `account`）；沒有與 current 頁衝突的地方。

`quota.week` = $66 是錯的（2026-10-30 查：校準只取 10-29 的 6.4 小時、20 點、$13.14，又把兩個帳號的花費除以一個帳號的額度）；它的處置另開 TODO。

## 未驗證

同一個 config dir 裡用 `/login` 換帳號時，已在跑的 session 是否跟著換。若不換，寫入當下讀 `.claude.json` 會貼錯帳號——§0 以重置時刻為準就是為了這個。
