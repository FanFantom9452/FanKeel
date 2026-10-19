---
label: station
title: 最貴 session 前 N 名
description: 依所選區間列出花費前 N 名 session，點進對話頁
state: done
link: assets/station/station.js
done:
  at: 2026-10-20
  sha: 3e55350b
  disposition: done
  session: 45487ab9-c8fc-44c7-a0db-d46d41bb4796
---

來源：2026-10-19 使用者要求監控站顯示花費成分，本週判斷書（連結）。
要做什麼：目前站上看不出一週的錢花在哪幾個 session。依所選區間（見週與自訂區間那條）列出前 N（預設 10）的 session，欄位：session、專案、首則使用者訊息一行、USD、佔比、主／agent 拆分、主回合數、平均與峰值 context；點進去到該 session 對話頁。
完成條件：本週前 10 與判斷書表五一致。

## 完成紀錄

列出最貴的 N 個 session，點下去打開它的對話分頁。 詳見[任務紀錄](../records/2026-10.md#r-2026-10-19-45487ab9)

- commit 3e55350b
- commit 702bb349
