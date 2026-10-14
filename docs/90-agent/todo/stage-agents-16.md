---
label: stage-agents
title: build workflow 由 script 產
description: 站 agent 拿不到 `Workflow` 工具，所以 build 那一站的 workflow 要由 script 從 plan 的分組產生、主控用 `scriptPath` 開；分組與 surface 由 `ledger.js groups` 算好了 — [lib/plantasks.js](lib/plantasks.js).
state: blocked
link: lib/plantasks.js
group: brain 的 context 撐不住
timing: after: `scripts/ctx.js` 量到 build 或 verify 的站 agent 自己的 context 過 400k（`lib/context.js` 的線）
stamp: 2026-10-15
---

來源：根目錄 TODO.md 第 116 行的條目（2026-09-26 記），改成逐條的 todo 檔，讓它被 todo-check 與 station 讀到，而不是只躺在根目錄一份沒人讀的清單裡。

要做成：站 agent 拿不到 `Workflow` 工具，所以 build 那一站的 workflow 要由 script 從 plan 的分組產生、主控用 `scriptPath` 開；分組與 surface 由 `ledger.js groups` 算好了

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據，也就是（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 為什麼還開著

這條是 675e9ec4（2026-09-21，「TODO 收一條、開一條、移一條到 Waiting」）開出的：站 agent 沒有 `Workflow` 工具，build 站若交給站 agent，三個以上互不衝突的任務就只能退成幾個 Agent 一次派出，主控又得把每份回傳讀進自己的 context。我在 2026-10-09 查了：`lib/plantasks.js` 的 `surfaces` 與 `ledger.js groups` 只算出分組與該用的 surface，沒有任何 script 把分組寫成 workflow 檔，`git grep -nw scriptPath -- lib scripts skills agents hooks` 無輸出（不加 -w 會撞到 `transcriptPath`），所以問題還在。但動手的時機沒到：本 repo 的 `stage.agents` 現在只列 survey，build 與 verify 在主 session 跑，主 session 有 `Workflow`，沒有東西卡住。要修的地方是 `lib/plantasks.js` 加一個函式，從 `surfaces` 的 workflow 分組產出 workflow script，並由 `scripts/ledger.js` 印出路徑讓主控用 `scriptPath` 開。完成條件是 `node scripts/ctx.js <session-id> --by-stage` 量到 build 或 verify 的站 agent 自己的 context 過 400k，且一份真實 plan 經新函式產出的 script 能跑完；該函式附的測試先紅後綠。在那之前不做。
