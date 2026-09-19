---
status: design-intent
last_verified: 2026-09-19
---

# station 即時監看＋map 目錄職責

打 `/fankeel` 就知道 station 有沒有在跑、沒有就開；開著的頁面自己更新，看得到這個
session 跑到哪一站、派了幾個 agent、每個 agent 現在在做什麼、它裡面做了哪些事。另外把
map 缺的「目錄 → 職責」補上。

這是 [2026-09-19-stage-agents-design.md](2026-09-19-stage-agents-design.md) 的前提：主控
安靜之後，看進度只能看 station；站 agent 決定讀哪些路徑，要靠 map。

mockup：`.fankeel/build/2026-09-19-station-live/mockup.html`（不 commit）。

## 現況（survey，2026-09-19）

- `/fankeel` 只寫靜態頁（`hooks/inject.js:65`，`station.write(...)`），不偵測、不啟動 serve。
- serve 啟動時寫 `serve.json`（`scripts/station.js:636`，`{ pid, port, url, started }`）；
  `probe()` 確認 pid 活著且 `/station/health` 回報同一個 pid。一台機器一個 station，第二個
  serve 會併進第一個（`scripts/station.js:15`）。只綁 `127.0.0.1`（`scripts/station.js:634`）。
- 頁面每 5 秒只 poll `/station/health`，用來發現 server 掛了（`assets/station/station.js:2266`）；
  清單資料要重新整理才更新，明細每個 session 只載一次（`assets/station/station.js:1513`）。
- 每個 agent 一列（`lib/usage.js:461`），步驟逐一列出、上限 40（`lib/replay.js:20`）。沒有
  欄位標示 agent 還在跑，或正在跑哪個工具。
- subagent transcript 是邊跑邊一行行寫的；`tool_use.id` 對應 `tool_result.tool_use_id`，
  `.meta.json` 帶 `agentType`、`description`、`model`。
- `inject.js` 是同步的；plugin 的 hook 上限 5 秒（`.claude-plugin/plugin.json:19`）。
- map 沒有目錄樹：`no directory tree found in CLAUDE.md, AGENTS.md, README.md`。map 最多收
  50 行樹（`lib/map.js:108`，`MAX_TREE`）。

## 1. `/fankeel` 偵測並開啟 station

- `/fankeel` 的 prompt 用 `serve.json` 加上 health 探測判斷 serve 在不在跑；在跑時，`station:`
  那一行印出它的網址。
- 沒在跑時，hook 以 detached 方式啟動 `station.js serve --open`，所以瀏覽器只在這次由它啟動
  時打開一次；已經在跑就不開瀏覽器。
- 探測逾時 1 秒就當作沒在跑。探測慢而誤判時再啟動一個 serve 是安全的：它會併進第一個。
- 探測與啟動合計不超過 hook 的 5 秒上限；等不到新 serve 寫出網址時，那一行說它正在啟動。
- 不是 `/fankeel` 的 prompt 不探測。

## 2. 頁面即時更新

- 在 serve 底下，頁面每 3 秒重新拉一次清單資料，以及正在看的那個 session 的明細；session
  不再活著就停止拉那個 session 的明細。
- 明細的檔案沒有變動時（`keyOf()` 的大小與 mtime 沒變），伺服器不重算。
- 頁面顯示最後一次更新的時間。
- 靜態頁（`/fankeel` 寫的那份檔案）不變。

## 3. 每個 agent 的狀態與目前的工具

- 每個 agent 列帶一個狀態：`running`、`done`，或 `lost`（session 已經結束，agent 卻沒有
  結束）。
- `running` 的 agent 顯示它正在執行的工具、對象與已經執行多久，依據是它 transcript 裡最後
  一個還沒有 `tool_result` 的 `tool_use`。
- 清單上每個活著的 session 顯示它目前在哪一站，以及此刻有幾個 agent 是 `running`。
- 判斷只讀 transcript、`.meta.json` 與 session 的存活，不新增 hook。
- Workflow 裡的 agent 用同一套判斷。

## 4. agent 裡面

- 展開一個 agent，看得到它收到的 prompt（預設收合）與它的步驟。
- 執行中的步驟（平行的工具呼叫可能不只一個）標在列表最後，而且不會被 `MAX_STEPS` 擠掉。
- `done` 的 agent 顯示它回傳了多少。

## 5. map 目錄職責

- `README.md` 加上一棵目錄樹：11 個目錄各一行職責，`lib/`、`scripts/`、`hooks/` 另列出入口
  檔，總共不超過 `MAX_TREE` 的 50 行。
- `node scripts/map.js` 印出 `tree —` 那一行，而且沒有 `with no responsibility`。
- 不改 `lib/map.js`。

## 6. 文件

- `docs/station.md` 裡關於 serve 頁面何時更新、health poll 的用途、`/fankeel` 的 `station:`
  那一行，隨實作改寫。
- `skills/fankeel/SKILL.md` 的 On `/fankeel` 一段，改成說 `/fankeel` 會偵測並開啟 serve。
- `skills/fankeel-station/SKILL.md` 保留，說明改成「`/fankeel` 已經會開；這個只在要手動
  重開時用」。

## 不做的

- 手機寬度的版面。mockup 有畫（拿掉 `station.css` 的 `body{min-width:1000px}`、改用
  container query），那是 brief 多要的，不在這次的要求裡。

## 怎麼算做完

| 項目 | 現在 | 做完後 |
|---|---|---|
| 有一個假的 serve（health 回報自己的 pid）與它的 `serve.json` 時，`/fankeel` 區塊的 `station:` 那一行有它的網址 | 那一行從不提 serve | 有網址 |
| 一份最後停在沒有 `tool_result` 的 `tool_use` 的 agent transcript fixture | 沒有狀態欄位 | `running`，帶那個工具 |
| 同一份 fixture 補上 `tool_result` 與最後的文字 | 同上 | `done` |
| session 已不在、agent 沒結束的 fixture | 同上 | `lost` |
| 頁面（artefact）：清單上某 session 的 running 數，等於它 session 頁上 `running` 的列數 | 沒有這兩個數 | 相等 |
| 頁面（artefact）：對 fixture transcript 追加一個 `tool_use`，不重新整理頁面，兩個更新週期內看得到它 | 要重新整理 | 看得到 |
| `node scripts/map.js --print` | `no directory tree found` | `tree —` 那一行，沒有 `with no responsibility` |

## 還沒驗證的

從 hook 以 detached 啟動的 serve，在 hook 結束、甚至 Claude Code 結束後，在 Windows 上會不會
被一起收掉。plan 的第一個 task 先驗這件事。
