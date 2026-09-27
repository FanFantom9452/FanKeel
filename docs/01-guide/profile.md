---
status: current
last_verified: 2026-09-27
source_of_truth: lib/profile.js, docs/90-agent/reference/station.md, docs/90-agent/reference/registry.md, scripts/task.js
---

# Profile

profile 是 gate 的常備答案：先寫好，fankeel 就不再問那一題。它有兩層檔案加上內建預設，逐個 key 合併：

| 層 | 放在哪 |
|---|---|
| 專案 | 專案裡的 `.fankeel/profile.json`，會提交 |
| 機器 | Claude Code 設定目錄下的 `fankeel/profile.json` |
| 內建 | 寫死在 `lib/profile.js` |

專案層蓋過機器層，機器層蓋過內建。一個 key 三層都沒有值，就表示「到時候問我」。

## 每個 key

「建議」一欄取自站頁精靈的「平衡」組合；那組沒設的 key，建議就是內建值或不設。

| key | 意思 | 可選值 | 建議 |
|---|---|---|---|
| `land.integration` | 收尾時怎麼整合 | `merge`、`pr`、`keep` | `merge` |
| `land.push` | 收尾時要不要 push | `true`、`false` | `false` |
| `land.archivePlan` | 計畫落地後直接封存，還是先問 | `true`、`false` | `true` |
| `class.default` | 起任務沒指定類別時的預設 | `spike`、`bounded`、`architectural` | 不設，每次判斷 |
| `guard` | 別的 session 佔了檔案時：`ask` 問、`deny` 擋、`off` 只警告 | `ask`、`deny`、`off`；內建 `ask` | `ask` |
| `dispatch.floor` | 派給實作者與 reader 的最低模型 | `sonnet`、`opus`、`fable`、`haiku`；內建 `sonnet` | `sonnet` |
| `judge.model` | 判官（`/fankeel-ask`）用哪個模型 | `sonnet`、`opus`、`fable`、`haiku`；內建 `fable` | `fable` |
| `design.mockup` | 有前端的專案，design 站先畫頁面用哪個模型；`auto` 是前端工作不問就畫；`false` 不畫 | `false`、`auto`、`sonnet`、`opus`、`fable`；內建 `false` | 沒有前端就維持 `false` |
| `design.skill` | mockup 另外載入哪些 design skill，可多選，逗號分隔 | 精靈列出的六個 | 不設，交給 design 站判斷 |
| `station.hide` | 這個專案要不要從監控站隱藏 | `true`、`false`；內建 `false` | `false` |
| `gate.station` | gate 發出後，等監控站作答幾秒；`off` 不等 | `off`，或 1 到 600 的秒數（精靈列 `60`、`120`、`300`）；內建 `off` | `off` |
| `stage.agents` | 哪幾站交給站 agent 在乾淨 context 裡跑，主控只轉路徑 | `false`、`true`、`all`，或逗號分隔的站名；內建 `false` | `survey` |
| `security.local` | verify 的 security lens 先交給哪個本地 ollama 模型篩 | 一個 ollama 模型名稱 | 沒有本地模型就不設 |
| `prompt.all`、`prompt.<站>` | 附在每一站（或某一站）規則最後的一句自訂 prompt | 一行文字 | 需要時才設 |

最後兩列是自由文字，精靈沒有欄位給它們，要用下面的指令設。

## 在站頁精靈怎麼套

監控站的 `#/settings`（左側「設定 → 精靈」）是八步的精靈，每一步問一個習慣：收尾、任務大小、前端、context、撞檔、模型、監控站、答 gate。

- 每一步上方有兩到四顆「常見組合」，按一顆就一次設好它列的所有 key。
- 下面每個 key 一組卡片，一張卡一個值，可以只改一個 key。
- 最後一步是摘要：每個 key 目前的值、來自哪一層、說明；上面一排按鈕選要寫進哪個檔，機器預設或某個專案。
- 按「寫入 N 鍵」一次寫進去。頁面是直接開檔案、不是 serve 出來的時候，同一個位置會印出要自己跑的指令。

不開站頁也可以直接設：

```
node <plugin>/scripts/task.js profile set land.integration merge
node <plugin>/scripts/task.js profile set guard ask --default
node <plugin>/scripts/task.js profile show
```

`--default` 寫進機器層；不加就寫進目前這個專案。
