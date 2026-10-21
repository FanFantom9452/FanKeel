---
status: decision
last_verified: 2026-10-21
---

# 盤點三件：await 不略過問題、gate 選項數、land 白話選項

一句話：await 會說清楚交接檔為什麼沒有可用的問題，gate hook 在檔案 gate 自己的標題下也檢查選項數，land 收尾改成「收工、還剩什麼、匯出並回顧、暫停」四個白話選項，回顧跟著匯出一起跑。

計畫在 [2026-10-21-patrol-three.md](../../99-archive/2026-10-21-patrol-three.md)。

## 做了什麼

- `scripts/await.js` 遇到交接檔沒有可用的 questions 時印一行原因，不再默默略過（2b491589、4bc29837）。
- `hooks/gate.js` 把檔案 gate 的第一個標題也當成一次作答，少抄選項會被擋（7bbed31f、44f6eb39）。
- land 的 gate 改成四個白話選項，預設是收工；「匯出並回顧」說明會匯出對話、接著回顧哪裡可以改進並列出建議給使用者核准，畫面上不再出現 retro 這個字（9aadd00f）。
- 回顧不再另外問一次，使用者選了匯出就接著跑；brain、retro 兩個 agent 檔與 pipeline 頁跟著改（5101debe）。

## 沒做什麼

- 「舊字測試」與「source 孤兒」兩筆要判官裁決，需要使用者自己下 `/fankeel-ask`。
- 待辦檔 test-1 第 38 行仍指向已移動的 `tests/await.test.js:561`；那是歷史觀察紀錄，保留不改。
- 收尾框（wrap_up）送上監控站只做了可行性實測：hook 確實會觸發並帶完整內容，實作排在下一件。
