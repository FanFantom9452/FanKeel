---
label: spend
title: 主對話 1h cache write 佔 29%
description: 主對話的 1h cache write 一週 $732.51(29%),要決定是否加閒置或離開前壓縮,以及回報長度上限。
state: blocked
link: scripts/spend.js
group: 一週後重量花費
timing: on: 10-27
stamp: 2026-10-20
---

來源:連結的 judgement 與 docs/90-agent/judgements/2026-10-18-main-session-cost.md。主對話 1h cache write 一週 $732.51,約七成是每回合新增內容(agent 回報、跨 session 轉送、工具結果),19% 是 1h TTL 過期後整段重寫。注意:在 1h 前壓縮不會省掉寫入,因為壓縮本身就要重寫新前綴;能省的是 (a) 縮短每回合新增內容(回報長度、轉送),(b) 使用者離開前、context 大時先壓縮,讓過期後重寫的是小前綴。現況 gate.away(lib/profile.js、hooks/gate.js、hooks/resume.js)只在 gate 問到且回答要離開時才壓縮,沒有閒置觸發。要決定:要不要加閒置或離開前壓縮、要不要設回報長度上限。完成的標準:選定方案,並量出 1h write 佔比下降。

2026-10-20 落地：agent 回報超過 3000 字退回一次，跨 session 訊息超過 2000 字退回；回答「要離開」後下一個問題擱著，在那裡壓縮。2026-10-27 重量 1h cache write 佔比。
