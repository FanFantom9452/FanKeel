---
label: await
title: kind 只在測試裡驗過
description: `kind` 只在測試裡驗過：重裝後看一次真實 `build close` brain 的 mark 是否帶 `kind: 'close'`、await 是否盯 `build.md` — [hooks/brief.js](hooks/brief.js).
state: ready
link: hooks/brief.js
---

09-30 實跑（本 session 的 build close）：await 印出 `build.md` 成立；`inflight` 標記沒有 `kind`，帶 `group: 6`，前一組的標記沒被清掉。見 [決策紀錄](../../03-decisions/2026-09-30-ready-eleven.md)。
