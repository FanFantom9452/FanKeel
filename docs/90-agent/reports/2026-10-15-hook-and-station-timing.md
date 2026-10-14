---
status: current
last_verified: 2026-10-15
source_of_truth: 本頁是一次量測的紀錄，不隨程式碼更新；資料在 docs/90-agent/reports/evidence/2026-10-15-hook-timing/，由同目錄的 guard-probe.cjs、../2026-10-05-inject-cold/cold.cjs 與 curl 跑出
---

# guard、冷啟動與 station-data 的耗時（2026-10-15）

## 結論

guard 最大值 99.2ms、冷啟動 wall 最大值 216ms，門檻都是 hook 的 timeout 5000ms，兩者都過；station-data 冷請求中位數 1.67 秒，門檻 1 秒，沒過。

## 怎麼量的

- guard：`guard-probe.cjs` 對 `hooks/guard.js` 餵三種 PreToolUse Bash payload（`read`、`write`、`commit`），每種起五個新的 node，session 是本次盤點的 session（有 active 條目，走完整路徑）。
- 冷啟動：`cold.cjs` 五輪，每輪先停掉本機 station。
- station-data：每次先閒置 3 秒讓 `memoMs`（2000ms，`scripts/station.js:358`）過期，再 curl `/station/station-data.js`，五次。

## 數字

guard（`guard.txt`，單位 ms）：

```
read	median 55.2	max 55.7	n 5
write	median 53.9	max 55.0	n 5
commit	median 90.3	max 99.2	n 5
```

冷啟動（`cold.txt` 的 `== cold` 區塊開頭）：

```
== cold  runs 5  skipped 0
wall	median 210	max 216	exits 0
bound	median 134	max 139
line	station: <url> (serve started, browser opened).
```

station-data（`station-data.txt`，秒）：1.700955、1.674382、1.699408、1.652204、1.668759；中位數 1.674382。

## 沒量到的

- 慢磁碟兩臂（slow-2、slow-5）沒有重跑，只量了 cold 臂。
- PowerShell 的 guard 路徑沒量，只量了 node 直接執行 `hooks/guard.js`。
- guard 沒有經由 Claude Code 實際觸發，只量 node 行程的牆鐘；`commit` 案例用 `--dry-run`，命令本身沒執行。
- 量測時同機有其他 session 在跑，雜訊未記錄。
- station-data 的 1.67 秒沒有拆開（算圖或讀檔），只知道整段請求耗時。
