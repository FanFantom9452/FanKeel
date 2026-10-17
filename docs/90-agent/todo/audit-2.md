---
label: audit
title: 程式碼刪減：重複與冗長
description: station.js 約 -80 行、todo-check.js 約 -36 行、ledger.js 約 -14 行、repoRoot() 合併七處
state: done
done:
  at: 2026-10-18
  sha: 289b2165
  disposition: done
  session: b9c824ac-cf19-4f14-8497-ae66ca642f5c
---

來源：2026-10-18 文件審查那一輪，程式碼那一半由三個 fankeel-reviewer 從不同角度找出可刪的地方，當時沒有動。要做的事：scripts/station.js 的 serve 處理函式把重複 21 次的 fail 寫法和 12 次的 writeHead/end 收成一個 send()；scripts/todo-check.js 的 check 用 add(line, kind, detail) 取代 13 段 problems.push；scripts/ledger.js 的 --range 檢查從 init/complete/fix 三份合成一份；git rev-parse --show-toplevel 的七份抄本（lib/shots.js、lib/guard.js、lib/sensitive.js、scripts/review-check.js、scripts/commit.js 兩處、scripts/residue.js）合成 lib/tracked.js 旁的 repoRoot(cwd)；另有 lib/map.js 的 readIf 改用 lib/json.js 的 readText、lib/suitelock.js 的 sleep 與 lib/registry.js 的 sleepMs 合一、hooks/pane-status.ts 只剩測試在用的 ledgerDone/planTotal。每處改之前先確認呼叫端有沒有依賴原本會丟出的錯誤。完成的標準：上面每一處都改掉或寫明不改的理由，整套測試全綠。

## 完成紀錄

重複的程式碼收成一處：找 git 頂層目錄的六份抄本改用同一個 repoRoot，guard 那一份因為有自己的逾時和兩種回傳值而保留；兩份睡眠等待合成一個 sleepMs；station 伺服器每個回應都改走 send 和 fail，不再各寫一次標頭；map 讀檔改用既有的 readText；todo-check 收集問題改用 add()；ledger 的 --range 拒絕訊息只留一份；pane-status 刪掉沒人用的 ledgerDone 和 planTotal。docs-audit 的 limit 參數原本列在清單上，查過確實有人用，所以不刪。新加的三個測試都用故意改壞程式的方式確認過會變紅，整套快速測試 4378 過、0 失敗。

- commit c2583d54
- commit 1cde6b44
- commit 1c9d5236
- commit c393aa65
- commit dbbbd85a
- commit 2b4e2e67
- commit 6d979bb2
- commit a5d4ca89
- commit 193a7a66
- commit 289b2165
- commit d5a79ae4
- commit a202a62a
