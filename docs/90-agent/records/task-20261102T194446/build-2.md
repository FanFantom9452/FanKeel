# Build 退回修正

- skills/fankeel-land/SKILL.md +2/-2 — 收工後匯出改寫成 `record.js session --closed --session <id>`，不再誤導去跑 `retro --closed`
- tests/record-export.test.js +10 — 無 `--cross` 的單包 ZIP 可被 import
- tests/record-bundle.test.js +8 — `--closed` 用在 active 任務與不加時相同
- docs/90-agent/todo/record-2.md (new) — TODO「接收他機送來的對話包 ZIP」（標題因 28 欄上限比原話短）

done: 2 of 2 — 兩個修正各一次 commit（8831aab6、3ec89f94），無 plan，無 ledger
suite：`suite.js --fast` 6196 通過、1 失敗，失敗是 `tests/source.test.js:225`，原因是 `docs/90-agent/todo/worktree-1.md` 的 frontmatter `description` 寫了 `.claude/worktrees/` 路徑；該檔來自更早的 a0049c6c，不是這次改動，我沒有修。兩個新測試的 mutation 實作者沒有實際跑過，我也沒有另派 reviewer 審這次的小 diff。
docs-check: 只剩 todo 頁的 bare-code 兩筆，皆不是這次的頁面；未動
deferred: 接收他機 ZIP — docs/90-agent/todo/record-2.md

reads:
skills/fankeel-land/SKILL.md — 291 行新句子
docs/90-agent/todo/worktree-1.md — frontmatter 路徑造成 source.test.js 紅燈，land 前需處理

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : 已收工任務的 ZIP 匯出，退回修正完成，要進 verify 嗎？","options":[{"label":"Go to Verify (Recommended)","description":"land skill 那句已改正，兩個測試已補；fast suite 只剩 一條 worktree 相關 TODO 的既有路徑紅燈，與本次無關。"},{"label":"Stay in Build","description":"先修那條 TODO 的 frontmatter 路徑讓 source.test.js 轉綠，再進 verify。"},{"label":"暫停","description":"先停在這裡，之後再繼續。"}]}],"next":"build 完成，進 verify 重驗 land skill 句子與兩個新測試。"}
```
