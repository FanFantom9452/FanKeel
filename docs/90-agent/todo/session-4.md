---
label: session
title: driven 站跑不了 node
description: drive.js 用 acceptEdits 跑的站，首次 10-15 執行 Bash 全被擋（含 git），重跑只有 node 被擋、唯讀 git 能跑，兩次都沒跑 suite 與 docs-check；要決定放行 node 給 driven 站，還是讓 controller 補跑 — [drive.md](docs/90-agent/reference/drive.md).
state: decision
link: docs/90-agent/reference/drive.md
---

來源：2026-10-15 TODO 全表盤點的 Task 7（drive.js 重跑，driven session ac1e17f0，2 輪 $0.93，stopped down）。兩個 driven 站的 handoff（.fankeel/build/task-20261015T000841/build.md 與 verify.md）都寫明 node 被擋（重跑時唯讀 git 能跑，HEAD 3b0ad809 讀得到），所以 build 沒跑 suite 與 docs-check，verify 用 `od -c` 與 `git status` 確認了 hello.txt，但 suite 與 docs-check（都是 node）一樣被擋，自己的 gate 還提議「放行 node 後重跑」。同一 session 在 taskEnv 修正前的首次 10-15 執行則是每條 Bash 都被拒，連 git rev-parse HEAD 也不例外（那是較早 handoff 的說法）；不論哪一次，都沒跑 suite 與 docs-check。--permission-mode acceptEdits 是使用者 2026-10-10 選的，它只放行編輯。要決定的是二選一：在 argsFor 加 --allowedTools 'Bash(node:*)'、'Bash(git:*)' 之類的窄規則，讓 driven 站自己跑 suite；或者維持現狀，在 drive.md 寫明 driven 站不跑任何指令、由 controller 在 gate 前補跑。完成條件：決定寫進 drive.md 的 One stage 段；若選放行，drive.test.js 的 argsFor 測試要斷言那幾條規則、且仍然沒有 bypassPermissions，並重跑一次 driven build 看它真的跑出 ℹ pass 行。

決定（2026-10-15 使用者在第三輪盤點的 survey 關卡選）：放行 node 與 git。`scripts/drive.js` 的 `argsFor` 多傳 `--allowedTools 'Bash(node:*),Bash(git:*)'`，仍是 `acceptEdits`；`drive.md` 的 One stage 第 2 項已寫明。

驗證（2026-10-15）：探針 session 89e23d48 由 drive.js 帶一輪 build，其 handoff `.fankeel/build/task-20261015T092901/build.md` 記下 `node --test tests/drive.test.js` → `ℹ pass 25`、`ℹ fail 0`，node 在 acceptEdits 加 `--allowedTools` 下確實能跑。
