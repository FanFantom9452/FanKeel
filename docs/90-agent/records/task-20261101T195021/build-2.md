# build 第二輪 — 匯出遮蔽缺口修補

結論：verify 列的四項都已修完並提交，快速 suite 6201 全過。修法與取捨如下，審查者（reviewer）的兩個發現也已處理。

- scripts/record.js +10/-3 — `homePattern` 把家路徑每個反斜線視為一段或多段，涵蓋 JSON 跳脫的雙反斜線與內嵌 JSON 的四反斜線；manifest 與 report.md 也過同一個遮蔽（`--keep-home` 時不遮），`homeMasked` 描述整個 ZIP；匯入時檔名主幹為空或全是點（如 `...zip`）、或含路徑分隔符就拒絕，且在任何寫入之前；`homePattern` 匯出供單元測試
- tests/record-export.test.js +90/-1 — fixture 加雙反斜線與 `{f, raw}` 列；新測 manifest 與 report.md 遮蔽、`records/sessions` 取包、匯入缺 manifest、缺包、CRC 損壞、`...zip` 檔名；另有一個不分平台的 `homePattern` 單元測試（POSIX 上原本殺不死 `+` 的突變）
- docs/90-agent/plans/2026-11-02-retro-zip-design.md +3/-1 — 第 3 節改為遮蔽範圍含 manifest、report.md 與跳脫寫法

done: 3 of 3 — 原計畫已完成；本輪為 verify 修補（範圍 92af84ef..13a0f4d4）
docs-check: 3 項（rationale.md:31、model-3.md:12、notify-2.md:18）皆為舊項、非本次改動；未動
review: 一位 reviewer，兩項發現（POSIX 上無法紅的測試、設計文件舊句）已修；正則、stem 檢查無誤
未能檢查：非 Windows 平台實跑；reviewer 因唯讀未能實際套用突變，由實作者在 worktree 套用 8 個突變皆紅；`readJson` 對損壞 package.json 回 null（低、不在清單）未處理。

reads:
scripts/record.js:355 — homePattern 與遮蔽最終形式
tests/record-export.test.js:17 — 新增的遮蔽與匯入失敗測試
.fankeel/build/task-20261101T195021/verify.md — 上一輪缺口清單，對照是否都修了

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : retro-all 改成匯出 ZIP 回傳，不 push","options":[{"label":"Go to Verify (Recommended)","description":"遮蔽缺口已補（雙反斜線、raw 列、manifest、report.md、...zip 檔名），匯入失敗測試已補，fast suite 6201 全過，進 verify 重驗。"},{"label":"Stay in Build","description":"再看一項，例如 readJson 對損壞 package.json 靜默回 null 要不要一併處理。"},{"label":"暫停","description":"先停在這裡，之後再決定要不要進 Verify。"}],"multiSelect":false}],"next":"進 Verify 重驗遮蔽與匯入失敗路徑"}
```
