---
status: current
last_verified: 2026-10-21
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
| 現在 | `#/` | 只有四組：等你回答與正在跑的 session，每一個點了開它的 focus 頁 `/f/<id>/<stage>`；正在跑的 subagent 與背景 shell；TODO，寫 Ready 幾條與到期的 Blocked；一行花費，今天與這一週。原本放在首頁的卡片移到 Sessions 與花費兩頁 |
| focus 頁 | `/f/<session-id>/<tab>` | 一個 session 的精簡頁，打開就停在這一站要你看的東西；任何頁按 Ctrl+K 可以跳到某個 session |
| 進行中 | `#/live` | 最上面是等你回答的 gate，沒有就一行「沒有在等你的 gate」；然後「正在跑」，每個 session 一列，route 畫成站點，目前那站外圈高亮並標在站時間；每列下方列出現在在跑的 stage agent 與 subagent，沒有就一行「主 session 自己在做」；「可能已經停了」放 `live?` 與 `stale`，stale 的 registry 有 clear 按鈕；最下面是沒有 session 的 registry，一排名字，點了到該專案頁 |
| 最近 | `#/sessions` | 近 30 天有花費、或還在 live 的 session，新的在上 |
| 全部清單 | `#/list` | 可排序的表，點一列在旁邊看細節 |
| 比較 | `#/cmp` | 在清單或專案頁勾兩個 session，並排比 |
| 近 30 天 | `#/days` | 一天一根柱子，高度可切 token、錢、時間；分段可切 model、專案、站、主 session 對 agent、版本、成本組成 |
| 依專案 | `#/projects` | 專案列表；點進 `#/p/<key>` 看它的 session 散點、可疊第二個專案、各 route 每站的平均 |
| 文件 | `#/docs` | 每個專案 `.fankeel/map.md` 的統計卡：文件數、狀態分布、planned 未做、未宣告；上方有全文搜尋，搜各專案 reference、guide、decision 頁的內文（要從 serve 開的頁面用） |
| 導覽 | `#/tour` | 一支 60 秒的動態宣傳片，配純音樂，中英兩版跟著監控站的語言，七站各用一個動畫講它在做什麼；要從 serve 開的頁面才看得到 |
| 設定 | `#/settings` | profile 精靈，見 [profile.md](profile.md)；精靈下面是「手機遠端」卡片，見下方〈從手機看〉 |

點任一個 session 會進它自己的頁面 `#/s/<id>`，有六個分頁。概覽是 context 曲線、任務與每站花費。派工是每個 agent 的 token 與錢。事件是重播，看得到每個 gate 等了多久。對話是這個 session 的整段對話，你和 Claude 的文字全文，一次 100 則。對話的網址是 `#/s/<id>/talk`，文字只留在這台機器上。計畫（`#/s/<id>/plan`）畫出這個 session 最新的 plan：一組一欄，每個 task 一張卡，寫它改哪些檔、等哪幾個 task；停在 plan gate 時，上方會問你要不要核准，答案在 Claude Desktop 給。關卡（`#/s/<id>/gate`）把 survey、design、build、land 這一站交回的報告排成一頁：發現、要改的檔、改了什麼；land 這一站則是六欄完成紀錄（要求、做了什麼、為什麼這樣做、驗過・沒驗過、花費、還剩什麼）；停在那一站的 gate 時，上方多一條問題，答案一樣在 Claude Desktop 給。session 卡上若這個任務畫過圖，會多一塊「AI 畫的圖」，點開是那張 `.board` 畫成的 SVG；專案卡則連到專案的架構圖。

## 從手機看

監控站可以經這台機器的 Tailscale 讓手機連進來，但預設是關的。開關是 profile 的 `station.remote`，只讀機器層 profile，內建 `false`；關著時只有本機（`127.0.0.1`）連得到，因為監控站看得到每個 session 的整段對話，不該在你沒說要的時候離開這台機器。打開時監控站跑 `tailscale serve`，只在你自己的 tailnet（Tailscale 串起來的私人網路）裡開放，從不跑 `tailscale funnel` 對外公開；Tailscale 沒裝、沒在跑或 Funnel 開著時，遠端維持關閉，原因寫在卡片上，本機照常可用。

開關在 `#/settings` 精靈下面的「手機遠端」卡片：打開後卡片給出 tailnet 網址（附「複製」）、一張配對 QR、已配對的手機（可「解除」），以及三個推播開關。配對碼一次性、10 分鐘內有效，因為從 tailnet 來的請求沒有配對過的手機一律擋下。手機掃 QR 後打開的是手機頁 `/m`：從 tailnet 打開監控站根網址 `/` 會自動轉到 `/m`，本機瀏覽器開 `/` 仍是桌面版。要關掉時把卡片的開關關上；監控站下一個請求起就拒絕 tailnet，但不動 Tailscale 本身，要連代理一起拿掉就自己跑：

```
tailscale serve --https=443 off
```

推播走 ntfy（一個開放的推播服務，手機裝 ntfy app 訂閱一個 topic 就收得到）。卡片上的三個開關對應 `notify.gate`、`notify.stage`、`notify.end`，內建都關：`notify.gate` 在 gate 等你回答時推一則高優先、會響的通知，附「打開 gate」；`notify.stage` 在一站做完時推一則靜音通知；`notify.end` 在任務結束時推一則靜音通知，附含子代理的花費。第一次從卡片打開任一個時，監控站會在 `notify.topic` 寫一個 `fankeel-` 開頭的亂數 topic，卡片上寫出要訂閱哪一個。這五個 key 和 `station.remote` 一樣只讀機器層，clone 下來的 repo 沒辦法把你的 gate 題目推到它指定的伺服器；完整說明與手機沒響時要看的 `notify-failed.log` 見 [profile.md](profile.md)。自架 ntfy 時改 `notify.server`：

```
node <plugin>/scripts/task.js profile set notify.server https://ntfy.example.com --default
```

## 數字怎麼讀

- **錢**是 transcript 的用量乘上價目表算出來的，不是帳單。session 自己和它派出去的 agent 分開算，再加總。
- **近 30 天上方的卡片**：花費、token、active 時間、等待佔比，比的是最近 30 天對前 30 天。前期沒有資料時印「前期無資料」，不拿零當分母。等待佔比用百分點算，往上是變差。第五張「最常被換掉」是第一個選項最常被換成別的答案的那個 gate 題目。
- **等了多久**：從問題送出那一刻算起（registry 的 `gateAt`，gate 送出時記下）。舊的 session 沒有這個欄位，才退回 pending 檔的時間或那個 session 最後一次寫 registry 的時間，這樣算出來可能比實際等的短。
- **在站時間**來自 registry 的時鐘：那一站第一次到最後一次寫入之間。

每個數字從哪裡來、欄位的完整說明，在 [station.md](../90-agent/reference/station.md)。
