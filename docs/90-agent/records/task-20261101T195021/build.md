# build — retro-all 匯出 ZIP 回傳

- lib/zip.js (new) — 只寫 stored、可讀 stored 或 deflate 的 ZIP；損壞的 deflate 以 CRC 錯誤回報
- scripts/record.js +219/-9 — `export` 與 `import` 兩個動詞，驗證在寫入之前
- skills/fankeel-retro-all/SKILL.md +25 — 不再 push，改在 gate 回傳 ZIP，並可收 ZIP；大小上限 3000→3700
- tests/zip.test.js、tests/record-export.test.js (new)、tests/skill-size.test.js
- docs/90-agent/reference/documents.md +4/-2 — 補 `exports/`、`imports/` 兩列，`bundles/` 列註明 import，「其餘十區」

done: 3 of 3 — ledger（另有 task 1 與 documents.md 各一筆 fix）
suite: 6194 pass, 0 fail @ dbf60b60（documents.md 為純 .md 修正，未重跑）
docs-check: 本次相關的 1 項已修；其餘 4 項 gone/moved/bare-code（rationale.md、todo 頁）不是本次改的檔案，留著
review: 全分支 reviewer 2 項——documents.md 已修；`report.md` 未做 home 遮蔽，依設計第 3 節只遮 bundles，記為 ruling。
未能檢查：docs-check 其餘項目沒有在最初 BASE 上逐一驗證。

reads:
scripts/record.js — export/import 的實作，verify 要對照設計逐項驗
skills/fankeel-retro-all/SKILL.md — 新流程與隱私問題
docs/90-agent/plans/2026-11-02-retro-zip-design.md — verify 的依據

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : retro-all 改成匯出 ZIP 回傳，不 push","options":[{"label":"Go to Verify (Recommended)","description":"三個任務都完成，fast suite 6194 全過，全分支 review 的兩項已處理（一項修正、一項依設計記為 ruling）；進 verify 做對照與突變檢查。"},{"label":"Stay in Build","description":"若要把 report.md 也做 home 遮蔽（設計只遮 bundles），在這裡再改。"},{"label":"暫停","description":"next 設為：決定 report.md 是否也遮蔽，再進 Verify。"}],"multiSelect":false}],"next":"進 Verify：核對 export/import 與隱私預設"}
```
