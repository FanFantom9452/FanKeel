- skills/fankeel-land/SKILL.md +6/-5 — 「Agent branches」段補回字面 `git branch -D <name>`，`residue.js --sweep` 獨立成反引號，保留孤兒 `agent-*` 目錄說明，檔案 25383 位元組，在 25400 上限內

done: 修補 verify 退回的 2 個失敗，提交 40f38d16（範圍 82907678..40f38d16）；完整 fast suite 在 40f38d16：6205 通過、0 失敗
docs-check: 仍有 2 項（docs/90-agent/todo/model-3.md、notify-2.md），不是本次修改造成，未處理

reads:
skills/fankeel-land/SKILL.md:402 — 修好的 Agent branches 段
.fankeel/build/task-20261102T074927/suite.tap — 這次 fast suite 的完整輸出

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : TODO 全表盤點","options":[{"label":"Go to Verify (Recommended)","description":"兩個失敗已修，fast suite 6205 通過、0 失敗，回 verify 重新驗證。"},{"label":"Stay in Build","description":"還要再改 land 技能頁或處理 docs-check 剩下的 2 項時留在這裡。"},{"label":"暫停","description":"先停下，之後再從 verify 接手。"}]}],"next":"回 verify 重驗；fast suite 已綠，docs-check 剩 2 項舊 todo 引用。"}
```
