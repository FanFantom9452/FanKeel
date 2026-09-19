---
status: decision
last_verified: 2026-09-19
---

# station 即時監看＋map 目錄職責 — 決策紀錄

原本的請求一次要兩件事：station 即時監看，和主控／站 agent 的分工。09-19 在
`/fankeel` 上開工，分支 `station-live`，路線七站全走，先把能落地的一半做完，
第二件留給下一個 task：[../plans/2026-09-19-stage-agents-design.md](../plans/2026-09-19-stage-agents-design.md)。
設計見 [../archive/2026-09-19-station-live-design.md](../archive/2026-09-19-station-live-design.md)，
計畫見 [../archive/2026-09-19-station-live.md](../archive/2026-09-19-station-live.md)。

## 一、定案

| 問題 | 定案 | 為什麼 |
|---|---|---|
| 原本的請求怎麼分 | 這個 task 做 station 即時監看＋map 目錄樹；主控／站 agent 分工留給下一個 task | 主控安靜之後看進度只能看 station，站 agent 要靠 map 決定讀哪些路徑——後者的前提是前者先落地 |
| `/fankeel` 怎麼開站 | 偵測不到在跑就以 detached 方式啟動 `station.js serve --open`；探測、啟動、等待合計不超過 hook 開始後 4000 ms | plugin 每個 hook 上限 5 秒；`--open` 只在這次由它啟動時開瀏覽器，已經在跑就不開 |
| 頁面怎麼保持新 | serve 底下每 3 秒重新拉一次清單資料，以及正在看的那個 session 的明細；health poll 仍是每 5 秒，只用來抓 server 掛了 | 重讀跟死活判斷是兩件事：一個管新不新，一個管還在不在 |
| agent 狀態怎麼判斷 | 只讀 agent 自己的 transcript（`stepsOf` 的 `open`／`lastAt`）與 session 的存活，不加新 hook | agent 執行時沒有東西可以主動寫狀態；讀既有的痕跡比多一個 hook 便宜，也不多一個會漏寫的地方 |
| 手機寬度的版面 | 不做 | brief 多要的，不在這次的要求裡；mockup 畫了一版，不落地 |

## 二、落在哪

| task | 落在 |
|---|---|
| 1 | `lib/serve.js`：`serveRecordPath`、`readServeRecord`、`probe`、`ensureServe`；`scripts/station.js` 改用它 |
| 2 | `README.md`：`## What lives where`，47 列目錄樹，`node scripts/map.js` 讀得到 |
| 3 | `hooks/inject.js`：`/fankeel` 時呼叫 `ensureServe`；`lib/render.js` 的 `stationLine` |
| 4 | `lib/replay.js` 的 `stepsOf` 帶 `open`／`cur`／`lastAt`；`lib/detail.js` 的 `statesOf`；`lib/live.js` 的 `runningSessions` 帶 `startedAt` |
| 5 | `lib/detail.js` 的 `detailOf` 加 memo；明細路由只讀被問到的那一個 session |
| 6 | `assets/station/station.js`：清單列、流程軌、3 秒重讀迴圈 |
| 7 | `assets/station/station.js`：派工面板——每列的狀態、目前的工具，展開看 prompt 與步驟 |

另有十二筆 fix。不含 plan 與 design；七個 task。

## 三、build、verify、audit 抓到的

- **`serve()` 的 idle 計時器會悄悄結束測試行程。** `--idle` 的計時器直接呼叫
  `process.exit()`；`station-cli.test.js` 在行程內建 `serve()`，完整套件跑過
  一分鐘後被這個計時器一起結束，37 個測試沒有報告。改成只有 `main()` 自己的
  `--idle` 才真的退出（`exitOnIdle === true`）。
- **平行的 tool_use 只有最後一個被標成「現在在做」。** Task 4 review：一個
  agent 同時掛著好幾個還沒回來的 tool_use 時，`cur` 只認最後一個，前面幾個被
  當成已完成的步驟；design 原文寫的是「最後一個沒有 tool_result 的
  tool_use」，但要問的其實是「這個 agent 現在在做什麼」。改成每個沒回應的
  tool_use 都帶 `p:true`，都算進行中，也都留在 40 步的上限之外。
- **served 頁的 running 數讀到別的 session。** Task 7 round 2：測試跑在這個
  repo 自己的 `serve()` 上，它會把 cwd 底下真正的 registry 一併列出，第一筆
  running 數量可能是這個 session 自己，不是 fixture 那一列。改成只讀 fixture
  自己那一列。
- **map 測試被沒追蹤的目錄弄紅。** verify 送回 Task 2：`map-cli` 原本比對磁碟
  上的目錄，一個沒加進 git 的目錄（像 `.playwright-mcp/`）就能讓樹跟磁碟對不
  上；改成只比對 `git ls-files --cached` 追蹤的頂層目錄，並用「同一刻、只換
  測試檔」的紅綠對照證明關聯——reviewer 一度懷疑是併發寫入造成的混淆，查過
  當時的目錄狀態後駁回。
- **文件 reader 的對照組得是會失敗的。** 對 `docs/station.md` 逐句核對本來全
  部判真；verify 換了一個列舉每個行為分支、且用可失敗的（blind）對照組去試
  的檢查，才抓到「即時・N 秒前更新」在 `sec<=0` 時其實印的是「剛更新」，以及
  `?t=` 只在重讀時加、不是每次都有——兩句都被原本的逐句核對放過。

## 四、沒驗到的

從 hook 以 detached 啟動的 serve，在 Windows 上真的由 Claude Code（而不是
`tests/serve.test.js` 那個 node 啟動 node 的殼）啟動之後，會不會在 Claude
Code 結束時被一起收掉，只能在實際跑一次 `/fankeel` 時看到。同樣沒驗的是 hook
的真實 wall-clock：4000 ms 的探測與啟動預算是照 code 訂出來的，不是量出來
的。
