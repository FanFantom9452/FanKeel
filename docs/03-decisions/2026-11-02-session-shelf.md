---
status: decision
last_verified: 2026-11-02
---

# 已結束的 session 搬到架子，不刪（11-02）

一句話：已經結束 14 天以上的 session 條目，連同它自己的 build 目錄，可以用 `scripts/shelf.js run` 原樣搬到 config 目錄下的 `fankeel/shelf/`，並用 `node:sqlite` 建一份索引。station 歷史頁、profile、settingsuggest、`show --all`、週報和 adopt 都照樣看得到被搬走的條目。

設計與計畫在 [99-archive/2026-11-02-session-shelf-design.md](../99-archive/2026-11-02-session-shelf-design.md) 與 [99-archive/2026-11-02-session-shelf.md](../99-archive/2026-11-02-session-shelf.md)。

## 決定

- 架子放在 `<config 目錄>/fankeel/shelf/<根目錄名>-<路徑雜湊>/`，底下的 `sessions/` 與 `build/` 跟 repo 裡的形狀一樣。不叫 archive，是因為 `scripts/archive.js` 已經用來封存 plan。
- 搬移條件是 `active: false`、有 `ended`，而且 `updated` 早於 14 天前。build 目錄跟著擁有它的條目一起搬；還有留下的條目指向同一個目錄時，那個目錄不搬。TODO 原本寫「任務已有 record 才搬 build」，但量過 272 筆舊條目沒有一筆帶 `record`，照這個條件一個都搬不動。
- 搬移是先複製、比對檔案數和位元組數，相符才刪來源，因為 config 目錄和 repo 常在不同磁碟。檔案不壓縮，讀者照樣直接 `JSON.parse`。
- 索引只給 `shelf.js find` 查找，壞掉不影響任何畫面。`engines` 從 `>=22.5` 提到 `>=22.13`，因為從這版起 `node:sqlite` 不需要旗標。
- 讀者要帶 `readAll(root, { shelf: true })` 才會讀架子，不帶時行為和以前一樣。adopt 在本地找不到條目時，會先從架子搬回再接手。
- 不會自動執行，hook 不會呼叫它。

## 為什麼

- 舊條目塞滿 `.fankeel/sessions/`，每個讀 registry 的畫面都要逐筆讀；但不變式 4 不准刪 session 檔，所以只能搬，不能刪。
- 放在機器層級而不是 repo 裡，是因為搬出 repo 才能讓 repo 變小，而同一台機器的 station 與週報仍讀得到。

## 放棄了什麼

- 直接刪舊條目：違反不變式 4，也會讓週報和 spend 少算。
- 壓縮存檔：省空間，但每個讀者都要先解壓。
- 自動在 hook 裡搬：搬移要比對兩個磁碟，放在每個 prompt 太慢。

## 沒做的

- `lib/spend.js:120` 還沒帶 `{ shelf: true }`，因為那個檔案被「移除 station tour」的 session 佔著，它的測試先標成 `todo`。`scripts/render.js:263` 的 22.5 註解也是同樣原因沒改。
- 還沒在 fankeel repo 上實際跑過 `shelf.js run`。
