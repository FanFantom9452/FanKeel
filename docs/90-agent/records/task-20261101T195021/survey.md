fankeel map — 1388 份 markdown，4 份 planned, not built，417 份 retired，93 份 undeclared。
fankeel survey — 3677 個檔案，比對 zip、archive、bundle、retro；skipped: 1 個超過大小上限、1807 個副檔名沒有宣告樣式（皆與本案無關，只計數）。

結論：repo 裡已有「匯出、列出、歸檔」的完整鏈，缺的是「把報告、bundle 與環境 manifest 打成一個 ZIP」與「在另一端匯入驗證」兩步；專案沒有任何相依套件，ZIP 容器得自己寫，環境讀取也得新寫。

- scripts/record.js:191 — `record.js session` 把主對話、subagent 對話、adopt 來源 session 打成遮蔽過的 `.jsonl.gz`，預設放 `.fankeel/bundles/`（gitignored，.fankeel/.gitignore:10），`--commit` 且 ≤2 MB（record.js:116）才放進 `<records>/sessions/`；目前 repo 追蹤的 `records/sessions` 檔案數是 0。
- scripts/record.js:201 — 檔名是 `YYYY-MM-DD-<id8>.jsonl.gz`；`listBundles`（record.js:229）靠 `n.slice(11,19)` 取 id8，所以匯入時檔名必須保持這個格式，且只掃 `.fankeel/bundles` 與 `<records>/sessions`、只認 `.jsonl.gz`。
- scripts/record.js:229 — `sessions --list` 以月檔裡有沒有 `<summary>retro <id8> ` 判斷 `retro: filed`；月檔是 `<records>/YYYY-MM.md`。
- scripts/record.js:276、296 — `retro --bundle <id8>` 與 `retro --cross` 寫進月檔、不 commit，且不需要 registry entry，所以匯入端可直接用；`--bundle` 對已歸檔的 id8 會拒絕，是重複匯入的天然防線。
- lib/bundle.js:16,29,44 — `filesOf` / `pack` / `unpack`；bundle 是 gzip 的 JSONL，首行 head 含 sessions、files、redacted 計數，遮蔽在 pack 時已做完，ZIP 內的 bundle 不需再遮蔽。
- scripts/conversation.js:68 — `--bundle <path> --list/--part` 直接讀 bundle，retro agent 靠它讀（agents/fankeel-retro.md:19）。
- skills/fankeel-retro-all/SKILL.md — 四步 List、Read、Rank、File；description 寫「after pulling bundles another user committed」，與新做法衝突，需改。
- docs/03-decisions/2026-10-20-retro-bundle.md — 決定「包預設不進 git；--commit 且 2 MB 內才 commit」；新做法在其上加一條傳遞路徑，需補一則更新或新決定頁。
- package.json、scripts/render.js:5 — 無 dependencies；lib/ 與 scripts/ 沒有任何 zip 讀寫程式。Node 內建 zlib 只能 gzip/deflate，ZIP 要手寫容器（CRC32、中央目錄，約 100 行）或呼叫系統工具（跨平台不一致）。
- tests/record-bundle.test.js、tests/record-retro.test.js、tests/bundle.test.js、tests/conversation-bundle.test.js — 既有測試涵蓋 session、--commit、--list、retro --bundle、--cross；新測試可沿用其 seed 寫法。

新增需求（使用者追加）：ZIP 要帶 manifest，記下寄件端的系統、fankeel 版本、Node 版本與 Node 套件，出錯時能判斷原因。

- package.json:3、.claude-plugin/plugin.json:3 — fankeel 版本 0.147.0；scripts/version.js 讓這兩份加各 skill frontmatter 共 18 處一致。工作樹與已安裝副本可差一版，manifest 兩個都該記。
- package.json:7 — engines node >=22.5；沒有 dependencies、devDependencies、package-lock.json 或 node_modules，所以「Node 套件」在 repo 內是空集合，manifest 記「無相依」加 engines 即可；教授那端全域套件不在 repo 管轄內，未確認要不要記。
- 既有環境讀取只有 `process.platform` 零星使用（scripts/eval.js:96、scripts/station.js:180、lib/tailscale.js:27）；沒有 os.release、process.version 或 doctor 類診斷程式，這幾項要新寫。scripts/docs-health.js 管文件健康，與環境無關。
- Claude Code 版本不必另跑指令：每個 session transcript 的行都有 `version` 欄位（本機實測 2.1.294），bundle 原樣含它，匯入端可讀出。
- 錯誤診斷：bundle 已含工具結果與錯誤輸出，缺的只是環境；manifest 補 platform、os 版本、arch、node 版本、fankeel 版本與 git HEAD 短碼即可對照。
- 隱私：lib/sensitive.js:75 的 `redact` 只遮蔽字串值（key 不遮），依 sensitive.txt 的字與金鑰樣式；它不認路徑、使用者名、主機名。manifest 因此不得放 hostname、使用者名、家目錄與專案絕對路徑、環境變數，欄位走白名單（版本與平台），仍過一次 redact。另有既有缺口：transcript 內含 cwd 絕對路徑（實測含 C:\Users\user\...，帶使用者名），現有 bundle 並未遮蔽，設計要決定匯出 ZIP 時是否額外處理。

planned, not built: 4 份 design-intent 頁，與本案無關（只讀了摘要數字，未逐一開啟）
not found: zip 實作、archiver、tar 寫入、os.release、process.version 的使用、doctor 類診斷腳本
unknown: 使用者選了留在 Survey，所以四個未決點都附了建議預設交給 Design：(1) 報告 = 月檔中該批 bundle 的 retro 區段與 cross 區段，匯出時另存為 report.md；(2) 同 id8 已有 bundle 時略過並列出；(3) manifest 不記全域 Node 套件，只記 engines 與「無相依」，因為全域套件不在 repo 管轄、也最可能洩漏機器資訊；(4) 匯出 ZIP 時把 transcript 內的使用者家目錄路徑換成 [HOME]，因為 redact 現在不處理，這是低成本且可測的遮蔽。這四點仍須使用者在下方確認。
skipped: 1807 個無樣式檔、1 個超大檔，皆與本案無關，只計數
class: architectural — 使用者已改走七階段：ZIP 成為跨使用者的傳遞格式（manifest、版本、手寫容器、匯入端驗證），是新的對外介面。
route: 已由 task.js route 改為七階段 architectural（本報告未重跑）

reads:
scripts/record.js — 看 listBundles、fileBundleRetro、fileCross 與 main 的 verb 分派，新增匯出/匯入 verb 放這裡
lib/bundle.js — bundle 格式與 unpack；ZIP 內容要與它對齊
lib/sensitive.js — redact 的範圍與不足，manifest 與路徑遮蔽的依據
skills/fankeel-retro-all/SKILL.md — 要改的技能：加匯出與匯入兩步，改掉 description 的「committed」說法
docs/03-decisions/2026-10-20-retro-bundle.md — 要更新的決定頁
tests/record-bundle.test.js — 新測試沿用其 seed 與 --list 寫法

```json gate
{"questions":[{"header":"→Design","question":"Survey -> Design | fankeel : retro-all 改成匯出 ZIP 回傳，不 push","options":[{"label":"Go to Design (Recommended)","description":"以報告中四個建議預設進入七階段設計：ZIP 含報告、bundle 與環境 manifest，手寫容器，匯出與匯入 verb。"},{"label":"Stay in Survey","description":"預設仍有異議時，說明要改哪一點，Survey 再補讀。"},{"label":"暫停","description":"先停在這裡，不進設計。"}]},{"header":"隱私預設","question":"manifest 與 bundle 的隱私預設要不要照建議？","options":[{"label":"照建議 (Recommended)","description":"不記全域 Node 套件；匯出時把 transcript 內家目錄路徑換成 [HOME]。"},{"label":"也記全域套件","description":"manifest 加上 npm 全域套件名與版本，診斷更完整，但多洩漏一點機器資訊。"},{"label":"路徑不遮蔽","description":"維持現有 bundle 行為，家目錄路徑與使用者名原樣留在 ZIP。"}]}],"next":"進 Design：定 ZIP 內容、manifest 欄位、匯出/匯入 verb 與隱私規則"}
```
