---
status: current
last_verified: 2026-10-21
source_of_truth: .claude-plugin/plugin.json, hooks/mod.ts, hooks/pane.ts
---

# fankeel 在背景做什麼

裝好之後你只會打 `/fankeel`，其餘都由 hook 在 Claude Code 的事件上自動做。這頁一個 hook 一行：什麼時候觸發、做什麼。每個檔案在哪、怎麼改，見 [layout.md](../02-architecture/layout.md)。

每個 hook 在任何情況都以 0 結束：hook 拋錯會擋住它被呼叫的那件事，所以出錯時它寧可什麼都不做。

## 每輪 prompt 與每次回答

| hook | 觸發 | 做什麼 |
|---|---|---|
| `inject.js` | 你送出 prompt | 注入目前 task、這站的規則與報告骨架、其他 live session；`/fankeel` 時注入開場區塊；更新 badge |
| `resume.js` | `AskUserQuestion` 被回答後 | 再送一次這站的規則——回答不是 prompt，沒有這個就沒人提醒 |
| `stop.js` | 主 session 一輪結束時 | stage 還開著、而且沒有背景 Bash、非同步 Agent 或 `SendMessage` 在等時，擋下這次結束一次（`decision: block`）；`stop_hook_active` 表示已擋過，這個擋下就不再重複。每次結束都把回覆與背景工作記到手機聊天；手機已接上時，擋下之後再等手機訊息最久 `phone.hold` 秒（預設 1800），收到就當下一個指示擋下，這段等待不看 `stop_hook_active`；一樣以 0 結束 |
| `gate.js` | `AskUserQuestion` 送出前 | 記下 gate 開的時間以量等待；設了 `gate.away` 且你離開時先擋下問題並提示；開了 `notify.gate` 時發一則 ntfy 通知；設了 `gate.station` 時先等監控站上的回答 |

## 編輯與派工

| hook | 觸發 | 做什麼 |
|---|---|---|
| `guard.js` | 寫檔、shell、派 subagent 前 | scope guard：別的 live session 動過的檔，預設先問你；`git commit` 前掃 `.fankeel/sensitive.txt` 的字 |
| `touch.js` | Edit、Write、NotebookEdit 之後 | 把動過的檔記進這個 task 的 `claims` |
| `title.js` | 派 Agent 前 | 在 subagent 標題前加上模型、版本與 effort |
| `dispatch-gate.js` | 同一則訊息派的 Agent 超過 profile 的 dispatch.inflight（預設 8）時 | 先問你，附上花費估計 |
| `brief.js` | subagent 開始時 | 告訴它屬於哪個 task、動過哪些檔、回傳值有多貴 |
| `budget.js` | subagent 的每次工具呼叫前後；registry session 的主執行緒工具呼叫 | context 快滿時提醒 subagent 交接，太滿就只准交接；也把主執行緒的工具步驟記到手機聊天 |
| `agent-end.js` | subagent 開始與結束時 | 記下它何時起、何時停，給 Pane 的 agent 樹 |
| `gate-write.js` | Write 之後 | stage agent 寫出 handoff 時，當場檢查它的 gate 格式 |
| `relay-cap.js` | 傳訊息給另一個 session 或 agent 前（`SendMessage`、`mcp__ccd_session_mgmt__send_message`） | 只在這個 session 有進行中的 task 時作用：最長的字串值（含一層巢狀）超過 2000 字就擋下，要你改傳檔案路徑 |

## session 開始與結束

| hook | 觸發 | 做什麼 |
|---|---|---|
| `carry.js` | session 開啟、`/clear` 或 fork 之後 | 找交接過來或留下的 task，提議接回 |
| `leave.js` | session 結束 | 記下怎麼結束、花了多少，並重寫監控站；開了 `notify.end` 時發一則靜默的 ntfy 通知 |

## 畫在畫面上的

`hooks/mod.ts` 註冊的 engine module（`compact.ts`、`pane.ts`），不是 command hook：

- **band**：有 task 時在 prompt 上方畫兩行——站名、route 圓點、時間，以及 context 與配額的長條。
- **Pane**：有 task 時自己打開，`/fankeel-panel` 切換；列出 task、plan 的每個 task、subagent 樹、筆記與 TODO。
- **compact**：context 到 profile 的 `compact.at`（預設 450k tokens）時自動壓縮。

Claude Desktop 跑的是安裝當下的快照，新版要 `claude plugin update fankeel@fankeel` 之後才看得到。

## subagent

stage 派出去的 agent 各有一個檔在 `agents/`，固定自己的工具與模型。你不會直接叫它們：

| agent | 做什麼 |
|---|---|
| `fankeel-reader` | 唯讀，讀檔跑 script，只回傳決定問題的那幾行 |
| `fankeel-reviewer` | 唯讀，審 diff、plan 或證據表 |
| `fankeel-implementer` | build 時照 plan 做一個 task，先寫測試 |
| `fankeel-verifier` | verify 時為一個 task 寫證據列 |
| `fankeel-fixer` | 修文件裡的錯句或一行程式 |
| `fankeel-mover` | 搬、併、刪檔，不改內容 |
| `fankeel-mutator` | 對一行做突變、跑測試、再還原，證明測試抓得到 |
| `fankeel-brain` | profile 的 `stage.agents` 指定時，整站在乾淨的 context 裡跑 |
| `fankeel-judge` | `/fankeel-ask` 時把一題交給更強的模型判 |
| `fankeel-writer` | 寫一頁給人看的文件 |
| `fankeel-mockup` | design 時畫前端草圖頁 |
| `fankeel-render-reviewer` | 截圖檢查前端畫面與草圖是否一致 |
| `fankeel-retro` | land 時你同意才跑，讀 session 紀錄提議改 skill |
| `fankeel-slimmer` | 提議修剪每輪都讀進來的 `CLAUDE.md` 與 memory |
| `fankeel-init-scout` | `/fankeel-init` 時跑導入檢查並起草答案 |
