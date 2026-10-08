---
label: stage-agents
title: ab.sh 改在 worktree 提交
description: ab.sh 改成在 worktree 裡 commit profile（`pin.sh`）；修好的 script 還沒重跑，重跑要核准約 $30 — [ab.sh](docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh).
state: decision
link: docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh
---

來源：根目錄 TODO.md 第 89 行的條目（2026-09-26 記），改成逐條的 todo 檔，讓它被 todo-check 與 station 讀到，而不是只躺在根目錄一份沒人讀的清單裡。

要做成：ab.sh 改成在 worktree 裡 commit profile（`pin.sh`）；修好的 script 還沒重跑，重跑要核准約 $30

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據，也就是（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 為什麼還開著

這條記的是 09-26 那次 A/B 的腳本修好了沒重跑。它比的是 controller 用 opus 對 sonnet，兩臂的 `stage.agents` 都是 `false`（ab.sh 開頭註解與 99 到 100 行），所以它量不到 2026-10-09 評審要的那個對照：build 與 verify 交給站 agent 對不交。那個對照是 `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh`，由 2026-10-09 的工作流評審任務寫、使用者核准花費後跑。這條留著是因為 opus 對 sonnet 的問題（controller 用哪個模型）仍沒有 n>1 的答案；完成條件：10-09 那次對照跑完後，若它的 summary 順便給出 controller 模型的數字就關閉這條，否則由使用者決定要不要另花約 30 美元重跑 09-26 的腳本。
