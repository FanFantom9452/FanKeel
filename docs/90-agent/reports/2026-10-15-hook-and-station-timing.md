---
status: current
last_verified: 2026-10-15
source_of_truth: 本頁是一次量測的紀錄，不隨程式碼更新；資料在 docs/90-agent/reports/evidence/2026-10-15-hook-timing/，由同目錄的 guard-probe.cjs、../2026-10-05-inject-cold/cold.cjs 與 curl 跑出
---

# guard、冷啟動與 station-data 的耗時（2026-10-15）

## 結論

guard 最大值 99.2ms、冷啟動 wall 最大值 216ms，門檻都是 hook 的 timeout 5000ms，兩者都過；slow-2 與 slow-5 這次都跑出了數字（10-05 那次全在 20 秒被殺），最大值 2343ms 與 1810ms，也都低於 5000ms；station-data 冷請求中位數 1.67 秒，門檻 1 秒，沒過；同一天 2a44fee1 讓 `gather` 每次只讀一份 transcript 索引之後，重量是 0.475 秒，過了。

## 怎麼量的

- guard：`guard-probe.cjs` 對 `hooks/guard.js` 餵三種 PreToolUse Bash payload（`read`、`write`、`commit`），每種起五個新的 node，session id 用 `349c5d13-627f-44a9-8a0c-7e723fa347b4`，量測時它的登記條目在 build 階段是 active，所以 `hooks/guard.js` 走的是 active session 的完整路徑，不是 `hooks/guard.js:55-58` 的提早返回。
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
```

暖啟動與慢磁碟兩臂（`cold/wall.tsv`，wall 單位 ms，各五輪）：

```
warm	median 1101	max 1108
slow-2	median 1581	max 2343
slow-5	median 1422	max 1810
```

station-data（`station-data.txt`，秒）：1.700955、1.674382、1.699408、1.652204、1.668759；中位數 1.674382。

2a44fee1 之後（`station-data-after.txt`，秒，station 重啟在新程式上）：0.626881、0.493565、0.337605、0.475293、0.356116；中位數 0.475293。

## 沒量到的

- PowerShell 的 guard 路徑沒量，只量了 node 直接執行 `hooks/guard.js`。
- guard 沒有經由 Claude Code 實際觸發，只量 node 行程的牆鐘；`commit` 案例用 `--dry-run`，命令本身沒執行。
- 量測時同機有其他 session 在跑，雜訊未記錄。
- station-data 的 1.67 秒事後拆開了：在 session 內對 `gather` 計時，1.66 秒裡 `detailOf` 佔 1.44 秒，幾乎全是 `transcriptOf` 對 443 個 transcript 已不在的 session 各掃一遍 `projects/` 的 544 個目錄；`registry.readAll` 只佔 45ms。修好後同一計時是 0.33 秒，`detailOf` 17ms。這一段的數字（1.66 秒、1.44 秒、443、544、45ms、0.33 秒、17ms）來自 session 內的剖析，輸出沒有留存，evidence 目錄裡沒有對應的原始檔。
- 暖啟動一臂的第 2 輪（107ms）是在 `serve` 已經在跑時量的（`cold/wall.tsv` 該列註記 `serve was running`），其餘四輪（1098 至 1108ms）是 `serve` 尚未起來時量的，所以這一臂混了兩種條件。
