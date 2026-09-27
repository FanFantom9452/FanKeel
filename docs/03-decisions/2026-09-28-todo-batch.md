---
status: decision
last_verified: 2026-09-28
---

# TODO 大批次（09-27）：決策紀錄

一句話：這一輪走完七站，一個 plan 20 個 task，清掉 Needs a decision 九條、Blocked 兩段、Watch 七段，外加 docs-audit 報的 `hook.js`／`report.js` 沒有頁面點名那段。內容包括 station 更新（等待卡、即時 subagent、文件全文搜尋、`#/tour`、中英介面、server 端 memo）、三個工具修補（`commit.js` 的 git mv、`tune.js` 還原 untracked、`residue.js` 的髒 worktree）、reviewer 的失敗情境與排除清單、docs 工具（`docs-for`、profile 表從程式碼產生、`shared-libs.md`），以及 require 圖的三個用法。ab.sh 重跑（約 $30，已核准）和 station 對 mockup 的 render review 兩件，這一輪都沒有做。

design 見 [../99-archive/2026-09-27-todo-batch-design.md](../99-archive/2026-09-27-todo-batch-design.md)，計畫見 [../99-archive/2026-09-27-todo-batch.md](../99-archive/2026-09-27-todo-batch.md)。

## 定了什麼

- 一份 spec 分五節（工具、docs、review、圖、station），一次 plan，而不是拆成五個 task；使用者在 design 站選的。
- station 介面中英兩套全部做，用 `loc(key, zh, vars)` 取字；文件搜尋只搜現行頁（reference、guide、decision），不搜 archive 與 report。
- require 圖只有一個來源：`lib/requires.js` 的 `requireGraph(root, files)`。map 的定方向段、`ledger.js groups` 的 `requireConflicts` 都從它讀；`requireConflicts` 只影響 `groups` 的報告，不改 `ready()` 的派工順序。
- reviewer 的排除清單是 16 條硬排除加 17 條判例；有發現時另派一個 reviewer 用 `## Verify` 模式逐條確認，一次派完整張清單，不是一條一派。
- mockup 走「方向」：原樣定稿，細節交給 build 的 render reviewer。

## 量到什麼

- 全套 `npm test`：2235 過、0 失敗（第三次；前兩次各紅在 `station-hide` 與 `station-cli`，見下）。`docs-check`、`todo-check`、`skills-check` exit 0。
- verify 第一輪 2231／2235：兩個是本批的缺漏（`docs/README.md` 的頁數、`tests/skills.test.js` 的段落白名單），兩個是重現兩次的環境問題（`station-cli` 的 idleMs 逾時、`station-hide` 的 ENOBUFS）。
- audit 找到 `documents.md` 把 `lib/requires.js:44` 的一行註解算成第十四個 `trackedFiles` 呼叫端；測試的 `callSites()` 也算了註解，所以測試沒擋下來。實際是 13 處。

## 在哪裡回頭

- plan 的 lint 報了 46 條，修正的 agent 被 guard 擋下：鄰居 session 的 git pass 把我們 untracked 的 plan 列進它的 `seen`，guard 當成它的認領。只能 `guard off` 才修得了。這條進了 `TODO.md` 的 Ready。
- verify 回到 build 修了 4 筆過期引用（`4ef55596..f7381d94`）。`station.md` 引用 `station.js` 的行號在同一批裡漂了三次：後面的 task 改到前面 task 引用的位置。
- verify 只對 20 個 task 中風險最高的 4 個派獨立 verifier，其餘靠各自的測試和 build 的逐項審查，報告裡有寫明。
- 三個 stage agent 寫的 gate 標題都超過 12 欄，被 `hooks/gate.js` 擋下，各退回重寫一次。
- verify 判成環境問題的兩個紅，land 時查到同一個原因：測試從 repo 目錄呼叫 station，連這台機器自己的 registry（215 個 session）一起讀。`station-hide` 的 `--json` 輸出因此超過 spawnSync 的 1 MB（ENOBUFS），`station-cli` 的 `serve` 啟動要 2.5 秒、整套負載下超過 5 秒時限。兩個測試都改成在暫存目錄執行；`station-cli` 的 Watch 條目一併關掉。
