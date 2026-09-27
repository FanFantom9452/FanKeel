---
status: current
last_verified: 2026-09-27
source_of_truth: docs/90-agent/reference/station.md, assets/station/station.js, lib/station.js
---

# 監控站

這台機器上每個 fankeel session 都在這一頁：正在跑的、放著沒關的、已經收掉的。`/fankeel` 會寫出它並在 `station:` 那一行給網址；分頁關掉之後用 `/fankeel-station` 重開。

## 狀態

| 標記 | 意思 |
|---|---|
| `live` | registry 標著進行中，也找得到它的 process |
| `live?` | 標著進行中，但讀不到它的 Claude Code 設定目錄，確認不了；寧可當它還活著 |
| `stale` | 標著進行中，但 process 已經不在：`/clear`、關掉的 terminal、當掉 |
| `down` | 已經收掉 |

## 每個 view 看什麼

| view | 網址 | 看什麼 |
|---|---|---|
| 儀表板 | `#/` | 四張卡：進行中幾個、幾個 gate 在等你、近 30 天花費、最近 5 個 session。每張卡的數字等於它「查看全部」那一頁的數字 |
| 進行中 | `#/live` | 最上面是等你回答的 gate，沒有就一行「沒有在等你的 gate」；然後「正在跑」，每個 session 一列，route 畫成站點，目前那站外圈高亮並標在站時間；每列下方列出現在在跑的 stage agent 與 subagent，沒有就一行「主 session 自己在做」；「可能已經停了」放 `live?` 與 `stale`，stale 的 registry 有 clear 按鈕；最下面是沒有 session 的 registry，一排名字，點了到該專案頁 |
| 最近 | `#/sessions` | 近 30 天有花費、或還在 live 的 session，新的在上 |
| 全部清單 | `#/list` | 可排序的表，點一列在旁邊看細節 |
| 比較 | `#/cmp` | 在清單或專案頁勾兩個 session，並排比 |
| 近 30 天 | `#/days` | 一天一根柱子，高度可切 token、錢、時間；分段可切 model、專案、站、主 session 對 agent、版本、成本組成 |
| 依專案 | `#/projects` | 專案列表；點進 `#/p/<key>` 看它的 session 散點、可疊第二個專案、各 route 每站的平均 |
| 文件 | `#/docs` | 每個專案 `.fankeel/map.md` 的統計卡：文件數、狀態分布、planned 未做、未宣告；上方有全文搜尋，搜各專案 reference、guide、decision 頁的內文（要從 serve 開的頁面用） |
| 導覽 | `#/tour` | 一支 60 秒無聲短片，講 fankeel 怎麼跑一個任務；要從 serve 開的頁面才看得到 |
| 設定 | `#/settings` | profile 精靈，見 [profile.md](profile.md) |

點任一個 session 會進它自己的頁面 `#/s/<id>`，三個分頁：概覽（context 曲線、任務、每站花費）、派工（每個 agent 的 token 與錢）、事件（重播，每個 gate 等了多久）。

## 數字怎麼讀

- **錢**是 transcript 的用量乘上價目表算出來的，不是帳單。session 自己和它派出去的 agent 分開算，再加總。
- **近 30 天上方的卡片**：花費、token、active 時間、等待佔比，比的是最近 30 天對前 30 天。前期沒有資料時印「前期無資料」，不拿零當分母。等待佔比用百分點算，往上是變差。第五張「最常被換掉」是第一個選項最常被換成別的答案的那個 gate 題目。
- **等了多久**：從問題送出那一刻算起（registry 的 `gateAt`，gate 送出時記下）。舊的 session 沒有這個欄位，才退回 pending 檔的時間或那個 session 最後一次寫 registry 的時間，這樣算出來可能比實際等的短。
- **在站時間**來自 registry 的時鐘：那一站第一次到最後一次寫入之間。

每個數字從哪裡來、欄位的完整說明，在 [station.md](../90-agent/reference/station.md)。
