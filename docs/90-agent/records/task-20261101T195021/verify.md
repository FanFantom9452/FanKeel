# verify — retro-all 匯出 ZIP 回傳

結論：功能本身成立，突變全數被測試擋下，但家目錄遮蔽有一個已確認的漏洞（JSON 跳脫寫法），且 `report.md` 與 manifest 的 `packages` 沒有遮蔽。這些是隱私預設的缺口，應回 build 修，不在這裡改。

```
$ node scripts/suite.js --session cd7716d6-0543-4b36-aedb-03eec8cbe7ae --fast
suite: 6194 pass, 0 fail @ 79f4b231
$ node scripts/docs-check.js
4 references that no longer resolve (rationale.md:29,31; todo/model-3.md:12; todo/notify-2.md:18) — 都不是本次改的檔案
$ 四個突變（各 node --test）
record.js:439 遮蔽關掉 → 6 測 3 敗；record.js:499 sha256 檢查關掉 → 3 敗；zip.js:125 CRC 檢查關掉 → 1 敗；record.js:509 不跳過既有包 → 2 敗；四個檔案皆還原，git diff --stat 為空
```

- export 與 import 照設計第 4、5 節運作，檢查在寫入前 — held
- 遮蔽、sha256、CRC、不覆蓋既有包四項防護，各有測試能紅 — held（4 applied / 4 killed / 0 survived）
- 設計第 3 節「所有字串值中的家目錄換成 [HOME]」— did not hold：JSON 跳脫寫法（`C:\\Users\\name`，雙反斜線）不會被換，出現在內嵌 JSON 的字串值與 `{f, raw}` 解析失敗的列；bundle 標 `homeMasked: true` 但使用者名仍在。reviewer 確認（CONFIRMED）。→ build
- `report.md`（record.js:473）與 manifest 的 `packages`（record.js:452,466）沒有遮蔽，`homeMasked: true` 只描述 bundle；目前月檔與 package.json 沒有家路徑，所以現在不外洩，未來會。reviewer 判 PLAUSIBLE。設計第 3 節本來只遮 bundles，build 已記為 ruling，這裡仍列為隱私缺口讓你決定。
- 測試缺口（CONFIRMED）：import 層級只測 sha256 不符；無 manifest、缺包、CRC 損壞、`records/sessions` 取包、skill 的 multiSelect 文字都沒測。
- 檔名 `...zip` 的 stem 為 `..`，manifest.json 與 report.md 會寫進 `.fankeel/` 而非 `imports/<stem>/`（CONFIRMED，低風險，檔名是使用者自己給的）。
- readJson 對損壞的 package.json 靜默回 null（PLAUSIBLE，低）。
- 控制端回報的四個編輯器診斷（record.js:353 `homePattern` 未讀、:499 與 :509 無法到達、zip.js:99 `crc` 未讀）— 全部是我派的突變測試在共用工作樹上暫時改檔的產物：突變一把 `re` 設成 null（所以 `homePattern` 沒被讀）、突變二與四把條件換成 `false`、突變三拿掉 `crc` 比對。還原後 `git status` 沒有改動的追蹤檔，record.js:439 仍呼叫 `homePattern`，:499、:509、zip.js:125 都是原文。四個診斷不成立，`homePattern` 涵蓋設計列的形式（原生、正斜線、Git Bash `/c/Users`、win32 不分大小寫），唯一漏的是上面的雙反斜線。
- docs: 無本次造成的新錯；documents.md 已由 build 修。docs-check 的四項是舊的 gone/moved/bare-code，非本次改動。
- fixed here: 無（沒有派 fixer，沒有 commit 檔）。
- adversary: 遮蔽漏掉 JSON 跳脫寫法 → build；`report.md` 與 `packages` 未遮蔽 → build（或接受設計 ruling）；import 失敗路徑與 `...zip` 檔名 → build。

未能檢查：Windows 以外平台的遮蔽行為、`npm ls -g` 路徑。fast suite 的 6194 是在我派突變之前啟動的一次跑，同一時間共用工作樹有突變改檔，兩位突變者也回報看到檔案被短暫改動；突變全部還原後我沒有重跑整個 suite。fast 紀錄不是 land 要的完整紀錄，land 會跑全套。

reads:
scripts/record.js:353 — homePattern 與 maskBundle，補雙反斜線與 `raw` 列的遮蔽
scripts/record.js:473 — report.md 與 packages 是否也要遮蔽
tests/record-export.test.js:18 — 只種了單反斜線寫法，補 JSON 跳脫與 import 失敗案例

```json gate
{"questions":[{"header":"Verify→Audit","question":"Verify -> Audit | fankeel : retro-all 改成匯出 ZIP 回傳，不 push","options":[{"label":"Go to Audit","description":"接受目前狀態進 audit：突變 4 殺 4、fast suite 6194 全過；已知缺口是 JSON 跳脫寫法的家目錄沒被遮蔽，以及 report.md 與 packages 未遮蔽，會帶進 audit。"},{"label":"Back to Build (Recommended)","description":"回 build 補漏洞：maskBundle 加雙反斜線寫法並覆蓋 raw 列，manifest 與 report.md 也過一次遮蔽，補 import 失敗路徑的測試，並處理 `...zip` 檔名。匯出檔會給別人，隱私漏了比多一圈更貴。"},{"label":"Stay in Verify","description":"我先在這裡再查一項，例如用真實 bundle 跑一次匯出再 grep 使用者名，確認漏洞在實際資料上是否出現。"},{"label":"暫停","description":"next 設為：決定遮蔽缺口要回 build 修還是接受，再進 Audit。"}],"multiSelect":false}],"next":"決定遮蔽缺口（JSON 跳脫、report.md、packages）回 build 修還是接受，再進 Audit"}
```
