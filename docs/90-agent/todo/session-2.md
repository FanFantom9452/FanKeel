---
label: session
title: drive.js 第一次實跑
description: drive.js 只用假的 claude 測過；還沒用真的 claude -p 跑過一站，不知道 acceptEdits 下 brain 寫不寫得進 build 目錄的 handoff，也不知道 total_cost_usd 是否每輪都有 — [drive.md](docs/90-agent/reference/drive.md).
state: blocked
link: docs/90-agent/reference/drive.md
group: driver 實跑
timing: after: 有一個要跑的任務選擇交給 drive.js
stamp: 2026-10-13
---

來源：2026-10-10 TODO 盤點（session-1 結案時）。verify 確認 drive.js 的每條路徑都只由假 spawn 測過；設計的 Unverified 一項（acceptEdits 下能不能寫 .fankeel/build/）仍未驗證。10-10 使用者用 claude --debug 在 auto mode 寫同一個資料夾是放行的，但那是主 session、不是 claude -p 加 acceptEdits。

要做成：挑一個小任務，用 node scripts/drive.js --session <id> --max-rounds 2 --max-usd 2 跑一站，看停下那行 JSON 的 stopped、usd 與 handoff 檔。

完成條件：一站跑完並讀到帶 status 的 handoff，或停下的原因查清楚並寫回 drive.md。
