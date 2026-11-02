---
status: current
last_verified: 2026-11-02
---

# session 與 build 集中歸檔（shelf）

一句話：已結束超過 14 天的 session 條目，連同它自己的 build 目錄，原樣搬到 config 目錄下的 `fankeel/shelf/`，用 `node:sqlite` 記一份索引；`readAll` 多一個選項把架上的條目一起讀回來，五個統計與歷史讀者、週報和 adopt 因此看得到被搬走的條目。

名字叫 shelf 而不是 archive：`scripts/archive.js` 已經是封存 plan 的腳本。

## 1. 搬什麼、搬到哪

- 架子在 `<liveConfigDir()>/fankeel/shelf/<registry 根目錄名>-<根目錄絕對路徑 sha1 前 8 碼>/`，底下是 `sessions/<id>.json` 和 `build/task-<stamp>/`，與 repo 裡的形狀一樣（lib/live.js:27）。
- 條目的搬入條件：`active === false`、有 `ended`，而且 `updated`（沒有就用 `ended`）早於 14 天前。2026-11-02 這個 repo 489 筆裡有 272 筆符合。
- build 目錄跟著擁有它的條目一起搬（`handoff.dirFor`，lib/handoff.js:44），但只有在 repo 裡已經沒有任何留下的條目指向同一個目錄時才搬；這次量到 175 個。沒有條目指向的 build 目錄（`ask/`、`tmp/` 和舊的孤兒）不在這次範圍。
- TODO 原寫「任務已有 record 才搬 build」：量過，272 筆舊條目沒有一筆帶 `record` 欄位，這個條件會一個都搬不動，所以改成跟著條目走。
- 搬移是先複製、比對檔案數與位元組數、相同才刪來源；config 目錄和 repo 常在不同磁碟，`rename` 會 `EXDEV`。比對不合就保留來源並回報，不刪。
- 檔案不壓縮：條目是讀者直接 `JSON.parse` 的檔案，6.3MB 壓了也省不了多少，卻要每個讀者多一步解壓。

## 2. 索引

- `<shelf>/index.sqlite`，用 `node:sqlite` 的 `DatabaseSync`，一張表 `entries(root, id, project, task, stage, started, ended, spend, file, build)`，每次搬移時 upsert。
- 索引只供查找（`shelf.js find`、adopt 找條目在哪），讀者讀的仍是 JSON 檔，索引壞掉或不見不影響任何畫面。
- `package.json` 的 `engines` 從 `>=22.5` 提到 `>=22.13`：22.13 起 `node:sqlite` 不需要旗標。

## 3. 讀者

- `registry.readAll(root, { shelf: true })` 在本地條目之後併入架上的條目，同一個 id 以本地為準；不帶選項時行為不變（lib/registry.js:169）。
- 帶 `{ shelf: true }` 的五處：lib/station.js:530 歷史頁、lib/spend.js:120、lib/profile.js:531、lib/settingsuggest.js:100、scripts/task.js:538 `show --all`。`readActive` 不變——架上沒有 active 條目。
- lib/weekly-collect.js:117 的 `sessionFiles` 自己讀目錄，改成也讀架上同一根目錄的 `sessions/`。
- adopt（scripts/task.js:1412）：本地找不到時，先把條目和它的 build 目錄從架上搬回 repo，再走原本的流程；搬回同樣先複製比對再刪。

## 4. 入口

- `scripts/shelf.js run [--dry-run] [--days N]`：搬移並印出搬了幾筆條目、幾個 build 目錄、幾個檔案；`--dry-run` 只列。
- `scripts/shelf.js find <詞>`：查索引，印 id、task、stage、所在路徑。
- `scripts/shelf.js restore <id>`：adopt 用的同一個搬回動作，單獨可用。
- 不自動執行：hook 不呼叫它，land 技能頁加一行提示。

## 5. 文件

- docs/90-agent/reference/registry.md 寫明條目可能在架上與 `readAll` 的選項；skills/fankeel/SKILL.md 的不變式 4「Never delete a session file」補一句搬到架上不算刪除。
- lib/registry.js:155 那段「這就是整個 workspace 的歷史」的註解跟著改。

## 成功條件

- 新測試 `tests/shelf.test.js`，用暫存根目錄與暫存 `CLAUDE_CONFIG_DIR`：三筆條目（live、3 天前結束、30 天前結束且有 build 目錄）。`run` 後本地只剩前兩筆、架上一筆條目一個 build 目錄、搬移前後檔案總數相同；`readAll(root, {shelf:true})` 回三筆；`sessionFiles` 回三筆；`find` 找得到；`restore` 後 adopt 成功。現在 `lib/shelf.js` 不存在，所以會失敗。
- 實際成品：在 fankeel repo 跑一次 `run` 後，`show --all` 的條目數與跑之前相同，`.fankeel/sessions` 剩 217 筆左右。
