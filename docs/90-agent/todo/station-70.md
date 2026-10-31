---
label: station
title: 量測表：估算對實際額度
description: 做一張量測表，比對任務卡估算的額度佔比與實際額度線的變化，需至少一週資料
state: blocked
link: assets/station/quota-share.js
group: 累積一週額度資料
timing: on: 11-07
stamp: 2026-11-01
---

來源：使用者 2026-10-30 在「weekly 每日量開關、面向篩選、製作成本」任務中提出，原話「之後要做個量測表」。任務卡顯示、quotaShare 與週報製作成本區塊已在 0.141 的工作中出貨（commit 378a4ae3..07470806）。估算本身由 session 6ff5bdb2 依 docs/90-agent/plans/2026-10-31-quota-share.md 出貨，但尚未拿真實額度驗證。要做成的東西：一張表，每列是一個任務卡，並排它由 quotaShare 估出的週與 5H 佔比，以及同一帳號額度線上實際的變化。完成條件：表中累積一週以上的列，且每列都標出估算與實際的差距，據此判斷估算準不準。
