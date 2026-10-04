---
status: decision
last_verified: 2026-10-05
---

# TODO 全表盤點（10-04）：決策紀錄

一句話：程式碼可刪項做掉大半，週額度改由 `scripts/quota.js` 從 TokenBar 的 7 天讀數自動校準，子 session 兩臂探測得到「原因不成立」，stage-agents 九條裡能量的寫成一份報告、其餘改成由使用者親手做或標成等待。

計畫見 [../99-archive/2026-10-04-todo-patrol-five.md](../99-archive/2026-10-04-todo-patrol-five.md)。

## 為什麼

- 程式碼可刪項（cleanup-1）：審查列的十項裡，`logicalPath`、`SURVEY_SCRIPT`、`TODO_CHECK_SCRIPT`、`SURVEY_TOKEN` 只剩測試引用，刪掉並改測試；`readText` 收進 `lib/json.js`；`lenses.js` 與 `gate-check.js` 改用 `node:util` 的 `parseArgs`；`orient.js` 改用 `lib/blame.js` 匯出的 `git`。審查說未用的 `sourcesOf` 其實 `lib/tune.js` 仍在用，只拿掉 `scripts/tune.js` 的多餘 import，沒有刪函式。核對引用時發現不能照單全收，所以每項先重新核對再動。
- 週額度自動校準（spend-1）：新增 `lib/quota.js` 與 `scripts/quota.js`，從 TokenBar 的 `seven_day_pct` 讀數挑出跨 10 點以上的視窗，對上全機花費算出 `quota.week`，並把校準日寫進新的 profile key `quota.calibrated`；station 在花費旁註明校準日。寫入是成對的（兩個 key 一起寫或都不寫），並有備份與還原。
- 子 session 兩臂探測（sessions-3）：帶與不帶 `CLAUDE_CODE_CHILD_SESSION=1` 的 headless session 都寫了 sessions 活性檔，所以這個環境變數不是「不寫檔」的原因。`task.js` 的修正本來就不依賴這個原因。
- stage-agents：能從既有 transcript 量的寫進 `docs/90-agent/reports/2026-10-04-controlled-stages.md`，`subagents.md` 的接縫一節改寫成「跑過了什麼」；需要刻意製造情境的由使用者親手跑了第二個 agent、claims、profile 中途翻轉三組，結果記在各條。

## 沒做什麼

- `quota.js` 的成功路徑、真寫與還原只由合成資料的測試證明：真實的 `tokenbar-usage.jsonl` 只涵蓋約 15 分鐘，各視窗最多動 1 點，實跑 `--dry-run` 走到拒絕路徑（exit 1，`quota.week` 未動）。沒有造資料。記為 `spend-2`，等 TokenBar 累積出真實視窗。
- cleanup-1 的四項移到 `cleanup-2`：`fetchHealth` 改用 `fetch`（要先驗證不會拖住 hook 行程）、`lib/profile.js` 的 `git`、`lib/detail.js` 的 `readText`、三支 script 的 `readFile`。
- stage-agents-5（profile 中途翻轉）與 -8（在哪提交）仍是 blocked；-14（死 agent 的 inflight 標記）仍是 ready。
- 受控與非受控的對照沒有做，所以「build 兩回合提交省不省 context」判不了。
