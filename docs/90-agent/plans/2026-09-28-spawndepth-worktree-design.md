---
status: design-intent
---

# spawnDepth 讀法與 implementer worktree — design

2026-09-28。`TODO.md` `## Needs a decision` 的兩條，使用者要一起做（survey：
`.fankeel/build/task-20260928T100825/survey.md`）。兩件事彼此獨立，同一份 plan
分成兩組 task，第一組不必等第二組。

## 1. nestedBrain 等檔再讀

背景：`docs/90-agent/reports/2026-09-28-spawndepth-timing.md` 量到
`agent-<id>.meta.json` 會在 `SubagentStart` 觸發後 36–87 ms 才寫出來，所以
`nestedBrain()`（`hooks/brief.js:42`）一定走退回分支，巢狀 brain 每次都多拿到一個
`group`。

- 先量，後改：把 `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/record.js` 改成 hook 內每 20 ms 重讀一次，最多等 500 ms，再跑一次 headless nester＋leaf。量的是：hook 還沒返回的時候，檔案會不會出現。
- 如果檔案在 hook 等待期間出現，而且 `leaf` 讀到 `spawnDepth` 2：`nestedBrain()` 就改成同樣的讀法，每 20 ms 用 `Atomics.wait` 重讀一次，最多 500 ms，逾時照舊回 `false`。只有 `fankeel-brain` 啟動時才會等，其他 agent 的 brief 路徑不變。
- 如果 Claude Code 要等 hook 返回才寫檔，也就是等滿 500 ms 仍然沒有檔案：`hooks/brief.js` 不改，量測結果寫進同一份報告，TODO 條目刪掉，`nestedBrain()` 上方的註解補一句「hook 當下讀不到，已量過」。
- 兩種結果都寫進 `docs/90-agent/reports/2026-09-28-spawndepth-timing.md` 的新一節，附新跑的 sha 和 md5。

## 2. implementer 各在自己的 worktree 裡改

背景：`docs/03-decisions/2026-09-24-todo-four.md` 記錄七個 task 裡有五輪因為共用檔被迫
串行；`plantasks.conflict()` 的 `files` 那一條就是造成串行的原因。

- build 的 brain 派 implementer 時一律帶 `isolation: "worktree"`（Agent 工具內建），不自己開 worktree。
- implementer 照舊不提交。brain 的 commit file 在一個 block 的第一行多寫 `worktree <path>`，`<path>` 用 Agent 回傳的 worktree 路徑。
- `scripts/commit.js` 遇到有 `worktree` 行的 block：先在那個 worktree 裡對列出的路徑做 `add`＋`commit -o`，再回到主 repo 做 `git cherry-pick <sha>`。成功就印 `<base>..<sha>`，接著 `git worktree remove`，並刪掉那條分支。
- cherry-pick 有衝突時，`commit.js` 會先 `git cherry-pick --abort`，主 repo 的 HEAD 和工作區都不動，這個 block 印 `conflict <那些路徑>`，以非零碼結束，已經落地的 block 保留。worktree 也留著。brain 看到 `conflict`，就把那個 task 放回 ready 佇列，在新的 HEAD 上自動重派一次，不問人（使用者 09-28 在 design gate 選的）。同一個 task 第二次還衝突，brain 就停下 build，在 handoff 裡寫出衝突的路徑，交給 controller 問使用者。
- 沒有 `worktree` 行的 block，行為和今天一模一樣。
- `plantasks.ready()` 多一個 `{ worktree: true }` 選項：只有兩個 task 共用 `Modify`/`Test` 檔時，不再擋住它們；`read` 和 `interface` 兩條照擋。build 的 brain 呼叫時帶這個選項，`groups()` 和其他報告不變。
- `agents/fankeel-brain.md`、`lib/stages.js` 的 build 規則、`skills/fankeel-build/SKILL.md`、`docs/90-agent/reference/subagents.md` 的「在哪提交」一節都改寫成這個流程。`TODO.md` 那一條由交付的 task 刪掉。
- implementer 在 worktree 裡的編輯要以主樹的邏輯路徑記進 claims，guard 才看得到鄰居撞檔。今天 `lib/guard.js` 的 `logicalPath()`（:244-248）只去掉 `.fankeel/worktrees/<hex8>/`，`hooks/touch.js:36` 把 Agent isolation 開的 worktree 裡的編輯記成原始路徑；worktree 在 registry 根目錄之外時 `relPath` 回 `null`，根本不記。worktree 在根目錄內（探測找到的位置）就去掉那一段；在根目錄外，就用那個 worktree 的 `git rev-parse --git-common-dir` 找回主 repo，再換算成主樹路徑。

## 驗收

- `nestedBrain()`：另開一個子程序，60 ms 後才寫出 meta 檔（`spawnDepth: 2`），函式要回 `true`。今天的程式碼會回 `false`。這條只在第 1 節走「改」那一支時才成立。
- `commit.js`：暫存 repo 加一個 worktree，改一個主 repo 也改過、但改在不同 hunk 的檔。block 帶 `worktree` 時，主 repo 多一個 commit，worktree 被移除。改成同一行時，印出 `conflict`，結束碼非零，`git status` 乾淨，也沒有 `CHERRY_PICK_HEAD`。今天兩種情況都會因為不認得 `worktree` 行，在 `git add` 失敗。
- `ready(tasks, [], { worktree: true })`：兩個共用 `Modify` 的 task 同時 ready；一個 `Consumes` 另一個 `Produces` 的組合仍然只有前面那個 ready。
- 產物：`commit.js` 印出的每一段 `<base>..<sha>`，都要等於主 repo `git log --format=%H -n 2` 讀到的前後兩個 sha。

## 對照地圖

- `docs/03-decisions/2026-09-21-controlled-stations.md:38` 寫的「worktree 不處理」，這次推翻了。這是 decision，本來就不維護，不改它；改的是 reference 頁 `subagents.md`。
- 原先這裡寫「`lib/guard.js:198` 的 `worktreeOf` 已經會把 worktree 路徑對回主樹，claims 和 guard 不必改」，這句不對：`worktreeOf` 只讀 task 紀錄的 `worktree` 欄位，不換算路徑。改成 §2 最後一條。

## 還沒驗的

Agent 工具在 brain 這一層帶 `isolation: "worktree"` 時，回傳內容裡到底有沒有 worktree 的路徑和分支，而且 brain 讀得到。plan 的第一個 task 是一次 headless 探測；如果讀不到，第 2 節改成 `commit.js` 自己用 `task.js` 的 `openWorktree` 開 worktree，再把路徑交給 implementer。
