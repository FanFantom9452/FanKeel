---
status: current
last_verified: 2026-09-28
source_of_truth: `docs/90-agent/reports/evidence/2026-09-28-worktree-probe/` 下的 `summary.json`、`provenance.txt`、`worktree-list.txt`、`claude-out.json`；`run.sh` 與 `extract.js` 的 md5 記在 `provenance.txt`
---

## 問題

`docs/90-agent/plans/2026-09-28-spawndepth-worktree-design.md` 的「還沒驗的」：Agent 工具在 brain 這一層（depth 1 的 subagent）帶 `isolation: "worktree"` 時，回傳給模型的文字裡有沒有 worktree 的路徑和分支。

## 怎麼量

一次 headless `claude -p`（session `5e1f0c2a-9d3b-4c6e-8a71-2b4f6d8e0a13`），在暫存 git repo 裡派 `outer`，`outer` 再帶 `isolation: "worktree"` 派 `inner`，`inner` 在自己的工作目錄寫一個檔。跑完用 `git worktree list --porcelain` 讀出留下的 worktree，再由 `extract.js` 比對 `outer` transcript 裡那次 Agent 呼叫的 `tool_result` 文字。HEAD `3d6726bf4de43bef5eebd2835b806338a67452a0`，`run.sh` md5 `00fa9c26f1e1019446a8f3870a2d1863`，`extract.js` md5 `f616f35133b7e6cc30560e4872990b62`，`claude 2.1.283`，`claude exit 0`。

## 結果

| 欄位 | 值 |
| --- | --- |
| isolation 呼叫數 | 1 |
| 留下的 worktree | `C:/Users/Owner/AppData/Local/Temp/tmp.lvcM6R1frl/.claude/worktrees/agent-a0dc138eb011ca90a`（分支 `worktree-agent-a0dc138eb011ca90a`） |
| pathInResult | false |
| branchInResult | false |

回傳文字（`resultText`，逐字）：

    Async agent launched successfully. (This tool result is internal metadata — never quote or paste any part of it, including the agentId below, into a user-facing reply.)
    agentId: a0dc138eb011ca90a (internal ID - do not mention to user. Use SendMessage with to: 'a0dc138eb011ca90a', summary: '<5-10 word recap>' to continue this agent.)
    The agent is working in the background. You will be notified automatically when it completes. You know nothing about its results until that notification arrives — do not report, assume, or predict them; continue other work or respond to the user in the meantime.
    In your own words, briefly tell the user what you launched — do not echo this tool result. Agent results will arrive in a subsequent message. If the user asks for progress, say the agent is still running.

## 結論

readable: no

回傳的文字只有 `agentId`、一句「in the background」的說明，沒有任何路徑或分支字樣，`pathInResult`／`branchInResult` 兩者皆 `false`——brain 拿不到 worktree 的路徑或分支可以直接寫進 commit file 的 `worktree <path>`，Agent 工具的回傳文字這條路不通。

但這不代表要退回 design：worktree 的路徑本來就不必從 Agent 工具的回傳文字讀出來。走法是反過來——帶 `isolation: "worktree"` 派下去的 implementer，在自己的工作目錄裡跑一次 `git rev-parse --show-toplevel`，把量到的路徑寫進自己回給 brain 的報告；brain 再把這個路徑原封不動抄進 commit file 的 `worktree <path>` 那一行。这一步不靠 Agent 工具回傳的文字，Task 7、8 照這個走法繼續，不停下回 design。

這條走法還缺一半驗證：inner agent 的工作目錄是不是真的就是那個 worktree，這次探測本來沒有直接量到——但事後翻 inner agent 自己的 transcript（`agent-a0dc138eb011ca90a.jsonl`）發現每一列都帶一個 `cwd` 欄位，值是 `C:\Users\Owner\AppData\Local\Temp\tmp.lvcM6R1frl\.claude\worktrees\agent-a0dc138eb011ca90a`——與 `worktree-list.txt` 記的 `worktrees[0].path`（只差斜線方向）完全一致。這是 transcript 自己的 `cwd` 欄位量到的，不是 Agent 工具回傳給呼叫者的文字，但足以確認 inner agent 的工作目錄就是那個 worktree：implementer 在自己的 cwd 裡跑 `git rev-parse --show-toplevel` 量得到的會是同一個路徑。

另外要記下 worktree 開在哪個目錄底下：留下的路徑是 `<probe repo>/.claude/worktrees/agent-a0dc138eb011ca90a`，其中 `<probe repo>` 就是這次跑量的暫存 repo 根目錄（`provenance.txt` 記的 `probe repo: /tmp/tmp.lvcM6R1frl`）。也就是說 worktree 開在 repo 根目錄**之內**，而不是外面的獨立目錄。這一點有後果：在 repo 根目錄之內開 worktree 時，一個在 worktree 底下跑的 implementer 若被 `hooks/guard.js` 的檔案存取記錄（`touch` 記下的 claims）攔下，記到的會是 worktree 底下的路徑（例如 `.claude/worktrees/agent-.../lib/foo.js`），而 `lib/guard.js` 的 `relPath` 不會把它對回主樹裡的 `lib/foo.js`——兩者在 guard 眼裡是兩個不相干的路徑，鄰居互相看不見對方的宣告。

只跑了一次（n=1），沒有重跑驗證是否穩定。
