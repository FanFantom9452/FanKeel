---
label: await
title: 收尾的 group 仍留 inflight
description: group 1 收尾後 inflight 仍在、group 3 被標成 group 2，await.js 要 --agent 才等得到；build close 報告又把舊 ledger 算進去寫成 17 tasks — [hooks/brief.js](hooks/brief.js).
state: ready
link: hooks/brief.js
---

The mark, numbering and `--agent` halves landed with this entry's fix. The "17 tasks" half is still open: no site that counts a previous plan's ledger tasks into a build close report has been found, so it needs to be found before it can be fixed.
