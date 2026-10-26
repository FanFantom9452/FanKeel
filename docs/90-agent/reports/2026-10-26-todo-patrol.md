---
status: decision
last_verified: 2026-10-27
---

# TODO 全表盤點（10-26）：做了什麼、沒做什麼

一句話：fankeel 不再推播到 ntfy.sh；station 白板改畫 vendored Chartroom；`windows-hide` 掃描器多認六種寫法；409 測試失敗找到原因並修好；設定頁有 全域｜個別 切換、專案清單可打字過濾；監控站列出沒跑過 /fankeel 的 session（未登記）與 Remote Control 標記。

一份計畫：[2026-10-26-todo-patrol.md](../../99-archive/2026-10-26-todo-patrol.md)（18 個任務）。

## 盤點

盤點走過全部 40 條開放條目（survey.md），七條可做、兩條要使用者決定。使用者核可小件組，加上 409 追查、設定頁切換與未登記 session 兩件。

## 做了什麼

- 拔掉 ntfy.sh：`9a03e956`、`b8f568a0`、`040232e8`、`b50b587c`、`756ed8ae`、`41e9d35a`、`fd164976`、`a233443d`、`63c83d9c`、`e59b5c55`、`c4ab3da9`；`lib/notify.js` 與 `scripts/notify.js` 刪除，profile 少五個 notify 鍵。
- 白板走 vendored Chartroom：`9545d783`、`6205f68e`；profile 的 `station.chartroom` 拿掉。
- `windows-hide` 掃描器：`5cc977a4`、`528f39e0`，認得 call/apply、`?.`、逗號改名、註解、正規式、括號預設值與 expression arrow。
- knip 6.43.0 重測：`a65bc115`，仍解不出 `clearBadge`，build-1 維持開放。
- 409 測試：`d33bc9f4`、`286c7899`，原因是 `port: 0` 偶爾拿到瀏覽器擋的 4045，`start()` 換埠重試，失敗訊息帶原因與埠號。
- 未登記 session：`f53c505d`、`2553e128`、`31befcc1`、`20f02536`；ended 但仍掛 Remote Control 的 session 也列入，遵守 `station.hide`。
- 設定頁 全域｜個別：`556ddc02`、`284f33ea`；`phone.hold` 接受 1–1800。
- `render.js --act` 點擊、拖拉、輸入後截圖：`c92a2584`、`225f2a2c`；entry-4 第 1 步在真 station 驗過（`f19327d9`）。
- 收尾行號：`63dd6daa`。

## 沒做什麼

- entry-4 第 2 步（真 gate 上標記 node）：使用者兩次跳過，條目維持開放。
- station-52（station.js 拆模組）與 station-56（/m 手機版）：不在本次範圍；/m 等使用者口述清單。
- build-1：knip 仍解不出，維持開放。

## 驗證

- 快速套件 5435 過 1 失敗於 `63dd6daa`，唯一紅燈是 ntfy 條目尚未關，land 關閉；docs-check 乾淨；對抗審查沒有推翻任何一列。
- 沒檢查：未登記卡片右側欄位在 412／390 寬度；設定頁 `global-foot` 區塊與在選擇器裡打字；設定頁 CSS 在真手機；未登記卡片說明對「已結束但掛 RC」的 session 不準確。
