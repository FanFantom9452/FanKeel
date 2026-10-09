---
status: design-intent
last_verified: 2026-10-10
---

# 03-decisions 只收決策，由腳本守成給人看的頁 — design

一句話：land 只在真的做了取捨時寫決策頁，其餘收尾紀錄改寫成 report；docs-check 把 01、02 已有的白話檢查延伸到 03，再加一道骨架檢查；約 31 頁 TODO 盤點日誌搬出 03，留下的決策頁碰到才改。

使用者 2026-10-10 在 design 定了三題：03 只收真正的決策；腳本守白話與固定骨架；日誌搬走、決策頁碰到才改。

## 現況

- `audience` 樹形（`lib/docs.js:93-108`）把 `docs/03-decisions` 標成 `audience: human`，但 `lib/plain.js:83` 的 `proseFindings` 只檢查 `role === 'reference'` 的人讀頁，role 為 `decision` 的 03 整個不查。
- land 規則在兩處要求每個 landed plan 留一份 decision record：`lib/stages.js:402-403`（注入）與 `skills/fankeel-land/SKILL.md:95`。TODO 盤點也因此在 03 生頁。
- 79 頁中約 31 頁是盤點或批次日誌；有「一句話」開頭的 39 頁，三段標題齊全的 4 頁（`2026-09-13-no-output-styles.md` 是範本）。

## 1. land 的紀錄分流

- land 的注入規則與 land skill 改成：任務在 design 選過做法、或推翻了先前的決定，才寫 decision record；其餘（盤點、批次修補）寫一份 report 到 `role: report` 的 bucket，本 repo 是 `docs/90-agent/reports/`。
- 改動後 `lib/stages.js` 的注入長度仍在現有上限內，由既有的 stages 測試守。

## 2. 決策頁的檢查

- `proseFindings` 對 `role === 'decision' && audience === 'human'` 的頁跑和 01、02 相同的長句與裸代碼檢查。
- 新增 `decision-shape` finding：本文第一個非空行以 `一句話` 或 `In one sentence` 開頭，且有 `## 決定`、`## 為什麼`、`## 放棄了什麼` 三個標題（英文頁為 `## Decision`、`## Why`、`## Given up`）。
- 只對 `last_verified` 不早於規則生效日（常數 `DECISION_RULE_FROM = '2026-10-11'`，以實際落地日為準）的頁生效；舊頁改動時把日期改到當天，檢查就套上——這就是「碰到才改」。

## 3. 日誌搬出 03

- plan 逐頁讀過，列出搬走清單（檔名含 todo、patrol、ready、batch、sweep 等的約 31 頁，逐頁確認內容是「這一輪做了什麼」）。
- 用 `scripts/docs-move.js` 搬到 `docs/90-agent/reports/`，由它改寫全 repo 的連結；不手搬。
- `docs/README.md` 的決策段落改成依主題分組，只列留在 03 的頁；搬走的頁列在 reports 段。

## 4. 文件同步

- `docs/90-agent/reference/plain-language.md` 寫入決策頁的骨架與生效日；`skills/fankeel/SKILL.md` 的 role 表 `decision` 一列補一句人讀頁的骨架。

## 驗收

- 會先紅後綠的測試：`tests/` 下 `proseFindings` 的測試——一份 `last_verified: 2026-10-11`、缺三段標題的 decision 頁回報 `decision-shape`；同內容但日期 2026-10-01 不回報；三段齊全的不回報。
- 成品檢查：在本 repo 跑 `docs-check.js`，03 沒有任何 `decision-shape` finding、沒有死連結；`ls docs/03-decisions` 不再有搬走清單上的檔；搬走頁的連結數在搬前搬後相同。

## 未驗證

- `docs-move.js` 一次搬 31 頁、改寫上千處連結，是否不撞 `tests/sources-doc.test.js` 的 basename 規則與另一個進行中 session 對 `docs/README.md` 的改動。
