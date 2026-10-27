---
label: await
title: agent 卡住要偵測 stalled
description: stage agent 說自己在等背景工作卻已久無任何寫入，await.js 只會在逾時後印 lost，沒有 stalled 的判斷與固定處置 — [scripts/await.js](scripts/await.js).
state: ready
link: scripts/await.js
---

來源：2026-10-27 任務「週報 skill design」，fankeel-brain 的 build agent 卡住兩次。(1) group 2 超過 30 分鐘沒有進度，主控停掉它，改派帶續作備註的新 build group 2，後者完成。(2) 第二輪 build agent 最後 commit 在 13:17，它的 implementer worktree（agent-ac350022849c5b060）13:19 後沒再寫入，留著 4 個未 commit 的檔案；agent 一直回報在等自己的背景工作，await.js 在 13:35 印出 lost 並寫了 build-2-failed.md；用 SendMessage 叫醒後它又直接回去等；13:43 經使用者同意停掉並重派續作。同一任務另有 await.js 的雜訊：ledger 的 group 編號位移後，仍在跑的 agent 被印成 lost；重複的 await 印出 already awaiting。已做過的相關工作不重複：記錄「分析 plan/build stage agent 意外暫停的原因」（docs/90-agent/records/2026-10.md#r-2026-10-22-e9bbb2be）與 stop-1、await-5、await-10、stage-agents-14，都沒有涵蓋卡住的偵測；scripts/await.js 只有 lost（閒置逾時）與 already awaiting。要做成：以可量測的訊號判斷卡住 — 任務目錄、agent 的 worktree、git 三處在 N 分鐘內都沒有寫入，而 agent 仍回報在等待 — await.js 印出獨立的 stalled 行，不與 lost 混用；並寫明主控的固定回應：先用 SendMessage 提醒一次，仍無進展就停掉並派新的 agent，交接內容列出已 commit 的範圍與未 commit 的 worktree 路徑。完成條件：上述偵測與 stalled 輸出實作完成，回應步驟寫進 stage 規則文件，並有測試證明等待但閒置的 agent 被報為 stalled、仍在寫入的 agent 不會。

2026-10-27 決定：做。await.js 在 worktree 與 handoff 都久無寫入時印 `stalled`；固定處置是先用 SendMessage 叫醒一次，仍無進展就停掉重派，交接時列出已 commit 的範圍與未 commit 的 worktree 路徑。
