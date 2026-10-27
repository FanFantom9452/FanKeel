---
status: decision
last_verified: 2026-10-27
---

# TODO 全表盤點第二輪（10-27）：做了什麼、沒做什麼

一句話：`quota.js` 改讀 fankeel 自己寫的 5h／7d 額度記錄；手機回答框可以附照片；focus 頁的計畫摺疊區把 markdown 畫出來；站台的 days 頁拆成自己的模組 `FK_DAYS`；layout.md 補上板子、chartroom、週報幾列與一張框架圖。

一份計畫：[2026-10-27-todo-patrol-2.md](../../99-archive/2026-10-27-todo-patrol-2.md)（11 個任務，任務 11 略過）。

## 盤點

盤點走過 Ready 的 10 條。使用者要我先列出要做哪幾條，看過後核准七條：build-15、docs-11、entry-4、quota-2、station-52（這輪只拆 days 頁）、station-60、station-62。另外三條要使用者決定：compact-7 接受並結案，spend-6 再量一週（11-03），await-16 加 stalled 判斷、移到 Ready。

## 做了什麼

- build-15 的板子截圖條件併進 station-61：`89011b7b`。build-15 以 abandoned 結案。
- compact-7 結案（measured-no-change）、spend-6 改 11-03、await-16 移到 Ready：`81a0db0b`、`2e5ca4ee`。
- `quota.js` 讀 `.fankeel/build/limits/*.jsonl`：`650bd88f`、`83183e3e`；quota-1 與 spend-2 的條目改成等這份記錄：`86bfcfe8`、`4f75c053`。
- layout.md：`64a8a53c`。
- focus 頁計畫摺疊區的 markdown：`1e2d4bd7`、`e50741fa`。
- 手機附照片：`POST /phone/upload` 在 `b2a5dfc3`，回答框與 gate 卡在 `82fea970`。修正：413 回給客戶端、檢查副檔名與檔頭、不覆寫（`f9627ddd`）；超過 64 MB 不再讓站台掛掉（`b7c184cb`）；手機排版（`2220230f`）。
- days 頁拆成 `assets/station/days-page.js`：`3bbb316d`、`dd6d0522`、`195a7cf1`、`15fea6fd`。
- 收尾的引用與註解修正：`3ee4ce19`。

## 驗過、沒驗過

- 快速套件 5654 過、docs-check 乾淨、對抗審查沒有推翻任何一條。
- 沒有截圖：任務 6–10 的 render 由使用者決定略過，所以計畫摺疊、手機附圖、days 頁都沒有截圖證據。

## 沒做什麼

- entry-4 的真 gate 一輪（任務 11）：使用者略過，條目維持開放。
- station-52 只拆了 days 頁，列表頁與詳細面板留到下一輪，條目維持開放。
