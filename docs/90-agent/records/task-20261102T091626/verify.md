# Verify 報告

結論：移除 station tour 與七階段 mermaid 兩項主張都成立；整套 `--fast` 仍有 4 條失敗，但都不是本任務的程式碼造成，其中本任務留下的 2 條 todo 連結已在這裡修掉。

```
$ node scripts/suite.js --session e6c34744-0acb-424a-a1a6-ed7a2796b2ec --fast
suite: 6140 pass, 4 fail @ 32eb4338
$ node --test tests/station-diagram.test.js tests/pipeline-doc.test.js tests/removed-tour-code.test.js tests/removed-pages.test.js tests/station-nav.test.js
ℹ pass 40   ℹ fail 0
$ node scripts/todo-check.js   (修正後)
fankeel todo-check: 8 problems   （修正前 10；tour-2、explain-2 已不在清單）
```

- station tour 的程式碼、頁面、icons 已移除 — held（adversary 對 lib、scripts、assets、hooks、tests、skills、agents 做不分大小寫 grep，只剩移除守門測試與 `toUrl` 字樣；docs/README.md:402 與計畫檔 :796 是已記的 Ruling）。
- pipeline.md 的 mermaid 與 hooks 時間線 — held（圖中每個腳本都存在，並在對應階段的 SKILL.md 有呼叫處；hooks 對照 `.claude-plugin/plugin.json`，事件與順序相符）。沒檢查實際渲染，也沒逐一核對每個框內的旗標。
- 4 條失敗：3271（registry-2 frontmatter 路徑）屬 shelf 任務，該檔單獨跑 7 通過；3274（鄰居的 mcp-toolbox-db 判斷頁）；5724（todo-check）原有 10 條，其中 2 條是本任務的 tour-2、explain-2，已修，剩 8 條是鄰居的 cc-2-1 判斷頁；5901（tune serve）單獨重跑 35 通過 0 失敗，判為偶發。這 4 條我沒有重跑整套，只重跑了相關檔案。
- docs: none 新增為假；docs-check 剩 10 項皆在 BASE 就壞或屬鄰居（含兩項已記 Ruling）。
- fixed here: docs/90-agent/todo/tour-2.md:6、docs/90-agent/todo/explain-2.md:6 的 `link:` 由決策頁改為 `docs/90-agent/reference/station.md`，todo-check 重跑後這兩條消失；commit 檔為 verify-commit.md。
- adversary（1 個 fankeel-reviewer，檔案預設模型）：推翻了「5724 與本任務無關」，因為 tour-2／explain-2 的 stale citation 是本範圍造成 → 已在此以 docs-only 修正解決，不必回 build。未審：lib/shelf.js（鄰居任務）；review-11 自承 station.md 871-1725 行引用未全數重核。

reads:
- docs/90-agent/todo/ — 剩 8 條 stale citation 屬鄰居的 cc-2-1 判斷頁，land 前確認不是你要擔的
- docs/90-agent/todo/tour-2.md — tour 重做的 TODO 已存在，land 前不必再開

```json gate
{"questions":[{"header":"Verify→Land","question":"Verify -> Land | fankeel : 移除 station tour 並畫 7 階段 mermaid","options":[{"label":"Go to Land (Recommended)","description":"兩項主張都成立，本任務造成的 2 條 todo 連結已修並待 commit；剩下 4 條失敗屬鄰居 session 或偶發。"},{"label":"Stay in Verify","description":"想再重跑整套 suite 或親眼看 mermaid 渲染結果，我沒有檢查渲染。"},{"label":"Back to Build","description":"若要把 station.md 871-1725 行的引用全數重核，退回 build。"},{"label":"暫停","description":"停在這裡，之後再回來。"}]}],"next":"Verify 完成：tour 移除與 mermaid 皆成立，下一步 Land"}
```
