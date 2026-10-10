---
status: decision
last_verified: 2026-10-10
---

# workflow-gaps（10-10）：定了什麼、沒做什麼

一句話：judge 盤點出的十筆工作流缺口，survey 逐筆核對後八筆屬實、兩筆部分屬實，使用者決定十筆都做；拆成十二個 task 全部做完，十條 TODO 結案。

judge 的原文在 [2026-10-10-workflow-gaps.md](../judgements/2026-10-10-workflow-gaps.md)，計畫在 [2026-10-10-workflow-gaps.md](../../99-archive/2026-10-10-workflow-gaps.md)，設計在 [2026-10-10-workflow-gaps-design.md](../../99-archive/2026-10-10-workflow-gaps-design.md)。

## 做了什麼

- tests-6：`suite.json` 留下每一次執行（最多二十筆）；先紅後綠時 `task.js land` 多印 `suite: green on run <N>; red on run <n> — <names>`。
- verify-2：verify 的規則指名 `suite.js --session <id>`；新增 `suite.js --check`，只問紀錄站不站得住，不跑測試；land 的規則先問它。
- land-2：`version.js` 改寫了 manifest 之後印一行，提醒 `task.js land` 之前再跑一次 suite；land 技能頁的第一步照實際順序重寫。
- land-3：沒有 worktree、提交直接落在 base 上時，`task.js land merge` 記成 `direct`；`profile suggest` 不把它算進 `land.integration`。
- design-3：路線上沒有 plan、`design.md` 不在磁碟上時，`task.js stage build` 印出該把檔案表寫到哪裡。
- compact-3：注入的區塊多一行 `facts: <path> (<n>)`；`hooks/compact.ts` 要摘要留下 `design.md` 與 `context.md` 的路徑。
- docs-5：pipeline 頁的兩段規則引文更新，並由一條測試釘住。
- skills-3：三份技能頁的 One path 改成逐字相同；`skills-check.js` 新增 `one-path` 這一項。
- gate-8：不受控的站，少於三個選項的關卡在回答後收到一行 `systemMessage`，只提醒不拒絕。
- stage-agents-18：受控的站，主控自己會寫檔的 shell 指令被 `hooks/guard.js` 拒絕。

## 沒做什麼

- design-3 原條目要把 design 進 build 的規則塊改成每條 bounded 路線都注入。開著 `design.mockup` 時那一塊會到 2534 字元，超過 2400 的上限，所以改成 `task.js stage build` 的一行提醒，`lib/stages.js` 的那一塊沒有動。
- skills-3 留三個洞：票數相同時取走訪順序的第一份；只有一份技能頁帶 One path 時沒得比；整份沒有 One path 的技能頁不會被列出。
- gate-8 在讀不到 profile 時保持安靜，這一點只讀過程式，沒有測試。
- 合併之後用專案自己的測試指令再跑的那一次，仍然不進 `suite.json`。
- `docs/03-decisions/fankeel-shell.md` 裡一處行號引用是決策頁，照原樣留著。

## 為什麼

- stage-agents-18 有兩個接受下來的代價：受控站上主控直接下 `git commit` 會被擋，要走 `scripts/commit.js`；引號裡當一般字出現的 `rm`、`mv`、`cp`、`tee` 也會被當成寫檔。目前 profile 只有 `survey` 受控，那一站主控本來就不提交。
- build 在 main 上做，沒有開 worktree：profile 的 `worktree` 是 `false`。所以這次 land 記成 `direct`，正好是 land-3 做出來的那條路。
- 派工時指定 sonnet，implementer 實際跑的是 haiku：profile 的 `agent.fankeel-implementer.model` 是 `haiku`，`hooks/title.js` 用它蓋過傳進去的模型。十二個 task 裡七個經過一輪修正才過 review。
- reviewer 不能寫檔，mutation 多半是讀程式判斷而不是實跑；implementer 自己跑過各自的 mutation。verify 的十二份證據共 92 列，全部成立，adversary 沒有推翻任何一列；其中六份有「讀過、沒跑」的轉紅列。
- 整套測試在最後那個 commit 上跑了四次，兩次紅：第一次紅一條 `tests/tune.test.js` 的 live mode 測試；另一次和十二個 verifier 同時跑，紅了 `tests/inject.test.js` 與 `tests/tune.test.js` 各一條。三條單獨跑都綠，每次紅的都不同，判斷是負載下的時序問題，沒有進一步證明。證據記在 test-1 與 test-4。
