---
label: worktree
title: worktree 不放在 repo 裡
description: Claude Code 的 worktree 預設建在 repo 內 .claude 底下的 worktrees 資料夾，本機目錄 marketplace 做 plugin update 時會把整個資料夾連同 worktree 一起複製進快取，複製到一半有 worktree 被刪掉就失敗
state: ready
link: .claude/worktrees
---

使用者 2026-11-03 指定：很重要、優先做。

現象：在 F:\MC_Server\FanFanDiscordBot 跑 `claude plugin update fankeel@fankeel` 失敗，訊息是 `EUNKNOWN: unknown error, copyfile 'F:\ymlab\fankeel\.claude\worktrees\agent-a4439ed474a35c8cc\CONTRIBUTING.md' -> 'C:\Users\Owner\.claude\plugins\cache\fankeel\fankeel\0.147.0\.claude\worktrees\...'`。那個子代理 worktree 在複製途中被刪掉了。

原因：marketplace 的來源是本機目錄 F:\ymlab\fankeel，update 會複製整個目錄、不看 .gitignore（.gitignore:3 雖然列了 `.claude/worktrees/`）。.claude/worktrees/ 底下每一個都是完整 repo 副本。11-03 量到快取 ~/.claude/plugins/cache/fankeel/fankeel/0.100.0 內含 7 個 worktree、182 MB，快取裡共 129 個版本。11-03 當下 .claude/worktrees/ 有 9 個目錄（4 個還登記在 git worktree list，5 個是殘骸），都已搬到 F:\ymlab\fankeel-worktrees-parked\，還沒刪。

要想的方向（未定）：
- worktree 建到 repo 外面（Claude Code 的 worktree 位置設定、或 fankeel 自己建 worktree 時用的路徑）
- marketplace 改指向 git 來源（GitHub／gitea），只複製有追蹤的檔
- 子代理 worktree 用完沒清掉的殘骸：誰負責清、什麼時候清
- 快取舊版本的清理

完成條件：有 worktree 存在、甚至有子代理正在建或刪 worktree 時，跑 plugin update 也會成功，而且快取裡不會出現 .claude/worktrees。
