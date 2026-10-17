---
label: audit
title: 程式碼刪減：重複與冗長
description: station.js 約 -80 行、todo-check.js 約 -36 行、ledger.js 約 -14 行、repoRoot() 合併七處
state: ready
---

來源：2026-10-18 文件審查那一輪，程式碼那一半由三個 fankeel-reviewer 從不同角度找出可刪的地方，當時沒有動。要做的事：scripts/station.js 的 serve 處理函式把重複 21 次的 fail 寫法和 12 次的 writeHead/end 收成一個 send()；scripts/todo-check.js 的 check 用 add(line, kind, detail) 取代 13 段 problems.push；scripts/ledger.js 的 --range 檢查從 init/complete/fix 三份合成一份；git rev-parse --show-toplevel 的七份抄本（lib/shots.js、lib/guard.js、lib/sensitive.js、scripts/review-check.js、scripts/commit.js 兩處、scripts/residue.js）合成 lib/tracked.js 旁的 repoRoot(cwd)；另有 lib/map.js 的 readIf 改用 lib/json.js 的 readText、lib/suitelock.js 的 sleep 與 lib/registry.js 的 sleepMs 合一、hooks/pane-status.ts 只剩測試在用的 ledgerDone/planTotal。每處改之前先確認呼叫端有沒有依賴原本會丟出的錯誤。完成的標準：上面每一處都改掉或寫明不改的理由，整套測試全綠。
