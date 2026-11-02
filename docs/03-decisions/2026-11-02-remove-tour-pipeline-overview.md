---
status: decision
last_verified: 2026-11-02
---

# station 導覽整組拿掉、pipeline.md 加七階段總覽、gate 圖框放寬（11-02）

一句話：station 的導覽（tour）頁、影片錄製與相關測試整組刪掉，之後再重做；`docs/02-architecture/pipeline.md` 加一張七階段從頭到尾的 mermaid 總覽和一張 hooks 時間軸；gate 頁的圖框不再固定 460px 高，改成依圖的比例決定高度，寬度可以超出 1440px 欄寬。

計畫在 [99-archive/2026-11-02-remove-tour-pipeline-overview.md](../99-archive/2026-11-02-remove-tour-pipeline-overview.md)。

## 決定

- tour 頁、`tour*.js`、`tour.css`、`tour.html`、`scripts/tour-record.js`、promo30 的舊測試和只給 tour 用的 icons 一起刪除；各頁的導覽入口也拿掉。重做記在 TODO「station 導覽之後做回來」。
- 保留 promo30 的決定紀錄、封存頁與已完成的 TODO，這些是歷史，不跟著刪。
- 總覽圖放在 pipeline.md，每一站列出會呼叫哪些腳本、各自在分析什麼；verify 併成 4 個節點，免得圖太長。推斷而未查證的呼叫處標 `(?)`。
- gate 頁圖框高度＝圖原生高 × 縮放（下限 80%），夾在 180px 到 85vh 之間；寬度＝min(視窗寬−48px, 圖原生寬＋24px)，至少原欄寬，置中。手機版不動。

## 為什麼

使用者要先把 tour 清掉，之後再做新的，留著半套只會讓測試和文件繼續指向它。總覽圖是使用者要拿來討論「什麼時候呼叫哪支腳本」，所以畫在架構文件，而不是只在對話裡。圖框是使用者在設計時提出的：直立的總覽圖在固定 460px 的框裡被壓扁、橫向的時間軸又留一大片空白；在 1920×1080 下試過，放寬後總覽圖整張可見。

## 放棄了什麼

- 只把 tour 從導覽列藏起來、程式留著：會留下沒人用的程式和會壞的測試。
- 圖框維持固定高度、只加捲動：直立圖還是要捲很久才看得完，使用者選了放寬。
- 圖太寬時縮小到欄寬：字會小到讀不了。
