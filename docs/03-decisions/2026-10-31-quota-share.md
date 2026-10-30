---
status: decision
last_verified: 2026-10-31
---

# 每帳號額度改用實測 perPoint，單一 session 的金額旁標週用量與 5H 估算（10-31）

一句話：拿掉手填的 `quota.week` 與它的校準腳本，改由 station 依每個帳號自己的額度讀數，算出每 1% 週額度與 5H 額度約多少美元。只在單一 session 的金額旁（session 詳情、全部 sessions 表、週報製作成本）標「≈ 週 x% · 5H y%」估算。

設計與計畫在 [99-archive/2026-10-31-quota-share-design.md](../99-archive/2026-10-31-quota-share-design.md) 與 [99-archive/2026-10-31-quota-share.md](../99-archive/2026-10-31-quota-share.md)。

## 決定

- 一個帳號一週多少美元不再手填：`lib/station.js` 的 `accountQuota` 替 `quota.accounts` 每一項算 `pp7`（每 1% 週額度幾美元）與 `pp5`（每 1% 5H 額度幾美元），只用該帳號自己的 session。
- `quota.week`、`quota.calibrated` 兩個 profile key、`scripts/quota.js` 與 `lib/quota.js` 的校準函式一起刪掉；設定頁拿掉「一週額度」那一格。
- 佔比只標在單一帳號的金額旁，一律寫成估算；跨帳號加總的金額只寫美元，因為它沒有單一個分母。
- 週報開著製作成本時，`約佔週用量 x%／5H y%（估算）` 從那個 session 的帳號算出；量不到時寫「量不到這個帳號的額度線」。

## 為什麼

`quota.week=$66` 只校準了 10-29 的 6.4 小時，又把兩個帳號的花費除以一個帳號的額度，數字不可信。使用者選了每帳號一個額度，但帳號鍵是看不懂的 7d 重置時刻，手填不實際，所以改用花費頁折線上本來就在量的「每 1% 額度幾美元」。

## 放棄了什麼

- 手填每帳號額度：帳號鍵是 `4 04:00` 這類重置時刻，使用者無從知道該填哪個。
- 時間重疊時改用額度線讀數分攤：一律用 API 價格除以每點美元的估算，不分兩種算法。
- 推估對實際額度變化的量測表：要累積至少一週資料，留在 TODO，等 11-07。
