---
label: foreign
title: 在別的專案跑一週，數崩壞
description: 評審第六條：證據幾乎全來自這一個 repo；挑 KilnPC、EMU3000_Web、PaperResearcher、claude-kit 或 sec-test 其中之一用 fankeel 跑一週，再用 `scripts/sessions.js --breakdowns` 數崩壞 — [sessions.js](scripts/sessions.js).
state: blocked
link: scripts/sessions.js
group: 在別的專案跑一週
timing: after: 一個不是 fankeel 的專案用 fankeel 跑滿一週
stamp: 2026-10-16
---

來源：2026-10-09 工作流評審第六條（docs/90-agent/reports/2026-10-09-workflow-review.md）與同日 design 第 6 節。量具已在：node scripts/sessions.js --breakdowns --project <slug> --since <date> 數 verify 退回 build、沒到 land 就 stood down、fankeel hook 拒絕的 tool call、hook 逾時或出錯，每筆附時間。要做的：挑一個本機已有 .fankeel 的非 fankeel 專案，一週內的任務都走 fankeel；一週後跑上面那行，refused 已於 2026-10-09 對本機 transcript 核對過，正規式現在兩種形狀都吃；這一週還要核對的是 hookErrors 陣列裡一項長什麼樣，目前只見過空陣列。完成條件：docs/90-agent/reports/<date>-foreign-week.md 寫出四個數字與每筆的 session id，結論一句：這套設計在別的 repo 上崩了幾次、哪一種最多。
