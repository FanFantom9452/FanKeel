---
status: current
last_verified: 2026-10-05
source_of_truth: 本頁是一次量測的紀錄，不隨程式碼更新；資料在 `docs/90-agent/reports/evidence/2026-10-05-inject-cold/` 的 `before/` 與 `after/`，由同目錄的 `cold.cjs` 與 `slow.cjs` 跑出
---

# `/fankeel` 注入的冷啟動與慢磁碟（2026-10-05）

## 結論

冷啟動（量測前先停 station）改之前牆鐘中位數 3054ms、最大 3194ms，station 綁好的中位數 2955ms；改之後牆鐘中位數 3630ms、最大 4701ms，station 綁好的中位數 278ms、最大 507ms。
station 在 write 之前就開始起，所以綁好的時間縮短了約十倍；整個 hook 的牆鐘在這五輪裡數字變長，最大值超過四秒半，但不能讀成量到的退步。
warm 臂改之後牆鐘中位數 3199ms、最大 5460ms，比改之前的 2215ms、3857ms 高；write 中位數 1870.1 -> 3015.1ms，同時 fs 呼叫次數從 14619 降到 8451。warm 路徑的程式碼這次沒有改，所以這個變慢無法用這次改動解釋；共用機器上五輪本來就容易有雜訊。資料顯示 station 綁好的時間縮短，不顯示總時間變好或變差。
slow-2 與 slow-5 兩臂改之前與改之後都沒有跑完：十輪全部撐到 20 秒被終止（SIGTERM），沒有輸出 station 行，所以「slow-5 的牆鐘最大值離五秒多遠」這次量不出來，只知道遠超過五秒。

## 怎麼量的

`cold.cjs` 跑四臂（cold、warm、slow-2、slow-5）各五輪，前後交替；cold 臂每輪先停 station；slow 臂用 `slow.cjs` 讓每個同步 fs 呼叫先等 2 或 5 毫秒，這是模擬，不是量到的慢磁碟。
改之前的 HEAD 是 `f2b40621b7c3a3562ccb12df3029523624653e83`，porcelain 只有 `?? docs/90-agent/reports/evidence/2026-10-05-inject-cold/`；改之後的 HEAD 是 `65ebd7317c6938c7b6e5fea4bc89318793889189`，porcelain 只有 `?? docs/90-agent/reports/evidence/2026-10-05-inject-cold/after/`。兩次都是 node v24.9.0、五輪。
可能有其他工作同機執行，未記錄，牆鐘的雜訊因此不小。

## 數字

| 臂 | 改之前 牆鐘中位數／最大（ms） | 改之後 牆鐘中位數／最大（ms） | station 行 |
|---|---|---|---|
| cold | 3054／3194 | 3630／4701 | `station: N stale, N live — <url> (serve started, browser opened).`（五輪都是） |
| warm | 2215／3857 | 3199／5460 | 五輪裡四輪 `(serve was running)`，一輪 `(serve started, browser opened)` |
| slow-2 | 20023／20028（被終止） | 20023／20032（被終止） | `no block` |
| slow-5 | 20018／20037（被終止） | 20018／20027（被終止） | `no block` |

`call lib/station.js write` 的中位數：cold 臂改之前 2783.2ms、改之後 3345.9ms；warm 臂改之前 1870.1ms、改之後 3015.1ms。
`call lib/serve.js ensureServe` 的中位數：cold 臂改之前 131.9ms、改之後 128.6ms；warm 臂改之前 212.8ms、改之後 215.2ms。
一個 hook 的同步 fs 呼叫次數，cold 臂中位數改之前 8281、改之後 8463。slow 臂沒有跑完，所以「每次呼叫多慢 1 毫秒，write 多幾毫秒」這次沒有量到換算。

## 節流：短時間內跳過 write

brief 的規則說建議做節流：改之後 warm 臂的 `call lib/station.js write` 中位數 3015.1ms，超過 `WRITE_THRESHOLD_MS`（2800ms），而且改之後 cold 與 warm 兩臂的牆鐘最大值（4701ms、5460ms）都不低於 4500ms。
但這次量測給出的間隔是改之後 cold 臂 station 綁好的中位數 278ms，比一次 write（warm 臂中位數 3015ms）短得多，278ms 的窗口幾乎不會跳過任何真的重複 `/fankeel`，沒有實際效果。要對重複呼叫有用，間隔至少要約一次 write 的長度（約 3000ms），這次量測沒有決定這個值，所以間隔怎麼選留待決定。
頁面因此落後時 `station:` 行的 stale／live 數會怎麼變，這次沒有量。

## 用 SessionStart 提早起 server

不需要。改之後 cold 臂五輪的 station 行都是 `(serve started, browser opened)`，沒有任何一輪停在 `serve is starting`。

## 沒量到的

- 真的慢磁碟與防毒掃描：slow 臂只是模擬，而且十輪都沒有跑完。
- 別台機器：全部數字來自這一台。
- require 階段沒被放慢：slow 臂只放慢 hook 執行時的同步 fs 呼叫。
- 同機其他工作的影響：沒有在量測時獨佔這台機器。
