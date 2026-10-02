---
status: decision
last_verified: 2026-10-02
---

# worktree 開發習慣（10-02）：決策紀錄

一句話：任務依 class 開 worktree，收尾由 `scripts/land.js` 以 `--no-ff` 合併並帶 trailer；cherry-pick 與合併並存、分兩層。

計畫見 [../99-archive/2026-10-02-worktree-habit.md](../99-archive/2026-10-02-worktree-habit.md)。

## 為什麼

Agent isolation 的 worktree 以 `origin/main` 為底，本 repo 從不 push，分支底是舊的，拿 merge 收會帶進整段舊歷史，所以實作者那層只能 cherry-pick。cherry-pick 的落點原本看執行者的 cwd，會默默落在 main。任務層的合併則原本是 land skill 裡手打的 `git merge`，沒有統一訊息與標記。

## 定了什麼

- 兩層並存：commit 檔的 `into <path>` 行指名落點，不再看 cwd（6ed98a4c）。
- `worktree` profile 鍵依 class 判斷是否開；`commit.format` 從 git log 推預設（055c2297、b9129bee、9e715e43）。
- `scripts/land.js merge|clean`：把 `fk/<id8>` 以 `--no-ff` 合進 base，帶 `Fankeel-Task`、`Fankeel-Class` trailer，不打 tag（7e4d7a42）。
- residue 列出已用完的 `worktree-agent-*` 分支，跳過還被 checkout 的，`git cherry` 失敗算 unmerged（134cc1ac、55b05c10、48a49940）。
- land、init 兩個 skill 與 init scout 的文字跟著改（843d4d9f、35e40190）。

## 沒做的

- 不在 guard 加手打 `git commit` 的檢查。
- 不加 `--into` 參數。
- 不 push、不打 tag。
- `worktree` profile 預設仍是 `false`。
