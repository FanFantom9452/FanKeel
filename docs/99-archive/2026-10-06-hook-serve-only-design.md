---
status: current
last_verified: 2026-10-06
---

# `/fankeel` hook 只確保 station 在跑：設計

一句話：`/fankeel` 提示的 hook 在 station 服務開著時不再同步寫頁，四秒預算全部給 `ensureServe`；而 `ensureServe` 與 `serve()` 把「pid 還活著、health 逾時」認作「忙」而不是「死」，所以 server 正在同步重解析時不會被誤判、也不會再開第二台。

為什麼這樣：hook 被 Claude Code 在五秒砍掉，而 `station.write` 的 transcript 重解析是同步的、單一 session 不可中斷（`lib/station.js:420,460`），所以只要 hook 還在寫，逾時就只能壓低、不能消除。server 本來就每次請求即時 `gather` 出資料（`scripts/station.js:410,434`），hook 寫的檔只是 file:// 後備。使用者已核可「面板慢點打開沒關係，避免 hook 超時優先」。

## 1. hook 只問 station

- 服務開著時（`FANKEEL_SERVE` 不是 `off`），`hooks/inject.js` 不呼叫 `station.write`；`ensureServe` 的 `until` 改為 `began + SERVE_BUDGET_MS`，不再扣 `WRITE_THRESHOLD_MS`。
- `FANKEEL_SERVE=off` 時保留同步寫頁：那是沒有 server 的唯一路徑，file:// 頁是使用者唯一能看的東西，測試也走這條。
- `WRITE_THRESHOLD_MS` 只有 `hooks/inject.js` 用到，隨之從 `lib/station.js` 刪除。
- `hooks/leave.js`（SessionEnd，session 已結束，被砍只損失整理工作）與 `scripts/task.js` 的 `refreshStation`（不是 hook，沒有五秒限制）照舊同步寫，不在本次範圍。

例：在 station 已跑的機器上打 `/fankeel`，hook 只做一次 health 請求就回答，`<configDir>/fankeel/station-data.js` 的 mtime 不動。

## 2. 「忙」不是「死」

- `lib/serve.js` 的 health 詢問分出三種答案：有回應（body）、忙（紀錄的 pid 仍活著，且請求是逾時而不是被拒或答錯）、死（pid 不在、連線被拒、非 200、不是 JSON、pid 不符）。
- `ensureServe` 遇到忙，回傳 `{ state: 'busy', url: <紀錄的 url> }`：不啟動新的 serve、不殺舊的、不刪 `serve.json`。指紋過期的檢查只在有回應時做，忙的那次跳過，下一次 `/fankeel` 再查。
- `scripts/station.js` 的 `serve()` 加入檢查用同一個三分法：既有紀錄忙時當成加入（`joined: true`），不 unlink 紀錄、不綁第二個 port。
- 為什麼逾時加活 pid 足以判忙：本機上沒人監聽的 port 會立刻被拒，不會逾時；pid 被回收又剛好有別的程式在同一 port 上卡住不答，是唯一會誤判的情形，代價是這次不開新台，下一次提示仍會再問。

例：server 正在為 `station-data.js` 同步 `gather` 三秒，此時 `/fankeel` 的 health 一秒逾時，hook 的 station 行寫「忙」並給出原 url，`serve.json` 的 pid 不變，系統上只有一個 `station.js serve` 程序。

## 3. station 行不再帶計數

- 服務開著時 `stationLine` 不印 `stale` / `live` 計數（那兩個數字只能從 `write()` 得到），只說 station 的狀態與網址。
- 新增 `busy` 狀態的結尾：`<url> (serve is busy loading; the page fills in when it finishes).`
- `starting` 不再指向檔案（hook 沒寫它），改為 `serve is starting; the browser opens when it binds.`
- `FANKEEL_SERVE=off` 與寫頁錯誤兩種結尾維持現狀，因為那條路徑仍然寫頁。

例：`station: http://127.0.0.1:7817/ (serve was running).`

## 4. 文件跟著改

- `docs/90-agent/reference/station.md` 的「The `station:` line」一節改寫：流程、五種結尾的表加上 `busy`、刪掉「第二個 serve 一定加入第一個」的說法，改成忙時加入的規則；「A write spends at most a second and a half」一段不再說 `/fankeel` 提示在 hook 內寫頁。

## 怎麼算完成

- `tests/serve.test.js`：一個接受連線卻三秒才回 health 的假 station，紀錄的 pid 是測試自己的 pid；`ensureServe` 回 `busy`、`start` seam 沒被呼叫、`serve.json` 還在。現在會紅（現況啟動新台並回 `starting`）。
- `tests/serve.test.js` 或 `tests/station-cli.test.js`：同樣的假 station 下呼叫 `serve()`，回 `joined: true` 且紀錄未被刪。現在會紅。
- `tests/inject.test.js`：服務開著、紀錄指向一個以正確 pid 與指紋回答的測試 server，`/fankeel` 之後 `station-data.js` 沒被寫出，station 行含該 url 且不含 `stale,`。現在會紅。
- `tests/render.test.js`：`busy` 與無計數的各結尾各一個斷言，並以變異證明會紅。
- 產物一列：hook 印出的 station 行裡的 url，等於 `serve.json` 當下記錄的 url（同一來源的兩個數字要一致）。
- 全套件綠。

## 未驗證

在 Windows 上，事件迴圈被同步 `gather` 卡住的 node 程序，其監聽 socket 是否仍由核心完成 TCP 握手、讓 `fetch` 以逾時（而非拒絕）結束。第 2 節的判忙依賴這一點；build 的第一個測試會直接量到它。
