- lib/stages.js +2/-N — AWAIT_RULE 的 Bash description 改成實際 stage 名（原本寫死 survey），並刪 60 字讓 build 區塊回到 2400 內
- tests/stages.test.js、render.test.js、await-rule-description.test.js — 跟著新字句；await 規則逐 stage 驗證
- tests/station-focus.test.js、survey-affected.test.js — shell 列的 `label` 與搬動後的 require 行號
- skills/fankeel-init/SKILL.md 15184 -> 13925 bytes — 回到 14000 上限，共用的 one-path 條目保持原文
- docs/01-guide/profile.md、collisions.md、subagents.md、model-3.md — 引用行號更新；Monitor 由 hook 接管一事標為「未實測」

done: 20 of 20 — ledger；收尾 commit 771024e1；fast suite 6190 pass / 0 fail
docs-check: 修了 6 個，剩 6 個不是本次 build 造成（README tour-record.js、plan rationale 兩個已刪計畫、improvement-brief 的 registry.js:453、judge-6 與 notify-2 的裸 commit 碼）
hands: 無（Task 19、20 已完成）
全分支審查找到 2 點：await 描述寫死 survey（已修）、Monitor 路由未實測（已在文件標明，plugin.json matcher 仍是 `Bash|PowerShell`，未放寬）。

reads:
docs/90-agent/plans/2026-11-02-todo-patrol.md — 計畫的 Coverage，verify 對照用
.fankeel/build/task-20261102T121659/build-g12.md — 計畫外的 dispatch-gate 修正，需要驗證
.fankeel/build/task-20261102T121659/build-g4.md — guard 對 Monitor 的處理（未實測）

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : TODO 全表盤點 + shell 標示看得出在跑什麼","options":[{"label":"Go to Verify (Recommended)","description":"20 項任務與計畫外的 dispatch-gate 修正都已 commit（commit 771024e1），fast suite 全綠；剩下的 docs-check 項目都是舊的。"},{"label":"Stay in Build","description":"再補 Monitor 的 plugin.json matcher 實測或放寬 `Bash|PowerShell`，目前只在文件標為未實測。"},{"label":"暫停","description":"先停在這裡，之後再從 verify 接手。"}]}],"next":"build 完成，進 verify 驗證 20 項任務與 dispatch-gate 修正"}
```
