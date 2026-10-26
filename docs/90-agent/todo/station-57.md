---
label: station
title: station 列出未登記 session
description: station 列不出沒跑過 /fankeel 的本機 session（如 Quick-IME 的 Desktop 分頁），也不顯示 Remote Control 連線
state: done
link: lib/live.js
group: station 展開面板調整落地
timing: if: 隔壁「station 與 notification 展開面板太小、不能調整大小；手機版畫面一併調整」任務 land 了
stamp: 2026-10-26
done:
  at: 2026-10-27
  sha: f53c505d
  disposition: done
  session: add1373d-aba2-45e0-8598-d8ece9d778bc
---

來源是判決 docs/90-agent/judgements/2026-10-26-station-desktop-rc-sessions.md（session 9da0b5f6）。

現況：station 每列只來自 registry entry（lib/station.js:527）；lib/live.js:105 的 runningSessions 只留 sessionId/cwd/startedAt，丟掉 bridgeSessionId/entrypoint/name/status；沒有 .fankeel registry 的專案（如 Quick-IME）在 discover() 進 gone（lib/station.js:170）。Desktop 分頁與 CLI 同寫 ~/.claude/sessions/<pid>.json，所以資料本機就有。

要變成：live.js 多留那些欄位、station gather 為未登記的 live session 造「未登記」列、有登記列顯示 RC 連線點。先決定未登記列要不要受 station.hide 約束。別台機器與雲端 session 不在範圍（本機無來源）。

done 的樣子：現在 Quick-IME 這種未登記 Desktop session 出現在 station 進行中頁，RC 連線狀態可見，tests/live.test.js 補上欄位測試。

## 完成紀錄

進行中頁列出沒跑過 /fankeel 的 session，已結束但仍掛 Remote Control 的也列入，並遵守 station.hide. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-26-add1373d)

- commit f53c505d
- commit 2553e128
- commit 31befcc1
- commit 20f02536
