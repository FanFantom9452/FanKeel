---
status: decision
last_verified: 2026-10-16
---

# build 的 workflow 由 script 產，brain 交給主控開（10-16）

一句話：`ledger.js --plan <f> workflow --group <N>` 把 plan 的一個 workflow 分組寫成 Workflow script 並印出路徑；build 站交給站 agent 時，brain 跑同一條指令、在報告寫 `workflow: <path>`，由主控用 `Workflow({ scriptPath })` 開，再把結果 SendMessage 回 brain。

## 決定

- `workflowScript`（`lib/plantasks.js`）產出一個分組的 script：每個 implementer 任務一個 pipeline 項目，先 implement 再 review，中間沒有 barrier；script 帶工作樹的絕對路徑，不用 `Date.now`、`Math.random`。三個以下的分組不產 script。
- `ledger.js workflow --group <N>` 先寫好每個任務的 brief，再寫 script，放在 ledger 旁邊，印出路徑與 commit 順序。
- 主控那邊的規則區塊不加字：`scripts/await.js` 讀到報告裡的 `workflow:` 行，自己印出「用 scriptPath 開、把結果 SendMessage 給哪個 agent」。它也把 brain 的 inflight 記號重設到現在，下一次 await 不會把同一份報告再交一次。
- brain 的規則（`agents/fankeel-brain.md`）寫明：分組列三個以上才跑指令；收到 `Workflow returned:` 後存回傳、要 commit、記 `complete`；某個 implementer 回傳是 null 的，當作沒跑，改用一個 Agent 重派。

## 為什麼

站 agent 沒有 `Workflow` 工具，build 交給站 agent 時，三個以上互不衝突的任務只能退成一次派幾個 Agent，主控又得把每份回傳讀進自己的 context。10-09 有一個 plan 站的 brain 量到 439,419，過了 400k 的線，所以這條 TODO（stage-agents-16）在 10-16 解除。

## 放棄了什麼

- 在主控的 build 規則（`BUILD_GROUP_RULE`）加一句：受控 build 區塊已經 2352／2400 字，加不下；改由 `await.js` 的輸出帶指令，那裡沒有字數上限。
- 把完整指令寫進 brain 的 brief：brief 接近 `BRIEF_MAX`，brief 只加 147 字的一行，指令放在 agent 檔。
- 讓 script 寫在旁邊的 worktree 直接開：實跑發現 `scriptPath` 只收 session 讀得到的資料夾，寫在別的 worktree 的 script 要先複製進來。brain build 在主樹跑，不會遇到。

實跑：run `wf_07faf449-04a`，在提交「docs: plan for the 10-16 TODO patrol」的 detached worktree 跑 10-16 盤點那份 plan 的第 1 組，8 個 agent 全部完成。紀錄在 [stage-agents-16](../90-agent/todo/stage-agents-16.md)。
