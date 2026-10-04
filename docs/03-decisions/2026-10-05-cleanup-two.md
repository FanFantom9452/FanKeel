---
status: decision
last_verified: 2026-10-05
---

# cleanup-2 前兩項（10-05）：決策紀錄

一句話：`fetchHealth` 改用全域 `fetch`，`lib/profile.js` 自己的 `git` 刪掉改用 `lib/blame.js` 匯出的；cleanup-2 的第三、四項沒做，model-3 與 stage-agents-14 照使用者在 survey 關卡的裁定留在 Ready。

計畫見 [../99-archive/2026-10-05-cleanup-two.md](../99-archive/2026-10-05-cleanup-two.md)。

## 為什麼

- `fetchHealth` 改用 `fetch` 加 `AbortSignal.timeout`：先寫一個會啟動短命子行程的測試，證明它在 3 秒內自己退出，不會被 keep-alive 拖住，才換掉手寫的 http 版本（`lib/serve.js`、`tests/serve.test.js`）。
- 測試與 `lib/serve.js` 的註解只主張「子行程在 3 秒內自己退出」：驗證時 mutator 把預設 keep-alive 改回去，測試仍然綠，所以測試抓不到閒置 socket 這個原因，註解因此改成只說退出時間。
- `lib/profile.js` 的 `git` 輔助函式刪掉，改用 `lib/blame.js` 的 `git`，`docs/01-guide/profile.md` 引用該檔的行號跟著各減 8。

## 沒做什麼

- cleanup-2 的第三項（`lib/detail.js` 的 `readText`）與第四項（三支 script 的 `readFile`）沒做，條目仍在。
- 沒有能抓閒置 socket 的測試；若要守住這點需另寫一個會紅的測試。
- 完整套件 3499 項、3498 通過、1 略過；略過的是哪一項沒有查。
