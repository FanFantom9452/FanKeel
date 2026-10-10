---
status: decision
last_verified: 2026-10-10
---

# TODO 全表盤點（10-10 第二輪）：定了什麼、沒做什麼

一句話：這一輪做掉兩條 Ready——計畫的 Modify 寫了目錄時 lint 改回一條 finding，`suite.js` 多了 `--tree` 讓手動開的 worktree 留下 land 接受的綠燈；站頁的對話全文使用者決定先畫 mockup，拆出去另開任務；brief-3 仍等使用者親手探測。

計畫在 [2026-10-10-todo-patrol-lint-suite.md](../../../99-archive/2026-10-10-todo-patrol-lint-suite.md)，設計在 [2026-10-10-todo-patrol-lint-suite-design.md](../../../99-archive/2026-10-10-todo-patrol-lint-suite-design.md)。

## 做了什麼

- build-10：`ledger.js lint` 遇到 `Modify:` 是目錄時回一條 finding 並以非零結束，不再丟 EISDIR。已結案。
- land-1：`suite.js --tree <dir>` 在指定的樹跑全套測試，把路徑記進 `suite.json`；`blocker` 對那棵樹檢查紀錄。在暫存 repo 端到端跑過：沒有紀錄時 `task.js land` 拒絕，留下綠燈後接受。已結案。
- session-2 的 description 帶了兩個路徑，讓全套測試從上一輪的 land 起就紅一條；改掉那一行。
- 盤點了全部 29 條：14 條 Blocked 的條件都沒到，11 條 Watch 的事件都沒發生，最舊的 stamp 離今天 14 天，沒有一條要重蓋或丟掉。

## 沒做什麼

- station-24（站頁看得到對話全文）：plan 站寫過一版四個 task 的做法，使用者在關卡選擇先畫 mockup。草案留在 commit 321b0702 的 plan 檔，條目保持 ready。
- brief-3：探測要在互動 session 裡由使用者親手做，條目保持 ready。
- 14 條 Blocked 裡有四條沒有查到底：quota-1 與 spend-2 的資料檔只找了預設的設定目錄；model-4 與 security-1 的上游沒有上網或到另一個專案查。

## 為什麼

- 整段分支的總審發現，第一版的 `--tree` 讓紀錄裡的樹蓋過條目自己登記的 worktree，而且任何存在的目錄都算數。所以改成三種情況拒絕：沒帶值、條目自己有 worktree、目錄不是這個專案的 checkout。這比設計原本寫的「不看登記檔的 worktree 欄位」嚴，設計那一句已經跟著改。
- 判斷是不是同一個專案用 git 的 `--path-format=absolute`，要 git 2.31 以上。更舊的版本會一律拒絕 `--tree`，不會誤放行，所以沒有寫退路。
- 每個 task 的 reviewer 都沒有實際跑 mutation（它們不能寫檔），verify 站在一棵暫存的 worktree 裡補跑了六個，各自只讓新測試轉紅。
- 派工時指定 sonnet，兩個 implementer 的標題顯示實際跑的是 haiku；推測是 profile 的 `agent.fankeel-implementer.model` 蓋過了傳進去的模型，沒有另外查證。
