---
label: session
title: driven 站跑不了 node
description: drive.js 用 acceptEdits 跑的站，Bash 每條都要核准而被擋，build 與 verify 都沒跑 suite 與 docs-check；要決定放行 node 給 driven 站，還是讓 controller 補跑 — [drive.md](docs/90-agent/reference/drive.md).
state: decision
link: docs/90-agent/reference/drive.md
---

來源：2026-10-15 TODO 全表盤點的 Task 7（drive.js 重跑，driven session ac1e17f0，2 輪 $0.93，stopped down）。兩個 driven 站的 handoff（.fankeel/build/task-20261015T000841/build.md 與 verify.md）都寫明 Bash 被擋：連 git rev-parse HEAD 都要求核准，所以 build 沒取 BASE、沒跑 suite 與 docs-check，verify 也只能用 Read 確認 hello.txt 的內容，自己的 gate 還提議「放行 node 後重跑」。--permission-mode acceptEdits 是使用者 2026-10-10 選的，它只放行編輯。要決定的是二選一：在 argsFor 加 --allowedTools 'Bash(node:*)'、'Bash(git:*)' 之類的窄規則，讓 driven 站自己跑 suite；或者維持現狀，在 drive.md 寫明 driven 站不跑任何指令、由 controller 在 gate 前補跑。完成條件：決定寫進 drive.md 的 One stage 段；若選放行，drive.test.js 的 argsFor 測試要斷言那幾條規則、且仍然沒有 bypassPermissions，並重跑一次 driven build 看它真的跑出 ℹ pass 行。
