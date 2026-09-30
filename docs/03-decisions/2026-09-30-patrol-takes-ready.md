---
status: decision
last_verified: 2026-09-30
---

# 盤點併入 Ready（09-30）：決策紀錄

一句話：`/fankeel` 開場不再單獨列 `## Ready` 選項；「TODO 全表盤點」是唯一入口，盤完直接照 plan 做 Ready 與其他可做的條目，route 固定為 `survey,plan,build,verify,land`。

## 定了什麼

- 使用者要「全表盤點後直接進入實作」，在 design 閘門從三種做法裡選了「併入 Ready」：拿掉 Ready 選項，而不是只讓 survey 在沒待決題目時跳過 gate。
- route 固定帶 `plan` 與 `verify`：Ready 超過一條就需要 plan 檔當 ledger，所以不再讓 survey 臨時用 `task.js route` 加寬。
- orient 的選項名額不再替 Ready 留一格，`## Needs a decision` 有盤點時最多列三條（`scripts/orient.js` 的 `limit`）。
- todo-3（完成的條目顯示在哪）定為 station 一欄；專案頁的 `todoPanelHtml` 已經畫「已完成」區塊，所以沒有新程式，land 時以已存在結案。

## 沒做什麼

- data-1（NAS 資料檔）使用者決定先不做，留在 Needs a decision。
- await-1、skills-1 要重裝插件、開新 terminal 才能驗；station-8 要在 8806240d 之後的 session 量測。三條都留在 Ready，由下一次盤點做。
- verify 留下兩個缺口：station 已完成區塊沒實際畫出來看；`tests/skills.test.js` 的 build 段落缺一條 `doesNotMatch(/survey,build,land/)`。

## 在哪

設計與 5 個 task：`docs/99-archive/2026-09-30-patrol-takes-ready-design.md`、`docs/99-archive/2026-09-30-patrol-takes-ready.md`；落地範圍 a1623c04..6686875d。
