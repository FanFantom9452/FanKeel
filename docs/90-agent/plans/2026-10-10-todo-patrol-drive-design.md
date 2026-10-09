---
status: design-intent
---

# TODO 全表盤點（10-10）：逐站 headless driver、合併三處 helper、knip 重蓋日期 — Design

這次盤點要做四件事：

- 「逐站開 headless session」（session-1）：條件已成立。8846548c 接手 d3ff9844 在 10-08 交接的任務後，build、verify、audit 的 context 還是到了 405k、417k、425k，高於 `lib/context.js` 的 400000。使用者選擇這次就做。
- 「合併三處重複的 helper」（cuts-1）。
- 「knip unused exports 未開」（build-1）：`npx knip@6.41.0 --trace-export clearBadge` 仍回 `(no imports found)`，只重蓋日期。
- 「stage-agents-10」：由使用者自己跑 `claude --debug`。

class 為 architectural：driver 是新的子系統。這不是前端工作——driver 是 CLI，關卡沿用監控站既有的 `/answer`，不畫 mockup。

## 1. 逐站迴圈

- 新增 `scripts/drive.js`，用法是 `node scripts/drive.js --session <id> [--max-rounds N] [--max-usd X] [--timeout S] [--gate-wait S]`。`--session` 是一個 active 的 registry 條目，driver 從它目前的 `stage` 開始跑。
- 每一輪用 `spawnClaudeAsync`（`scripts/eval.js`）開一個全新的 `claude -p`。參數為 `--plugin-dir <plugin>`、`--permission-mode acceptEdits`、`--output-format json`、`--max-budget-usd <剩餘額度>`，prompt 走 stdin。
- prompt 是 stage agent 今天拿到的同一份 brief。做法是呼叫 `renderBrief`，`agentType` 給 `fankeel:fankeel-brain`；`profile` 是專案 profile 的副本，只把 `stage.agents` 換成本站，讓 brain 分支一定成立。
- 這個 headless session 不寫 registry 條目，和子代理一樣：它不擁有任務，條目屬於 `--session`。
- 換站一律走 `node scripts/task.js stage <word> --session <id>`，不直接寫 registry。

## 2. 三個上限

- `--max-rounds`（預設 12）：數 `claude -p` 呼叫的次數，同一站重跑也算一輪。到上限就停。
- `--max-usd`（預設 20）：把每輪結果的 `total_cost_usd` 加總；每輪的 `--max-budget-usd` 傳剩下的額度。剩不到 0.5 就停，和 `scripts/bench.js` 的 `capped` 同一條線。
- `--timeout`（預設 3600 秒）：整個 driver 的牆鐘上限，每輪的 spawn timeout 取剩下的時間。等關卡的時間不算在內，那一段由 `--gate-wait` 自己管。
- 每次停下都印一行 JSON：`{"stopped":<reason>,"rounds":n,"usd":x,"stage":s}`，reason 為 `rounds`、`usd`、`timeout`、`status`、`gate`、`pause`、`down`、`error` 之一。exit code 在 `down` 與 `pause` 時是 0，其餘都是 1。

## 3. status 欄位

- 每站的 handoff 檔，其 `json gate` 區塊的最上層要有 `"status"`，值為 `done`、`partial` 或 `blocked`。driver 在 prompt 末尾加一行，要求寫出這個欄位。
- 一輪結束後，handoff 檔不存在、gate 讀不出來（`readGate` 回 null 或 `invalid`），或 `status` 不在這三個值裡，driver 都以 `status` 停下，並印出 handoff 路徑。
- `status` 是 `blocked` 時，driver 照常把關卡貼出去，讓使用者決定。

## 4. 關卡走監控站

- 讀到關卡後，driver 照 `hooks/gate.js` 的形狀寫 `<stage>-pending.json`，內容是 `{questions, at, until}`，`until` 等於現在加上 `--gate-wait`（預設 86400 秒）。之後每秒用 `answersSince` 看答案檔有沒有更新。
- 等到答案就刪掉 pending 檔，依第一題的答案決定下一步：等於選項一的 label，就換到下一站；選項一是收工（`down` 或 `收工`）時，執行 `task.js down` 後停下；答案含「暫停」或 `pause`，就執行 `task.js next "<gate.next>"` 後以 `pause` 停下；其他答案，同一站再跑一輪，prompt 末尾附上答案檔路徑。
- `until` 過了還沒有答案，就刪掉 pending 檔，以 `gate` 停下。

## 5. 文件

- 新增 `docs/90-agent/reference/drive.md`：用法、三個上限、`status`、停下的原因表；`docs/README.md` 補索引列。

## 6. 合併三處重複的 helper

- `lib/spend.js` 的 `median` 加進 export，`lib/drift.js` 刪掉自己那份、改 require 它。`lib/compare.js` 那份空陣列回 0，行為不同，不動。
- `lib/reviewcheck.js` 的 `escape` 加進 export；`lib/tune.js` 的兩處和 `scripts/todo-check.js` 的那一處改用它。
- `hooks/dispatch-gate.js` 裡讀 `summary.json` 的手寫 `try/JSON.parse`，改用 `lib/json.js` 的 `readObject`；讀不到或不是物件時仍回 null。

## 7. knip 重蓋日期

- `docs/90-agent/todo/build-1.md` 的 description 改寫為 6.41.0 於 10-10 重跑仍是 `(no imports found)`，`stamp` 改成 2026-10-10，正文補一句。

## 8. 使用者自己跑的 allow 規則實測

- stage-agents-10：使用者在 auto mode 下用 `claude --debug`，寫一次 `.fankeel/build/` 底下的檔，把 debug 輸出裡的權限判定那幾行回報給 session。之後依結果改寫條目。

## What proves it done

| check | how |
|---|---|
| 三個上限各自會停 | `tests/drive.test.js` 換上假的 spawn：每輪寫一份帶 `status` 的 handoff，回報 `total_cost_usd`。`--max-rounds 2`、`--max-usd 1`（每輪 0.6）、`--timeout 1`（spawn 拖過 1 秒）各停在 `rounds`、`usd`、`timeout`。現在檔案不存在，測試是紅的。 |
| 沒有 status 就停 | 同一個測試檔，假的 spawn 寫一份沒有 `status` 的 handoff，driver 以 `status` 停下，`rounds` 為 1。 |
| 答案驅動換站 | 測試寫一份答案檔，第一題的答案等於選項一；registry 的 `stage` 換成下一站，`moves` 多一筆。 |
| 停下那行和 registry 一致 | 停下那行 JSON 的 `stage` 等於 `registry.readSession` 讀到的 `stage`，`usd` 等於假 spawn 回報的 `total_cost_usd` 總和。 |
| helper 合併 | `npm test` 合併前後都綠，`git diff --stat` 在 `lib/drift.js`、`lib/tune.js`、`scripts/todo-check.js`、`hooks/dispatch-gate.js` 淨減行數。 |
| 文件 | `node scripts/docs-check.js` exit 0，`node scripts/todo-check.js` exit 0。 |

## Files

| file | change |
|---|---|
| `scripts/drive.js` | 新增：CLI、逐站迴圈、三個上限、關卡等待 |
| `tests/drive.test.js` | 新增：假 spawn 驅動的上限、status、換站測試 |
| `docs/90-agent/reference/drive.md` | 新增：driver 的參考頁 |
| `docs/README.md` | 補 drive.md 與本計畫的索引列 |
| `lib/spend.js` | export `median` |
| `lib/drift.js` | 刪 `median`，改 require |
| `lib/reviewcheck.js` | export `escape` |
| `lib/tune.js` | 兩處改用 `escape` |
| `scripts/todo-check.js` | 一處改用 `escape` |
| `hooks/dispatch-gate.js` | 改用 `readObject` |
| `docs/90-agent/todo/build-1.md` | 重蓋日期 |

## Unverified

- 在 `claude -p` 加 `--permission-mode acceptEdits` 的情況下，brain 能不能寫 `.fankeel/build/` 底下的 handoff 檔——這正是 stage-agents-10 還沒有結論的那條 allow 規則。所以第一次實跑時，`status` 停下也可能是寫檔被拒。
