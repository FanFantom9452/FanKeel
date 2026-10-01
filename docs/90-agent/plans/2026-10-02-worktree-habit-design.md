---
status: design-intent
---

# worktree 開發習慣 — design

任務依 class 開自己的 worktree。實作者的 agent worktree 照舊用 `scripts/commit.js` cherry-pick，但落點由 commit 檔的 `into <path>` 行指名，不再看執行者的 cwd。收尾由新腳本 `scripts/land.js` 把 `fk/<id8>` 以 `--no-ff` 合進 base：合併訊息第一行是任務名，帶 `Fankeel-Task` / `Fankeel-Class` trailer，不打 tag。`commit.format` 在 init 時從 git log 推一個預設。殘留的 `worktree-agent-*` 分支納入清理。init 加上 worktree 政策與盤點。

## 1. cherry-pick 與 --no-ff 合併：並存，分兩層，落點寫明

兩者合的不是同一種東西，所以不互相取代：

- `scripts/commit.js` 的 `landWorktree`（scripts/commit.js:84）照舊，把實作者在 Agent isolation worktree（`.claude/worktrees/agent-*`，分支 `worktree-agent-*`）裡的一個 task commit cherry-pick 到任務的 checkout。Agent isolation 的 worktree 以 `origin/main` 為底，而本 repo 從不 push，分支底是舊的；拿 merge 收它，會把整段舊歷史的差異一起帶進來，所以這層只能用 cherry-pick（單一 commit 的 patch）。
- `scripts/land.js` 只處理任務層：`fk/<id8>` → base 的 `--no-ff` 合併。commit.js 不做合併，land.js 不做 cherry-pick。
- 落點不靠 cwd。今天 brain 的 brief 寫「run commit.js from there」（lib/render.js:195, :528），但執行 commit.js 的是 controller，而 controller 的 COMMIT_RULE（lib/stages.js:638）只有 `node commit.js "<file>"`，沒有 cd。結果是 cherry-pick 會默默落在 main，任務 worktree 拿不到，到 land 時才以衝突或重複的形式冒出來。
- commit 檔第一行可寫 `into <path>`，對整個檔生效：commit.js 先確認該路徑是同一 repo 的 worktree（沿用 `commonDir` 的檢查），再以它為 `top` 執行每個 block。worktree block 的 cherry-pick 落在那裡，一般 block 的 `commit -o` 也在那裡做。沒有 `into` 行就和今天一樣。
- 用檔內的一行，不用 CLI 的 `--into`：controller 的 COMMIT_RULE 在 2400 字的注入上限裡，每個 stage 都用同一句；`into` 由 brain 寫，而 brain 的 brief 本來就有 worktree 路徑。
- lib/render.js 的 `worktreeLine` 與 build 的 commit 規則改成：任務有 worktree 時，commit 檔以 `into <該路徑>` 開頭。
- 測試：tests/commit.test.js — 在 fixture repo 開一個 linked worktree（分支 `fk/xxxxxxxx`）與一個 agent worktree，從主 checkout 執行 commit.js，檔頭寫 `into` 指向前者：斷言 `fk/xxxxxxxx` 多一個 commit，main 的 HEAD sha 不變；`into` 指向別的 repo 時拒絕。

## 2. 依 class 開 worktree

- `lib/profile.js` 的 `worktree` 鍵：values 由 `true|false` 擴為 `true|false|bounded|architectural`；builtin 仍是 `false`。
- 各值的意思：`bounded` 對 bounded 或更重的任務開，`architectural` 只對 architectural 開，`true` 一律開（spike 也開），`false` 不開。輕重順序沿用 lib/handoff.js:229 的 `CLASS_ORDER`，不另立一份。
- `scripts/task.js` 的 `start`（:692）把 `prof.values.worktree === true` 換成判斷函式 `wantsWorktree(value, cls)`，用 `start` 當下的 class。
- `task.js route` 之後把 class 調高，不回頭補開 worktree；只在 `start` 決定一次，看它印出 `worktree:` 行還是 `worktree: not opened`。
- 測試：tests/task-worktree.test.js 加三列 — `worktree=bounded` 下 spike 不開、bounded 開；`worktree=architectural` 下 bounded 不開。

## 3. `scripts/land.js`：--no-ff 合併加 trailer

- `node scripts/land.js merge --session <id>`：讀任務紀錄的 `worktree`（`guard.worktreeOf`），在主 checkout 執行 `git merge --no-ff fk/<id8>`。訊息第一行 `merge: <任務名>`，空一行後兩行 trailer：`Fankeel-Task: <task id>`、`Fankeel-Class: <class>`。不打 tag。
- 任務 worktree 有未提交的檔（`git status --porcelain` 非空）時拒絕，列出那些路徑，不合併。
- 設了 `commit.format` 時，合併訊息第一行也要符合，不符就拒絕、不合併。這個檢查沿用 scripts/commit.js:163 那段，抽成共用函式。
- 衝突：`git merge --abort`，印 `conflict <paths>`，exit 1，worktree 與分支都留著。
- 成功印 `<base>..<sha>`。接著由 land skill 跑全套測試，綠了才執行 `node scripts/land.js clean --session <id>`：`git worktree remove`，再 `git branch -d fk/<id8>`。`-d` 若因未合併而拒絕，就照實印出，不改用 `-D`。
- 任務沒有 worktree：`merge` 印 `no worktree — nothing to merge` 並 exit 0。
- skills/fankeel-land/SKILL.md:233-252 手動 `git merge fk/<id8>` 的那段，改成這兩個指令。
- 測試：tests/land.test.js — fixture repo 跑 `merge` 後，`git log -1 --format=%P` 有兩個 parent，`git interpret-trailers --parse` 讀得出兩個 trailer，`git tag` 為空；有未提交的檔時拒絕；衝突時 HEAD 不動。

## 4. `commit.format` 在 init 時給預設

- `lib/profile.js` 的推斷函式（:315 一帶，就是從 git log 推 `land.integration` 的那段）多推一個 `commit.format`。看最近 50 則非合併 commit 的第一行：80% 以上符合 `^[a-z]+(\([^)]+\))?: ` 時，用實際出現過的前綴組出正規式，不自動加 `merge`，例如 log 只用過 feat、fix、chore、docs 時是 `^(chore|docs|feat|fix)(\([^)]+\))?: `；不到 80% 就不推。
- 推出的值和其他推斷值一樣，在 init 第 7 步交給使用者確認，不靜默寫入。
- 測試：tests/profile-commit-format.test.js 加兩列 — 一份符合 conventional 格式的 fixture log 推出正規式，且每一則都符合；一份混雜的 log 不推。

## 5. agent worktree 清理

- `scripts/residue.js` 多列一類：沒有 worktree 的 `worktree-agent-*` 分支，且它的 commit 都已進了 HEAD，標為 spent。「已進 HEAD」指它是 HEAD 的 ancestor，或 `git cherry HEAD <branch>` 的每一行都是 `-`（patch 已被 cherry-pick 進來）。
- 只要有一行 `+`（patch 不在 HEAD），就列為 unmerged，不標 spent，也不清。
- land skill 的清理段把 spent 的 `worktree-agent-*` 分支列入可清理項，用 `git branch -D` 刪（cherry-pick 過的分支不是 ancestor，`-d` 會拒絕）；只清 residue.js 判為 spent 的。
- 現有 3 個：`worktree-agent-a53998ed89c4adbe5` 是 ancestor；`worktree-agent-a301d495acab50170` 與 `worktree-agent-ab9df5e57683be789` 在 `git cherry HEAD` 下全是 `-`。三個都會判為 spent。
- 測試：tests/residue.test.js — fixture 裡 cherry-pick 過的分支列為 spent，另一個還有 commit 沒進 HEAD 的分支不列為 spent。

## 6. init 納入

- skills/fankeel-init/SKILL.md 第 7 步（Profile）列出 `worktree`（四個值，說明依 class 開）與推出的 `commit.format`，讓使用者選。
- agents/fankeel-init-scout.md 多一列狀態：`.gitignore` 是否有 `.claude/worktrees/`，以及 `node scripts/residue.js` 列出的 worktree 數與 spent `worktree-agent-*` 分支數。第 8 步（Close）列出有殘留的項目，問要不要清，不自動刪。
- 不新增步驟，八步的編號不變。

## 不做

- 不在 hooks/guard.js 加手打 `git commit` 的檢查（使用者的清單沒有這項）。
- 不改 Agent isolation 的 worktree 位置或分支名。
- 不加 CLI 參數 `--into`（理由見 §1）。
- 不 push、不打 tag。
