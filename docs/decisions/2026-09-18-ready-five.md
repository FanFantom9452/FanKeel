---
status: decision
last_verified: 2026-09-18
---

# TODO Ready 五條 — 決策紀錄

使用者在 `/fankeel` 的選單上選「Ready 五條」，五條當一個任務。路線 survey → plan →
build → verify → land，分支 `ready-five`。land 之前有 10 個 commit：五個任務、build
裡的兩個修正、verify 退回的一個修正，以及 plan 階段的兩個 commit。整套測試從 1512
條變成 1517 條，多出來的五條就是這五個任務新加的測試。

## 一、survey 說錯一件事，在 plan 之前改正

survey 報告說 `VERSION` 沒有測試釘住，但 `tests/detail-cache.test.js` 其實有兩處寫死
`v: 2`。改正之後，這件事併進 Task 1：推 VERSION 的同一個 commit 也改那兩處期望值。

survey 還找到兩件條目本身沒寫的事。第一，`wakes` 要靠同一次 VERSION 推進，舊快取才會
被重讀，所以 Task 2 不另外推 VERSION。第二，`docs/sources.md` 開頭那句數報告份數的話，
加了新列就會變成錯的，所以 Task 5 一起改。

## 二、`tests/sources-doc.test.js` 留著

plan 的 gate 問過這個新守衛算不算多餘，使用者選留著。它只比對 `docs/reports/`
頂層的報告和 `sources.md` 的列是否一一對應，不檢查 Cited by 欄——verify 證實那是另一個
缺口（見第四節）。

## 三、build 的兩個修正和一條 ruling

- Task 2 在 `assets/station/station.js` 和 `lib/detail.js` 一共加了三行，把
  `docs/station.md` 的十處行號往後推。Task 5 之後 docs-check exit 1 才抓到，另開一個
  修正補上。
- Task 3 的 reviewer 砍掉手寫的單複數三元式，改用 `lib/report.js` 的 `plural()`。
- ruling：Task 3 的測試放兩個記憶條目，不照 plan 寫的只放一個。只放一個條目時，就算
  `name` 被丟掉，測試也照樣通過。

## 四、verify：被推翻的三列都是這個 session 自己寫的

七個 verifier 一共回了 46 列，45 列成立。不成立的那一列是 Task 5 的 Cited by 欄：少了
`docs/archive/2026-09-17-needs-decision-all.md`，也少了這支 branch 自己的 plan 和
design。那格是照 plan 抄的，所以漏掉的是 plan。用同一個 grep 量整頁：修完這一列之後，
21 列裡仍有 13 列漏掉 grep 找得到的 `docs/` 頁，但 `docs/sources.md:4` 寫這欄是
「filled by hand from grep」。這一列補齊了，整頁的缺口另記一條 TODO。

兩個 adversary 推翻了三列：

1. 「每個 commit 都審過」被寫成 held，可是證據欄自己就寫著 d33113c 沒人審。
2. 「2cebaa5 已由 plan 的 reviewer 讀過」只對一半：design 和 plan 對得上 transcript，
   但 `docs/README.md` 那兩列索引從來沒放進那份 brief。
3. 第二輪「c7442dc 上 docs-check exit 0」沒有留下帶 HEAD 的輸出檔。重跑並存檔後成立。

前兩列退回 build：派一個 reviewer 事後補審 `68f62d2..d33113c`，回報 clean。ledger
只有 task 和 fix 兩種帶範圍的行，所以這兩個 commit 記成 fix 行，另記一條 ruling 說明
它們不是 verify 退回的修正。根本原因是 `ranges` 從 Task 1 的 BASE 開始算，plan 階段的
commit 一定落在所有列之外；這件事記成 TODO。

## 五、沒做到的

- 第一輪 docs reader 讀了 16 頁、零發現，但沒放對照組。這個零只代表沒找到，不能證明
  它找得到錯。
- verify 只派一個 adversary 看全部七份證據，沒有每列各派一個。每列一個的話是 15 個
  agent，超過這個 session 的 workflow 規模上限（10 個以下）。這一點記成 ruling。

證據放在 `.fankeel/build/2026-09-18-ready-five/`，這個目錄是 gitignored。
