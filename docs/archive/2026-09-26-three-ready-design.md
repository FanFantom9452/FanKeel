---
status: current
last_verified: 2026-09-26
---

# 三項：design 交棒給 build 站 agent、security lens 本地先篩、ab.sh 釘住 profile

session 328e9121-ab0d-4ff2-a2ef-317dbabfa709 的 design。survey 在
`.fankeel/build/task-20260925T182646/survey.md`。三個子題之間不共用資料流，
只有 `lib/stages.js` 這個檔案是共用的，分組交給 plan 決定。

## 1. design 交棒給 build 站 agent

現況：build brain 的輸入由 `renderBrainBrief`（`lib/render.js`）決定，順序是先
`previousHandoff`（`lib/handoff.js`），往回找 `moves` 裡前面各站的 handoff 檔；
找不到才用 `newestPlan`，挑 task 開始後才寫的 `docs/plans/*.md`。architectural
的 design 會寫 `docs/plans/*-design.md`，所以接得上。bounded 的 design 只存在
聊天裡，brain 什麼都拿不到。09-25 那次只能靠 SendMessage 補。

- design 在 session 內跑、build 由站 agent 跑，而且 route 上 design 的下一站就是
  build（也就是中間沒有 plan）時，design 站多注入一條規則：在 gate 之前，把核准的
  設計（也就是 output shape 那份）寫到 `handoffPath(root, data, 'design')`，
  即 `.fankeel/build/task-<started>/design.md`。
- 條件照 `rulesFor` 處理 `design.mockup` 的方式：在 `forWhen` 上加一個虛擬 key，
  不去改 `holds`。
- 有 plan 的 route 不注入這條。原因是 `previousHandoff` 會回傳它往回找到的第一個
  檔；如果 design.md 存在，就會蓋過 `newestPlan` 本來會挑的 plan 檔。
- hook 不用改。`hooks/guard.js` 只在「目前這一站受控」時擋主執行緒的寫入，
  design 站本身不受控。
- `skills/fankeel-design/SKILL.md` 和 `docs/subagents.md` 各補一句說明這條管道。

## 2. security lens：本地模型先篩，reviewer 逐條確認

- 新增 profile key `security.local`，值是一個 ollama 模型名稱，例如 `qwen3:14b`，
  預設不設。不設的時候，一切照現在的流程走。
- 新增 `scripts/security-local.js --range <a>..<b> --model <m> --out <file>`：
  取 `git diff <range>`，把 `agents/fankeel-reviewer.md` 的 `## Security` 段
  **從檔案讀出來**當 prompt（不另存一份副本，免得兩邊漂移），POST 到
  `http://127.0.0.1:11434/api/generate`（`stream: false`），再把回覆裡符合
  `path:line: <tag> ...` 格式的行寫進 `--out`。連不到 ollama 就以非零碼結束並
  說明原因。
- verify 站多一條 `when: 'security.local'` 的規則：派 adversary 之前先跑這支
  script，把候選檔的路徑寫進 brief。script 失敗就照原本的方式跑完整 lens，並把
  失敗的原因說出來。
- `agents/fankeel-reviewer.md` 的 `## Security` 補一段：brief 附了候選檔時，
  只逐條確認候選行（沿 source→sink 追一遍，決定留下或駁回），輸出格式不變。
- 「清單和 AI CODING SECURITY 對齊」退回 `## Waiting`，放回
  `### AI CODING SECURITY 定案`，解除條件照 3d6543e2 原本寫的。它被移回 Ready
  是 d0c7158d 批次清理造成的，不是那個專案有了進展。

## 3. ab.sh 在 worktree 裡 commit profile

- 把修好的 script 放在新的 evidence 目錄
  `docs/reports/evidence/2026-09-26-ab-profile-pin/`。舊目錄屬於 report 角色，
  只寫一次，不能改。
- 把 profile 的釘選抽成 `pin.sh <worktree> <value>`：先
  `task.js profile set stage.agents <value>`，再在 worktree 裡
  `git add .fankeel/profile.json && git commit`。新的 `ab.sh` 呼叫它。
- 這次不重跑量測。Ready 那條換成 `## Waiting` 的一條，解除條件是使用者核准重跑
  的花費（09-25 兩個 arm 合計約 $30）。
- `TODO.md:84`（Needs a decision 的交棒那一條）在第 1 節落地時一起刪掉。

## 驗收

| 子題 | 現在失敗、之後通過 |
|---|---|
| 1 | `tests/stages.test.js`：設 `stage.agents=['build']`、route 是 `survey,design,build`，`rulesFor('design')` 要有寫入 design.md 的那條；route 裡有 plan 時不能有；design 受控時也不能有 |
| 2 | `tests/security-local.test.js`：起一個假的 ollama http server，回一段混了雜訊的文字，script 只把符合格式的行寫進 `--out`；server 關掉時以非零碼結束。另外驗 `profile set security.local qwen3:14b` 會被接受 |
| 3 | `tests/ab-pin.test.js`：在暫存 repo 的 worktree 裡跑 `pin.sh <wt> false`，接著 `git stash push -u` 再 `git stash drop`，`profile show` 仍然要是 `false`。對照組：舊流程只做 `profile set`，同樣的 stash/drop 之後會退回 BASE 的值 |
| 產物 | 第 1 節：用真實的 registry 記錄跑一次 `renderBrainBrief`，brief 裡的 `read first:` 要指到 design.md |

## 沒驗證的

- `rulesFor` 被呼叫時，`subs` 裡是否已經有「下一站」的名字，可以拿來判斷
  「design 的下一站是 build」。如果沒有，就要把 route 傳進去，第 1 節會多改一個
  呼叫點。
