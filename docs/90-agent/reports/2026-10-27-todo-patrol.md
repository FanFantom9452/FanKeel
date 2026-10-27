---
status: decision
last_verified: 2026-10-27
---

# TODO 全表盤點（10-27）：做了什麼、沒做什麼

一句話：fankeel 自己把每個 session 的 5h／7d 額度變化記下來，`limits.js` 可以把它讀成表或畫成 SVG；`sessions.js` 報單一 session 的最高峰值與最大跳幅；`usage-compare.js` 報 1h cache write 佔花費的比例；站台的 eyebrow 小標與過期提示列拿掉大寫字距和左側邊條；使用指南補上 gate 頁的板子編輯。

一份計畫：[2026-10-27-todo-patrol.md](../../99-archive/2026-10-27-todo-patrol.md)（9 個任務）。

## 盤點

盤點走過全部 38 條開放條目（survey.md），六條可做、三條要使用者決定。使用者把手機版重新設計排成自己的 design 任務、Desktop 元素選取先試做、station.js 拆模組排成下一個任務；另外加了一件：記下 5h／7d 額度隨時間的變化並畫圖，因為有人質疑他的數字。使用者明說不要依賴 TokenBar，所以記錄由 fankeel 的 pane 自己寫，不碰 statusline 與 `tokenbar-usage.jsonl`。

## 做了什麼

- 工具參數中文轉義的一週數字寫回條目：`dd5364a6`。AskUserQuestion 2/1127（修前 11/1161），`__unparsedToolInput` 0，可以結案。
- 三條 Blocked 重蓋日期：`ccc9b700`。
- `sessions.js` 的最高峰值與最大跳幅：`423dc2f2`。SBIR 一週最高峰值 418279，超過 compact.at 350000 共 68279；這個超出能不能接受還沒判斷，條目維持開放（`a204fa7c`）。
- `usage-compare.js` 的 1h cache write 佔比：`dfbc36a3`。兩週比較是 28% 降到 18%；只記前後差，沒有證明下降是 10-20 的措施造成的，條目維持開放（`a204fa7c`）。
- 使用指南補板子編輯，決策紀錄補前向連結：`8f973700`。
- 站台 eyebrow 與過期提示列：`eab0d2dd`。
- 5h／7d 額度記錄：`52d0b852`、`efa884c0`，寫到 `.fankeel/build/limits/<session>.jsonl`，按 session 去重。`limits.js`：`0f8d321a`、`7ae8199a`。`quota.js` 改讀這份記錄另開一條。
- 真瀏覽器與手機（使用者親手）：`d380e46e`、`3362257a`。板子編輯在真瀏覽器可以用，移動 6 次都寫進板子檔；手機上 eyebrow 看起來對了。

## 沒做什麼

- gate 板子面板缺真截圖：headless 截圖的板子是空的，412 寬會溢出，「選取」字太淡。條目維持開放。
- 過期提示列的左側邊條：手機畫面上沒有過期 session，所以沒看到。條目維持開放。
- 使用者說板子編輯不夠順、不夠視覺化，要改用 icon：另開一條，參考之前 Chartroom 的互動。
- 手機版回答框不能附圖片：另開一條。
- 快速套件唯一的紅來自鄰近 session 尚未提交的 judgement 檔（週報 skill），不是這輪的變更。
