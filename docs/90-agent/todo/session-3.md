---
label: session
title: drive.js 寫不進 handoff
description: drive.js 用 acceptEdits 跑 claude -p，站寫 .fankeel/build 的 handoff 被當 sensitive file 拒絕，driver 停在 status 無法交棒 — [drive.md](docs/90-agent/reference/drive.md).
state: ready
link: docs/90-agent/reference/drive.md
---

來源：2026-10-15 drive.js 第一次實跑（session-2；session 8a06683b，一輪 build，$0.47）。claude -p --permission-mode acceptEdits 下，Claude Code 把 .fankeel/build/task-<started>/build.md 的 Write 與 Edit 都以 sensitive file 拒絕，build 站回報 blocked，drive.js 因找不到 handoff 停在 status。見 docs/90-agent/reference/drive.md 第 20 行與 scripts/drive.js 的 spawn 參數。

要做成：找出讓 headless 站寫得進 handoff 的辦法——換權限模式、用 --allowedTools 或 settings 的 allow 規則放行該路徑，或把 handoff 寫到非點開頭的目錄——選一個改進 drive.js，再用 --max-rounds 2 --max-usd 2 重跑一次。

完成條件：被驅動的站寫出帶 status 的 handoff，且 drive.js 走到 gate。
