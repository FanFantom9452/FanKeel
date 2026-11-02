# verify 第二輪 — retro-all 匯出 ZIP 回傳

結論：上一輪的四個缺口都已修好，而且各有能紅的測試；全套 fast suite 在所有突變還原後重跑，6201 全過。只剩一個新的小漏洞：家目錄後面緊接句點時（例如 `open C:\Users\ann.`），`homePattern` 的 lookahead `(?![\w.-])` 會放過它，使用者名留在檔案裡而 bundle 仍標 `homeMasked: true`。這個 lookahead 是舊的，但這一輪讓同一個正則也跑在 report.md 的散文上，曝險變大，所以列為缺口。

```
$ node scripts/suite.js --session cd7716d6-0543-4b36-aedb-03eec8cbe7ae --fast   （三個突變都還原、git status 無追蹤檔改動之後才跑）
suite: 6201 pass, 0 fail @ 1b539258
$ node scripts/docs-check.js
3 項未解（rationale.md:31、todo/model-3.md:12、todo/notify-2.md:18）— 都是舊項，非本次改動
$ node --test tests/record-export.test.js（三個突變，各由 fankeel-mutator 套用並還原）
record.js:359 去掉反斜線連續比對 → 13 測 2 敗；record.js:476 manifest 不遮蔽 → 1 敗；record.js:508 檔名主幹檢查關掉 → 1 敗；皆 git diff --stat 為空
$ 我自己跑 homePattern（家路徑 C:\Users\ann）
"open C:\Users\ann." → 沒換；"C:\Users\ann\x" → "[HOME]\x"；"C:\Users\anna"、"ann-x" → 沒換（正確）；"ann, ok" → "[HOME], ok"
```

- 缺口一（JSON 跳脫的雙、四反斜線，含 `{f, raw}` 列）— held；程式在 record.js:355-362，單元測試涵蓋 1、2、4 個反斜線，拿掉 `+` 就紅（3 突變中的 1，殺 2 測）。
- 缺口二（report.md 與 manifest 的 `packages` 遮蔽）— held；record.js:443、:476，tests/record-export.test.js:157 兩者都斷言，manifest 不遮蔽的突變被殺。
- 缺口三（匯入失敗路徑測試：缺 manifest、缺包、CRC 損壞、`records/sessions` 取包）— held；對抗者讀過，每個測試都斷言「沒有寫入任何東西」。
- 缺口四（`...zip` 檔名）— held；檢查在任何寫入之前（record.js:507-508），測試斷言 `.fankeel` 不存在，檢查關掉的突變被殺。
- 突變共套用 3、殺 3、存活 0。
- 新缺口（對抗者提出，我親自重現）：record.js:361 的 `(?![\w.-])` 擋住了結尾句點，所以 `C:\Users\ann.` 不會被遮蔽。保護的本意是 `ann.bob` 與 `anna`；建議改為 `(?![\w-]|\.\w)`，並補一個結尾句點與逗號的測試。目前測試沒有涵蓋。→ build。
- 小註：homePattern 標頭註解說 Windows 路徑「在任何大小寫」比對，但 `i` 旗標只在 win32 設；URL 編碼的家路徑（`C%3A%5C...`）不在涵蓋內。兩者都低。
- docs: 無本次造成的新錯；設計文件第 3 節已由 build 更新。
- fixed here: 無（沒派 fixer，沒有 commit 檔）。
- adversary: 結尾句點讓家目錄不被遮蔽 → build。安全、silent failure、comment 三個鏡頭無其他發現。對抗者沒有重跑 suite 與突變，這兩項是我跑的。

未能檢查：Windows 以外平台的實際遮蔽行為、URL 編碼家路徑、`readJson` 對損壞 package.json 靜默回 null（低、上一輪已列、build 刻意不處理）。fast 紀錄不是 land 要的完整紀錄，land 會跑全套。

reads:
scripts/record.js:361 — homePattern 的 lookahead，結尾句點要放行
tests/record-export.test.js:17 — 補結尾句點與逗號的遮蔽測試

```json gate
{"questions":[{"header":"Verify→Audit","question":"Verify -> Audit | fankeel : retro-all 改成匯出 ZIP 回傳，不 push","options":[{"label":"Go to Audit (Recommended)","description":"上一輪四個缺口都已修且測試能紅：突變 3 殺 3、fast suite 6201 全過。唯一剩下的是家目錄後緊接句點（如 C:\\Users\\ann.）不被遮蔽，範圍窄；可帶進 audit 一併處理。"},{"label":"Back to Build","description":"回 build 把 record.js:361 的 lookahead 改成 (?![\\w-]|\\.\\w) 並補測試。匯出檔會給別人，若你不想帶任何已知漏洞進 audit，選這個。"},{"label":"Stay in Verify","description":"我先再查一項，例如用真實 bundle 匯出後 grep 使用者名，看句點結尾的寫法在實際資料裡有沒有出現。"},{"label":"暫停","description":"next 設為：決定結尾句點的遮蔽漏洞要回 build 修還是帶進 Audit。"}],"multiSelect":false}],"next":"決定結尾句點的遮蔽漏洞要回 build 修還是帶進 Audit"}
```
