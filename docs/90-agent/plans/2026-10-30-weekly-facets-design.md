---
status: design-intent
last_verified: 2026-10-30
---

# 週報：每日量開關、面向與受眾篩選、提問與回覆、製作成本 — design

一次把週報功能做齊：出頁時決定每日量與製作成本要不要出現，完成卡片可依面向與
一般／技術篩選，報告底部有本週想請教的問題，從站台打開時可當場存回覆，之後開
fankeel 任務能查到「哪週、哪個專案、問了什麼、回了什麼」。
mockup：`.fankeel/build/2026-10-30-weekly-facets/mockup.html`（未提交）。

今天的狀態：`skills/fankeel-weekly/SKILL.md` 開頭只問區間與 Repo；
`lib/weekly-render.js` 的 `timeline()` 畫逐日 commit 數，`card()` 給進行中卡帶
更新時間；events 沒有分類欄位；`guard` 拒絕任何金額；站台
（`scripts/station.js:694`）只列出與打開週報，從不寫入。任務卡換算額度不在此，
見 TODO「任務卡換算週用量與 5H 額度」。

## 1. 出頁時的兩個開關

- `/fankeel-weekly` 開頭的 AskUserQuestion 多一題「顯示」，multiSelect：`每天的工作量`、`製作成本`，兩者預設都不勾。
- 選擇寫進 events.json 的 `show: { daily, cost }`；缺欄位視為 `false`，舊歸檔重畫結果不變。
- `show.daily` 為 false 時不畫 `timeline()`，進行中卡也不印 `updated` 與 `times`。

## 2. 面向與受眾

- 面向詞表是設定值，預設六個，各帶受眾：商業／產品、文件／流程為 `general`；使用者介面、研究／實驗為 `both`；後端／資料、維運／工具為 `tech`。使用者可改名、增刪、改受眾。
- 每個 event 多 `facets: [...]`（一到多個，必須在詞表內，render 拒收詞表外的名字）與選填 `tech`（一到三句技術細節）。
- 寫 events.json 的 session 依卡片內容自己挑面向；Gate 1 的確認清單列出每張卡的面向，使用者可改。
- 頁面「做了哪些事」上方是面向 chip（只列本週出現的，帶張數），頁首右上「一般／技術」切換，預設一般：一般顯示含 `general` 或 `both` 的卡，技術顯示含 `tech` 或 `both` 的卡，並展開 `tech`、模組 chip 與依據。
- 篩選是頁內少量 JS；沒有 JS 時篩選列與切換不出現，所有卡與技術細節攤開。
- `tech` 段落仍過 `guard`：可寫檔名與做法，不可寫 session、gate、UUID 與金額。

## 3. 提問與回覆

- events.json 多 `questions: [{ id, repo, text, reply?, repliedAt? }]`；空陣列時整塊不畫。
- 題目在 Gate 1 由使用者打字；session 也可從本週 TODO 的 Blocked／Needs a decision 預擬，使用者刪改後才寫入。
- 寄出的單檔與直接開檔時回覆欄唯讀，顯示已存回覆或「尚未回覆」。
- 從站台 `/station/weekly/<date>.html` 打開時回覆欄可輸入，「儲存」以 POST 寫回 `<configDir>/fankeel/weekly/<date>.json` 該題的 `reply` 與 `repliedAt`，再重畫該週 HTML；失敗時顯示錯誤，不吞掉。
- 寫入只接受已存在的週報與已存在的題目 id，回覆文字長度有上限；只在站台本機或 Tailscale 位址上服務，與站台其他寫入同一套限制。
- `weekly.js questions [--repo R] [--near YYYY-MM-DD] [--grep 詞] [--answered]` 列出符合的問答，一行一題：日期、專案、問題、回覆。
- `/fankeel` 開場的 INIT 提到這個指令：使用者說「某週週報提到的問題」時，用它查，選中的問答帶進 `task.js start --task`。

## 4. 製作成本

- `show.cost` 為 true 時頁尾多「製作成本」區塊：產生這份週報的 session 依模型分列 token，換算 API 等價美元，另一行灰色「約佔週用量 —%／5H —%」留給額度換算。
- 算法沿用 `scripts/record.js:93` `costLine` 的路徑（對話檔 → `usage.summariseTree` → `lib/prices.js` `costOf`），抽出不依賴 registry 的共用函式，兩邊共用。
- `render` 收 `--session <id>`；`guard` 只對這個區塊開金額例外，其他區塊照舊拒絕。
- SKILL.md「no spend」那句改寫成：成本只在開關打開時出現在頁尾。

## 不做

- 任務卡換算額度與量測表（另一筆 TODO，等花費頁折線圖 land）。
- 在寄出的單檔裡存回覆——沒有地方可以存。
