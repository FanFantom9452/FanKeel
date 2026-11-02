fankeel map — 1413 份 markdown，4 份 planned 未建，420 份 retired，110 份 undeclared。

scanner（survey.js session build archive registry）：3686 檔，來源 git，skipped：1 個超過大小上限、1809 個無對應副檔名的宣告樣式；excluded：420 archive、89 decision、268 report。宣告命中 111 筆（另有 718 筆在符合的檔案內），多為 station 前端與 lib/live.js 之類，沒有現成的「歸檔」子系統。

這項任務要把已結束的 session 與已 land 的 build 過程檔搬到機器層級的集中歸檔（config 目錄下 `fankeel/archive/`），再用 `node:sqlite` 建索引，永不刪除。我已逐一對照控制器帶來的說法與程式碼，結論是它們大致屬實，因此這是新子系統而不是 bounded 修改。

- lib/handoff.js:44-48 — `dirFor` 由 `started` 推出 `task-<stamp>` 建置目錄，session 條目本身沒有 task id；`baseFor`（約 :40）可指向 worktree，所以歸檔要自己決定怎麼從條目對到目錄。
- lib/registry.js:140-147 — sessions 位於 `<root>/.fankeel/sessions/<id>.json`；`readAll`（:169）是多數讀者的入口。
- lib/registry.js:217-218 — `.fankeel/.gitignore` 內有 `sessions/`，`build/` 也被忽略，本機有 489 筆 session、796 個 build 項目，歸檔不影響 git。
- lib/weekly-collect.js:117-133 — 週報自己 readdir sessions 目錄，不經 `readAll`，歸檔後要另外改。
- scripts/task.js:1410-1420 — `cmdAdopt` 用 `registry.readSession(root, from)`，只認 `.fankeel/sessions/`，要能從歸檔撈回就得改這裡。
- lib/station.js:240 — `buildDirs` 只掃 `<root>/.fankeel/build`。
- lib/live.js:27-30 — `liveConfigDir()` 就是歸檔該放的 config 目錄。
- package.json:7-9 — `engines` 為 `>=22.5`，其中 `node:sqlite` 需要旗標，design 必須決定提高下限或降級處理。
- scripts/record.js:176-183 — 寫 record 時會把 `record: {at, file, anchor, fields}` 寫回 session 條目本身，所以「任務已有 record」可直接判斷條目有無 `record` 欄位，不必解析月檔。
- lib/spend.js:120、lib/profile.js:531、lib/settingsuggest.js:100 — 三者都只經 `readAll` 讀條目：spend 彙總花費列，profile 與 settingsuggest 統計 `land.integration` 與時段；歸檔後這些統計若漏掉已搬走的條目會失真，需要 `readAll` 能併入歸檔，或改查索引。
- lib/station.js:530、scripts/task.js:538 — 歷史頁與 `show --all` 同樣經 `readAll`，所以讓 `readAll` 可選擇併入歸檔，能一次涵蓋 station、spend、profile、settingsuggest、show --all 五處；weekly-collect 與 adopt 仍要各自改。
- docs/90-agent/todo/registry-1.md — TODO 原文，完成條件：repo 內只剩 live 與近期條目、檔案只搬不減、station 歷史頁與週報仍列得出、adopt 能撈回。

planned, not built: 4 份 design-intent 頁面，與本任務無直接關係（未逐頁讀）。
not found: 沒有現成的 archive/index 實作；`archive` 只命中 station 導覽圖與 bench 資料。
unknown: 無需再確認的項目；歸檔的目錄結構、Node 版本下限（`node:sqlite` 在 `engines` 22.5 需旗標）留給 design 決定。
skipped: 1809 個無宣告樣式的檔案多為 markdown 與資料，與本題無關；未派 reader，因為讀者清單已由 grep 與控制器筆記覆蓋。另一個 `ls` 的背景指令逾時，未影響結論。
class: architectural — 新子系統，且改動六處讀者的介面。
route: unchanged（task.js 回報此任務以 architectural 開始，為底線，不可減階）。

reads:
lib/registry.js — readAll、sessionsDir、readSession，所有讀者的共同入口
lib/handoff.js — dirFor/baseFor，session 到 build 目錄的對應
lib/weekly-collect.js — 自讀 sessions 目錄的唯一繞過者
scripts/task.js — cmdAdopt（約 :1410）與 `show --all`（約 :538）
lib/station.js — buildDirs 與歷史頁讀者（約 :240、:530）
scripts/record.js — 月檔 record 的判定（:134-170）
docs/90-agent/todo/registry-1.md — 需求與完成條件

```json gate
{"questions":[{"header":"→Design","question":"Survey -> Design | fankeel : session 與 build 集中歸檔","options":[{"label":"Go to Design (Recommended)","description":"接受 architectural 分級：這是新子系統（歸檔搬移、node:sqlite 索引、六處讀者與 adopt 改讀歸檔），下一步在 design 決定目錄結構、搬入條件、Node 版本下限與讀者介面。"},{"label":"Stay in Survey","description":"不同意 architectural 分級或要換範圍（例如只做歸檔、不動 adopt 與週報）時留在這裡重新分級，已補讀的讀者清單不會再重讀。"},{"label":"暫停","description":"先停在 survey，保留報告，之後再繼續。"}],"multiSelect":false}],"next":"design: 定歸檔結構、搬入條件、sqlite 版本策略與讀者介面"}
```
