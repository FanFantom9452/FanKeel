---
status: current
---

# 每帳號額度改用實測 perPoint，任務列換算週用量與 5H

來源：TODO 全表盤點（survey.md 同目錄）。合併兩條：「quota.week 該怎麼處置」（使用者選每帳號一個，再選數字來源用實測 perPoint）與「任務卡換算週用量與 5H 額度」。

## 1. 額度來源

- 一個帳號一週多少美元，不再手填：用花費頁已經在算的 `perPoint`（`assets/station/quota-share.js:68`，每 1% 週額度幾美元），只算該帳號的 session（`s.account === acc.key`）。
- `quota.week`、`quota.calibrated` 兩個 profile key 刪掉，連同 `parseQuota`（`lib/profile.js:403`）、`scripts/quota.js` 的校準，以及只剩它在用的 `lib/quota.js` 的 `perWeek`、`spentBetween`、`calibrate`。
- 設定頁（`assets/station/settings-page.js:163`、`:670`）與設定步驟（`assets/station/settings-steps.js:348`）拿掉「一週額度」那一格。
- 說明跟著改：`docs/01-guide/profile.md`、`docs/90-agent/reference/station.md`、`docs/90-agent/reference/sources.md` 不再提 `quota.week`。

## 2. 5H 的每 1% 美元

- `quota-share.js` 加 `span5(windows)`：取最新一個上升至少 `MIN_POINTS`（10）點的 5h 窗口，回傳 `{from, to, points}`，沒有就 `null`。`perPoint(span5(acc.windows), bins)` 就是 5H 每 1% 幾美元。
- `quotaShare(usd, pp7, pp5)` → `{ weekPct, fiveHourPct, estimated: true }`；兩個 perPoint 都是 `null` 時回 `null`。一律標估算：這是 API 價格除以每點美元，不是額度線上的讀數。

## 3. 顯示在哪

- 只在單一帳號的金額旁顯示：session 詳情的花費列（`assets/station/session-body.js:414`）與全部 sessions 表的花費格（`assets/station/sessions-page.js:263`），用那個 session 的 `account`。
- `station.js` 的 `quotaPct(n)` 改成 `quotaPct(n, account)`，回傳 `≈ 週 3% · 5H 12%`；沒有帳號或量不到就回 `''`。`usd(n, plain)` 不再自動接佔比——跨帳號加總沒有單一個分母。
- 每帳號的 perPoint 改在伺服器端算：`lib/station.js` 的 `serialize` 在 `quota.accounts` 每一項加 `pp7`、`pp5`（用 `quota-share.js` 的 `perPoint`、`span5` 與該帳號 session 的 `bins`）。花費頁（`assets/station/days-page.js:302`）改讀 `acc.pp7`，不再自己算；`station.js` 的 `quotaPct` 也讀它。`lib/` 第一次 require `assets/station/quota-share.js`——它本來就有 `module.exports`，算術只留一份。

## 4. 週報製作成本

- `scripts/weekly.js` 在 `show.cost` 開著時，另外跑一次 `station.serialize(station.gather({ configDir }))`，找出這個 session 的 `account`，用那個帳號的 `pp7`、`pp5` 算 `quotaShare(cost.usd, pp7, pp5)`，放進 `cost.share`。
- `lib/weekly-render.js:501` 的 `約佔週用量 —%／5H —%（待額度換算接上）` 改成讀 `cost.share`：有值寫 `約佔週用量 2%／5H 12%（估算）`，沒有帳號或量不到寫 `額度換算：量不到這個帳號的額度線`。

## 5. 不做

- 量測表（推估對實際額度變化，至少一週資料）：要等資料，留在 TODO，改成 Blocked、`on: 11-07`。
- 時間重疊時改用額度線讀數分攤（`shareOf`）：一律用估算，不分兩種。

## What proves it done

| 證據 | 現在 | 之後 |
|---|---|---|
| `tests/quota-share.test.js` 測 `quotaShare(3, 1.5, 0.25)` 得 `{weekPct: 2, fiveHourPct: 12, estimated: true}`，兩個 null 得 `null` | 沒有 `quotaShare`，失敗 | 通過 |
| `span5` 在上升不到 10 點時回 `null` | 沒有 `span5`，失敗 | 通過 |
| `tests/station-sessions-redesign.test.js`：帶 account 的列花費格含 `≈ 週`，沒 account 的不含 | 失敗 | 通過 |
| `tests/profile.test.js`：`parseValue('quota.week', '2000')` 回 error（未知 key） | 現在回 2000，失敗 | 通過 |
| `grep -rn "quota.week" lib scripts assets hooks` 沒有結果 | 有 | 沒有 |
| `tests/weekly-render.test.js`（或現有週報測試檔）：`cost.share = {weekPct: 2, fiveHourPct: 12, estimated: true}` 時頁面含 `約佔週用量 2%／5H 12%（估算）`，不含 `待額度換算接上` | 失敗 | 通過 |
| `serialize` 的 `quota.accounts[0]` 帶 `pp7` 數字（夠 10 點的測試資料） | 沒有，失敗 | 通過 |
