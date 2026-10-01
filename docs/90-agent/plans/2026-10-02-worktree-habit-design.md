---
status: design-intent
---

# worktree 開發習慣 — design

任務依 class 開自己的 worktree；實作者的 agent worktree 照舊用 `scripts/commit.js` cherry-pick 回任務的 checkout；收尾由新腳本 `scripts/land.js` 把 `fk/<id8>` 以 `--no-ff` 合進 base，合併訊息第一行是任務名、帶 `Fankeel-Task` / `Fankeel-Class` trailer、不打 tag；`commit.format` 在 init 時從 git log 推一個預設；殘留的 `worktree-agent-*` 分支納入清理；init 加上 worktree 政策與盤點。

## 1. cherry-pick 與 --no-ff 合併：並存，分兩層

兩者合的不是同一種東西，所以不互相取代：

- `scripts/commit.js` 的 `landWorktree`（scripts/commit.js:84）照舊：把實作者在 Agent isolation worktree（`.claude/worktrees/agent-*`，分支 `worktree-agent-*`）裡的一個 task commit cherry-pick 到「執行 commit.js 那個 checkout」的 HEAD。這一層不改機制。
- Agent isolation 的 worktree 以 `origin/main` 為底，而本 repo 從不 push，分支底是舊的；拿 merge 收它會把整段舊歷史的差異帶進來，所以這層只能是 cherry-pick（單一 commit 的 patch）。
- 任務有自己的 worktree 時，controller 在該任務 worktree 裡執行 commit.js，cherry-pick 落在 `fk/<id8>`，main 的 HEAD 不動；任務沒有 worktree 時落在 main，與今天相同。
- `scripts/land.js` 只處理任務層：`fk/<id8>` → base 的 `--no-ff` 合併。commit.js 不做合併，land.js 不做 cherry-pick。
- 測試：在 fixture repo 開一個 linked worktree（分支 `fk/xxxxxxxx`）與一個 agent worktree，從前者執行 commit.js，斷言 `fk/xxxxxxxx` 多一個 commit、main 的 HEAD sha 不變（tests/commit.test.js）。

## 2. 依 class 開 worktree

- `lib/profile.js` 的 `worktree` 鍵：values 由 `true|false` 擴為 `true|false|bounded|architectural`；builtin 仍是 `false`。
- `bounded` 表示 class 為 `bounded` 或更重的任務開；`architectural` 只有 architectural 開；`true` 一律開（spike 也開）；`false` 不開。順序用 lib/handoff.js:229 的 `CLASS_ORDER`，不另立一份。
- `scripts/task.js` 的 `start`（:692）把 `prof.values.worktree === true` 換成一個判斷函式 `wantsWorktree(value, cls)`，用 `start` 當下的 class。
- `task.js route` 之後把 class 調高，不回頭補開 worktree；`start` 印出的 `worktree:` 行或 `worktree: not opened` 是唯一的時點。
- 測試：tests/task-worktree.test.js 加三列 — `worktree=bounded` 下 spike 不開、bounded 開；`worktree=architectural` 下 bounded 不開。

## 3. `scripts/land.js`：--no-ff 合併加 trailer

- `node scripts/land.js merge --session <id>`：讀任務紀錄的 `worktree`（`guard.worktreeOf`），從主 checkout 執行 `git merge --no-ff fk/<id8>`，訊息第一行 `merge: <任務名>`，空一行後兩行 trailer `Fankeel-Task: <task id>`、`Fankeel-Class: <class>`。不打 tag。
- 任務 worktree 有未提交的檔（`git status --porcelain` 非空）時拒絕，列出那些路徑，不合併。
- 設了 `commit.format` 時，合併訊息第一行同樣要符合，不符就拒絕、不合併（沿用 scripts/commit.js:163 的檢查，抽成共用函式）。
- 衝突：`git merge --abort`，印 `conflict <paths>`，exit 1，worktree 與分支都留著。
- 成功印 `<base>..<sha>`。之後由 land skill 跑全套測試；綠了才執行 `node scripts/land.js clean --session <id>`：`git worktree remove` 與 `git branch -d fk/<id8>`；`-d` 拒絕（未合併）就照實印出，不升級為 `-D`。
- 任務沒有 worktree：`merge` 印 `no worktree — nothing to merge` 並 exit 0。
- skills/fankeel-land/SKILL.md:233-252 的手動 `git merge fk/<id8>` 段改成這兩個指令。
- 測試：tests/land.test.js — fixture repo 跑 `merge` 後，`git log -1 --format=%P` 有兩個 parent，`git interpret-trailers --parse` 讀得出兩個 trailer，`git tag` 為空；未提交時拒絕；衝突時 HEAD 不動。

## 4. `commit.format` 在 init 時給預設

- `lib/profile.js` 的推斷函式（:315 一帶，`land.integration` 從 git log 推的那段）多推 `commit.format`：最近 50 則非合併 commit 的第一行，有 80% 以上符合 `^[a-z]+(\([^)]+\))?: `，就推出以實際出現過的前綴組成的正規式，例如 `^(feat|fix|chore|docs|merge)(\([^)]+\))?: `；不足 80% 就不推。
- 推出的值跟其他推斷值一樣進 init 第 7 步讓使用者確認，不靜默寫入。
- 測試：tests/profile-commit-format.test.js 加兩列 — 符合 conventional 的 fixture log 推出正規式且該正規式符合每一則；混雜的 log 不推。

## 5. agent worktree 清理

- `scripts/residue.js` 多列一類：沒有 worktree 的 `worktree-agent-*` 分支，且它的 commit 都已在 HEAD — 是 ancestor，或 `git cherry HEAD <branch>` 每一行都是 `-`（patch 已被 cherry-pick 進來）。這類標為 spent。
- 有任何 `+` 行（patch 不在 HEAD）的分支列為 unmerged，不標 spent，不清。
- land skill 的清理段把 spent 的 `worktree-agent-*` 分支加入可清理項，用 `git branch -D`（cherry-pick 過的分支不是 ancestor，`-d` 會拒絕）；只清 residue.js 判為 spent 的。
- 現有 3 個：`worktree-agent-a53998ed89c4adbe5` 是 ancestor；`worktree-agent-a301d495acab50170`、`worktree-agent-ab9df5e57683be789` 在 `git cherry HEAD` 下都是 `-`。三個都會判為 spent。
- 測試：tests/residue.test.js — fixture 中 cherry-pick 過的分支列為 spent，另一個有未取用 commit 的分支不列為 spent。

## 6. init 納入

- skills/fankeel-init/SKILL.md 第 7 步（Profile）列出 `worktree`（四個值，說明依 class 開）與推出的 `commit.format`，讓使用者選。
- agents/fankeel-init-scout.md 多一列狀態：`.gitignore` 有沒有 `.claude/worktrees/`，以及 `node scripts/residue.js` 列出的 worktree 與 spent `worktree-agent-*` 分支數；第 8 步（Close）把有殘留的列出，問是否清，不自動刪。
- 不新增步驟編號，八步結構不變。

## 不做

- 不在 hooks/guard.js 加手打 `git commit` 的檢查（使用者的清單沒有）。
- 不改 Agent isolation 的 worktree 位置或分支名。
- 不 push、不打 tag。
