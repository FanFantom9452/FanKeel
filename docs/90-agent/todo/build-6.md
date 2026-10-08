---
label: build
title: implementer 各開 worktree
description: ready-queue 的 worktree 那一半：每個 implementer 各開 worktree、由 brain merge；`scripts/commit.js` 認不得 worktree、brain 不能 `git commit`，兩者都得先改 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
state: done
link: docs/90-agent/reference/subagents.md
group: implementer 互相蓋檔
timing: if: 共用樹上出現一次 implementer 蓋掉另一個 implementer 的改動
stamp: 2026-09-26
done:
  at: 2026-10-09
  sha: e77cc85c4d85b5248427a362576ba314e6327cc6
  disposition: done
---

來源：根目錄 TODO.md 第 181 行的條目（2026-09-26 記），改成逐條的 todo 檔。

要做成：ready-queue 的 worktree 那一半：每個 implementer 各開 worktree、由 brain merge；`scripts/commit.js` 認不得 worktree、brain 不能 `git commit`，兩者都得先改

完成條件：條目所述的事做完或確認不必做，並把結果寫回這個檔案再結案。

## 完成紀錄

scripts/commit.js:34 parses a block's first line 'worktree <path>' and commits it there then cherry-picks onto HEAD, tests/commit.test.js:262 covers it, so commit.js recognises worktrees; the other two halves are settled in docs/90-agent/reference/subagents.md: :903-906 ("Where it commits") has the build brain send every implementer with isolation: "worktree" and put `worktree <path>` first in its block, and :579 (the "a commit" row) has the agent write the commit file and the controller run commit.js on it

- commit a385e6c0ef9c657e1ddad129d945f11ff39c5cc9
