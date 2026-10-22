---
label: station
title: 非 live 的待答在手機首頁消失
description: session 已不在跑但 gate 還掛著時，mobile.json 的 gates 有它，新首頁卻沒有任何一列顯示
state: done
link: assets/station/mobile.js
done:
  at: 2026-10-23
  sha: aa63ffda
  disposition: done
  session: 6bedeb94-1482-4af2-8d8f-049b6d29c923
---

來源：2026-10-22 手機頁接上 session 任務 build 第 4 組的審查（.fankeel/build/task-20261022T065333/build-g4.md），記為 ruling 未改。新首頁的「等你答」列只從 live 的 tasks 來，lib/mobile.js 的 gates 裡屬於已停 session 的待答不會出現。要決定：首頁另開一組顯示這些待答，還是視為過期不顯示並在桌面 station 處理。完成的標準：決定寫進 docs/90-agent/reference/station.md 的手機頁段落，若顯示則有路由測試斷言它出現在首頁。

## 完成紀錄

停了但 gate 還掛著的 session 在手機首頁自成一組，聊天頁找得到它並有測試擋住. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-22-6bedeb94)

- commit 975ddfd2
- commit 79f287e5
- commit aa63ffda
