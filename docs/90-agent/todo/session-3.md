---
label: session
title: drive.js 寫不進 handoff
description: drive.js 用 acceptEdits 跑 claude -p，站寫 build 目錄下的 handoff 檔被當 sensitive file 拒絕，driver 停在 status 無法交棒 — [drive.md](docs/90-agent/reference/drive.md).
state: done
link: docs/90-agent/reference/drive.md
done:
  at: 2026-10-15
  sha: 3b0ad809
  disposition: done
  session: fda998ce-624c-4573-960f-ed4fcb937951
---

來源：2026-10-15 drive.js 第一次實跑（session-2；session 8a06683b，一輪 build，$0.47）。claude -p --permission-mode acceptEdits 下，Claude Code 把 .fankeel/build/task-<started>/build.md 的 Write 與 Edit 都以 sensitive file 拒絕，build 站回報 blocked，drive.js 因找不到 handoff 停在 status。見 docs/90-agent/reference/drive.md 第 20 行與 scripts/drive.js 的 spawn 參數。

要做成：找出讓 headless 站寫得進 handoff 的辦法——換權限模式、用 --allowedTools 或 settings 的 allow 規則放行該路徑，或把 handoff 寫到非點開頭的目錄——選一個改進 drive.js，再用 --max-rounds 2 --max-usd 2 重跑一次。

完成條件：被驅動的站寫出帶 status 的 handoff，且 drive.js 走到 gate。

## 完成紀錄

drive.js 驅動 fankeel 自己時，改用一份 HEAD 的 worktree 複本當外掛目錄，因為 Claude Code 不准寫進載入中外掛自己的目錄；回答 gate 之後，drive.js 以被驅動那個 session 的身分呼叫 task.js，所以換站不再被拒。10-15 重跑：build 換到 verify、最後收工，兩輪共 0.93 美元。被驅動的站仍跑不了 node，另記成 session-4。

- commit 8d076c2b
- commit f5facd19
- commit 76f02039
- commit 76b09795
- commit 3b0ad809
- commit 5f18134e
- commit 17a38bda
