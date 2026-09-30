---
label: quota
title: 7d 水位差 4.7 倍的成因
description: 7d 水位兩點差 4.7 倍，是延遲還是計別的：TokenBar 每次 render 已把 5h／7d 讀數 append 到 `<CLAUDE_CONFIG_DIR>/tokenbar-usage.jsonl`（TokenBar 的 `statusline.ps1`／`.sh`），拿第三點以後的序列來分 — [scripts/spend.js](scripts/spend.js).
state: blocked
link: scripts/spend.js
group: TokenBar 寫出真實序列
timing: after: `tokenbar-usage.jsonl` 有跨過一次 7d reset 的真實讀數；09-25 查到的 347 行全落在 09-22 的 15 分鐘內，是測試資料，09-23 起沒再寫
stamp: 2026-09-30
---
