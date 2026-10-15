---
label: stage-agents
title: build workflow 由 script 產
description: 站 agent 拿不到 `Workflow` 工具，所以 build 那一站的 workflow 要由 script 從 plan 的分組產生、主控用 `scriptPath` 開；分組與 surface 由 `ledger.js groups` 算好了 — [lib/plantasks.js](lib/plantasks.js).
state: done
link: lib/plantasks.js
done:
  at: 2026-10-16
  sha: 2eef30e1
  disposition: done
---

來源：根目錄 TODO.md 第 116 行的條目（2026-09-26 記），改成逐條的 todo 檔，讓它被 todo-check 與 station 讀到，而不是只躺在根目錄一份沒人讀的清單裡。

要做成：站 agent 拿不到 `Workflow` 工具，所以 build 那一站的 workflow 要由 script 從 plan 的分組產生、主控用 `scriptPath` 開；分組與 surface 由 `ledger.js groups` 算好了

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據，也就是（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 為什麼還開著

這條是 675e9ec4（2026-09-21，「TODO 收一條、開一條、移一條到 Waiting」）開出的：站 agent 沒有 `Workflow` 工具，build 站若交給站 agent，三個以上互不衝突的任務就只能退成幾個 Agent 一次派出，主控又得把每份回傳讀進自己的 context。我在 2026-10-09 查了：`lib/plantasks.js` 的 `surfaces` 與 `ledger.js groups` 只算出分組與該用的 surface，沒有任何 script 把分組寫成 workflow 檔，`git grep -nw scriptPath -- lib scripts skills agents hooks` 無輸出（不加 -w 會撞到 `transcriptPath`），所以問題還在。當時動手的時機沒到：本 repo 的 `stage.agents` 現在只列 survey，build 與 verify 在主 session 跑，主 session 有 `Workflow`，沒有東西卡住。要修的地方是 `lib/plantasks.js` 加一個函式，從 `surfaces` 的 workflow 分組產出 workflow script，並由 `scripts/ledger.js` 印出路徑讓主控用 `scriptPath` 開。完成條件是 `node scripts/ctx.js <session-id> --by-stage` 量到 build 或 verify 的站 agent 自己的 context 過 400k，且一份真實 plan 經新函式產出的 script 能跑完；該函式附的測試先紅後綠。在那之前不做（已於 10-16 結案，見下）。

2026-10-16 盤點：`scripts/ctx.js` 量到 `C:/Users/user/.claude/projects/F--ymlab-fankeel/8846548c-26e8-4b4a-a6cd-c8d649c9de33/subagents/agent-a45b1252f91424483.jsonl`（10-09，「擴大 Haiku 角色測試與飄移」的 plan 站 brain）turn peak 439,419，過了 `lib/context.js` 的 400k 線。原條件只看 build 或 verify 的站 agent；使用者在 10-16 的 design gate 決定改為任一站 agent 過 400k 即算，因此改標 ready。另有 338,010（5045b7f4…/agent-acbe2b924f5b29f45.jsonl，站別未查）與 313,597（同一個 8846548c 的 plan 站）。完成條件的後半——一份真實 plan 經新函式產出的 script 能跑完、測試先紅後綠——不變。

2026-10-16 結案：產生器與 brain 轉交主控都做了，分支 build-workflow-script。`workflowScript`（`lib/plantasks.js`，09aa8a49）把一個 workflow 分組寫成 Workflow script；`ledger.js --plan <f> workflow --group <N>`（f9bb7fd5）寫出 script 並印出路徑；build brain 的分組列有三個以上時跑這條指令、在報告寫 `workflow: <path>`（ef9ddd41、dc70dfec），`scripts/await.js` 讀到這行就叫主控用 `Workflow({ scriptPath })` 開、再把結果 SendMessage 回 brain，並保留 brain 的 inflight 記號，不會把同一份報告交兩次（a394b716、3f41c56b）；build skill 與 `docs/90-agent/reference/subagents.md` 已改寫（46e6b57e、5fcf45aa）。測試先紅後綠：`tests/plantasks-workflow.test.js` 8 條在 `workflowScript` 寫出前全紅、寫出後 `ℹ pass 8 / ℹ fail 0`。真實跑一次：在 0d1bc90a 的 detached worktree 用 `docs/99-archive/2026-10-16-todo-patrol-probes.md` 第 1 組（4 個 sonnet 任務）產出 script，run `wf_07faf449-04a` 狀態 completed，agentCount 8，totalTokens 136,572，durationMs 59,505；四個 implementer 都回 `done`，四個 reviewer 都有回傳（2、4 clean，1、3 各指出原 plan 文字的問題，屬那次已落地的工作，不在這裡修）；跑完後主樹 `git status` 沒有任何 run 寫的檔。實跑發現一條限制：`scriptPath` 只收這個 session 讀得到的目錄，寫在旁邊 worktree 的 script 會被拒，要先複製進 repo 的 `.fankeel/build/` 再開。
