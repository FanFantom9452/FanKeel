# design — retro-all 匯出 ZIP 回傳

教授在 retro-all 的 gate 選「匯出 ZIP 回傳」，再勾隱私選項，`record.js export` 打出含報告、session 包與環境 manifest 的 ZIP；你用 `record.js import` 放回 `.fankeel/bundles/`，自己的 retro-all 就讀得到。

| file | change | dispatch |
|---|---|---|
| lib/zip.js | 新增：STORED 寫入，STORED/DEFLATE 讀取，CRC32 驗證，拒絕 `..` | implementer, sonnet |
| scripts/record.js | 新增 `export`、`import` 兩個 verb，manifest 白名單、[HOME] 遮蔽 | implementer, sonnet |
| skills/fankeel-retro-all/SKILL.md | gate 加匯出選項與隱私 multiSelect，新增「收到 ZIP」一節，改 description | implementer, sonnet |
| tests/zip.test.js、tests/record-export.test.js | 新增 | 隨上兩列的 implementer |

proves it done: 匯出到 ZIP、匯入另一個空專案後 `sessions --list` 列出兩個包；包內找不到家目錄字串；manifest sha256 相符；改壞一個 byte 被拒絕。
against the map: docs/03-decisions/2026-10-20-retro-bundle.md 不衝突（多一條傳遞路徑，land 時補決定頁）；retro-all 的 description 要改。
unverified: transcript 裡家目錄以外是否還出現使用者名（例如 git author），[HOME] 只遮路徑。
spec: docs/90-agent/plans/2026-11-02-retro-zip-design.md
mockup: 不畫，這是命令列與檔案格式，沒有畫面。

```json gate
{"questions":[{"header":"Design→Plan","question":"Design -> Plan | fankeel : retro-all 改成匯出 ZIP 回傳，不 push","options":[{"label":"Go to Plan (Recommended)","description":"核准 docs/90-agent/plans/2026-11-02-retro-zip-design.md：手寫 lib/zip.js、record.js export/import、manifest 白名單、預設 [HOME] 遮蔽、gate 問匯出者兩個隱私選項。"},{"label":"Stay in Design","description":"沒有未決的設計問題；若規格有要改的地方，說明哪一節。"},{"label":"暫停","description":"next 設為：讀規格後決定是否進 Plan。"}],"multiSelect":false}],"next":"進 Plan：把規格拆成 zip、export/import、技能三組任務"}
```
