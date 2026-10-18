---
label: speed
title: gate 空等改開 station
description: gate 等待與使用者不在是 2/13 場最大的時間桶；評估把 profile 的 gate.station 從 off 打開、gate.away 從 hint 改 ask
state: done
done:
  at: 2026-10-19
  sha: f8b20a78
  disposition: done
  session: 1452cf01-6856-4dc9-a1d7-2ba349b40338
---

來源：2026-10-18 判官判決 docs/90-agent/judgements/2026-10-18-plan-parallelism.md 卡點 2 與改法 4。plan-gate-page build 155 分中 gate 等 98 分、deny-posix-helpers 69 分中 33 分、todo-patrol-four 23→73 分無 agent；目前 profile gate.station 是 off（project 設定）、gate.away 是 hint（builtin）。這兩個是使用者的設定，要由使用者決定值：用 task.js profile set gate.station <秒數> --project 與 gate.away ask。完成條件：使用者選定兩個值並寫入 .fankeel/profile.json，下一場有 gate 的 build 記錄 waited 比判決表同型計畫少。

## 完成紀錄

這個專案的設定改成：關卡等超過 120 秒就打開 station 頁面，人不在時改用詢問的方式。

- commit f8b20a78
